"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, BrandLockup, Button, Card, EmptyState, Input, Select, StatCard, Textarea } from "@availo/ui";
import {
  bottomNavItems,
  mobileNavItems,
  navItems,
} from "../lib/mock-data";
import {
  DashboardAuthRequiredError,
  DashboardBookingNotFoundError,
  fetchDashboardBookings,
  DashboardListingForbiddenError,
  DashboardListingValidationError,
  DashboardLoginRejectedError,
  DashboardRateLimitedError,
  createDashboardListingDraft,
  fetchDashboardBookingDetail,
  emptyOverview,
  fallbackOverview,
  fetchDashboardOverview,
  loginDashboardSession,
  type DashboardBookingDetail,
  type DashboardBookingListFilters,
  type DashboardBookingListItem,
  type DashboardBookingListPage,
  type DashboardListingDraft,
  type DashboardListingDraftInput,
  type DashboardLoginInput,
  type DashboardOverview,
  type DashboardUser
} from "../lib/api-data";
import {
  DashboardSessionCoordinationError,
  clearMemoryDashboardSession,
  currentDashboardSession,
  initializeDashboardSessionChannel,
  logoutDashboardBrowserSession,
  refreshDashboardSessionAfterStaleToken,
  restoreDashboardSession,
  setMemoryDashboardSession,
  subscribeDashboardSession,
  supportsDashboardSessionCoordination
} from "../lib/browser-session";

type Screen = "dashboard" | "listings" | "create" | "bookings" | "booking" | "availability" | "customers" | "embed" | "analytics";
type ListingTab = "details" | "pricing";
type ApiStatus = "loading" | "live" | "auth" | "error" | "unsupported";
type BookingDetailStatus = "idle" | "loading" | "live" | "not-found" | "error";
const INVALID_BOOKING_DATE_RANGE_ERROR = "The start date must be on or before the end date.";
type ListingDraftForm = {
  title: string;
  category: string;
  durationMinutes: string;
  description: string;
  meetingPoint: string;
  basePrice: string;
  childPrice: string;
  minGuests: string;
  maxGuests: string;
  capacity: string;
};

export function dashboardSessionIdentity(user: Pick<DashboardUser, "id" | "businessId"> | null): string | null {
  return user ? JSON.stringify([user.id, user.businessId]) : null;
}

export function shouldReloadDashboardForSession(previousIdentity: string | null, nextIdentity: string | null): boolean {
  return previousIdentity !== nextIdentity;
}

export function resetDashboardDataForIdentityChange(previousIdentity: string | null, nextIdentity: string | null, reset: () => void): boolean {
  if (!shouldReloadDashboardForSession(previousIdentity, nextIdentity)) return false;
  reset();
  return true;
}

const initialListingDraftForm: ListingDraftForm = {
  title: "",
  category: "Tour",
  durationMinutes: "60",
  description: "",
  meetingPoint: "",
  basePrice: "",
  childPrice: "",
  minGuests: "1",
  maxGuests: "8",
  capacity: "8"
};

function navIdToScreen(id: string): Screen | null {
  if (id === "dashboard") return "dashboard";
  if (id === "listings") return "listings";
  if (id === "bookings") return "bookings";
  if (id === "availability") return "availability";
  if (id === "customers") return "customers";
  if (id === "embed") return "embed";
  if (id === "analytics") return "analytics";
  return null;
}

export function DashboardShell() {
  const [activeNav, setActiveNav] = useState<Screen>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [listingTab, setListingTab] = useState<ListingTab>("details");
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [operator, setOperator] = useState<DashboardUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingDetail, setBookingDetail] = useState<DashboardBookingDetail | null>(null);
  const [bookingDetailStatus, setBookingDetailStatus] = useState<BookingDetailStatus>("idle");
  const [bookingPage, setBookingPage] = useState<DashboardBookingListPage>({ items: [], nextCursor: null });
  const [bookingListStatus, setBookingListStatus] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [bookingListError, setBookingListError] = useState<string | null>(null);
  const [bookingFilters, setBookingFilters] = useState({ status: "", fromDate: "", toDate: "" });
  const [appliedBookingFilters, setAppliedBookingFilters] = useState<DashboardBookingListFilters>({});
  const [listingDraftForm, setListingDraftForm] = useState<ListingDraftForm>(initialListingDraftForm);
  const [listingDraftError, setListingDraftError] = useState<string | null>(null);
  const [listingNotice, setListingNotice] = useState<string | null>(null);
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [savingListingDraft, setSavingListingDraft] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const bookingRequestIdRef = useRef(0);
  const bookingListRequestIdRef = useRef(0);
  const lastBookingListRequestRef = useRef<{ filters: DashboardBookingListFilters; append: boolean } | null>(null);
  const overviewRequestIdRef = useRef(0);
  const sessionIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    initializeDashboardSessionChannel();
    const unsubscribe = subscribeDashboardSession((session) => {
      if (!active) return;
      if (session) {
        const nextIdentity = dashboardSessionIdentity(session.user);
        const previousIdentity = sessionIdentityRef.current;
        sessionIdentityRef.current = nextIdentity;
        setOperator(session.user);
        if (resetDashboardDataForIdentityChange(previousIdentity, nextIdentity, () => resetTenantOwnedData())) {
          const requestId = ++overviewRequestIdRef.current;
          setApiStatus("loading");
          void loadOverviewWithOneRefresh(session.accessToken)
            .then(({ session: loadedSession, nextOverview }) => {
              if (!active || overviewRequestIdRef.current !== requestId || sessionIdentityRef.current !== dashboardSessionIdentity(loadedSession.user)) return;
              setOperator(loadedSession.user);
              setOverview(nextOverview);
              setApiStatus("live");
            })
            .catch((error: unknown) => {
              if (!active || overviewRequestIdRef.current !== requestId) return;
              setOverview(emptyOverview);
              setApiStatus(error instanceof DashboardAuthRequiredError || error instanceof DashboardLoginRejectedError ? "auth" : error instanceof DashboardSessionCoordinationError ? "unsupported" : "error");
            });
        }
        return;
      }
      sessionIdentityRef.current = null;
      overviewRequestIdRef.current += 1;
      setOperator(null);
      setOverview(emptyOverview);
      bookingRequestIdRef.current += 1;
      setSelectedBookingId(null);
      setBookingDetail(null);
      setBookingDetailStatus("idle");
      bookingListRequestIdRef.current += 1;
      setBookingPage({ items: [], nextCursor: null });
      setBookingListStatus("idle");
      setAppliedBookingFilters({});
      lastBookingListRequestRef.current = null;
      setApiStatus("auth");
    });
    if (!supportsDashboardSessionCoordination()) {
      setApiStatus("unsupported");
      return () => {
        active = false;
        unsubscribe();
      };
    }

    const requestId = ++overviewRequestIdRef.current;
    restoreDashboardSession()
      .then((session) => {
        if (!active || overviewRequestIdRef.current !== requestId) throw new DashboardAuthRequiredError();
        sessionIdentityRef.current = dashboardSessionIdentity(session.user);
        return loadOverviewWithOneRefresh(session.accessToken);
      })
      .then(({ session, nextOverview }) => {
        if (!active || overviewRequestIdRef.current !== requestId || sessionIdentityRef.current !== dashboardSessionIdentity(session.user)) return;
        setOperator(session.user);
        setOverview(nextOverview);
        setApiStatus("live");
      })
      .catch((error: unknown) => {
        if (!active || overviewRequestIdRef.current !== requestId) return;
        setOverview(emptyOverview);
        setApiStatus(error instanceof DashboardAuthRequiredError || error instanceof DashboardLoginRejectedError ? "auth" : error instanceof DashboardSessionCoordinationError ? "unsupported" : "error");
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleLogin(input: DashboardLoginInput) {
    setSubmittingLogin(true);
    setLoginError(null);
    const requestId = ++overviewRequestIdRef.current;
    try {
      if (!supportsDashboardSessionCoordination()) throw new DashboardSessionCoordinationError();
      const session = await loginDashboardSession(input);
      if (overviewRequestIdRef.current !== requestId) return;
      const nextIdentity = dashboardSessionIdentity(session.user);
      resetDashboardDataForIdentityChange(sessionIdentityRef.current, nextIdentity, () => resetTenantOwnedData(true));
      sessionIdentityRef.current = nextIdentity;
      setOperator(session.user);
      setApiStatus("loading");
      setMemoryDashboardSession(session);
      const loaded = await loadOverviewWithOneRefresh(session.accessToken);
      if (overviewRequestIdRef.current !== requestId || sessionIdentityRef.current !== dashboardSessionIdentity(loaded.session.user)) return;
      setOperator(loaded.session.user);
      sessionIdentityRef.current = dashboardSessionIdentity(loaded.session.user);
      const { nextOverview } = loaded;
      setOverview(nextOverview);
      setApiStatus("live");
    } catch (error) {
      if (overviewRequestIdRef.current !== requestId) return;
      setOverview(emptyOverview);
      sessionIdentityRef.current = null;
      overviewRequestIdRef.current += 1;
      setOperator(null);
      bookingRequestIdRef.current += 1;
      setSelectedBookingId(null);
      setBookingDetail(null);
      setBookingDetailStatus("idle");
      bookingListRequestIdRef.current += 1;
      setBookingPage({ items: [], nextCursor: null });
      setBookingListStatus("idle");
      setAppliedBookingFilters({});
      lastBookingListRequestRef.current = null;
      setApiStatus(error instanceof DashboardSessionCoordinationError ? "unsupported" : "auth");
      setLoginError(loginErrorMessage(error));
    } finally {
      setSubmittingLogin(false);
    }
  }

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logoutDashboardBrowserSession();
    } catch {
      // Local session state still clears so a failed network logout does not strand the UI.
    } finally {
      clearMemoryDashboardSession();
      sessionIdentityRef.current = null;
      overviewRequestIdRef.current += 1;
      setOperator(null);
      setOverview(emptyOverview);
      bookingRequestIdRef.current += 1;
      setSelectedBookingId(null);
      setBookingDetail(null);
      setBookingDetailStatus("idle");
      bookingListRequestIdRef.current += 1;
      setBookingPage({ items: [], nextCursor: null });
      setBookingListStatus("idle");
      setAppliedBookingFilters({});
      lastBookingListRequestRef.current = null;
      setApiStatus("auth");
      setSigningOut(false);
    }
  }

  async function handleBookingSelect(booking: DashboardOverview["bookings"][number]) {
    if (!booking.id) return;
    const session = currentDashboardSession();
    if (!session) {
      setApiStatus("auth");
      return;
    }

    setActiveNav("booking");
    setSelectedBookingId(booking.id);
    setBookingDetail(null);
    setBookingDetailStatus("loading");
    const requestId = bookingRequestIdRef.current + 1;
    bookingRequestIdRef.current = requestId;
    try {
      const detail = await loadBookingDetailWithOneRefresh(booking.id, session.accessToken);
      if (bookingRequestIdRef.current !== requestId) return;
      setBookingDetail(detail);
      setBookingDetailStatus("live");
    } catch (error) {
      if (bookingRequestIdRef.current !== requestId) return;
      setBookingDetail(null);
      if (error instanceof DashboardAuthRequiredError || error instanceof DashboardLoginRejectedError) {
        setApiStatus("auth");
        setBookingDetailStatus("idle");
        return;
      }
      setBookingDetailStatus(error instanceof DashboardBookingNotFoundError ? "not-found" : "error");
    }
  }

  async function loadBookingList(filters: DashboardBookingListFilters, append = false) {
    const session = currentDashboardSession();
    if (!session) {
      setApiStatus("auth");
      return;
    }
    const requestId = ++bookingListRequestIdRef.current;
    lastBookingListRequestRef.current = { filters, append };
    setActiveNav("bookings");
    setAppliedBookingFilters(filters);
    if (!append) setBookingPage({ items: [], nextCursor: null });
    setBookingListStatus("loading");
    setBookingListError(null);
    try {
      const page = await loadBookingListWithOneRefresh(filters, session.accessToken);
      const currentSession = currentDashboardSession();
      if (bookingListRequestIdRef.current !== requestId || !currentSession || currentSession.user.id !== session.user.id || currentSession.user.businessId !== session.user.businessId) return;
      setBookingPage((current) => append ? { items: [...current.items, ...page.items], nextCursor: page.nextCursor } : page);
      setAppliedBookingFilters(filters);
      setBookingListStatus("live");
    } catch (error) {
      if (bookingListRequestIdRef.current !== requestId) return;
      if (error instanceof DashboardAuthRequiredError || error instanceof DashboardLoginRejectedError) {
        setApiStatus("auth");
        return;
      }
      setBookingListError("Could not load bookings. Check your connection and try again.");
      setBookingListStatus("error");
    }
  }

  function openBookings() {
    setBookingFilters({ status: "", fromDate: "", toDate: "" });
    void loadBookingList({});
  }

  function resetTenantOwnedData(preserveOverviewRequest = false) {
    if (!preserveOverviewRequest) overviewRequestIdRef.current += 1;
    bookingRequestIdRef.current += 1;
    bookingListRequestIdRef.current += 1;
    setActiveNav("dashboard");
    setOperator(null);
    setOverview(emptyOverview);
    setSelectedBookingId(null);
    setBookingDetail(null);
    setBookingDetailStatus("idle");
    setBookingPage({ items: [], nextCursor: null });
    setBookingListStatus("idle");
    setBookingListError(null);
    setBookingFilters({ status: "", fromDate: "", toDate: "" });
    setAppliedBookingFilters({});
    lastBookingListRequestRef.current = null;
    setListingDraftForm(initialListingDraftForm);
    setListingTab("details");
    setListingDraftError(null);
    setListingNotice(null);
  }

  function applyBookingFilters() {
    if (bookingFilters.fromDate && bookingFilters.toDate && bookingFilters.fromDate > bookingFilters.toDate) {
      bookingListRequestIdRef.current += 1;
      setBookingListError(INVALID_BOOKING_DATE_RANGE_ERROR);
      setBookingListStatus("error");
      return;
    }
    const filters: DashboardBookingListFilters = {};
    if (bookingFilters.status) filters.status = bookingFilters.status;
    if (bookingFilters.fromDate) filters.fromDate = bookingFilters.fromDate;
    if (bookingFilters.toDate) filters.toDate = bookingFilters.toDate;
    void loadBookingList(filters);
  }

  function retryBookingList() {
    const request = lastBookingListRequestRef.current;
    void retryFailedBookingList(request, loadBookingList);
  }

  function selectListedBooking(booking: DashboardBookingListItem) {
    const summary = {
      id: booking.id,
      name: booking.customerName,
      listing: booking.listing.title,
      date: `${booking.bookingDate} · ${booking.startTime}`,
      guests: booking.guestCount,
      total: formatMoney(booking.totalCents),
      status: bookingBadgeStatus(booking.status),
      initials: booking.customerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    };
    void handleBookingSelect(summary);
  }

  async function handleListingDraftSubmit() {
    setListingDraftError(null);
    setListingNotice(null);
    const session = currentDashboardSession();
    if (!session) {
      setApiStatus("auth");
      return;
    }

    let input: DashboardListingDraftInput;
    try {
      input = listingDraftInput(listingDraftForm);
    } catch (error) {
      setListingDraftError(error instanceof Error ? error.message : "Listing input is invalid");
      return;
    }

    setSavingListingDraft(true);
    const requestId = ++overviewRequestIdRef.current;
    const identity = dashboardSessionIdentity(session.user);
    try {
      const { draft, loaded } = await saveListingDraftAndReloadOverview(input, session.accessToken);
      if (overviewRequestIdRef.current !== requestId || sessionIdentityRef.current !== identity || dashboardSessionIdentity(loaded.session.user) !== identity) return;
      setOperator(loaded.session.user);
      setOverview(loaded.nextOverview);
      setListingDraftForm(initialListingDraftForm);
      setListingTab("details");
      setListingNotice(`${draft.title} was saved as a draft.`);
      setActiveNav("listings");
    } catch (error) {
      if (overviewRequestIdRef.current !== requestId || sessionIdentityRef.current !== identity) return;
      if (error instanceof DashboardAuthRequiredError || error instanceof DashboardLoginRejectedError) {
        setApiStatus("auth");
        setListingDraftError("Please sign in again before saving this listing.");
      } else if (error instanceof DashboardListingForbiddenError) {
        setListingDraftError("Your dashboard role cannot create listings.");
      } else if (error instanceof DashboardListingValidationError) {
        setListingDraftError(error.message);
      } else {
        setListingDraftError("Could not save the draft listing.");
      }
    } finally {
      setSavingListingDraft(false);
    }
  }

  const activeListingCount = overview.listings.filter((listing) => listing.status === "active").length;
  const customerCount = new Set(overview.bookings.map((booking) => booking.name)).size;
  const businessName = apiStatus === "live" ? overview.business?.name ?? "Operator" : "Availo";
  const primaryListing = overview.listings[0] ?? fallbackOverview.listings[0]!;
  const selectedBookingSummary = overview.bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  const pageTitle = {
    dashboard: "Good morning",
    listings: "Listings",
    create: "New Listing",
    booking: selectedBookingId ? `#${selectedBookingId}` : "Booking Detail",
    bookings: "Bookings",
    availability: "Availability",
    customers: "Customers",
    embed: "Embed Widget",
    analytics: "Analytics",
  }[activeNav];
  const pageSubtitle = {
    dashboard: `Tuesday, May 5, 2026 · ${businessName}`,
    listings: `${overview.listings.length} listings · ${activeListingCount} active`,
    create: "Create or edit the customer-facing booking experience.",
    booking: bookingDetail
      ? `${bookingDetail.listing.title} · ${formatBookingDateTime(bookingDetail)}`
      : selectedBookingSummary
        ? `${selectedBookingSummary.listing} · ${selectedBookingSummary.date}`
        : "Select a booking from recent activity",
    bookings: `${bookingPage.items.length} ${pluralize(bookingPage.items.length, "booking")} loaded from the live API.`,
    availability: "May schedule, capacity, and booked days from the live API.",
    customers: `${customerCount} customers from recent booking activity.`,
    embed: "Add a booking widget to any website in under 5 minutes.",
    analytics: `Revenue and demand signals for ${businessName}.`,
  }[activeNav];

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" data-collapsed={collapsed} aria-label="Primary navigation">
        <div className="dashboard-sidebar__brand">
          <BrandLockup size="md" className="dashboard-brand" />
        </div>

        <nav className="dashboard-sidebar__nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className="dashboard-nav-item"
              data-active={activeNav === navIdToScreen(item.id) || (item.id === "bookings" && activeNav === "booking")}
              key={item.id}
              onClick={() => navIdToScreen(item.id) === "bookings" ? openBookings() : setActiveNav(navIdToScreen(item.id) ?? "dashboard")}
              title={collapsed ? item.label : undefined}
              type="button"
            >
              <span className="dashboard-nav-item__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="dashboard-nav-item__label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar__bottom">
          {bottomNavItems.map((item) => (
            <button
              className="dashboard-nav-item"
              data-active={false}
              key={item.id}
              onClick={() => setActiveNav("dashboard")}
              title={collapsed ? item.label : undefined}
              type="button"
            >
              <span className="dashboard-nav-item__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="dashboard-nav-item__label">{item.label}</span>
            </button>
          ))}

          <div className="dashboard-user">
            <div className="dashboard-user__avatar">{operatorInitials(operator)}</div>
            <div className="dashboard-user__copy">
              <div>{operator?.email ?? "Operator"}</div>
              <span>{businessName}</span>
            </div>
          </div>

          {apiStatus === "live" && (
            <Button className="dashboard-signout" disabled={signingOut} onClick={handleLogout} type="button" variant="secondary">
              {signingOut ? "Signing out" : "Sign out"}
            </Button>
          )}

          <button
            className="dashboard-collapse"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="page-header">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          {apiStatus === "live" && (
            <div className="page-header__actions">
              {activeNav !== "dashboard" && (
                <Button variant="secondary" type="button" onClick={() => setActiveNav("dashboard")}>
                  ← Dashboard
                </Button>
              )}
              <Button variant="secondary" type="button">
                Export
              </Button>
              <Button type="button" onClick={() => setActiveNav("create")}>
                + New Listing
              </Button>
            </div>
          )}
        </header>

        <div className="api-status" data-status={apiStatus}>
          {apiStatus === "live" ? "Live API" : apiStatus === "loading" ? "Connecting API" : apiStatus === "auth" ? "Sign in required" : apiStatus === "unsupported" ? "Browser unsupported" : "API unavailable"}
        </div>

        {apiStatus !== "live" && <DashboardUnavailable error={loginError} onLogin={handleLogin} status={apiStatus} submitting={submittingLogin} />}
        {apiStatus === "live" && activeNav === "dashboard" && <DashboardOverview overview={overview} onBooking={handleBookingSelect} onViewAll={openBookings} />}
        {apiStatus === "live" && activeNav === "listings" && <ListingsManager listings={overview.listings} notice={listingNotice} onCreate={() => setActiveNav("create")} />}
        {apiStatus === "live" && activeNav === "create" && (
          <CreateListing
            error={listingDraftError}
            form={listingDraftForm}
            listingTab={listingTab}
            onChange={setListingDraftForm}
            onSubmit={handleListingDraftSubmit}
            saving={savingListingDraft}
            setListingTab={setListingTab}
          />
        )}
        {apiStatus === "live" && activeNav === "booking" && <BookingDetail detail={bookingDetail} status={bookingDetailStatus} summary={selectedBookingSummary} />}
        {apiStatus === "live" && activeNav === "bookings" && <BookingsManager
          error={bookingListError}
          filters={bookingFilters}
          onApplyFilters={applyBookingFilters}
          onChangeFilters={setBookingFilters}
          onLoadMore={() => bookingPage.nextCursor && void loadBookingList({ ...appliedBookingFilters, cursor: bookingPage.nextCursor }, true)}
          canRetry={canRetryBookingList(bookingListError, lastBookingListRequestRef.current)}
          onRetry={retryBookingList}
          onSelect={selectListedBooking}
          page={bookingPage}
          status={bookingListStatus}
        />}
        {apiStatus === "live" && activeNav === "availability" && <AvailabilityManager overview={overview} />}
        {apiStatus === "live" && activeNav === "customers" && <CustomersManager bookings={overview.bookings} />}
        {apiStatus === "live" && activeNav === "embed" && <EmbedSetup businessName={businessName} listing={primaryListing} />}
        {apiStatus === "live" && activeNav === "analytics" && <AnalyticsManager overview={overview} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileNavItems.map((item) => (
          <button
            data-active={activeNav === navIdToScreen(item.id) || (item.id === "bookings" && activeNav === "booking")}
            key={item.id}
            onClick={() => navIdToScreen(item.id) === "bookings" ? openBookings() : setActiveNav(navIdToScreen(item.id) ?? "dashboard")}
            type="button"
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

async function loadOverviewWithOneRefresh(accessToken: string): Promise<{ session: NonNullable<ReturnType<typeof currentDashboardSession>>; nextOverview: DashboardOverview }> {
  try {
    const nextOverview = await fetchDashboardOverview(accessToken);
    const session = currentDashboardSession();
    if (!session) throw new DashboardAuthRequiredError();
    return { session, nextOverview };
  } catch (error) {
    if (!(error instanceof DashboardAuthRequiredError)) throw error;
    const session = await refreshDashboardSessionAfterStaleToken(accessToken);
    return { session, nextOverview: await fetchDashboardOverview(session.accessToken) };
  }
}

async function loadBookingDetailWithOneRefresh(bookingId: string, accessToken: string): Promise<DashboardBookingDetail> {
  try {
    return await fetchDashboardBookingDetail(bookingId, accessToken);
  } catch (error) {
    if (!(error instanceof DashboardAuthRequiredError)) throw error;
    const session = await refreshDashboardSessionAfterStaleToken(accessToken);
    return fetchDashboardBookingDetail(bookingId, session.accessToken);
  }
}

export async function loadBookingListWithOneRefresh(filters: DashboardBookingListFilters, accessToken: string): Promise<DashboardBookingListPage> {
  try {
    return await fetchDashboardBookings(filters, accessToken);
  } catch (error) {
    if (!(error instanceof DashboardAuthRequiredError)) throw error;
    const session = await refreshDashboardSessionAfterStaleToken(accessToken);
    return fetchDashboardBookings(filters, session.accessToken);
  }
}

export function canRetryBookingList(error: string | null, request: { filters: DashboardBookingListFilters; append: boolean } | null) {
  return request !== null && error !== INVALID_BOOKING_DATE_RANGE_ERROR;
}

export async function retryFailedBookingList<T>(
  request: { filters: DashboardBookingListFilters; append: boolean } | null,
  load: (filters: DashboardBookingListFilters, append?: boolean) => Promise<T>
): Promise<T | undefined> {
  if (!request) return undefined;
  return load(request.filters, request.append);
}

async function createListingDraftWithOneRefresh(input: DashboardListingDraftInput, accessToken: string) {
  try {
    return await createDashboardListingDraft(input, accessToken);
  } catch (error) {
    if (!(error instanceof DashboardAuthRequiredError)) throw error;
    const session = await refreshDashboardSessionAfterStaleToken(accessToken);
    return createDashboardListingDraft(input, session.accessToken);
  }
}

export async function saveListingDraftAndReloadOverview(input: DashboardListingDraftInput, accessToken: string): Promise<{
  draft: DashboardListingDraft;
  loaded: { session: NonNullable<ReturnType<typeof currentDashboardSession>>; nextOverview: DashboardOverview };
}> {
  const draft = await createListingDraftWithOneRefresh(input, accessToken);
  const currentSession = currentDashboardSession();
  if (!currentSession) throw new DashboardAuthRequiredError();
  return { draft, loaded: await loadOverviewWithOneRefresh(currentSession.accessToken) };
}

function DashboardOverview({
  onViewAll,
  onBooking,
  overview
}: {
  onBooking: (booking: DashboardOverview["bookings"][number]) => void;
  onViewAll: () => void;
  overview: DashboardOverview;
}) {
  return (
    <>
      <section className="stat-grid" aria-label="Dashboard metrics">
        {overview.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} {...(stat.delta ? { delta: stat.delta } : {})} />
        ))}
      </section>
      <section className="workspace-grid">
        <RecentBookings bookings={overview.bookings} onBooking={onBooking} onViewAll={onViewAll} />
        <MiniCalendar bookedDates={overview.bookedDates} fullDates={overview.fullDates} />
      </section>
      <ListingGrid listings={overview.listings} />
    </>
  );
}

function BookingsManager({
  error,
  filters,
  onApplyFilters,
  onChangeFilters,
  canRetry,
  onLoadMore,
  onRetry,
  onSelect,
  page,
  status
}: {
  error: string | null;
  filters: { status: string; fromDate: string; toDate: string };
  onApplyFilters: () => void;
  onChangeFilters: (filters: { status: string; fromDate: string; toDate: string }) => void;
  canRetry: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (booking: DashboardBookingListItem) => void;
  page: DashboardBookingListPage;
  status: "idle" | "loading" | "live" | "error";
}) {
  return (
    <section className="bookings-manager" aria-label="Bookings">
      <form className="bookings-filters" onSubmit={(event) => { event.preventDefault(); onApplyFilters(); }}>
        <label>
          <span>Status</span>
          <Select aria-label="Booking status" onChange={(event) => onChangeFilters({ ...filters, status: event.target.value })} value={filters.status}>
            <option value="">All statuses</option>
            <option value="pending_payment">Pending payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="canceled">Canceled</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="failed">Failed</option>
          </Select>
        </label>
        <label>
          <span>From</span>
          <Input aria-label="From date" onChange={(event) => onChangeFilters({ ...filters, fromDate: event.target.value })} type="date" value={filters.fromDate} />
        </label>
        <label>
          <span>To</span>
          <Input aria-label="To date" onChange={(event) => onChangeFilters({ ...filters, toDate: event.target.value })} type="date" value={filters.toDate} />
        </label>
        <Button disabled={status === "loading"} type="submit">Apply filters</Button>
      </form>

      {status === "loading" && page.items.length === 0 && <EmptyState icon="◌" title="Loading bookings" body="Fetching bookings for this operator." />}
      {status === "error" && (
        <div className="bookings-message" role="alert">
          <p>{error ?? "Could not load bookings."}</p>
          {canRetry && <Button onClick={onRetry} type="button" variant="secondary">Retry</Button>}
        </div>
      )}
      {status === "live" && page.items.length === 0 && (
        <EmptyState icon="◷" title={hasBookingFilters(filters) ? "No matching bookings" : "No bookings yet"} body={hasBookingFilters(filters) ? "Try changing the filters to see more bookings." : "Bookings will appear here when customers reserve an activity."} />
      )}
      {page.items.length > 0 && (
        <Card className="bookings-table-card" padded={false}>
          <div className="booking-list">
            {page.items.map((booking) => (
              <button className="booking-row" key={booking.id} onClick={() => onSelect(booking)} type="button">
                <span className="booking-row__avatar">{booking.customerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                <span className="booking-row__copy">
                  <strong>{booking.customerName}</strong>
                  <span>{booking.listing.title} · {booking.bookingDate} · {booking.startTime} · {booking.guestCount} {pluralize(booking.guestCount, "guest")}</span>
                </span>
                <span className="booking-row__total">{formatMoney(booking.totalCents)}</span>
                <Badge status={bookingListBadgeStatus(booking.status)}>{bookingStatusLabel(booking.status)}</Badge>
              </button>
            ))}
          </div>
          <div className="bookings-pagination">
            {status === "loading" && page.items.length > 0 && <span aria-live="polite">Loading more bookings…</span>}
            {page.nextCursor ? <Button disabled={status === "loading"} onClick={onLoadMore} type="button" variant="secondary">Load more</Button> : <span>{page.items.length ? "You’ve reached the end." : ""}</span>}
          </div>
        </Card>
      )}
    </section>
  );
}

function hasBookingFilters(filters: { status: string; fromDate: string; toDate: string }) {
  return Boolean(filters.status || filters.fromDate || filters.toDate);
}

function bookingListBadgeStatus(status: DashboardBookingListItem["status"]): "confirmed" | "pending" | "cancelled" {
  return bookingBadgeStatus(status);
}

function bookingStatusLabel(status: DashboardBookingListItem["status"]) {
  return status === "pending_payment" ? "Pending payment" : status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function pluralize(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`;
}

function DashboardUnavailable({
  error,
  onLogin,
  status,
  submitting
}: {
  error: string | null;
  onLogin: (input: DashboardLoginInput) => Promise<void>;
  status: ApiStatus;
  submitting: boolean;
}) {
  if (status === "loading") {
    return <EmptyState className="dashboard-empty" icon="⊡" title="Connecting dashboard" body="Loading live operator data." />;
  }
  if (status === "unsupported") {
    return <EmptyState className="dashboard-empty" icon="◎" title="Browser unsupported" body="This dashboard requires secure browser session coordination." />;
  }
  if (status === "auth") {
    return <DashboardLoginForm error={error} onSubmit={onLogin} submitting={submitting} />;
  }
  return <EmptyState className="dashboard-empty" icon="◌" title="API unavailable" body="The dashboard could not load live operator data." />;
}

function DashboardLoginForm({ error, onSubmit, submitting }: { error: string | null; onSubmit: (input: DashboardLoginInput) => Promise<void>; submitting: boolean }) {
  const [businessSlug, setBusinessSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const disabled = submitting || !businessSlug.trim() || !email.trim() || !password;

  return (
    <section className="dashboard-login" aria-labelledby="dashboard-login-heading">
      <div className="dashboard-login__header">
        <BrandLockup size="md" />
        <div>
          <h2 id="dashboard-login-heading">Operator sign in</h2>
          <p>Access your live booking dashboard.</p>
        </div>
      </div>
      <form
        className="dashboard-login__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          void onSubmit({ businessSlug: businessSlug.trim(), email: email.trim(), password });
        }}
      >
        <label>
          <span>Business slug</span>
          <Input autoComplete="organization" disabled={submitting} onChange={(event) => setBusinessSlug(event.target.value)} placeholder="sample-tours" value={businessSlug} />
        </label>
        <label>
          <span>Email</span>
          <Input autoComplete="email" disabled={submitting} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" type="email" value={email} />
        </label>
        <label>
          <span>Password</span>
          <Input autoComplete="current-password" disabled={submitting} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        {error && <p className="dashboard-login__error">{error}</p>}
        <Button disabled={disabled} type="submit">
          {submitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </section>
  );
}

function loginErrorMessage(error: unknown) {
  if (error instanceof DashboardRateLimitedError) return error.message;
  if (error instanceof DashboardSessionCoordinationError) return "This browser cannot coordinate secure dashboard sessions.";
  if (error instanceof DashboardLoginRejectedError) return "Invalid credentials.";
  return "Unable to sign in.";
}

function operatorInitials(operator: DashboardUser | null) {
  if (!operator?.email) return "OP";
  return operator.email.slice(0, 2).toUpperCase();
}

function RecentBookings({ bookings, onBooking, onViewAll }: { bookings: DashboardOverview["bookings"]; onBooking: (booking: DashboardOverview["bookings"][number]) => void; onViewAll: () => void }) {
  return (
    <Card className="recent-bookings" padded={false}>
      <div className="card-header">
        <div>
          <h2>Recent Bookings</h2>
          <p>Latest activity from the live API</p>
        </div>
        <button className="text-action" onClick={onViewAll} type="button">
          View all →
        </button>
      </div>
      <div className="booking-list">
        {bookings.map((booking, index) => (
          <button className="booking-row" disabled={!booking.id} key={booking.id ?? `${booking.name}-${index}`} onClick={() => onBooking(booking)} type="button">
            <span className="booking-row__avatar">{booking.initials}</span>
            <span className="booking-row__copy">
              <strong>{booking.name}</strong>
              <span>
                {booking.listing} · {booking.date} · {booking.guests} guests
              </span>
            </span>
            <span className="booking-row__total">{booking.total}</span>
            <Badge status={booking.status} />
          </button>
        ))}
      </div>
    </Card>
  );
}

function MiniCalendar({ bookedDates, fullDates }: { bookedDates: number[]; fullDates: number[] }) {
  return (
    <Card className="mini-calendar">
      <div className="mini-calendar__header">
        <h2>Availability — May</h2>
        <Badge status="active">Live</Badge>
      </div>
      <div className="mini-calendar__grid" aria-label="May availability">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span className="mini-calendar__weekday" key={`${day}-${index}`}>
            {day}
          </span>
        ))}
        <span />
        <span />
        {Array.from({ length: 30 }, (_, index) => {
          const date = index + 1;
          return (
            <span className="mini-calendar__date" data-booked={bookedDates.includes(date)} data-full={fullDates.includes(date)} key={date}>
              {date}
            </span>
          );
        })}
      </div>
      <div className="mini-calendar__legend">
        <span><i data-full="true" /> Full</span>
        <span><i data-booked="true" /> Booked</span>
        <span><i /> Open</span>
      </div>
    </Card>
  );
}

function ListingGrid({ listings }: { listings: DashboardOverview["listings"] }) {
  return (
    <section className="listing-grid" aria-label="Listings">
      {listings.slice(0, 3).map((listing) => <ListingCard key={listing.title} listing={listing} />)}
    </section>
  );
}

function ListingCard({ listing }: { listing: DashboardOverview["listings"][number] }) {
  return (
    <Card className="listing-card" padded={false} interactive>
      <div className="listing-card__media">
        <div className="listing-card__placeholder" aria-hidden="true" />
        <Badge status={listing.status}>{listing.statusLabel ?? listing.status}</Badge>
      </div>
      <div className="listing-card__body">
        <h3>{listing.title}</h3>
        <p>{listing.type}</p>
        <div>
          <strong>{listing.price}</strong>
          <span>up to {listing.capacity} guests</span>
        </div>
      </div>
    </Card>
  );
}

function ListingsManager({ listings, notice, onCreate }: { listings: DashboardOverview["listings"]; notice: string | null; onCreate: () => void }) {
  return (
    <>
      <div className="listings-toolbar">
        <div className="listing-search">
          <span aria-hidden="true">⊕</span>
          <Input placeholder="Search listings..." />
        </div>
        <Button onClick={onCreate} type="button">+ New Listing</Button>
      </div>
      {notice && <p className="form-message" data-tone="success">{notice}</p>}
      <section className="listing-grid listing-grid--manager" aria-label="All listings">
        {listings.map((listing) => <ListingCard key={listing.title} listing={listing} />)}
      </section>
    </>
  );
}

function AvailabilityManager({ overview }: { overview: DashboardOverview }) {
  return (
    <div className="availability-layout">
      <MiniCalendar bookedDates={overview.bookedDates} fullDates={overview.fullDates} />
      <section className="availability-panel" aria-label="Upcoming schedule">
        <div className="card-header">
          <div>
            <h2>Upcoming Schedule</h2>
            <p>{overview.bookings.length} bookings across {overview.bookedDates.length} booked days</p>
          </div>
          <Badge status="active">Live</Badge>
        </div>
        <div className="schedule-list">
          {overview.bookings.map((booking, index) => (
            <div className="schedule-row" key={booking.id ?? `${booking.name}-${index}`}>
              <span className="schedule-row__date">{booking.date}</span>
              <div>
                <strong>{booking.listing}</strong>
                <span>{booking.name} · {booking.guests} guests</span>
              </div>
              <Badge status={booking.status} />
            </div>
          ))}
        </div>
      </section>
      <section className="capacity-panel" aria-label="Listing capacity">
        <div className="card-header">
          <div>
            <h2>Capacity</h2>
            <p>Per-booking limits by listing</p>
          </div>
        </div>
        <div className="capacity-list">
          {overview.listings.map((listing) => (
            <div className="capacity-row" key={listing.id ?? listing.title}>
              <div>
                <strong>{listing.title}</strong>
                <span>{listing.type}</span>
              </div>
              <b>{listing.capacity}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CustomersManager({ bookings }: { bookings: DashboardOverview["bookings"] }) {
  const customers = bookings.map((booking) => ({
    initials: booking.initials,
    name: booking.name,
    lastBooking: booking.listing,
    date: booking.date,
    guests: booking.guests,
    value: booking.total,
    status: booking.status
  }));

  return (
    <section className="customer-table" aria-label="Customers">
      <div className="card-header">
        <div>
          <h2>Customer List</h2>
          <p>Recent guests pulled from booking records</p>
        </div>
        <Button variant="secondary" type="button">Export CSV</Button>
      </div>
      <div className="customer-list">
        {customers.map((customer) => (
          <div className="customer-row" key={`${customer.name}-${customer.date}`}>
            <span className="booking-row__avatar">{customer.initials}</span>
            <div className="customer-row__identity">
              <strong>{customer.name}</strong>
              <span>{customer.lastBooking} · {customer.date}</span>
            </div>
            <span>{customer.guests} guests</span>
            <strong>{customer.value}</strong>
            <Badge status={customer.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticsManager({ overview }: { overview: DashboardOverview }) {
  const confirmedBookings = overview.bookings.filter((booking) => booking.status === "confirmed").length;
  const pendingBookings = overview.bookings.length - confirmedBookings;

  return (
    <>
      <section className="stat-grid" aria-label="Analytics metrics">
        {overview.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} {...(stat.delta ? { delta: stat.delta } : {})} />
        ))}
      </section>
      <div className="analytics-grid">
        <section className="analytics-panel" aria-label="Booking mix">
          <div className="card-header">
            <div>
              <h2>Booking Mix</h2>
              <p>Current confirmed and pending demand</p>
            </div>
          </div>
          <div className="analytics-bars">
            <div>
              <span>Confirmed</span>
              <i style={{ inlineSize: `${Math.max(confirmedBookings, 1) * 24}%` }} />
              <b>{confirmedBookings}</b>
            </div>
            <div>
              <span>Pending</span>
              <i style={{ inlineSize: `${Math.max(pendingBookings, 1) * 24}%` }} />
              <b>{pendingBookings}</b>
            </div>
          </div>
        </section>
        <section className="analytics-panel" aria-label="Top listings">
          <div className="card-header">
            <div>
              <h2>Top Listings</h2>
              <p>Booked experiences in recent activity</p>
            </div>
          </div>
          <div className="capacity-list">
            {overview.bookings.map((booking) => (
              <div className="capacity-row" key={booking.id ?? `${booking.name}-${booking.listing}`}>
                <div>
                  <strong>{booking.listing}</strong>
                  <span>{booking.name}</span>
                </div>
                <b>{booking.total}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function CreateListing({
  error,
  form,
  listingTab,
  onChange,
  onSubmit,
  saving,
  setListingTab,
}: {
  error: string | null;
  form: ListingDraftForm;
  listingTab: ListingTab;
  onChange: (next: ListingDraftForm) => void;
  onSubmit: () => void;
  saving: boolean;
  setListingTab: (tab: ListingTab) => void;
}) {
  const tabs: ListingTab[] = ["details", "pricing"];
  const previewListing = listingPreview(form);
  const update = (field: keyof ListingDraftForm, value: string) => onChange({ ...form, [field]: value });
  return (
    <>
      <div className="create-actions">
        <Button disabled={saving} onClick={onSubmit} variant="secondary" type="button">{saving ? "Saving Draft" : "Save Draft"}</Button>
      </div>
      {error && <p className="form-message" data-tone="error">{error}</p>}
      <div className="listing-tabs">
        {tabs.map((tab) => (
          <button key={tab} data-active={listingTab === tab} onClick={() => setListingTab(tab)} type="button">
            {tab}
          </button>
        ))}
      </div>
      <div className="create-grid">
        <Card className="form-panel">
          {listingTab === "details" && (
            <>
              <FormRow label="Listing Name"><Input onChange={(event) => update("title", event.currentTarget.value)} placeholder="e.g. Harbor Kayak Tour" value={form.title} /></FormRow>
              <FormRow label="Type"><Select onChange={(event) => update("category", event.currentTarget.value)} value={form.category}><option>Tour</option><option>Rental</option><option>Class</option><option>Event</option></Select></FormRow>
              <FormRow label="Duration"><Select onChange={(event) => update("durationMinutes", event.currentTarget.value)} value={form.durationMinutes}><option value="30">30 min</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option></Select></FormRow>
              <FormRow label="Description"><Textarea onChange={(event) => update("description", event.currentTarget.value)} placeholder="What should guests know before they book?" rows={4} value={form.description} /></FormRow>
              <FormRow label="Meeting Point"><Input onChange={(event) => update("meetingPoint", event.currentTarget.value)} placeholder="100 Harbor Way, Santa Cruz, CA 95060" value={form.meetingPoint} /></FormRow>
            </>
          )}
          {listingTab === "pricing" && (
            <>
              <FormRow label="Price per Adult"><Input inputMode="decimal" onChange={(event) => update("basePrice", event.currentTarget.value)} placeholder="$65.00" value={form.basePrice} /></FormRow>
              <FormRow label="Price per Child (optional)"><Input inputMode="decimal" onChange={(event) => update("childPrice", event.currentTarget.value)} placeholder="$45.00" value={form.childPrice} /></FormRow>
              <FormRow label="Min. guests"><Input inputMode="numeric" onChange={(event) => update("minGuests", event.currentTarget.value)} value={form.minGuests} /></FormRow>
              <FormRow label="Max. guests"><Input inputMode="numeric" onChange={(event) => update("maxGuests", event.currentTarget.value)} value={form.maxGuests} /></FormRow>
              <FormRow label="Capacity"><Input inputMode="numeric" onChange={(event) => update("capacity", event.currentTarget.value)} value={form.capacity} /></FormRow>
            </>
          )}
        </Card>
        <aside className="create-preview">
          <ListingCard listing={previewListing} />
          <EmptyState icon="◫" title="Draft only" body="Add availability rules before publishing this listing." />
        </aside>
      </div>
    </>
  );
}

function FormRow({ children, label }: { children: ReactNode; label: string }) {
  return <label className="form-row"><span>{label}</span>{children}</label>;
}

function listingDraftInput(form: ListingDraftForm): DashboardListingDraftInput {
  const title = form.title.trim();
  if (!title) throw new Error("Listing name is required.");
  const basePriceCents = parseCurrencyCents(form.basePrice, "Price per Adult");
  const childPriceCents = form.childPrice.trim() ? parseCurrencyCents(form.childPrice, "Price per Child") : undefined;
  const durationMinutes = parsePositiveInteger(form.durationMinutes, "Duration");
  const minGuests = parsePositiveInteger(form.minGuests, "Min. guests");
  const maxGuests = parsePositiveInteger(form.maxGuests, "Max. guests");
  const capacity = parsePositiveInteger(form.capacity, "Capacity");
  if (minGuests > maxGuests) throw new Error("Min. guests cannot be greater than max. guests.");
  if (maxGuests > capacity) throw new Error("Capacity must be at least the max. guests.");
  return {
    title,
    category: form.category,
    basePriceCents,
    ...(childPriceCents !== undefined ? { childPriceCents } : {}),
    durationMinutes,
    minGuests,
    maxGuests,
    capacity,
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    ...(form.meetingPoint.trim() ? { meetingPoint: form.meetingPoint.trim() } : {})
  };
}

function listingPreview(form: ListingDraftForm): DashboardOverview["listings"][number] {
  const durationMinutes = Number.parseInt(form.durationMinutes, 10);
  const capacity = Number.parseInt(form.capacity, 10);
  return {
    title: form.title.trim() || "Untitled draft",
    type: `${form.category} · ${Number.isFinite(durationMinutes) ? formatDurationLabel(durationMinutes) : "duration"}`,
    price: `${formatDraftPrice(form.basePrice)}/guest`,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 0,
    status: "draft"
  };
}

function parseCurrencyCents(value: string, label: string) {
  const cleaned = value.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`${label} must be a dollar amount.`);
  const [dollars = "0", cents = ""] = cleaned.split(".");
  return Number.parseInt(dollars, 10) * 100 + Number.parseInt(cents.padEnd(2, "0"), 10);
}

function parsePositiveInteger(value: string, label: string) {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number.`);
  const parsed = Number.parseInt(value, 10);
  if (parsed <= 0) throw new Error(`${label} must be greater than zero.`);
  return parsed;
}

function formatDraftPrice(value: string) {
  try {
    return `$${(parseCurrencyCents(value, "Price") / 100).toFixed(2)}`;
  } catch {
    return "$0.00";
  }
}

function formatDurationLabel(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} min`;
}

function BookingDetail({
  detail,
  status,
  summary
}: {
  detail: DashboardBookingDetail | null;
  status: BookingDetailStatus;
  summary: DashboardOverview["bookings"][number] | null;
}) {
  if (status === "loading") {
    return <EmptyState className="dashboard-empty" icon="◷" title="Loading booking" body="Fetching the selected booking." />;
  }
  if (status === "not-found") {
    return <EmptyState className="dashboard-empty" icon="◌" title="Booking unavailable" body="This booking is no longer available from the live API." />;
  }
  if (status === "error") {
    return <EmptyState className="dashboard-empty" icon="◌" title="Booking unavailable" body="The selected booking could not be loaded." />;
  }
  if (!detail) {
    return <EmptyState className="dashboard-empty" icon="◷" title="Select a booking" body="Open a booking from recent activity." />;
  }

  const guestBreakdown = [
    detail.adultCount ? `${detail.adultCount} adult${detail.adultCount === 1 ? "" : "s"}` : null,
    detail.childCount ? `${detail.childCount} child${detail.childCount === 1 ? "" : "ren"}` : null
  ].filter(Boolean).join(", ") || `${detail.guestCount} guest${detail.guestCount === 1 ? "" : "s"}`;
  const addOnRows = detail.addOns.length
    ? detail.addOns.map((addOn) => [`${addOn.addOn.name} x${addOn.quantity}`, centsToCurrency(addOn.totalCents)])
    : [["Add-ons", "None"]];

  return (
    <div className="detail-grid">
      <div className="detail-stack">
        <Card>
          <h2 className="panel-title">Guest</h2>
          <div className="guest-row">
            <span>{initials(detail.customerName)}</span>
            <div>
              <strong>{detail.customerName}</strong>
              <p>{detail.customerEmail}{detail.customerPhone ? ` · ${detail.customerPhone}` : ""}</p>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="panel-title">Experience</h2>
          <div className="info-grid">
            {[
              ["Listing", detail.listing.title],
              ["Date & Time", formatBookingDateTime(detail)],
              ["Duration", formatDuration(detail.listing.durationMinutes)],
              ["Guests", `${detail.guestCount} pax · ${guestBreakdown}`],
              ["Status", humanizeStatus(detail.status)],
              ["Meeting Point", detail.listing.meetingPoint ?? "Not set"],
            ].map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
          </div>
        </Card>
        <Card>
          <h2 className="panel-title">Guest Notes</h2>
          <p className="note">{detail.notes?.trim() || "No notes on this booking."}</p>
        </Card>
      </div>
      <Card className="payment-panel" padded={false}>
        <div className="payment-panel__inner">
          <h2 className="panel-title">Payment</h2>
          {[
            ["Subtotal", centsToCurrency(detail.subtotalCents)],
            ...addOnRows,
            ["Tax", centsToCurrency(detail.taxCents)],
            ["Platform fee", centsToCurrency(detail.platformFeeCents)],
            ["Processor fee", centsToCurrency(detail.processorFeeCents)],
            ["Payment status", humanizeStatus(detail.paymentStatus)],
            ["Payment provider", detail.paymentProvider ? humanizeStatus(detail.paymentProvider) : "Not recorded"]
          ].map(([k, v]) => <div className="pay-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}
          <div className="pay-row pay-row--total"><span>Total</span><strong>{centsToCurrency(detail.totalCents)}</strong></div>
        </div>
        <div className="payment-actions">
          <Badge status={summary?.status ?? bookingBadgeStatus(detail.status)}>{humanizeStatus(detail.status)}</Badge>
          <Button disabled type="button" variant="secondary">Reminder unavailable</Button>
          <Button disabled type="button" variant="danger">Cancellation unavailable</Button>
        </div>
      </Card>
    </div>
  );
}

function formatBookingDateTime(detail: Pick<DashboardBookingDetail, "bookingDate" | "startTime" | "endTime">) {
  const parsed = new Date(`${detail.bookingDate}T12:00:00`);
  const date = Number.isNaN(parsed.getTime())
    ? detail.bookingDate
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${date} · ${detail.startTime} - ${detail.endTime}`;
}

function formatDuration(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} min`;
}

function centsToCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(cents / 100);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "BK";
}

function humanizeStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function bookingBadgeStatus(status: string): DashboardOverview["bookings"][number]["status"] {
  if (status === "confirmed") return "confirmed";
  if (status === "pending_payment") return "pending";
  return "cancelled";
}

function EmbedSetup({ businessName, listing }: { businessName: string; listing: DashboardOverview["listings"][number] }) {
  const [theme, setTheme] = useState("light");
  return (
    <div className="embed-grid">
      <div className="detail-stack">
        <Card><h2 className="panel-title">Configuration</h2><FormRow label="Listing"><Select defaultValue="boot-hill"><option value="boot-hill">{listing.title}</option><option>Family Bundle</option></Select></FormRow><FormRow label="Theme"><div className="theme-picker">{["light", "dark", "auto"].map((t) => <button key={t} data-active={theme === t} onClick={() => setTheme(t)} type="button">{t}</button>)}</div></FormRow></Card>
        <Card><h2 className="panel-title">Embed Code</h2><pre className="code-block">{`<script\n  src="https://cdn.availo.io/widget.js"\n  data-key="ak_live_rdw_307016"\n  data-listing="boot-hill-tour"\n  data-theme="${theme}"\n></script>`}</pre><Button type="button">Copy Code</Button></Card>
      </div>
      <div><div className="preview-label">Widget Preview</div><div className="widget-preview"><div className="browser-label">yourwebsite.com — embedded widget</div><BookingWidget businessName={businessName} listing={listing} /></div></div>
    </div>
  );
}

function BookingWidget({ businessName, listing }: { businessName: string; listing: DashboardOverview["listings"][number] }) {
  return (
    <Card className="mock-widget" padded={false}>
      <div className="mock-widget__head"><div><strong>{listing.title}</strong><span>{businessName} · 1 hour · from $28</span></div><i /></div>
      <div className="mock-widget__body"><p>Select Date</p><div className="chip-row">{[5, 6, 7, 9].map((d) => <span data-active={d === 7} key={d}>May {d}</span>)}</div><p>Time</p><div className="chip-row"><span>9:30 AM</span><span data-soft="true">11:00 AM</span><span>12:30 PM</span></div><Button type="button">Next: Guests →</Button></div>
    </Card>
  );
}
