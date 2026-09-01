# Self-hosting Availo

Availo is a Node.js monorepo with a NestJS API, a Next.js dashboard, shared UI components, and Prisma for persistence. The default database is SQLite so the project can run on a small VPS, homelab box, or local machine without managed infrastructure.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A reverse proxy such as Caddy, Nginx, Traefik, or a platform proxy if exposing it to the internet

## First run

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
npm run db:generate
npm run db:migrate
npm run db:seed
```

Start the API:

```sh
npm run dev:api
```

Start the dashboard in a second terminal:

```sh
npm run dev
```

The dashboard will be available at `http://localhost:3000` and the API at `http://localhost:4000`.

After seeding, the dashboard shows the demo operator data served by the API. If the dashboard cannot reach `NEXT_PUBLIC_API_BASE_URL`, it displays bundled fallback data for development; fix the API URL or API process before treating the install as working.

## Configuration

API variables live in `apps/api/.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma database URL. Defaults to `file:./dev.db` for SQLite. |
| `JWT_ACCESS_SECRET` | Yes | Secret used to sign short-lived access tokens. Use a long random value. |
| `JWT_REFRESH_SECRET` | Reserved | Reserved for signed refresh-token workflows. Current refresh tokens are opaque database-backed credentials. |
| `APP_BASE_URL` | Yes | Public dashboard URL. Also used as the default CORS origin. |
| `API_BASE_URL` | Yes | Public API URL used for generated checkout links. |
| `CORS_ORIGINS` | Recommended | Comma-separated list of dashboard origins allowed to call the API. |
| `PORT` | No | API port. Defaults to `4000`. |
| `API_BODY_LIMIT` | No | Maximum parsed JSON and URL-encoded request body size. Defaults to `256kb`. |
| `EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE` | No | Maximum expired holds and pending-payment bookings processed per cleanup run. Defaults to `500`. |
| `PUBLIC_QUOTE_RATE_LIMIT` | No | Public quote attempts per client IP per window. Defaults to `6`; set `0` only as an emergency rollback to disable the limiter. |
| `PUBLIC_QUOTE_RATE_WINDOW_SECONDS` | No | Public quote rate-limit window. Defaults to `900`, aligned with the 15-minute hold TTL. |
| `PUBLIC_RATE_LIMIT_MAX_KEYS` | No | Maximum active in-memory client buckets for public rate limits. Defaults to `10000`. |
| `PUBLIC_BOOKING_HORIZON_DAYS` | No | Maximum quote date horizon, in days from the API server date. Defaults to `548`. |
| `TRUST_PROXY_HOPS` | No | Number of trusted reverse-proxy hops for client IP detection. Defaults to `0`, which ignores forwarded IP headers. |
| `STRIPE_SECRET_KEY` | No | Stripe API key for future real payment flows. |
| `STRIPE_WEBHOOK_SECRET` | No | Enables Stripe webhook signature requirements when set. |
| `ALLOW_MOCK_PAYMENTS` | No | Local/demo-only opt-in for mock checkout confirmation. Never enable in production. |

Dashboard variables live in `apps/dashboard/.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser-visible API base URL. |

## Production build

```sh
npm run build
npm run start:api
npm run start:dashboard
```

For production, run the API and dashboard as separate long-running services. Put both behind HTTPS and set the public URLs in `apps/api/.env` and `apps/dashboard/.env.local`.

Do not deploy with `CORS_ORIGINS="*"`. The API uses credentialed CORS and rejects wildcard origins at startup.

Public quote creation has a small in-process rate limiter for single-node self-hosted installs. It is not shared across multiple API replicas. If active client buckets reach `PUBLIC_RATE_LIMIT_MAX_KEYS`, newly seen clients fail closed with `429` until older buckets expire; raise the cap only when the host has enough memory. If the API runs behind one trusted reverse proxy, set `TRUST_PROXY_HOPS="1"` and configure the proxy to strip client-supplied forwarding headers before adding its own; otherwise leave `TRUST_PROXY_HOPS="0"` so spoofed `X-Forwarded-For` values are ignored.

Mock checkout is intentionally local-only. Production checkout fails closed until a real payment provider is configured in code; setting Stripe webhook secrets verifies inbound Stripe events but does not create Stripe Checkout sessions by itself.

Refund requests also fail closed until Availo has an authenticated refund provider flow.

## Database notes

SQLite is the current default and works well for evaluation and small installs. Keep the `apps/api/prisma/dev.db` file on persistent storage and back it up before pulling updates.

The Prisma schema is in `apps/api/prisma/schema.prisma`. If you switch providers, update the datasource and create new migrations before deploying.

## Expired reservation cleanup

Availo ignores expired holds and expired pending payments when calculating capacity, even before cleanup runs. To keep storage and booking state tidy, schedule:

```sh
npm run cleanup:expired-reservations
```

Each run deletes at most `EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE` expired quote holds and marks at most that many expired pending-payment bookings as failed with an audit entry. Run it every few minutes on a small host; increase the batch size only after observing database write latency.

## Upgrades

```sh
git pull
npm install
npm run db:generate
npm run db:migrate
npm run build
```

Restart the API and dashboard services after a successful build.
