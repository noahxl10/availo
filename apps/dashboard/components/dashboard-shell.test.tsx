import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardOverview } from "../lib/api-data";

const createDashboardListingDraft = vi.fn();
const fetchDashboardOverview = vi.fn();
const currentDashboardSession = vi.fn();
const refreshDashboardSessionAfterStaleToken = vi.fn();

vi.mock("../lib/api-data", () => {
  class DashboardAuthRequiredError extends Error {
    constructor() {
      super("Dashboard authentication required");
    }
  }

  return {
    DashboardAuthRequiredError,
    DashboardBookingNotFoundError: class DashboardBookingNotFoundError extends Error {},
    DashboardListingForbiddenError: class DashboardListingForbiddenError extends Error {},
    DashboardListingValidationError: class DashboardListingValidationError extends Error {},
    DashboardLoginRejectedError: class DashboardLoginRejectedError extends Error {},
    DashboardRateLimitedError: class DashboardRateLimitedError extends Error {},
    createDashboardListingDraft,
    emptyOverview: { stats: [], bookings: [], listings: [], bookedDates: [], fullDates: [] },
    fallbackOverview: { stats: [], bookings: [], listings: [], bookedDates: [], fullDates: [] },
    fetchDashboardBookingDetail: vi.fn(),
    fetchDashboardOverview,
    loginDashboardSession: vi.fn(),
    logoutDashboardSession: vi.fn(),
    refreshDashboardSession: vi.fn()
  };
});

vi.mock("../lib/browser-session", () => ({
  DashboardSessionCoordinationError: class DashboardSessionCoordinationError extends Error {},
  clearMemoryDashboardSession: vi.fn(),
  currentDashboardSession,
  initializeDashboardSessionChannel: vi.fn(),
  logoutDashboardBrowserSession: vi.fn(),
  refreshDashboardSessionAfterStaleToken,
  restoreDashboardSession: vi.fn(),
  setMemoryDashboardSession: vi.fn(),
  subscribeDashboardSession: vi.fn(() => vi.fn()),
  supportsDashboardSessionCoordination: vi.fn(() => true)
}));

describe("dashboard listing draft save flow", () => {
  beforeEach(() => {
    createDashboardListingDraft.mockReset();
    fetchDashboardOverview.mockReset();
    currentDashboardSession.mockReset();
    refreshDashboardSessionAfterStaleToken.mockReset();
  });

  it("uses one-refresh retry when the post-save overview reload sees a stale token", async () => {
    const { DashboardAuthRequiredError } = await import("../lib/api-data");
    const { saveListingDraftAndReloadOverview } = await import("./dashboard-shell");
    const refreshedSession = {
      accessToken: "fresh-token",
      user: { id: "usr_test", email: "owner@example.invalid", businessId: "biz_test", role: "owner" }
    };
    const nextOverview: DashboardOverview = { business: { id: "biz_test", name: "Test Operator", slug: "test-operator", timezone: "UTC" }, stats: [], bookings: [], listings: [], bookedDates: [], fullDates: [] };

    createDashboardListingDraft.mockResolvedValueOnce({ id: "lst_test", title: "Sunset Paddle", status: "draft" });
    currentDashboardSession.mockReturnValue({ ...refreshedSession, accessToken: "stale-token" });
    fetchDashboardOverview.mockRejectedValueOnce(new DashboardAuthRequiredError()).mockResolvedValueOnce(nextOverview);
    refreshDashboardSessionAfterStaleToken.mockResolvedValueOnce(refreshedSession);

    await expect(
      saveListingDraftAndReloadOverview(
        {
          title: "Sunset Paddle",
          category: "Tour",
          basePriceCents: 7250,
          durationMinutes: 60,
          minGuests: 1,
          maxGuests: 8,
          capacity: 8
        },
        "old-token"
      )
    ).resolves.toEqual({ draft: { id: "lst_test", title: "Sunset Paddle", status: "draft" }, loaded: { session: refreshedSession, nextOverview } });

    expect(createDashboardListingDraft).toHaveBeenCalledWith(expect.objectContaining({ title: "Sunset Paddle" }), "old-token");
    expect(fetchDashboardOverview).toHaveBeenNthCalledWith(1, "stale-token");
    expect(refreshDashboardSessionAfterStaleToken).toHaveBeenCalledWith("stale-token");
    expect(fetchDashboardOverview).toHaveBeenNthCalledWith(2, "fresh-token");
  });
});
