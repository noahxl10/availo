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
| `STRIPE_SECRET_KEY` | No | Stripe API key for future real payment flows. |
| `STRIPE_WEBHOOK_SECRET` | No | Enables Stripe webhook signature requirements when set. |

Dashboard variables live in `apps/dashboard/.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser-visible API base URL. |
| `NEXT_PUBLIC_APP_BASE_URL` | Recommended | Browser-visible dashboard URL used to generate absolute booking-widget script snippets. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_WIDGET_SCRIPT_URL` | No | Override for the absolute widget script URL if serving `availo-booking-widget.js` from a CDN or separate asset host. |

## Embeddable widget

The dashboard embed screen generates a copy-paste snippet with `data-api-base-url`, `data-business-slug`, `data-listing-id`, and an absolute widget script URL. Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_APP_BASE_URL` to the externally reachable HTTPS origins before giving that snippet to operators.

The widget hydrates from `GET /public/widget`, which returns one bounded, public-safe payload for the selected listing and up to 7 days of availability. Widget availability exposes only whether a slot is available, not exact remaining capacity.

## Production build

```sh
npm run build
npm run start:api
npm run start:dashboard
```

For production, run the API and dashboard as separate long-running services. Put both behind HTTPS and set the public URLs in `apps/api/.env` and `apps/dashboard/.env.local`.

Do not deploy with `CORS_ORIGINS="*"`. The API uses credentialed CORS and rejects wildcard origins at startup.

## Database notes

SQLite is the current default and works well for evaluation and small installs. Keep the `apps/api/prisma/dev.db` file on persistent storage and back it up before pulling updates.

The Prisma schema is in `apps/api/prisma/schema.prisma`. If you switch providers, update the datasource and create new migrations before deploying.

## Upgrades

```sh
git pull
npm install
npm run db:generate
npm run db:migrate
npm run build
```

Restart the API and dashboard services after a successful build.
