# Documentation

Start with the [workflow tracker](workflows/SADD_IMPLEMENTATION_TRACKER.md) and [production readiness checklist](PRODUCTION_READINESS_CHECKLIST.md). They distinguish local implementation, hosted blockers and deferred ML work.

## Current specifications and setup

- [API design](backend/api-design.md) and [original API requirements](backend/api-requirements.md).
- [Authentication and security](backend/authentication-and-security.md) and [direct Supabase Auth rollout](backend/direct-supabase-auth.md).
- [Database inventory](backend/database/entity-inventory.md), [logical model](backend/database/relational-model.md) and [physical specification](backend/database/physical-schema-specification.md).
- [Frontend data audit](frontend/backend-only-data-audit.md), [OAuth setup](frontend/social-auth-setup.md) and [Vercel setup](frontend/vercel-deployment.md).
- [Android testing](ANDROID_INTERNAL_TESTING.md).

## History and design artifacts

- `checkpoints/` and `versions/` preserve saved version evidence.
- `archive/` contains earlier audits, consolidation records and access diagnostics. Their completion claims are historical snapshots.
- `architecture/exports/` contains preserved PDF and text architecture/design documents. Proposed diagrams do not prove that a schema is deployed.

Canonical executable database changes belong in `supabase/migrations/`. Historical SQL review stubs remain under `workflows/sql/` because the verification tooling still references them.

## Diagrams and setup

- [Use-case, activity, sequence and high-level architecture diagrams](architecture/diagrams/index.md).
- [Backend setup](backend/setup.md), [frontend setup](frontend/setup.md) and [database setup](backend/database/setup.md).
