import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller.js";
import { AuthLoginIdentityRateLimiter, AuthLoginIpRateLimiter, AuthRefreshIpRateLimiter, AuthRefreshSessionRateLimiter } from "./auth/auth-rate-limit.js";
import { OperatorAuthGuard } from "./auth/operator-auth.guard.js";
import { OperatorRolesGuard } from "./auth/operator-roles.guard.js";
import { BusinessController } from "./businesses/business.controller.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { DashboardService } from "./dashboard/dashboard.service.js";
import { ListingController } from "./listings/listing.controller.js";
import { ListingService } from "./listings/listing.service.js";
import { BookingController } from "./bookings/booking.controller.js";
import { BookingService } from "./bookings/booking.service.js";
import { OperatorApiKeyController } from "./operator-api-keys/operator-api-key.controller.js";
import { OperatorApiKeyService } from "./operator-api-keys/operator-api-key.service.js";
import { PublicController } from "./public/public.controller.js";
import { PublicService } from "./public/public.service.js";
import { PaymentController } from "./payments/payment.controller.js";
import { StripeCheckoutClient } from "./payments/stripe-checkout.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { PublicCheckoutRateLimiter, PublicQuoteRateLimiter } from "./public/public-rate-limit.js";

@Module({
  controllers: [AuthController, BusinessController, DashboardController, ListingController, BookingController, OperatorApiKeyController, PublicController, PaymentController],
  providers: [
    PrismaService,
    DashboardService,
    ListingService,
    BookingService,
    OperatorApiKeyService,
    PublicService,
    PublicQuoteRateLimiter,
    PublicCheckoutRateLimiter,
    AuthLoginIpRateLimiter,
    AuthLoginIdentityRateLimiter,
    AuthRefreshIpRateLimiter,
    AuthRefreshSessionRateLimiter,
    StripeCheckoutClient,
    OperatorAuthGuard,
    OperatorRolesGuard
  ]
})
export class AppModule {}
