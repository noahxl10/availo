import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { DEMO_BUSINESS_ID } from "../src/common/tenant.js";
import { prefixedId } from "../src/common/ids.js";
import { cleanupExpiredReservations, expiredReservationCleanupBatchSize } from "../src/maintenance/expired-reservations.js";
import { STRIPE_WEBHOOK_GRACE_MS } from "../src/payments/payment-config.js";
import { PaymentController } from "../src/payments/payment.controller.js";
import { PublicService } from "../src/public/public.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("expired reservation cleanup", () => {
  const prisma = new PrismaService();
  const publicApi = new PublicService(prisma);
  const payments = new PaymentController(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("deletes only expired holds in a bounded batch", async () => {
    const fixture = await createListingFixture({ capacity: 6 });
    const now = new Date("2026-09-01T00:00:00.000Z");
    const expired = await createHold(fixture, now);
    const cutoffExpired = await createHold(fixture, now);
    const active = await createHold(fixture, new Date(now.getTime() + 1));

    try {
      const result = await cleanupExpiredReservations(prisma, { now, batchSize: 1 });
      expect(result).toEqual({ expiredHoldsDeleted: 1, expiredBookingsFailed: 0 });
      expect(await prisma.bookingHold.count({ where: { id: { in: [expired.id, cutoffExpired.id] } } })).toBe(1);
      expect(await prisma.bookingHold.count({ where: { id: active.id } })).toBe(1);

      const second = await cleanupExpiredReservations(prisma, { now, batchSize: 10 });
      expect(second).toEqual({ expiredHoldsDeleted: 1, expiredBookingsFailed: 0 });
      expect(await prisma.bookingHold.count({ where: { id: active.id } })).toBe(1);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("cancels expired pending payments once and preserves active or settled bookings", async () => {
    const fixture = await createListingFixture({ capacity: 4 });
    const now = new Date("2026-09-01T00:00:00.000Z");
    const expired = await createBooking(fixture, "cleanup-expired@example.invalid", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(now.getTime() - STRIPE_WEBHOOK_GRACE_MS - 1)
    });
    const active = await createBooking(fixture, "cleanup-active@example.invalid", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(now.getTime() + 1)
    });
    const legacy = await createBooking(fixture, "cleanup-legacy@example.invalid", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentExpiresAt: null
    });
    const confirmed = await createBooking(fixture, "cleanup-confirmed@example.invalid", {
      status: "confirmed",
      paymentStatus: "paid",
      paymentExpiresAt: now
    });
    const expirer = new FakeCheckoutSessionExpirer();

    try {
      const result = await cleanupExpiredReservations(prisma, { now, batchSize: 10, checkoutSessionExpirer: expirer });
      expect(result).toEqual({ expiredHoldsDeleted: 0, expiredBookingsFailed: 1 });

      await expect(prisma.booking.findUniqueOrThrow({ where: { id: expired.id } })).resolves.toMatchObject({ status: "failed", paymentStatus: "failed", totalCents: 10600 });
      await expect(prisma.booking.findUniqueOrThrow({ where: { id: active.id } })).resolves.toMatchObject({ status: "pending_payment", paymentStatus: "pending" });
      await expect(prisma.booking.findUniqueOrThrow({ where: { id: legacy.id } })).resolves.toMatchObject({ status: "pending_payment", paymentStatus: "pending" });
      await expect(prisma.booking.findUniqueOrThrow({ where: { id: confirmed.id } })).resolves.toMatchObject({ status: "confirmed", paymentStatus: "paid" });
      expect(expirer.expiredSessions).toEqual([expired.paymentReferenceId]);

      expect(await prisma.auditLog.count({ where: { entityId: expired.id, action: "booking.payment_expired" } })).toBe(1);
      const idempotent = await cleanupExpiredReservations(prisma, { now, batchSize: 10, checkoutSessionExpirer: expirer });
      expect(idempotent).toEqual({ expiredHoldsDeleted: 0, expiredBookingsFailed: 0 });
      expect(expirer.expiredSessions).toEqual([expired.paymentReferenceId]);
      expect(await prisma.auditLog.count({ where: { entityId: expired.id, action: "booking.payment_expired" } })).toBe(1);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("keeps availability and quoting independent from cleanup timing", async () => {
    const fixture = await createListingFixture({ capacity: 2 });
    const now = new Date();
    const expiredBooking = await createBooking(fixture, "cleanup-capacity-expired@example.invalid", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(now.getTime() - STRIPE_WEBHOOK_GRACE_MS - 60_000)
    });
    const activeHold = await createHold(fixture, new Date(now.getTime() + 60_000));

    try {
      const before = await publicApi.availability(fixture.listingId, fixture.date);
      expect(before.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(0);

      await cleanupExpiredReservations(prisma, { now, batchSize: 10 });
      expect(await prisma.booking.findUniqueOrThrow({ where: { id: expiredBooking.id } })).toMatchObject({ status: "failed", paymentStatus: "failed" });
      expect(await prisma.bookingHold.count({ where: { id: activeHold.id } })).toBe(1);

      const stillHeld = await publicApi.availability(fixture.listingId, fixture.date);
      expect(stillHeld.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(0);

      await prisma.bookingHold.update({ where: { id: activeHold.id }, data: { expiresAt: new Date(now.getTime() - 1) } });
      await cleanupExpiredReservations(prisma, { now, batchSize: 10 });
      await expect(quoteExactCapacity(fixture)).resolves.toMatchObject({ holdId: expect.stringMatching(/^hold_/) });
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("keeps Stripe pending payments capacity-reserving during webhook grace only", async () => {
    const fixture = await createListingFixture({ capacity: 2 });
    const now = new Date();
    const booking = await createBooking(fixture, "cleanup-stripe-grace-capacity@example.invalid", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(now.getTime() - 60_000)
    });

    try {
      const duringGrace = await publicApi.availability(fixture.listingId, fixture.date);
      expect(duringGrace.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(0);

      await prisma.booking.update({ where: { id: booking.id }, data: { paymentExpiresAt: new Date(now.getTime() - STRIPE_WEBHOOK_GRACE_MS - 60_000) } });
      const afterGrace = await publicApi.availability(fixture.listingId, fixture.date);
      expect(afterGrace.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(2);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("records late verified payments as ignored after cleanup expires the booking", async () => {
    const fixture = await createListingFixture({ capacity: 2 });
    const now = new Date();
    const booking = await createBooking(fixture, "cleanup-late-payment@example.invalid", {
      status: "pending_payment",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(now.getTime() - STRIPE_WEBHOOK_GRACE_MS - 60_000)
    });
    const body = stripeWebhookBody(prefixedId("evt"), "payment_intent.succeeded", booking);

    try {
      await cleanupExpiredReservations(prisma, { now, batchSize: 10 });
      await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_cleanup_test" }, async () => {
        const result = await payments.stripeWebhook(JSON.parse(body), stripeSignature(body, "whsec_cleanup_test"), { rawBody: Buffer.from(body) });
        expect(result).toEqual({ ok: true, ignored: true, bookingId: booking.id });
      });

      await expect(prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).resolves.toMatchObject({ status: "failed", paymentStatus: "failed" });
      expect(await prisma.paymentEvent.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "booking.payment_expired" } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "payment.ignored" } })).toBe(1);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("validates cleanup batch-size configuration", async () => {
    await withEnv({ EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE: "2" }, async () => {
      expect(expiredReservationCleanupBatchSize()).toBe(2);
    });
    await withEnv({ EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE: "0" }, async () => {
      expect(() => expiredReservationCleanupBatchSize()).toThrow("EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE");
    });
  });

  it("has migrated indexes aligned with cleanup scans", async () => {
    const bookingIndexes = await prisma.$queryRaw<{ name: string }[]>`PRAGMA index_list("bookings")`;
    const holdIndexes = await prisma.$queryRaw<{ name: string }[]>`PRAGMA index_list("booking_holds")`;

    expect(bookingIndexes.map((index) => index.name)).toContain("bookings_status_payment_status_payment_expires_at_id_idx");
    expect(holdIndexes.map((index) => index.name)).toContain("booking_holds_expires_at_id_idx");
  });

  async function createListingFixture({ capacity }: { capacity: number }) {
    const listingId = prefixedId("lst");
    const date = dateAfterDays(30);
    const startTime = "9:00 AM";
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId: DEMO_BUSINESS_ID,
        title: `Cleanup fixture ${listingId}`,
        description: "Cleanup fixture",
        category: "Tour",
        status: "active",
        basePriceCents: 5000,
        childPriceCents: null,
        durationMinutes: 60,
        minGuests: 1,
        maxGuests: capacity,
        capacity,
        meetingPoint: "Fixture dock",
        imageUrlsJson: "[]"
      }
    });
    await prisma.availabilityRule.create({
      data: {
        id: prefixedId("av"),
        businessId: DEMO_BUSINESS_ID,
        listingId,
        dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
        startTime,
        endTime: "10:00 AM",
        slotIntervalMinutes: 60,
        capacity,
        effectiveStartDate: date,
        effectiveEndDate: date
      }
    });
    return { listingId, date, startTime };
  }

  function createHold(fixture: { listingId: string; date: string; startTime: string }, expiresAt: Date) {
    return prisma.bookingHold.create({
      data: {
        id: prefixedId("hold"),
        businessId: DEMO_BUSINESS_ID,
        listingId: fixture.listingId,
        bookingDate: fixture.date,
        startTime: fixture.startTime,
        guestCount: 2,
        quoteJson: "{}",
        expiresAt
      }
    });
  }

  function createBooking(
    fixture: { listingId: string; date: string; startTime: string },
    customerEmail: string,
    state: { status: "pending_payment" | "confirmed" | "canceled" | "failed"; paymentStatus: "pending" | "paid" | "failed"; paymentExpiresAt: Date | null }
  ) {
    return prisma.booking.create({
      data: {
        id: prefixedId("bok"),
        businessId: DEMO_BUSINESS_ID,
        listingId: fixture.listingId,
        customerName: "Cleanup Tester",
        customerEmail,
        bookingDate: fixture.date,
        startTime: fixture.startTime,
        endTime: "10:00 AM",
        guestCount: 2,
        adultCount: 2,
        childCount: 0,
        status: state.status,
        paymentStatus: state.paymentStatus,
        paymentProvider: "stripe",
        paymentReferenceId: prefixedId("cs"),
        paymentIntentId: prefixedId("pi"),
        paymentExpectedAmountCents: 10600,
        paymentExpectedCurrency: "usd",
        paymentExpiresAt: state.paymentExpiresAt,
        subtotalCents: 10000,
        taxCents: 0,
        platformFeeCents: 600,
        processorFeeCents: 0,
        totalCents: 10600
      }
    });
  }

  function quoteExactCapacity(fixture: { listingId: string; date: string; startTime: string }) {
    return publicApi.quote({
      listingId: fixture.listingId,
      date: fixture.date,
      startTime: fixture.startTime,
      adults: 2,
      children: 0,
      addOns: []
    });
  }

  async function cleanupListingFixture(listingId: string) {
    const bookings = await prisma.booking.findMany({ where: { listingId }, select: { id: true } });
    const bookingIds = bookings.map((booking) => booking.id);
    await prisma.paymentEvent.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [listingId, ...bookingIds] } } });
    await prisma.bookingAddOn.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { listingId } });
    await prisma.bookingHold.deleteMany({ where: { listingId } });
    await prisma.availabilityException.deleteMany({ where: { listingId } });
    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.addOn.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
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

  function stripeWebhookBody(eventId: string, eventType: string, booking: Awaited<ReturnType<typeof createBooking>>) {
    return JSON.stringify({
      id: eventId,
      created: Math.floor(Date.now() / 1000),
      type: eventType,
      data: {
        object: {
          id: booking.paymentIntentId,
          amount_received: booking.paymentExpectedAmountCents,
          currency: booking.paymentExpectedCurrency,
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

  class FakeCheckoutSessionExpirer {
    expiredSessions: string[] = [];

    async expireCheckoutSession(sessionId: string) {
      this.expiredSessions.push(sessionId);
    }
  }
});
