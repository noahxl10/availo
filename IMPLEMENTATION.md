# Availo Implementation Map

## Product Source

- Build spec: `/Users/noahalex/Downloads/booking_platform_build_spec.md`
- Design direction: `concepts/option-02/design.md`
- Logo assets: `concepts/option-02/logo.svg` and `concepts/option-02/mark.svg`

## Architecture

Availo is implemented as a TypeScript npm workspace.

| Area | Workspace | Purpose |
| --- | --- | --- |
| Dashboard | `apps/dashboard` | Operator-facing Next.js app |
| API | `apps/api` | Booking, auth, tenant, payments, and embed APIs |
| Embed | `packages/embed` | External booking widget script |
| Shared | `packages/shared` | Domain types, validation, pricing, availability, fixtures |
| UI | `packages/ui` | Tidepool OS tokens and reusable UI primitives |
| QA | `packages/qa` | Playwright and security-oriented test coverage |

## MVP Decisions

- The implementation is TypeScript-first across frontend, backend, embed, tests, and shared packages.
- Stripe is the primary payment provider; Square is represented behind provider abstractions.
- Platform fee is calculated and stored separately at 6%, while customer UI may present a combined `Taxes & fees` line.
- Public booking flows do not require customer login.
- Every authenticated operator query must be scoped by `businessId`.
- Initial integrations can use mock adapters, but API/service boundaries should match production providers.

## Design Decisions

- Use Option 02, `Tidepool OS`, as the default product visual language.
- Use the Slot Card mark for app chrome and the full lockup for brand contexts.
- Favor pale aqua surfaces, teal primary controls, coral only for brand emphasis, and warm yellow/rose for notice/risk.
- Preserve strong focus states, keyboard-friendly controls, and responsive layouts.
