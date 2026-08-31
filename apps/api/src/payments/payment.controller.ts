import { BadRequestException, Body, Controller, Headers, Inject, Param, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { assertMockPaymentsEnabled, verifyStripeWebhook } from "./payment-config.js";

const confirmInput = z.object({
  bookingId: z.string().min(1),
  providerEventId: z.string().min(1).default(() => prefixedId("evt"))
});

@Controller()
export class PaymentController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("payments/mock/confirm")
  async mockConfirm(@Body() body: unknown) {
    assertMockPaymentsEnabled();
    const input = confirmInput.parse(body);
    return this.confirmBooking(input.bookingId, "mock", input.providerEventId, "payment.confirmed", body);
  }

  @Post("payments/stripe/webhook")
  async stripeWebhook(@Body() body: unknown, @Headers("stripe-signature") signature: string | undefined, @Req() request: { rawBody?: Buffer }) {
    const event = verifyStripeWebhook(body, request.rawBody, signature);
    if (!event) return { ok: true, ignored: true };
    return this.confirmBooking(event.data.object.metadata!.bookingId, "stripe", event.id, event.type, body);
  }

  @Post("bookings/:id/refund")
  async refund(@Param("id") id: string) {
    throw new ServiceUnavailableException(`Refunds are not configured for booking ${id}`);
  }

  private async confirmBooking(bookingId: string, provider: string, providerEventId: string, eventType: string, payload: unknown) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentEvent.findUnique({ where: { providerEventId } });
      if (existing) return { ok: true, duplicate: true, bookingId };

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: "pending_payment", paymentStatus: "pending", paymentExpiresAt: { gt: new Date() } },
        data: { status: "confirmed", paymentStatus: "paid" }
      });
      if (updated.count !== 1) {
        if (provider === "stripe") {
          await this.recordIgnoredPayment(tx, booking, provider, providerEventId, eventType, payload);
          return { ok: true, ignored: true, bookingId };
        }
        throw new BadRequestException("Booking is not awaiting payment");
      }

      await tx.paymentEvent.create({
        data: {
          id: prefixedId("payevt"),
          businessId: booking.businessId,
          bookingId,
          provider,
          providerEventId,
          eventType,
          payloadJson: JSON.stringify(payload)
        }
      });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: booking.businessId,
          action: "payment.confirmed",
          entityType: "booking",
          entityId: bookingId,
          metadataJson: JSON.stringify({ provider, providerEventId })
        }
      });
      return { ok: true, duplicate: false, bookingId };
    });
  }

  private async recordIgnoredPayment(
    tx: Prisma.TransactionClient,
    booking: { id: string; businessId: string },
    provider: string,
    providerEventId: string,
    eventType: string,
    payload: unknown
  ) {
    await tx.paymentEvent.create({
      data: {
        id: prefixedId("payevt"),
        businessId: booking.businessId,
        bookingId: booking.id,
        provider,
        providerEventId,
        eventType,
        payloadJson: JSON.stringify(payload)
      }
    });
    await tx.auditLog.create({
      data: {
        id: prefixedId("aud"),
        businessId: booking.businessId,
        action: "payment.ignored",
        entityType: "booking",
        entityId: booking.id,
        metadataJson: JSON.stringify({ provider, providerEventId, reason: "booking_not_awaiting_payment" })
      }
    });
  }
}
