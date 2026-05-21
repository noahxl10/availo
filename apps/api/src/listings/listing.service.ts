import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { DEMO_BUSINESS_ID } from "../common/tenant.js";
import { PrismaService } from "../prisma/prisma.service.js";

const listingInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().default("Experience"),
  basePriceCents: z.number().int().min(0),
  childPriceCents: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().positive(),
  minGuests: z.number().int().positive().default(1),
  maxGuests: z.number().int().positive(),
  capacity: z.number().int().positive(),
  meetingPoint: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft")
});

@Injectable()
export class ListingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.listing.findMany({
      where: { businessId: DEMO_BUSINESS_ID, status: { not: "archived" } },
      include: { addOns: true, rules: true, exceptions: true },
      orderBy: { createdAt: "asc" }
    });
  }

  async get(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
      include: { addOns: true, rules: true, exceptions: true }
    });
    if (!listing) throw new NotFoundException("Listing not found");
    return listing;
  }

  async create(body: unknown) {
    const input = this.parseCreate(body);
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          id: prefixedId("lst"),
          businessId: DEMO_BUSINESS_ID,
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          basePriceCents: input.basePriceCents,
          childPriceCents: input.childPriceCents ?? null,
          durationMinutes: input.durationMinutes,
          minGuests: input.minGuests,
          maxGuests: input.maxGuests,
          capacity: input.capacity,
          meetingPoint: input.meetingPoint ?? null,
          status: input.status,
          imageUrlsJson: "[]"
        }
      });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: DEMO_BUSINESS_ID,
          action: "listing.created",
          entityType: "listing",
          entityId: listing.id
        }
      });
      return listing;
    });
  }

  async update(id: string, body: unknown) {
    await this.get(id);
    const input = cleanUndefined(this.parseUpdate(body));
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.update({
        where: { id },
        data: input
      });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: DEMO_BUSINESS_ID,
          action: "listing.updated",
          entityType: "listing",
          entityId: listing.id
        }
      });
      return listing;
    });
  }

  async archive(id: string) {
    await this.get(id);
    return this.prisma.listing.update({ where: { id }, data: { status: "archived" } });
  }

  private parseCreate(body: unknown) {
    const parsed = listingInput.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.minGuests > parsed.data.maxGuests) {
      throw new BadRequestException("minGuests cannot be greater than maxGuests");
    }
    return parsed.data;
  }

  private parseUpdate(body: unknown) {
    const parsed = listingInput.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.minGuests && parsed.data.maxGuests && parsed.data.minGuests > parsed.data.maxGuests) {
      throw new BadRequestException("minGuests cannot be greater than maxGuests");
    }
    return parsed.data;
  }
}

function cleanUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
