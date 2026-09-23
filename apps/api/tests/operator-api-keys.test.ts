import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module.js";
import { configureApiHttp } from "../src/api-http.js";
import { prefixedId } from "../src/common/ids.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("operator API keys", () => {
  const prisma = new PrismaService();
  const jwtSecret = "operator-api-key-secret";

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates hashed tenant-scoped read-only API keys and revokes them", async () => {
    const fixture = await createFixture("api-keys-owner", "owner");
    const otherFixture = await createFixture("api-keys-hidden", "owner");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const ownerToken = await signToken(fixture.userId, fixture.businessId, "owner");

        const createdResponse = await createApiKey(baseUrl, ownerToken, { name: "Reporting sync" });
        expect(createdResponse.status).toBe(201);
        const created = (await createdResponse.json()) as { id: string; name: string; prefix: string; key: string; createdAt: string; lastUsedAt: null; revokedAt: null };
        expect(created).toMatchObject({ name: "Reporting sync", prefix: expect.stringMatching(/^[A-Za-z0-9_-]{8}$/), key: expect.stringMatching(/^avlo_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/), lastUsedAt: null, revokedAt: null });
        expect(created.key).toContain(created.prefix);

        const persisted = await prisma.operatorApiKey.findUniqueOrThrow({ where: { id: created.id } });
        expect(persisted.businessId).toBe(fixture.businessId);
        await expect(prisma.user.delete({ where: { id: fixture.userId } })).rejects.toThrow();
        expect(persisted.secretHash).toBe(createHash("sha256").update(created.key, "utf8").digest("base64url"));
        expect(persisted.secretHash).not.toContain(created.key);
        expect(persisted.secretHash).not.toContain(created.key.split("_").at(-1)!);

        const listedResponse = await listApiKeys(baseUrl, ownerToken);
        expect(listedResponse.status).toBe(200);
        const listed = (await listedResponse.json()) as { id: string; key?: string; prefix: string }[];
        expect(listed).toEqual([expect.objectContaining({ id: created.id, prefix: created.prefix })]);
        expect(listed[0]).not.toHaveProperty("key");

        const ownBusiness = await getBusiness(baseUrl, created.key);
        expect(ownBusiness.status).toBe(200);
        await expect(ownBusiness.json()).resolves.toMatchObject({ id: fixture.businessId, name: "Operator api-keys-owner" });

        const ownListings = await getListings(baseUrl, created.key);
        expect(ownListings.status).toBe(200);
        expect(JSON.stringify(await ownListings.json())).toContain(fixture.listingId);

        const ownBooking = await getBooking(baseUrl, fixture.bookingId, created.key);
        expect(ownBooking.status).toBe(200);
        const ownBookingPayload = await ownBooking.json();
        expect(ownBookingPayload).toMatchObject({ id: fixture.bookingId });
        expect(JSON.stringify(ownBookingPayload)).not.toContain(otherFixture.bookingId);

        const overview = await getOverview(baseUrl, created.key);
        expect(overview.status).toBe(200);
        expect(JSON.stringify(await overview.json())).toContain(fixture.listingId);

        const me = await getMe(baseUrl, created.key);
        expect(me.status).toBe(200);
        await expect(me.json()).resolves.toMatchObject({ userId: fixture.userId, businessId: fixture.businessId, role: "viewer" });

        await expect(getListing(baseUrl, otherFixture.listingId, created.key)).resolves.toMatchObject({ status: 404 });
        await expect(getBooking(baseUrl, otherFixture.bookingId, created.key)).resolves.toMatchObject({ status: 404 });
        expect(await prisma.operatorApiKey.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ lastUsedAt: expect.any(Date) });

        await expect(getBusiness(baseUrl, replaceLastChar(created.key))).resolves.toMatchObject({ status: 401 });
        await expect(getBusiness(baseUrl, created.key.replace(created.prefix, "deadbeef"))).resolves.toMatchObject({ status: 401 });

        await expect(createListing(baseUrl, created.key)).resolves.toMatchObject({ status: 403 });
        await expect(updateBusiness(baseUrl, created.key, { name: "API Key Update" })).resolves.toMatchObject({ status: 403 });
        await expect(prisma.listing.count({ where: { businessId: fixture.businessId, title: "API Key Created Listing" } })).resolves.toBe(0);
        await expect(prisma.auditLog.count({ where: { businessId: fixture.businessId, action: { in: ["listing.created", "business.updated"] } } })).resolves.toBe(0);

        const revokedResponse = await revokeApiKey(baseUrl, ownerToken, created.id);
        expect(revokedResponse.status).toBe(200);
        await expect(revokedResponse.json()).resolves.toMatchObject({ id: created.id, revokedAt: expect.any(String) });
        await expect(getBusiness(baseUrl, created.key)).resolves.toMatchObject({ status: 401 });
        await expect(getBusiness(baseUrl, `${created.key}x`)).resolves.toMatchObject({ status: 401 });

        await expect(
          prisma.auditLog.findMany({
            where: { businessId: fixture.businessId, userId: fixture.userId, entityId: created.id },
            select: { action: true },
            orderBy: { createdAt: "asc" }
          })
        ).resolves.toEqual([{ action: "operator_api_key.created" }, { action: "operator_api_key.revoked" }]);
        const auditMetadata = await prisma.auditLog.findMany({
          where: { businessId: fixture.businessId, userId: fixture.userId, entityId: created.id },
          select: { metadataJson: true }
        });
        expect(JSON.stringify(auditMetadata)).toContain(created.prefix);
        expect(JSON.stringify(auditMetadata)).not.toContain(created.key);
        expect(JSON.stringify(auditMetadata)).not.toContain(created.key.split("_").at(-1)!);
      });
    } finally {
      await cleanupFixture(otherFixture.businessId);
      await cleanupFixture(fixture.businessId);
    }
  });

  it("limits API-key management to owner and admin session actors", async () => {
    const adminFixture = await createFixture("api-keys-admin", "admin");
    const staffFixture = await createFixture("api-keys-staff", "staff");
    const viewerFixture = await createFixture("api-keys-viewer", "viewer");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const adminToken = await signToken(adminFixture.userId, adminFixture.businessId, "admin");
        await expect(createApiKey(baseUrl, adminToken, { name: "Admin key" })).resolves.toMatchObject({ status: 201 });

        await expect(createApiKey(baseUrl, await signToken(staffFixture.userId, staffFixture.businessId, "staff"), { name: "Staff key" })).resolves.toMatchObject({ status: 403 });
        await expect(listApiKeys(baseUrl, await signToken(viewerFixture.userId, viewerFixture.businessId, "viewer"))).resolves.toMatchObject({ status: 403 });
        await expect(prisma.operatorApiKey.count({ where: { businessId: { in: [staffFixture.businessId, viewerFixture.businessId] } } })).resolves.toBe(0);
      });
    } finally {
      await cleanupFixture(viewerFixture.businessId);
      await cleanupFixture(staffFixture.businessId);
      await cleanupFixture(adminFixture.businessId);
    }
  });

  it("rejects malformed input and keys for inactive businesses", async () => {
    const fixture = await createFixture("api-keys-suspended", "owner");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId, "owner");
        await expect(createApiKey(baseUrl, token, {})).resolves.toMatchObject({ status: 400 });
        await expect(createApiKey(baseUrl, token, { name: "" })).resolves.toMatchObject({ status: 400 });
        await expect(createApiKey(baseUrl, token, { name: "Valid", scope: "write" })).resolves.toMatchObject({ status: 400 });

        const createdResponse = await createApiKey(baseUrl, token, { name: "Suspension test" });
        const created = (await createdResponse.json()) as { key: string };
        await prisma.business.update({ where: { id: fixture.businessId }, data: { status: "suspended" } });

        await expect(getBusiness(baseUrl, created.key)).resolves.toMatchObject({ status: 401 });
      });
    } finally {
      await cleanupFixture(fixture.businessId);
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

  function listApiKeys(baseUrl: string, accessToken: string) {
    return fetch(`${baseUrl}/operator-api-keys`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function createApiKey(baseUrl: string, accessToken: string, body: unknown) {
    return fetch(`${baseUrl}/operator-api-keys`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function revokeApiKey(baseUrl: string, accessToken: string, id: string) {
    return fetch(`${baseUrl}/operator-api-keys/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
  }

  function getBusiness(baseUrl: string, accessToken: string) {
    return fetch(`${baseUrl}/business`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function updateBusiness(baseUrl: string, accessToken: string, body: unknown) {
    return fetch(`${baseUrl}/business`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function getOverview(baseUrl: string, accessToken: string) {
    return fetch(`${baseUrl}/dashboard/overview`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function getMe(baseUrl: string, accessToken: string) {
    return fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function getListings(baseUrl: string, accessToken: string) {
    return fetch(`${baseUrl}/listings`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function getListing(baseUrl: string, id: string, accessToken: string) {
    return fetch(`${baseUrl}/listings/${id}`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  function createListing(baseUrl: string, accessToken: string) {
    return fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        title: "API Key Created Listing",
        basePriceCents: 4200,
        durationMinutes: 90,
        minGuests: 1,
        maxGuests: 8,
        capacity: 8,
        status: "active"
      })
    });
  }

  function getBooking(baseUrl: string, id: string, accessToken: string) {
    return fetch(`${baseUrl}/bookings/${id}`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  async function signToken(userId: string, businessId: string, role: "owner" | "admin" | "staff" | "viewer") {
    const sessionId = prefixedId("ses");
    await prisma.session.create({
      data: { id: sessionId, userId, businessId, refreshTokenHash: "access-token-test-session", expiresAt: new Date(Date.now() + 60_000) }
    });
    return jwt.sign({ sub: userId, businessId, role, sid: sessionId }, jwtSecret, { expiresIn: "15m" });
  }

  async function createFixture(slugSeed: string, role: "owner" | "admin" | "staff" | "viewer") {
    const businessId = prefixedId("biz");
    const userId = prefixedId("usr");
    const listingId = prefixedId("lst");
    const bookingId = prefixedId("bok");
    const slug = `${slugSeed}-${businessId}`;

    await prisma.business.create({
      data: {
        id: businessId,
        name: `Operator ${slugSeed}`,
        slug,
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
        description: "API key fixture",
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
    await prisma.booking.create({
      data: {
        id: bookingId,
        businessId,
        listingId,
        customerName: `Customer ${slugSeed}`,
        customerEmail: `${slugSeed}@customer.example.invalid`,
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
        totalCents: 3180
      }
    });

    return { businessId, userId, listingId, bookingId, slug };
  }

  async function cleanupFixture(businessId: string) {
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
    await prisma.operatorApiKey.deleteMany({ where: { businessId } });
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

  function replaceLastChar(value: string) {
    return `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
  }
});
