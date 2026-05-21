import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller.js";
import { BusinessController } from "./businesses/business.controller.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { DashboardService } from "./dashboard/dashboard.service.js";
import { ListingController } from "./listings/listing.controller.js";
import { ListingService } from "./listings/listing.service.js";
import { BookingController } from "./bookings/booking.controller.js";
import { BookingService } from "./bookings/booking.service.js";
import { PublicController } from "./public/public.controller.js";
import { PublicService } from "./public/public.service.js";
import { PaymentController } from "./payments/payment.controller.js";
import { PrismaService } from "./prisma/prisma.service.js";

@Module({
  controllers: [AuthController, BusinessController, DashboardController, ListingController, BookingController, PublicController, PaymentController],
  providers: [PrismaService, DashboardService, ListingService, BookingService, PublicService]
})
export class AppModule {}
