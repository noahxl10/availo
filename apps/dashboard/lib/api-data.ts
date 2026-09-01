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

export const emptyOverview: DashboardOverview = {
  stats: [],
  bookings: [],
  listings: [],
  bookedDates: [],
  fullDates: []
};

export class DashboardAuthRequiredError extends Error {
  constructor() {
    super("Dashboard authentication required");
  }
}

export async function fetchDashboardOverview(accessToken: string | null): Promise<DashboardOverview> {
  if (!accessToken) throw new DashboardAuthRequiredError();
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const response = await fetch(`${apiBaseUrl}/dashboard/overview`, { cache: "no-store", headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) throw new DashboardAuthRequiredError();
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return normalizeDashboardOverview(await response.json());
}

export function normalizeDashboardOverview(payload: unknown): DashboardOverview {
  if (!isDashboardOverviewPayload(payload)) throw new Error("Dashboard API returned an invalid overview");
  const overview = payload;
  const normalized: DashboardOverview = { stats: overview.stats, bookings: overview.bookings, listings: overview.listings, bookedDates: overview.bookedDates, fullDates: overview.fullDates };
  if (overview.business) normalized.business = overview.business;
  return normalized;
}

function isDashboardOverviewPayload(payload: unknown): payload is DashboardOverview {
  if (!payload || typeof payload !== "object") return false;
  const overview = payload as Partial<DashboardOverview>;
  return (
    isBusiness(overview.business) &&
    Array.isArray(overview.stats) &&
    Array.isArray(overview.bookings) &&
    Array.isArray(overview.listings) &&
    isNumberArray(overview.bookedDates) &&
    isNumberArray(overview.fullDates)
  );
}

function isBusiness(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const business = value as DashboardOverview["business"];
  return Boolean(business && typeof business.id === "string" && typeof business.name === "string" && typeof business.slug === "string" && typeof business.timezone === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}
