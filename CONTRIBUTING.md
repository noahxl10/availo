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

- Run `npm run typecheck`.
- Run `npm test`.
- Keep changes scoped to one feature or fix.
- Include screenshots for visible dashboard or widget changes.
- Update the README or docs when behavior, setup, or configuration changes.

## Project direction

Availo is aimed at small operators who want a self-hostable booking system. Prefer practical defaults, clear configuration, and code that can run without managed SaaS dependencies.
