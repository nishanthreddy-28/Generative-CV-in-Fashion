# Wardrobe CRUD — local implementation

The five existing wardrobe contracts are implemented on main using the current-user JWT, existing FastAPI eligibility dependency, private Supabase RPC operations and additive migration `202611080002_wardrobe.sql`. No hosted migration or configuration change has been performed; `DATABASE_FOUNDATION_ENABLED` remains false. The existing uncommitted Body Profile API work is preserved.

## HTTP behavior

- `GET /wardrobe`: returns `{items: Garment[], nextCursor: string|null}`. Accepts search (name/brand, case insensitive, literal substring, max200), category (empty/all or Tops/Bottoms/Outerwear/Dresses/Shoes/Accessories), sort newest/name, limit1–100 (default24), and optional opaque cursor. Stable keyset ordering uses timestamp+UUID descending or name with C collation+UUID ascending. Cursor is bound to the initiating subject and filters; it is a position hint, not an authorization credential. RLS and explicit owner predicates apply independently even if a cursor is edited. Changes during pagination can move renamed/new rows; no snapshot consistency is claimed.
- `GET /wardrobe/{garment_id}`: flat garment object, including imageUrl. Missing and other-user IDs return the same404.
- `POST /wardrobe`: existing multipart contract: metadata JSON string and required image file. Returns201 and the actual stored garment; existing editor ignores this body and navigates to wardrobe.
- `PATCH /wardrobe/{garment_id}`: multipart metadata plus optional replacement image. A partial JSON metadata object is also accepted. Omitted keys and absent replacement image preserve existing values. Optional text is cleared by empty string. Null, arbitrary IDs/ownership/timestamps/image URLs and unknown fields are rejected. Returns204; existing editor navigates back after success.
- `DELETE /wardrobe/{garment_id}`: atomically deletes the owner-scoped garment and retires its image association; returns204. Missing/other-user IDs return404. No catalog/outfit/job relationships exist or are added here; future migrations must decide their reference/delete semantics.
- Supporting `GET /wardrobe/{garment_id}/image`: authenticated image delivery through FastAPI. Returns JPEG with `Cache-Control: private, no-store` and nosniff. No public bucket or signed capability URL is issued. Every new request checks eligibility and garment ownership; already downloaded bytes/in-flight responses cannot be recalled.

All business requests use the existing per-request current-user JWT adapter. Normal callers cannot choose a target owner or become an administrator. API errors have safe detail:401 authentication,403 denied account/Storage access,404 inaccessible/missing record,413 actual upload/dimension limit,415 unsupported/undecodable media,422 input/query/cursor validation,503 unavailable/malformed dependencies. Existing API contracts are not rewritten. Missing upstream RPC deployment is a dependency failure, not an empty collection or a fabricated success.

## Images and database integrity

Garment creation accepts JPEG/PNG/WebP source bytes up to10MiB; request bytes are bounded independently of Content-Length. The server decodes actual bytes, rejects animation and dimensions beyond8192px/16million pixels, corrects EXIF orientation, strips metadata by encoding to JPEG and bounds the stored image to2048px. Client MIME, filename and submitted URLs are not trusted storage identity. Pillow and python-multipart are pinned in backend requirements.

The wardrobe-specific `wardrobe_images` table records owner, immutable UUID-derived canonical object name, checksum, byte size and pending/attached/cleanup_pending/removed state. `wardrobe_garments` stores required nonblank name/category, optional color/brand/size/material/notes, timestamps and a required unique current image association. A composite image/owner FK prevents cross-user references. Category/length/size/checksum/state checks and owner+newest/name indexes are included. Optional strings normalize to NULL internally and empty strings in editor reads. No permanent personal-photo gallery or shared asset/catalog model is introduced.

The migration declares a private `wardrobe-images` bucket with JPEG-only/10MiB limits. If an existing bucket conflicts, the migration fails for review rather than changing it. Bucket/policy SQL is only authored and exercised against the disposable test interface, not deployed remotely.

User-scoped upload sequence: reserve pending immutable metadata, upload with the user's JWT and no overwrite, then attach/create/update in a database transaction. Attachment verifies owner, pending state, object existence and storage MIME/size metadata. Ordinary callers cannot update/delete base tables, change owner columns, assume executor roles or overwrite attached object bytes. Private nonowner/non-BYPASSRLS helpers retain auth.uid(); exposed RPCs are invoker functions. Direct RPC metadata is revalidated independently of FastAPI. Raw Data API callers are not trusted image decoders: the authenticated image endpoint verifies checksum/size and decodes bytes again before delivering them. No caller-controlled image is delivered as executable/arbitrary content.

Both wardrobe tables enable and force RLS. Ownership and active lifecycle checks are combined with least-privilege schema/table/column/function grants. Restrictive Storage boundaries scope all ordinary reads/inserts/deletes to the current owner's permitted image state and prohibit overwrites even if another permissive policy exists. Pending insertion uses an image-row share lock so attach/retire transitions serialize against upload authorization. Database mutations lock lifecycle and garment/image rows to preserve partial updates and reject inactive accounts; no service key or elevated retry exists.

Storage bytes and PostgreSQL cannot share one transaction. Replacement/deletion marks the prior image cleanup_pending atomically with the garment change, then attempts actual Storage deletion and records removed only after object absence. Uncertain cleanup leaves a durable retry record rather than rolling back an already committed garment or claiming bytes were deleted. Subsequent successful mutations retry a bounded queue of up to10 owned images. If authorization/network failure persists, cleanup remains pending and requires approved reconciliation. Cancellation/crash between reservation/upload/attachment can leave pending images; no arbitrary retention duration or background sweeper is invented. Inactive/deleted-account orphan reconciliation and full account purge remain separate existing blockers. These limitations must be resolved before hosted security/production acceptance.

## Frontend integration

Existing wardrobe collection/create/detail editor routes already target the implemented endpoints, with initial loading, error/manual retry, genuine empty collection, validation, busy mutation, success/navigation, retained drafts on error and confirmed deletion. There is no mock wardrobe source to remove. UI/navigation remains intact.

Private image responses require authentication; plain browser img requests cannot attach the business Bearer header. `WardrobeImage` therefore uses the same current-session request helper to fetch bounded JPEG bytes, then displays an in-memory data URI on native/web. Collection and existing editor use it only for wardrobe images; catalog/other feature behavior is unchanged. Preview skips the image request, just as it skips garment data. No access JWT is embedded in an image URL or persisted in an image record.

## Verification and remaining acceptance

Run backend/API/security tests and compile from root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests
backend/.venv/bin/python -m compileall -q backend/app
backend/.venv/bin/python backend/tests/database/run_local.py
```

The ordinary pytest run skips SQL suites without a disposable socket; the dedicated runner applies the ordered migration chain only in a fresh local cluster, executes foundation/body/wardrobe suites, then stops/removes it. Test Storage tables are minimal interfaces for real PostgreSQL grant/RLS/constraint checks, not a running Supabase Storage server. API tests intercept only external HTTP and use generated fixture images, not mock business data in the application.

Frontend checks from mobile: `npm test`, `npm run typecheck`, `npm run lint`. Tests cover metadata/category/clearing, actual collection/query/response shapes, partial multipart updates, deletion and authenticated image bytes. They do not mount native screens or prove device Blob/FileReader behavior.

Hosted deployment requires separate approval, migration/operator privilege review (including managed Storage), exact api exposure, trusted identity bootstrap and real userA/userB/inactive/directDataAPI/Storage/overwrite/cleanup acceptance. PostgreSQL15 fixtures are not managedPG17 acceptance. Physical Android image selection/display/relaunch and production network/CORS remain pending. Do not enable the feature flag based solely on local tests. No catalog, recommendation, try-on or ML implementation is included.

Local verification result:182backend/API/security tests passed;105database cases skipped in that broad run were then executed successfully by the dedicated PostgreSQL runner.24frontend tests, TypeScript typecheck, lint, Python compilation, dependency consistency and diff whitespace checks passed. Initial migration syntax/test-fixture failures were corrected and rerun; no failing case was turned into a skip. Existing Node module-type and Starlette TestClient deprecation warnings remain.

Implementation references: [FastAPI uploads](https://fastapi.tiangolo.com/tutorial/request-files/), [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Storage deletion](https://supabase.com/docs/reference/javascript/storage-from-remove), [Pillow image decoding](https://pillow.readthedocs.io/en/stable/reference/Image.html), and [Expo SDK58](https://docs.expo.dev/versions/v58.0.0/). These are implementation references, not evidence of hosted acceptance.

Android JavaScript export also passed (`--platform android`,1254modules, output in `/tmp/dd-wardrobe-android`, public environment variables omitted). This is bundle verification, not an Android native build or hosted/device acceptance.

Changed files for this wardrobe task (the pre-existing body-profile work remains separate and uncommitted):

- backend/app/wardrobe.py; backend/app/main.py
- backend/pyproject.toml; backend/requirements.lock; backend/README.md
- supabase/migrations/202611080002_wardrobe.sql
- backend/tests/test_wardrobe_api.py; backend/tests/test_wardrobe_database.py
- backend/tests/database/run_local.py; backend/tests/database/supabase_test_primitives.sql; backend/tests/test_foundation_database.py
- mobile/src/components/WardrobeImage.tsx
- mobile/src/features/CollectionScreen.tsx; mobile/src/features/EditorScreen.tsx
- mobile/src/hooks/useResource.ts; mobile/src/services/api/client.ts; mobile/tests/workflows.test.mjs
- docs/backend/wardrobe-api.md
