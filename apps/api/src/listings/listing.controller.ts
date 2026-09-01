import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, type AuthenticatedActor } from "../auth/auth-context.js";
import { OperatorAuthGuard } from "../auth/operator-auth.guard.js";
import { OperatorRolesGuard, RequireOperatorRoles } from "../auth/operator-roles.guard.js";
import { ListingService } from "./listing.service.js";

@Controller("listings")
@UseGuards(OperatorAuthGuard, OperatorRolesGuard)
export class ListingController {
  constructor(@Inject(ListingService) private readonly listings: ListingService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.listings.list(actor.businessId);
  }

  @Post()
  @RequireOperatorRoles("owner", "admin", "staff")
  create(@CurrentActor() actor: AuthenticatedActor, @Body() body: unknown) {
    return this.listings.create(actor, body);
  }

  @Get(":id")
  get(@CurrentActor() actor: AuthenticatedActor, @Param("id") id: string) {
    return this.listings.get(actor.businessId, id);
  }

  @Patch(":id")
  @RequireOperatorRoles("owner", "admin", "staff")
  update(@CurrentActor() actor: AuthenticatedActor, @Param("id") id: string, @Body() body: unknown) {
    return this.listings.update(actor, id, body);
  }

  @Delete(":id")
  @RequireOperatorRoles("owner", "admin", "staff")
  archive(@CurrentActor() actor: AuthenticatedActor, @Param("id") id: string) {
    return this.listings.archive(actor, id);
  }
}
