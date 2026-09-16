import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { DEMO_BUSINESS_ID, DEMO_BUSINESS_SLUG } from "../src/common/tenant.js";
import { assertDestructiveSeedAllowed } from "./seed-safety.js";

const prisma = new PrismaClient();
const DEMO_TAX_RATE = 0.085;

async function main() {
  assertDestructiveSeedAllowed(process.env);

  await prisma.auditLog.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.bookingHold.deleteMany();
  await prisma.bookingAddOn.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.addOn.deleteMany();
  await prisma.availabilityException.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  await prisma.business.create({
    data: {
      id: DEMO_BUSINESS_ID,
      name: "Sample Tours Co.",
      slug: DEMO_BUSINESS_SLUG,
      status: "active",
      timezone: "America/Los_Angeles",
      currency: "USD",
      supportEmail: "support@example-tours.invalid",
      supportPhone: "+1555010100",
      addressJson: JSON.stringify({
        line1: "100 Harbor Way",
        city: "Santa Cruz",
        region: "CA",
        postalCode: "95060",
        country: "US"
      }),
      taxRateBps: 850
    }
  });

  await prisma.user.create({
    data: {
      id: "usr_demo_owner",
      businessId: DEMO_BUSINESS_ID,
      email: "owner@example-tours.invalid",
      phoneNumber: "+1555010000",
      passwordHash: await argon2.hash("local-password"),
      role: "owner"
    }
  });

  await prisma.listing.createMany({
    data: [
      {
        id: "lst_harbor_kayak_tour",
        businessId: DEMO_BUSINESS_ID,
        title: "Harbor Kayak Tour",
        description:
          "A guided one hour kayak tour through a calm harbor route with local wildlife, shoreline history, and beginner-friendly paddling instruction.",
        category: "Tour",
        status: "active",
        basePriceCents: 6500,
        childPriceCents: 4500,
        durationMinutes: 60,
        minGuests: 1,
        maxGuests: 12,
        capacity: 12,
        meetingPoint: "100 Harbor Way, Santa Cruz, CA 95060",
        imageUrlsJson: "[]"
      },
      {
        id: "lst_private_group_paddle",
        businessId: DEMO_BUSINESS_ID,
        title: "Private Group Paddle",
        description: "Private bundled booking option for small groups.",
        category: "Private",
        status: "paused",
        basePriceCents: 0,
        durationMinutes: 60,
        minGuests: 1,
        maxGuests: 12,
        capacity: 12,
        meetingPoint: "100 Harbor Way, Santa Cruz, CA 95060",
        imageUrlsJson: "[]"
      }
    ]
  });

  await prisma.addOn.createMany({
    data: [
      {
        id: "add_adult_ticket",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        name: "Adult",
        description: "Ages 13+",
        priceCents: 6500,
        pricingType: "per_guest",
        minQuantity: 0,
        maxQuantity: 12
      },
      {
        id: "add_child_ticket",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        name: "Child",
        description: "Ages 6 - 12",
        priceCents: 4500,
        pricingType: "per_guest",
        minQuantity: 0,
        maxQuantity: 12
      },
      {
        id: "add_free_child_ticket",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        name: "Free Child",
        description: "5 yrs and under",
        priceCents: 0,
        pricingType: "per_guest",
        minQuantity: 0,
        maxQuantity: 12
      },
      {
        id: "add_kayak_seat",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        name: "Kayak Seat",
        description: "Resource capacity: 12 max uses",
        priceCents: 0,
        pricingType: "per_booking",
        minQuantity: 0,
        maxQuantity: 12
      },
      {
        id: "add_dry_bag",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        name: "Dry Bag Rental",
        description: "Optional waterproof gear bag",
        priceCents: 800,
        pricingType: "per_booking",
        minQuantity: 0,
        maxQuantity: 6
      }
    ]
  });

  for (let day = 0; day <= 6; day += 1) {
    for (const [index, startTime] of ["9:30 AM", "11:00 AM", "12:30 PM", "2:00 PM", "3:30 PM", "5:00 PM"].entries()) {
      await prisma.availabilityRule.create({
        data: {
          id: `av_harbor_kayak_${day}_${index}`,
          businessId: DEMO_BUSINESS_ID,
          listingId: "lst_harbor_kayak_tour",
          dayOfWeek: day,
          startTime,
          endTime: endTimeFor(startTime),
          slotIntervalMinutes: 90,
          capacity: 12,
          effectiveStartDate: "2026-05-01"
        }
      });
    }
  }

  await prisma.availabilityException.createMany({
    data: [
      {
        id: "exc_may_09_private_group",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        date: "2026-05-09",
        customStartTime: "3:30 PM",
        customEndTime: "4:30 PM",
        customCapacity: 0,
        reason: "Reserved for a private group booking"
      },
      {
        id: "exc_may_20_closed",
        businessId: DEMO_BUSINESS_ID,
        listingId: "lst_harbor_kayak_tour",
        date: "2026-05-20",
        isClosed: true,
        reason: "Closed for staff training"
      }
    ]
  });

  await prisma.booking.createMany({
    data: [
      booking("bok_demo_0505_alex", "Alex Rivera", "guest-0505@example.invalid", "2026-05-05", "9:30 AM", 2, 2, 0, "confirmed", 14105),
      booking("bok_demo_0504_morgan", "Morgan Lee", "guest-0504@example.invalid", "2026-05-04", "12:30 PM", 2, 2, 0, "confirmed", 14105),
      booking("bok_demo_0502_casey", "Casey Nguyen", "guest-0502@example.invalid", "2026-05-02", "3:30 PM", 2, 2, 0, "confirmed", 14105),
      booking("bok_demo_0302_jordan", "Jordan Patel", "guest-0302@example.invalid", "2026-03-02", "11:00 AM", 1, 1, 0, "confirmed", 7053)
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: "aud_seed",
        businessId: DEMO_BUSINESS_ID,
        userId: "usr_demo_owner",
        action: "seed.loaded",
        entityType: "business",
        entityId: DEMO_BUSINESS_ID,
        metadataJson: JSON.stringify({ source: "prisma.seed", importedFrom: "fictional demo fixture" })
      },
      {
        id: "aud_item_notes",
        businessId: DEMO_BUSINESS_ID,
        userId: "usr_demo_owner",
        action: "item.cancellation_notes.set",
        entityType: "listing",
        entityId: "lst_harbor_kayak_tour",
        metadataJson: JSON.stringify({ notes: "Refund if cancelled within 24 hours. After 24 hours, no refund will be given." })
      }
    ]
  });
}

function booking(
  id: string,
  customerName: string,
  customerEmail: string,
  bookingDate: string,
  startTime: string,
  guestCount: number,
  adultCount: number,
  childCount: number,
  status: "confirmed" | "pending_payment",
  totalCents: number
) {
  const subtotalCents = Math.round(totalCents / (1 + DEMO_TAX_RATE));
  return {
    id,
    businessId: DEMO_BUSINESS_ID,
    listingId: "lst_harbor_kayak_tour",
    customerName,
    customerEmail,
    bookingDate,
    startTime,
    endTime: endTimeFor(startTime),
    guestCount,
    adultCount,
    childCount,
    status,
    paymentStatus: status === "confirmed" ? "paid" : "pending",
    paymentReferenceId: `seed_${id}`,
    paymentExpiresAt: status === "pending_payment" ? new Date(Date.now() + 15 * 60 * 1000) : null,
    subtotalCents,
    taxCents: totalCents - subtotalCents,
    platformFeeCents: 0,
    processorFeeCents: 0,
    totalCents
  } as const;
}

function endTimeFor(startTime: string) {
  const endTimes: Record<string, string> = {
    "9:30 AM": "10:30 AM",
    "11:00 AM": "12:00 PM",
    "12:30 PM": "1:30 PM",
    "2:00 PM": "3:00 PM",
    "3:30 PM": "4:30 PM",
    "5:00 PM": "6:00 PM"
  };
  return endTimes[startTime] ?? "10:30 AM";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
