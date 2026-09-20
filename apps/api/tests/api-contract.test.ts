import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import { createHash, createHmac } from "node:crypto";
import { AuthController } from "../src/auth/auth.controller.js";
import { AuthLoginIdentityRateLimiter, AuthLoginIpRateLimiter, AuthRefreshIpRateLimiter, AuthRefreshSessionRateLimiter } from "../src/auth/auth-rate-limit.js";
import { DEMO_BUSINESS_ID, DEMO_BUSINESS_SLUG } from "../src/common/tenant.js";
import { prefixedId } from "../src/common/ids.js";
import { DashboardService } from "../src/dashboard/dashboard.service.js";
import { ListingService } from "../src/listings/listing.service.js";
import { PaymentController } from "../src/payments/payment.controller.js";
import { PublicService } from "../src/public/public.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("dashboard and public API contracts", () => {
  const prisma = new PrismaService();
  const auth = createAuthController();
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
    const overview = await dashboard.overview(DEMO_BUSINESS_ID);

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

  it("requires a tenant-scoped active operator login and rotates direct-lookup refresh tokens", async () => {
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });

    await withEnv({ JWT_ACCESS_SECRET: "api-contract-auth-secret" }, async () => {
      await expect(auth.login({ email: "owner@example-tours.invalid", password: "local-password" })).rejects.toThrow("Bad Request");
      await expect(auth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "owner@example-tours.invalid", password: "local-password", extra: true })).rejects.toThrow("Bad Request");

      const login = await auth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "owner@example-tours.invalid", password: "local-password" });
      expect(login.ok).toBe(true);
      if (!("refreshToken" in login)) throw new Error("Expected successful login");
      expect(login.accessToken).toEqual(expect.any(String));
      expect(login.refreshToken).toMatch(/^v1\.ses_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/);
      expect(await prisma.auditLog.count({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: "auth.login" } })).toBe(1);

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
      expect(refresh.refreshToken).toMatch(/^v1\.ses_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/);

      const revoked = await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: { not: null } } });
      expect(revoked).toBe(1);
      expect(await prisma.auditLog.count({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: "auth.refresh" } })).toBe(1);

      const logout = await auth.logout({ refreshToken: refresh.refreshToken });
      expect(logout.ok).toBe(true);
      const activeSessions = await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: null } });
      expect(activeSessions).toBe(1);
      expect(await prisma.auditLog.count({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: "auth.logout" } })).toBe(1);
      await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });
      await prisma.auditLog.deleteMany({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: { in: ["auth.login", "auth.refresh", "auth.logout"] } } });
    });
  });

  it("revokes active operator sessions when a rotated refresh token is replayed", async () => {
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });

    await withEnv({ JWT_ACCESS_SECRET: "api-contract-auth-secret" }, async () => {
      const login = await auth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "owner@example-tours.invalid", password: "local-password" });
      if (!("refreshToken" in login)) throw new Error("Expected successful login");

      const refresh = await auth.refresh({ refreshToken: login.refreshToken });
      if (!("refreshToken" in refresh)) throw new Error("Expected successful refresh");
      expect(await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: null } })).toBe(1);

      await expect(auth.refresh({ refreshToken: login.refreshToken })).resolves.toEqual({ ok: false, error: "Invalid refresh token" });
      expect(await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: null } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: "auth.refresh_reuse_revoked" } })).toBe(1);

      await expect(auth.refresh({ refreshToken: refresh.refreshToken })).resolves.toEqual({ ok: false, error: "Invalid refresh token" });
      await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });
      await prisma.auditLog.deleteMany({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: { in: ["auth.login", "auth.refresh", "auth.refresh_reuse_revoked"] } } });
    });
  });

  it("revokes successor sessions when refresh token rotation races", async () => {
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });

    await withEnv({ JWT_ACCESS_SECRET: "api-contract-auth-secret" }, async () => {
      const login = await auth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "owner@example-tours.invalid", password: "local-password" });
      if (!("refreshToken" in login)) throw new Error("Expected successful login");

      const results = await Promise.all([auth.refresh({ refreshToken: login.refreshToken }), auth.refresh({ refreshToken: login.refreshToken })]);
      expect(results.filter((result) => result.ok).length).toBe(1);
      expect(results.filter((result) => !result.ok).length).toBe(1);
      expect(await prisma.session.count({ where: { userId: "usr_demo_owner", revokedAt: null } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: "auth.refresh_reuse_revoked" } })).toBe(1);

      await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });
      await prisma.auditLog.deleteMany({ where: { businessId: DEMO_BUSINESS_ID, userId: "usr_demo_owner", action: { in: ["auth.login", "auth.refresh", "auth.refresh_reuse_revoked"] } } });
    });
  });

  it("rejects logins for a different tenant or a disabled operator", async () => {
    const businessId = prefixedId("biz");
    const businessSlug = `auth-${businessId.replace("_", "-")}`;
    const activeUserId = prefixedId("usr");
    const disabledUserId = prefixedId("usr");
    await prisma.business.create({ data: { id: businessId, name: "Auth isolation fixture", slug: businessSlug, status: "active" } });
    await prisma.user.createMany({
      data: [
        { id: activeUserId, businessId, email: "other-tenant-owner@example.invalid", passwordHash: await argon2.hash("local-password"), role: "owner", status: "active" },
        { id: disabledUserId, businessId, email: "disabled-operator@example.invalid", passwordHash: await argon2.hash("local-password"), role: "owner", status: "disabled" }
      ]
    });

    try {
      await withEnv({ JWT_ACCESS_SECRET: "api-contract-auth-secret" }, async () => {
        await expect(auth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "other-tenant-owner@example.invalid", password: "local-password" })).resolves.toEqual({ ok: false, error: "Invalid credentials" });
        await expect(auth.login({ businessSlug, email: "disabled-operator@example.invalid", password: "local-password" })).resolves.toEqual({ ok: false, error: "Invalid credentials" });
        await prisma.business.update({ where: { id: businessId }, data: { status: "suspended" } });
        await expect(auth.login({ businessSlug, email: "other-tenant-owner@example.invalid", password: "local-password" })).resolves.toEqual({ ok: false, error: "Invalid credentials" });
      });
    } finally {
      await prisma.auditLog.deleteMany({ where: { businessId } });
      await prisma.session.deleteMany({ where: { businessId } });
      await prisma.user.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { id: businessId } });
    }
  });

  it("rate limits login and refresh before expensive credential verification", async () => {
    await prisma.session.deleteMany({ where: { userId: "usr_demo_owner" } });

    await withEnv(
      {
        JWT_ACCESS_SECRET: "api-contract-auth-secret",
        AUTH_LOGIN_IP_RATE_LIMIT: "1",
        AUTH_LOGIN_IDENTITY_RATE_LIMIT: "1",
        AUTH_REFRESH_IP_RATE_LIMIT: "1",
        AUTH_REFRESH_SESSION_RATE_LIMIT: "1",
        AUTH_RATE_LIMIT_WINDOW_SECONDS: "900",
        AUTH_RATE_LIMIT_MAX_KEYS: "100"
      },
      async () => {
        const limitedAuth = createAuthController();
        await expect(limitedAuth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "owner@example-tours.invalid", password: "wrong-password" })).resolves.toEqual({
          ok: false,
          error: "Invalid credentials"
        });
        await expect(limitedAuth.login({ businessSlug: DEMO_BUSINESS_SLUG, email: "owner@example-tours.invalid", password: "local-password" })).rejects.toThrow("Too many login attempts");

        const refreshToken = `v1.${prefixedId("ses")}.${"a".repeat(43)}`;
        await expect(limitedAuth.refresh({ refreshToken })).resolves.toEqual({ ok: false, error: "Invalid refresh token" });
        await expect(limitedAuth.refresh({ refreshToken })).rejects.toThrow("Too many refresh attempts");
      }
    );
  });

  it("creates a capacity hold and checkout keeps booking pending until payment confirmation", async () => {
    await withEnv({ ALLOW_MOCK_PAYMENTS: "true", STRIPE_SECRET_KEY: undefined }, async () => {
      const quote = await publicApi.quote({
        listingId: "lst_harbor_kayak_tour",
        date: dateAfterDays(14),
        startTime: "9:30 AM",
        adults: 2,
        children: 1,
        addOns: []
      });

      expect(quote.quote.platformFeeCents).toBe(Math.round(quote.quote.subtotalCents * 0.06));

      const checkout = await publicApi.checkout({
        holdId: quote.holdId,
        listingId: "lst_harbor_kayak_tour",
        date: dateAfterDays(14),
        startTime: "9:30 AM",
        adults: 2,
        children: 1,
        addOns: [],
        customer: { name: "API Tester", email: "tester@example.com" }
      });

      try {
        expect(checkout.status).toBe("pending_payment");
        expect(checkout.confirmationUrl).toMatch(new RegExp(`/public/bookings/${checkout.bookingId}/confirmation\\?receiptToken=[A-Za-z0-9_-]{43}$`));
        const receiptToken = new URL(checkout.confirmationUrl).searchParams.get("receiptToken");
        if (!receiptToken) throw new Error("Expected receipt token in confirmation URL");
        await expect(publicApi.confirmation(checkout.bookingId, receiptToken)).rejects.toThrow("Confirmed booking not found");
        await expect(
          publicApi.checkout({
            holdId: quote.holdId,
            listingId: "lst_harbor_kayak_tour",
            date: dateAfterDays(14),
            startTime: "9:30 AM",
            adults: 2,
            children: 1,
            addOns: [],
            customer: { name: "API Tester", email: "tester@example.com" }
          })
        ).rejects.toThrow();

        const availability = await publicApi.availability("lst_harbor_kayak_tour", dateAfterDays(14));
        expect(availability.slots.find((slot) => slot.startTime === "9:30 AM")?.capacityRemaining).toBeLessThan(12);

        const confirmation = await payments.mockConfirm({ bookingId: checkout.bookingId, providerEventId: "evt_test_confirm" });
        expect(confirmation).toEqual({ ok: true, duplicate: false, bookingId: checkout.bookingId });
        const duplicate = await payments.mockConfirm({ bookingId: checkout.bookingId, providerEventId: "evt_test_confirm" });
        expect(duplicate).toEqual({ ok: true, duplicate: true, bookingId: checkout.bookingId });
        const confirmed = await prisma.booking.findUniqueOrThrow({ where: { id: checkout.bookingId } });
        expect(confirmed.status).toBe("confirmed");
        expect(confirmed.receiptTokenHash).toBe(createHash("sha256").update(receiptToken).digest("hex"));
        await expect(publicApi.confirmation(checkout.bookingId, undefined)).rejects.toThrow("Confirmed booking not found");
        await expect(publicApi.confirmation(checkout.bookingId, "not-a-token")).rejects.toThrow("Confirmed booking not found");
        await expect(publicApi.confirmation(checkout.bookingId, "A".repeat(43))).rejects.toThrow("Confirmed booking not found");
        await expect(publicApi.confirmation(checkout.bookingId, receiptToken)).resolves.toEqual({
          id: checkout.bookingId,
          status: "confirmed",
          listing: "Harbor Kayak Tour",
          totalCents: confirmed.totalCents
        });
        const auditLogs = await prisma.auditLog.findMany({ where: { entityId: checkout.bookingId } });
        expect(JSON.stringify(auditLogs)).not.toContain(receiptToken);
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
      date: dateAfterDays(15),
      startTime: "9:30 AM",
      adults: 1,
      children: 0,
      addOns: []
    });

    await withEnv({ ALLOW_MOCK_PAYMENTS: undefined, NODE_ENV: "production", STRIPE_SECRET_KEY: undefined }, async () => {
      await expect(
        publicApi.checkout({
          holdId: quote.holdId,
          listingId: "lst_harbor_kayak_tour",
          date: dateAfterDays(15),
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

  it("creates Stripe Checkout sessions bound to the pending booking amount and currency", async () => {
    const fakeStripe = new FakeStripeCheckoutClient();
    const stripePublicApi = new PublicService(prisma, fakeStripe);

    await withEnv({ STRIPE_SECRET_KEY: "sk_test_checkout_binding", STRIPE_WEBHOOK_SECRET: "whsec_checkout_binding", ALLOW_MOCK_PAYMENTS: "true", APP_BASE_URL: "https://app.availo.test" }, async () => {
      const quote = await stripePublicApi.quote({
        listingId: "lst_harbor_kayak_tour",
        date: dateAfterDays(17),
        startTime: "9:30 AM",
        adults: 2,
        children: 0,
        addOns: []
      });

      const checkout = await stripePublicApi.checkout({
        holdId: quote.holdId,
        listingId: "lst_harbor_kayak_tour",
        date: dateAfterDays(17),
        startTime: "9:30 AM",
        adults: 2,
        children: 0,
        addOns: [],
        customer: { name: "Stripe Checkout", email: "stripe-checkout@example.com" }
      });

      try {
        expect(checkout.checkoutUrl).toBe("https://checkout.stripe.test/session");
        expect(fakeStripe.lastRequest).toMatchObject({
          bookingId: checkout.bookingId,
          customerEmail: "stripe-checkout@example.com",
          amountCents: quote.quote.totalCents,
          currency: "usd",
          successUrl: expect.stringMatching(new RegExp(`^https://app\\.availo\\.test/bookings/${checkout.bookingId}/confirmation\\?receiptToken=[A-Za-z0-9_-]{43}$`))
        });
        expect((fakeStripe.lastRequest as { expiresAt: Date }).expiresAt.getTime() - Date.now()).toBeGreaterThan(30 * 60 * 1000);
        const booking = await prisma.booking.findUniqueOrThrow({ where: { id: checkout.bookingId } });
        expect(booking).toMatchObject({
          paymentProvider: "stripe",
          paymentReferenceId: "cs_test_bound",
          paymentIntentId: "pi_test_bound",
          paymentExpectedAmountCents: quote.quote.totalCents,
          paymentExpectedCurrency: "usd"
        });
        const receiptToken = new URL(checkout.confirmationUrl).searchParams.get("receiptToken");
        expect(booking.receiptTokenHash).toBe(createHash("sha256").update(receiptToken ?? "").digest("hex"));
      } finally {
        await cleanupBooking(checkout.bookingId);
        await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
      }
    });
  });

  it("fails closed for Stripe checkout until webhook confirmation is configured", async () => {
    const fakeStripe = new FakeStripeCheckoutClient();
    const stripePublicApi = new PublicService(prisma, fakeStripe);
    const quote = await stripePublicApi.quote({
      listingId: "lst_harbor_kayak_tour",
      date: dateAfterDays(18),
      startTime: "9:30 AM",
      adults: 1,
      children: 0,
      addOns: []
    });

    try {
      await withEnv({ STRIPE_SECRET_KEY: "sk_test_without_webhook", STRIPE_WEBHOOK_SECRET: undefined, ALLOW_MOCK_PAYMENTS: undefined }, async () => {
        await expect(
          stripePublicApi.checkout({
            holdId: quote.holdId,
            listingId: "lst_harbor_kayak_tour",
            date: dateAfterDays(18),
            startTime: "9:30 AM",
            adults: 1,
            children: 0,
            addOns: [],
            customer: { name: "Stripe Missing Webhook", email: "stripe-missing-webhook@example.com" }
          })
        ).rejects.toThrow("Stripe webhooks are not configured");
      });

      expect(fakeStripe.lastRequest).toBeUndefined();
      expect(await prisma.bookingHold.count({ where: { id: quote.holdId } })).toBe(1);
      expect(await prisma.booking.count({ where: { customerEmail: "stripe-missing-webhook@example.com" } })).toBe(0);
    } finally {
      await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
      await prisma.booking.deleteMany({ where: { customerEmail: "stripe-missing-webhook@example.com" } });
    }
  });

  it("expires a created Stripe session when booking persistence cannot bind it", async () => {
    const fakeStripe = new FakeStripeCheckoutClient(async (bookingId) => {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: "failed", paymentStatus: "failed" } });
    });
    const stripePublicApi = new PublicService(prisma, fakeStripe);

    await withEnv({ STRIPE_SECRET_KEY: "sk_test_checkout_binding", STRIPE_WEBHOOK_SECRET: "whsec_checkout_binding", APP_BASE_URL: "https://app.availo.test" }, async () => {
      const quote = await stripePublicApi.quote({
        listingId: "lst_harbor_kayak_tour",
        date: dateAfterDays(19),
        startTime: "9:30 AM",
        adults: 1,
        children: 0,
        addOns: []
      });

      try {
        await expect(
          stripePublicApi.checkout({
            holdId: quote.holdId,
            listingId: "lst_harbor_kayak_tour",
            date: dateAfterDays(19),
            startTime: "9:30 AM",
            adults: 1,
            children: 0,
            addOns: [],
            customer: { name: "Stripe Bind Failure", email: "stripe-bind-failure@example.com" }
          })
        ).rejects.toThrow("Stripe Checkout could not be attached to this booking");

        expect(fakeStripe.expiredSessions).toEqual(["cs_test_bound"]);
        const booking = await prisma.booking.findFirstOrThrow({ where: { customerEmail: "stripe-bind-failure@example.com" } });
        expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "payment.checkout_failed" } })).toBe(1);
      } finally {
        await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
        await prisma.booking.deleteMany({ where: { customerEmail: "stripe-bind-failure@example.com" } });
      }
    });
  });

  it("does not let mock confirmation settle Stripe-bound bookings", async () => {
    const booking = await createPendingBooking("stripe-not-mock@example.com");
    try {
      await withEnv({ ALLOW_MOCK_PAYMENTS: "true", STRIPE_SECRET_KEY: undefined }, async () => {
        await expect(payments.mockConfirm({ bookingId: booking.id, providerEventId: "evt_mock_cross_provider" })).rejects.toThrow("Booking is not awaiting payment");
      });

      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(0);
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("fails closed for legacy confirmed bookings without receipt tokens", async () => {
    const legacy = await createPendingBooking("legacy-confirmation-token@example.com");
    try {
      await prisma.booking.update({
        where: { id: legacy.id },
        data: { status: "confirmed", paymentStatus: "paid", receiptTokenHash: null }
      });
      await expect(publicApi.confirmation(legacy.id, "A".repeat(43))).rejects.toThrow("Confirmed booking not found");
    } finally {
      await cleanupBooking(legacy.id);
    }
  });

  it("hides tokenized confirmations after the operator business is suspended", async () => {
    const fixture = await createConfirmedReceiptFixture("suspended-business-confirmation@example.com");
    const receiptToken = "B".repeat(43);
    try {
      await expect(publicApi.confirmation(fixture.bookingId, receiptToken)).resolves.toMatchObject({ id: fixture.bookingId, status: "confirmed" });

      await prisma.business.update({ where: { id: fixture.businessId }, data: { status: "suspended" } });
      await expect(publicApi.confirmation(fixture.bookingId, receiptToken)).rejects.toThrow("Confirmed booking not found");
    } finally {
      await cleanupReceiptFixture(fixture);
    }
  });

  it("verifies Stripe webhooks before confirming pending bookings", async () => {
    const booking = await createPendingBooking("stripe-valid@example.com");
    const body = stripeWebhookBody("evt_stripe_valid", "checkout.session.completed", booking, { payment_status: "paid" });

    await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
      const result = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
      expect(result).toEqual({ ok: true, duplicate: false, bookingId: booking.id });
      const duplicate = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
      expect(duplicate).toEqual({ ok: true, duplicate: true, bookingId: booking.id });
      const relatedBody = stripeWebhookBody("evt_stripe_related_success", "payment_intent.succeeded", booking);
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
    const body = stripeWebhookBody("evt_stripe_invalid", "checkout.session.completed", booking, { payment_status: "paid" });

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
    const ignoredBody = stripeWebhookBody("evt_stripe_ignored", "payment_intent.created", ignoredBooking);
    const unpaidCheckoutBody = stripeWebhookBody("evt_stripe_unpaid_checkout", "checkout.session.completed", ignoredBooking, { payment_status: "unpaid" });

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
    const canceledBody = stripeWebhookBody("evt_stripe_canceled", "payment_intent.succeeded", canceledBooking);
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
    const body = stripeWebhookBody("evt_stripe_expired", "payment_intent.succeeded", booking);

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

  it("confirms Stripe payments completed before expiry even when webhook delivery is delayed", async () => {
    const booking = await createPendingBooking("stripe-delayed-webhook@example.com");
    const paymentExpiresAt = new Date(Date.now() - 60_000);
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentExpiresAt } });
    const delayedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const body = stripeWebhookBody("evt_stripe_delayed_before_expiry", "checkout.session.completed", delayedBooking, {
      payment_status: "paid",
      created: Math.floor((paymentExpiresAt.getTime() - 10_000) / 1000)
    });

    try {
      await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
        const result = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
        expect(result).toEqual({ ok: true, duplicate: false, bookingId: booking.id });
      });

      const confirmed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.paymentStatus).toBe("paid");
    } finally {
      await cleanupBooking(booking.id);
    }
  });

  it("records verified Stripe money or provider ID mismatches without confirming the booking", async () => {
    const booking = await createPendingBooking("stripe-mismatch@example.com");
    const body = stripeWebhookBody("evt_stripe_amount_mismatch", "checkout.session.completed", booking, { payment_status: "paid", amount_total: booking.totalCents + 1 });

    try {
      await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }, async () => {
        const result = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_test_secret"), { rawBody: Buffer.from(body) });
        expect(result).toEqual({ ok: true, ignored: true, bookingId: booking.id });
      });

      const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(unchanged.status).toBe("pending_payment");
      expect(unchanged.paymentStatus).toBe("pending");
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(1);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: booking.id, action: "payment.ignored" } });
      expect(audit.metadataJson).toContain("stripe_amount_mismatch");
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
    await expect(
      listingService.update({ userId: "usr_demo_owner", businessId: DEMO_BUSINESS_ID, role: "owner", sessionId: "ses_direct_service_test" }, "lst_harbor_kayak_tour", { minGuests: 99 })
    ).rejects.toThrow("minGuests cannot be greater than maxGuests");
  });

  async function createPendingBooking(customerEmail: string) {
    return prisma.booking.create({
      data: {
        id: prefixedId("bok"),
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        customerName: "Payment Tester",
        customerEmail,
        bookingDate: dateAfterDays(16),
        startTime: "11:00 AM",
        endTime: "12:00 PM",
        guestCount: 1,
        adultCount: 1,
        childCount: 0,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentProvider: "stripe",
        paymentReferenceId: prefixedId("cs"),
        paymentIntentId: prefixedId("pi"),
        paymentExpectedAmountCents: 7443,
        paymentExpectedCurrency: "usd",
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        subtotalCents: 6500,
        taxCents: 553,
        platformFeeCents: 390,
        totalCents: 7443
      }
    });
  }

  async function createConfirmedReceiptFixture(customerEmail: string) {
    const businessId = prefixedId("biz");
    const listingId = prefixedId("lst");
    const bookingId = prefixedId("bok");
    const receiptToken = "B".repeat(43);
    await prisma.business.create({
      data: {
        id: businessId,
        name: "Receipt Fixture Tours",
        slug: `receipt-fixture-${businessId}`,
        status: "active",
        timezone: "America/Denver",
        currency: "USD"
      }
    });
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId,
        title: "Receipt Fixture Tour",
        description: "Receipt token fixture",
        category: "Tour",
        status: "active",
        basePriceCents: 6500,
        durationMinutes: 60,
        minGuests: 1,
        maxGuests: 6,
        capacity: 6,
        imageUrlsJson: "[]"
      }
    });
    await prisma.booking.create({
      data: {
        id: bookingId,
        businessId,
        listingId,
        customerName: "Receipt Tester",
        customerEmail,
        bookingDate: dateAfterDays(16),
        startTime: "11:00 AM",
        endTime: "12:00 PM",
        guestCount: 1,
        adultCount: 1,
        childCount: 0,
        status: "confirmed",
        paymentStatus: "paid",
        receiptTokenHash: createHash("sha256").update(receiptToken).digest("hex"),
        subtotalCents: 6500,
        taxCents: 553,
        platformFeeCents: 390,
        totalCents: 7443
      }
    });
    return { businessId, listingId, bookingId };
  }

  async function cleanupBooking(bookingId: string) {
    await prisma.paymentEvent.deleteMany({ where: { bookingId } });
    await prisma.auditLog.deleteMany({ where: { entityId: bookingId } });
    await prisma.booking.deleteMany({ where: { id: bookingId } });
  }

  async function cleanupReceiptFixture(fixture: { businessId: string; listingId: string; bookingId: string }) {
    await cleanupBooking(fixture.bookingId);
    await prisma.listing.deleteMany({ where: { id: fixture.listingId } });
    await prisma.business.deleteMany({ where: { id: fixture.businessId } });
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

  function stripeWebhookBody(eventId: string, eventType: string, booking: Awaited<ReturnType<typeof createPendingBooking>>, objectFields: Record<string, string | number> = {}) {
    const isCheckoutSession = eventType === "checkout.session.completed";
    const objectId = isCheckoutSession ? booking.paymentReferenceId : booking.paymentIntentId;
    const moneyField = isCheckoutSession ? { amount_total: booking.paymentExpectedAmountCents } : { amount_received: booking.paymentExpectedAmountCents };
    const { created = Math.floor(Date.now() / 1000), ...stripeObjectFields } = objectFields;
    return JSON.stringify({
      id: eventId,
      created,
      type: eventType,
      data: {
        object: {
          id: objectId,
          currency: booking.paymentExpectedCurrency,
          client_reference_id: booking.id,
          payment_intent: booking.paymentIntentId,
          ...moneyField,
          ...stripeObjectFields,
          metadata: { bookingId: booking.id }
        }
      }
    });
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

  function createAuthController() {
    return new AuthController(
      prisma,
      new AuthLoginIpRateLimiter(),
      new AuthLoginIdentityRateLimiter(),
      new AuthRefreshIpRateLimiter(),
      new AuthRefreshSessionRateLimiter()
    );
  }

  class FakeStripeCheckoutClient {
    lastRequest: unknown;
    expiredSessions: string[] = [];

    constructor(private readonly beforeReturn?: (bookingId: string) => Promise<void>) {}

    async createCheckoutSession(input: { bookingId: string }) {
      this.lastRequest = input;
      await this.beforeReturn?.(input.bookingId);
      return { id: "cs_test_bound", url: "https://checkout.stripe.test/session", paymentIntentId: "pi_test_bound" };
    }

    async expireCheckoutSession(sessionId: string) {
      this.expiredSessions.push(sessionId);
    }
  }
});
