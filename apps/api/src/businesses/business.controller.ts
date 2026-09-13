import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { DEMO_BUSINESS_ID } from "../common/tenant.js";
import { parseBody } from "../common/validation.js";
import { PrismaService } from "../prisma/prisma.service.js";

const businessInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  timezone: z.string().default("America/Los_Angeles"),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().optional()
});

@Controller("business")
export class BusinessController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  get() {
    return this.prisma.business.findUnique({ where: { id: DEMO_BUSINESS_ID } });
  }

  @Post()
  async create(@Body() body: unknown) {
    const input = parseBody(businessInput, body);
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
  async update(@Body() body: unknown) {
    const input = parseBody(businessInput.partial(), body);
    return this.prisma.business.update({ where: { id: DEMO_BUSINESS_ID }, data: cleanUndefined(input) });
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

function cleanUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
