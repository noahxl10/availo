import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import Stripe from "stripe";
import { stripeSecret } from "./payment-config.js";

export type StripeCheckoutSessionRequest = {
  bookingId: string;
  customerEmail: string;
  listingTitle: string;
  amountCents: number;
  currency: string;
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
};

export type StripeCheckoutSessionResult = {
  id: string;
  url: string;
  paymentIntentId: string | null;
};

@Injectable()
export class StripeCheckoutClient {
  async createCheckoutSession(input: StripeCheckoutSessionRequest): Promise<StripeCheckoutSessionResult> {
    const stripe = new Stripe(stripeSecret());
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.bookingId,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { bookingId: input.bookingId },
        payment_intent_data: { metadata: { bookingId: input.bookingId } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: input.amountCents,
              product_data: { name: input.listingTitle }
            }
          }
        ]
      },
      { idempotencyKey: `booking:${input.bookingId}:checkout-session` }
    );

    if (!session.url) {
      throw new ServiceUnavailableException("Stripe Checkout did not return a hosted URL");
    }

    return {
      id: session.id,
      url: session.url,
      paymentIntentId: stripePaymentIntentId(session.payment_intent)
    };
  }

  async expireCheckoutSession(sessionId: string): Promise<void> {
    const stripe = new Stripe(stripeSecret());
    await stripe.checkout.sessions.expire(sessionId);
  }
}

function stripePaymentIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | null {
  if (!paymentIntent) return null;
  if (typeof paymentIntent === "string") return paymentIntent;
  return paymentIntent.id;
}
