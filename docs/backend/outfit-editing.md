# Outfit editing and item management — local checkpoint

Implemented on existing `main`, 2026-11-08. No hosted Supabase changes or remote migrations. `DATABASE_FOUNDATION_ENABLED` remains false. The previous [creation foundation](outfit-creation-foundation.md) describes the earlier milestone; the editing and mixed-source frontend limitations below supersede its deferred-work list. Existing 35-contract audit is retained as historical evidence; the new item routes are explicit extensions requested for this milestone.

## HTTP contracts

All operations require valid authentication, an active account and ownership of the outfit. An administrator receives no access to other users' outfits. Normal database and Storage requests retain the current user's JWT; no privileged fallback or client-selected ownership is introduced.

- `PATCH /outfits/{outfit_id}`: JSON subset of `name`, `description`, `occasion`; 204. Absent fields and all items are preserved. Empty optional text clears it; explicit null, extra fields, blank name and invalid lengths are rejected. Empty object is an allowed no-op metadata update.
- `PUT /outfits/{outfit_id}/items`: `{items:[{source:"wardrobe"|"catalog",garmentId:UUID},...]}`; 200 updated complete outfit. Replaces the ordered set atomically.
- `POST /outfits/{outfit_id}/items`: one `{source,garmentId}` object; 201 updated complete outfit. Appends the item. Duplicate membership is rejected.
- `DELETE /outfits/{outfit_id}/items/{item_id}`: no body; 200 updated complete outfit. `item_id` is a stable outfit-item UUID returned by reads/mutations, **not** a garment UUID or array position. Missing or other-outfit item IDs return 404.

Create/list/detail responses now include `items[].id` in addition to `source` and `garmentId`. Input references exclude membership IDs: those remain server-generated. Unchanged memberships retain their IDs through replacement/reordering and other add/remove operations. Removing and later re-adding a garment creates a new membership. Legacy `garmentIds` remains the ordered wardrobe-only projection; shared catalog IDs are never disguised as wardrobe IDs.

All accepted final compositions require 2–100 distinct source/garment pairs, preserving the manual-create minimum. UI drafts may temporarily be empty or contain one item, but cannot be saved. Metadata edits do not revalidate or change existing items. Existing deactivated catalog references may be retained or removed during item edits; a newly selected catalog item must be active. Removing a catalog reference and later adding it again requires current availability. No garments or images are copied/deleted by item management.

Errors: 401 missing/invalid authentication; 403 denied account eligibility; 404 missing/inaccessible outfit/item/source; 422 invalid metadata, UUIDs, sources, duplicates or final item count; 503 unavailable/malformed dependency. Upstream bodies are suppressed. Reference/ownership failures never trigger elevated retries. No optimistic revision check or idempotency key is introduced: replacement uses the last successful serialized selection; duplicate add retries are rejected.

## Additive database migration

`supabase/migrations/202611080005_outfit_editing.sql`:

- Adds generated-default, non-null, globally unique UUID membership identity to existing item rows without changing their original outfit/position primary key, references or source constraints.
- Adds `saved_outfits.updated_at`; grants the existing non-owner/non-login/non-bypass execution role column-specific metadata/timestamp UPDATE and item DELETE only. Ownership and source fields remain immutable through direct column updates.
- Adds owner/active UPDATE and DELETE policies. Both existing tables remain ENABLE/FORCE RLS. Normal authenticated, anonymous and service API roles still have no base-table mutation privileges.
- Uses fixed-search-path private transactional helpers with invoker API wrappers. Private validation helper remains unavailable to ordinary callers. Existing reviewed helpers/roles perform source authorization and locking; no service-role credentials or new admin authority.
- Each mutation obtains the active lifecycle lock and outfit row lock, serializing metadata/add/remove/replacement on that outfit. Source validation and deterministic source locks precede association changes; failures roll back the entire operation. Replacement preserves retained membership UUIDs, compacts positions and updates the timestamp, in a single RPC transaction. Item order is explicitly retained through JSON aggregation and insertion.

Existing create/read RPCs continue working; shared record projection is extended with membership IDs. Earlier migrations and data are preserved. The previously documented trusted account-deletion ordering and hosted security acceptance requirements still apply.

## Frontend

The existing create and detail/edit routes share `OutfitItemSelector`. Both can select wardrobe and catalog garments, switch paginated source collections without losing selection, remove selected pieces, and navigate to source-correct details. Selections use the source/garment pair, so equal UUID values in different tables do not collide. No mock garments or fabricated successful responses are supplied.

Creation sends typed references. Metadata editing uses PATCH separately from item changes, preserving pending selection edits. The detail screen stages add/remove selections locally and **Save outfit pieces** sends one atomic PUT; individual POST/DELETE routes are available and tested for API consumers. Successful saves reload the owned aggregate. Errors preserve the draft; loading/retry, validation, empty source/selection notices, disabled/busy controls, success messages and explicit discard for item drafts are included. Session-memory draft storage still clears on account changes/sign-out.

The earlier **Delete outfit** control called an unimplemented whole-outfit DELETE route. It is removed from this screen rather than claiming that workflow works; whole-outfit deletion was not requested here. Filtering/name-sort controls on outfit collections remain unchanged and unsupported by this scoped milestone. No recommendations, try-on or ML behavior is added.

## Verification

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py --ignore=backend/tests/test_outfits_database.py --ignore=backend/tests/test_outfit_editing_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
```

From `mobile`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run export:android -- --output-dir /tmp/dd-outfit-editing-android`.

Local API/security suite: **291 passed**. Disposable real PostgreSQL suite: **207 passed**, including prior foundation/body/wardrobe/catalog/outfit regressions, metadata-only preservation, stable IDs, replacement rollback, cross-user access/references, invalid inputs, minimum count, inactive catalog retention, RLS/direct grants and a two-connection concurrent-add test proving no lost items. Frontend suite: **35 passed**, covering typed selection, source-correct navigation, payload separation, atomic PUT, add/remove transport and failed-save draft preservation. Compilation, typecheck and lint passed. Android export result is recorded after completion below. Existing Starlette/Node warnings remain; dependencies are unchanged.

Tests use intercepted external HTTP transport only in tests and a fresh local PostgreSQL cluster with minimal Auth/Storage test interfaces. The first sandboxed cluster attempt failed on shared-memory permissions; the authorized disposable runner passed outside that restriction. These tests do not certify hosted PostgREST, JWT gateway, deployed RLS, live Storage or mounted physical-device interaction. Hosted integration, migration application, native manual acceptance and full account deletion remain pending; do not enable the foundation flag on this evidence alone.

Android JavaScript export passed to `/tmp/dd-outfit-editing-android`; this is bundle verification, not a signed Android release or physical-device acceptance.
