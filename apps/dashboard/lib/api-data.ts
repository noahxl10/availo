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

export type DashboardUser = {
  id: string;
  email: string;
  businessId: string;
  role: string;
};

export type DashboardSession = {
  user: DashboardUser;
  accessToken: string;
};

export type DashboardLoginInput = {
  businessSlug: string;
  email: string;
  password: string;
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

export class DashboardLoginRejectedError extends Error {
  constructor() {
    super("Invalid credentials");
  }
}

export class DashboardRateLimitedError extends Error {
  constructor(message = "Too many attempts. Please try again later.") {
    super(message);
  }
}

export async function fetchDashboardOverview(accessToken: string | null): Promise<DashboardOverview> {
  if (!accessToken) throw new DashboardAuthRequiredError();
  const response = await fetch(`${apiBaseUrl()}/dashboard/overview`, { cache: "no-store", headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) throw new DashboardAuthRequiredError();
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return normalizeDashboardOverview(await response.json());
}

export async function loginDashboardSession(input: DashboardLoginInput): Promise<DashboardSession> {
  return authSessionRequest("/auth/browser/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function refreshDashboardSession(): Promise<DashboardSession> {
  return authSessionRequest("/auth/browser/refresh", { method: "POST" });
}

export async function logoutDashboardSession(): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/auth/browser/logout`, {
    cache: "no-store",
    credentials: "include",
    method: "POST"
  });
  if (!response.ok) throw new Error(`Dashboard logout returned ${response.status}`);
}

export function normalizeDashboardOverview(payload: unknown): DashboardOverview {
  if (!isDashboardOverviewPayload(payload)) throw new Error("Dashboard API returned an invalid overview");
  const overview = payload;
  const normalized: DashboardOverview = { stats: overview.stats, bookings: overview.bookings, listings: overview.listings, bookedDates: overview.bookedDates, fullDates: overview.fullDates };
  if (overview.business) normalized.business = overview.business;
  return normalized;
}

function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

async function authSessionRequest(path: string, init: RequestInit): Promise<DashboardSession> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include"
  });
  if (response.status === 429) throw new DashboardRateLimitedError(rateLimitMessage(await safeJson(response)));
  if (!response.ok) throw new Error(`Dashboard auth returned ${response.status}`);

  const payload = await response.json();
  if (isAuthFailure(payload)) throw new DashboardLoginRejectedError();
  return normalizeDashboardSession(payload);
}

function normalizeDashboardSession(payload: unknown): DashboardSession {
  if (!payload || typeof payload !== "object") throw new Error("Dashboard auth returned an invalid session");
  if ("refreshToken" in payload) throw new Error("Dashboard auth returned an unsafe refresh token");
  const session = payload as Partial<DashboardSession> & { ok?: unknown };
  if (session.ok !== true || typeof session.accessToken !== "string" || !isDashboardUser(session.user)) {
    throw new Error("Dashboard auth returned an invalid session");
  }
  return { user: session.user, accessToken: session.accessToken };
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

function isDashboardUser(value: unknown): value is DashboardUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<DashboardUser>;
  return typeof user.id === "string" && typeof user.email === "string" && typeof user.businessId === "string" && typeof user.role === "string";
}

function isBusiness(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const business = value as DashboardOverview["business"];
  return Boolean(business && typeof business.id === "string" && typeof business.name === "string" && typeof business.slug === "string" && typeof business.timezone === "string");
}

function isAuthFailure(payload: unknown) {
  return Boolean(payload && typeof payload === "object" && (payload as { ok?: unknown }).ok === false);
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function rateLimitMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}
