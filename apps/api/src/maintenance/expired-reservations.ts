import { Prisma, type PrismaClient } from "@prisma/client";
import { prefixedId } from "../common/ids.js";

const DEFAULT_BATCH_SIZE = 500;
const CLEANUP_RETRY_LIMIT = 3;

type CleanupPrisma = Pick<PrismaClient, "$transaction" | "booking" | "bookingHold">;

export type ExpiredReservationCleanupResult = {
  expiredHoldsDeleted: number;
  expiredBookingsFailed: number;
};

export async function cleanupExpiredReservations(
  prisma: CleanupPrisma,
  options: { now?: Date; batchSize?: number; bookingBatchSize?: number; holdBatchSize?: number } = {}
): Promise<ExpiredReservationCleanupResult> {
  const now = options.now ?? new Date();
  const defaultBatchSize = options.batchSize ?? expiredReservationCleanupBatchSize();
  const bookingBatchSize = options.bookingBatchSize ?? defaultBatchSize;
  const holdBatchSize = options.holdBatchSize ?? defaultBatchSize;

  return retryCleanupTransaction(() => prisma.$transaction(async (tx) => {
    const expiredHolds = await tx.bookingHold.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: holdBatchSize
    });

    const expiredBookings = await tx.booking.findMany({
      where: {
        status: "pending_payment",
        paymentStatus: "pending",
        paymentExpiresAt: { lte: now }
      },
      select: { id: true, businessId: true, paymentExpiresAt: true },
      orderBy: [{ paymentExpiresAt: "asc" }, { id: "asc" }],
      take: bookingBatchSize
    });

    const deletedHolds = expiredHolds.length
      ? await tx.bookingHold.deleteMany({
          where: { id: { in: expiredHolds.map((hold) => hold.id) }, expiresAt: { lte: now } }
        })
      : { count: 0 };

    let expiredBookingsFailed = 0;
    for (const booking of expiredBookings) {
      const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: "pending_payment",
            paymentStatus: "pending",
            paymentExpiresAt: { lte: now }
          },
          data: { status: "failed", paymentStatus: "failed" }
      });
      if (updated.count !== 1) continue;
      expiredBookingsFailed += 1;
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: booking.businessId,
          action: "booking.payment_expired",
          entityType: "booking",
          entityId: booking.id,
          metadataJson: JSON.stringify({ paymentExpiredAt: booking.paymentExpiresAt?.toISOString(), cleanupCutoff: now.toISOString() })
        }
      });
    }

    return {
      expiredHoldsDeleted: deletedHolds.count,
      expiredBookingsFailed
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export function expiredReservationCleanupBatchSize() {
  const raw = process.env.EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE;
  if (raw === undefined || raw === "") return DEFAULT_BATCH_SIZE;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 5_000) {
    throw new Error("EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE must be an integer between 1 and 5000.");
  }
  return value;
}

async function retryCleanupTransaction<T>(operation: () => Promise<T>) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= CLEANUP_RETRY_LIMIT || !isRetryableCleanupError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
}

function isRetryableCleanupError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && new Set(["P2034", "P2028"]).has(error.code)) return true;
  const message = error instanceof Error ? error.message : "";
  return /write conflict|deadlock|database is locked|SQLITE_BUSY|Transaction already closed/i.test(message);
}
