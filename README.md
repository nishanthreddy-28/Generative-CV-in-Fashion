# Drape & Drop

Android-first wardrobe application built with React Native + Expo, FastAPI, Supabase Auth, PostgreSQL and private Supabase Storage.

## Repository

- `mobile/` — application screens, authenticated API integration and frontend tests.
- `backend/` — business APIs, authorization, maintenance workers and backend/database tests. The legacy registration coordinator remains for compatibility.
- `supabase/` — versioned migrations, local configuration, email templates and verification tools.
- `docs/` — current API/security specifications, workflow tracker, setup guides and checkpoints.
- `docs/architecture/exports/` — preserved architecture and database design PDFs/text.
- `.github/workflows/` — backend, database and frontend CI.

## Current status

The repository contains authentication, profiles, onboarding, wardrobe/images, catalog/admin, outfit management, deterministic recommendations and feedback, and try-on job infrastructure. All ten workflows are not complete; ML remains deferred. Local test success does not establish hosted readiness.

On 2026-11-23, all 24 migrations were verified in the development project after an encrypted backup and isolated Auth-data restore preserved both existing accounts. Email-verified signup and exact localhost/Android callbacks are enabled. The existing review account has approved seven-day development access. End-to-end browser sign-in and email delivery remain acceptance checks; custom SMTP is not configured, so public email delivery is not production-ready. Do not bypass eligibility or weaken RLS.

- [Current workflow implementation tracker](docs/workflows/SADD_IMPLEMENTATION_TRACKER.md)
- [Production readiness checklist](docs/PRODUCTION_READINESS_CHECKLIST.md)
- [Local setup](QUICK_START.md)
- [API design](docs/backend/api-design.md)
- [Authentication/security architecture](docs/backend/authentication-and-security.md)
- [Direct Supabase Auth rollout](docs/backend/direct-supabase-auth.md)
- [Latest saved preview checkpoint](docs/checkpoints/2026-11-23-full-stack-preview.md)

`main` is the only branch. Historical branch tips and the full preview checkpoint are preserved in Git tags. Private environment files, credentials, dependency folders and build outputs are excluded from Git.

## Setup guides

- [Frontend setup](docs/frontend/setup.md)
- [Backend setup](docs/backend/setup.md)
- [Database setup](docs/backend/database/setup.md)

This root file is the repository's only README. Detailed setup guides and current specifications live under `docs/`.

## Diagrams

- [Use-case diagrams](docs/architecture/diagrams/use-case/)
- [Activity diagrams](docs/architecture/diagrams/activity/)
- [Sequence diagrams](docs/architecture/diagrams/sequence/)
- [High-level architecture](docs/architecture/diagrams/high-level/)

Supplied diagrams are design references; planned ML, conversational and payment-dispute flows do not establish implemented functionality. Historical audits and old preview notes remain recoverable from Git history.
