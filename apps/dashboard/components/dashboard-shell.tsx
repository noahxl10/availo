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
  DashboardLoginRejectedError,
  DashboardRateLimitedError,
  fetchDashboardBookingDetail,
  emptyOverview,
  fallbackOverview,
  fetchDashboardOverview,
  loginDashboardSession,
  type DashboardBookingDetail,
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

type Screen = "dashboard" | "listings" | "create" | "booking" | "availability" | "customers" | "embed" | "analytics";
type ListingTab = "details" | "pricing" | "availability" | "add-ons";
type ApiStatus = "loading" | "live" | "auth" | "error" | "unsupported";
type BookingDetailStatus = "idle" | "loading" | "live" | "not-found" | "error";

const addonPrices = [28, 17, 0] as const;

function navIdToScreen(id: string): Screen | null {
  if (id === "dashboard") return "dashboard";
  if (id === "listings") return "listings";
  if (id === "bookings") return "booking";
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
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const bookingRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    initializeDashboardSessionChannel();
    const unsubscribe = subscribeDashboardSession((session) => {
      if (!active) return;
      if (session) {
        setOperator(session.user);
        return;
      }
      setOperator(null);
      setOverview(emptyOverview);
      bookingRequestIdRef.current += 1;
      setSelectedBookingId(null);
      setBookingDetail(null);
      setBookingDetailStatus("idle");
      setApiStatus("auth");
    });
    if (!supportsDashboardSessionCoordination()) {
      setApiStatus("unsupported");
      return () => {
        active = false;
        unsubscribe();
      };
    }

    restoreDashboardSession()
      .then((session) => loadOverviewWithOneRefresh(session.accessToken))
      .then(({ session, nextOverview }) => {
        if (!active) return;
        setOperator(session.user);
        setOverview(nextOverview);
        setApiStatus("live");
      })
      .catch((error: unknown) => {
        if (!active) return;
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
    try {
      if (!supportsDashboardSessionCoordination()) throw new DashboardSessionCoordinationError();
      const session = await loginDashboardSession(input);
      setMemoryDashboardSession(session);
      const loaded = await loadOverviewWithOneRefresh(session.accessToken);
      setOperator(loaded.session.user);
      const { nextOverview } = loaded;
      setOverview(nextOverview);
      setApiStatus("live");
    } catch (error) {
      setOverview(emptyOverview);
      setOperator(null);
      bookingRequestIdRef.current += 1;
      setSelectedBookingId(null);
      setBookingDetail(null);
      setBookingDetailStatus("idle");
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
      setOperator(null);
      setOverview(emptyOverview);
      bookingRequestIdRef.current += 1;
      setSelectedBookingId(null);
      setBookingDetail(null);
      setBookingDetailStatus("idle");
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
              data-active={activeNav === navIdToScreen(item.id)}
              key={item.id}
              onClick={() => setActiveNav(navIdToScreen(item.id) ?? "dashboard")}
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
        {apiStatus === "live" && activeNav === "dashboard" && <DashboardOverview overview={overview} onBooking={handleBookingSelect} />}
        {apiStatus === "live" && activeNav === "listings" && <ListingsManager listings={overview.listings} onCreate={() => setActiveNav("create")} />}
        {apiStatus === "live" && activeNav === "create" && <CreateListing listingTab={listingTab} listings={overview.listings} setListingTab={setListingTab} />}
        {apiStatus === "live" && activeNav === "booking" && <BookingDetail detail={bookingDetail} status={bookingDetailStatus} summary={selectedBookingSummary} />}
        {apiStatus === "live" && activeNav === "availability" && <AvailabilityManager overview={overview} />}
        {apiStatus === "live" && activeNav === "customers" && <CustomersManager bookings={overview.bookings} />}
        {apiStatus === "live" && activeNav === "embed" && <EmbedSetup businessName={businessName} listing={primaryListing} />}
        {apiStatus === "live" && activeNav === "analytics" && <AnalyticsManager overview={overview} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileNavItems.map((item) => (
          <button
            data-active={activeNav === navIdToScreen(item.id)}
            key={item.id}
            onClick={() => setActiveNav(navIdToScreen(item.id) ?? "dashboard")}
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

function DashboardOverview({
  onBooking,
  overview
}: {
  onBooking: (booking: DashboardOverview["bookings"][number]) => void;
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
        <RecentBookings bookings={overview.bookings} onBooking={onBooking} />
        <MiniCalendar bookedDates={overview.bookedDates} fullDates={overview.fullDates} />
      </section>
      <ListingGrid listings={overview.listings} />
    </>
  );
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

function RecentBookings({ bookings, onBooking }: { bookings: DashboardOverview["bookings"]; onBooking: (booking: DashboardOverview["bookings"][number]) => void }) {
  return (
    <Card className="recent-bookings" padded={false}>
      <div className="card-header">
        <div>
          <h2>Recent Bookings</h2>
          <p>Latest activity from the live API</p>
        </div>
        <button className="text-action" type="button">
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

function ListingsManager({ listings, onCreate }: { listings: DashboardOverview["listings"]; onCreate: () => void }) {
  return (
    <>
      <div className="listings-toolbar">
        <div className="listing-search">
          <span aria-hidden="true">⊕</span>
          <Input placeholder="Search listings..." />
        </div>
        <Button onClick={onCreate} type="button">+ New Listing</Button>
      </div>
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
  listingTab,
  listings,
  setListingTab,
}: {
  listingTab: ListingTab;
  listings: DashboardOverview["listings"];
  setListingTab: (tab: ListingTab) => void;
}) {
  const tabs: ListingTab[] = ["details", "pricing", "availability", "add-ons"];
  return (
    <>
      <div className="create-actions">
        <Button variant="secondary" type="button">Save Draft</Button>
        <Button type="button">Publish Listing</Button>
      </div>
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
              <FormRow label="Listing Name"><Input defaultValue="Harbor Kayak Tour" placeholder="e.g. Harbor Kayak Tour" /></FormRow>
              <FormRow label="Type"><Select defaultValue="Tour"><option>Tour</option><option>Rental</option><option>Class</option><option>Event</option></Select></FormRow>
              <FormRow label="Duration"><Select defaultValue="1 hour"><option>30 min</option><option>1 hour</option><option>2 hours</option><option>4 hours</option></Select></FormRow>
              <FormRow label="Description"><Textarea defaultValue="A one hour guided harbor paddle with beginner-friendly instruction and local shoreline highlights." rows={4} /></FormRow>
              <FormRow label="Meeting Point"><Input defaultValue="100 Harbor Way, Santa Cruz, CA 95060" /></FormRow>
            </>
          )}
          {listingTab === "pricing" && (
            <>
              <FormRow label="Price per Adult"><Input defaultValue="$65.00" /></FormRow>
              <FormRow label="Price per Child (optional)"><Input defaultValue="$45.00" /></FormRow>
              <FormRow label="Min. guests"><Input defaultValue="1" /></FormRow>
              <FormRow label="Max. guests"><Input defaultValue="12" /></FormRow>
            </>
          )}
          {listingTab === "availability" && <MiniCalendar bookedDates={fallbackOverview.bookedDates} fullDates={fallbackOverview.fullDates} />}
          {listingTab === "add-ons" && <AddOnsPanel />}
        </Card>
        <aside className="create-preview">
          <ListingCard listing={listings[0] ?? fallbackOverview.listings[0]!} />
          <EmptyState icon="◫" title="No bookings yet" body="Your listing isn't published. Publish to start receiving bookings." />
        </aside>
      </div>
    </>
  );
}

function FormRow({ children, label }: { children: ReactNode; label: string }) {
  return <label className="form-row"><span>{label}</span>{children}</label>;
}

function AddOnsPanel() {
  return (
    <div className="addons-panel">
      {["Adult", "Child", "Free Child"].map((name, index) => (
        <button className="addon-row" data-active={index === 0} key={name} type="button">
          <span className="addon-row__icon">◧</span>
          <span><strong>{name}</strong><small>{index === 0 ? "Ages 13+" : index === 1 ? "Ages 6 - 12" : "5 yrs and under"}</small></span>
          <b>+${addonPrices[index]}</b>
        </button>
      ))}
    </div>
  );
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

function bookingBadgeStatus(status: string): DashboardOverview["bookings"][number]["status"] {
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
