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

After seeding, the dashboard can show the demo operator data served by the API after operator sign-in. If the dashboard cannot authenticate, coordinate a secure browser session, or reach `NEXT_PUBLIC_API_BASE_URL`, it displays an explicit status instead of substituting mock data; fix the API URL, browser support, CORS origin, or API process before treating the install as working.

## Configuration

API variables live in `apps/api/.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma database URL. Defaults to `file:./dev.db` for local SQLite demos; production SQLite installs must use an absolute persistent path such as `file:/var/lib/availo/prod.db`. |
| `JWT_ACCESS_SECRET` | Yes | Secret used to sign short-lived access tokens. Use a long random value. |
| `APP_BASE_URL` | Yes | Public dashboard URL. Also used as the default CORS origin. |
| `API_BASE_URL` | Yes | Public API URL used for generated checkout links. |
| `CORS_ORIGINS` | Recommended | Comma-separated list of dashboard origins allowed to call the API. |
| `PORT` | No | API port. Defaults to `4000`. |
| `API_BODY_LIMIT` | No | Maximum parsed JSON and URL-encoded request body size. Defaults to `256kb`. |
| `EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE` | No | Maximum expired holds and pending-payment bookings processed per cleanup run. Defaults to `500`. |
| `AUTH_LOGIN_IP_RATE_LIMIT` | No | Email login attempts per client IP per auth window. Defaults to `30`; set `0` only as an emergency rollback to disable this limiter. |
| `AUTH_LOGIN_IDENTITY_RATE_LIMIT` | No | Email login attempts per business slug and email per auth window. Defaults to `8`; set `0` only as an emergency rollback to disable this limiter. |
| `AUTH_REFRESH_IP_RATE_LIMIT` | No | Refresh attempts per client IP per auth window. Defaults to `60`; set `0` only as an emergency rollback to disable this limiter. |
| `AUTH_REFRESH_SESSION_RATE_LIMIT` | No | Refresh attempts per named session per auth window. Defaults to `12`; set `0` only as an emergency rollback to disable this limiter. |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | No | Auth rate-limit window. Defaults to `900`. |
| `AUTH_RATE_LIMIT_MAX_KEYS` | No | Maximum active in-memory client and identity buckets for auth rate limits. Defaults to `10000`. |
| `PUBLIC_QUOTE_RATE_LIMIT` | No | Public quote attempts per client IP per window. Defaults to `6`; set `0` only as an emergency rollback to disable the limiter. |
| `PUBLIC_QUOTE_RATE_WINDOW_SECONDS` | No | Public quote rate-limit window. Defaults to `900`, aligned with the 15-minute hold TTL. |
| `PUBLIC_CHECKOUT_RATE_LIMIT` | No | Public checkout attempts per client IP per window. Defaults to `12`; set `0` only as an emergency rollback to disable the limiter. |
| `PUBLIC_CHECKOUT_RATE_WINDOW_SECONDS` | No | Public checkout rate-limit window. Defaults to `900`. |
| `PUBLIC_RATE_LIMIT_MAX_KEYS` | No | Maximum active in-memory client buckets for public rate limits. Defaults to `10000`. |
| `PUBLIC_BOOKING_HORIZON_DAYS` | No | Maximum quote date horizon, in days from the API server date. Defaults to `548`. |
| `TRUST_PROXY_HOPS` | No | Number of trusted reverse-proxy hops for client IP detection. Defaults to `0`, which ignores forwarded IP headers. |
| `STRIPE_SECRET_KEY` | No | Enables hosted Stripe Checkout session creation. |
| `STRIPE_WEBHOOK_SECRET` | No | Required to verify Stripe webhooks before bookings can be confirmed by Stripe. |
| `ALLOW_MOCK_PAYMENTS` | No | Local/demo-only opt-in for mock checkout confirmation. Never enable in production. |

Dashboard variables live in `apps/dashboard/.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser-visible API base URL. |

## Production build

```sh
npm run config:check -- --production
npm run build
npm run start:api
npm run start:dashboard
```

For production, run the API and dashboard as separate long-running services. Put both behind HTTPS and set the public URLs in `apps/api/.env` and `apps/dashboard/.env.local`.

Do not deploy with `CORS_ORIGINS="*"`. The API uses credentialed CORS and rejects wildcard origins at startup.

Public quote creation and checkout each have a small in-process rate limiter for single-node self-hosted installs. They use separate buckets and are not shared across multiple API replicas. If active client buckets reach `PUBLIC_RATE_LIMIT_MAX_KEYS`, newly seen clients fail closed with `429` until older buckets expire; raise the cap only when the host has enough memory. If the API runs behind one trusted reverse proxy, set `TRUST_PROXY_HOPS="1"` and configure the proxy to strip client-supplied forwarding headers before adding its own; otherwise leave `TRUST_PROXY_HOPS="0"` so spoofed `X-Forwarded-For` values are ignored.

Email login and refresh endpoints also use in-process IP plus identity/session rate limits before password or refresh-token verification. These auth buckets are single-node only and are not shared across API replicas; use a reverse proxy or deployment-level limiter before running multiple API nodes.

When `STRIPE_SECRET_KEY` is set, public checkout creates a hosted Stripe Checkout session and binds the pending booking to the returned Checkout Session ID, PaymentIntent ID when available, expected amount, and expected currency. Configure Stripe to send events to `POST /payments/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`; Availo confirms a booking only after a signed successful Stripe event matches the stored provider IDs and money fields. Stripe checkout reservations use a 31-minute payment expiry, aligned with Stripe's minimum custom Checkout Session expiry with a small clock/request buffer.

Mock checkout is intentionally local-only and is ignored when `STRIPE_SECRET_KEY` is configured. Keep `ALLOW_MOCK_PAYMENTS` false or unset in production.

Refund requests also fail closed until Availo has an authenticated refund provider flow.

## Operator authentication

Seeded installs include the demo owner user for local evaluation. Operator email login is tenant-scoped: `POST /auth/email/login` requires `businessSlug`, `email`, and `password`, and it authenticates only active users in an active matching business. The old demo-bound email registration route is not exposed; first-business onboarding should use a deliberate bootstrap flow when one is implemented.

Access tokens are bound to their issuing session, so logout, refresh rotation, refresh-token reuse, or session expiry invalidates protected operator API access for that token. Refresh tokens are opaque database-backed credentials in the form `v1.<sessionId>.<secret>`. Only the secret portion is hashed in the `Session` row. Refresh rotates the named session once; reuse of a rotated token revokes active sessions for that operator and business and requires a fresh login. Logout revokes the named session.

Non-browser API clients continue to use `POST /auth/email/login`, `POST /auth/refresh`, and `POST /auth/logout` with the refresh token in JSON. Browser dashboards use `POST /auth/browser/login`, `/auth/browser/refresh`, and `/auth/browser/logout` instead. These endpoints require an `Origin` exactly matching `CORS_ORIGINS` (or `APP_BASE_URL` when `CORS_ORIGINS` is unset); local development accepts `http://localhost:<port>` and `http://127.0.0.1:<port>` like the CORS default. The browser endpoints put only the opaque refresh token in a host-only `HttpOnly`, `SameSite=Lax` cookie scoped to `/auth/browser`, return the short-lived access token with `Cache-Control: no-store`, and never serialize the refresh token. Browser refresh preserves the same one-time rotation and replay revocation as JSON refresh, so the dashboard uses `navigator.locks` and `BroadcastChannel` to keep refresh single-flight across tabs. Browsers without those coordination APIs fail closed to sign-in instead of risking refresh replay. The cookie is `Secure` in production and when the request is HTTPS. Serve the API and dashboard behind HTTPS in production.

`npm run config:check -- --production` validates the API and dashboard environment files before deployment. It fails when required URLs or secrets are missing, JWT secrets still use example values, production public URLs point at localhost, production SQLite uses a relative database path such as `file:./dev.db`, `CORS_ORIGINS` is wildcarded or missing the dashboard origin, or Stripe is only partially configured. The checker reads `apps/api/.env` and `apps/dashboard/.env.local` by default, then lets real process environment variables override file values so service-manager secrets win. Use `--api-env=path/to/.env` and `--dashboard-env=path/to/.env.local` if your service manager keeps environment files outside the default paths.

## Database notes

SQLite is the current default and works well for evaluation and small installs. Local demos can use `file:./dev.db`, but production installs should point `DATABASE_URL` at an absolute path on persistent backed-up storage, for example `file:/var/lib/availo/prod.db`.

The Prisma schema is in `apps/api/prisma/schema.prisma`. If you switch providers, update the datasource and create new migrations before deploying.

## Expired reservation cleanup

Availo ignores expired quote holds and expired non-Stripe pending payments when calculating capacity, even before cleanup runs. Stripe pending payments keep reserving capacity for a 10-minute webhook delivery grace window after their payment expiry so a payment completed before expiry can still confirm safely. To keep storage and booking state tidy, schedule:

```sh
npm run cleanup:expired-reservations
```

Each run deletes at most `EXPIRED_RESERVATION_CLEANUP_BATCH_SIZE` expired quote holds and marks at most that many expired pending-payment bookings as failed with an audit entry. For Stripe bookings, cleanup waits until the 10-minute webhook grace window has elapsed, then expires the open Checkout Session. Run it every few minutes on a small host so released capacity cannot be paid for through an old hosted Checkout URL; increase the batch size only after observing database write latency.

## Upgrades

```sh
git pull
npm install
npm run db:generate
npm run db:migrate
npm run build
```

Restart the API and dashboard services after a successful build.
