import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DashboardAuthRequiredError,
  DashboardLoginRejectedError,
  DashboardRateLimitedError,
  fetchDashboardOverview,
  loginDashboardSession,
  logoutDashboardSession,
  normalizeDashboardOverview,
  refreshDashboardSession
} from "./api-data";

describe("dashboard API data", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  it("requires a bearer token before requesting dashboard data", async () => {
    await expect(fetchDashboardOverview(null)).rejects.toBeInstanceOf(DashboardAuthRequiredError);
  });

  it("forwards the stored bearer token to the dashboard API", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.availo.test/";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validOverview()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDashboardOverview("access-token")).resolves.toMatchObject({ business: { id: "biz_test" } });
    expect(fetchMock).toHaveBeenCalledWith("https://api.availo.test/dashboard/overview", {
      cache: "no-store",
      headers: { authorization: "Bearer access-token" }
    });
  });

  it("maps 401 responses to the explicit auth-required state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));

    await expect(fetchDashboardOverview("expired-token")).rejects.toBeInstanceOf(DashboardAuthRequiredError);
  });

  it("rejects malformed overview payloads instead of substituting fallback data", () => {
    expect(() => normalizeDashboardOverview({ stats: [] })).toThrow("Dashboard API returned an invalid overview");
  });

  it("logs in through the browser endpoint with credentialed no-store fetch", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.availo.test/";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validSession()), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginDashboardSession({ businessSlug: "sample-tours", email: "owner@example.com", password: "local-password" })).resolves.toMatchObject({
      accessToken: "access-token",
      user: { businessId: "biz_test" }
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.availo.test/auth/browser/login", {
      body: JSON.stringify({ businessSlug: "sample-tours", email: "owner@example.com", password: "local-password" }),
      cache: "no-store",
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST"
    });
  });

  it("refreshes and logs out through credentialed browser endpoints", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.availo.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSession()), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshDashboardSession()).resolves.toMatchObject({ accessToken: "access-token" });
    await expect(logoutDashboardSession()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.availo.test/auth/browser/refresh", {
      cache: "no-store",
      credentials: "include",
      method: "POST"
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.availo.test/auth/browser/logout", {
      cache: "no-store",
      credentials: "include",
      method: "POST"
    });
  });

  it("rejects invalid credentials, rate limits, malformed sessions, and unsafe refresh tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "Invalid credentials" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Too many login attempts." }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, accessToken: "access-token" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...validSession(), refreshToken: "v1.ses_secret" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const input = { businessSlug: "sample-tours", email: "owner@example.com", password: "local-password" };
    await expect(loginDashboardSession(input)).rejects.toBeInstanceOf(DashboardLoginRejectedError);
    await expect(loginDashboardSession(input)).rejects.toBeInstanceOf(DashboardRateLimitedError);
    await expect(loginDashboardSession(input)).rejects.toThrow("Dashboard auth returned an invalid session");
    await expect(loginDashboardSession(input)).rejects.toThrow("Dashboard auth returned an unsafe refresh token");
  });

  function validOverview() {
    return {
      business: { id: "biz_test", name: "Test Operator", slug: "test-operator", timezone: "America/Denver" },
      stats: [],
      bookings: [],
      listings: [],
      bookedDates: [],
      fullDates: []
    };
  }

  function validSession() {
    return {
      ok: true,
      user: { id: "usr_test", email: "owner@example.com", businessId: "biz_test", role: "owner" },
      accessToken: "access-token"
    };
  }
});
