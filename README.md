# Drape & Drop

A personal wardrobe application built with React Native + Expo, FastAPI, Supabase Auth, PostgreSQL and private Supabase Storage. Android is the first target platform.

## Project structure

- `mobile/` — application screens, API integration and frontend tests.
- `backend/` — business APIs, authorization, maintenance workers and backend/database tests.
- `supabase/` — migrations, local configuration, email templates and verification tools.
- `docs/` — requirements, architecture diagrams, API/security specifications and setup guides.
- `.github/workflows/` — automated backend, database and frontend checks.

## Development

Start with the [local setup guide](docs/setup.md). Detailed guides cover the [frontend](docs/frontend/setup.md), [backend](docs/backend/setup.md) and [database](docs/backend/database/setup.md).

Private `.env` files and credentials are excluded from Git. Configure them privately on each laptop using the tracked `.env.example` templates. Install dependencies locally; do not copy dependency or build folders through Git.

## Architecture and requirements

- [Product requirements](docs/PRD.md)
- [System architecture](docs/architecture.md)
- [API design](docs/backend/api-design.md)
- [Authentication and security](docs/backend/authentication-and-security.md)
- [Direct Supabase authentication](docs/backend/direct-supabase-auth.md)
- [Database model](docs/backend/database/relational-model.md)
- [Database specification](docs/backend/database/physical-schema-specification.md)

## Diagrams

- [Use cases](docs/architecture/diagrams/use-case/)
- [Activities](docs/architecture/diagrams/activity/)
- [Sequences](docs/architecture/diagrams/sequence/)
- [High-level architecture](docs/architecture/diagrams/high-level/)

The supplied diagrams include planned features and are design references, not proof of implemented functionality.

## Current status

See the [workflow tracker](docs/workflows/SADD_IMPLEMENTATION_TRACKER.md) and [release checklist](docs/PRODUCTION_READINESS_CHECKLIST.md) for remaining work. All ten workflows are not complete. ML inference and external model integration remain deferred.

The development project has 24 recorded migrations. Email-confirmed signup and local/Android callbacks are configured; custom SMTP delivery and full new-account acceptance remain pending. The approved existing account uses time-limited development access. Installed Android verification and production acceptance are separate from local tests.

`main` is the only branch. Earlier checkpoints and removed reports remain recoverable through [Git history](https://github.com/nishanthreddy-28/Generative-CV-in-Fashion/commits/main/) and [tags](https://github.com/nishanthreddy-28/Generative-CV-in-Fashion/tags).
