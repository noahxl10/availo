import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { parseBearerActor, type ActorRequest } from "./auth-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const actor = parseBearerActor(request.headers.authorization);
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { businessId: true, role: true, status: true }
    });
    if (!user || user.status !== "active" || user.businessId !== actor.businessId) {
      throw new UnauthorizedException("Invalid access token");
    }

    request.actor = { ...actor, role: user.role };
    return true;
  }
}
