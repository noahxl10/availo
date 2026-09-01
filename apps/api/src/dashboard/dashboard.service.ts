import { Inject, Injectable } from "@nestjs/common";
import type { BookingStatus, ListingStatus } from "@prisma/client";
import { centsToCurrency } from "../common/money.js";
import { DEMO_BUSINESS_ID } from "../common/tenant.js";
import { PrismaService } from "../prisma/prisma.service.js";

const statusMap: Record<ListingStatus, "active" | "draft" | "pending"> = {
  active: "active",
  draft: "draft",
  paused: "pending",
  archived: "pending"
};

const bookingStatusMap: Record<BookingStatus, "confirmed" | "pending" | "cancelled"> = {
  confirmed: "confirmed",
  pending_payment: "pending",
  canceled: "cancelled",
  refunded: "cancelled",
  partially_refunded: "cancelled",
  failed: "cancelled"
};

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview() {
    const [business, listings, bookings] = await Promise.all([
      this.prisma.business.findUniqueOrThrow({ where: { id: DEMO_BUSINESS_ID } }),
      this.prisma.listing.findMany({
        where: { businessId: DEMO_BUSINESS_ID, status: { not: "archived" } },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.booking.findMany({
        where: { businessId: DEMO_BUSINESS_ID },
        include: { listing: true },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    const monthRevenue = bookings
      .filter((booking) => booking.status === "confirmed")
      .reduce((sum, booking) => sum + booking.totalCents, 0);
    const upcoming = bookings.filter((booking) => booking.status === "confirmed" || booking.status === "pending_payment").length;
    const guestAverage = bookings.length
      ? (bookings.reduce((sum, booking) => sum + booking.guestCount, 0) / bookings.length).toFixed(1)
      : "0";

    return {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        timezone: business.timezone
      },
      stats: [
        { label: "Bookings this month", value: String(bookings.length), delta: "12%", sub: "vs last month" },
        { label: "Revenue this month", value: centsToCurrency(monthRevenue), delta: "8.4%", sub: "vs last month" },
        { label: "Upcoming", value: String(upcoming), sub: "next in 4h" },
        { label: "Avg. party size", value: guestAverage, delta: "0.4", sub: "vs last month" }
      ],
      listings: listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        type: `${listing.category ?? "Experience"} · ${formatDuration(listing.durationMinutes)}`,
        price: `${centsToCurrency(listing.basePriceCents)}${listing.pricingType === "per_booking" ? "/group" : "/guest"}`,
        capacity: listing.capacity,
        status: statusMap[listing.status],
        ...(listing.status === "paused" ? { statusLabel: "paused" } : {})
      })),
      bookings: bookings.map((booking) => ({
        id: booking.id,
        initials: initials(booking.customerName),
        name: booking.customerName,
        listing: booking.listing.title,
        date: formatBookingDate(booking.bookingDate, booking.startTime),
        guests: booking.guestCount,
        total: centsToCurrency(booking.totalCents),
        status: bookingStatusMap[booking.status]
      })),
      bookedDates: uniqueDays(bookings),
      fullDates: await this.fullDates()
    };
  }

  private async fullDates() {
    const rows = await this.prisma.booking.groupBy({
      by: ["bookingDate"],
      where: { businessId: DEMO_BUSINESS_ID, status: "confirmed" },
      _sum: { guestCount: true }
    });
    const listings = await this.prisma.listing.findMany({ where: { businessId: DEMO_BUSINESS_ID }, select: { capacity: true } });
    const maxCapacity = Math.max(...listings.map((listing) => listing.capacity), 1);
    return rows.filter((row) => (row._sum.guestCount ?? 0) >= maxCapacity).map((row) => Number(row.bookingDate.slice(-2)));
  }
}

function formatDuration(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} min`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatBookingDate(date: string, time: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return `${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

function uniqueDays(bookings: { bookingDate: string }[]) {
  return [...new Set(bookings.map((booking) => Number(booking.bookingDate.slice(-2))))].sort((a, b) => a - b);
}
