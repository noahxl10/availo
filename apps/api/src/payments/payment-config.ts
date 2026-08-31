import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const STRIPE_TOLERANCE_SECONDS = 5 * 60;
const SUCCESSFUL_STRIPE_EVENTS = new Set(["checkout.session.completed", "payment_intent.succeeded"]);

export function mockPaymentsEnabled() {
  return process.env.ALLOW_MOCK_PAYMENTS === "true" && process.env.NODE_ENV !== "production";
}

export function assertMockPaymentsEnabled() {
  if (!mockPaymentsEnabled()) {
    throw new ForbiddenException("Mock payments are disabled");
  }
}

export function assertPaymentProviderConfigured() {
  if (mockPaymentsEnabled()) return;
  throw new ServiceUnavailableException("Payment provider is not configured");
}

export function verifyStripeWebhook(body: unknown, rawBody: Buffer | undefined, signatureHeader: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ServiceUnavailableException("Stripe webhooks are not configured");
  if (!rawBody) throw new BadRequestException("Stripe webhook raw body is unavailable");
  if (!signatureHeader) throw new BadRequestException("Missing Stripe signature");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    })
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isInteger(timestamp) || !signature) throw new BadRequestException("Invalid Stripe signature");
  if (Math.abs(Date.now() / 1000 - timestamp) > STRIPE_TOLERANCE_SECONDS) throw new BadRequestException("Stale Stripe signature");

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  if (!safeEqualHex(signature, expected)) throw new BadRequestException("Invalid Stripe signature");

  return parseSuccessfulStripeEvent(body);
}

function parseSuccessfulStripeEvent(body: unknown) {
  const event = stripeEventInput.safeParse(body);
  if (!event.success) throw new BadRequestException(event.error.flatten());
  if (!SUCCESSFUL_STRIPE_EVENTS.has(event.data.type)) return null;
  if (event.data.type === "checkout.session.completed" && event.data.data.object.payment_status !== "paid") return null;
  const bookingId = event.data.data.object.metadata?.bookingId;
  if (!bookingId) throw new BadRequestException("Missing booking metadata");
  return event.data;
}

function safeEqualHex(actual: string, expected: string) {
  if (!/^[a-f0-9]+$/i.test(actual)) return false;
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

const stripeEventInput = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.object({
      payment_status: z.string().optional(),
      metadata: z.object({ bookingId: z.string().min(1) }).optional()
    })
  })
});
