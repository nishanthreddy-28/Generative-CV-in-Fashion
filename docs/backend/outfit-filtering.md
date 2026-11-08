# Outfit filtering and pagination — local checkpoint

Implemented on existing `main`, 2026-11-08. No hosted Supabase changes, remote migrations, feature-flag enablement or recommendation/try-on/ML work. Existing outfit create, metadata edit and item mutations are unchanged. The previous [outfit editing checkpoint](outfit-editing.md) remains historical evidence; its deferred filtering limitation is superseded here.

## GET /outfits

Authenticated, active-account, owner-only read. Uses the current JWT and existing user-scoped Data API adapter, never a service-role fallback.

Supported query parameters:

- `limit`: integer 1–100; default 24.
- `cursor`: optional opaque continuation; maximum 4,000 characters.
- `search`: optional literal, case-insensitive substring of outfit **name**, trimmed; maximum 200 characters. `%`/`_` are literal characters, not SQL wildcard operators.
- `source`: empty/all, `wardrobe`, or `catalog`. Matches an outfit containing at least one item from that source.
- `category`: empty/all or the existing six garment categories. Source and category must match the **same item**. Multiple matching items do not duplicate the outfit.
- `sort`: `newest` (default) or `name`. Newest uses `(created_at DESC, id DESC)`; name uses `(name COLLATE "C" ASC, id ASC)` for deterministic tie-breaking.
- `created_from`: optional timezone-aware timestamp, inclusive.
- `created_before`: optional timezone-aware timestamp, exclusive. When both are present, end must be later than start. API normalization uses UTC; naive, malformed and out-of-range timestamps are rejected.

Response remains `{items: Outfit[], nextCursor: string|null}`. End/empty pages return null continuation. Each outfit retains its existing complete item representation and stable membership IDs.

New version-2 cursors bind the verified owner, canonical applied filters/sort and the last returned ordering tuple. Reusing a cursor with different filters or another owner is rejected with 422; restarting without a cursor is required. Changing page size does not change the ordering boundary. Timezone-equivalent date filters normalize to the same cursor context. Old unversioned API cursors are deliberately rejected; the UI starts a fresh chain. Cursors encode read position, not authentication or permission, and are not claimed to be cryptographically signed. RLS/verified JWT ownership still applies even if a caller fabricates a syntactically valid cursor.

Strict tuple comparisons and `limit+1` avoid offset drift, tied-key duplicates and skipped records for an unchanged matching set. The cursor anchor record need not still exist. This is a live read, not a cross-request database snapshot: insertions, renamed outfits under name sort, item/category changes or changed visibility can alter membership/order between independent requests. No guarantee is made that a mutable result set is frozen. The frontend re-anchors its loaded pages when revisiting, refreshing or loading more, with ID de-duplication, rather than reusing stale page boundaries after editing.

Category lookup respects existing source RLS: retained inactive catalog references still match `source=catalog`, but their inaccessible catalog metadata does not match a category for an ordinary user. Trusted catalog administrators retain their existing visibility; no catalog/personal authorization rules are widened. Garment categories are read live, not snapshotted into outfits.

Errors: 401 invalid authentication, 403 denied account eligibility, 422 invalid query/cursor/filter context, 503 unavailable or malformed dependency. Missing results are an empty page, not an error. No upstream credentials/messages are exposed.

## Database

Additive migration: `supabase/migrations/202611080006_outfit_filtering.sql`.

- Adds `(owner_id, name COLLATE "C", id)` index; reuses existing owner/newest, item-owner and source FK indexes for date/owner and bounded-item lookups.
- Adds `api.query_outfits` invoker wrapper and reviewed fixed-search-path private read helper owned by the existing non-owner/non-login/non-bypass executor. Existing `list_outfits` RPC remains available for backward compatibility, and create/edit/item functions are not replaced.
- Revalidates limits, enums, dates and cursor tuple structure in PostgreSQL. Owner selection and active-account checks are mandatory; all existing FORCE RLS and base-table restrictions remain intact. Anonymous/service execution is revoked; normal authenticated clients can invoke the protected read RPC only.
- Uses EXISTS rather than a multiplying item JOIN; each matching outfit is emitted once. All source queries retain existing RLS. No mutation privileges, policies or roles are added.

Literal substring search is owner-scoped and not a promised full-text/trigram index. No extension, production-sized query-plan certification or performance benchmark is claimed. Hosted plan review remains necessary before scaling.

## Frontend

`/outfits` now uses a dedicated outfit collection screen, leaving shared wardrobe/catalog/admin collection behavior unchanged. It offers name search, source/category filters, newest/name order and calendar inputs labeled as UTC dates. **Created through** is inclusive in the UI and converts to the next UTC midnight for the API's exclusive end.

Applying/clearing filters resets the loaded-page count. **Load more outfits** expands the retained prefix; new results are appended in server order with duplicate-ID protection. Refresh reconstructs that prefix from page one using newly returned cursors, stops early at end-of-list, and rejects repeated cursors. This intentionally trades extra read requests for consistent page boundaries after edits; it is not an infinite retained server snapshot.

Filters (including unapplied drafts), requested page count and loaded records are retained in the existing account/preview-scoped session-memory store. Returning from editing refreshes the same number of pages through Expo Router's focus lifecycle. In-flight requests are cancelled on blur, filter/account changes and unmount; late responses cannot replace current state. Session changes/sign-out clear the store. No personal list data is persisted to localStorage/disk. Scroll offset is not separately persisted across a complete route remount.

Loading/retry, invalid dates, empty matches, end-of-list, clear/reset and busy pagination states are implemented. Refresh failures retain previously loaded records with an explicit stale-data notice; authentication/authorization failures clear cached records. No mock records or fake success responses are used.

## Verification and remaining boundary

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py --ignore=backend/tests/test_outfits_database.py --ignore=backend/tests/test_outfit_editing_database.py --ignore=backend/tests/test_outfit_filtering_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
```

From `mobile`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run export:android -- --output-dir /tmp/dd-outfit-filtering-android`.

Coverage includes first/subsequent/empty/end pages, equal timestamp/name ties, surviving a removed cursor anchor, literal search and source/category combinations, creation boundaries, malformed/owner-mismatched/filter-mismatched cursors, timezone normalization, anonymous/disabled/deleting denial, RLS, and prior outfit/create/edit/item regressions. Frontend tests cover query construction, date validation, merging, fresh cursor chains after edits, end detection, repeated cursor protection, cancellation/failure and account-scoped state preservation.

HTTP tests intercept external transport only in tests; PostgreSQL tests run migrations solely in a fresh disposable Unix-socket cluster using minimal Auth/Storage primitives. They do not certify hosted PostgREST/JWT/RLS/Storage or native visual behavior. Existing Starlette/Node warnings remain; no dependencies changed. Hosted application of additive migrations, real integration acceptance and physical-device testing remain pending. `DATABASE_FOUNDATION_ENABLED=false` must remain until that separately approved acceptance work passes.

Final local results: **304 backend API/security tests passed**, **234 disposable PostgreSQL tests passed**, **42 frontend tests passed**. Python compilation, frontend typecheck/lint and Android JavaScript export passed. No failures/skips in these selected runs. Export output: `/tmp/dd-outfit-filtering-android`; this is bundle verification, not signed release or physical-device acceptance. The new screen leaves the shared collection component and existing create/edit/item operation files unchanged.
