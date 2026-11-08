# Current architecture — consolidated source

`main` integrates React Native/Expo/TypeScript, Supabase Auth, Python/FastAPI, and the local PostgreSQL security foundation. The original Next.js/Node/Server Actions architecture is superseded. The old Vite/IndexedDB demo remains in historical branches/tags, as approved; it is not an alternative active authentication or storage authority.

## Runtime boundaries

1. Expo Router screens live in `mobile/src/app`. Shared forms/collections/editors use `features`, `components`, hooks and domain types. Public introduction is independent of backend data. Explicit preview skips private loads and mutations.
2. `services/auth/supabase.ts` creates the Supabase SDK client. `SessionProvider` observes initial restoration and Auth events, schedules foreground refresh, clears drafts on identity exit, and supplies current-token business requests. Native sessions use chunked device SecureStore; web sessions use memory. Confirmation/recovery use isolated, nonpersistent Auth clients and token-hash callbacks. No user-editable administrator metadata is trusted.
3. `services/api/client.ts` sends the current access JWT to FastAPI with JSON or multipart payloads, timeout/error handling and cancellation. Refresh tokens never go to FastAPI. Existing business endpoint shapes remain unchanged. SDK Auth replaces legacy custom Auth callers; it does not create matching FastAPI Auth routes.
4. FastAPI verifies asymmetric signatures via fixed-origin JWKS, claims/expiry/issuer/audience/UUID subject and authenticated nonanonymous role. Immutable principals and request-local `UserDataAPI` forward that user's JWT plus the publishable key; no service-role fallback exists.
5. When explicitly enabled after acceptance, account eligibility uses user-scoped `api.account_access`, requiring returned identity to match the verified subject. Default disabled integration fails closed. SQL helpers independently enforce active status and lock lifecycle for mutations.
6. The migration stores six RLS/forced-RLS base tables in nonexposed `app_private`; five `api` invoker RPCs call constrained private helpers owned by nonowner/non-bypass execution roles. Grants restrict schemas, tables, columns, operations and function execution. Auth identity is external. Trusted operator functions bootstrap accounts, set lifecycle, begin deletion denial and maintain catalog membership.
7. Storage is approved but no application buckets/positive ownership rules/upload service/delivery implementation exists. The local restrictive lifecycle policy alone grants no object access. Full deletion, worker processing, recommendations and try-on results remain unimplemented.

## Folder responsibilities

- `mobile/src/app`: routes and screen composition.
- `mobile/src/features`: forms, validation, session, editors, collections and in-memory drafts.
- `mobile/src/services`: Auth SDK boundary and business fetch transport.
- `mobile/tests`: Node helper/SDK/transport tests; no mounted native suite.
- `backend/app`: configuration, JWT verifier, identity/eligibility dependencies, user-scoped adapter and four foundation HTTP operations.
- `backend/tests`: security/API tests plus disposable PostgreSQL RLS/grants/lifecycle/constraint/concurrency tests.
- `supabase/migrations`: apply-once versioned SQL; never overwrite an applied migration.
- `supabase/verification`: read-only inspection guidance, not an automatic hosted acceptance.
- `docs/backend`: unchanged API/security decisions and conceptual/logical/physical schema proposals, plus checkpoint/setup evidence.
- `.github/workflows`: frontend checks/export, backend checks and dedicated disposable database verification.
- `ml`, `docker`, `scripts`: placeholders; no processing/deployment implementation inferred.

## Implemented API and database boundary

FastAPI implements GET/PATCH `/profile` and GET/PATCH `/settings` only (contracts10/11/14/15). The preserved [35-contract inventory](backend/api-requirements.md) includes future and historical Auth contracts; [Auth transition documentation](backend/frontend-supabase-auth-integration.md) records current callers without silently rewriting them. PATCH uses full form snapshots and204 success. All other domain routes remain missing.

The sole migration `202611060001_foundation.sql` defines user_profiles, body_profiles, user_preferences, account_lifecycle, account_deletion_tombstones and administrator_memberships. Body storage is empty/incomplete; no normal body write API/grants exist until units/precision decisions are approved. Tombstones deliberately lack a live Auth FK; begin deletion is not a completed purge. The additional nine physical-schema proposal tables are not implemented.

## Acceptance boundaries

Local cryptographic/mock-HTTP tests and real disposable PostgreSQL tests are distinct from hosted JWT/PostgREST/Storage acceptance. Existing migration history showed no applied migration in the last read-only dashboard inspection; this consolidation makes no remote request or write. Local config is not hosted config. `DATABASE_FOUNDATION_ENABLED` stays false.

Outstanding design gates include measurement units/precision, mixed wardrobe/catalog outfit references, image delivery/revocation/retention, recommendation expiry/idempotency, trusted bootstrap, job lifecycle and account deletion cleanup. The current Outfit shape cannot express mixed sources honestly; do not copy old IDs, add mock results or bypass RLS to hide that mismatch.

The [master workflow status](WORKFLOW_STATUS.md) records code/history, tests, missing functions and next acceptance steps. Production deployment, native build and Play release have not been accepted.
