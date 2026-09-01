import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, type AuthenticatedActor } from "../auth/auth-context.js";
import { OperatorAuthGuard } from "../auth/operator-auth.guard.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
@UseGuards(OperatorAuthGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get("overview")
  overview(@CurrentActor() actor: AuthenticatedActor) {
    return this.dashboard.overview(actor.businessId);
  }
}
