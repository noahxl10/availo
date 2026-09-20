ALTER TABLE "bookings" ADD COLUMN "receipt_token_hash" TEXT;

CREATE UNIQUE INDEX "bookings_receipt_token_hash_key" ON "bookings"("receipt_token_hash");
