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
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${apiBaseUrl}/dashboard/overview`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return (await response.json()) as DashboardOverview;
}
