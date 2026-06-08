import { bookedDates, bookings, fullDates, listings, stats, type Booking, type Listing, type Stat } from "./mock-data";

export type DashboardOverview = {
  business?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  stats: Stat[];
  bookings: (Booking & { id?: string })[];
  listings: (Listing & { id?: string })[];
  bookedDates: number[];
  fullDates: number[];
};

export const fallbackOverview: DashboardOverview = {
  stats,
  bookings,
  listings,
  bookedDates,
  fullDates
};

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const response = await fetch(`${apiBaseUrl}/dashboard/overview`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return normalizeDashboardOverview(await response.json());
}

function normalizeDashboardOverview(payload: unknown): DashboardOverview {
  if (!payload || typeof payload !== "object") return fallbackOverview;
  const overview = payload as Partial<DashboardOverview>;
  const normalized: DashboardOverview = {
    stats: Array.isArray(overview.stats) ? overview.stats : fallbackOverview.stats,
    bookings: Array.isArray(overview.bookings) ? overview.bookings : fallbackOverview.bookings,
    listings: Array.isArray(overview.listings) ? overview.listings : fallbackOverview.listings,
    bookedDates: Array.isArray(overview.bookedDates) ? overview.bookedDates : fallbackOverview.bookedDates,
    fullDates: Array.isArray(overview.fullDates) ? overview.fullDates : fallbackOverview.fullDates
  };
  if (overview.business) normalized.business = overview.business;
  return normalized;
}
