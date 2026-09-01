import { BadRequestException, Body, Controller, Headers, Inject, Param, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { assertMockPaymentsEnabled, STRIPE_WEBHOOK_GRACE_MS, StripePaymentEvent, verifyStripeWebhook } from "./payment-config.js";

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
    return this.confirmBooking(input.bookingId, "mock", providerEventKey("mock", input.providerEventId), "payment.confirmed", body);
  }

  @Post("payments/stripe/webhook")
  async stripeWebhook(@Body() body: unknown, @Headers("stripe-signature") signature: string | undefined, @Req() request: { rawBody?: Buffer }) {
    const event = verifyStripeWebhook(request.rawBody, signature);
    if (!event) return { ok: true, ignored: true };
    return this.confirmStripeEvent(event, body);
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
        where: { id: bookingId, status: "pending_payment", paymentStatus: "pending", paymentProvider: provider, paymentExpiresAt: { gt: new Date() } },
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

  private async confirmStripeEvent(event: StripePaymentEvent, payload: unknown) {
    const object = event.data.object;
    const bookingId = object.metadata?.bookingId ?? object.client_reference_id ?? null;
    if (!bookingId) return { ok: true, ignored: true };
    const providerEventId = providerEventKey("stripe", event.id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentEvent.findUnique({ where: { providerEventId } });
      if (existing) return { ok: true, duplicate: true, bookingId };

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          businessId: true,
          status: true,
          paymentStatus: true,
          paymentProvider: true,
          paymentReferenceId: true,
          paymentIntentId: true,
          paymentExpectedAmountCents: true,
          paymentExpectedCurrency: true,
          paymentExpiresAt: true
        }
      });
      if (!booking) return { ok: true, ignored: true };

      const invalidReason = stripeBindingFailureReason(event, booking);
      if (invalidReason) {
        await this.recordIgnoredPayment(tx, booking, "stripe", providerEventId, event.type, payload, invalidReason);
        return { ok: true, ignored: true, bookingId };
      }

      const updated = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: "pending_payment",
          paymentStatus: "pending",
          paymentProvider: "stripe",
          paymentExpiresAt: { gt: new Date(Date.now() - STRIPE_WEBHOOK_GRACE_MS) }
        },
        data: { status: "confirmed", paymentStatus: "paid" }
      });
      if (updated.count !== 1) {
        await this.recordIgnoredPayment(tx, booking, "stripe", providerEventId, event.type, payload, "booking_not_awaiting_payment");
        return { ok: true, ignored: true, bookingId };
      }

      await tx.paymentEvent.create({
        data: {
          id: prefixedId("payevt"),
          businessId: booking.businessId,
          bookingId,
          provider: "stripe",
          providerEventId,
          eventType: event.type,
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
          metadataJson: JSON.stringify({ provider: "stripe", providerEventId })
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
    payload: unknown,
    reason = "booking_not_awaiting_payment"
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
        metadataJson: JSON.stringify({ provider, providerEventId, reason })
      }
    });
  }
}

function providerEventKey(provider: string, providerEventId: string) {
  return `${provider}:${providerEventId}`;
}

function stripeBindingFailureReason(
  event: StripePaymentEvent,
  booking: {
    id: string;
    paymentProvider: string | null;
    paymentReferenceId: string | null;
    paymentIntentId: string | null;
    paymentExpectedAmountCents: number | null;
    paymentExpectedCurrency: string | null;
    paymentExpiresAt: Date | null;
  }
) {
  const object = event.data.object;
  if (booking.paymentProvider !== "stripe") return "payment_provider_mismatch";
  if (booking.paymentExpectedAmountCents === null || !booking.paymentExpectedCurrency) return "payment_expectation_missing";
  if (!booking.paymentExpiresAt) return "payment_expiry_missing";
  if (event.created * 1000 > booking.paymentExpiresAt.getTime()) return "stripe_payment_completed_after_expiry";

  if (event.type === "checkout.session.completed") {
    if (object.id !== booking.paymentReferenceId) return "stripe_checkout_session_mismatch";
    if (object.payment_status !== "paid") return "stripe_checkout_not_paid";
    if (object.client_reference_id !== booking.id) return "stripe_client_reference_mismatch";
    if (object.metadata?.bookingId !== booking.id) return "stripe_booking_metadata_mismatch";
    if (object.amount_total !== booking.paymentExpectedAmountCents) return "stripe_amount_mismatch";
    if (object.currency?.toLowerCase() !== booking.paymentExpectedCurrency) return "stripe_currency_mismatch";
    return null;
  }

  if (!booking.paymentIntentId) return "stripe_payment_intent_not_bound";
  if (object.id !== booking.paymentIntentId) return "stripe_payment_intent_mismatch";
  if (object.metadata?.bookingId !== booking.id) return "stripe_booking_metadata_mismatch";
  if (object.amount_received !== booking.paymentExpectedAmountCents) return "stripe_amount_mismatch";
  if (object.currency?.toLowerCase() !== booking.paymentExpectedCurrency) return "stripe_currency_mismatch";
  return null;
}
