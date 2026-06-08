# Availo contributor context

Availo is a self-hostable booking platform for tours, activities, rentals, and scheduled local services. Treat it as production-minded open-source software even while it is pre-1.0.

## Product direction

- Operators should be able to own their booking stack: dashboard, public availability, checkout, payment confirmation, and embeddable booking widgets.
- Default to small-host friendly choices. SQLite is valid for evaluation and small installs; avoid assumptions that require managed infrastructure.
- Public APIs must not leak operator-only fields. Admin APIs must stay tenant-scoped and authenticated as the platform matures.
- Booking capacity is a core invariant: holds, pending payments, confirmations, cancellations, and refunds must not oversell a slot.

## Engineering expectations

- Prefer boring, maintainable TypeScript with explicit validation at boundaries.
- Keep Prisma writes transactional when they affect money, capacity, sessions, or audit logs.
- Validate request bodies with Zod or existing Nest pipes before touching persistence.
- Never add fake fallbacks, placeholder actions, or demo-only secrets to production flows.
- Update affected tests when changing API contracts, booking state, auth, payments, or dashboard data shapes.

## Security baseline

- No wildcard CORS with credentials.
- No example JWT or payment secrets in deployed environments.
- Refresh tokens are opaque one-time credentials: rotate on refresh and revoke on logout.
- Stripe or other real payment webhooks must be signature verified before mutating bookings.
- Dashboard data and operator mutations should derive `businessId` from verified auth context, not constants.

## Useful commands

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
```

Run the narrowest command that proves your change, then the workspace-level command before broad releases.
