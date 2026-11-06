# Backend checkpoint 002 — Database foundation

November 6, 2026 · Backend version **0.2.0** · Local implementation checkpoint, not a hosted deployment or Git tag.

## Approved scope and implemented result

Following approval of the physical proposal's foundation milestone, this checkpoint adds six tables in one transactional migration: user_profiles, body_profiles, user_preferences, account_lifecycle, account_deletion_tombstones and administrator_memberships. Existing API contracts and approved security architecture are unchanged. The pre-existing entity-inventory edits and untracked logical/physical design documents were preserved.

- [Migration](../../supabase/migrations/202611060001_foundation.sql): private tables, Auth UUID FKs, singleton keys, field constraints, forced RLS, immutable owner permissions and explicit grants. Tombstone deliberately has no Auth FK. No speculative indexes beyond required PK indexes.
- Exposed invoker wrappers call narrowly granted private functions with dedicated non-owner/non-BYPASSRLS execution roles and fixed empty search paths. All operation inputs are allowlisted; current user identity derives from Auth claims. Supabase-style broad function defaults are explicitly reset; trusted lifecycle/membership functions are not callable by normal/anonymous roles.
- Trusted bootstrap is idempotent, creates empty body/preferences records, preserves user edits and does not reactivate disabled/deleting users. No automatic signup activation/confirmation assumption, permission grant or Auth trigger.
- Trusted disable/enable (excluding deleting), catalog-membership and begin-deletion operations; begin-deletion atomically records denial plus minimal tombstone. No deletion cleanup, tombstone expiry or public DELETE /account implementation is claimed.
- [Foundation routes](../../backend/app/foundation.py): GET/PATCH /profile and GET/PATCH /settings, existing API contracts 10/11/14/15. Input/response validation, extra-field rejection, full-form clearing and 204 mutation success. Preference boolean storage is projected as the existing Enabled/Disabled/empty strings. Empty bootstrap profile remains editable.
- [Eligibility dependency](../../backend/app/dependencies.py): when explicitly enabled, same-user Data API eligibility must confirm active and match the verified FastAPI subject. Malformed/unknown dependency results fail closed. The adapter forwards the current user's JWT and publishable key with the api schema header, without privileged fallback.
- Profile/settings mutations lock eligibility until transaction completion and repeat checks inside the database. Restrictive Storage policy requires current active eligibility in addition to any existing permissive object authorization; it creates no bucket or permissive object access.
- Backend version metadata is 0.2.0. Setup and default-disabled environment flag are documented in [backend README](../../backend/README.md) and [database setup](../../supabase/README.md).

## Verification and evidence limits

- **47 backend security/HTTP contract tests pass**. Existing JWT/transport tests remain, including concurrent token isolation; new tests cover database-subject mismatch, schema headers, fail-closed eligibility, protected-field rejection, current profile/settings contracts and state changes after the FastAPI check.
- **35 real PostgreSQL 15.18 tests pass** in a fresh disposable Unix-socket-only cluster. The migration is applied from scratch; test-only Auth/Storage interfaces isolate it from any user database. Coverage includes direct-table denial, executor RLS ownership, blank clearing, trusted-only operations despite broad default function grants, immutable owners, active/disabled/deleting object operations, missing lifecycle, trusted admin membership, bootstrap idempotency, tombstone survival and concurrent update/disable in both orderings.
- Python compilation and diff whitespace checks pass. The standard backend test command skips the 35 database tests unless an explicitly isolated test socket is provided; the dedicated runner provisions it and runs those tests.
- PostgreSQL tests use test-only request claims and minimal Auth/Storage tables, **not real Supabase JWT validation/gateway or Storage HTTP**. Test fixtures/transport responses are confined to tests; no application mocks or fake business results are introduced.
- No hosted project URL/credentials/settings were changed. No hosted migration, PostgREST custom-schema, actual Storage signing, physical-device or full frontend workflow verification occurred. Existing Starlette TestClient deprecation warning remains.

## Activation and deferred work

`DATABASE_FOUNDATION_ENABLED` defaults false. Profile/settings routes remain authenticated and fail closed with 503 until actual project provisioning and live A/B/admin Data API/Storage checks pass. See the setup document for ordered installation and explicit limitations; never turn on the flag merely because local tests passed.

No frontend files or Supabase Auth frontend callers were changed. Measurement columns currently remain empty through all permitted normal operations; body API/precision/conversion decisions remain pending. No garment/catalog business tables, image workflows, outfits, recommendation producer, try-on worker, full deletion/retention workflow or admin HTTP workflow was implemented. Previously signed URL delivery and in-flight Storage operations are not claimed immediately revocable.

Next: configure an isolated development Supabase project, apply/review the migration and api schema exposure, prove actual caller identity/RLS/lifecycle/storage behavior, then enable the foundation. Complete the explicit frontend Supabase Auth migration separately. Resolve body/unit/default policy, image retention, deletion semantics and mixed-source API adaptation before their respective implementation milestones.

## Version record

The approved foundation is recorded under the annotated Git tag `backend-v0.2.0-database-foundation`. This tag preserves local implementation/test evidence only; it is not hosted security acceptance. Supabase CLI linking is tracked separately.
