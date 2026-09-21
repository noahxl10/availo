# Availo

Availo is an open-source booking management platform for tours, activities, rentals, and other scheduled local services. It is built for operators who want to own their booking stack and self-host it on ordinary infrastructure.

The project is early but already includes a working API, dashboard, booking widget assets, seed data, and a Prisma-backed booking model.


![Availo platform screenshot](https://github.com/user-attachments/assets/76193e34-5cc4-438f-adc6-c945b0a5f218)

## What is included

- NestJS API for businesses, listings, bookings, public availability, checkout, and payment confirmation flows.
- Next.js dashboard for managing listings, bookings, onboarding, and operator views.
- Embeddable booking widget assets in `apps/dashboard/public/embed`.
- Prisma schema and migrations using SQLite by default.
- Shared UI package for reusable dashboard components.

## Tech stack

- Node.js, TypeScript, npm workspaces
- Next.js and React
- NestJS
- Prisma
- SQLite by default

## Quick start

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
```

In another terminal:

```sh
npm run dev
```

Open `http://localhost:3000`. The API runs on `http://localhost:4000`.

The API exposes `GET /healthz` for process liveness and `GET /readyz` for database readiness. Both return `Cache-Control: no-store`; `/readyz` returns `503` with a generic `database_unavailable` error when Prisma cannot reach the database.

For local checkout demos, set `ALLOW_MOCK_PAYMENTS="true"` in `apps/api/.env`. For real checkout, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; Availo confirms Stripe bookings only after a signed webhook matches the booking's stored provider IDs, amount, and currency. Keep mock payments false or unset outside local demo and test environments, and schedule expired-reservation cleanup so stale Stripe Checkout Sessions are closed.

Public quote creation and checkout are rate limited per client IP by default for small self-hosted installs. See `docs/self-hosting.md` before changing public rate-limit settings or enabling proxy IP trust with `TRUST_PROXY_HOPS`.

### First-run behavior

The seeded install loads a demo operator account and sample tour data so contributors can inspect the dashboard and public booking flow immediately. The dashboard reads `NEXT_PUBLIC_API_BASE_URL` and signs operators in with the browser session endpoints; if authentication or the API is unavailable, it shows an explicit status instead of substituting mock data. Email login is tenant-scoped and requires a business slug, email, and password for an active user in an active matching business. The demo-bound registration route is intentionally unavailable; use an explicit onboarding flow when one is implemented.

Access tokens are bound to the session that issued them. Refresh tokens use the opaque `v1.<sessionId>.<secret>` form. They rotate once on `POST /auth/refresh`; reuse of a rotated token revokes active sessions for that operator and requires a fresh login. `POST /auth/logout` revokes the named session and invalidates its access token. These JSON endpoints retain their refresh-token response/body contract for non-browser API clients. Send the access token as a Bearer token to `GET /auth/me`, which returns only the authenticated actor's `userId`, `businessId`, and `role`.

Browser dashboards use `POST /auth/browser/login`, `/auth/browser/refresh`, and `/auth/browser/logout` from a configured dashboard origin. They keep the opaque refresh token in a host-only `HttpOnly`, `SameSite=Lax` cookie scoped to `/auth/browser`; only the short-lived access token is returned in JSON, with `Cache-Control: no-store`. Browser login and refresh never serialize the refresh token. The dashboard keeps access tokens in memory only and coordinates refresh with browser locks plus broadcast messages so refresh-token replay protection remains strict. Use HTTPS in production so the cookie is marked `Secure`.

Public auth endpoints have in-process rate limits before password or refresh-token verification. See `docs/self-hosting.md` before changing `AUTH_*_RATE_LIMIT` settings.

The current admin experience is intentionally simple while Availo moves toward a full tenant-authenticated operator dashboard. Treat public availability, checkout capacity, sessions, CORS, and payment confirmation as the highest-risk areas when contributing.

## Self-hosting

See [docs/self-hosting.md](docs/self-hosting.md) for production-oriented setup notes, environment variables, upgrade steps, and deployment guidance.

For a public install, set at least:

- `apps/api/.env`: `APP_BASE_URL`, `API_BASE_URL`, `CORS_ORIGINS`, `JWT_ACCESS_SECRET`, and `DATABASE_URL`.
- `apps/dashboard/.env.local`: `NEXT_PUBLIC_API_BASE_URL`.

Run the production build with:

```sh
npm run config:check -- --production
npm run build
npm run start:api
npm run start:dashboard
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dashboard on port 3000. |
| `npm run dev:api` | Start the API on port 4000. |
| `npm run build` | Build all workspaces that expose a build script. |
| `npm run typecheck` | Typecheck all workspaces. |
| `npm test` | Run workspace tests. |
| `npm run config:check` | Check self-host environment files; pass `-- --production` before deploying. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate` | Apply local Prisma migrations. |
| `npm run db:seed` | Load demo seed data. |

## Project status

Availo is pre-1.0. Expect rough edges, missing hardening, and changing APIs. It is suitable for experimentation, local pilots, and contributors who want to shape the self-hosted booking workflow.

Before using it in production, review [SECURITY.md](SECURITY.md), replace all example secrets, put the services behind HTTPS, and verify payment flows for your environment.

## Contributor context

See [AGENTS.md](AGENTS.md) for the product direction, engineering expectations, security baseline, and common commands used by maintainers and coding agents.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Availo is released under the [MIT License](LICENSE).
