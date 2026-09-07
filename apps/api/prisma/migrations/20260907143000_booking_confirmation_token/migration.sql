-- Add customer receipt tokens without rewriting existing SQLite rows.
ALTER TABLE "bookings" ADD COLUMN "confirmation_token" TEXT;

CREATE UNIQUE INDEX "bookings_confirmation_token_key" ON "bookings"("confirmation_token");
