import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().min(1).max(240).optional()
});

const cursorPayload = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1)
});

@Injectable()
export class BookingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(businessId: string, query: { limit?: string | undefined; cursor?: string | undefined }) {
    const { limit, cursor } = parseListQuery(query);
    const cursorWhere = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.booking.findMany({
      where: {
        businessId,
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

function parseListQuery(query: { limit?: string | undefined; cursor?: string | undefined }) {
  try {
    return listQuery.parse(query);
  } catch {
    throw new BadRequestException("Invalid booking pagination query");
  }
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
