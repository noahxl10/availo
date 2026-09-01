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

describe("authenticated operator listing management", () => {
  const prisma = new PrismaService();
  const jwtSecret = "operator-listing-auth-secret";

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
        email: "disabled-listings@example.invalid",
        role: "staff",
        status: "disabled"
      }
    });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        await expect(getListings(baseUrl)).resolves.toMatchObject({ status: 401 });
        await expect(getListings(baseUrl, "not-a-token")).resolves.toMatchObject({ status: 401 });
        await expect(getListings(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner" }, "wrong-secret"))).resolves.toMatchObject({ status: 401 });
        await expect(
          getListings(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner", exp: Math.floor(Date.now() / 1000) - 60 }, jwtSecret))
        ).resolves.toMatchObject({ status: 401 });
        await expect(getListings(baseUrl, await signToken(disabledUser.id, DEMO_BUSINESS_ID))).resolves.toMatchObject({ status: 401 });
        await expect(
          getListings(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: "biz_other_operator", role: "owner", sid: prefixedId("ses") }, jwtSecret, { expiresIn: "15m" }))
        ).resolves.toMatchObject({ status: 401 });
      });
    } finally {
      await prisma.session.deleteMany({ where: { userId: disabledUser.id } });
      await prisma.user.deleteMany({ where: { id: disabledUser.id } });
    }
  });

  it("lists and reads only the authenticated tenant listings", async () => {
    const fixture = await createListingFixture("tenant-listings", "owner");
    const otherFixture = await createListingFixture("tenant-hidden-listings", "owner");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        const response = await getListings(baseUrl, token);
        expect(response.status).toBe(200);
        const listings = (await response.json()) as { id: string; businessId: string; title: string }[];
        expect(listings).toEqual([expect.objectContaining({ id: fixture.listingId, businessId: fixture.businessId, title: "Listing tenant-listings" })]);
        expect(JSON.stringify(listings)).not.toContain(otherFixture.businessId);

        const own = await getListing(baseUrl, fixture.listingId, token);
        expect(own.status).toBe(200);
        await expect(own.json()).resolves.toMatchObject({ id: fixture.listingId, businessId: fixture.businessId });

        const crossTenant = await getListing(baseUrl, otherFixture.listingId, token);
        expect(crossTenant.status).toBe(404);
        await expect(crossTenant.json()).resolves.toMatchObject({ message: "Listing not found" });
      });
    } finally {
      await cleanupListingFixture(otherFixture.businessId);
      await cleanupListingFixture(fixture.businessId);
    }
  });

  it("allows staff listing mutations and records actor-scoped audit logs", async () => {
    const fixture = await createListingFixture("tenant-staff-listings", "staff");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        const created = await createListing(baseUrl, token, {
          title: "Staff Created Tour",
          basePriceCents: 4200,
          durationMinutes: 90,
          minGuests: 1,
          maxGuests: 8,
          capacity: 8,
          status: "active"
        });
        expect(created.status).toBe(201);
        const createdListing = (await created.json()) as { id: string; businessId: string };
        expect(createdListing.businessId).toBe(fixture.businessId);

        const updated = await updateListing(baseUrl, createdListing.id, token, { title: "Staff Updated Tour", maxGuests: 9, capacity: 9 });
        expect(updated.status).toBe(200);
        await expect(updated.json()).resolves.toMatchObject({ id: createdListing.id, title: "Staff Updated Tour", businessId: fixture.businessId });

        const archived = await archiveListing(baseUrl, createdListing.id, token);
        expect(archived.status).toBe(200);
        await expect(archived.json()).resolves.toMatchObject({ id: createdListing.id, status: "archived", businessId: fixture.businessId });

        await expect(
          prisma.auditLog.findMany({
            where: { businessId: fixture.businessId, userId: fixture.userId, entityId: createdListing.id },
            select: { action: true },
            orderBy: { createdAt: "asc" }
          })
        ).resolves.toEqual([{ action: "listing.created" }, { action: "listing.updated" }, { action: "listing.archived" }]);
      });
    } finally {
      await cleanupListingFixture(fixture.businessId);
    }
  });

  it("keeps viewers read-only before persistence", async () => {
    const fixture = await createListingFixture("tenant-viewer-listings", "viewer");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        await expect(getListings(baseUrl, token)).resolves.toMatchObject({ status: 200 });
        await expect(createListing(baseUrl, token, validListingBody("Viewer Create"))).resolves.toMatchObject({ status: 403 });
        await expect(updateListing(baseUrl, fixture.listingId, token, { title: "Viewer Update" })).resolves.toMatchObject({ status: 403 });
        await expect(archiveListing(baseUrl, fixture.listingId, token)).resolves.toMatchObject({ status: 403 });
        await expect(prisma.auditLog.count({ where: { businessId: fixture.businessId, userId: fixture.userId } })).resolves.toBe(0);
        await expect(prisma.listing.findUniqueOrThrow({ where: { id: fixture.listingId } })).resolves.toMatchObject({ title: "Listing tenant-viewer-listings", status: "active" });
      });
    } finally {
      await cleanupListingFixture(fixture.businessId);
    }
  });

  it("rejects invalid listing input and hides cross-tenant mutations", async () => {
    const fixture = await createListingFixture("tenant-listing-validation", "owner");
    const otherFixture = await createListingFixture("tenant-listing-validation-hidden", "owner");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        await expect(createListing(baseUrl, token, { ...validListingBody("Invalid Guests"), minGuests: 10, maxGuests: 2 })).resolves.toMatchObject({ status: 400 });
        await expect(updateListing(baseUrl, fixture.listingId, token, { minGuests: 99 })).resolves.toMatchObject({ status: 400 });
        await expect(updateListing(baseUrl, otherFixture.listingId, token, { title: "Cross Tenant Update" })).resolves.toMatchObject({ status: 404 });
        await expect(archiveListing(baseUrl, otherFixture.listingId, token)).resolves.toMatchObject({ status: 404 });
        await expect(prisma.listing.findUniqueOrThrow({ where: { id: otherFixture.listingId } })).resolves.toMatchObject({ title: "Listing tenant-listing-validation-hidden", status: "active" });
      });
    } finally {
      await cleanupListingFixture(otherFixture.businessId);
      await cleanupListingFixture(fixture.businessId);
    }
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

  function getListings(baseUrl: string, accessToken?: string) {
    return fetch(`${baseUrl}/listings`, accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {});
  }

  function getListing(baseUrl: string, id: string, accessToken: string) {
    return fetch(`${baseUrl}/listings/${id}`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function createListing(baseUrl: string, accessToken: string, body: unknown) {
    return fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function updateListing(baseUrl: string, id: string, accessToken: string, body: unknown) {
    return fetch(`${baseUrl}/listings/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function archiveListing(baseUrl: string, id: string, accessToken: string) {
    return fetch(`${baseUrl}/listings/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
  }

  async function signToken(userId: string, businessId: string) {
    const sessionId = prefixedId("ses");
    await prisma.session.create({
      data: { id: sessionId, userId, businessId, refreshTokenHash: "access-token-test-session", expiresAt: new Date(Date.now() + 60_000) }
    });
    return jwt.sign({ sub: userId, businessId, role: "owner", sid: sessionId }, jwtSecret, { expiresIn: "15m" });
  }

  async function createListingFixture(slugSeed: string, role: "owner" | "admin" | "staff" | "viewer") {
    const businessId = prefixedId("biz");
    const userId = prefixedId("usr");
    const listingId = prefixedId("lst");

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
        description: "Listing auth fixture",
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

    return { businessId, userId, listingId };
  }

  function validListingBody(title: string) {
    return {
      title,
      basePriceCents: 4200,
      durationMinutes: 90,
      minGuests: 1,
      maxGuests: 8,
      capacity: 8,
      status: "active"
    };
  }

  async function cleanupListingFixture(businessId: string) {
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
});
