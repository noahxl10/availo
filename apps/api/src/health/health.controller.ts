import { Controller, Get, Header, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("healthz")
  @Header("Cache-Control", "no-store")
  healthz() {
    return { ok: true as const };
  }

  @Get("readyz")
  @Header("Cache-Control", "no-store")
  async readyz() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true as const };
    } catch {
      throw new HttpException({ ok: false, error: "database_unavailable" }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
