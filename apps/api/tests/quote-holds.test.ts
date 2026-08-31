import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_BUSINESS_ID } from "../src/common/tenant.js";
import { prefixedId } from "../src/common/ids.js";
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
      expect(await prisma.bookingHold.count({ where: { listingId: fixture.listingId } })).toBe(2);
    } finally {
      await cleanupListingFixture(fixture.listingId);
    }
  });

  it("consumes an unexpired hold at checkout and releases expired pending payments from availability", async () => {
    const fixture = await createListingFixture({ capacity: 2 });

    await withEnv({ ALLOW_MOCK_PAYMENTS: "true" }, async () => {
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

    await withEnv({ ALLOW_MOCK_PAYMENTS: "true" }, async () => {
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

  async function createListingFixture({ capacity }: { capacity: number }) {
    const listingId = prefixedId("lst");
    const date = "2026-06-06";
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
        effectiveStartDate: "2026-06-01",
        effectiveEndDate: "2026-06-30"
      }
    });
    return { listingId, date, startTime };
  }

  function quoteExactCapacity(api: PublicService, fixture: { listingId: string; date: string; startTime: string }) {
    return api.quote({
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
});
