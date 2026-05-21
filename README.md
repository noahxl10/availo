# Availo

Availo is an open-source booking management platform for tours, activities, rentals, and other scheduled local services. It is built for operators who want to own their booking stack and self-host it on ordinary infrastructure.

The project is early but already includes a working API, dashboard, booking widget assets, seed data, and a Prisma-backed booking model.

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

## Self-hosting

See [docs/self-hosting.md](docs/self-hosting.md) for production-oriented setup notes, environment variables, upgrade steps, and deployment guidance.

For a public install, set at least:

- `apps/api/.env`: `APP_BASE_URL`, `API_BASE_URL`, `CORS_ORIGINS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `DATABASE_URL`.
- `apps/dashboard/.env.local`: `NEXT_PUBLIC_API_BASE_URL`.

Run the production build with:

```sh
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
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate` | Apply local Prisma migrations. |
| `npm run db:seed` | Load demo seed data. |

## Project status

Availo is pre-1.0. Expect rough edges, missing hardening, and changing APIs. It is suitable for experimentation, local pilots, and contributors who want to shape the self-hosted booking workflow.

Before using it in production, review [SECURITY.md](SECURITY.md), replace all example secrets, put the services behind HTTPS, and verify payment flows for your environment.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Availo is released under the [MIT License](LICENSE).
