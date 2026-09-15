import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import Stripe from "stripe";
import { z } from "zod";

const SUCCESSFUL_STRIPE_EVENTS = new Set(["checkout.session.completed", "payment_intent.succeeded"]);
export const STRIPE_WEBHOOK_GRACE_MS = 10 * 60 * 1000;

export function mockPaymentsEnabled() {
  return process.env.ALLOW_MOCK_PAYMENTS === "true" && process.env.NODE_ENV !== "production";
}

export function assertMockPaymentsEnabled() {
  if (!mockPaymentsEnabled()) {
    throw new ForbiddenException("Mock payments are disabled");
  }
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new ServiceUnavailableException("Stripe Checkout is not configured");
  return secret;
}

export function stripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ServiceUnavailableException("Stripe webhooks are not configured");
  return secret;
}

export function checkoutProviderMode(): "stripe" | "mock" {
  if (stripeConfigured()) {
    if (!stripeWebhookConfigured()) throw new ServiceUnavailableException("Stripe webhooks are not configured");
    return "stripe";
  }
  if (mockPaymentsEnabled()) return "mock";
  throw new ServiceUnavailableException("Payment provider is not configured");
}

export function verifyStripeWebhook(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
  const secret = stripeWebhookSecret();
  if (!rawBody) throw new BadRequestException("Stripe webhook raw body is unavailable");
  if (!signatureHeader) throw new BadRequestException("Missing Stripe signature");

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_webhook_verification_only");
    return parseSuccessfulStripeEvent(stripe.webhooks.constructEvent(rawBody, signatureHeader, secret));
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Invalid Stripe signature");
  }
}

function parseSuccessfulStripeEvent(body: unknown) {
  const event = stripeEventInput.safeParse(body);
  if (!event.success) throw new BadRequestException(event.error.flatten());
  if (!SUCCESSFUL_STRIPE_EVENTS.has(event.data.type)) return null;
  if (event.data.type === "checkout.session.completed" && event.data.data.object.payment_status !== "paid") return null;
  return event.data;
}

const stripeEventInput = z.object({
  id: z.string().min(1),
  created: z.number().int().positive(),
  type: z.string().min(1),
  data: z.object({
    object: z.object({
      id: z.string().min(1).optional(),
      payment_status: z.string().optional(),
      amount_total: z.number().int().optional(),
      amount_received: z.number().int().optional(),
      currency: z.string().optional(),
      client_reference_id: z.string().nullable().optional(),
      payment_intent: z.union([z.string(), z.object({ id: z.string().min(1) })]).nullable().optional(),
      metadata: z.object({ bookingId: z.string().min(1).optional() }).optional()
    })
  })
});

export type StripePaymentEvent = NonNullable<ReturnType<typeof parseSuccessfulStripeEvent>>;
