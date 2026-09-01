import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { apiBodyLimit, configureApiHttp } from "../src/api-http.js";
import { AppModule } from "../src/app.module.js";
import { prefixedId } from "../src/common/ids.js";
import { DEMO_BUSINESS_ID } from "../src/common/tenant.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("HTTP body limits", () => {
  const prisma = new PrismaService();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects oversized public quote JSON before creating holds", async () => {
    const before = await prisma.bookingHold.count({ where: { listingId: "lst_harbor_kayak_tour" } });

    await withHttpApp({ API_BODY_LIMIT: "1kb" }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/public/bookings/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId: "lst_harbor_kayak_tour",
          date: dateAfterDays(14),
          startTime: "9:30 AM",
          adults: 1,
          children: 0,
          addOns: [],
          padding: "x".repeat(2_000)
        })
      });

      expect(response.status).toBe(413);
    });

    expect(await prisma.bookingHold.count({ where: { listingId: "lst_harbor_kayak_tour" } })).toBe(before);
  });

  it("rejects oversized URL-encoded bodies before creating holds", async () => {
    const before = await prisma.bookingHold.count({ where: { listingId: "lst_harbor_kayak_tour" } });

    await withHttpApp({ API_BODY_LIMIT: "1kb" }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/public/bookings/quote`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          listingId: "lst_harbor_kayak_tour",
          date: dateAfterDays(14),
          startTime: "9:30 AM",
          adults: "1",
          children: "0",
          padding: "x".repeat(2_000)
        })
      });

      expect(response.status).toBe(413);
    });

    expect(await prisma.bookingHold.count({ where: { listingId: "lst_harbor_kayak_tour" } })).toBe(before);
  });

  it("rejects oversized Stripe webhook JSON before mutating payment state", async () => {
    const booking = await createPendingBooking("stripe-oversized-body@example.invalid");
    const beforeEvents = await prisma.paymentEvent.count({ where: { bookingId: booking.id } });
    const beforeAudits = await prisma.auditLog.count({ where: { entityId: booking.id } });
    const eventId = prefixedId("evt");
    const body = JSON.stringify({
      id: eventId,
      type: "payment_intent.succeeded",
      data: { object: { metadata: { bookingId: booking.id }, padding: "x".repeat(2_000) } }
    });

    try {
      await withHttpApp({ API_BODY_LIMIT: "1kb", STRIPE_WEBHOOK_SECRET: "whsec_http_test" }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/payments/stripe/webhook`, {
          method: "POST",
          headers: { "content-type": "application/json", "stripe-signature": stripeSignature(body, "whsec_http_test") },
          body
        });

        expect(response.status).toBe(413);
      });

      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(beforeEvents);
      expect(await prisma.auditLog.count({ where: { entityId: booking.id } })).toBe(beforeAudits);
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("preserves Stripe rawBody bytes for valid signed webhooks under the limit", async () => {
    const booking = await createPendingBooking("stripe-valid-http-body@example.invalid");
    const eventId = prefixedId("evt");
    const body = `{
      "id": "${eventId}",
      "type": "payment_intent.succeeded",
      "data": {
        "object": {
          "metadata": {
            "bookingId": "${booking.id}"
          }
        }
      }
    }`;

    try {
      await withHttpApp({ API_BODY_LIMIT: "4kb", STRIPE_WEBHOOK_SECRET: "whsec_http_test" }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/payments/stripe/webhook`, {
          method: "POST",
          headers: { "content-type": "application/json", "stripe-signature": stripeSignature(body, "whsec_http_test") },
          body
        });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({ ok: true, bookingId: booking.id });
      });

      const confirmed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.paymentStatus).toBe("paid");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(1);
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("rejects malformed API body-limit configuration", async () => {
    await withEnv({ API_BODY_LIMIT: "0kb" }, async () => {
      expect(() => apiBodyLimit()).toThrow("API_BODY_LIMIT must be a positive size");
    });
    await withEnv({ API_BODY_LIMIT: "1.5mb" }, async () => {
      expect(() => apiBodyLimit()).toThrow("API_BODY_LIMIT must be a positive size");
    });
    await withEnv({ API_BODY_LIMIT: "256kb" }, async () => {
      expect(apiBodyLimit()).toBe("256kb");
    });
  });

  async function withHttpApp<T>(env: Record<string, string>, callback: (baseUrl: string) => Promise<T>) {
    return withEnv(env, async () => {
      const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false, logger: false });
      configureApiHttp(app);
      await app.listen(0);
      const address = app.getHttpServer().address() as AddressInfo;
      try {
        return await callback(`http://127.0.0.1:${address.port}`);
      } finally {
        await app.close();
      }
    });
  }

  async function createPendingBooking(customerEmail: string) {
    return prisma.booking.create({
      data: {
        id: prefixedId("bok"),
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        customerName: "HTTP Body Tester",
        customerEmail,
        bookingDate: dateAfterDays(14),
        startTime: "11:00 AM",
        endTime: "12:00 PM",
        guestCount: 1,
        adultCount: 1,
        childCount: 0,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentReferenceId: prefixedId("payref"),
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        subtotalCents: 6500,
        taxCents: 553,
        platformFeeCents: 390,
        totalCents: 7443
      }
    });
  }

  async function cleanupBooking(bookingId: string) {
    await prisma.paymentEvent.deleteMany({ where: { bookingId } });
    await prisma.auditLog.deleteMany({ where: { entityId: bookingId } });
    await prisma.booking.deleteMany({ where: { id: bookingId } });
  }

  async function withEnv<T>(values: Record<string, string>, callback: () => Promise<T>) {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    try {
      return await callback();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  function stripeSignature(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
    const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    return `t=${timestamp},v1=${digest}`;
  }

  function dateAfterDays(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
});
