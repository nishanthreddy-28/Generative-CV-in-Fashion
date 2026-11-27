# Admin catalog management — local implementation

Implemented on `main` on 2026-11-08. This is local source and disposable-test evidence, not hosted Supabase acceptance. `DATABASE_FOUNDATION_ENABLED` remains false. No hosted migration, configuration, administrator grant or bucket operation was performed.

## API and frontend

- `POST /admin/catalog`: authenticated, active trusted administrator; multipart `metadata` JSON plus required `image`; 201 catalog garment.
- `PATCH /admin/catalog/{id}`: same authorization; multipart metadata with optional replacement image, or JSON metadata; 204. Omitted fields and image are preserved; empty optional text clears it; nullable price clears it.
- `DELETE /admin/catalog/{id}`: same authorization; 204; deactivates the record atomically. Repeated deactivation is safe. Records, IDs and the current image remain available to administrators, preserving future relationship targets. Permanent deletion, reactivation and retention/purge procedures are not implemented.
- `GET /admin/catalog` and `GET /admin/catalog/{id}`: administrator collection/detail, including inactive records. The existing shared collection/editor screens use these endpoints.
- `GET /catalog` and `GET /catalog/{id}`: active authenticated users can read active shared catalog garments. This checkout did not previously contain the catalog read implementation; these routes were needed for the admin workflow and read regression tests. Anonymous reads are not enabled, matching the existing frontend/API requirements.
- Both collections support literal name/brand substring search, the existing six categories, newest/name sorting, limits 1–100 (default 24) and opaque cursors bound to subject, filters and collection mode. Pagination uses stable timestamp/name and UUID ordering. Deactivated records disappear from ordinary collections and return 404 on ordinary detail/image retrieval.
- `GET /catalog/{id}/image` and `GET /admin/catalog/{id}/image`: current-JWT image byte retrieval with private/no-store caching. Administrator image retrieval also supports inactive records.
- Supporting `GET /admin/catalog/access`: active authenticated users receive only `{userId,isCatalogAdmin}` from the existing `api.account_access` RPC. This is an additional UI permission projection, not a replacement for any of the existing 35 contracts. The API requirements document is unchanged. The frontend validates the response subject and boolean, fails closed on errors, and refreshes the projection on Auth/session changes and app activation. User-editable Auth/profile metadata is never an administrator source. Every privileged endpoint independently checks membership, regardless of UI state.

The existing editors retain loading/retry, required-photo, validation, draft, busy, error and save/navigation behavior. The admin editor now explicitly says **Deactivate**, shows inactive status, and uses authenticated image retrieval. No redesign, demo products or fake production responses were introduced.

Validation permits existing garment metadata fields and optional INR price between 0 and 1,000,000, at most two decimal places. Blank price is null. Unknown/privileged attributes (including ownership, active, role, image association and timestamps) are rejected. Category, string limits and price are validated in both HTTP and RPC layers. Common errors are 401 unauthenticated, 403 unauthorized/inactive, 404 missing/unavailable garment, 413 oversized upload, 415 invalid image/media, 422 invalid fields/query, and 503 unavailable/malformed security dependencies. Upstream bodies and credentials are not exposed.

## Database and authorization

Additive migration: `supabase/migrations/202611080003_catalog.sql`. Existing migrations and catalog data are not rewritten. It creates shared `app_private.catalog_garments` and `catalog_images`, required unique current-image association, foreign key, bounded metadata/price/image constraints and collection/category/cleanup indexes. No catalog products are seeded.

Both tables enable and force RLS. Base table privileges are revoked from anonymous, authenticated and service roles; authenticated users receive only reviewed RPC execution. API RPC wrappers remain invoker functions. Fixed-search-path private helpers execute through the existing non-owner, non-login, non-bypass `dd_user_executor` with operation/column grants and RLS; there is no service-role fallback. Shared reads require active accounts and active items; admin mutations require the existing trusted `administrator_memberships` `catalog_manage` permission. Normal users cannot bypass this by directly calling the Data API or setting JSON role/owner fields. No admin-grant HTTP endpoint or frontend role editor is introduced.

Mutation guards acquire the existing active-account share lock. Trusted membership revocation takes the conflicting lifecycle lock, so revocation and in-flight mutation serialize. Database checks repeat authorization after the FastAPI eligibility check. Trusted membership provisioning continues to require the existing narrowly privileged operator process, which must be configured and tested separately before hosted use.

The private `catalog-images` bucket is shared catalog storage, not personal wardrobe storage. Its migration fails on an incompatible existing bucket. Object paths are immutable `catalog/{image UUID}.jpg`; insert requires a pending image reservation and active administrator membership. Only active associated catalog objects are readable by ordinary active users; administrators can read retained inactive images. Restrictive policies enforce these boundaries even alongside a broader permissive policy; overwrites are denied. Attached images cannot be deleted directly.

Uploads reuse the existing bounded multipart parser, image decoder, metadata stripping, JPEG normalization and current-JWT Storage transport. SQL verifies upload metadata before attaching the image; returned bytes must match reserved size/hash and pass decoding. Replacement/failed-upload cleanup has durable states and retries during admin writes. Crashes before retirement can leave pending objects; no scheduled reconciliation or age-based purge is claimed. Deactivation deliberately retains its attached asset. No hosted Storage HTTP/ownership integration is certified by the local primitives.

## Verification and deployment boundary

Run from repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
```

Run from `mobile`:

```sh
npm test
npm run typecheck
npm run lint
npm run export:android -- --output-dir /tmp/dd-admin-catalog-android
```

Local results: 226 backend API/security tests passed; 151 PostgreSQL tests passed (foundation/body/wardrobe/catalog, including a two-connection administrator revocation race); 29 frontend contract/validation/Auth tests passed; Python compilation, frontend typecheck/lint and Android JavaScript export passed. Existing Starlette TestClient/Node module-type and export environment warnings remain; no dependencies were changed. The initial sandboxed PostgreSQL attempt could not allocate shared memory; the approved disposable runner then passed outside that restriction. An initial frontend command invoked from repository root found no package.json; rerunning from `mobile` passed.

Frontend tests exercise request serialization, authenticated images, trusted permission projection, errors and currency validation. They do not mount native UI or certify physical-device interactions. API transport tests intercept external Supabase calls only within tests; separate PostgreSQL tests exercise actual grants, constraints and RLS against disposable test Auth/Storage interfaces. No local test proves hosted PostgREST, JWT gateway, live Storage or physical Android behavior.

Before activation: review/apply migrations in the approved development project in a separately authorized task, verify API exposure/grants and real user/admin provisioning, test A/B isolation, membership revocation, active/disabled/deleting states, real Storage upload/read/replace and callback/native UI behavior. Keep the foundation feature flag false until the required hosted acceptance checks pass. Outfit, recommendation, try-on and ML work remain out of scope.
