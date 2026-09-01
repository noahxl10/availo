import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentActor, type AuthenticatedActor } from "../auth/auth-context.js";
import { OperatorAuthGuard } from "../auth/operator-auth.guard.js";
import { OperatorRolesGuard, RequireOperatorRoles } from "../auth/operator-roles.guard.js";
import { prefixedId } from "../common/ids.js";
import { PrismaService } from "../prisma/prisma.service.js";

const businessInput = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    timezone: z.string().refine(isValidTimeZone, "Invalid timezone").default("America/Los_Angeles"),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().optional()
  })
  .strict();
const businessUpdateInput = businessInput.partial();

@Controller("business")
export class BusinessController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(OperatorAuthGuard, OperatorRolesGuard)
  get(@CurrentActor() actor: AuthenticatedActor) {
    return this.prisma.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: businessSettingsSelect });
  }

  @Post()
  async create(@Body() body: unknown) {
    const input = parseBusinessCreateInput(body);
    return this.prisma.business.create({
      data: {
        id: prefixedId("biz"),
        status: "onboarding",
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        supportEmail: input.supportEmail ?? null,
        supportPhone: input.supportPhone ?? null
      }
    });
  }

  @Patch()
  @UseGuards(OperatorAuthGuard, OperatorRolesGuard)
  @RequireOperatorRoles("owner", "admin")
  async update(@CurrentActor() actor: AuthenticatedActor, @Body() body: unknown) {
    const input = parseBusinessUpdateInput(body);
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.update({ where: { id: actor.businessId }, data: cleanUndefined(input), select: businessSettingsSelect });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: actor.businessId,
          userId: actor.userId,
          action: "business.updated",
          entityType: "business",
          entityId: business.id
        }
      });
      return business;
    });
  }

  @Get("public/:slug")
  async publicBusiness(@Param("slug") slug: string) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { slug } });
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
}

const businessSettingsSelect = {
  id: true,
  ownerUserId: true,
  name: true,
  slug: true,
  timezone: true,
  currency: true,
  supportEmail: true,
  supportPhone: true,
  addressJson: true,
  status: true,
  taxRateBps: true,
  createdAt: true,
  updatedAt: true
} as const;

function cleanUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function parseBusinessCreateInput(body: unknown) {
  const parsed = businessInput.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

function parseBusinessUpdateInput(body: unknown) {
  const parsed = businessUpdateInput.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  if (!Object.keys(cleanUndefined(parsed.data)).length) throw new BadRequestException("At least one business setting is required");
  return parsed.data;
}

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
