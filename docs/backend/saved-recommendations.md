# Saved recommendations — local checkpoint

Implemented on existing `main`, 2026-11-09. No hosted Supabase changes, remote migrations, feature-flag enablement, ML or try-on work. This milestone saves **bookmarks of generated recommendations**, not copies of garments or conversions into saved outfits. The earlier [generation checkpoint](recommendation-generation.md) remains historical; its deferred recommendation-bookmark limitation is superseded here.

## Endpoints

All operations require a verified authenticated subject and an active account. Every ordinary database request uses the current user's JWT. Existing RLS independently checks ownership/eligibility; catalog administration never grants access to another user's history or bookmarks. No service-role client or fallback is introduced.

- `POST /recommendations/{recommendation_id}/save`: no body required (empty object allowed); client ownership/item/metadata fields are rejected. Creates a bookmark with server identity/time, returning **201**. Repeating a valid save returns **200** with the same saved ID/time, avoiding duplicate records. Both paths revalidate source availability. Saving a missing/other-user/deleted generated result returns 404; a deleted/inactive/inaccessible source returns 409. Concurrent save/remove changing the entry can also return 409 with a refresh/retry message.
- `GET /recommendations/saved?limit=24&cursor=...`: owner-only `{items,nextCursor}`; limit 1–100; opaque cursor maximum 4,000 characters. Orders by `(saved_at DESC,id DESC)` and uses a strict keyset boundary with limit+1. Cursor binds the owner and ordering position. Equal-time ties, deleted cursor anchors and unavailable entries preserve pagination behavior. This is a live list, not a frozen cross-request snapshot. New saves appear on a first-page refresh.
- `DELETE /recommendations/saved/{saved_id}`: deletes only the owned bookmark, returning 204; missing/other-user IDs return 404. Unavailable entries remain removable. Generated request/result history, source garments, images and outfits are not deleted or modified. Removing permits a later valid re-save as a fresh bookmark.

Saved entry representation:

```text
{id, recommendationId, savedAt, available, recommendation}
```

When available, `recommendation` contains the existing typed generated result, provenance, rule score/reasons and source references. When any source is unavailable, `available=false` and `recommendation=null`: the stable bookmark/provenance IDs and timestamp remain so the owner can remove the entry, without exposing inaccessible garment details or presenting them as actionable recommendations. Source visibility is recomputed on every list/save response. No stale image URLs or garment copies are added.

Generated recommendation responses additionally expose authoritative `savedId` (UUID or null), derived from the current owner's bookmarks. This avoids incomplete client saved-state detection from a single bookmark page. It is an explicit additive response field; original generation/ranking/history content remains intact. These three routes are explicit additions requested for this milestone; the original 35-contract audit is not rewritten. The unsupported POST /outfits recommendationId conversion remains unimplemented.

Common errors: 401 invalid authentication, 403 denied eligibility, 404 inaccessible/missing provenance/bookmark, 409 unavailable source/concurrent save change, 422 invalid payload/UUID/cursor/limit, 503 unavailable or malformed security dependency. The shared RPC adapter adds optional scoped DD001-to-409 translation; existing callers' behavior is unchanged. No sensitive upstream bodies or elevated retries are exposed.

## Additive database migration

`supabase/migrations/202611090001_saved_recommendations.sql`:

- Adds `(id,owner_id)` uniqueness to generated results for an owner-consistent provenance FK. Existing generated rows/content are preserved.
- Adds `app_private.saved_recommendations`: UUID, Auth owner FK, generated-result/owner composite FK, server timestamp, unique `(owner_id,recommendation_id)` and owner/newest index. No garment metadata, item arrays, reasons or image references are duplicated; those remain in the linked generated result.
- Enables/forces RLS; revokes base privileges from authenticated, anonymous and service roles. The existing non-owner/non-login/non-bypass executor receives SELECT/INSERT/DELETE only; owner/active policies scope operations. No bookmark UPDATE privilege or arbitrary history-edit API.
- Fixed-search-path private functions implement save/list/remove with invoker API wrappers. Private projection is not callable by ordinary users. Source/pre-existing history helpers retain their reviewed privileges.
- Save locks active eligibility and the owned generated result, validates/locks source records in deterministic source/UUID order, then inserts atomically with ON CONFLICT DO NOTHING. A subsequent scoped read returns the existing bookmark for duplicate saves; the unique constraint is authoritative. Generated-history row locking needs narrow UPDATE(id) privilege for the executor, paired with a restrictive UPDATE policy whose WITH CHECK(false) prevents actual history mutation. Tests verify immutable history and concurrent duplicate behavior.
- A trusted deletion of generated history cascades its bookmarks; no dangling provenance is retained. Auth deletion likewise cascades these dependent records. There is currently no normal history-delete API or automatic expiry. Saved recommendations are linked bookmarks, **not** independently retained saved outfits. Any future generated-history retention/purge policy must explicitly account for saved bookmarks before deployment; this milestone does not introduce a purge or claim full account deletion complete.

There are no live garment FKs on bookmarks: the existing generated history already owns descriptive source snapshots, and every response revalidates current source access. Thus normal wardrobe deletion is not blocked by a bookmark. Catalog deactivation keeps history/bookmark records, but makes the saved entry unavailable until the source becomes eligible again. No new catalog/reactivation feature is implemented.

## Frontend

The generation/recent screen now offers **Save recommendation**, **Saved** status and a link to `/recommendations/saved`. The server's savedId projection synchronizes state; successful saves update account-scoped memory immediately, and focus/history refresh reconciles it after removal or another session changes saved state. The synchronous mutation gate prevents duplicate clicks before React applies disabled state; server uniqueness handles network/client races independently.

The checkout had no saved-recommendations route; this task adds its screen and route. It lists available results with source-correct links and reasons, unavailable-entry notices, remove controls, cursor next/first-page navigation, refresh/retry, loading/empty/error/success states. Removal updates saved state and reloads the page. Duplicate mutation clicks are guarded. Private state uses existing account-scoped session-memory storage and clears on account change/sign-out. No mock recommendations or fake successful saves are introduced.

This does not create an outfit automatically, prefill the outfit builder, implement recommendationId conversion or add unrelated workflows.

## Verification

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py --ignore=backend/tests/test_outfits_database.py --ignore=backend/tests/test_outfit_editing_database.py --ignore=backend/tests/test_outfit_filtering_database.py --ignore=backend/tests/test_recommendations_database.py --ignore=backend/tests/test_saved_recommendations_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
npm --prefix mobile test
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile run export:android -- --output-dir /tmp/dd-saved-recommendations-android
```

Local results: **356 backend API/security tests passed**, **280 disposable PostgreSQL tests passed**, **52 frontend tests passed**. Python compilation, frontend typecheck/lint and Android JavaScript export passed. Existing Starlette/Node/export environment warnings remain; dependencies unchanged. Typecheck initially rejected a runtime .ts import used by the Node test path; removed that cross-module runtime import rather than changing configuration/dependencies. Initial root-level npm invocations found no package.json; the mobile-prefixed commands passed. The sandboxed PostgreSQL attempt could not allocate shared memory; the authorized disposable runner passed.

The database run revealed an existing flaky outfit fixture: it selected the newest wardrobe UUID but expected that garment to be a top, so tied timestamps/random UUIDs could select bottoms and change filter expectations. The test-only helper now selects explicit Tops/Bottoms categories; production outfit operations are unchanged. The full suite then passed.

Coverage: save/read/remove, idempotency and two-connection duplicate race, generated history preservation, missing/deleted provenance, source deletion/deactivation and removable unavailable entries, owner/admin isolation, invalid inputs/cursors, tied-time pagination/deleted anchor, RLS/grants/FK/uniqueness and immutable history, frontend authenticated transport/provenance, saved state, duplicate clicks, retry/failure and unavailable entries. Prior feature regressions remain in these runs.

HTTP interception and fixture records exist only in tests. PostgreSQL is real and disposable with minimal local Auth/Storage primitives; this is not hosted PostgREST/JWT/Storage acceptance. Native visual/physical-device behavior and signed release remain unverified. Hosted migration/integration approval, bookmark-aware retention decisions and earlier account-deletion/Storage acceptance remain pending. Keep `DATABASE_FOUNDATION_ENABLED=false` until separately approved hosted checks pass.

A final frontend regression verifies that removal explicitly overrides a stale savedId on a previously generated card; fresh server projections can reconcile subsequent saves.
