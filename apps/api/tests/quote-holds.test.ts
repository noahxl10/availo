import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_BUSINESS_ID } from "../src/common/tenant.js";
import { prefixedId } from "../src/common/ids.js";
import { PublicController } from "../src/public/public.controller.js";
import { PublicQuoteRateLimiter } from "../src/public/public-rate-limit.js";
import { PublicService } from "../src/public/public.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("quote hold capacity lifecycle", () => {
  const prisma = new PrismaService();
  const publicApi = new PublicService(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not let concurrent quotes over-reserve a slot", async () => {
    const fixture = await createListingFixture({ capacity: 2 });
    const clients = [new PrismaService(), new PrismaService()];
    await Promise.all(clients.map((client) => client.$connect()));
    const apis = clients.map((client) => new PublicService(client));

    try {
      const results = await Promise.allSettled(apis.map((api) => quoteExactCapacity(api, fixture)));
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason?.message).toContain("Selected slot is unavailable");

      const activeHolds = await prisma.bookingHold.aggregate({
        where: { listingId: fixture.listingId, bookingDate: fixture.date, startTime: fixture.startTime, expiresAt: { gt: new Date() } },
        _sum: { guestCount: true }
      });
      expect(activeHolds._sum.guestCount).toBe(2);

      const availability = await publicApi.availability(fixture.listingId, fixture.date);
      expect(availability.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(0);
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("ignores expired holds when reserving and reporting availability", async () => {
    const fixture = await createListingFixture({ capacity: 2 });
    await prisma.bookingHold.create({
      data: {
        id: prefixedId("hold"),
        businessId: DEMO_BUSINESS_ID,
        listingId: fixture.listingId,
        bookingDate: fixture.date,
        startTime: fixture.startTime,
        guestCount: 2,
        quoteJson: "{}",
        expiresAt: new Date(Date.now() - 60_000)
      }
    });

    try {
      const before = await publicApi.availability(fixture.listingId, fixture.date);
      expect(before.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(2);

      const quote = await quoteExactCapacity(publicApi, fixture);
      expect(quote.holdId).toEqual(expect.stringMatching(/^hold_/));

      const activeHolds = await prisma.bookingHold.aggregate({
        where: { listingId: fixture.listingId, bookingDate: fixture.date, startTime: fixture.startTime, expiresAt: { gt: new Date() } },
        _sum: { guestCount: true }
      });
      expect(activeHolds._sum.guestCount).toBe(2);
      expect(await prisma.bookingHold.count({ where: { id: quote.holdId } })).toBe(1);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("consumes an unexpired hold at checkout and releases expired pending payments from availability", async () => {
    const fixture = await createListingFixture({ capacity: 2 });

    await withEnv({ ALLOW_MOCK_PAYMENTS: "true", STRIPE_SECRET_KEY: undefined }, async () => {
      const quote = await quoteExactCapacity(publicApi, fixture);
      const checkout = await publicApi.checkout({
        holdId: quote.holdId,
        listingId: fixture.listingId,
        date: fixture.date,
        startTime: fixture.startTime,
        adults: 2,
        children: 0,
        addOns: [],
        customer: { name: "Capacity Tester", email: "capacity-checkout@example.invalid" }
      });

      try {
        expect(checkout.status).toBe("pending_payment");
        expect(checkout.paymentExpiresAt).toEqual(expect.any(String));
        expect(await prisma.bookingHold.count({ where: { id: quote.holdId } })).toBe(0);

        const reserved = await publicApi.availability(fixture.listingId, fixture.date);
        expect(reserved.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(0);

        await prisma.booking.update({ where: { id: checkout.bookingId }, data: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
        const released = await publicApi.availability(fixture.listingId, fixture.date);
        expect(released.slots.find((slot) => slot.startTime === fixture.startTime)?.capacityRemaining).toBe(2);
      } finally {
        await cleanupListingFixture(fixture.listingId);
      }
    });
  });

  it("revalidates rule capacity before consuming a hold at checkout", async () => {
    const fixture = await createListingFixture({ capacity: 2 });

    await withEnv({ ALLOW_MOCK_PAYMENTS: "true", STRIPE_SECRET_KEY: undefined }, async () => {
      const quote = await quoteExactCapacity(publicApi, fixture);
      await prisma.availabilityRule.updateMany({ where: { listingId: fixture.listingId }, data: { capacity: 1 } });

      try {
        await expect(
          publicApi.checkout({
            holdId: quote.holdId,
            listingId: fixture.listingId,
            date: fixture.date,
            startTime: fixture.startTime,
            adults: 2,
            children: 0,
            addOns: [],
            customer: { name: "Capacity Tester", email: "capacity-lowered@example.invalid" }
          })
        ).rejects.toThrow("Selected slot is unavailable");
        expect(await prisma.booking.count({ where: { listingId: fixture.listingId } })).toBe(0);
        expect(await prisma.bookingHold.count({ where: { id: quote.holdId } })).toBe(1);
      } finally {
        await cleanupListingFixture(fixture.listingId);
      }
    });
  });

  it("rate limits public quote creation before creating another hold", async () => {
    const fixture = await createListingFixture({ capacity: 8 });

    await withEnv({ PUBLIC_QUOTE_RATE_LIMIT: "2", PUBLIC_QUOTE_RATE_WINDOW_SECONDS: "900", PUBLIC_RATE_LIMIT_MAX_KEYS: "100" }, async () => {
      const limiter = new PublicQuoteRateLimiter();
      const controller = new PublicController(publicApi, limiter);
      const body = quoteBody(fixture);

      try {
        await controller.quote(body, { ip: "203.0.113.10", headers: { "x-forwarded-for": "198.51.100.20" } } as never, responseRecorder());
        await controller.quote(body, { ip: "203.0.113.10", headers: { "x-forwarded-for": "198.51.100.21" } } as never, responseRecorder());
        const beforeRejected = await prisma.bookingHold.count({ where: { listingId: fixture.listingId } });
        const rejectedResponse = responseRecorder();

        expect(() => controller.quote(body, { ip: "203.0.113.10", headers: { "x-forwarded-for": "198.51.100.22" } } as never, rejectedResponse)).toThrow(
          "Too many quote requests"
        );

        expect(await prisma.bookingHold.count({ where: { listingId: fixture.listingId } })).toBe(beforeRejected);
        expect(rejectedResponse.headers["retry-after"]).toEqual(expect.stringMatching(/^\d+$/));
        expect(rejectedResponse.headers["ratelimit-limit"]).toBe("2");
        expect(rejectedResponse.headers["ratelimit-remaining"]).toBe("0");
        expect(Number(rejectedResponse.headers["ratelimit-reset"])).toBeLessThanOrEqual(900);

        await controller.quote(body, { ip: "203.0.113.11" } as never, responseRecorder());
        expect(await prisma.bookingHold.count({ where: { listingId: fixture.listingId } })).toBe(beforeRejected + 1);
      } finally {
        await cleanupListingFixture(fixture.listingId);
      }
    });
  });

  it("resets quote rate-limit windows deterministically and caps active clients", async () => {
    await withEnv({ PUBLIC_QUOTE_RATE_LIMIT: "2", PUBLIC_QUOTE_RATE_WINDOW_SECONDS: "60", PUBLIC_RATE_LIMIT_MAX_KEYS: "1" }, async () => {
      const limiter = new PublicQuoteRateLimiter();
      const start = new Date("2026-08-31T00:00:00.000Z");

      expect(limiter.consume({ source: "2001:db8::1", now: start }).allowed).toBe(true);
      expect(limiter.consume({ source: "2001:DB8::1", now: start }).allowed).toBe(true);
      expect(limiter.consume({ source: "2001:db8::1", now: new Date(start.getTime() + 59_999) }).allowed).toBe(false);
      expect(limiter.consume({ source: "2001:db8::1", now: new Date(start.getTime() + 60_000) }).allowed).toBe(true);
      expect(limiter.consume({ source: "2001:db8::2", now: new Date(start.getTime() + 60_001) }).allowed).toBe(false);
    });
  });

  it("rejects bounded quote payload violations before creating holds", async () => {
    const fixture = await createListingFixture({ capacity: 8 });
    const addOnId = prefixedId("add");
    await prisma.addOn.create({
      data: {
        id: addOnId,
        businessId: DEMO_BUSINESS_ID,
        listingId: fixture.listingId,
        name: "Fixture dry bag",
        priceCents: 500,
        pricingType: "per_booking",
        minQuantity: 0,
        maxQuantity: 2
      }
    });

    const invalidBodies = [
      { ...quoteBody(fixture), date: "2026-02-29" },
      { ...quoteBody(fixture), listingId: "x".repeat(81) },
      { ...quoteBody(fixture), startTime: "x".repeat(33) },
      { ...quoteBody(fixture), adults: 101 },
      { ...quoteBody(fixture), addOns: Array.from({ length: 13 }, () => ({ id: addOnId, quantity: 1 })) },
      { ...quoteBody(fixture), addOns: [{ id: addOnId, quantity: 1 }, { id: addOnId, quantity: 1 }] },
      { ...quoteBody(fixture), addOns: [{ id: addOnId, quantity: 101 }] }
    ];

    try {
      for (const body of invalidBodies) {
        await expect(publicApi.quote(body)).rejects.toThrow();
      }
      expect(await prisma.bookingHold.count({ where: { listingId: fixture.listingId } })).toBe(0);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("enforces quote date horizon boundaries before creating holds", async () => {
    const fixture = await createListingFixture({ capacity: 8 });

    await withEnv({ PUBLIC_BOOKING_HORIZON_DAYS: "30" }, async () => {
      try {
        await expect(publicApi.quote({ ...quoteBody(fixture), date: dateAfterDays(-1) })).rejects.toThrow();
        await expect(publicApi.quote({ ...quoteBody(fixture), date: dateAfterDays(31) })).rejects.toThrow();
        await expect(publicApi.quote({ ...quoteBody(fixture), date: dateAfterDays(30) })).resolves.toMatchObject({ holdId: expect.stringMatching(/^hold_/) });
        expect(await prisma.bookingHold.count({ where: { listingId: fixture.listingId } })).toBe(1);
      } finally {
        await cleanupListingFixture(fixture.listingId);
      }
    });
  });

  it("allows checkout for an unexpired hold whose booking date crossed out of the quote horizon", async () => {
    const fixture = await createListingFixture({ capacity: 4, date: dateAfterDays(-1) });
    const quote = {
      listingId: fixture.listingId,
      bookingDate: fixture.date,
      startTime: fixture.startTime,
      guestCount: 2,
      adultCount: 2,
      childCount: 0,
      subtotalCents: 10000,
      taxCents: 0,
      platformFeeCents: 600,
      processorFeeCents: 0,
      totalCents: 10600,
      addOns: []
    };
    const hold = await prisma.bookingHold.create({
      data: {
        id: prefixedId("hold"),
        businessId: DEMO_BUSINESS_ID,
        listingId: fixture.listingId,
        bookingDate: fixture.date,
        startTime: fixture.startTime,
        guestCount: 2,
        quoteJson: JSON.stringify(quote),
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    await withEnv({ ALLOW_MOCK_PAYMENTS: "true", STRIPE_SECRET_KEY: undefined }, async () => {
      try {
        await expect(
          publicApi.checkout({
            holdId: hold.id,
            listingId: fixture.listingId,
            date: fixture.date,
            startTime: fixture.startTime,
            adults: 2,
            children: 0,
            addOns: [],
            customer: { name: "Boundary Tester", email: "boundary-checkout@example.invalid" }
          })
        ).resolves.toMatchObject({ status: "pending_payment" });
      } finally {
        await cleanupListingFixture(fixture.listingId);
      }
    });
  });

  async function createListingFixture({ capacity, date = dateAfterDays(30) }: { capacity: number; date?: string }) {
    const listingId = prefixedId("lst");
    const startTime = "9:00 AM";
    await prisma.listing.create({
      data: {
        id: listingId,
        businessId: DEMO_BUSINESS_ID,
        title: `Capacity fixture ${listingId}`,
        description: "Capacity fixture",
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

  function quoteExactCapacity(api: PublicService, fixture: { listingId: string; date: string; startTime: string }) {
    return api.quote(quoteBody(fixture));
  }

  function quoteBody(fixture: { listingId: string; date: string; startTime: string }) {
    return {
      listingId: fixture.listingId,
      date: fixture.date,
      startTime: fixture.startTime,
      adults: 2,
      children: 0,
      addOns: []
    };
  }

  function responseRecorder() {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      }
    };
  }

  function dateAfterDays(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
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
});
