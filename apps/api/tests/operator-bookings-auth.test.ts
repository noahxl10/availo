import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module.js";
import { configureApiHttp } from "../src/api-http.js";
import { BookingService } from "../src/bookings/booking.service.js";
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
        expect(firstPage.items.every((booking) => !("businessId" in booking))).toBe(true);
        expect(JSON.stringify(firstPage)).not.toContain(otherFixture.businessId);
        expect(JSON.stringify(firstPage)).not.toContain("paymentReferenceId");
        expect(JSON.stringify(firstPage)).not.toContain("paymentIntentId");
        expect(JSON.stringify(firstPage)).not.toContain("paymentExpiresAt");
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

  it("filters bookings by status and booking date inside the authenticated tenant", async () => {
    const fixture = await createBookingReadFixture("tenant-filter", 0);
    const otherFixture = await createBookingReadFixture("tenant-filter-hidden", 0);
    const matchingOld = "bok_filter_confirmed_old";
    const matchingNew = "bok_filter_confirmed_new";
    const pending = "bok_filter_pending";
    const canceled = "bok_filter_canceled";
    const otherTenant = "bok_filter_hidden";

    try {
      await createFixtureBooking(fixture.businessId, fixture.listingId, matchingOld, new Date(Date.UTC(2026, 0, 5, 12, 0, 0)), "filter-confirmed-old", {
        bookingDate: "2026-02-10",
        status: "confirmed",
        paymentStatus: "paid"
      });
      await createFixtureBooking(fixture.businessId, fixture.listingId, pending, new Date(Date.UTC(2026, 0, 6, 12, 0, 0)), "filter-pending", {
        bookingDate: "2026-02-11",
        status: "pending_payment",
        paymentStatus: "pending"
      });
      await createFixtureBooking(fixture.businessId, fixture.listingId, matchingNew, new Date(Date.UTC(2026, 0, 7, 12, 0, 0)), "filter-confirmed-new", {
        bookingDate: "2026-02-12",
        status: "confirmed",
        paymentStatus: "paid"
      });
      await createFixtureBooking(fixture.businessId, fixture.listingId, canceled, new Date(Date.UTC(2026, 0, 8, 12, 0, 0)), "filter-canceled", {
        bookingDate: "2026-02-13",
        status: "canceled",
        paymentStatus: "failed"
      });
      await createFixtureBooking(otherFixture.businessId, otherFixture.listingId, otherTenant, new Date(Date.UTC(2026, 0, 9, 12, 0, 0)), "filter-hidden", {
        bookingDate: "2026-02-12",
        status: "confirmed",
        paymentStatus: "paid"
      });

      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);

        const confirmedResponse = await getBookings(baseUrl, token, "?status=confirmed");
        expect(confirmedResponse.status).toBe(200);
        const confirmed = (await confirmedResponse.json()) as BookingPage;
        expect(confirmed.items.map((booking) => booking.id)).toEqual([matchingNew, matchingOld]);
        expect(confirmed.items.every((booking) => booking.status === "confirmed")).toBe(true);
        expect(JSON.stringify(confirmed)).not.toContain(otherTenant);
        expect(JSON.stringify(confirmed)).not.toContain("paymentReferenceId");
        expect(JSON.stringify(confirmed)).not.toContain("paymentIntentId");
        expect(JSON.stringify(confirmed)).not.toContain("paymentExpiresAt");

        const fromDateResponse = await getBookings(baseUrl, token, "?fromDate=2026-02-12");
        expect(fromDateResponse.status).toBe(200);
        await expect(fromDateResponse.json()).resolves.toMatchObject({ items: [{ id: canceled }, { id: matchingNew }], nextCursor: null });

        const dateRangeResponse = await getBookings(baseUrl, token, "?fromDate=2026-02-11&toDate=2026-02-12");
        expect(dateRangeResponse.status).toBe(200);
        await expect(dateRangeResponse.json()).resolves.toMatchObject({ items: [{ id: matchingNew }, { id: pending }], nextCursor: null });

        const firstFilteredPageResponse = await getBookings(baseUrl, token, "?status=confirmed&fromDate=2026-02-10&toDate=2026-02-12&limit=1");
        expect(firstFilteredPageResponse.status).toBe(200);
        const firstFilteredPage = (await firstFilteredPageResponse.json()) as BookingPage;
        expect(firstFilteredPage.items.map((booking) => booking.id)).toEqual([matchingNew]);
        expect(firstFilteredPage.nextCursor).toEqual(expect.any(String));

        const secondFilteredPageResponse = await getBookings(
          baseUrl,
          token,
          `?status=confirmed&fromDate=2026-02-10&toDate=2026-02-12&limit=1&cursor=${encodeURIComponent(firstFilteredPage.nextCursor ?? "")}`
        );
        expect(secondFilteredPageResponse.status).toBe(200);
        const secondFilteredPage = (await secondFilteredPageResponse.json()) as BookingPage;
        expect(secondFilteredPage.items.map((booking) => booking.id)).toEqual([matchingOld]);
        expect(secondFilteredPage.nextCursor).toBeNull();
      });
    } finally {
      await cleanupBookingReadFixture(otherFixture.businessId);
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
        await expect(getBookings(baseUrl, token, "?status=paid")).resolves.toMatchObject({ status: 400 });
        await expect(getBookings(baseUrl, token, "?fromDate=2026-02-30")).resolves.toMatchObject({ status: 400 });
        await expect(getBookings(baseUrl, token, "?toDate=02-28-2026")).resolves.toMatchObject({ status: 400 });
        await expect(getBookings(baseUrl, token, "?fromDate=2026-03-01&toDate=2026-02-28")).resolves.toMatchObject({ status: 400 });

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
        const ownBookingBody = await ownBooking.json();
        expect(ownBookingBody).toMatchObject({ id: fixture.bookingIds[0]!, customerName: "Customer tenant-detail-0", listing: { id: fixture.listingId } });
        expect(JSON.stringify(ownBookingBody)).not.toContain("businessId");
        expect(JSON.stringify(ownBookingBody)).not.toContain("paymentReferenceId");
        expect(JSON.stringify(ownBookingBody)).not.toContain("paymentIntentId");
        expect(JSON.stringify(ownBookingBody)).not.toContain("paymentExpiresAt");

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

  it("allows staff to cancel same-tenant unpaid pending bookings and records a minimal audit trail", async () => {
    const fixture = await createBookingReadFixture("tenant-cancel", 0, "staff");
    const bookingId = prefixedId("bok");
    await createFixtureBooking(fixture.businessId, fixture.listingId, bookingId, new Date(), "tenant-cancel", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentProvider: "mock",
      paymentReferenceId: `mock_${bookingId}`,
      paymentExpiresAt: new Date(Date.now() + 15 * 60_000)
    });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const response = await cancelBooking(baseUrl, bookingId, await signToken(fixture.userId, fixture.businessId, "staff"));
        expect(response.status).toBe(201);
        const canceled = await response.json();

        expect(canceled).toMatchObject({ id: bookingId, status: "canceled", paymentStatus: "failed" });
        expect(JSON.stringify(canceled)).not.toContain("businessId");
        expect(JSON.stringify(canceled)).not.toContain("paymentReferenceId");
        expect(JSON.stringify(canceled)).not.toContain("paymentIntentId");
        expect(JSON.stringify(canceled)).not.toContain("paymentExpiresAt");

        await expect(
          prisma.auditLog.findMany({
            where: { businessId: fixture.businessId, userId: fixture.userId, entityId: bookingId },
            select: { action: true, metadataJson: true }
          })
        ).resolves.toEqual([
          {
            action: "booking.canceled",
            metadataJson: JSON.stringify({ previousStatus: "pending_payment", previousPaymentStatus: "pending" })
          }
        ]);
        await expect(prisma.paymentEvent.count({ where: { bookingId } })).resolves.toBe(0);
      });
    } finally {
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("keeps viewers read-only and hides cross-tenant cancellation attempts", async () => {
    const viewerFixture = await createBookingReadFixture("tenant-cancel-viewer", 0, "viewer");
    const ownerFixture = await createBookingReadFixture("tenant-cancel-owner", 0, "owner");
    const hiddenFixture = await createBookingReadFixture("tenant-cancel-hidden", 0, "owner");
    const viewerBookingId = prefixedId("bok");
    const ownerBookingId = prefixedId("bok");
    const hiddenBookingId = prefixedId("bok");
    await createFixtureBooking(viewerFixture.businessId, viewerFixture.listingId, viewerBookingId, new Date(), "viewer-cancel", pendingBookingData(viewerBookingId));
    await createFixtureBooking(ownerFixture.businessId, ownerFixture.listingId, ownerBookingId, new Date(), "owner-cancel", pendingBookingData(ownerBookingId));
    await createFixtureBooking(hiddenFixture.businessId, hiddenFixture.listingId, hiddenBookingId, new Date(), "hidden-cancel", pendingBookingData(hiddenBookingId));

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        await expect(cancelBooking(baseUrl, viewerBookingId, await signToken(viewerFixture.userId, viewerFixture.businessId, "viewer"))).resolves.toMatchObject({ status: 403 });
        await expect(cancelBooking(baseUrl, hiddenBookingId, await signToken(ownerFixture.userId, ownerFixture.businessId))).resolves.toMatchObject({ status: 404 });
        await expect(cancelBooking(baseUrl, "bok_missing_cancel", await signToken(ownerFixture.userId, ownerFixture.businessId))).resolves.toMatchObject({ status: 404 });

        await expect(prisma.booking.findUniqueOrThrow({ where: { id: viewerBookingId } })).resolves.toMatchObject({ status: "pending_payment", paymentStatus: "pending" });
        await expect(prisma.booking.findUniqueOrThrow({ where: { id: hiddenBookingId } })).resolves.toMatchObject({ status: "pending_payment", paymentStatus: "pending" });
      });
    } finally {
      await cleanupBookingReadFixture(hiddenFixture.businessId);
      await cleanupBookingReadFixture(ownerFixture.businessId);
      await cleanupBookingReadFixture(viewerFixture.businessId);
    }
  });

  it("rejects cancellation for settled bookings without mutating state", async () => {
    const fixture = await createBookingReadFixture("tenant-cancel-settled", 1);

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const response = await cancelBooking(baseUrl, fixture.bookingIds[0]!, await signToken(fixture.userId, fixture.businessId));
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ message: "Only unpaid pending bookings can be canceled" });
        await expect(prisma.booking.findUniqueOrThrow({ where: { id: fixture.bookingIds[0]! } })).resolves.toMatchObject({ status: "confirmed", paymentStatus: "paid" });
        await expect(prisma.auditLog.count({ where: { businessId: fixture.businessId, action: "booking.canceled" } })).resolves.toBe(0);
      });
    } finally {
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("releases pending booking capacity and rejects late mock confirmation after cancellation", async () => {
    const fixture = await createBookingReadFixture("tenant-cancel-capacity", 0);
    const bookingId = prefixedId("bok");
    const bookingDate = dateAfterDays(28);
    await prisma.availabilityRule.create({
      data: {
        id: prefixedId("avr"),
        businessId: fixture.businessId,
        listingId: fixture.listingId,
        dayOfWeek: new Date(`${bookingDate}T12:00:00`).getDay(),
        startTime: "10:00 AM",
        endTime: "11:00 AM",
        slotIntervalMinutes: 60,
        capacity: 2,
        effectiveStartDate: bookingDate
      }
    });
    await createFixtureBooking(fixture.businessId, fixture.listingId, bookingId, new Date(), "capacity-cancel", {
      ...pendingBookingData(bookingId),
      bookingDate,
      startTime: "10:00 AM",
      endTime: "10:45 AM",
      guestCount: 2,
      adultCount: 2
    });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret, ALLOW_MOCK_PAYMENTS: "true" }, async (baseUrl) => {
        const before = await fetch(`${baseUrl}/public/listings/${fixture.listingId}/availability?date=${bookingDate}`);
        expect(before.status).toBe(200);
        await expect(before.json()).resolves.toMatchObject({ slots: [expect.objectContaining({ startTime: "10:00 AM", capacityRemaining: 0 })] });

        const canceled = await cancelBooking(baseUrl, bookingId, await signToken(fixture.userId, fixture.businessId));
        expect(canceled.status).toBe(201);

        const after = await fetch(`${baseUrl}/public/listings/${fixture.listingId}/availability?date=${bookingDate}`);
        expect(after.status).toBe(200);
        await expect(after.json()).resolves.toMatchObject({ slots: [expect.objectContaining({ startTime: "10:00 AM", capacityRemaining: 2 })] });

        const latePayment = await fetch(`${baseUrl}/payments/mock/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bookingId, providerEventId: "evt_late_canceled_mock" })
        });
        expect(latePayment.status).toBe(400);
        await expect(prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).resolves.toMatchObject({ status: "canceled", paymentStatus: "failed" });
        await expect(prisma.paymentEvent.count({ where: { bookingId } })).resolves.toBe(0);
      });
    } finally {
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("expires Stripe Checkout before canceling a pending Stripe booking", async () => {
    const fixture = await createBookingReadFixture("tenant-cancel-stripe", 0);
    const bookingId = prefixedId("bok");
    const sessionId = `cs_test_${bookingId}`;
    await createFixtureBooking(fixture.businessId, fixture.listingId, bookingId, new Date(), "stripe-cancel", {
      ...pendingBookingData(bookingId),
      paymentProvider: "stripe",
      paymentReferenceId: sessionId,
      paymentIntentId: `pi_test_${bookingId}`,
      paymentExpectedCurrency: "usd"
    });
    const expiredSessions: string[] = [];
    const service = new BookingService(prisma, {
      createCheckoutSession: async () => {
        throw new Error("not used");
      },
      expireCheckoutSession: async (id: string) => {
        expiredSessions.push(id);
      }
    });

    try {
      const response = await service.cancel({ userId: fixture.userId, businessId: fixture.businessId, role: "owner", sessionId: prefixedId("ses") }, bookingId);
      expect(response).toMatchObject({ id: bookingId, status: "canceled", paymentStatus: "failed" });
      expect(expiredSessions).toEqual([sessionId]);
      await expect(prisma.auditLog.count({ where: { businessId: fixture.businessId, userId: fixture.userId, entityId: bookingId, action: "booking.canceled" } })).resolves.toBe(1);
    } finally {
      await cleanupBookingReadFixture(fixture.businessId);
    }
  });

  it("fails closed without mutating when Stripe Checkout expiration fails", async () => {
    const fixture = await createBookingReadFixture("tenant-cancel-stripe-fail", 0);
    const bookingId = prefixedId("bok");
    await createFixtureBooking(fixture.businessId, fixture.listingId, bookingId, new Date(), "stripe-cancel-fail", {
      ...pendingBookingData(bookingId),
      paymentProvider: "stripe",
      paymentReferenceId: `cs_test_${bookingId}`,
      paymentIntentId: `pi_test_${bookingId}`,
      paymentExpectedCurrency: "usd"
    });
    const service = new BookingService(prisma, {
      createCheckoutSession: async () => {
        throw new Error("not used");
      },
      expireCheckoutSession: async () => {
        throw new Error("stripe unavailable");
      }
    });

    try {
      await expect(service.cancel({ userId: fixture.userId, businessId: fixture.businessId, role: "owner", sessionId: prefixedId("ses") }, bookingId)).rejects.toThrow(
        "Stripe Checkout session could not be expired"
      );
      await expect(prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).resolves.toMatchObject({ status: "pending_payment", paymentStatus: "pending" });
      await expect(prisma.auditLog.count({ where: { businessId: fixture.businessId, action: "booking.canceled" } })).resolves.toBe(0);
    } finally {
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

  async function signToken(userId: string, businessId: string, role: "owner" | "admin" | "staff" | "viewer" = "owner") {
    const sessionId = prefixedId("ses");
    await prisma.session.create({
      data: { id: sessionId, userId, businessId, refreshTokenHash: "access-token-test-session", expiresAt: new Date(Date.now() + 60_000) }
    });
    return jwt.sign({ sub: userId, businessId, role, sid: sessionId }, jwtSecret, { expiresIn: "15m" });
  }

  async function createBookingReadFixture(slugSeed: string, bookingCount: number, role: "owner" | "admin" | "staff" | "viewer" = "owner") {
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
    await prisma.user.create({ data: { id: userId, businessId, email: `${userId}@example.invalid`, role, status: "active" } });
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

  function createFixtureBooking(businessId: string, listingId: string, id: string, createdAt: Date, customerSeed: string, overrides: Partial<FixtureBookingData> = {}) {
    const bookingDate = overrides.bookingDate ?? dateAfterDays(21);
    const startTime = overrides.startTime ?? "10:00 AM";
    const endTime = overrides.endTime ?? "10:45 AM";
    const guestCount = overrides.guestCount ?? 1;
    const adultCount = overrides.adultCount ?? 1;
    const childCount = overrides.childCount ?? 0;
    return prisma.booking.create({
      data: {
        id,
        businessId,
        listingId,
        customerName: `Customer ${customerSeed}`,
        customerEmail: `${customerSeed}@example.invalid`,
        bookingDate,
        startTime,
        endTime,
        guestCount,
        adultCount,
        childCount,
        status: overrides.status ?? "confirmed",
        paymentStatus: overrides.paymentStatus ?? "paid",
        paymentProvider: overrides.paymentProvider ?? null,
        paymentReferenceId: overrides.paymentReferenceId ?? null,
        paymentIntentId: overrides.paymentIntentId ?? null,
        paymentExpectedAmountCents: overrides.paymentExpectedAmountCents ?? null,
        paymentExpectedCurrency: overrides.paymentExpectedCurrency ?? null,
        paymentExpiresAt: overrides.paymentExpiresAt ?? null,
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

  function cancelBooking(baseUrl: string, id: string, accessToken: string) {
    return fetch(`${baseUrl}/bookings/${id}/cancel`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` } });
  }

  function pendingBookingData(bookingId: string): Partial<FixtureBookingData> {
    return {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentProvider: "mock",
      paymentReferenceId: `mock_${bookingId}`,
      paymentExpectedAmountCents: 3180,
      paymentExpectedCurrency: "usd",
      paymentExpiresAt: new Date(Date.now() + 15 * 60_000)
    };
  }

  async function withEnv<T>(values: Record<string, string | undefined>, callback: () => Promise<T>) {
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
  items: { id: string; status: string }[];
  nextCursor: string | null;
};

type FixtureBookingData = {
  bookingDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  adultCount: number;
  childCount: number;
  status: "pending_payment" | "confirmed" | "canceled" | "refunded" | "partially_refunded" | "failed";
  paymentStatus: "unpaid" | "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  paymentProvider: string | null;
  paymentReferenceId: string | null;
  paymentIntentId: string | null;
  paymentExpectedAmountCents: number | null;
  paymentExpectedCurrency: string | null;
  paymentExpiresAt: Date | null;
};
