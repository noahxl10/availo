import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DashboardAuthRequiredError,
  DashboardBookingNotFoundError,
  DashboardListingForbiddenError,
  DashboardListingValidationError,
  DashboardLoginRejectedError,
  DashboardRateLimitedError,
  createDashboardListingDraft,
  fetchDashboardBookingDetail,
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

  it("fetches booking detail with bearer auth and projects away internal provider fields", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.availo.test/";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validBookingDetail()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const detail = await fetchDashboardBookingDetail("bk/test id", "access-token");

    expect(fetchMock).toHaveBeenCalledWith("https://api.availo.test/bookings/bk%2Ftest%20id", {
      cache: "no-store",
      headers: { authorization: "Bearer access-token" }
    });
    expect(detail).toMatchObject({
      id: "bk_test",
      customerEmail: "guest@example.invalid",
      listing: { id: "lst_test", title: "Harbor Kayak Tour" }
    });
    expect(JSON.stringify(detail)).not.toContain("paymentReferenceId");
    expect(JSON.stringify(detail)).not.toContain("paymentIntentId");
    expect(JSON.stringify(detail)).not.toContain("businessId");
  });

  it("maps booking detail auth, not-found, and malformed responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...validBookingDetail(), refreshToken: "v1.unsafe" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...validBookingDetail(), guestCount: "2" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDashboardBookingDetail("bk_test", "access-token")).rejects.toBeInstanceOf(DashboardAuthRequiredError);
    await expect(fetchDashboardBookingDetail("bk_test", "access-token")).rejects.toBeInstanceOf(DashboardBookingNotFoundError);
    await expect(fetchDashboardBookingDetail("bk_test", "access-token")).rejects.toThrow("Dashboard booking API returned an invalid detail");
    await expect(fetchDashboardBookingDetail("bk_test", "access-token")).rejects.toThrow("Dashboard booking API returned an invalid detail");
  });

  it("creates draft listings with bearer auth and never sends tenant-owned fields", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.availo.test/";
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "lst_created", title: "Sunset Paddle", status: "draft", businessId: "biz_internal" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDashboardListingDraft(
        {
          title: "Sunset Paddle",
          category: "Tour",
          basePriceCents: 6500,
          childPriceCents: 4500,
          durationMinutes: 60,
          minGuests: 1,
          maxGuests: 8,
          capacity: 8,
          description: "Evening harbor trip.",
          meetingPoint: "100 Harbor Way"
        },
        "access-token"
      )
    ).resolves.toEqual({ id: "lst_created", title: "Sunset Paddle", status: "draft" });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const request = JSON.parse(String(requestInit?.body));
    expect(fetchMock).toHaveBeenCalledWith("https://api.availo.test/listings", expect.objectContaining({
      cache: "no-store",
      headers: { authorization: "Bearer access-token", "content-type": "application/json" },
      method: "POST"
    }));
    expect(request).toMatchObject({ title: "Sunset Paddle", status: "draft" });
    expect(request).not.toHaveProperty("businessId");
    expect(request).not.toHaveProperty("userId");
  });

  it("maps draft listing auth, permission, validation, and malformed responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "minGuests cannot be greater than maxGuests" }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "lst_created", title: "Unsafe", status: "draft", refreshToken: "v1.unsafe" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "lst_created", title: "Active", status: "active" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      title: "Sunset Paddle",
      category: "Tour",
      basePriceCents: 6500,
      durationMinutes: 60,
      minGuests: 1,
      maxGuests: 8,
      capacity: 8
    };

    await expect(createDashboardListingDraft(input, "access-token")).rejects.toBeInstanceOf(DashboardAuthRequiredError);
    await expect(createDashboardListingDraft(input, "access-token")).rejects.toBeInstanceOf(DashboardListingForbiddenError);
    await expect(createDashboardListingDraft(input, "access-token")).rejects.toThrow("minGuests cannot be greater than maxGuests");
    await expect(createDashboardListingDraft(input, "access-token")).rejects.toThrow("Dashboard listing API returned an unsafe refresh token");
    await expect(createDashboardListingDraft(input, "access-token")).rejects.toThrow("Dashboard listing API returned an invalid draft");
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

  function validBookingDetail() {
    return {
      id: "bk_test",
      businessId: "biz_internal",
      listingId: "lst_test",
      customerName: "Alex Rivera",
      customerEmail: "guest@example.invalid",
      customerPhone: "+15551234567",
      bookingDate: "2026-05-05",
      startTime: "9:30 AM",
      endTime: "10:30 AM",
      guestCount: 2,
      adultCount: 2,
      childCount: 0,
      status: "confirmed",
      paymentStatus: "paid",
      paymentProvider: "stripe",
      paymentReferenceId: "cs_internal",
      paymentIntentId: "pi_internal",
      paymentExpectedAmountCents: 14105,
      paymentExpectedCurrency: "USD",
      paymentExpiresAt: null,
      subtotalCents: 13000,
      taxCents: 1105,
      platformFeeCents: 0,
      processorFeeCents: 0,
      totalCents: 14105,
      notes: "Arriving early.",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
      listing: {
        id: "lst_test",
        businessId: "biz_internal",
        title: "Harbor Kayak Tour",
        category: "Tour",
        durationMinutes: 60,
        capacity: 12,
        meetingPoint: "100 Harbor Way"
      },
      addOns: [
        {
          id: "bao_test",
          bookingId: "bk_test",
          addOnId: "add_test",
          quantity: 1,
          priceCents: 1200,
          totalCents: 1200,
          addOn: { id: "add_test", name: "Wetsuit", description: "Warm layer", priceCents: 1200 }
        }
      ]
    };
  }
});
