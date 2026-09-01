import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardAuthRequiredError, fetchDashboardOverview, normalizeDashboardOverview } from "./api-data";

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
});
