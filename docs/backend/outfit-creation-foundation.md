# Outfit creation foundation — local implementation

Implemented on `main`, 2026-11-08. Scope: database and backend creation/list/detail only. No hosted Supabase change, remote migration, feature-flag enablement, frontend modification, outfit editing/filtering, recommendation saves or try-on implementation.

## Endpoints and representation

All routes require verified Supabase authentication and an active account. FastAPI uses the current request's JWT through the existing immutable user-scoped Data API adapter; there is no service-role fallback. Owner identity is derived server-side and cannot be supplied in payloads.

- `POST /outfits` returns 201 with the created outfit, atomically including its ordered items.
- `GET /outfits` returns `{items, nextCursor}` for the authenticated owner; an empty collection returns `items: []`. Default newest-first order, `limit` 1–100 (default 24), optional opaque owner-bound cursor. Empty `search`/`category` and `sort=newest` match existing collection defaults. Non-empty filters and name sorting explicitly return 422 because filtering is deferred.
- `GET /outfits/{outfit_id}` returns one owned aggregate. Missing and other-user IDs both return 404.

Existing manual builder input remains accepted:

```json
{"name":"Weekend look","garmentIds":["<owned wardrobe UUID>","<another owned wardrobe UUID>"],"description":"Optional notes","occasion":"Weekend"}
```

This task also requires catalog references. The backend therefore accepts an explicit, mutually exclusive typed representation:

```json
{"name":"Weekend look","items":[{"source":"wardrobe","garmentId":"<owned wardrobe UUID>"},{"source":"catalog","garmentId":"<active catalog UUID>"}]}
```

Each item source must be `wardrobe` or `catalog`; each ID must be a UUID. No client ownership, position, timestamps, privileged fields or arbitrary extra attributes are accepted. Exactly one representation is allowed; null representations and duplicates are rejected. Same UUID values in different source tables remain distinct identities. Name is trimmed/nonblank with a 200-character maximum; occasion allows 200 characters and description 2,000. Optional metadata defaults to empty text; explicit null is rejected.

Manual creation requires 2–100 items. The minimum of two preserves the existing manual frontend rule; the upper bound limits aggregate work. Empty and single-item outfit submissions return 422. Empty *collections* are valid. No empty draft persistence or recommendation-save minimum is implied.

Response fields are `id`, `name`, `description`, `occasion`, `items` and `garmentIds`. `items` contains the complete ordered typed references. The legacy `garmentIds` projection contains only wardrobe references in order; catalog IDs are never disguised as wardrobe IDs. Garment records/images are referenced rather than copied. No outfit image or invented image URL is generated.

The original 35-contract requirements document and frontend files are unchanged. Typed items are an explicit backend extension necessary for this task. The current manual builder still selects wardrobe only, and the current detail UI only maps `garmentIds` to wardrobe routes: it cannot display all mixed-source members. Mixed-source frontend integration requires a later approved task; do not claim that UI workflow complete. The existing collection's non-default filtering controls and existing edit/delete actions remain unsupported by this milestone. Recommendation-ID saves are rejected as unsupported payloads.

## Migration and integrity

Additive migration: `supabase/migrations/202611080004_outfits.sql`. Earlier migrations/data are preserved.

- `app_private.saved_outfits`: stable UUID, Auth owner reference, bounded metadata, creation timestamp and unique `(id,owner_id)` identity.
- `app_private.outfit_items`: ordered composite primary key, parent/owner composite FK, private wardrobe/owner composite FK, shared catalog FK and exactly-one-source constraint. Per-source membership uniqueness prevents duplicates without conflating separate source tables. Position is bounded 0–99.
- Four indexes cover owner/newest listing, owner/item lookup and both garment-reference FK paths.
- Both tables enable and force RLS. Normal, anonymous and service API roles have no base-table privileges. The existing non-owner/non-login/non-bypass execution role receives SELECT/INSERT only. Owner/active-account policies apply independently of FastAPI. API functions remain invoker wrappers around reviewed fixed-search-path private functions; private record projection is not directly callable by authenticated clients. No standalone item mutation API or UPDATE/DELETE grants are introduced.
- Minimum item count and item authorization are enforced in the transactional aggregate RPC. Base-table constraints additionally enforce reference, owner, duplicate and source consistency. The minimum is not claimed to follow from an ER/FK constraint; ordinary callers cannot bypass the RPC with direct writes.

Creation checks eligibility under the existing lifecycle share lock, validates all references, locks source records in deterministic source/UUID order and inserts header/items in one transaction. Another user's wardrobe reference is unavailable even to a catalog administrator. Catalog targets must be active at submission. A later catalog deactivation preserves the saved reference and cannot delete the outfit.

Catalog reference locking uses the existing read-only control role with a narrowly scoped SELECT and `UPDATE(id)` row-lock privilege. Its RLS update policy has `WITH CHECK(false)`, so it cannot actually modify the catalog even with that column grant. A private helper callable only by the execution role obtains `FOR SHARE` without granting ordinary users catalog write permission. Tests verify normal users can create catalog-containing outfits, cannot invoke the helper directly, and cannot mutate through the lock role. No new administrative membership or elevated client is introduced.

Referenced wardrobe deletion is restricted by the FK, preserving outfits and source integrity. The existing error adapter now maps SQLSTATE 23503 to a safe HTTP 409 without exposing relationship details. This is a necessary integration change to wardrobe deletion; it is not an outfit editing/deletion implementation. Users currently have no supported action to remove a saved reference, because those workflows are explicitly deferred.

The wardrobe source FK is deferrable but initially immediate. A future trusted account-deletion transaction must either delete outfit aggregates before wardrobe records or explicitly defer that FK while Auth cascades remove both, then validate constraints before commit. Tests cover the latter ordering; bare Auth deletion with initially immediate constraints can be blocked by references. This milestone does not implement or certify account deletion or Storage cleanup. Deleting an outfit parent through a future trusted operation cascades its items only, never garments/catalog data.

## Errors and deferred work

401: invalid/missing authentication. 403: inactive/ineligible access. 404: missing/inaccessible outfit or unavailable garment reference. 409: referenced-record deletion conflict. 422: malformed payload, invalid fields/items/UUIDs/duplicates/query/cursor or unsupported variants. 503: security/database dependency unavailable or malformed upstream response. Unexpected upstream details are suppressed, and no fallback grants access.

Deferred: frontend typed references/navigation; outfit PATCH/DELETE/item replacement; filtering/name sort; recommendation saves; outfit preview assets; idempotent retry behavior and product limits beyond this bounded foundation; complete account deletion; hosted migration/PostgREST/RLS acceptance. Existing local feature configuration remains `DATABASE_FOUNDATION_ENABLED=false`.

## Verification

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py --ignore=backend/tests/test_outfits_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
```

From `mobile`: `npm test`, `npm run typecheck`, `npm run lint`.

HTTP tests intercept only external transport in tests; separate PostgreSQL tests apply migrations solely in a fresh disposable Unix-socket cluster using minimal test Auth/Storage interfaces. Coverage includes empty/populated collections, valid wardrobe/mixed references, source UUID collisions, ownership, invalid inputs, aggregate rollback, direct grants/RLS/FK constraints, anonymous/disabled/deleting accounts, cursor pagination, referenced deletion, catalog deactivation retention and a two-connection deactivation/creation race. Existing foundation/body/wardrobe/catalog tests are retained. No mock production data, live products or hosted acceptance is implied.

Final local results: **267 API/security tests passed**, **180 disposable PostgreSQL tests passed**, **29 frontend regression tests passed**. Python compilation, frontend typecheck and lint passed. No tests failed or were skipped in these explicitly selected runs. Existing Starlette TestClient and Node module-type warnings remain; dependencies were unchanged. Hosted integration and physical-device workflows are unverified. The initial PostgreSQL failures exposed catalog row-lock authorization and trusted account-deletion ordering; corrected behavior is covered by the passing suite.
