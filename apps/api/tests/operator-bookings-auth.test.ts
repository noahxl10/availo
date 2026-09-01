import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module.js";
import { configureApiHttp } from "../src/api-http.js";
import { prefixedId } from "../src/common/ids.js";
import { DEMO_BUSINESS_ID } from "../src/common/tenant.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("authenticated operator booking reads", () => {
  const prisma = new PrismaService();
  const jwtSecret = "operator-booking-read-secret";

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects missing, malformed, forged, expired, disabled, and tenant-mismatched tokens", async () => {
    const disabledUser = await prisma.user.create({
      data: {
        id: prefixedId("usr"),
        businessId: DEMO_BUSINESS_ID,
        email: "disabled-bookings@example.invalid",
        role: "viewer",
        status: "disabled"
      }
    });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        await expect(getBookings(baseUrl)).resolves.toMatchObject({ status: 401 });
        await expect(getBookings(baseUrl, "not-a-token")).resolves.toMatchObject({ status: 401 });
        await expect(getBookings(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner" }, "wrong-secret"))).resolves.toMatchObject({ status: 401 });
        await expect(
          getBookings(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner", exp: Math.floor(Date.now() / 1000) - 60 }, jwtSecret))
        ).resolves.toMatchObject({ status: 401 });
        await expect(getBookings(baseUrl, await signToken(disabledUser.id, DEMO_BUSINESS_ID))).resolves.toMatchObject({ status: 401 });
        await expect(
          getBookings(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: "biz_other_operator", role: "owner", sid: prefixedId("ses") }, jwtSecret, { expiresIn: "15m" }))
        ).resolves.toMatchObject({ status: 401 });
      });
    } finally {
      await prisma.session.deleteMany({ where: { userId: disabledUser.id } });
      await prisma.user.deleteMany({ where: { id: disabledUser.id } });
    }
  });

  it("returns paginated bookings only for the authenticated operator tenant", async () => {
    const fixture = await createBookingReadFixture("tenant-list", 3);
    const otherFixture = await createBookingReadFixture("tenant-hidden", 1);

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const firstPageResponse = await getBookings(baseUrl, await signToken(fixture.userId, fixture.businessId), "?limit=2");
        expect(firstPageResponse.status).toBe(200);
        const firstPage = (await firstPageResponse.json()) as BookingPage;

        expect(firstPage.items.map((booking) => booking.id)).toEqual([fixture.bookingIds[2], fixture.bookingIds[1]]);
        expect(firstPage.items.every((booking) => booking.businessId === fixture.businessId)).toBe(true);
        expect(JSON.stringify(firstPage)).not.toContain(otherFixture.businessId);
        expect(firstPage.nextCursor).toEqual(expect.any(String));

        const secondPageResponse = await getBookings(baseUrl, await signToken(fixture.userId, fixture.businessId), `?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor ?? "")}`);
        expect(secondPageResponse.status).toBe(200);
        const secondPage = (await secondPageResponse.json()) as BookingPage;

        expect(secondPage.items.map((booking) => booking.id)).toEqual([fixture.bookingIds[0]]);
        expect(secondPage.nextCursor).toBeNull();
      });
    } finally {
      await cleanupBookingReadFixture(otherFixture.businessId);
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("paginates bookings with matching timestamps without duplicates or skips", async () => {
    const fixture = await createBookingReadFixture("tenant-same-created", 0);
    const createdAt = new Date(Date.UTC(2026, 0, 2, 12, 0, 0));
    const ids = ["bok_same_003", "bok_same_002", "bok_same_001"];

    try {
      for (const id of ids) {
        await createFixtureBooking(fixture.businessId, fixture.listingId, id, createdAt, id);
      }

      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        const firstPageResponse = await getBookings(baseUrl, token, "?limit=1");
        expect(firstPageResponse.status).toBe(200);
        const firstPage = (await firstPageResponse.json()) as BookingPage;

        const secondPageResponse = await getBookings(baseUrl, token, `?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor ?? "")}`);
        expect(secondPageResponse.status).toBe(200);
        const secondPage = (await secondPageResponse.json()) as BookingPage;

        const thirdPageResponse = await getBookings(baseUrl, token, `?limit=1&cursor=${encodeURIComponent(secondPage.nextCursor ?? "")}`);
        expect(thirdPageResponse.status).toBe(200);
        const thirdPage = (await thirdPageResponse.json()) as BookingPage;

        expect([...firstPage.items, ...secondPage.items, ...thirdPage.items].map((booking) => booking.id)).toEqual(ids);
        expect(new Set([...firstPage.items, ...secondPage.items, ...thirdPage.items].map((booking) => booking.id)).size).toBe(3);
        expect(firstPage.nextCursor).toEqual(expect.any(String));
        expect(secondPage.nextCursor).toEqual(expect.any(String));
        expect(thirdPage.nextCursor).toBeNull();
      });
    } finally {
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("caps invalid pagination input before reading bookings", async () => {
    const fixture = await createBookingReadFixture("tenant-pagination", 1);

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        await expect(getBookings(baseUrl, token, "?limit=0")).resolves.toMatchObject({ status: 400 });
        await expect(getBookings(baseUrl, token, "?limit=101")).resolves.toMatchObject({ status: 400 });
        await expect(getBookings(baseUrl, token, "?limit=not-a-number")).resolves.toMatchObject({ status: 400 });
        await expect(getBookings(baseUrl, token, "?cursor=not-a-cursor")).resolves.toMatchObject({ status: 400 });

        const defaultResponse = await getBookings(baseUrl, token);
        expect(defaultResponse.status).toBe(200);
        await expect(defaultResponse.json()).resolves.toMatchObject({ items: expect.any(Array), nextCursor: null });
      });
    } finally {
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("returns the same generic 404 for missing and cross-tenant booking IDs", async () => {
    const fixture = await createBookingReadFixture("tenant-detail", 1);
    const otherFixture = await createBookingReadFixture("tenant-detail-hidden", 1);

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        const ownBooking = await getBooking(baseUrl, fixture.bookingIds[0]!, token);
        expect(ownBooking.status).toBe(200);
        await expect(ownBooking.json()).resolves.toMatchObject({ id: fixture.bookingIds[0]!, businessId: fixture.businessId });

        const missing = await getBooking(baseUrl, "bok_missing_operator_read", token);
        const crossTenant = await getBooking(baseUrl, otherFixture.bookingIds[0]!, token);
        expect(missing.status).toBe(404);
        expect(crossTenant.status).toBe(404);
        await expect(missing.json()).resolves.toMatchObject({ message: "Booking not found" });
        await expect(crossTenant.json()).resolves.toMatchObject({ message: "Booking not found" });
      });
    } finally {
      await cleanupBookingReadFixture(otherFixture.businessId);
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("has an index for tenant-scoped booking pagination", async () => {
    const bookingIndexes = await prisma.$queryRaw<{ name: string }[]>`PRAGMA index_list("bookings")`;
    expect(bookingIndexes.map((index) => index.name)).toContain("bookings_business_id_created_at_id_idx");
  });

  async function withHttpApp<T>(env: Record<string, string>, callback: (baseUrl: string) => Promise<T>) {
    return withEnv(env, async () => {
      const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false, logger: false });
      configureApiHttp(app);
      await app.listen(0);
      const address = app.getHttpServer().address() as AddressInfo;
      try {
        return await callback(`http://127.0.0.1:${address.port}`);
      } finally {
        await app.close();
      }
    });
  }

  function getBookings(baseUrl: string, accessToken?: string, query = "") {
    return fetch(`${baseUrl}/bookings${query}`, accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {});
  }

  function getBooking(baseUrl: string, id: string, accessToken: string) {
    return fetch(`${baseUrl}/bookings/${id}`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  async function signToken(userId: string, businessId: string) {
    const sessionId = prefixedId("ses");
    await prisma.session.create({
      data: { id: sessionId, userId, businessId, refreshTokenHash: "access-token-test-session", expiresAt: new Date(Date.now() + 60_000) }
    });
    return jwt.sign({ sub: userId, businessId, role: "owner", sid: sessionId }, jwtSecret, { expiresIn: "15m" });
  }

  async function createBookingReadFixture(slugSeed: string, bookingCount: number) {
    const businessId = prefixedId("biz");
    const userId = prefixedId("usr");
    const listingId = prefixedId("lst");
    const bookingIds: string[] = [];

    await prisma.business.create({
      data: {
        id: businessId,
        name: `Operator ${slugSeed}`,
        slug: `${slugSeed}-${businessId}`,
        status: "active",
        timezone: "America/Denver",
        currency: "USD"
      }
    });
    await prisma.user.create({ data: { id: userId, businessId, email: `${userId}@example.invalid`, role: "owner", status: "active" } });
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId,
        title: `Listing ${slugSeed}`,
        description: "Booking read fixture",
        category: "Tour",
        status: "active",
        basePriceCents: 3000,
        durationMinutes: 45,
        minGuests: 1,
        maxGuests: 6,
        capacity: 6,
        imageUrlsJson: "[]"
      }
    });

    const baseTime = Date.UTC(2026, 0, 1, 12, 0, 0);
    for (let index = 0; index < bookingCount; index += 1) {
      const bookingId = prefixedId("bok");
      bookingIds.push(bookingId);
      await createFixtureBooking(businessId, listingId, bookingId, new Date(baseTime + index * 60_000), `${slugSeed}-${index}`);
    }

    return { businessId, userId, listingId, bookingIds };
  }

  function createFixtureBooking(businessId: string, listingId: string, id: string, createdAt: Date, customerSeed: string) {
    return prisma.booking.create({
      data: {
        id,
        businessId,
        listingId,
        customerName: `Customer ${customerSeed}`,
        customerEmail: `${customerSeed}@example.invalid`,
        bookingDate: dateAfterDays(21),
        startTime: "10:00 AM",
        endTime: "10:45 AM",
        guestCount: 1,
        adultCount: 1,
        childCount: 0,
        status: "confirmed",
        paymentStatus: "paid",
        subtotalCents: 3000,
        taxCents: 0,
        platformFeeCents: 180,
        totalCents: 3180,
        createdAt
      }
    });
  }

  async function cleanupBookingReadFixture(businessId: string) {
    const bookings = await prisma.booking.findMany({ where: { businessId }, select: { id: true } });
    const bookingIds = bookings.map((booking) => booking.id);
    await prisma.paymentEvent.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.bookingAddOn.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { businessId } });
    await prisma.bookingHold.deleteMany({ where: { businessId } });
    await prisma.availabilityException.deleteMany({ where: { businessId } });
    await prisma.availabilityRule.deleteMany({ where: { businessId } });
    await prisma.addOn.deleteMany({ where: { businessId } });
    await prisma.listing.deleteMany({ where: { businessId } });
    await prisma.session.deleteMany({ where: { businessId } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
  }

  async function withEnv<T>(values: Record<string, string>, callback: () => Promise<T>) {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    try {
      return await callback();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  function dateAfterDays(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
});

type BookingPage = {
  items: { id: string; businessId: string }[];
  nextCursor: string | null;
};
