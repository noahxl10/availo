import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedActor } from "../auth/auth-context.js";
import { prefixedId } from "../common/ids.js";
import { StripeCheckoutClient } from "../payments/stripe-checkout.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().min(1).max(240).optional(),
  status: z.enum(["pending_payment", "confirmed", "canceled", "refunded", "partially_refunded", "failed"]).optional(),
  fromDate: z.string().refine(isRealIsoDate).optional(),
  toDate: z.string().refine(isRealIsoDate).optional()
});

const cursorPayload = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1)
});

@Injectable()
export class BookingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() private readonly stripeCheckout: StripeCheckoutClient = new StripeCheckoutClient()
  ) {}

  async list(
    businessId: string,
    query: { limit?: string | undefined; cursor?: string | undefined; status?: string | undefined; fromDate?: string | undefined; toDate?: string | undefined }
  ) {
    const { limit, cursor, status, fromDate, toDate } = parseListQuery(query);
    const cursorWhere = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.booking.findMany({
      where: {
        businessId,
        ...(status ? { status } : {}),
        ...dateRangeWhere(fromDate, toDate),
        ...(cursorWhere
          ? {
              OR: [{ createdAt: { lt: cursorWhere.createdAt } }, { createdAt: cursorWhere.createdAt, id: { lt: cursorWhere.id } }]
            }
          : {})
      },
      include: { listing: true, addOns: { include: { addOn: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    const items = rows.slice(0, limit);
    const nextRow = rows[limit];
    const lastItem = items.at(-1);
    return { items: items.map(toOperatorBookingResponse), nextCursor: nextRow && lastItem ? encodeCursor(lastItem) : null };
  }

  async get(businessId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { listing: true, addOns: { include: { addOn: true } } }
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return toOperatorBookingResponse(booking);
  }

  async cancel(actor: AuthenticatedActor, id: string) {
    const candidate = await this.prisma.booking.findFirst({
      where: { id, businessId: actor.businessId },
      select: { id: true, status: true, paymentStatus: true, paymentProvider: true, paymentReferenceId: true }
    });
    if (!candidate) throw new NotFoundException("Booking not found");
    if (candidate.status !== "pending_payment" || candidate.paymentStatus !== "pending") {
      throw new ConflictException("Only unpaid pending bookings can be canceled");
    }
    if (candidate.paymentProvider === "stripe") {
      if (!candidate.paymentReferenceId) throw new ServiceUnavailableException("Stripe Checkout session is not attached to this booking");
      await this.expireStripeCheckoutSession(candidate.paymentReferenceId);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: { id, businessId: actor.businessId },
        select: { id: true, businessId: true, status: true, paymentStatus: true, paymentProvider: true, paymentReferenceId: true }
      });
      if (!existing) throw new NotFoundException("Booking not found");
      if (existing.status !== "pending_payment" || existing.paymentStatus !== "pending") {
        throw new ConflictException("Only unpaid pending bookings can be canceled");
      }

      const updated = await tx.booking.updateMany({
        where: {
          id,
          businessId: actor.businessId,
          status: "pending_payment",
          paymentStatus: "pending",
          paymentProvider: existing.paymentProvider,
          paymentReferenceId: existing.paymentReferenceId
        },
        data: { status: "canceled", paymentStatus: "failed" }
      });
      if (updated.count !== 1) throw new ConflictException("Only unpaid pending bookings can be canceled");

      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: actor.businessId,
          userId: actor.userId,
          action: "booking.canceled",
          entityType: "booking",
          entityId: id,
          metadataJson: JSON.stringify({ previousStatus: existing.status, previousPaymentStatus: existing.paymentStatus })
        }
      });

      const booking = await tx.booking.findFirst({
        where: { id, businessId: actor.businessId },
        include: { listing: true, addOns: { include: { addOn: true } } }
      });
      if (!booking) throw new NotFoundException("Booking not found");
      return toOperatorBookingResponse(booking);
    });
  }

  private async expireStripeCheckoutSession(sessionId: string) {
    try {
      await this.stripeCheckout.expireCheckoutSession(sessionId);
    } catch {
      throw new ServiceUnavailableException("Stripe Checkout session could not be expired");
    }
  }
}

type BookingWithDetails = Prisma.BookingGetPayload<{ include: { listing: true; addOns: { include: { addOn: true } } } }>;

function toOperatorBookingResponse(booking: BookingWithDetails) {
  return {
    id: booking.id,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    bookingDate: booking.bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    guestCount: booking.guestCount,
    adultCount: booking.adultCount,
    childCount: booking.childCount,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentProvider: booking.paymentProvider,
    subtotalCents: booking.subtotalCents,
    taxCents: booking.taxCents,
    platformFeeCents: booking.platformFeeCents,
    processorFeeCents: booking.processorFeeCents,
    totalCents: booking.totalCents,
    notes: booking.notes,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    listing: {
      id: booking.listing.id,
      title: booking.listing.title,
      category: booking.listing.category,
      durationMinutes: booking.listing.durationMinutes,
      capacity: booking.listing.capacity,
      meetingPoint: booking.listing.meetingPoint
    },
    addOns: booking.addOns.map((addOn) => ({
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

function parseListQuery(query: { limit?: string | undefined; cursor?: string | undefined; status?: string | undefined; fromDate?: string | undefined; toDate?: string | undefined }) {
  try {
    const parsed = listQuery.parse(query);
    if (parsed.fromDate && parsed.toDate && parsed.fromDate > parsed.toDate) throw new Error("Invalid date range");
    return parsed;
  } catch {
    throw new BadRequestException("Invalid booking list query");
  }
}

function dateRangeWhere(fromDate: string | undefined, toDate: string | undefined): Prisma.BookingWhereInput {
  if (!fromDate && !toDate) return {};
  return {
    bookingDate: {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {})
    }
  };
}

function isRealIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function encodeCursor(row: { createdAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const parsed = cursorPayload.parse(payload);
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    throw new BadRequestException("Invalid booking pagination cursor");
  }
}
