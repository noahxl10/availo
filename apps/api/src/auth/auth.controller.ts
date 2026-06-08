import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { DEMO_BUSINESS_ID } from "../common/tenant.js";
import { PrismaService } from "../prisma/prisma.service.js";

const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

@Controller("auth")
export class AuthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("email/register")
  async register(@Body() body: unknown) {
    const input = credentials.parse(body);
    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        id: prefixedId("usr"),
        businessId: DEMO_BUSINESS_ID,
        email: input.email,
        passwordHash,
        role: "owner"
      }
    });
    await this.prisma.auditLog.create({
      data: { id: prefixedId("aud"), businessId: DEMO_BUSINESS_ID, userId: user.id, action: "auth.registered", entityType: "user", entityId: user.id }
    });
    return this.issue(user.id, user.email ?? "");
  }

  @Post("email/login")
  async login(@Body() body: unknown) {
    const input = credentials.parse(body);
    const user = await this.prisma.user.findFirst({ where: { businessId: DEMO_BUSINESS_ID, email: input.email } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      return { ok: false, error: "Invalid credentials" };
    }
    await this.prisma.auditLog.create({
      data: { id: prefixedId("aud"), businessId: DEMO_BUSINESS_ID, userId: user.id, action: "auth.login", entityType: "user", entityId: user.id }
    });
    return this.issue(user.id, user.email ?? "");
  }

  @Post("refresh")
  async refresh(@Body() body: { refreshToken?: string }) {
    if (!body.refreshToken) return { ok: false, error: "Missing refresh token" };
    const sessions = await this.prisma.session.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } } });
    const session = await firstMatchingSession(sessions, body.refreshToken);
    if (!session) {
      return { ok: false, error: "Invalid refresh token" };
    }
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issue(session.userId);
  }

  @Post("logout")
  async logout(@Body() body: { refreshToken?: string }) {
    if (body.refreshToken) {
      const sessions = await this.prisma.session.findMany({ where: { businessId: DEMO_BUSINESS_ID, revokedAt: null } });
      const match = await firstMatchingSession(sessions, body.refreshToken);
      if (match) await this.prisma.session.update({ where: { id: match.id }, data: { revokedAt: new Date() } });
    }
    return { ok: true };
  }

  @Get("me")
  me() {
    return this.prisma.user.findFirst({
      where: { businessId: DEMO_BUSINESS_ID },
      select: { id: true, businessId: true, email: true, phoneNumber: true, role: true, status: true }
    });
  }

  private async issue(userId: string, email?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, businessId: true, role: true } });
    const businessId = user.businessId ?? DEMO_BUSINESS_ID;
    const accessToken = jwt.sign({ sub: userId, businessId, role: user.role }, process.env.JWT_ACCESS_SECRET ?? "local-dev-access-secret", {
      expiresIn: "15m"
    });
    const refreshToken = prefixedId("rt");
    await this.prisma.session.create({
      data: {
        id: prefixedId("ses"),
        userId,
        businessId,
        refreshTokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    return { ok: true, user: { id: userId, email: email ?? user.email ?? "", businessId, role: user.role }, accessToken, refreshToken };
  }
}

async function firstMatchingSession<T extends { refreshTokenHash: string }>(sessions: T[], refreshToken: string) {
  for (const session of sessions) {
    if (await argon2.verify(session.refreshTokenHash, refreshToken)) return session;
  }
  return null;
}
