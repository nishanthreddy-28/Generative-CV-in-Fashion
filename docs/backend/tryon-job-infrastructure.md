# Try-on job infrastructure — local full-stack checkpoint

Implemented on existing `main`, 2026-11-09. Infrastructure only: no inference worker, ML integration, generated images, external AI request or compatibility engine. No hosted Supabase modification or remote migration. `DATABASE_FOUNDATION_ENABLED=false` remains unchanged. The job workflow is implemented in local source and tests; authenticated hosted/native acceptance remains pending.

## API and state contract

All operations require verified Supabase authentication, active account eligibility and owner scope. FastAPI forwards the caller's current JWT to Supabase Data API and Storage. No service-role key, privileged retry or client-selected ownership.

- `POST /try-on/jobs`: multipart `person` image, `garmentId` UUID, `source=wardrobe|catalog`, `photoConsent=true` (exact string). Exactly one file and these three fields; duplicates/extras are rejected. Returns 202 with a persisted queued job. It validates garment access before upload and again atomically while accepting the job. Input photos use real private Storage, not mock production bytes.
- `GET /try-on/jobs`: owner history `{items,nextCursor}`; limit 1–100/default 24; optional opaque owner-bound cursor, maximum 4,000 characters. Stable `(created_at DESC,id DESC)` keyset pagination and limit+1; no status filtering or snapshot across changing data is promised.
- `GET /try-on/jobs/{job_id}`: owned job detail, 404 for missing/other-user IDs.
- `POST /try-on/jobs/{job_id}/cancel`: queued jobs only; 200 updated job. Cancellation is represented as terminal `status=failed,failureCode=CANCELLED`, retaining the existing four-state vocabulary. Repeating cancellation is safe. Processing/completed/other failed jobs return 409; no forced cancellation of an in-flight worker is invented.
- Supporting `GET /try-on/jobs/{job_id}/input`: authenticated private input JPEG, `Cache-Control: private, no-store` and `nosniff`. Verifies ownership, current attached association, size/hash and safe decoding. Unavailable/retired input returns 404. API responses never disclose bucket object paths, hashes, stack traces or public personal-image URLs.

Job response fields: id, status, garmentId, source, createdAt, updatedAt, finishedAt, consentVersion, consentAt, failureCode, safe error text, workerAvailable=false, workerMessage, canCancel, inputAvailable and protected inputUrl. No generated result URL or image is fabricated.

The schema recognizes queued, processing, completed and failed. Initial inserts must be queued with a valid attached input and live garment association. Legal status changes are queued→processing/failed and processing→completed/failed; terminal jobs cannot reopen. Ordinary executor operations may only change queued→failed with CANCELLED. There is **no exposed worker claim/processing/completion/failure endpoint or worker credential/role integration**. Completed state requires a distinct registered attached output-purpose asset and terminal timestamps; no API can register such output assets in this milestone. A future trusted worker/output validation protocol requires separate implementation/review. Database transition tests use privileged disposable fixtures to simulate processing, not actual inference or production completion.

With this code alone, accepted jobs remain queued indefinitely until the owner cancels. No automatic worker-unavailable failure, polling promise, scheduled expiry or successful inference is claimed. Retry means resubmitting a photo/garment as a new job after a failure/cancellation; no implicit duplicate retry or job resurrection. No idempotency key is implemented, so an uncertain network timeout can require history inspection before resubmitting.

Errors: 401 unauthenticated, 403 denied eligibility, 404 inaccessible/missing job/garment/input, 409 noncancellable state, 413 request/image limit, 415 unsupported/undecodable image or media, 422 invalid fields/consent/IDs/query/cursor, 503 unavailable/malformed dependency. Sensitive upstream details remain suppressed.

## Database, private images and cleanup

Additive migration `supabase/migrations/202611090002_tryon_jobs.sql` preserves earlier migrations/data and adds:

- `app_private.tryon_images`: owner/Auth identity, immutable generated object locator, size/hash, purpose, pending/attached/cleanup_pending/removed state and creation evidence. One private `tryon-inputs` bucket, JPEG only, 10 MiB maximum; migration refuses an incompatible existing bucket.
- `app_private.tryon_jobs`: Auth owner, four-state status, original garment source/UUID plus live wardrobe/catalog FKs, required unique owner-consistent input FK, optional owner-consistent output FK, consent version/time, creation/update/finish timestamps and bounded safe failure codes. No person measurements, face embeddings or model outputs are generated.
- Owner/recent and queue indexes, source FK indexes and input cleanup index. Both tables ENABLE/FORCE RLS; normal authenticated, anonymous and service roles have no base table DML. Existing non-owner/non-login/non-bypass execution role receives reviewed operations/column grants; ownership/source/input/consent fields cannot be updated by normal callers. Invoker API wrappers call fixed-search-path private functions; no service-role fallback.
- Consent `photo-consent-v1` is required at job submission, not inferred from a login/profile field. The job persists consent and image association independently of later byte cleanup. Cancelling retires the image, while image metadata and job submission evidence remain. Any future expiry must similarly distinguish a valid prior submission from an unavailable current object.
- Garment validation locks a private owned wardrobe row or active shared catalog row. The wardrobe FK is owner-consistent; cross-user targets fail. Live source FKs SET NULL on trusted/source deletion while original source/UUID evidence remains, so history does not block ordinary garment deletion or silently rewrite the selected original garment. Catalog deactivation does not grant private ownership or erase history.
- Status/terminal consistency constraints and a transition trigger prohibit invalid initial/terminal transitions and ordinary-client worker transitions. Active lifecycle locks serialize submission/cancellation against account state changes; job locks serialize cancellation.

The HTTP layer bounds actual received multipart bytes (10 MiB plus small form overhead), reuses the existing JPEG/PNG/WebP safe decoder, rejects animation/oversized dimensions, strips metadata and normalizes to JPEG. It reserves immutable owner-scoped image metadata, uploads bytes using the current JWT with overwrite disabled, then atomically attaches and creates the job only after Storage metadata is present. Remote Storage is external to the database transaction: a failed upload/acceptance uses pending→cleanup_pending compensation, not a claim of distributed atomicity.

Restrictive owner/active Storage policies prevent other users, broad permissive policies or overwrite operations from exposing/replacing inputs. Attached inputs cannot be deleted directly. Cleanup allows only retired objects; uncertain deletion remains durably retryable. Cancellation triggers best-effort deletion and subsequent metadata confirmation using the owner JWT. A logged cleanup warning does not invent successful byte deletion. Direct Storage cleanup_pending reads remain owner-only to support deletion semantics; API photo retrieval denies retired inputs.

**Retention boundary:** no age-based cleanup scheduler, pending-upload reconciliation worker, per-account upload quota or approved personal-photo retention period is implemented. Queued photos remain stored until cancellation/authorized future cleanup. Failed external cleanup can leave retryable retired objects; normal job mutations attempt cleanup. Cancelling after the job has already retired should be retried for cleanup if a dependency was unavailable. Auth deletion requires dependency-safe handling/deferred input FK and separately verified Storage cleanup; account deletion is not complete. These retention/quota/reconciliation decisions must be resolved before real deployment with personal images, and the disabled flag remains necessary.

## Frontend

The existing `/try-on` route/navigation is preserved. Submission now uses `/try-on/jobs`; refresh/cancel/history use the real new routes. Existing selected garment/photo, consent controls, loading/empty/error states remain. Catalog selection continues through existing catalog-detail navigation; the wardrobe picker stays paginated.

The UI explicitly says no inference worker is configured and no image will be generated. It shows queued/processing/failed/cancelled status, manual refresh, owner history with next/first page controls, valid queued cancellation and an opt-in private input-photo viewer. Private photos are fetched as authenticated bytes through the current-token request helper, never passed as public URLs. No fake completed image or automatic retry/polling loop.

After accepted submission, the local selected personal photo and consent are cleared. Consent must be confirmed again for a new photo/submission. Account changes suppress another account's selected result; resource hooks isolate history/images by identity. A synchronous mutation gate prevents duplicate submit/cancel clicks; server ownership/state checks remain authoritative. The earlier unimplemented `/try-on` and `/try-on/{id}` API requests are replaced explicitly in this screen; no legacy aliases or silent fake responses are added. The original 35-contract audit remains historical evidence, not a claim those old endpoints were deployed.

## Automated verification

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py --ignore=backend/tests/test_outfits_database.py --ignore=backend/tests/test_outfit_editing_database.py --ignore=backend/tests/test_outfit_filtering_database.py --ignore=backend/tests/test_recommendations_database.py --ignore=backend/tests/test_saved_recommendations_database.py --ignore=backend/tests/test_tryon_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
npm --prefix mobile test
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile run export:android -- --output-dir /tmp/dd-tryon-android
```

Results: **380 backend API/security tests passed**, **296 disposable PostgreSQL tests passed**, **56 frontend tests passed**. Python compilation, typecheck, lint and Android JavaScript export passed. Existing Starlette/Node/export environment warnings remain; no dependencies changed. Database tests exercise real PostgreSQL against minimal disposable Auth/Storage primitives; HTTP tests intercept only external transport in tests. No production mock data or fake worker was introduced.

Coverage includes valid wardrobe/catalog submission, consent and missing/invalid/cross-user references, input association/upload completeness, private byte integrity/decoding, duplicate/oversized multipart, history/cursor validation, queued cancellation/idempotency/cleanup evidence, transition/completion denial, RLS/grants/Storage boundaries, eligibility and prior workflow regressions. Frontend tests exercise submission fields/consent, current JWT multipart transport, status/history/cancel responses and errors, without claiming mounted native-device testing.

## Actual local runtime verification

Started the documented backend with `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8019` from backend, and Expo with `CI=1 EXPO_OFFLINE=1 npm run web -- --host localhost --port 8099` from mobile. Configuration files and foundation flag were not changed.

Initial sandbox attempts could not bind the backend loopback port/allocate PostgreSQL shared memory; Expo also reported an unavailable port in the restricted attempt. Reran only the authorized local processes outside that restriction. Backend logged application startup complete and listened on 8019; Expo Metro listened on 8099 and bundled web successfully. The browser initially saw connection refused before startup completed; reloading after server startup loaded the app.

Verified actual running-server HTTP responses: `/openapi.json` 200 with all four requested route paths plus protected input route; unauthenticated POST/history/detail/cancel each returned the safe 401 response. Expo try-on HTML returned 200. Backend access logs contained these expected responses and no application traceback.

In Chrome, visibly loaded `/try-on?preview=1`: worker-unavailable notice, photo/garment controls, explicit consent, submit control and empty job-history state. Clicked submission with missing inputs and observed the correct photo/garment/consent validation message. Loaded `/try-on` without preview and verified the sign-in gate. Captured browser warn/error logs contained warnings from an installed browser extension, not application-origin runtime errors. Expo logs showed web bundling/React development-tool information, without an application runtime error during these checks.

**Not exercised live:** authenticated upload/accepted job/history/cancel against deployed Supabase, real hosted Storage authorization and physical Android photo picker/back navigation. With the required database flag false, no approved migrated integration project or authenticated disposable Supabase session was enabled for this run. Authenticated positive behavior is covered separately by HTTP transport tests and real local SQL/RLS tests; it is not claimed as a completed browser-to-hosted end-to-end acceptance. No sign-in credentials, personal photos, mocked browser sessions or feature-flag bypass were used to manufacture that result. Cross-origin web API configuration remains part of the separately reviewed integration setup; native requests are not browser-CORS flows.

After inspection, task-started FastAPI/Expo listeners were stopped; no unnecessary task servers are intentionally left running. The Android artifact is a JavaScript export, not a signed release or device test. Remaining blockers: separately approved hosted migration/exposure/grants/Storage acceptance, a real authorized test session, photo-retention/quota/reconciliation policy, worker/output authorization protocol if inference is later requested, and physical-device acceptance. Do not enable the foundation flag or claim successful inference on this checkpoint.
