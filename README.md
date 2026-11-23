# Drape & Drop

Android-first wardrobe application built with React Native + Expo, FastAPI, Supabase Auth, PostgreSQL and private Supabase Storage.

## Repository

- `mobile/` — application screens, authenticated API integration and frontend tests.
- `backend/` — business APIs, authorization, maintenance workers and backend/database tests. The legacy registration coordinator remains for compatibility.
- `supabase/` — versioned migrations, local configuration, email templates and verification tools.
- `docs/` — current API/security specifications, workflow tracker, setup guides and checkpoints.
- `docs/archive/` — historical audit reports; these describe earlier states.
- `docs/architecture/exports/` — preserved architecture and database design PDFs/text.
- `.github/workflows/` — backend, database and frontend CI.

## Current status

The repository contains authentication, profiles, onboarding, wardrobe/images, catalog/admin, outfit management, deterministic recommendations and feedback, and try-on job infrastructure. All ten workflows are not complete; ML remains deferred. Local test success does not establish hosted readiness.

Hosted database history was last verified through migration `202611090010`; six `20261123` migrations remain local candidates. Hosted signup is disabled, and the legacy eligibility gate currently blocks the reviewed account. Recovery backup verification and the direct-auth rollout are required before registration and signed-in workflows can be accepted end to end. Do not bypass eligibility or weaken RLS.

- [Current workflow implementation tracker](docs/workflows/SADD_IMPLEMENTATION_TRACKER.md)
- [Production readiness checklist](docs/PRODUCTION_READINESS_CHECKLIST.md)
- [Local setup](QUICK_START.md)
- [API design](docs/backend/api-design.md)
- [Authentication/security architecture](docs/backend/authentication-and-security.md)
- [Direct Supabase Auth rollout](docs/backend/direct-supabase-auth.md)
- [Latest saved preview checkpoint](docs/checkpoints/2026-11-23-full-stack-preview.md)
- [Use-case, activity, sequence and architecture diagrams](docs/architecture/diagrams/index.md)
- [Documentation index](docs/INDEX.md)

`main` is the only branch. Historical branch tips and the full preview checkpoint are preserved in Git tags. Private environment files, credentials, dependency folders and build outputs are excluded from Git.

## Setup guides

- [Frontend setup](docs/frontend/setup.md)
- [Backend setup](docs/backend/setup.md)
- [Database setup](docs/backend/database/setup.md)

This root file is the repository's only README. Detailed guides, diagram indexes and historical records live under `docs/`.
