import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import { createHmac } from "node:crypto";
import { AuthController } from "../src/auth/auth.controller.js";
import { DEMO_BUSINESS_ID, DEMO_BUSINESS_SLUG } from "../src/common/tenant.js";
import { prefixedId } from "../src/common/ids.js";
import { DashboardService } from "../src/dashboard/dashboard.service.js";
import { ListingService } from "../src/listings/listing.service.js";
import { PaymentController } from "../src/payments/payment.controller.js";
import { PublicService } from "../src/public/public.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("dashboard and public API contracts", () => {
  const prisma = new PrismaService();
  const auth = new AuthController(prisma);
  const dashboard = new DashboardService(prisma);
  const payments = new PaymentController(prisma);
  const publicApi = new PublicService(prisma);
  const listingService = new ListingService(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns dashboard data in the active frontend shape", async () => {
    const overview = await dashboard.overview();

    expect(overview.stats[0]).toMatchObject({ label: "Bookings this month" });
    expect(overview.listings[0]).toMatchObject({
      title: "Harbor Kayak Tour",
      type: "Tour · 1 hour",
      price: "$65/guest",
      capacity: 12,
      status: "active"
    });
    expect(overview.bookings[0]).toEqual(
      expect.objectContaining({
        initials: expect.any(String),
        name: expect.any(String),
        listing: expect.any(String),
        date: expect.stringContaining("·"),
        guests: expect.any(Number),
        total: expect.stringMatching(/^\$/),
        status: expect.stringMatching(/confirmed|pending/)
      })
    );
  });

  it("returns only public-safe business and listing fields", async () => {
    const response = await publicApi.businessListings(DEMO_BUSINESS_SLUG);

    expect(response.business).toEqual(
      expect.objectContaining({
        name: "Sample Tours Co.",
        slug: DEMO_BUSINESS_SLUG
      })
    );
    expect(response.business).not.toHaveProperty("ownerUserId");
    expect(response.business).not.toHaveProperty("taxRateBps");
    expect(response.listings[0]).not.toHaveProperty("businessId");
    expect(response.listings[0]).not.toHaveProperty("internalNotes");
  });

  it("logs in, rotates refresh sessions, and logs out", async () => {
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });

    const login = await auth.login({ email: "owner@example-tours.invalid", password: "local-password" });
    expect(login.ok).toBe(true);
    if (!("refreshToken" in login)) throw new Error("Expected successful login");
    expect(login.accessToken).toEqual(expect.any(String));
    expect(login.refreshToken).toEqual(expect.any(String));

    await prisma.session.create({
      data: {
        id: prefixedId("ses"),
        userId: "usr_demo_owner",
        businessId: DEMO_BUSINESS_ID,
        refreshTokenHash: await argon2.hash("not-the-presented-refresh-token"),
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    const refresh = await auth.refresh({ refreshToken: login.refreshToken });
    expect(refresh.ok).toBe(true);
    if (!("refreshToken" in refresh)) throw new Error("Expected successful refresh");
    expect(refresh.refreshToken).not.toBe(login.refreshToken);

    const revoked = await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: { not: null } } });
    expect(revoked).toBe(1);

    const logout = await auth.logout({ refreshToken: refresh.refreshToken });
    expect(logout.ok).toBe(true);
    const activeSessions = await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: null } });
    expect(activeSessions).toBe(1);
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });
  });

  it("creates a capacity hold and checkout keeps booking pending until payment confirmation", async () => {
    await withEnv({ ALLOW_MOCK_PAYMENTS: "true" }, async () => {
      const quote = await publicApi.quote({
        listingId: "lst_harbor_kayak_tour",
        date: "2026-05-12",
        startTime: "9:30 AM",
        adults: 2,
        children: 1,
        addOns: []
      });

      expect(quote.quote.platformFeeCents).toBe(Math.round(quote.quote.subtotalCents * 0.06));

      const checkout = await publicApi.checkout({
        holdId: quote.holdId,
        listingId: "lst_harbor_kayak_tour",
        date: "2026-05-12",
        startTime: "9:30 AM",
        adults: 2,
        children: 1,
        addOns: [],
        customer: { name: "API Tester", email: "tester@example.com" }
      });

      try {
        expect(checkout.status).toBe("pending_payment");
        await expect(
          publicApi.checkout({
            holdId: quote.holdId,
            listingId: "lst_harbor_kayak_tour",
            date: "2026-05-12",
            startTime: "9:30 AM",
            adults: 2,
            children: 1,
            addOns: [],
            customer: { name: "API Tester", email: "tester@example.com" }
          })
        ).rejects.toThrow();

        const availability = await publicApi.availability("lst_harbor_kayak_tour", "2026-05-12");
        expect(availability.slots.find((slot) => slot.startTime === "9:30 AM")?.capacityRemaining).toBeLessThan(12);

        const confirmation = await payments.mockConfirm({ bookingId: checkout.bookingId, providerEventId: "evt_test_confirm" });
        expect(confirmation).toEqual({ ok: true, duplicate: false, bookingId: checkout.bookingId });
        const duplicate = await payments.mockConfirm({ bookingId: checkout.bookingId, providerEventId: "evt_test_confirm" });
        expect(duplicate).toEqual({ ok: true, duplicate: true, bookingId: checkout.bookingId });
        const confirmed = await prisma.booking.findUniqueOrThrow({ where: { id: checkout.bookingId } });
        expect(confirmed.status).toBe("confirmed");
      } finally {
        await prisma.paymentEvent.deleteMany({ where: { bookingId: checkout.bookingId } });
        await prisma.booking.deleteMany({ where: { customerEmail: "tester@example.com" } });
        await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
        await prisma.auditLog.deleteMany({ where: { entityId: checkout.bookingId } });
      }
    });
  });

  it("keeps mock payments disabled by default and in production", async () => {
    const quote = await publicApi.quote({
      listingId: "lst_harbor_kayak_tour",
      date: "2026-05-13",
      startTime: "9:30 AM",
      adults: 1,
      children: 0,
      addOns: []
    });

    await withEnv({ ALLOW_MOCK_PAYMENTS: undefined, NODE_ENV: "production" }, async () => {
      await expect(
        publicApi.checkout({
          holdId: quote.holdId,
          listingId: "lst_harbor_kayak_tour",
          date: "2026-05-13",
          startTime: "9:30 AM",
          adults: 1,
          children: 0,
          addOns: [],
          customer: { name: "Production Tester", email: "prod-checkout@example.com" }
        })
      ).rejects.toThrow("Payment provider is not configured");
    });

    const booking = await createPendingBooking("prod-mock-blocked@example.com");
    try {
      await withEnv({ ALLOW_MOCK_PAYMENTS: undefined, NODE_ENV: "production" }, async () => {
        await expect(payments.mockConfirm({ bookingId: booking.id, providerEventId: "evt_prod_mock_blocked" })).rejects.toThrow("Mock payments are disabled");
      });
      await withEnv({ ALLOW_MOCK_PAYMENTS: "true", NODE_ENV: "production" }, async () => {
        await expect(payments.mockConfirm({ bookingId: booking.id, providerEventId: "evt_prod_mock_forced" })).rejects.toThrow("Mock payments are disabled");
      });

      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "payment.confirmed" } })).toBe(0);
    } finally {
      await cleanupBooking(booking.id);
      await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
    }
  });

  it("verifies Stripe webhooks before confirming pending bookings", async () => {
    const booking = await createPendingBooking("stripe-valid@example.com");
    const body = stripeWebhookBody("evt_stripe_valid", "checkout.session.completed", booking.id, { payment_status: "paid" });

    await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
      const result = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
      expect(result).toEqual({ ok: true, duplicate: false, bookingId: booking.id });
      const duplicate = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
      expect(duplicate).toEqual({ ok: true, duplicate: true, bookingId: booking.id });
      const relatedBody = stripeWebhookBody("evt_stripe_related_success", "payment_intent.succeeded", booking.id);
      const related = await payments.stripeWebhook(JSON.parse(relatedBody), stripeSignature(relatedBody, "whsec_test_secret"), { rawBody: Buffer.from(relatedBody) });
      expect(related).toEqual({ ok: true, ignored: true, bookingId: booking.id });
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(2);
    });

    const confirmed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.paymentStatus).toBe("paid");

    await cleanupBooking(booking.id);
  });

  it("rejects invalid Stripe signatures without mutating payment state", async () => {
    const booking = await createPendingBooking("stripe-invalid@example.com");
    const body = stripeWebhookBody("evt_stripe_invalid", "checkout.session.completed", booking.id);

    try {
      await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
        await expect(payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "wrong_secret"), { rawBody: Buffer.from(body) })).rejects.toThrow(
          "Invalid Stripe signature"
        );
      });

      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(0);
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("ignores unsupported Stripe events and refuses to resurrect settled bookings", async () => {
    const ignoredBooking = await createPendingBooking("stripe-ignored@example.com");
    const ignoredBody = stripeWebhookBody("evt_stripe_ignored", "payment_intent.created", ignoredBooking.id);
    const unpaidCheckoutBody = stripeWebhookBody("evt_stripe_unpaid_checkout", "checkout.session.completed", ignoredBooking.id, { payment_status: "unpaid" });

    await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
      const result = await payments.stripeWebhook(JSON.parse(ignoredBody), stripeSignature(ignoredBody, "whsec_test_secret"), { rawBody: Buffer.from(ignoredBody) });
      expect(result).toEqual({ ok: true, ignored: true });
      const unpaidCheckout = await payments.stripeWebhook(JSON.parse(unpaidCheckoutBody), stripeSignature(unpaidCheckoutBody, "whsec_test_secret"), {
        rawBody: Buffer.from(unpaidCheckoutBody)
      });
      expect(unpaidCheckout).toEqual({ ok: true, ignored: true });
    });
    const ignored = await prisma.booking.findUniqueOrThrow({ where: { id: ignoredBooking.id } });
    expect(ignored.status).toBe("pending_payment");
    expect(await prisma.paymentEvent.count({ where: { bookingId: ignoredBooking.id } })).toBe(0);

    const canceledBooking = await createPendingBooking("stripe-canceled@example.com");
    await prisma.booking.update({ where: { id: canceledBooking.id }, data: { status: "canceled", paymentStatus: "failed" } });
    const canceledBody = stripeWebhookBody("evt_stripe_canceled", "payment_intent.succeeded", canceledBooking.id);
    try {
      await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
        const result = await payments.stripeWebhook(JSON.parse(canceledBody), stripeSignature(canceledBody, "whsec_test_secret"), { rawBody: Buffer.from(canceledBody) });
        expect(result).toEqual({ ok: true, ignored: true, bookingId: canceledBooking.id });
      });
      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: canceledBooking.id } });
      expect(unchanged.status).toBe("canceled");
      expect(unchanged.paymentStatus).toBe("failed");
      expect(await prisma.paymentEvent.count({ where: { bookingId: canceledBooking.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: canceledBooking.id, action: "payment.ignored" } })).toBe(1);
    } finally {
      await cleanupBooking(ignoredBooking.id);
      await cleanupBooking(canceledBooking.id);
    }
  });

  it("records verified Stripe payments received after pending payment expiry", async () => {
    const booking = await createPendingBooking("stripe-expired@example.com");
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
    const body = stripeWebhookBody("evt_stripe_expired", "payment_intent.succeeded", booking.id);

    try {
      await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
        const result = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
        expect(result).toEqual({ ok: true, ignored: true, bookingId: booking.id });
      });

      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "payment.ignored" } })).toBe(1);
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("fails closed for refunds until an authenticated refund provider is configured", async () => {
    const booking = await createPendingBooking("refund-disabled@example.com");
    try {
      await expect(payments.refund(booking.id)).rejects.toThrow("Refunds are not configured");
      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "booking.refunded" } })).toBe(0);
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("rejects listing updates that would invert guest limits", async () => {
    await expect(listingService.update("lst_harbor_kayak_tour", { minGuests: 99 })).rejects.toThrow("minGuests cannot be greater than maxGuests");
  });

  async function createPendingBooking(customerEmail: string) {
    return prisma.booking.create({
      data: {
        id: prefixedId("bok"),
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        customerName: "Payment Tester",
        customerEmail,
        bookingDate: "2026-05-14",
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

  async function withEnv<T>(values: Record<string, string | undefined>, callback: () => Promise<T>) {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      return await callback();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  function stripeWebhookBody(eventId: string, eventType: string, bookingId: string, objectFields: Record<string, string> = {}) {
    return JSON.stringify({
      id: eventId,
      type: eventType,
      data: { object: { ...objectFields, metadata: { bookingId } } }
    });
  }

  function stripeSignature(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
    const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    return `t=${timestamp},v1=${digest}`;
  }
});
