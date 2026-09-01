import { ForbiddenException, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedActor, ActorRequest } from "./auth-context.js";

export const OPERATOR_ROLES_KEY = "operatorRoles";

export function RequireOperatorRoles(...roles: AuthenticatedActor["role"][]) {
  return SetMetadata(OPERATOR_ROLES_KEY, roles);
}

@Injectable()
export class OperatorRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const roles = getRequiredRoles(context);
    if (!roles.length) return true;

    const request = context.switchToHttp().getRequest<ActorRequest>();
    const actorRole = request.actor?.role;
    if (actorRole && roles.includes(actorRole)) return true;
    throw new ForbiddenException("Insufficient operator permissions");
  }
}

function getRequiredRoles(context: ExecutionContext) {
  const handlerRoles = Reflect.getMetadata(OPERATOR_ROLES_KEY, context.getHandler()) as string[] | undefined;
  if (handlerRoles) return handlerRoles;
  return (Reflect.getMetadata(OPERATOR_ROLES_KEY, context.getClass()) as string[] | undefined) ?? [];
}
