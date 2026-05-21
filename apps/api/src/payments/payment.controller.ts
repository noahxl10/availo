import { BadRequestException, Body, Controller, Headers, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { PrismaService } from "../prisma/prisma.service.js";

const confirmInput = z.object({
  bookingId: z.string().min(1),
  providerEventId: z.string().min(1).default(() => prefixedId("evt"))
});

const stripeEventInput = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.object({
      metadata: z.object({ bookingId: z.string().min(1) }).optional()
    })
  })
});

@Controller()
export class PaymentController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("payments/mock/confirm")
  async mockConfirm(@Body() body: unknown) {
    const input = confirmInput.parse(body);
    return this.confirmBooking(input.bookingId, "mock", input.providerEventId, "payment.confirmed", body);
  }

  @Post("payments/stripe/webhook")
  async stripeWebhook(@Body() body: unknown, @Headers("stripe-signature") signature?: string) {
    if ((process.env.STRIPE_WEBHOOK_SECRET ?? "") && !signature) throw new BadRequestException("Missing Stripe signature");
    const event = stripeEventInput.parse(body);
    const bookingId = event.data.object.metadata?.bookingId;
    if (!bookingId) throw new BadRequestException("Missing booking metadata");
    return this.confirmBooking(bookingId, "stripe", event.id, event.type, body);
  }

  @Post("bookings/:id/refund")
  async refund(@Param("id") id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id } });
    const refunded = await this.prisma.booking.update({
      where: { id },
      data: { status: "refunded", paymentStatus: "refunded" }
    });
    await this.prisma.auditLog.create({
      data: {
        id: prefixedId("aud"),
        businessId: booking.businessId,
        action: "booking.refunded",
        entityType: "booking",
        entityId: booking.id
      }
    });
    return refunded;
  }

  private async confirmBooking(bookingId: string, provider: string, providerEventId: string, eventType: string, payload: unknown) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const existing = await this.prisma.paymentEvent.findUnique({ where: { providerEventId } });
    if (existing) return { ok: true, duplicate: true, bookingId };

    await this.prisma.$transaction(async (tx) => {
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
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "confirmed", paymentStatus: "paid" }
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
    });
    return { ok: true, duplicate: false, bookingId };
  }
}
