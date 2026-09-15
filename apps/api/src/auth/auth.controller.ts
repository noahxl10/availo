import { BadRequestException, Body, Controller, Get, Header, HttpException, HttpStatus, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma, UserRole } from "@prisma/client";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { CurrentActor, jwtAccessSecret, type AuthenticatedActor } from "./auth-context.js";
import {
  AuthLoginIdentityRateLimiter,
  AuthLoginIpRateLimiter,
  AuthRefreshIpRateLimiter,
  AuthRefreshSessionRateLimiter,
  type AuthRateLimitDecision
} from "./auth-rate-limit.js";
import { OperatorAuthGuard } from "./operator-auth.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";

const loginInput = z
  .object({
    businessSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    email: z.string().email().max(320),
    password: z.string().min(8).max(1024)
  })
  .strict();
const refreshInput = z.object({ refreshToken: z.string().min(1).max(4096) }).strict();
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$DEZQyOGhqxFXLAtrvmTfzg$Rm5bizR14A68axJuG+YSiTG0o+2BeYukCf0fh0AKehY";
const BROWSER_REFRESH_COOKIE = "availo_browser_refresh";
const BROWSER_REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type AuthUser = {
  id: string;
  businessId: string | null;
  email: string | null;
  role: UserRole;
};

type AuthSession = {
  ok: true;
  user: { id: string; email: string; businessId: string; role: UserRole };
  accessToken: string;
  refreshToken: string;
};

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthLoginIpRateLimiter) private readonly loginIpRateLimiter: AuthLoginIpRateLimiter,
    @Inject(AuthLoginIdentityRateLimiter) private readonly loginIdentityRateLimiter: AuthLoginIdentityRateLimiter,
    @Inject(AuthRefreshIpRateLimiter) private readonly refreshIpRateLimiter: AuthRefreshIpRateLimiter,
    @Inject(AuthRefreshSessionRateLimiter) private readonly refreshSessionRateLimiter: AuthRefreshSessionRateLimiter
  ) {}

  @Post("email/login")
  @Header("Cache-Control", "no-store")
  async login(@Body() body: unknown, @Req() request?: RequestLike, @Res({ passthrough: true }) response?: ResponseLike) {
    return this.loginWithSession(body, request, response);
  }

  @Post("refresh")
  @Header("Cache-Control", "no-store")
  async refresh(@Body() body: unknown, @Req() request?: RequestLike, @Res({ passthrough: true }) response?: ResponseLike) {
    const { refreshToken } = parseRefreshInput(body);
    return this.refreshWithToken(refreshToken, request, response);
  }

  @Post("logout")
  @Header("Cache-Control", "no-store")
  async logout(@Body() body: unknown) {
    const { refreshToken } = parseRefreshInput(body);
    await this.logoutWithToken(refreshToken);
    return { ok: true };
  }

  @Post("browser/login")
  @Header("Cache-Control", "no-store")
  async browserLogin(@Body() body: unknown, @Req() request?: RequestLike, @Res({ passthrough: true }) response?: ResponseLike) {
    enforceBrowserOrigin(request);
    const result = await this.loginWithSession(body, request, response);
    if (!result.ok) return result;

    setBrowserRefreshCookie(response, result.refreshToken, request);
    return browserSessionResponse(result);
  }

  @Post("browser/refresh")
  @Header("Cache-Control", "no-store")
  async browserRefresh(@Req() request?: RequestLike, @Res({ passthrough: true }) response?: ResponseLike) {
    enforceBrowserOrigin(request);
    const refreshToken = readCookie(request, BROWSER_REFRESH_COOKIE);
    if (!refreshToken) {
      clearBrowserRefreshCookie(response, request);
      return invalidRefreshToken();
    }

    const result = await this.refreshWithToken(refreshToken, request, response);
    if (!result.ok) {
      clearBrowserRefreshCookie(response, request);
      return result;
    }

    setBrowserRefreshCookie(response, result.refreshToken, request);
    return browserSessionResponse(result);
  }

  @Post("browser/logout")
  @Header("Cache-Control", "no-store")
  async browserLogout(@Req() request?: RequestLike, @Res({ passthrough: true }) response?: ResponseLike) {
    enforceBrowserOrigin(request);
    const refreshToken = readCookie(request, BROWSER_REFRESH_COOKIE);
    if (refreshToken) await this.logoutWithToken(refreshToken);
    clearBrowserRefreshCookie(response, request);
    return { ok: true };
  }

  @Get("me")
  @Header("Cache-Control", "no-store")
  @UseGuards(OperatorAuthGuard)
  me(@CurrentActor() actor: AuthenticatedActor) {
    return { userId: actor.userId, businessId: actor.businessId, role: actor.role };
  }

  private async loginWithSession(body: unknown, request: RequestLike | undefined, response: ResponseLike | undefined) {
    enforceRateLimit(response, this.loginIpRateLimiter.consume({ key: clientSource(request) }), "Too many login attempts. Please try again later.");
    const input = parseLoginInput(body);
    enforceRateLimit(
      response,
      this.loginIdentityRateLimiter.consume({ key: `${input.businessSlug}:${input.email}` }),
      "Too many login attempts. Please try again later."
    );
    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email,
        status: "active",
        business: { is: { slug: input.businessSlug, status: "active" } }
      },
      select: { id: true, businessId: true, email: true, role: true, passwordHash: true }
    });
    const passwordOk = await argon2.verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, input.password);
    if (!user?.passwordHash || !user.businessId || !passwordOk) return invalidCredentials();

    return this.createSession(user, "auth.login");
  }

  private async refreshWithToken(refreshToken: string, request: RequestLike | undefined, response: ResponseLike | undefined) {
    enforceRateLimit(response, this.refreshIpRateLimiter.consume({ key: clientSource(request) }), "Too many refresh attempts. Please try again later.");
    const token = parseRefreshToken(refreshToken);
    if (!token) return invalidRefreshToken();
    enforceRateLimit(response, this.refreshSessionRateLimiter.consume({ key: token.sessionId }), "Too many refresh attempts. Please try again later.");

    return withRefreshTokenLock(token.sessionId, () => this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: token.sessionId },
        include: { user: { select: { id: true, businessId: true, email: true, role: true, status: true } }, business: { select: { status: true } } }
      });

      const secretOk = await argon2.verify(session?.refreshTokenHash ?? DUMMY_PASSWORD_HASH, token.secret);
      if (!session) return invalidRefreshToken();
      if (secretOk && session.revokedAt) {
        await tx.session.updateMany({ where: { userId: session.userId, businessId: session.businessId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({
          data: { id: prefixedId("aud"), businessId: session.businessId, userId: session.userId, action: "auth.refresh_reuse_revoked", entityType: "session", entityId: session.id }
        });
        return invalidRefreshToken();
      }

      if (
        session.expiresAt <= new Date() ||
        session.user.status !== "active" ||
        session.user.businessId !== session.businessId ||
        session.business.status !== "active" ||
        !secretOk
      ) {
        return invalidRefreshToken();
      }

      const revoked = await tx.session.updateMany({ where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
      if (revoked.count !== 1) {
        await tx.session.updateMany({ where: { userId: session.userId, businessId: session.businessId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({
          data: { id: prefixedId("aud"), businessId: session.businessId, userId: session.userId, action: "auth.refresh_reuse_revoked", entityType: "session", entityId: session.id }
        });
        return invalidRefreshToken();
      }

      return this.createSessionInTransaction(tx, session.user, "auth.refresh");
    }));
  }

  private async logoutWithToken(refreshToken: string) {
    const token = parseRefreshToken(refreshToken);
    if (!token) return;

    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: token.sessionId }, select: { id: true, userId: true, businessId: true, refreshTokenHash: true, revokedAt: true, expiresAt: true } });
      if (!session || session.revokedAt || session.expiresAt <= new Date() || !(await argon2.verify(session.refreshTokenHash, token.secret))) return;

      const revoked = await tx.session.updateMany({ where: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
      if (revoked.count !== 1) return;

      await tx.auditLog.create({
        data: { id: prefixedId("aud"), businessId: session.businessId, userId: session.userId, action: "auth.logout", entityType: "session", entityId: session.id }
      });
    });
  }

  private async createSession(user: AuthUser, action: "auth.login" | "auth.refresh"): Promise<AuthSession> {
    return this.prisma.$transaction((tx) => this.createSessionInTransaction(tx, user, action));
  }

  private async createSessionInTransaction(tx: Prisma.TransactionClient, user: AuthUser, action: "auth.login" | "auth.refresh"): Promise<AuthSession> {
    if (!user.businessId) throw new Error("Active operator is missing a business");

    const sessionId = prefixedId("ses");
    const secret = randomBytes(32).toString("base64url");
    const accessToken = jwt.sign({ sub: user.id, businessId: user.businessId, role: user.role, sid: sessionId }, jwtAccessSecret(), { expiresIn: "15m" });
    await tx.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        businessId: user.businessId,
        refreshTokenHash: await argon2.hash(secret),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    await tx.auditLog.create({
      data: { id: prefixedId("aud"), businessId: user.businessId, userId: user.id, action, entityType: "session", entityId: sessionId }
    });
    return {
      ok: true as const,
      user: { id: user.id, email: user.email ?? "", businessId: user.businessId, role: user.role },
      accessToken,
      refreshToken: `v1.${sessionId}.${secret}`
    };
  }

}

function parseLoginInput(body: unknown) {
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

function parseRefreshInput(body: unknown) {
  const parsed = refreshInput.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

function parseRefreshToken(refreshToken: string) {
  const [version, sessionId, secret, ...extra] = refreshToken.split(".");
  if (version !== "v1" || extra.length || !/^ses_[a-f0-9]{32}$/.test(sessionId ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(secret ?? "")) return null;
  return { sessionId: sessionId!, secret: secret! };
}

function invalidCredentials() {
  return { ok: false as const, error: "Invalid credentials" };
}

function invalidRefreshToken() {
  return { ok: false as const, error: "Invalid refresh token" };
}

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
  secure?: boolean;
  protocol?: string;
  headers?: { cookie?: string; origin?: string | string[] };
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
};

function browserSessionResponse(session: AuthSession) {
  return { ok: true as const, user: session.user, accessToken: session.accessToken };
}

function enforceBrowserOrigin(request: RequestLike | undefined) {
  const origin = request?.headers?.origin;
  if (typeof origin !== "string" || !isAllowedDashboardOrigin(origin)) {
    throw new HttpException({ message: "Invalid request origin" }, HttpStatus.FORBIDDEN);
  }
}

function isAllowedDashboardOrigin(origin: string) {
  const configured = process.env.CORS_ORIGINS ?? process.env.APP_BASE_URL;
  if (!configured) return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

  const origins = configured.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS cannot include '*' while credentialed CORS is enabled.");
  }
  return origins.includes(origin);
}

function setBrowserRefreshCookie(response: ResponseLike | undefined, refreshToken: string, request: RequestLike | undefined) {
  response?.setHeader("Set-Cookie", browserCookieHeader(refreshToken, request));
}

function clearBrowserRefreshCookie(response: ResponseLike | undefined, request: RequestLike | undefined) {
  response?.setHeader("Set-Cookie", browserCookieHeader("", request, 0));
}

function browserCookieHeader(value: string, request: RequestLike | undefined, maxAgeSeconds = BROWSER_REFRESH_COOKIE_MAX_AGE_SECONDS) {
  const attributes = [
    `${BROWSER_REFRESH_COOKIE}=${value}`,
    "Path=/auth/browser",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (maxAgeSeconds === 0) attributes.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  if (process.env.NODE_ENV === "production" || request?.secure || request?.protocol === "https") attributes.push("Secure");
  return attributes.join("; ");
}

function readCookie(request: RequestLike | undefined, name: string) {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function clientSource(request: RequestLike | undefined) {
  return request?.ip ?? request?.socket?.remoteAddress ?? "unknown";
}

function enforceRateLimit(response: ResponseLike | undefined, rateLimit: AuthRateLimitDecision, message: string) {
  setRateLimitHeaders(response, rateLimit);
  if (!rateLimit.allowed) throw new HttpException({ message }, HttpStatus.TOO_MANY_REQUESTS);
}

function setRateLimitHeaders(response: ResponseLike | undefined, rateLimit: AuthRateLimitDecision) {
  if (!response || rateLimit.disabled) return;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("RateLimit-Limit", String(rateLimit.limit));
  response.setHeader("RateLimit-Remaining", String(Math.max(rateLimit.remaining, 0)));
  response.setHeader("RateLimit-Reset", String(rateLimit.retryAfterSeconds));
  if (!rateLimit.allowed) response.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
}

const refreshTokenLocks = new Map<string, Promise<void>>();

async function withRefreshTokenLock<T>(key: string, callback: () => Promise<T>) {
  const previous = refreshTokenLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.then(() => current, () => current);
  refreshTokenLocks.set(key, next);

  await previous.catch(() => undefined);
  try {
    return await callback();
  } finally {
    release();
    if (refreshTokenLocks.get(key) === next) refreshTokenLocks.delete(key);
  }
}
