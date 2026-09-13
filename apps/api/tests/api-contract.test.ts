import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import { AuthController } from "../src/auth/auth.controller.js";
import { BusinessController } from "../src/businesses/business.controller.js";
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
  const businesses = new BusinessController(prisma);
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

  it("returns bad requests for malformed controller payloads without side effects", async () => {
    const sessionCount = await prisma.session.count();
    await expect(auth.login({ email: "not-an-email", password: "local-password" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(auth.refresh({ refreshToken: 123 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(auth.logout(null)).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.session.count()).toBe(sessionCount);

    const businessCount = await prisma.business.count();
    await expect(businesses.create({ name: "Bad Slug Outfit", slug: "Bad Slug!" })).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.business.count()).toBe(businessCount);

    const paymentEventCount = await prisma.paymentEvent.count();
    await expect(payments.mockConfirm({ bookingId: "" })).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.paymentEvent.count()).toBe(paymentEventCount);
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

  it("rejects listing updates that would invert guest limits", async () => {
    await expect(listingService.update("lst_harbor_kayak_tour", { minGuests: 99 })).rejects.toThrow("minGuests cannot be greater than maxGuests");
  });
});
