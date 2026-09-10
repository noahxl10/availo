import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
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

    await prisma.paymentEvent.deleteMany({ where: { bookingId: checkout.bookingId } });
    await prisma.booking.deleteMany({ where: { customerEmail: "tester@example.com" } });
    await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
    await prisma.auditLog.deleteMany({ where: { entityId: checkout.bookingId } });
  });

  it("uses availability-rule capacity when quoting and revalidating checkout capacity", async () => {
    const ruleId = "av_harbor_kayak_2_0";
    const date = "2026-05-12";
    let holdId: string | null = null;
    try {
      await prisma.availabilityRule.update({ where: { id: ruleId }, data: { capacity: 12 } });
      const quote = await publicApi.quote({
        listingId: "lst_harbor_kayak_tour",
        date,
        startTime: "9:30 AM",
        adults: 3,
        children: 0,
        addOns: []
      });
      holdId = quote.holdId;

      await prisma.availabilityRule.update({ where: { id: ruleId }, data: { capacity: 2 } });
      const availability = await publicApi.availability("lst_harbor_kayak_tour", date);
      expect(availability.slots.find((slot) => slot.startTime === "9:30 AM")?.capacityRemaining).toBe(0);

      await expect(
        publicApi.checkout({
          holdId: quote.holdId,
          listingId: "lst_harbor_kayak_tour",
          date,
          startTime: "9:30 AM",
          adults: 3,
          children: 0,
          addOns: [],
          customer: { name: "Capacity Tester", email: "capacity@example.com" }
        })
      ).rejects.toThrow("Selected slot is unavailable");

      await prisma.bookingHold.deleteMany({ where: { id: quote.holdId } });
      holdId = null;

      await expect(
        publicApi.quote({
          listingId: "lst_harbor_kayak_tour",
          date,
          startTime: "9:30 AM",
          adults: 3,
          children: 0,
          addOns: []
        })
      ).rejects.toThrow("Selected slot is unavailable");
    } finally {
      if (holdId) await prisma.bookingHold.deleteMany({ where: { id: holdId } });
      await prisma.availabilityRule.update({ where: { id: ruleId }, data: { capacity: 12 } });
    }
  });

  it("uses the smaller capacity when active rules overlap on the same slot", async () => {
    const overlapRuleId = "av_overlap_low_capacity";
    try {
      await prisma.availabilityRule.create({
        data: {
          id: overlapRuleId,
          businessId: DEMO_BUSINESS_ID,
          listingId: "lst_harbor_kayak_tour",
          dayOfWeek: 2,
          startTime: "9:30 AM",
          endTime: "10:30 AM",
          slotIntervalMinutes: 60,
          capacity: 1,
          effectiveStartDate: "2026-05-01"
        }
      });

      const availability = await publicApi.availability("lst_harbor_kayak_tour", "2026-05-12");
      expect(availability.slots.find((slot) => slot.startTime === "9:30 AM")?.capacityRemaining).toBe(1);

      await expect(
        publicApi.quote({
          listingId: "lst_harbor_kayak_tour",
          date: "2026-05-12",
          startTime: "9:30 AM",
          adults: 2,
          children: 0,
          addOns: []
        })
      ).rejects.toThrow("Selected slot is unavailable");
    } finally {
      await prisma.availabilityRule.deleteMany({ where: { id: overlapRuleId } });
    }
  });

  it("hides slots outside effective availability windows", async () => {
    const ruleId = "av_harbor_kayak_2_0";
    let holdId: string | null = null;
    try {
      const quote = await publicApi.quote({
        listingId: "lst_harbor_kayak_tour",
        date: "2026-05-12",
        startTime: "9:30 AM",
        adults: 1,
        children: 0,
        addOns: []
      });
      holdId = quote.holdId;
      await prisma.availabilityRule.update({ where: { id: ruleId }, data: { effectiveEndDate: "2026-05-11" } });

      const availability = await publicApi.availability("lst_harbor_kayak_tour", "2026-05-12");
      expect(availability.slots.map((slot) => slot.startTime)).not.toContain("9:30 AM");

      await expect(
        publicApi.quote({
          listingId: "lst_harbor_kayak_tour",
          date: "2026-05-12",
          startTime: "9:30 AM",
          adults: 1,
          children: 0,
          addOns: []
        })
      ).rejects.toThrow("Selected slot is unavailable");

      await expect(
        publicApi.checkout({
          holdId: quote.holdId,
          listingId: "lst_harbor_kayak_tour",
          date: "2026-05-12",
          startTime: "9:30 AM",
          adults: 1,
          children: 0,
          addOns: [],
          customer: { name: "Window Tester", email: "window@example.com" }
        })
      ).rejects.toThrow("Selected slot is unavailable");
    } finally {
      if (holdId) await prisma.bookingHold.deleteMany({ where: { id: holdId } });
      await prisma.availabilityRule.update({ where: { id: ruleId }, data: { effectiveEndDate: null } });
    }
  });

  it("applies dated availability exceptions to the configured slot window only", async () => {
    const availability = await publicApi.availability("lst_harbor_kayak_tour", "2026-05-09");

    expect(availability.slots).toEqual([
      expect.objectContaining({
        startTime: "3:30 PM",
        capacityRemaining: 0
      })
    ]);
  });

  it("rejects listing updates that would invert guest limits", async () => {
    await expect(listingService.update("lst_harbor_kayak_tour", { minGuests: 99 })).rejects.toThrow("minGuests cannot be greater than maxGuests");
  });

  it("ignores invalid persisted availability rules without creating phantom slots or holds", async () => {
    const listingId = "lst_invalid_schedule_contract";
    await prisma.bookingHold.deleteMany({ where: { listingId } });
    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId: DEMO_BUSINESS_ID,
        title: "Invalid Schedule Contract",
        category: "Tour",
        status: "active",
        basePriceCents: 2500,
        durationMinutes: 30,
        minGuests: 1,
        maxGuests: 6,
        capacity: 6,
        imageUrlsJson: "[]"
      }
    });
    await prisma.availabilityRule.createMany({
      data: [
        {
          id: "av_invalid_schedule_bad_start",
          businessId: DEMO_BUSINESS_ID,
          listingId,
          dayOfWeek: 2,
          startTime: "not a time",
          endTime: "10:00 AM",
          slotIntervalMinutes: 30,
          capacity: 6,
          effectiveStartDate: "2026-05-01"
        },
        {
          id: "av_invalid_schedule_inverted",
          businessId: DEMO_BUSINESS_ID,
          listingId,
          dayOfWeek: 2,
          startTime: "11:00 AM",
          endTime: "10:00 AM",
          slotIntervalMinutes: 30,
          capacity: 6,
          effectiveStartDate: "2026-05-01"
        },
        {
          id: "av_invalid_schedule_zero_interval",
          businessId: DEMO_BUSINESS_ID,
          listingId,
          dayOfWeek: 2,
          startTime: "9:00 AM",
          endTime: "10:00 AM",
          slotIntervalMinutes: 0,
          capacity: 6,
          effectiveStartDate: "2026-05-01"
        },
        {
          id: "av_invalid_schedule_negative_capacity",
          businessId: DEMO_BUSINESS_ID,
          listingId,
          dayOfWeek: 2,
          startTime: "1:00 PM",
          endTime: "2:00 PM",
          slotIntervalMinutes: 30,
          capacity: -1,
          effectiveStartDate: "2026-05-01"
        },
        {
          id: "av_invalid_schedule_bad_effective_end",
          businessId: DEMO_BUSINESS_ID,
          listingId,
          dayOfWeek: 2,
          startTime: "3:00 PM",
          endTime: "4:00 PM",
          slotIntervalMinutes: 30,
          capacity: 6,
          effectiveStartDate: "2026-05-01",
          effectiveEndDate: "bad-date"
        }
      ]
    });

    const availability = await publicApi.availability(listingId, "2026-05-12");
    expect(availability.slots).toEqual([]);

    await expect(
      publicApi.quote({
        listingId,
        date: "2026-05-12",
        startTime: "12:00 AM",
        adults: 1,
        children: 0,
        addOns: []
      })
    ).rejects.toThrow("Selected slot is unavailable");
    await expect(
      publicApi.quote({
        listingId,
        date: "2026-02-31",
        startTime: "9:00 AM",
        adults: 1,
        children: 0,
        addOns: []
      })
    ).rejects.toThrow();
    expect(await prisma.bookingHold.count({ where: { listingId } })).toBe(0);

    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
  });

  it("fails closed for invalid exception windows and negative custom capacity", async () => {
    const listingId = "lst_invalid_exception_contract";
    await prisma.bookingHold.deleteMany({ where: { listingId } });
    await prisma.availabilityException.deleteMany({ where: { listingId } });
    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId: DEMO_BUSINESS_ID,
        title: "Invalid Exception Contract",
        category: "Tour",
        status: "active",
        basePriceCents: 2500,
        durationMinutes: 30,
        minGuests: 1,
        maxGuests: 6,
        capacity: 6,
        imageUrlsJson: "[]"
      }
    });
    await prisma.availabilityRule.create({
      data: {
        id: "av_invalid_exception_valid_rule",
        businessId: DEMO_BUSINESS_ID,
        listingId,
        dayOfWeek: 2,
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        slotIntervalMinutes: 30,
        capacity: 6,
        effectiveStartDate: "2026-05-01"
      }
    });
    await prisma.availabilityException.create({
      data: {
        id: "exc_invalid_exception_window",
        businessId: DEMO_BUSINESS_ID,
        listingId,
        date: "2026-05-12",
        customStartTime: "bad",
        customEndTime: "10:00 AM",
        customCapacity: 3
      }
    });

    expect((await publicApi.availability(listingId, "2026-05-12")).slots).toEqual([]);

    await prisma.availabilityException.update({
      where: { listingId_date: { listingId, date: "2026-05-12" } },
      data: { customStartTime: "9:00 AM", customEndTime: "10:00 AM", customCapacity: -1 }
    });

    const availability = await publicApi.availability(listingId, "2026-05-12");
    expect(availability.slots).toEqual([
      { id: `${listingId}_2026-05-12_9:00 AM`, listingId, date: "2026-05-12", startTime: "9:00 AM", capacityRemaining: 0 },
      { id: `${listingId}_2026-05-12_9:30 AM`, listingId, date: "2026-05-12", startTime: "9:30 AM", capacityRemaining: 0 }
    ]);
    await expect(
      publicApi.quote({
        listingId,
        date: "2026-05-12",
        startTime: "9:00 AM",
        adults: 1,
        children: 0,
        addOns: []
      })
    ).rejects.toThrow("Selected slot is unavailable");
    expect(await prisma.bookingHold.count({ where: { listingId } })).toBe(0);

    await prisma.availabilityException.deleteMany({ where: { listingId } });
    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
  });

  it("rejects checkout when a hold no longer has a valid backing schedule slot", async () => {
    const listingId = "lst_checkout_schedule_contract";
    const customerEmail = "schedule-checkout@example.invalid";
    await prisma.auditLog.deleteMany({ where: { businessId: DEMO_BUSINESS_ID, entityType: "booking" } });
    await prisma.booking.deleteMany({ where: { listingId } });
    await prisma.bookingHold.deleteMany({ where: { listingId } });
    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId: DEMO_BUSINESS_ID,
        title: "Checkout Schedule Contract",
        category: "Tour",
        status: "active",
        basePriceCents: 2500,
        durationMinutes: 30,
        minGuests: 1,
        maxGuests: 6,
        capacity: 6,
        imageUrlsJson: "[]"
      }
    });
    await prisma.availabilityRule.create({
      data: {
        id: "av_checkout_schedule_valid_rule",
        businessId: DEMO_BUSINESS_ID,
        listingId,
        dayOfWeek: 2,
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        slotIntervalMinutes: 30,
        capacity: 6,
        effectiveStartDate: "2026-05-01"
      }
    });
    const quote = await publicApi.quote({
      listingId,
      date: "2026-05-12",
      startTime: "9:00 AM",
      adults: 1,
      children: 0,
      addOns: []
    });

    await prisma.availabilityRule.update({ where: { id: "av_checkout_schedule_valid_rule" }, data: { slotIntervalMinutes: 0 } });

    await expect(
      publicApi.checkout({
        holdId: quote.holdId,
        listingId,
        date: "2026-05-12",
        startTime: "9:00 AM",
        adults: 1,
        children: 0,
        addOns: [],
        customer: { name: "Schedule Tester", email: customerEmail }
      })
    ).rejects.toThrow("Selected slot is unavailable");
    expect(await prisma.booking.count({ where: { listingId, customerEmail } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { businessId: DEMO_BUSINESS_ID, action: "booking.checkout_started", entityType: "booking" } })).toBe(0);

    await prisma.bookingHold.deleteMany({ where: { listingId } });
    await prisma.availabilityRule.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
  });
});
