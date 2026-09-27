import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardOverview } from "../lib/api-data";

const createDashboardListingDraft = vi.fn();
const fetchDashboardOverview = vi.fn();
const fetchDashboardBookings = vi.fn();
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
    fetchDashboardBookings,
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
    fetchDashboardBookings.mockReset();
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

  it("retries one bookings page with the refreshed access token after a 401", async () => {
    const { DashboardAuthRequiredError } = await import("../lib/api-data");
    const { loadBookingListWithOneRefresh } = await import("./dashboard-shell");
    const page = { items: [], nextCursor: "opaque-next" };
    fetchDashboardBookings.mockRejectedValueOnce(new DashboardAuthRequiredError()).mockResolvedValueOnce(page);
    refreshDashboardSessionAfterStaleToken.mockResolvedValueOnce({
      accessToken: "fresh-token",
      user: { id: "usr_test", email: "owner@example.invalid", businessId: "biz_test", role: "owner" }
    });

    await expect(loadBookingListWithOneRefresh({ status: "confirmed", cursor: "opaque-cursor" }, "stale-token")).resolves.toBe(page);

    expect(fetchDashboardBookings).toHaveBeenNthCalledWith(1, { status: "confirmed", cursor: "opaque-cursor" }, "stale-token");
    expect(refreshDashboardSessionAfterStaleToken).toHaveBeenCalledWith("stale-token");
    expect(fetchDashboardBookings).toHaveBeenNthCalledWith(2, { status: "confirmed", cursor: "opaque-cursor" }, "fresh-token");
  });

  it("reloads operator data when the business or user changes but not on token refresh", async () => {
    const { dashboardSessionIdentity, resetDashboardDataForIdentityChange, shouldReloadDashboardForSession } = await import("./dashboard-shell");
    const userA = { id: "usr_a", businessId: "biz_a" };
    const sameUserAfterRefresh = { ...userA };
    const userB = { id: "usr_b", businessId: "biz_b" };
    const identityA = dashboardSessionIdentity(userA);

    expect(shouldReloadDashboardForSession(identityA, dashboardSessionIdentity(sameUserAfterRefresh))).toBe(false);
    expect(shouldReloadDashboardForSession(identityA, dashboardSessionIdentity(userB))).toBe(true);

    const tenantData = {
      overview: "A overview",
      bookingPage: ["A booking"],
      detail: "A detail",
      listingDraft: "A operator draft",
      listingDraftError: "A operator error",
      listingNotice: "A operator notice"
    };
    resetDashboardDataForIdentityChange(identityA, dashboardSessionIdentity(userB), () => {
      tenantData.overview = "";
      tenantData.bookingPage = [];
      tenantData.detail = "";
      tenantData.listingDraft = "";
      tenantData.listingDraftError = "";
      tenantData.listingNotice = "";
    });
    expect(tenantData).toEqual({ overview: "", bookingPage: [], detail: "", listingDraft: "", listingDraftError: "", listingNotice: "" });
  });

  it("uses non-confirmed badge colors for canceled and refunded booking states", async () => {
    const { bookingBadgeStatus } = await import("./dashboard-shell");
    expect(bookingBadgeStatus("confirmed")).toBe("confirmed");
    expect(bookingBadgeStatus("pending_payment")).toBe("pending");
    expect(bookingBadgeStatus("canceled")).toBe("cancelled");
    expect(bookingBadgeStatus("refunded")).toBe("cancelled");
    expect(bookingBadgeStatus("partially_refunded")).toBe("cancelled");
    expect(bookingBadgeStatus("failed")).toBe("cancelled");
  });

  it("pluralizes booking and guest counts", async () => {
    const { pluralize } = await import("./dashboard-shell");
    expect(pluralize(1, "booking")).toBe("booking");
    expect(pluralize(2, "booking")).toBe("bookings");
    expect(pluralize(1, "guest")).toBe("guest");
    expect(pluralize(2, "guest")).toBe("guests");
  });

  it("retries the same failed booking page and omits retry for local date validation", async () => {
    const { canRetryBookingList, retryFailedBookingList } = await import("./dashboard-shell");
    const failedRequest = { filters: { status: "confirmed", fromDate: "2026-03-01", cursor: "opaque-next" }, append: true };
    const load = vi.fn(async () => undefined);

    expect(canRetryBookingList("Could not load bookings.", failedRequest)).toBe(true);
    await retryFailedBookingList(failedRequest, load);
    expect(load).toHaveBeenCalledWith(failedRequest.filters, true);
    expect(canRetryBookingList("The start date must be on or before the end date.", failedRequest)).toBe(false);
  });
});
