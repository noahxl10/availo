ALTER TABLE "bookings" ADD COLUMN "payment_provider" TEXT;
ALTER TABLE "bookings" ADD COLUMN "payment_intent_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "payment_expected_amount_cents" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "payment_expected_currency" TEXT;

CREATE UNIQUE INDEX "bookings_payment_provider_payment_reference_id_key" ON "bookings"("payment_provider", "payment_reference_id");
CREATE UNIQUE INDEX "bookings_payment_provider_payment_intent_id_key" ON "bookings"("payment_provider", "payment_intent_id");
