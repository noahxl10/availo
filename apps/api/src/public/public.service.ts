import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { platformFeeCents } from "../common/money.js";
import { assertPaymentProviderConfigured } from "../payments/payment-config.js";
import { PrismaService } from "../prisma/prisma.service.js";

const quoteInputBase = z.object({
  listingId: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealCalendarDate, "Date must be a real calendar date"),
  startTime: z.string().min(1).max(32),
  adults: z.number().int().min(1).max(100),
  children: z.number().int().min(0).max(100).default(0),
  addOns: z.array(z.object({ id: z.string().min(1).max(80), quantity: z.number().int().positive().max(100) })).max(12).default([])
});

const quoteInput = quoteInputBase.extend({
  date: quoteInputBase.shape.date.refine(isWithinBookingHorizon, "Date is outside the booking horizon")
}).superRefine(rejectDuplicateAddOns);

const checkoutInput = quoteInputBase.extend({
  holdId: z.string().min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional()
  })
}).superRefine(rejectDuplicateAddOns);

function rejectDuplicateAddOns(input: z.infer<typeof quoteInputBase>, context: z.RefinementCtx) {
  const addOnIds = new Set<string>();
  for (const addOn of input.addOns) {
    if (addOnIds.has(addOn.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["addOns"], message: "Duplicate add-ons are not allowed" });
      return;
    }
    addOnIds.add(addOn.id);
  }
}

const HOLD_TTL_MS = 15 * 60 * 1000;
const CAPACITY_RETRY_LIMIT = 3;
const DEFAULT_BOOKING_HORIZON_DAYS = 548;

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
    const now = new Date();
    const listing = await this.prisma.listing.findFirst({
      where: { id, status: "active" },
      include: {
        rules: true,
        exceptions: true,
        bookings: { where: capacityBookingWhere(date, now) }
      }
    });
    if (!listing) throw new NotFoundException("Listing not found");

    const activeHolds = await this.prisma.bookingHold.findMany({
      where: { listingId: id, bookingDate: date, expiresAt: { gt: now } },
      select: { startTime: true, guestCount: true }
    });
    const slots = availabilitySlots(listing, date, activeHolds);
    return { date, slots };
  }

  async quote(body: unknown) {
    const input = parse(quoteInput, body);
    return retryCapacityTransaction(() =>
      this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const listing = await tx.listing.findFirst({
          where: { id: input.listingId, status: "active" },
          include: { business: true, addOns: { where: { status: "active" } }, rules: true, exceptions: true }
        });
        if (!listing) throw new NotFoundException("Listing not found");
        const guestCount = input.adults + input.children;
        if (guestCount < listing.minGuests || guestCount > listing.maxGuests) throw new BadRequestException("Guest count outside listing limits");

        const slot = await availableSlot(tx, listing, input, now);
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

        const hold = await tx.bookingHold.create({
          data: {
            id: prefixedId("hold"),
            businessId: listing.businessId,
            listingId: listing.id,
            bookingDate: input.date,
            startTime: input.startTime,
            guestCount,
            quoteJson: JSON.stringify(quote),
            expiresAt: new Date(now.getTime() + HOLD_TTL_MS)
          }
        });
        return { holdId: hold.id, expiresAt: hold.expiresAt.toISOString(), quote };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    );
  }

  async checkout(body: unknown) {
    const input = parse(checkoutInput, body);
    assertPaymentProviderConfigured();
    const booking = await retryCapacityTransaction(() =>
      this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const hold = await tx.bookingHold.findUnique({ where: { id: input.holdId } });
        if (!hold || hold.expiresAt <= now) throw new BadRequestException("Hold is invalid or expired");
        const quote = parseHoldQuote(hold.quoteJson);
        if (!holdMatchesInput(quote, input)) {
          throw new BadRequestException("Checkout input does not match the quoted hold");
        }
        const listing = await tx.listing.findFirstOrThrow({
          where: { id: hold.listingId, status: "active" },
          include: { rules: true, exceptions: true }
        });
        const deletedHold = await tx.bookingHold.deleteMany({ where: { id: hold.id, expiresAt: { gt: now } } });
        if (deletedHold.count !== 1) throw new BadRequestException("Hold is invalid or expired");

        const slot = await availableSlot(tx, listing, { listingId: hold.listingId, date: hold.bookingDate, startTime: hold.startTime, adults: quote.adultCount, children: quote.childCount, addOns: [] }, now);
        if (!slot || slot.capacityRemaining < hold.guestCount) {
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
            paymentExpiresAt: new Date(now.getTime() + HOLD_TTL_MS),
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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    );
    const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return { bookingId: booking.id, status: booking.status, paymentExpiresAt: booking.paymentExpiresAt?.toISOString(), checkoutUrl: `${apiBaseUrl}/payments/mock/${booking.id}` };
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

function isRealCalendarDate(value: string) {
  const [year, month, day] = parseYmd(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isWithinBookingHorizon(value: string) {
  const horizonDays = positiveEnvInt("PUBLIC_BOOKING_HORIZON_DAYS", DEFAULT_BOOKING_HORIZON_DAYS);
  const [year, month, day] = parseYmd(value);
  const bookingDate = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return bookingDate >= today && bookingDate <= today + horizonDays * 24 * 60 * 60 * 1000;
}

function parseYmd(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return [Number.NaN, Number.NaN, Number.NaN];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function positiveEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

type QuoteInput = z.infer<typeof quoteInput>;
type CheckoutInput = z.infer<typeof checkoutInput>;
type HoldQuote = {
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

type AvailabilityListing = {
  id: string;
  rules: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotIntervalMinutes: number;
    capacity: number;
    effectiveStartDate: string;
    effectiveEndDate: string | null;
  }[];
  exceptions: { date: string; isClosed: boolean; customStartTime: string | null; customEndTime: string | null; customCapacity: number | null }[];
  bookings?: { startTime: string; guestCount: number }[];
};

function parseHoldQuote(quoteJson: string): HoldQuote {
  return JSON.parse(quoteJson) as HoldQuote;
}

function holdMatchesInput(quote: HoldQuote, input: CheckoutInput) {
  return (
    quote.listingId === input.listingId &&
    quote.bookingDate === input.date &&
    quote.startTime === input.startTime &&
    quote.adultCount === input.adults &&
    quote.childCount === input.children &&
    JSON.stringify((quote.addOns ?? []).map((item) => ({ id: item.id, quantity: item.quantity }))) === JSON.stringify(input.addOns)
  );
}

async function availableSlot(tx: Prisma.TransactionClient, listing: AvailabilityListing, input: QuoteInput, now: Date) {
  const [holds, bookings] = await Promise.all([
    tx.bookingHold.findMany({
      where: { listingId: listing.id, bookingDate: input.date, expiresAt: { gt: now } },
      select: { startTime: true, guestCount: true }
    }),
    tx.booking.findMany({
      where: capacityBookingWhere(input.date, now, { listingId: listing.id }),
      select: { startTime: true, guestCount: true }
    })
  ]);
  return availabilitySlots({ ...listing, bookings }, input.date, holds).find((slot) => slot.startTime === input.startTime);
}

function availabilitySlots(listing: AvailabilityListing, date: string, holds: { startTime: string; guestCount: number }[]) {
  const exception = listing.exceptions.find((item) => item.date === date);
  if (exception?.isClosed) return [];

  const day = new Date(`${date}T12:00:00`).getDay();
  const rules = listing.rules.filter((rule) => rule.dayOfWeek === day && rule.effectiveStartDate <= date && (!rule.effectiveEndDate || rule.effectiveEndDate >= date));
  return rules.flatMap((rule) =>
    generateSlots(rule.startTime, rule.endTime, rule.slotIntervalMinutes)
      .filter((time) => withinExceptionWindow(time, exception))
      .map((time) => {
        const booked = (listing.bookings ?? []).filter((booking) => booking.startTime === time).reduce((sum, booking) => sum + booking.guestCount, 0);
        const held = holds.filter((hold) => hold.startTime === time).reduce((sum, hold) => sum + hold.guestCount, 0);
        const capacity = exception?.customCapacity ?? rule.capacity;
        return { id: `${listing.id}_${date}_${time}`, listingId: listing.id, date, startTime: time, capacityRemaining: Math.max(capacity - booked - held, 0) };
      })
  );
}

function withinExceptionWindow(time: string, exception: { customStartTime: string | null; customEndTime: string | null } | undefined) {
  if (!exception?.customStartTime && !exception?.customEndTime) return true;
  const slot = minutes(time);
  return (!exception.customStartTime || slot >= minutes(exception.customStartTime)) && (!exception.customEndTime || slot < minutes(exception.customEndTime));
}

function capacityBookingWhere(date: string, now: Date, extra: { listingId?: string; startTime?: string } = {}) {
  return {
    ...extra,
    bookingDate: date,
    OR: [
      { status: "confirmed" as const },
      {
        status: "pending_payment" as const,
        paymentStatus: "pending" as const,
        paymentExpiresAt: { gt: now }
      }
    ]
  };
}

async function retryCapacityTransaction<T>(operation: () => Promise<T>) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= CAPACITY_RETRY_LIMIT || !isRetryableCapacityError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
}

function isRetryableCapacityError(error: unknown) {
  if (error instanceof BadRequestException || error instanceof NotFoundException) return false;
  if (error instanceof Prisma.PrismaClientKnownRequestError && new Set(["P2034", "P2028"]).has(error.code)) return true;
  const message = error instanceof Error ? error.message : "";
  return /write conflict|deadlock|database is locked|SQLITE_BUSY|Transaction already closed/i.test(message);
}

function publicListingSelect() {
  return {
    id: true,
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
  const { imageUrlsJson: _imageUrlsJson, businessId: _businessId, ...safe } = listing as T & { businessId?: string };
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
