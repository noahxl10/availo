import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { platformFeeCents } from "../common/money.js";
import { PrismaService } from "../prisma/prisma.service.js";

const quoteInput = z.object({
  listingId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(1),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  addOns: z.array(z.object({ id: z.string(), quantity: z.number().int().positive() })).default([])
});

const checkoutInput = quoteInput.extend({
  holdId: z.string().min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional()
  })
});

const widgetInput = z.object({
  listingId: z.string().min(1).optional(),
  businessSlug: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(7).default(7)
}).refine((input) => Boolean(input.listingId || input.businessSlug), "listingId or businessSlug is required");

@Injectable()
export class PublicService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async businessListings(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException("Business not found");
    const listings = await this.prisma.listing.findMany({
      where: { businessId: business.id, status: "active" },
      select: publicListingSelect(),
      orderBy: { createdAt: "asc" }
    });
    return { business: publicBusiness(business), listings };
  }

  async listing(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, status: "active" },
      include: { business: true, addOns: { where: { status: "active" } } }
    });
    if (!listing) throw new NotFoundException("Listing not found");
    return {
      ...publicListing(listing),
      business: publicBusiness(listing.business),
      addOns: listing.addOns.map((addOn) => ({
        id: addOn.id,
        listingId: addOn.listingId,
        name: addOn.name,
        description: addOn.description,
        priceCents: addOn.priceCents,
        pricingType: addOn.pricingType
      }))
    };
  }

  async availability(id: string, date: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, status: "active" },
      include: { rules: true, exceptions: true, bookings: { where: { bookingDate: date, status: { in: ["confirmed", "pending_payment"] } } } }
    });
    if (!listing) throw new NotFoundException("Listing not found");

    const exception = listing.exceptions.find((item) => item.date === date);
    if (exception?.isClosed) return { date, slots: [] };

    const day = new Date(`${date}T12:00:00`).getDay();
    const rules = listing.rules.filter((rule) => rule.dayOfWeek === day);
    const activeHolds = await this.prisma.bookingHold.findMany({
      where: { listingId: id, bookingDate: date, expiresAt: { gt: new Date() } }
    });
    const slots = rules.flatMap((rule) => generateSlots(rule.startTime, rule.endTime, rule.slotIntervalMinutes)).map((time) => {
      const booked = listing.bookings.filter((booking) => booking.startTime === time).reduce((sum, booking) => sum + booking.guestCount, 0);
      const held = activeHolds.filter((hold) => hold.startTime === time).reduce((sum, hold) => sum + hold.guestCount, 0);
      const capacity = exception?.customCapacity ?? listing.capacity;
      return { id: `${id}_${date}_${time}`, listingId: id, date, startTime: time, capacityRemaining: Math.max(capacity - booked - held, 0) };
    });
    return { date, slots };
  }

  async widget(body: unknown) {
    const input = parse(widgetInput, body);
    let listing;
    if (input.listingId) {
      listing = await this.prisma.listing.findFirst({
        where: {
          id: input.listingId,
          status: "active",
          ...(input.businessSlug ? { business: { is: { slug: input.businessSlug } } } : {})
        },
        include: { business: true, addOns: { where: { status: "active" } } }
      });
    } else {
      if (!input.businessSlug) throw new BadRequestException("listingId or businessSlug is required");
      listing = await this.prisma.listing.findFirst({
        where: { status: "active", business: { is: { slug: input.businessSlug } } },
        include: { business: true, addOns: { where: { status: "active" } } },
        orderBy: { createdAt: "asc" }
      });
    }
    if (!listing) throw new NotFoundException("Listing not found");

    const availability = [];
    for (let offset = 0; offset < input.days; offset += 1) {
      const date = isoDateAfterDays(offset);
      const day = await this.availability(listing.id, date);
      availability.push({
        date,
        slots: day.slots.map((slot) => ({
          startTime: slot.startTime,
          available: slot.capacityRemaining > 0
        }))
      });
    }

    return {
      listing: {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        basePriceCents: listing.basePriceCents,
        childPriceCents: listing.childPriceCents,
        durationMinutes: listing.durationMinutes,
        minGuests: listing.minGuests,
        maxGuests: listing.maxGuests,
        meetingPoint: listing.meetingPoint,
        business: {
          name: listing.business.name,
          slug: listing.business.slug,
          currency: listing.business.currency
        },
        addOns: listing.addOns.map((addOn) => ({
          id: addOn.id,
          name: addOn.name,
          description: addOn.description,
          priceCents: addOn.priceCents,
          minQuantity: addOn.minQuantity,
          maxQuantity: addOn.maxQuantity
        }))
      },
      availability
    };
  }

  async quote(body: unknown) {
    const input = parse(quoteInput, body);
    const listing = await this.prisma.listing.findFirst({
      where: { id: input.listingId, status: "active" },
      include: { business: true, addOns: { where: { status: "active" } } }
    });
    if (!listing) throw new NotFoundException("Listing not found");
    const guestCount = input.adults + input.children;
    if (guestCount < listing.minGuests || guestCount > listing.maxGuests) throw new BadRequestException("Guest count outside listing limits");

    const availability = await this.availability(input.listingId, input.date);
    const slot = availability.slots.find((item) => item.startTime === input.startTime);
    if (!slot || slot.capacityRemaining < guestCount) throw new BadRequestException("Selected slot is unavailable");

    const { subtotalCents, addOns } = subtotal(listing, input);
    const taxCents = Math.round(subtotalCents * (listing.business.taxRateBps / 10000));
    const feeCents = platformFeeCents(subtotalCents);
    const quote = {
      listingId: input.listingId,
      bookingDate: input.date,
      startTime: input.startTime,
      guestCount,
      adultCount: input.adults,
      childCount: input.children,
      subtotalCents,
      taxCents,
      platformFeeCents: feeCents,
      processorFeeCents: 0,
      totalCents: subtotalCents + taxCents + feeCents,
      addOns
    };

    const hold = await this.prisma.bookingHold.create({
      data: {
        id: prefixedId("hold"),
        businessId: listing.businessId,
        listingId: listing.id,
        bookingDate: input.date,
        startTime: input.startTime,
        guestCount,
        quoteJson: JSON.stringify(quote),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });
    return { holdId: hold.id, expiresAt: hold.expiresAt.toISOString(), quote };
  }

  async checkout(body: unknown) {
    const input = parse(checkoutInput, body);
    const now = new Date();
    const hold = await this.prisma.bookingHold.findUnique({ where: { id: input.holdId } });
    if (!hold || hold.expiresAt <= now) throw new BadRequestException("Hold is invalid or expired");
    const quote = JSON.parse(hold.quoteJson) as {
      listingId: string;
      bookingDate: string;
      startTime: string;
      guestCount: number;
      adultCount: number;
      childCount: number;
      subtotalCents: number;
      taxCents: number;
      platformFeeCents: number;
      processorFeeCents: number;
      totalCents: number;
      addOns?: { id: string; quantity: number; priceCents: number; totalCents: number }[];
    };
    if (
      quote.listingId !== input.listingId ||
      quote.bookingDate !== input.date ||
      quote.startTime !== input.startTime ||
      quote.adultCount !== input.adults ||
      quote.childCount !== input.children ||
      JSON.stringify((quote.addOns ?? []).map((item) => ({ id: item.id, quantity: item.quantity }))) !== JSON.stringify(input.addOns)
    ) {
      throw new BadRequestException("Checkout input does not match the quoted hold");
    }
    const listing = await this.prisma.listing.findFirstOrThrow({ where: { id: hold.listingId, status: "active" } });
    const booking = await this.prisma.$transaction(async (tx) => {
      const [heldGuestCount, bookedGuestCount, exception] = await Promise.all([
        tx.bookingHold.aggregate({
          where: { listingId: hold.listingId, bookingDate: hold.bookingDate, startTime: hold.startTime, id: { not: hold.id }, expiresAt: { gt: now } },
          _sum: { guestCount: true }
        }),
        tx.booking.aggregate({
          where: { listingId: hold.listingId, bookingDate: hold.bookingDate, startTime: hold.startTime, status: { in: ["confirmed", "pending_payment"] } },
          _sum: { guestCount: true }
        }),
        tx.availabilityException.findUnique({ where: { listingId_date: { listingId: hold.listingId, date: hold.bookingDate } } })
      ]);
      const capacity = exception?.customCapacity ?? listing.capacity;
      if (capacity - (heldGuestCount._sum.guestCount ?? 0) - (bookedGuestCount._sum.guestCount ?? 0) < hold.guestCount) {
        throw new BadRequestException("Selected slot is unavailable");
      }
      const created = await tx.booking.create({
        data: {
          id: prefixedId("bok"),
          businessId: hold.businessId,
          listingId: hold.listingId,
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone ?? null,
          bookingDate: hold.bookingDate,
          startTime: hold.startTime,
          endTime: addMinutes(hold.startTime, listing.durationMinutes),
          guestCount: hold.guestCount,
          adultCount: quote.adultCount,
          childCount: quote.childCount,
          status: "pending_payment",
          paymentStatus: "pending",
          paymentReferenceId: `mock_${input.holdId}`,
          subtotalCents: quote.subtotalCents,
          taxCents: quote.taxCents,
          platformFeeCents: quote.platformFeeCents,
          processorFeeCents: quote.processorFeeCents,
          totalCents: quote.totalCents
        }
      });
      if (quote.addOns?.length) {
        await tx.bookingAddOn.createMany({
          data: quote.addOns.map((addOn) => ({
            id: prefixedId("bad"),
            bookingId: created.id,
            addOnId: addOn.id,
            quantity: addOn.quantity,
            priceCents: addOn.priceCents,
            totalCents: addOn.totalCents
          }))
        });
      }
      await tx.bookingHold.delete({ where: { id: hold.id } });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: hold.businessId,
          action: "booking.checkout_started",
          entityType: "booking",
          entityId: created.id
        }
      });
      return created;
    });
    const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return { bookingId: booking.id, status: booking.status, checkoutUrl: `${apiBaseUrl}/payments/mock/${booking.id}` };
  }

  async confirmation(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, status: "confirmed" }, include: { listing: true } });
    if (!booking) throw new NotFoundException("Confirmed booking not found");
    return { id: booking.id, status: booking.status, listing: booking.listing.title, totalCents: booking.totalCents };
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

function publicListingSelect() {
  return {
    id: true,
    businessId: true,
    title: true,
    description: true,
    category: true,
    basePriceCents: true,
    childPriceCents: true,
    durationMinutes: true,
    minGuests: true,
    maxGuests: true,
    capacity: true,
    meetingPoint: true
  } as const;
}

function publicListing<T extends { imageUrlsJson?: string }>(listing: T) {
  const { imageUrlsJson: _imageUrlsJson, ...safe } = listing;
  return safe;
}

function publicBusiness(business: { id: string; name: string; slug: string; timezone: string; currency: string; supportEmail: string | null; supportPhone: string | null }) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    timezone: business.timezone,
    currency: business.currency,
    supportEmail: business.supportEmail,
    supportPhone: business.supportPhone
  };
}

function generateSlots(startTime: string, endTime: string, intervalMinutes: number) {
  const slots: string[] = [];
  let cursor = minutes(startTime);
  const end = minutes(endTime);
  while (cursor < end) {
    slots.push(fromMinutes(cursor));
    cursor += intervalMinutes;
  }
  return slots;
}

function minutes(time: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());
  if (!match) return 0;
  const period = match[3]?.toUpperCase();
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function fromMinutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function addMinutes(time: string, increment: number) {
  return fromMinutes(minutes(time) + increment);
}

function isoDateAfterDays(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function subtotal(
  listing: { basePriceCents: number; childPriceCents: number | null; addOns: { id: string; priceCents: number; pricingType: string; minQuantity: number; maxQuantity: number }[] },
  input: z.infer<typeof quoteInput>
) {
  const guestSubtotal = input.adults * listing.basePriceCents + input.children * (listing.childPriceCents ?? listing.basePriceCents);
  const addOns = input.addOns.map((selected) => {
    const addOn = listing.addOns.find((item) => item.id === selected.id);
    if (!addOn) throw new BadRequestException(`Unknown add-on ${selected.id}`);
    if (selected.quantity < addOn.minQuantity || selected.quantity > addOn.maxQuantity) {
      throw new BadRequestException(`Quantity outside limits for add-on ${selected.id}`);
    }
    const multiplier = addOn.pricingType === "per_guest" ? input.adults + input.children : 1;
    const totalCents = addOn.priceCents * selected.quantity * multiplier;
    return { id: selected.id, quantity: selected.quantity, priceCents: addOn.priceCents, totalCents };
  });
  const addOnSubtotal = addOns.reduce((sum, addOn) => sum + addOn.totalCents, 0);
  return { subtotalCents: guestSubtotal + addOnSubtotal, addOns };
}
