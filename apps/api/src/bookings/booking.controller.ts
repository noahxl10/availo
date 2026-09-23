import { Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentActor, type AuthenticatedActor } from "../auth/auth-context.js";
import { OperatorAuthGuard } from "../auth/operator-auth.guard.js";
import { OperatorRolesGuard, RequireOperatorRoles } from "../auth/operator-roles.guard.js";
import { BookingService } from "./booking.service.js";

@Controller("bookings")
@UseGuards(OperatorAuthGuard, OperatorRolesGuard)
export class BookingController {
  constructor(@Inject(BookingService) private readonly bookings: BookingService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.bookings.list(actor.businessId, { limit, cursor });
  }

  @Get(":id")
  get(@CurrentActor() actor: AuthenticatedActor, @Param("id") id: string) {
    return this.bookings.get(actor.businessId, id);
  }

  @Post(":id/cancel")
  @RequireOperatorRoles("owner", "admin", "staff")
  cancel(@CurrentActor() actor: AuthenticatedActor, @Param("id") id: string) {
    return this.bookings.cancel(actor, id);
  }
}
