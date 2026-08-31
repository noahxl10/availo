# Security Policy

Availo is early-stage software. Review and harden it before using it for production bookings, payments, or customer data.

## Reporting a vulnerability

Please do not open a public issue for security reports. Email the maintainer or use a private GitHub security advisory if the repository has advisories enabled.

Include:

- A short description of the issue.
- Steps to reproduce it.
- The affected route, package, or file.
- Any suggested fix or mitigation.

## Self-hosting checklist

- Replace all example secrets in `apps/api/.env`.
- Use HTTPS in front of both the dashboard and API.
- Set `CORS_ORIGINS` to the exact dashboard origin.
- Back up the database before upgrades.
- Use Stripe webhook signature verification before accepting real payments.

## Dependency advisory exceptions

CI blocks high and critical dependency advisories unless a high-severity advisory has a documented, time-limited exception in [`security/npm-audit-allowlist.json`](security/npm-audit-allowlist.json). Critical advisories cannot be excepted. Every exception records an owner, expiry date, and risk rationale; expired or newly discovered advisories fail the build.
