ALTER TABLE "bookings" ADD COLUMN "payment_expires_at" DATETIME;

UPDATE "bookings"
SET "payment_status" = 'pending'
WHERE "status" = 'pending_payment'
  AND "payment_status" = 'unpaid';

UPDATE "bookings"
SET "payment_expires_at" = datetime("created_at", '+15 minutes')
WHERE "status" = 'pending_payment'
  AND "payment_status" = 'pending'
  AND "payment_expires_at" IS NULL;
