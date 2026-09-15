CREATE INDEX "bookings_status_payment_status_payment_expires_at_id_idx" ON "bookings"("status", "payment_status", "payment_expires_at", "id");

CREATE INDEX "booking_holds_expires_at_id_idx" ON "booking_holds"("expires_at", "id");
