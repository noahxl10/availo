# Availo Backend + Database Build Process

This plan builds the backend for Availo with a local SQLite database first, while keeping the architecture ready for Neon/Postgres later. The priorities are correctness, tenant isolation, booking safety, secure auth, reliable payment confirmation, and clean API boundaries.

## Phase 0: Backend Shape

1. Create a backend app, ideally `apps/api`, using:
   - NestJS
   - TypeScript
   - Prisma
   - SQLite locally
   - Zod or `class-validator` for request validation
   - Argon2 for password hashing
   - JWT access tokens and refresh tokens
   - Stripe mocked first, real Stripe later

2. Keep the current UI untouched. Backend work should expose APIs only.

3. Add local environment variables:

```env
DATABASE_URL="file:./dev.db"
JWT_ACCESS_SECRET="local-dev-access-secret"
JWT_REFRESH_SECRET="local-dev-refresh-secret"
APP_BASE_URL="http://localhost:3001"
API_BASE_URL="http://localhost:4000"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

## Phase 1: Database Foundation

1. Install Prisma and initialize SQLite:

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider sqlite
```

2. Build the Prisma schema around these tables:
   - `User`
   - `Business`
   - `Session`
   - `Listing`
   - `AvailabilityRule`
   - `AvailabilityException`
   - `AddOn`
   - `Booking`
   - `BookingAddOn`
   - `BookingHold`
   - `PaymentEvent`
   - `AuditLog`

3. Use string IDs with stable prefixes:
   - `usr_...`
   - `biz_...`
   - `lst_...`
   - `bok_...`
   - `hold_...`

4. Store money only as integer cents:
   - `subtotalCents`
   - `taxCents`
   - `platformFeeCents`
   - `processorFeeCents`
   - `totalCents`

5. Add indexes early:
   - `businessId`
   - `listingId`
   - `bookingDate`
   - `status`
   - `paymentReferenceId`
   - unique `business.slug`
   - unique `paymentEvents.providerEventId`

6. Run:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Phase 2: Tenant Safety First

1. Make `businessId` mandatory on every operator-owned record.

2. Create a request context helper:

```ts
request.userId
request.businessId
request.role
```

3. Never query business-owned records by `id` alone. Always scope by tenant:

```ts
where: {
  id,
  businessId: request.businessId,
}
```

4. Put tenant-scoped query helpers inside services so this rule is hard to forget.

5. Add tenant isolation tests early:
   - User A cannot read User B's listing.
   - User A cannot update User B's booking.
   - Public APIs only expose public-safe fields.

## Phase 3: Auth

1. Start with email/password locally. Add Twilio phone auth after the core app works.

2. Use Argon2:
   - never store plain passwords
   - never log passwords or MFA codes

3. Implement:

```http
POST /auth/email/register
POST /auth/email/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

4. Use short-lived access tokens:
   - 10-15 minutes

5. Use refresh token rotation:
   - Store hashed refresh tokens in `Session`.
   - On refresh, invalidate the old token and issue a new one.
   - On logout, revoke the session.

6. Add rate limits:
   - login attempts
   - refresh attempts
   - future MFA attempts

For local SQLite, in-memory rate limits are acceptable for development. Later, move rate limits to Redis.

## Phase 4: Business Onboarding

1. Implement:

```http
POST  /business
GET   /business
PATCH /business
GET   /business/public/:slug
```

2. The first registered user for a business becomes `owner`.

3. Create audit logs for:
   - business created
   - business updated
   - user login
   - user logout

## Phase 5: Listings

1. Implement:

```http
GET    /listings
POST   /listings
GET    /listings/:id
PATCH  /listings/:id
DELETE /listings/:id
```

2. Prefer soft delete/archive over hard delete:

```ts
status: "archived"
```

3. Validate all inputs:
   - title required
   - price >= 0
   - duration > 0
   - min guests <= max guests
   - capacity > 0

4. Keep image URLs as JSON for SQLite. Later in Postgres, this can become JSONB or a related table.

## Phase 6: Availability Engine

1. Implement availability rules:

```http
GET    /listings/:id/availability
POST   /listings/:id/availability-rules
PATCH  /availability-rules/:id
DELETE /availability-rules/:id
```

2. Implement exceptions:

```http
POST   /listings/:id/availability-exceptions
PATCH  /availability-exceptions/:id
DELETE /availability-exceptions/:id
```

3. Build a pure slot-generation function:

```ts
generateSlots(listing, rules, exceptions, date)
```

4. Test this function heavily:
   - normal weekday rule
   - closed date
   - custom capacity
   - invalid time range
   - slot intervals
   - timezone handling

5. Store business timezone and always calculate availability in the business timezone.

## Phase 7: Add-ons

1. Implement:

```http
GET    /listings/:id/add-ons
POST   /listings/:id/add-ons
PATCH  /add-ons/:id
DELETE /add-ons/:id
```

2. Add-on pricing types:
   - `per_booking`
   - `per_guest`
   - `per_unit`

3. Validate:
   - price >= 0
   - min quantity <= max quantity
   - listing belongs to current business

## Phase 8: Quote + Holds

1. Implement:

```http
POST /public/bookings/quote
```

2. Quote should:
   - validate listing is public/bookable
   - validate date/time exists
   - validate guest count
   - validate selected add-ons
   - calculate subtotal
   - calculate platform fee as `round(subtotal * 0.06)`
   - calculate tax separately
   - calculate total

3. Create a booking hold:
   - expires in 10-15 minutes
   - stores listing/date/time/guest count
   - prevents over-capacity checkout

4. For SQLite, use Prisma transactions:

```ts
await prisma.$transaction(async (tx) => {
  // check confirmed bookings
  // check active holds
  // calculate remaining capacity
  // create hold
});
```

5. Add tests for:
   - capacity full
   - expired holds ignored
   - overlapping holds counted
   - quote math exactness

## Phase 9: Checkout + Booking Creation

1. Implement:

```http
POST /public/bookings/checkout
```

2. Checkout should:
   - require a valid hold
   - create booking with status `pending_payment`
   - copy quote totals into booking
   - create booking add-ons
   - create Stripe Checkout session later
   - return checkout URL or mock payment URL locally

3. Never mark booking as `confirmed` from the checkout request.

4. Confirmation only happens from a verified payment webhook.

## Phase 10: Payments

1. Build a payment abstraction:

```ts
PaymentProvider.createCheckoutSession()
PaymentProvider.refund()
PaymentProvider.verifyWebhook()
```

2. Start with a local mock provider:

```http
POST /payments/mock/confirm
```

3. Then add Stripe:

```http
POST /payments/stripe/webhook
```

4. Stripe webhook must:
   - verify signature
   - be idempotent using `providerEventId`
   - store raw event in `PaymentEvent`
   - update booking status only once
   - mark booking `confirmed` only on successful payment event

5. Refund endpoint:

```http
POST /bookings/:id/refund
```

6. Store refund state carefully:
   - `refunded`
   - `partially_refunded`
   - payment status updates separately from booking status

## Phase 11: Public Embed APIs

1. Implement:

```http
GET  /public/businesses/:slug/listings
GET  /public/listings/:id
GET  /public/listings/:id/availability?date=YYYY-MM-DD
POST /public/bookings/quote
POST /public/bookings/checkout
GET  /public/bookings/:id/confirmation
```

2. Public APIs must never expose:
   - internal notes
   - user records
   - business owner info
   - payment event data
   - audit logs

3. Add CORS rules:
   - dashboard API: strict origin
   - public embed API: allow configured business domains later
   - local dev: allow localhost

## Phase 12: Performance

1. Add indexes before load testing:
   - bookings by `listingId/date/startTime/status`
   - holds by `listingId/date/startTime/expiresAt`
   - listings by `businessId/status`
   - audit logs by `businessId/createdAt`

2. Keep availability generation stateless and fast.

3. Avoid loading giant nested objects by default.

4. Paginate:

```http
GET /bookings?limit=25&cursor=...
GET /listings?limit=50&cursor=...
```

`GET /bookings` is an authenticated operator API. It derives the tenant from the verified access token and returns `{ "items": [...], "nextCursor": "..." }`, with `limit` defaulting to `25` and capped at `100`. `GET /bookings/:id` must use the same tenant scope and return a generic `404` for both missing and cross-tenant IDs.

5. Use select projections:

```ts
select: {
  id: true,
  title: true,
  status: true,
}
```

## Phase 13: Security Hardening

1. Add a global validation pipe in NestJS:
   - whitelist unknown fields
   - reject non-whitelisted fields
   - transform payloads safely

2. Add security middleware:
   - Helmet
   - CORS
   - request size limits
   - rate limiting

3. Add audit logs for:
   - login
   - logout
   - listing create/update/delete
   - availability changes
   - booking cancel/refund
   - business settings updates
   - payment webhook received

4. Sanitize logs:
   - no passwords
   - no raw auth tokens
   - no full payment secrets
   - avoid logging full PII unnecessarily

5. Add role guards:
   - owner/admin can manage settings
   - staff can manage bookings/listings
   - viewer is read-only

## Phase 14: SQLite Now, Neon Later

Design Prisma so migration to Postgres is easy:

1. Keep SQL-compatible types.
2. Avoid SQLite-specific raw SQL where possible.
3. Use Prisma enums where possible.
4. Keep IDs as strings.
5. Keep JSON fields minimal.

When ready for Neon:

```env
DATABASE_URL="postgresql://..."
```

Then update Prisma:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Run a new migration path in staging. Do not point production at a migrated SQLite schema without testing.

## Recommended Build Order

1. NestJS app scaffold
2. Prisma SQLite schema
3. Auth/session system
4. Business onboarding
5. Listings CRUD
6. Availability rules/exceptions
7. Add-ons
8. Quote engine
9. Booking holds
10. Mock checkout
11. Stripe checkout
12. Stripe webhooks
13. Refunds
14. Public embed APIs
15. Audit logs
16. Tests and hardening

## Minimum Test Suite

### Auth

- register/login/logout
- refresh rotation
- invalid refresh reuse fails
- rate-limit login attempts

### Tenant Isolation

- cannot read another business listing
- cannot update another business booking
- public APIs expose only public fields

### Pricing

- per-guest listing
- per-booking listing
- per-guest add-on
- per-booking add-on
- per-unit add-on
- 6% platform fee stored separately

### Availability

- slot generation
- closed date
- custom capacity
- capacity exceeded

### Booking

- hold created
- expired hold ignored
- double booking prevented
- checkout creates pending booking
- webhook confirms booking

### Payments

- invalid webhook signature rejected
- duplicate webhook ignored safely
- successful payment confirms booking
- refund updates booking/payment status

## Non-Negotiable Rules

1. Payment webhooks confirm bookings.
2. Transactions protect capacity.
3. Every operator query is scoped by `business_id`.
4. Platform fees are stored separately from taxes.
5. Public embed APIs expose only public-safe data.
6. Refresh tokens are rotated and stored hashed.
7. Audit logs exist for operator and payment-sensitive actions.
