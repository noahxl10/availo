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

describe("authenticated operator business settings", () => {
  const prisma = new PrismaService();
  const jwtSecret = "operator-business-settings-secret";

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
        email: "disabled-business-settings@example.invalid",
        role: "owner",
        status: "disabled"
      }
    });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        await expect(getBusiness(baseUrl)).resolves.toMatchObject({ status: 401 });
        await expect(getBusiness(baseUrl, "not-a-token")).resolves.toMatchObject({ status: 401 });
        await expect(getBusiness(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner" }, "wrong-secret"))).resolves.toMatchObject({ status: 401 });
        await expect(
          getBusiness(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner", exp: Math.floor(Date.now() / 1000) - 60 }, jwtSecret))
        ).resolves.toMatchObject({ status: 401 });
        await expect(getBusiness(baseUrl, await signToken(disabledUser.id, DEMO_BUSINESS_ID))).resolves.toMatchObject({ status: 401 });
        await expect(
          getBusiness(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: "biz_other_operator", role: "owner", sid: prefixedId("ses") }, jwtSecret, { expiresIn: "15m" }))
        ).resolves.toMatchObject({ status: 401 });
      });
    } finally {
      await prisma.session.deleteMany({ where: { userId: disabledUser.id } });
      await prisma.user.deleteMany({ where: { id: disabledUser.id } });
    }
  });

  it("returns settings for only the authenticated operator business", async () => {
    const fixture = await createBusinessFixture("tenant-business-settings", "viewer");
    const otherFixture = await createBusinessFixture("tenant-business-hidden", "viewer");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const response = await getBusiness(baseUrl, await signToken(fixture.userId, fixture.businessId));
        expect(response.status).toBe(200);
        const business = (await response.json()) as { id: string; name: string; slug: string; supportEmail: string | null };

        expect(business).toMatchObject({
          id: fixture.businessId,
          name: "Operator tenant-business-settings",
          slug: fixture.slug,
          supportEmail: "support-tenant-business-settings@example.invalid"
        });
        expect(JSON.stringify(business)).not.toContain(otherFixture.businessId);
        expect(JSON.stringify(business)).not.toContain("tenant-business-hidden");
      });
    } finally {
      await cleanupBusinessFixture(otherFixture.businessId);
      await cleanupBusinessFixture(fixture.businessId);
    }
  });

  it("allows owner and admin updates and writes actor-scoped audit logs", async () => {
    const ownerFixture = await createBusinessFixture("tenant-business-owner", "owner");
    const adminFixture = await createBusinessFixture("tenant-business-admin", "admin");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const ownerResponse = await updateBusiness(baseUrl, await signToken(ownerFixture.userId, ownerFixture.businessId), {
          name: "Owner Updated Co.",
          supportEmail: "owner-updated@example.invalid",
          timezone: "America/New_York"
        });
        expect(ownerResponse.status).toBe(200);
        await expect(ownerResponse.json()).resolves.toMatchObject({ id: ownerFixture.businessId, name: "Owner Updated Co.", timezone: "America/New_York" });

        const adminResponse = await updateBusiness(baseUrl, await signToken(adminFixture.userId, adminFixture.businessId), { supportPhone: "+1-555-0100" });
        expect(adminResponse.status).toBe(200);
        await expect(adminResponse.json()).resolves.toMatchObject({ id: adminFixture.businessId, supportPhone: "+1-555-0100" });

        await expect(
          prisma.auditLog.findMany({
            where: { businessId: ownerFixture.businessId, userId: ownerFixture.userId, action: "business.updated" },
            select: { action: true, entityType: true, entityId: true }
          })
        ).resolves.toEqual([{ action: "business.updated", entityType: "business", entityId: ownerFixture.businessId }]);
        await expect(prisma.auditLog.count({ where: { businessId: adminFixture.businessId, userId: adminFixture.userId, action: "business.updated" } })).resolves.toBe(1);
      });
    } finally {
      await cleanupBusinessFixture(adminFixture.businessId);
      await cleanupBusinessFixture(ownerFixture.businessId);
    }
  });

  it("keeps staff and viewers read-only before persistence", async () => {
    const staffFixture = await createBusinessFixture("tenant-business-staff", "staff");
    const viewerFixture = await createBusinessFixture("tenant-business-viewer", "viewer");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        await expect(getBusiness(baseUrl, await signToken(staffFixture.userId, staffFixture.businessId))).resolves.toMatchObject({ status: 200 });
        await expect(getBusiness(baseUrl, await signToken(viewerFixture.userId, viewerFixture.businessId))).resolves.toMatchObject({ status: 200 });
        await expect(updateBusiness(baseUrl, await signToken(staffFixture.userId, staffFixture.businessId), { name: "Staff Updated Co." })).resolves.toMatchObject({ status: 403 });
        await expect(updateBusiness(baseUrl, await signToken(viewerFixture.userId, viewerFixture.businessId), { name: "Viewer Updated Co." })).resolves.toMatchObject({ status: 403 });

        await expect(prisma.business.findUniqueOrThrow({ where: { id: staffFixture.businessId } })).resolves.toMatchObject({ name: "Operator tenant-business-staff" });
        await expect(prisma.business.findUniqueOrThrow({ where: { id: viewerFixture.businessId } })).resolves.toMatchObject({ name: "Operator tenant-business-viewer" });
        await expect(prisma.auditLog.count({ where: { businessId: { in: [staffFixture.businessId, viewerFixture.businessId] }, action: "business.updated" } })).resolves.toBe(0);
      });
    } finally {
      await cleanupBusinessFixture(viewerFixture.businessId);
      await cleanupBusinessFixture(staffFixture.businessId);
    }
  });

  it("rejects invalid settings input before persistence", async () => {
    const fixture = await createBusinessFixture("tenant-business-validation", "owner");

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);
        await expect(updateBusiness(baseUrl, token, { slug: "Invalid Slug" })).resolves.toMatchObject({ status: 400 });
        await expect(updateBusiness(baseUrl, token, { supportEmail: "not-an-email" })).resolves.toMatchObject({ status: 400 });
        await expect(updateBusiness(baseUrl, token, { timezone: "Mars/Olympus_Mons" })).resolves.toMatchObject({ status: 400 });
        await expect(updateBusiness(baseUrl, token, {})).resolves.toMatchObject({ status: 400 });
        await expect(updateBusiness(baseUrl, token, { unexpected: true })).resolves.toMatchObject({ status: 400 });
        await expect(updateBusiness(baseUrl, token, { name: "Unknown Mixed Co.", unexpected: true })).resolves.toMatchObject({ status: 400 });

        await expect(prisma.business.findUniqueOrThrow({ where: { id: fixture.businessId } })).resolves.toMatchObject({
          name: "Operator tenant-business-validation",
          slug: fixture.slug,
          supportEmail: "support-tenant-business-validation@example.invalid",
          timezone: "America/Denver"
        });
        await expect(prisma.auditLog.count({ where: { businessId: fixture.businessId, action: "business.updated" } })).resolves.toBe(0);
      });
    } finally {
      await cleanupBusinessFixture(fixture.businessId);
    }
  });

  it("keeps public business lookup and onboarding creation behavior separate", async () => {
    const fixture = await createBusinessFixture("tenant-business-public", "owner");
    const createdSlug = `onboarding-${prefixedId("biz").replaceAll("_", "-")}`;

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const publicResponse = await fetch(`${baseUrl}/business/public/${fixture.slug}`);
        expect(publicResponse.status).toBe(200);
        const publicBusiness = await publicResponse.json();
        expect(publicBusiness).toMatchObject({ id: fixture.businessId, name: "Operator tenant-business-public", slug: fixture.slug, timezone: "America/Denver" });
        expect(publicBusiness).not.toHaveProperty("ownerUserId");
        expect(publicBusiness).not.toHaveProperty("taxRateBps");
        expect(publicBusiness).not.toHaveProperty("addressJson");

        const createResponse = await fetch(`${baseUrl}/business`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "New Onboarding Co.", slug: createdSlug, timezone: "America/Los_Angeles" })
        });
        expect(createResponse.status).toBe(201);
        await expect(createResponse.json()).resolves.toMatchObject({ name: "New Onboarding Co.", slug: createdSlug, status: "onboarding" });
      });
    } finally {
      await prisma.business.deleteMany({ where: { slug: createdSlug } });
      await cleanupBusinessFixture(fixture.businessId);
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

  function getBusiness(baseUrl: string, accessToken?: string) {
    return fetch(`${baseUrl}/business`, accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {});
  }

  function updateBusiness(baseUrl: string, accessToken: string, body: unknown) {
    return fetch(`${baseUrl}/business`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function signToken(userId: string, businessId: string) {
    const sessionId = prefixedId("ses");
    await prisma.session.create({
      data: { id: sessionId, userId, businessId, refreshTokenHash: "access-token-test-session", expiresAt: new Date(Date.now() + 60_000) }
    });
    return jwt.sign({ sub: userId, businessId, role: "owner", sid: sessionId }, jwtSecret, { expiresIn: "15m" });
  }

  async function createBusinessFixture(slugSeed: string, role: "owner" | "admin" | "staff" | "viewer") {
    const businessId = prefixedId("biz");
    const userId = prefixedId("usr");
    const slug = `${slugSeed}-${businessId}`;

    await prisma.business.create({
      data: {
        id: businessId,
        name: `Operator ${slugSeed}`,
        slug,
        status: "active",
        timezone: "America/Denver",
        currency: "USD",
        supportEmail: `support-${slugSeed}@example.invalid`,
        supportPhone: "+1-555-0199",
        taxRateBps: 725,
        addressJson: "{\"city\":\"Denver\"}"
      }
    });
    await prisma.user.create({ data: { id: userId, businessId, email: `${userId}@example.invalid`, role, status: "active" } });
    return { businessId, userId, slug };
  }

  async function cleanupBusinessFixture(businessId: string) {
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
