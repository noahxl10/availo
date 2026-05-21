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

## Configuration

API variables live in `apps/api/.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma database URL. Defaults to `file:./dev.db` for SQLite. |
| `JWT_ACCESS_SECRET` | Yes | Secret used to sign short-lived access tokens. |
| `JWT_REFRESH_SECRET` | Yes | Reserved for refresh-token workflows. Use a different value from `JWT_ACCESS_SECRET`. |
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

## Production build

```sh
npm run build
npm run start:api
npm run start:dashboard
```

For production, run the API and dashboard as separate long-running services. Put both behind HTTPS and set the public URLs in `apps/api/.env` and `apps/dashboard/.env.local`.

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
