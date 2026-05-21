import { Controller, Get, Inject } from "@nestjs/common";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get("overview")
  overview() {
    return this.dashboard.overview();
  }
}
