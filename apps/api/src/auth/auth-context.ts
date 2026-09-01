import { createParamDecorator, ExecutionContext, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { z } from "zod";

export type AuthenticatedActor = {
  userId: string;
  businessId: string;
  role: string;
};

export type ActorRequest = {
  headers: { authorization?: string };
  actor?: AuthenticatedActor;
};

const accessTokenClaims = z.object({
  sub: z.string().min(1),
  businessId: z.string().min(1),
  role: z.string().min(1)
});

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<ActorRequest>();
  if (!request.actor) throw new UnauthorizedException("Authentication required");
  return request.actor;
});

export function jwtAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret) return secret;
  throw new ServiceUnavailableException("JWT access secret is not configured");
}

export function parseBearerActor(authorization: string | undefined): AuthenticatedActor {
  const token = bearerToken(authorization);
  const secret = jwtAccessSecret();
  try {
    const claims = accessTokenClaims.parse(jwt.verify(token, secret));
    return { userId: claims.sub, businessId: claims.businessId, role: claims.role };
  } catch {
    throw new UnauthorizedException("Invalid access token");
  }
}

function bearerToken(authorization: string | undefined) {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!match) throw new UnauthorizedException("Authentication required");
  return match[1]?.trim() ?? "";
}
