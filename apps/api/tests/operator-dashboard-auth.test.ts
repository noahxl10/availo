import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module.js";
import { configureApiHttp } from "../src/api-http.js";
import { prefixedId } from "../src/common/ids.js";
import { DEMO_BUSINESS_ID } from "../src/common/tenant.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("authenticated dashboard overview", () => {
  const prisma = new PrismaService();
  const jwtSecret = "operator-dashboard-auth-secret";

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects missing, malformed, forged, and expired dashboard tokens", async () => {
    await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
      await expect(getOverview(baseUrl)).resolves.toMatchObject({ status: 401 });
      await expect(getOverview(baseUrl, "not-a-token")).resolves.toMatchObject({ status: 401 });
      await expect(getOverview(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner" }, "wrong-secret"))).resolves.toMatchObject({ status: 401 });
      await expect(
        getOverview(baseUrl, jwt.sign({ sub: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner", exp: Math.floor(Date.now() / 1000) - 60 }, jwtSecret))
      ).resolves.toMatchObject({ status: 401 });
    });
  });

  it("rejects disabled users and tenant-mismatched claims before returning dashboard data", async () => {
    const disabledUserId = prefixedId("usr");
    const disabledUser = await prisma.user.create({
      data: {
        id: disabledUserId,
        businessId: DEMO_BUSINESS_ID,
        email: `${disabledUserId}@disabled-dashboard.example.invalid`,
        role: "owner",
        status: "disabled"
      }
    });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const disabled = await signToken(disabledUser.id, DEMO_BUSINESS_ID);
        const mismatched = jwt.sign({ sub: "usr_demo_owner", businessId: "biz_other_operator", role: "owner", sid: prefixedId("ses") }, jwtSecret, { expiresIn: "15m" });

        await expect(getOverview(baseUrl, disabled)).resolves.toMatchObject({ status: 401 });
        await expect(getOverview(baseUrl, mismatched)).resolves.toMatchObject({ status: 401 });
      });
    } finally {
      await prisma.session.deleteMany({ where: { userId: disabledUser.id } });
      await prisma.user.deleteMany({ where: { id: disabledUser.id } });
    }
  });

  it("returns only the authenticated tenant dashboard overview", async () => {
    const fixture = await createOtherTenantFixture();

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const response = await getOverview(baseUrl, await signToken(fixture.userId, fixture.businessId));
        expect(response.status).toBe(200);
        const overview = (await response.json()) as {
          business: { id: string; name: string };
          stats: { label: string; value: string }[];
          listings: { id?: string; title: string }[];
          bookings: { id?: string; name: string; listing: string }[];
        };

        expect(overview.business).toMatchObject({ id: fixture.businessId, name: "Other Operator Co." });
        expect(overview.listings).toEqual([expect.objectContaining({ id: fixture.listingId, title: "Other Tenant Walk" })]);
        expect(overview.bookings).toEqual([expect.objectContaining({ id: fixture.bookingId, name: "Other Customer", listing: "Other Tenant Walk" })]);
        expect(overview.stats.find((stat) => stat.label === "Bookings this month")?.value).toBe("1");
        expect(JSON.stringify(overview)).not.toContain("Harbor Kayak Tour");
        expect(JSON.stringify(overview)).not.toContain("Sample Tours Co.");
      });
    } finally {
      await cleanupOtherTenantFixture(fixture.businessId);
    }
  });

  it("rejects access tokens after the operator business is suspended", async () => {
    const fixture = await createOtherTenantFixture({ status: "suspended" });

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
        const token = await signToken(fixture.userId, fixture.businessId);

        await expect(getOverview(baseUrl, token)).resolves.toMatchObject({ status: 401 });
        await expect(getMe(baseUrl, token)).resolves.toMatchObject({ status: 401 });
      });
    } finally {
      await cleanupOtherTenantFixture(fixture.businessId);
    }
  });

  it("preserves the dashboard overview response shape for an authenticated demo operator", async () => {
    await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
      const response = await getOverview(baseUrl, await signToken("usr_demo_owner", DEMO_BUSINESS_ID));
      expect(response.status).toBe(200);
      const overview = await response.json();
      expect(overview).toMatchObject({
        business: { id: DEMO_BUSINESS_ID, name: "Sample Tours Co.", slug: "sample-tours", timezone: "America/Los_Angeles" },
        stats: expect.any(Array),
        bookings: expect.any(Array),
        listings: expect.any(Array),
        bookedDates: expect.any(Array),
        fullDates: expect.any(Array)
      });
    });
  });

  it("returns only the authenticated actor from /auth/me", async () => {
    await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
      await expect(getMe(baseUrl)).resolves.toMatchObject({ status: 401 });

      const response = await getMe(baseUrl, await signToken("usr_demo_owner", DEMO_BUSINESS_ID));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ userId: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner" });
    });
  });

  it("does not expose the demo-bound email registration route", async () => {
    await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
      const beforeUsers = await prisma.user.count({ where: { email: "new-demo-owner@example.invalid" } });
      const beforeSessions = await prisma.session.count({ where: { user: { email: "new-demo-owner@example.invalid" } } });

      const response = await postRegister(baseUrl, { email: "new-demo-owner@example.invalid", password: "local-password" });
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ message: "Cannot POST /auth/email/register" });

      expect(await prisma.user.count({ where: { email: "new-demo-owner@example.invalid" } })).toBe(beforeUsers);
      expect(await prisma.session.count({ where: { user: { email: "new-demo-owner@example.invalid" } } })).toBe(beforeSessions);
    });
  });

  it("invalidates session-bound access tokens on logout and refresh-token replay", async () => {
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });

    await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret }, async (baseUrl) => {
      const loginResponse = await postLogin(baseUrl, { businessSlug: "sample-tours", email: "owner@example-tours.invalid", password: "local-password" });
      expect(loginResponse.status).toBe(201);
      const login = (await loginResponse.json()) as AuthResponse;

      await expect(getMe(baseUrl, login.accessToken)).resolves.toMatchObject({ status: 200 });
      await expect(postLogout(baseUrl, login.refreshToken)).resolves.toMatchObject({ status: 201 });
      await expect(getMe(baseUrl, login.accessToken)).resolves.toMatchObject({ status: 401 });

      const secondLoginResponse = await postLogin(baseUrl, { businessSlug: "sample-tours", email: "owner@example-tours.invalid", password: "local-password" });
      const secondLogin = (await secondLoginResponse.json()) as AuthResponse;
      const refreshResponse = await postRefresh(baseUrl, secondLogin.refreshToken);
      expect(refreshResponse.status).toBe(201);
      const refresh = (await refreshResponse.json()) as AuthResponse;

      await expect(getMe(baseUrl, refresh.accessToken)).resolves.toMatchObject({ status: 200 });
      await expect(postRefresh(baseUrl, secondLogin.refreshToken)).resolves.toMatchObject({ status: 201 });
      await expect(getMe(baseUrl, refresh.accessToken)).resolves.toMatchObject({ status: 401 });
    });

    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });
    await prisma.auditLog.deleteMany({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: { in: ["auth.login", "auth.refresh", "auth.logout", "auth.refresh_reuse_revoked"] } } });
  });

  it("uses an origin-bound HttpOnly cookie transport for browser sessions without changing JSON auth", async () => {
    const fixture = await createOtherTenantFixture();
    await prisma.user.update({
      where: { id: fixture.userId },
      data: { email: "browser-session-owner@example.invalid", passwordHash: await argon2.hash("local-password") }
    });
    const credentials = { businessSlug: fixture.businessSlug, email: "browser-session-owner@example.invalid", password: "local-password" };

    try {
      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret, CORS_ORIGINS: "https://dashboard.availo.test", NODE_ENV: "production" }, async (baseUrl) => {
        await expect(postBrowserLogin(baseUrl, credentials)).resolves.toMatchObject({ status: 403 });
        await expect(postBrowserLogin(baseUrl, credentials, "https://foreign.availo.test")).resolves.toMatchObject({ status: 403 });
        const missingRefreshResponse = await postBrowserRefresh(baseUrl, undefined, "https://dashboard.availo.test");
        expect(missingRefreshResponse.status).toBe(201);
        await expect(missingRefreshResponse.json()).resolves.toEqual({ ok: false, error: "Invalid refresh token" });
        expect(missingRefreshResponse.headers.get("set-cookie")).toContain("Max-Age=0");

        const loginResponse = await postBrowserLogin(baseUrl, credentials, "https://dashboard.availo.test");
        expect(loginResponse.status).toBe(201);
        expect(loginResponse.headers.get("cache-control")).toBe("no-store");
        const login = await loginResponse.json() as { ok: boolean; accessToken: string; refreshToken?: string };
        expect(login).toMatchObject({ ok: true, accessToken: expect.any(String) });
        expect(login.refreshToken).toBeUndefined();
        const firstCookie = refreshCookie(loginResponse);
        expect(firstCookie).toContain("availo_browser_refresh=v1.");
        expect(firstCookie).toContain("Path=/auth/browser");
        expect(firstCookie).toContain("HttpOnly");
        expect(firstCookie).toContain("SameSite=Lax");
        expect(firstCookie).toContain("Secure");
        expect(firstCookie).not.toContain("Domain=");

        const refreshResponse = await postBrowserRefresh(baseUrl, cookieValue(firstCookie), "https://dashboard.availo.test");
        expect(refreshResponse.status).toBe(201);
        const refresh = await refreshResponse.json() as { ok: boolean; accessToken: string; refreshToken?: string };
        expect(refresh).toMatchObject({ ok: true, accessToken: expect.any(String) });
        expect(refresh.refreshToken).toBeUndefined();
        const rotatedCookie = refreshCookie(refreshResponse);
        expect(rotatedCookie).not.toBe(firstCookie);
        expect(await prisma.session.count({ where: { userId: fixture.userId, revokedAt: null } })).toBe(1);

        const replayResponse = await postBrowserRefresh(baseUrl, cookieValue(firstCookie), "https://dashboard.availo.test");
        expect(replayResponse.status).toBe(201);
        await expect(replayResponse.json()).resolves.toEqual({ ok: false, error: "Invalid refresh token" });
        expect(replayResponse.headers.get("set-cookie")).toContain("Max-Age=0");
        expect(await prisma.session.count({ where: { userId: fixture.userId, revokedAt: null } })).toBe(0);
        await expect(getMe(baseUrl, refresh.accessToken)).resolves.toMatchObject({ status: 401 });

        const logoutResponse = await postBrowserLogout(baseUrl, cookieValue(rotatedCookie), "https://dashboard.availo.test");
        expect(logoutResponse.status).toBe(201);
        await expect(logoutResponse.json()).resolves.toEqual({ ok: true });
        expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");

        const jsonLogin = await postLogin(baseUrl, credentials);
        expect(jsonLogin.status).toBe(201);
        expect(jsonLogin.headers.get("cache-control")).toBe("no-store");
        expect((await jsonLogin.json()) as AuthResponse).toMatchObject({ refreshToken: expect.stringMatching(/^v1\./) });
      });

      await withHttpApp({ JWT_ACCESS_SECRET: jwtSecret, CORS_ORIGINS: "http://localhost:3000", NODE_ENV: "test" }, async (baseUrl) => {
        const response = await postBrowserLogin(baseUrl, credentials, "http://localhost:3000");
        expect(response.status).toBe(201);
        expect(refreshCookie(response)).not.toContain("Secure");
      });
    } finally {
      await cleanupOtherTenantFixture(fixture.businessId);
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

  function getOverview(baseUrl: string, accessToken?: string) {
    return fetch(`${baseUrl}/dashboard/overview`, accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {});
  }

  function getMe(baseUrl: string, accessToken?: string) {
    return fetch(`${baseUrl}/auth/me`, accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {});
  }

  function postRegister(baseUrl: string, body: unknown) {
    return fetch(`${baseUrl}/auth/email/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  function postLogin(baseUrl: string, body: unknown) {
    return fetch(`${baseUrl}/auth/email/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  function postRefresh(baseUrl: string, refreshToken: string) {
    return fetch(`${baseUrl}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken }) });
  }

  function postLogout(baseUrl: string, refreshToken: string) {
    return fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken }) });
  }

  function postBrowserLogin(baseUrl: string, body: unknown, origin?: string) {
    return fetch(`${baseUrl}/auth/browser/login`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify(body)
    });
  }

  function postBrowserRefresh(baseUrl: string, cookie: string | undefined, origin: string) {
    return fetch(`${baseUrl}/auth/browser/refresh`, { method: "POST", headers: { origin, ...(cookie ? { cookie } : {}) } });
  }

  function postBrowserLogout(baseUrl: string, cookie: string | undefined, origin: string) {
    return fetch(`${baseUrl}/auth/browser/logout`, { method: "POST", headers: { origin, ...(cookie ? { cookie } : {}) } });
  }

  function refreshCookie(response: Response) {
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("Expected browser refresh cookie");
    return cookie;
  }

  function cookieValue(cookie: string) {
    return cookie.split(";")[0]!;
  }

  async function signToken(userId: string, businessId: string) {
    const sessionId = prefixedId("ses");
    await prisma.session.create({
      data: { id: sessionId, userId, businessId, refreshTokenHash: "access-token-test-session", expiresAt: new Date(Date.now() + 60_000) }
    });
    return jwt.sign({ sub: userId, businessId, role: "owner", sid: sessionId }, jwtSecret, { expiresIn: "15m" });
  }

  type AuthResponse = {
    accessToken: string;
    refreshToken: string;
  };

  async function createOtherTenantFixture(options: { status?: "active" | "suspended" } = {}) {
    const businessId = prefixedId("biz");
    const businessSlug = `other-${businessId.replaceAll("_", "-")}`;
    const userId = prefixedId("usr");
    const listingId = prefixedId("lst");
    const bookingId = prefixedId("bok");

    await prisma.business.create({
      data: {
        id: businessId,
        name: "Other Operator Co.",
        slug: businessSlug,
        status: options.status ?? "active",
        timezone: "America/Denver",
        currency: "USD"
      }
    });
    await prisma.user.create({ data: { id: userId, businessId, email: `${userId}@example.invalid`, role: "owner", status: "active" } });
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId,
        title: "Other Tenant Walk",
        description: "Tenant isolation fixture",
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
        customerName: "Other Customer",
        customerEmail: "other-customer@example.invalid",
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

    return { businessId, businessSlug, userId, listingId, bookingId };
  }

  async function cleanupOtherTenantFixture(businessId: string) {
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
