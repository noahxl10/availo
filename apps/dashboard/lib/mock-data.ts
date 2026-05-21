import type { BadgeStatus } from "@availo/ui";

export type NavItem = {
  id: string;
  icon: string;
  label: string;
};

export type Stat = {
  label: string;
  value: string;
  delta?: string;
  sub: string;
};

export type Booking = {
  initials: string;
  name: string;
  listing: string;
  date: string;
  guests: number;
  total: string;
  status: Extract<BadgeStatus, "confirmed" | "pending">;
};

export type Listing = {
  title: string;
  type: string;
  price: string;
  capacity: number;
  status: Extract<BadgeStatus, "active" | "draft" | "pending">;
  statusLabel?: string;
};

export const navItems: NavItem[] = [
  { id: "dashboard", icon: "⊡", label: "Dashboard" },
  { id: "listings", icon: "◫", label: "Listings" },
  { id: "bookings", icon: "◷", label: "Bookings" },
  { id: "availability", icon: "▦", label: "Availability" },
  { id: "customers", icon: "◉", label: "Customers" },
  { id: "embed", icon: "◈", label: "Embed" },
  { id: "analytics", icon: "◰", label: "Analytics" },
];

export const bottomNavItems: NavItem[] = [
  { id: "settings", icon: "◎", label: "Settings" },
  { id: "help", icon: "◌", label: "Help" },
];

export const mobileNavItems: NavItem[] = [
  { id: "dashboard", icon: "⊡", label: "Home" },
  { id: "listings", icon: "◫", label: "Listings" },
  { id: "bookings", icon: "◷", label: "Bookings" },
  { id: "settings", icon: "◎", label: "Settings" },
];

export const stats: Stat[] = [
  { label: "Bookings this month", value: "4", delta: "44%", sub: "vs same time last year" },
  { label: "Revenue this month", value: "$493.68", delta: "8.5%", sub: "tax included" },
  { label: "Upcoming", value: "4", sub: "next at 9:30 AM" },
  { label: "Avg. party size", value: "1.8", delta: "7 pax", sub: "total pax" },
];

export const bookings: Booking[] = [
  {
    initials: "AR",
    name: "Alex Rivera",
    listing: "Harbor Kayak Tour",
    date: "May 5 · 9:30 AM",
    guests: 2,
    total: "$141.05",
    status: "confirmed",
  },
  {
    initials: "ML",
    name: "Morgan Lee",
    listing: "Harbor Kayak Tour",
    date: "May 4 · 12:30 PM",
    guests: 2,
    total: "$141.05",
    status: "confirmed",
  },
  {
    initials: "CN",
    name: "Casey Nguyen",
    listing: "Harbor Kayak Tour",
    date: "May 2 · 3:30 PM",
    guests: 2,
    total: "$141.05",
    status: "confirmed",
  },
  {
    initials: "JP",
    name: "Jordan Patel",
    listing: "Harbor Kayak Tour",
    date: "Mar 2 · 11:00 AM",
    guests: 1,
    total: "$70.53",
    status: "confirmed",
  },
];

export const listings: Listing[] = [
  {
    title: "Harbor Kayak Tour",
    type: "Tour · 1 hour",
    price: "$65/guest",
    capacity: 12,
    status: "active",
  },
  {
    title: "Private Group Paddle",
    type: "Private · 1 hour",
    price: "$0/guest",
    capacity: 12,
    status: "pending",
    statusLabel: "paused",
  },
];

export const bookedDates = [2, 4, 5];
export const fullDates: number[] = [];
