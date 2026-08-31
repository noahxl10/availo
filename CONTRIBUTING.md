# Contributing to Availo

Thanks for helping make Availo better. This project is early, so small, focused contributions are easiest to review.

## Local setup

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Copy `apps/dashboard/.env.local.example` to `apps/dashboard/.env.local`.
5. Run `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
6. Start the API with `npm run dev:api`.
7. Start the dashboard with `npm run dev`.

## Before opening a pull request

- Install dependencies with `npm ci` so local verification uses the committed lockfile.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run audit:production`. CI blocks unreviewed high and all critical production advisories; any temporary high-severity exception must be owned, justified, and time-limited in the security allowlist.
- Keep changes scoped to one feature or fix.
- Include screenshots for visible dashboard or widget changes.
- Update the README or docs when behavior, setup, or configuration changes.

Pull requests and pushes to `main` run the same install, Prisma migration/seed, typecheck, test, build, and high-severity production dependency audit in GitHub Actions. Do not merge a pull request while a required check is failing.

## Project direction

Availo is aimed at small operators who want a self-hostable booking system. Prefer practical defaults, clear configuration, and code that can run without managed SaaS dependencies.
