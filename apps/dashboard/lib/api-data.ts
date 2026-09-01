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

export type DashboardBookingDetail = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  adultCount: number;
  childCount: number;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  subtotalCents: number;
  taxCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
  totalCents: number;
  notes: string | null;
  listing: {
    id: string;
    title: string;
    category: string | null;
    durationMinutes: number;
    capacity: number;
    meetingPoint: string | null;
  };
  addOns: {
    id: string;
    quantity: number;
    priceCents: number;
    totalCents: number;
    addOn: {
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
    };
  }[];
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

export class DashboardBookingNotFoundError extends Error {
  constructor() {
    super("Booking not found");
  }
}

export async function fetchDashboardOverview(accessToken: string | null): Promise<DashboardOverview> {
  if (!accessToken) throw new DashboardAuthRequiredError();
  const response = await fetch(`${apiBaseUrl()}/dashboard/overview`, { cache: "no-store", headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) throw new DashboardAuthRequiredError();
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return normalizeDashboardOverview(await response.json());
}

export async function fetchDashboardBookingDetail(bookingId: string, accessToken: string | null): Promise<DashboardBookingDetail> {
  if (!accessToken) throw new DashboardAuthRequiredError();
  const response = await fetch(`${apiBaseUrl()}/bookings/${encodeURIComponent(bookingId)}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 401) throw new DashboardAuthRequiredError();
  if (response.status === 404) throw new DashboardBookingNotFoundError();
  if (!response.ok) throw new Error(`Dashboard booking API returned ${response.status}`);
  return normalizeDashboardBookingDetail(await response.json());
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

export function normalizeDashboardBookingDetail(payload: unknown): DashboardBookingDetail {
  if (!isDashboardBookingDetailPayload(payload)) throw new Error("Dashboard booking API returned an invalid detail");
  return {
    id: payload.id,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone,
    bookingDate: payload.bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    guestCount: payload.guestCount,
    adultCount: payload.adultCount,
    childCount: payload.childCount,
    status: payload.status,
    paymentStatus: payload.paymentStatus,
    paymentProvider: payload.paymentProvider,
    subtotalCents: payload.subtotalCents,
    taxCents: payload.taxCents,
    platformFeeCents: payload.platformFeeCents,
    processorFeeCents: payload.processorFeeCents,
    totalCents: payload.totalCents,
    notes: payload.notes,
    listing: {
      id: payload.listing.id,
      title: payload.listing.title,
      category: payload.listing.category,
      durationMinutes: payload.listing.durationMinutes,
      capacity: payload.listing.capacity,
      meetingPoint: payload.listing.meetingPoint
    },
    addOns: payload.addOns.map((addOn) => ({
      id: addOn.id,
      quantity: addOn.quantity,
      priceCents: addOn.priceCents,
      totalCents: addOn.totalCents,
      addOn: {
        id: addOn.addOn.id,
        name: addOn.addOn.name,
        description: addOn.addOn.description,
        priceCents: addOn.addOn.priceCents
      }
    }))
  };
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

function isDashboardBookingDetailPayload(payload: unknown): payload is DashboardBookingDetail {
  if (!payload || typeof payload !== "object") return false;
  if ("refreshToken" in payload) return false;
  const booking = payload as Partial<DashboardBookingDetail>;
  return (
    typeof booking.id === "string" &&
    typeof booking.customerName === "string" &&
    typeof booking.customerEmail === "string" &&
    isNullableString(booking.customerPhone) &&
    typeof booking.bookingDate === "string" &&
    typeof booking.startTime === "string" &&
    typeof booking.endTime === "string" &&
    isInteger(booking.guestCount) &&
    isInteger(booking.adultCount) &&
    isInteger(booking.childCount) &&
    typeof booking.status === "string" &&
    typeof booking.paymentStatus === "string" &&
    isNullableString(booking.paymentProvider) &&
    isInteger(booking.subtotalCents) &&
    isInteger(booking.taxCents) &&
    isInteger(booking.platformFeeCents) &&
    isInteger(booking.processorFeeCents) &&
    isInteger(booking.totalCents) &&
    isNullableString(booking.notes) &&
    isBookingDetailListing(booking.listing) &&
    Array.isArray(booking.addOns) &&
    booking.addOns.every(isBookingDetailAddOn)
  );
}

function isDashboardUser(value: unknown): value is DashboardUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<DashboardUser>;
  return typeof user.id === "string" && typeof user.email === "string" && typeof user.businessId === "string" && typeof user.role === "string";
}

function isBookingDetailListing(value: unknown): value is DashboardBookingDetail["listing"] {
  if (!value || typeof value !== "object") return false;
  const listing = value as Partial<DashboardBookingDetail["listing"]>;
  return (
    typeof listing.id === "string" &&
    typeof listing.title === "string" &&
    isNullableString(listing.category) &&
    isInteger(listing.durationMinutes) &&
    isInteger(listing.capacity) &&
    isNullableString(listing.meetingPoint)
  );
}

function isBookingDetailAddOn(value: unknown): value is DashboardBookingDetail["addOns"][number] {
  if (!value || typeof value !== "object") return false;
  const addOn = value as Partial<DashboardBookingDetail["addOns"][number]>;
  if (!addOn.addOn || typeof addOn.addOn !== "object") return false;
  const nested = addOn.addOn as Partial<DashboardBookingDetail["addOns"][number]["addOn"]>;
  return (
    typeof addOn.id === "string" &&
    isInteger(addOn.quantity) &&
    isInteger(addOn.priceCents) &&
    isInteger(addOn.totalCents) &&
    typeof nested.id === "string" &&
    typeof nested.name === "string" &&
    isNullableString(nested.description) &&
    isInteger(nested.priceCents)
  );
}

function isBusiness(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const business = value as DashboardOverview["business"];
  return Boolean(business && typeof business.id === "string" && typeof business.name === "string" && typeof business.slug === "string" && typeof business.timezone === "string");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
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
