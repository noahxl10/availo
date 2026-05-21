-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_user_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "support_email" TEXT,
    "support_phone" TEXT,
    "address_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'onboarding',
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "revoked_at" DATETIME,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "base_price_cents" INTEGER NOT NULL,
    "child_price_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "pricing_type" TEXT NOT NULL DEFAULT 'per_guest',
    "duration_minutes" INTEGER NOT NULL,
    "min_guests" INTEGER NOT NULL DEFAULT 1,
    "max_guests" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL,
    "meeting_point" TEXT,
    "image_urls_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "listings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "slot_interval_minutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "effective_start_date" TEXT NOT NULL,
    "effective_end_date" TEXT,
    CONSTRAINT "availability_rules_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "custom_start_time" TEXT,
    "custom_end_time" TEXT,
    "custom_capacity" INTEGER,
    "reason" TEXT,
    CONSTRAINT "availability_exceptions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "add_ons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "pricing_type" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_quantity" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "add_ons_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT,
    "booking_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "adult_count" INTEGER NOT NULL DEFAULT 0,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "payment_reference_id" TEXT,
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL,
    "processor_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "booking_add_ons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "booking_id" TEXT NOT NULL,
    "add_on_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    CONSTRAINT "booking_add_ons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "booking_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "add_ons" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "booking_holds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "booking_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "quote_json" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_holds_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "booking_holds_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "users_business_id_role_idx" ON "users"("business_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_business_id_email_key" ON "users"("business_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_business_id_phone_number_key" ON "users"("business_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "sessions_business_id_idx" ON "sessions"("business_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "listings_business_id_idx" ON "listings"("business_id");

-- CreateIndex
CREATE INDEX "listings_business_id_status_idx" ON "listings"("business_id", "status");

-- CreateIndex
CREATE INDEX "availability_rules_business_id_idx" ON "availability_rules"("business_id");

-- CreateIndex
CREATE INDEX "availability_rules_listing_id_day_of_week_idx" ON "availability_rules"("listing_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_exceptions_business_id_idx" ON "availability_exceptions"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "availability_exceptions_listing_id_date_key" ON "availability_exceptions"("listing_id", "date");

-- CreateIndex
CREATE INDEX "add_ons_business_id_idx" ON "add_ons"("business_id");

-- CreateIndex
CREATE INDEX "add_ons_listing_id_status_idx" ON "add_ons"("listing_id", "status");

-- CreateIndex
CREATE INDEX "bookings_business_id_idx" ON "bookings"("business_id");

-- CreateIndex
CREATE INDEX "bookings_listing_id_booking_date_start_time_status_idx" ON "bookings"("listing_id", "booking_date", "start_time", "status");

-- CreateIndex
CREATE INDEX "bookings_booking_date_idx" ON "bookings"("booking_date");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_payment_reference_id_idx" ON "bookings"("payment_reference_id");

-- CreateIndex
CREATE INDEX "booking_add_ons_booking_id_idx" ON "booking_add_ons"("booking_id");

-- CreateIndex
CREATE INDEX "booking_holds_business_id_idx" ON "booking_holds"("business_id");

-- CreateIndex
CREATE INDEX "booking_holds_listing_id_booking_date_start_time_expires_at_idx" ON "booking_holds"("listing_id", "booking_date", "start_time", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "payment_events_business_id_idx" ON "payment_events"("business_id");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs"("business_id", "created_at");
