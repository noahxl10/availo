import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { parseBearerActor, type ActorRequest } from "./auth-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const actor = parseBearerActor(request.headers.authorization);
    const session = await this.prisma.session.findUnique({
      where: { id: actor.sessionId },
      select: {
        userId: true,
        businessId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { businessId: true, role: true, status: true } },
        business: { select: { status: true } }
      }
    });
    if (
      !session ||
      session.userId !== actor.userId ||
      session.businessId !== actor.businessId ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "active" ||
      session.user.businessId !== actor.businessId ||
      session.business.status !== "active"
    ) {
      throw new UnauthorizedException("Invalid access token");
    }

    request.actor = { ...actor, role: session.user.role };
    return true;
  }
}
