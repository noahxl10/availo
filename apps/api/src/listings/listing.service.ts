import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedActor } from "../auth/auth-context.js";
import { prefixedId } from "../common/ids.js";
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

  list(businessId: string) {
    return this.prisma.listing.findMany({
      where: { businessId, status: { not: "archived" } },
      include: { addOns: true, rules: true, exceptions: true },
      orderBy: { createdAt: "asc" }
    });
  }

  async get(businessId: string, id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, businessId },
      include: { addOns: true, rules: true, exceptions: true }
    });
    if (!listing) throw new NotFoundException("Listing not found");
    return listing;
  }

  async create(actor: AuthenticatedActor, body: unknown) {
    const input = this.parseCreate(body);
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          id: prefixedId("lst"),
          businessId: actor.businessId,
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
          businessId: actor.businessId,
          userId: actor.userId,
          action: "listing.created",
          entityType: "listing",
          entityId: listing.id
        }
      });
      return listing;
    });
  }

  async update(actor: AuthenticatedActor, id: string, body: unknown) {
    const current = await this.get(actor.businessId, id);
    const input = cleanUndefined(this.parseUpdate(body, current));
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.update({
        where: { id, businessId: actor.businessId },
        data: input
      });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: actor.businessId,
          userId: actor.userId,
          action: "listing.updated",
          entityType: "listing",
          entityId: listing.id
        }
      });
      return listing;
    });
  }

  async archive(actor: AuthenticatedActor, id: string) {
    await this.get(actor.businessId, id);
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.update({ where: { id, businessId: actor.businessId }, data: { status: "archived" } });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: actor.businessId,
          userId: actor.userId,
          action: "listing.archived",
          entityType: "listing",
          entityId: listing.id
        }
      });
      return listing;
    });
  }

  private parseCreate(body: unknown) {
    const parsed = listingInput.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.minGuests > parsed.data.maxGuests) {
      throw new BadRequestException("minGuests cannot be greater than maxGuests");
    }
    if (parsed.data.maxGuests > parsed.data.capacity) {
      throw new BadRequestException("capacity cannot be less than maxGuests");
    }
    return parsed.data;
  }

  private parseUpdate(body: unknown, current: { minGuests: number; maxGuests: number; capacity: number }) {
    const parsed = listingInput.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const nextMinGuests = parsed.data.minGuests ?? current.minGuests;
    const nextMaxGuests = parsed.data.maxGuests ?? current.maxGuests;
    const nextCapacity = parsed.data.capacity ?? current.capacity;
    if (nextMinGuests > nextMaxGuests) {
      throw new BadRequestException("minGuests cannot be greater than maxGuests");
    }
    if (nextMaxGuests > nextCapacity) {
      throw new BadRequestException("capacity cannot be less than maxGuests");
    }
    return parsed.data;
  }
}

function cleanUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
