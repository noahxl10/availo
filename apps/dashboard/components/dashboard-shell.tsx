"use client";

import { useState, type ReactNode } from "react";
import { Badge, BrandLockup, Button, Card, EmptyState, Input, Select, StatCard, Textarea } from "@availo/ui";
import {
  bookedDates,
  bookings,
  bottomNavItems,
  fullDates,
  listings,
  mobileNavItems,
  navItems,
  stats,
} from "../lib/mock-data";

type Screen = "dashboard" | "listings" | "create" | "booking" | "embed";
type ListingTab = "details" | "pricing" | "availability" | "add-ons";

const addonPrices = [15, 35, 75] as const;

function navIdToScreen(id: string): Screen | null {
  if (id === "dashboard") return "dashboard";
  if (id === "listings") return "listings";
  if (id === "bookings") return "booking";
  if (id === "embed") return "embed";
  return null;
}

export function DashboardShell() {
  const [activeNav, setActiveNav] = useState<Screen>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [listingTab, setListingTab] = useState<ListingTab>("details");
  const pageTitle = {
    dashboard: "Good morning, Jamie",
    listings: "Listings",
    create: "New Listing",
    booking: "#BK-20485",
    embed: "Embed Widget",
  }[activeNav];
  const pageSubtitle = {
    dashboard: "Friday, May 1, 2026 · Ocean Tours Co.",
    listings: "6 listings · 4 active",
    create: "Create or edit the customer-facing booking experience.",
    booking: "Morning Kayak Tour · May 8, 2026 · 9:00 AM",
    embed: "Add a booking widget to any website in under 5 minutes.",
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
            <div className="dashboard-user__avatar">JM</div>
            <div className="dashboard-user__copy">
              <div>Jamie Miller</div>
              <span>Ocean Tours Co.</span>
            </div>
          </div>

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
        </header>

        {activeNav === "dashboard" && <DashboardOverview onBooking={() => setActiveNav("booking")} />}
        {activeNav === "listings" && <ListingsManager onCreate={() => setActiveNav("create")} />}
        {activeNav === "create" && <CreateListing listingTab={listingTab} setListingTab={setListingTab} />}
        {activeNav === "booking" && <BookingDetail />}
        {activeNav === "embed" && <EmbedSetup />}
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

function DashboardOverview({ onBooking }: { onBooking: () => void }) {
  return (
    <>
      <section className="stat-grid" aria-label="Dashboard metrics">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} {...(stat.delta ? { delta: stat.delta } : {})} />
        ))}
      </section>
      <section className="workspace-grid">
        <RecentBookings onBooking={onBooking} />
        <MiniCalendar />
      </section>
      <ListingGrid />
    </>
  );
}

function RecentBookings({ onBooking }: { onBooking: () => void }) {
  return (
    <Card className="recent-bookings" padded={false}>
      <div className="card-header">
        <div>
          <h2>Recent Bookings</h2>
          <p>Mock activity for dashboard layout</p>
        </div>
        <button className="text-action" type="button">
          View all →
        </button>
      </div>
      <div className="booking-list">
        {bookings.map((booking) => (
          <button className="booking-row" key={booking.name} onClick={onBooking} type="button">
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

function MiniCalendar() {
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

function ListingGrid() {
  return (
    <section className="listing-grid" aria-label="Listings">
      {listings.slice(0, 3).map((listing) => <ListingCard key={listing.title} listing={listing} />)}
    </section>
  );
}

function ListingCard({ listing }: { listing: (typeof listings)[number] }) {
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

function ListingsManager({ onCreate }: { onCreate: () => void }) {
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

function CreateListing({ listingTab, setListingTab }: { listingTab: ListingTab; setListingTab: (tab: ListingTab) => void }) {
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
              <FormRow label="Listing Name"><Input defaultValue="Morning Kayak Tour" placeholder="e.g. Morning Kayak Tour" /></FormRow>
              <FormRow label="Type"><Select defaultValue="Tour"><option>Tour</option><option>Rental</option><option>Class</option><option>Event</option></Select></FormRow>
              <FormRow label="Duration"><Select defaultValue="2 hours"><option>30 min</option><option>1 hour</option><option>2 hours</option><option>4 hours</option></Select></FormRow>
              <FormRow label="Description"><Textarea defaultValue="A guided 2-hour morning kayak tour along the Pacific Coast. Suitable for beginners. All equipment provided." rows={4} /></FormRow>
              <FormRow label="Meeting Point"><Input defaultValue="Main Beach Pier, Slip 4, Santa Cruz" /></FormRow>
            </>
          )}
          {listingTab === "pricing" && (
            <>
              <FormRow label="Price per Adult"><Input defaultValue="$65.00" /></FormRow>
              <FormRow label="Price per Child (optional)"><Input defaultValue="$45.00" /></FormRow>
              <FormRow label="Min. guests"><Input defaultValue="1" /></FormRow>
              <FormRow label="Max. guests"><Input defaultValue="8" /></FormRow>
            </>
          )}
          {listingTab === "availability" && <MiniCalendar />}
          {listingTab === "add-ons" && <AddOnsPanel />}
        </Card>
        <aside className="create-preview">
          <ListingCard listing={listings[0]!} />
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
      {["Wetsuit Rental", "Photo Package", "Private Guide"].map((name, index) => (
        <button className="addon-row" data-active={index === 0} key={name} type="button">
          <span className="addon-row__icon">◧</span>
          <span><strong>{name}</strong><small>{index === 0 ? "Full suit included" : "Optional upgrade"}</small></span>
          <b>+${addonPrices[index]}</b>
        </button>
      ))}
    </div>
  );
}

function BookingDetail() {
  return (
    <div className="detail-grid">
      <div className="detail-stack">
        <Card>
          <h2 className="panel-title">Guest</h2>
          <div className="guest-row"><span>LM</span><div><strong>Lena Marsh</strong><p>lena.marsh@gmail.com · +1 (555) 847-2291</p></div></div>
        </Card>
        <Card>
          <h2 className="panel-title">Experience</h2>
          <div className="info-grid">
            {[
              ["Listing", "Morning Kayak Tour"],
              ["Date & Time", "May 8, 2026 · 9:00 AM"],
              ["Duration", "2 hours"],
              ["Guests", "3 (2 adults, 1 child)"],
              ["Add-ons", "Wetsuit ×3, Photos ×1"],
              ["Meeting Point", "Main Beach Pier, Slip 4"],
            ].map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
          </div>
        </Card>
        <Card><h2 className="panel-title">Guest Notes</h2><p className="note">"One child is 7 years old. Hoping for calm water conditions. First time kayaking for the group."</p></Card>
      </div>
      <Card className="payment-panel" padded={false}>
        <div className="payment-panel__inner">
          <h2 className="panel-title">Payment</h2>
          {[["2× Adult ($65)", "$130.00"], ["1× Child ($45)", "$45.00"], ["Wetsuit ×3", "$45.00"], ["Photos ×1", "$35.00"], ["Fee", "$5.50"]].map(([k, v]) => <div className="pay-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}
          <div className="pay-row pay-row--total"><span>Total</span><strong>$260.50</strong></div>
        </div>
        <div className="payment-actions"><Button type="button">Send Reminder</Button><Button variant="danger" type="button">Cancel Booking</Button></div>
      </Card>
    </div>
  );
}

function EmbedSetup() {
  const [theme, setTheme] = useState("light");
  return (
    <div className="embed-grid">
      <div className="detail-stack">
        <Card><h2 className="panel-title">Configuration</h2><FormRow label="Listing"><Select defaultValue="kayak"><option value="kayak">Morning Kayak Tour</option><option>Sunset Paddleboard</option></Select></FormRow><FormRow label="Theme"><div className="theme-picker">{["light", "dark", "auto"].map((t) => <button key={t} data-active={theme === t} onClick={() => setTheme(t)} type="button">{t}</button>)}</div></FormRow></Card>
        <Card><h2 className="panel-title">Embed Code</h2><pre className="code-block">{`<script\n  src="https://cdn.availo.io/widget.js"\n  data-key="ak_live_oce_2a9f3b"\n  data-listing="kayak-morning-tour"\n  data-theme="${theme}"\n></script>`}</pre><Button type="button">Copy Code</Button></Card>
      </div>
      <div><div className="preview-label">Widget Preview</div><div className="widget-preview"><div className="browser-label">yourwebsite.com — embedded widget</div><BookingWidget /></div></div>
    </div>
  );
}

function BookingWidget() {
  return (
    <Card className="mock-widget" padded={false}>
      <div className="mock-widget__head"><div><strong>Morning Kayak Tour</strong><span>Ocean Tours Co. · 2 hours · from $65</span></div><i /></div>
      <div className="mock-widget__body"><p>Select Date</p><div className="chip-row">{[7, 8, 9, 12].map((d) => <span data-active={d === 8} key={d}>May {d}</span>)}</div><p>Time</p><div className="chip-row"><span>8:00 AM</span><span data-soft="true">9:00 AM</span><span>11:00 AM</span></div><Button type="button">Next: Guests →</Button></div>
    </Card>
  );
}
