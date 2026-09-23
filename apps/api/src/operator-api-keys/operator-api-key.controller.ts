import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, type AuthenticatedActor } from "../auth/auth-context.js";
import { OperatorAuthGuard } from "../auth/operator-auth.guard.js";
import { OperatorRolesGuard, RequireOperatorRoles } from "../auth/operator-roles.guard.js";
import { OperatorApiKeyService } from "./operator-api-key.service.js";

@Controller("operator-api-keys")
@UseGuards(OperatorAuthGuard, OperatorRolesGuard)
@RequireOperatorRoles("owner", "admin")
export class OperatorApiKeyController {
  constructor(@Inject(OperatorApiKeyService) private readonly apiKeys: OperatorApiKeyService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.apiKeys.list(actor);
  }

  @Post()
  create(@CurrentActor() actor: AuthenticatedActor, @Body() body: unknown) {
    return this.apiKeys.create(actor, body);
  }

  @Delete(":id")
  revoke(@CurrentActor() actor: AuthenticatedActor, @Param("id") id: string) {
    return this.apiKeys.revoke(actor, id);
  }
}
