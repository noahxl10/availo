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
  { label: "Bookings this month", value: "84", delta: "12%", sub: "vs last month" },
  { label: "Revenue this month", value: "$6,240", delta: "8.4%", sub: "vs last month" },
  { label: "Upcoming", value: "23", sub: "next in 4h" },
  { label: "Avg. party size", value: "3.2", delta: "0.4", sub: "vs last month" },
];

export const bookings: Booking[] = [
  {
    initials: "LM",
    name: "Lena Marsh",
    listing: "Morning Kayak Tour",
    date: "May 8 · 9:00 AM",
    guests: 3,
    total: "$195",
    status: "confirmed",
  },
  {
    initials: "RJ",
    name: "Ray Johansson",
    listing: "Sunset Paddleboard",
    date: "May 8 · 5:30 PM",
    guests: 2,
    total: "$130",
    status: "confirmed",
  },
  {
    initials: "DC",
    name: "Dana Cruz",
    listing: "Full-Day Sea Cave Tour",
    date: "May 9 · 8:00 AM",
    guests: 6,
    total: "$540",
    status: "pending",
  },
  {
    initials: "MO",
    name: "Mikael Osei",
    listing: "Snorkel Adventure",
    date: "May 10 · 10:00 AM",
    guests: 4,
    total: "$280",
    status: "confirmed",
  },
];

export const listings: Listing[] = [
  {
    title: "Morning Kayak Tour",
    type: "Tour · 2 hours",
    price: "$65/guest",
    capacity: 8,
    status: "active",
  },
  {
    title: "Sunset Paddleboard",
    type: "Rental · 1.5 hours",
    price: "$45/guest",
    capacity: 6,
    status: "active",
  },
  {
    title: "Junior Ocean Class",
    type: "Class · 1 hour",
    price: "$35/guest",
    capacity: 8,
    status: "draft",
  },
  {
    title: "Full-Day Sea Cave Tour",
    type: "Tour · 8 hours",
    price: "$120/guest",
    capacity: 10,
    status: "active",
  },
  {
    title: "Snorkel Adventure",
    type: "Tour · 3 hours",
    price: "$70/guest",
    capacity: 12,
    status: "active",
  },
  {
    title: "Corporate Team Paddle",
    type: "Event · 4 hours",
    price: "$200/group",
    capacity: 20,
    status: "pending",
    statusLabel: "paused",
  },
];

export const bookedDates = [1, 2, 6, 7, 8, 9, 14, 15, 16, 22, 23, 29];
export const fullDates = [8, 15];
