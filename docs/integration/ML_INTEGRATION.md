# Application integration checkpoint — 24 November 2026

## Current architecture

Expo/React Native → existing FastAPI → user-scoped Supabase PostgreSQL/Storage.
The API calls a separate authenticated CPU Python service for MediaPipe, garment
analysis, CIR/Gemma recommendations and hosted try-on orchestration.

Processing is **active-session only**, per the user's decision. No Supabase
server secret, autonomous job consumer or detached durable execution is enabled.
Existing rules-v1 recommendations and old queued try-on records remain compatible.

## Implemented source paths

- `backend/app/ml.py`: owned photo retrieval, MediaPipe result validation,
  signed original observations, explicit confirmation and readback.
- `backend/app/pose_receipts.py`: original result signatures bound to user,
  photo hash and height calibration; confirmation receipts expire after 15 minutes.
- `backend/app/ml_contracts.py`, `ml_public.py`: worker/public JSON contracts.
- `backend/app/ml_wardrobe.py`: owned garment classification and cutout inference.
- `backend/app/ml_sessions.py`: Gemma/CIR session conversations, history,
  bookmarks and feedback; current preferences/manual and reviewed body context.
- `backend/app/ml_tryon.py`: explicit-consent single-garment session previews,
  source-photo recheck, private output hash validation and authenticated JPEG delivery.
- `mobile/src/app/body-analysis.tsx`: original/edit/reset/confirm/reload.
- `mobile/src/features/GarmentAnalysisPanel.tsx`: cutout and category/colour review;
  changes apply to the editor draft and require the existing save action.
- `mobile/src/app/stylist.tsx`: conversations, outfits, history, bookmarks,
  feedback and existing manual outfit creation.
- `mobile/src/features/SessionTryOnPanel.tsx`: person photo, single garment,
  explicit provider/photo consent, cancellation and protected completed previews.
- ML `integration_worker/`: private inference service, bounded CPU concurrency,
  reusable classifier/stylist/parser and existing model preprocessing.
- Root `start-integration.ps1`: launches existing API, private CPU worker and Expo
  using Node 24; private process state/logs live in ignored `.integration/`.

## Contracts

The actual FastAPI OpenAPI JSON is exported to `integration/api-contracts.json`
at the parent project root. It describes the exact request/response schemas.

- POST /ml/body-analysis — imageId UUID and referenceHeightCm 80–250.
- POST /ml/body-analysis/confirm — imageId, signed receipt, four reviewed
  observations, confirmed=true.
- GET /ml/body-analysis/{imageId} — confirmed observations or null.
- POST /ml/garments/{wardrobe|catalog}/{garmentId}/analysis — category/attributes,
  colours, confidence, warnings and transparent cutout; original image preserved.
- POST /ml/stylist — message, optional count 1–5, wardrobeOnly and conversationId.
- GET /ml/history — bounded recent or bookmarked session results.
- PATCH /ml/history/{id} — bookmark/like/dislike changes.
- POST /ml/session-tryon?provider=weshop|idm — multipart person, garmentId,
  source and photoConsent=true.
- GET /ml/history/{id}/image — owner-authorized JPEG result.
- GET /ml/capabilities — authenticated configuration/storage readiness.

The original application endpoints are preserved. ML scores are exposed as
uncalibrated rankingScore, never converted into rules-v1 percentage scores.

## Database rollout — deferred by user

These candidate migrations have passed disposable PostgreSQL tests:

1. `supabase/migrations/202611240001_pose_analysis.sql`
2. `supabase/migrations/202611240002_ml_session_history.sql`

They add forced-RLS pose and signed session-result storage, user-scoped RPCs,
height/unit invalidation, private generated-image storage and deletion coverage.
Auth deletion cascades associated database records; existing deletion cleanup
includes the new image bucket.

**Neither migration has been applied to hosted Supabase.** The direct database
hostname could not resolve. The user deferred supplying SUPABASE_DB_URL with
the exact Session Pooler connection string. Do not weaken TLS, authentication
or RLS to work around this.

The application checks storage readiness before sending try-on photos or
starting save-dependent stylist requests. Body analysis can still be previewed
without confirmed-result persistence.

## Configuration

Application backend .env:
- Existing Supabase/JWT/CORS settings.
- ML_WORKER_URL, ML_WORKER_TOKEN.
- ML_RECEIPT_SIGNING_KEY: stable API-only key, separate from worker rotation.

ML backend .env:
- DRAPE_ML_WORKER_TOKEN: matches the API worker token.
- PHASE3_LLM_PROVIDER=workers.
- PHASE3_WORKERS_MODEL=@cf/google/gemma-4-26b-a4b-it.
- CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
- PHASE3_TRYON_PROVIDER=weshop.
- DRAPE_ML_WARM_MODELS=1.

No secret belongs in the mobile environment. Existing actual environment
files are ignored and were not included in Docker build contexts.

Start from the parent project:
`./start-integration.ps1`
Then open http://localhost:8081.
API health: http://127.0.0.1:8000/healthz.
Private worker: http://127.0.0.1:8090/healthz.
After code/config changes use `./start-integration.ps1 -Restart`.

## Verification

- Full backend pytest: 460 passed, 374 skipped (database tests require runner).
- Isolated PostgreSQL: 308 foundation tests + 66 registration/integration tests passed.
- ML regression suite: 162 passed.
- Live Gemma Workers AI connection check: passed after credential update.
- Real CPU MediaPipe: loaded and rejected a blank/no-person image as expected.
- Real CPU garment endpoint: HTTP 200; classification and cutout returned;
  43.68 seconds for the verified request, no external image transmission.
- Final mobile TypeScript and lint checks passed; 85 frontend tests passed; web export completed.
- Running development bundle contains the configured public API origin, Supabase origin and publishable key (verified without printing values).
- Running private worker and application ML endpoints reject unauthenticated requests with HTTP 401.
- Automated browser access was unavailable in this chat; signed-in visual acceptance was not completed.
- API/private worker/web health returned HTTP 200 after restart.

Tests with intercepted providers verify software behaviour, not aesthetic quality,
anthropometric accuracy or real hosted try-on availability.

## Known limits / pending acceptance

- Hosted schema rollout and signed-in end-to-end database acceptance remain pending.
- No live person-photo upload to WeShopAI/IDM has been performed in this integration.
- Private cutouts/attributes are returned to the editor; category/colour suggestions
  save through the existing user confirmation. Derived cutout/embedding persistence
  and cross-request garment feature reuse need additional storage/cache work.
- Recommendation pool is bounded to newest 40 wardrobe and up to 20 catalogue
  pieces, with catalogue budget filtering; accessories are excluded.
- Current fit-label differences are retained in saved context rather than silently
  rewriting the application's four fit labels.
- Session feedback applies a bounded preference adjustment; it is not model training.
- A changed top/bottom/full piece is required for a meaningful “another outfit.”
- CIR quality remains under evaluation; integration does not establish useful
  aesthetic discrimination. Do not publish ranking scores as probabilities.
- Active-session cancellation prevents publishing after disconnect checks but does
  not promise cancellation of a provider request already submitted.
- No crash recovery or durable background generation by explicit user choice.
- Shared provider availability, warmup time, memory and latency need deployment
  profiling. Requests have bounded timeouts and fail clearly when unavailable.
- Receipt key rotation invalidates old evidence; preserve the stable signing key.
- Automatic image retention remains undecided; user deletion/cleanup paths exist.
- Installed Android/native and signed-in browser acceptance are still required.


## Follow-up fixes — 24 November 2026

- Added owner-scoped, image-content/model-code-version-keyed RAM reuse for garment
  analysis, capped at 32 entries / 32 MiB with five-minute logical expiry. No new
  persistent private-image cache was added. API derives the scope from verified
  identity; it cannot be chosen by the mobile caller. Cache hits recreate unique
  request-local images so distinct garment references cannot overwrite one another.
- Cache is shared by garment and session stylist inference; image changes or a
  different user do not share results. Original inference preprocessing is retained.
- Local benchmark: both requests returned HTTP 200; first 39.163 seconds,
  identical cached repeat 0.062 seconds. This does not establish cold-photo,
  multi-user or complete recommendation latency. No external image upload occurred.
- Signup success now includes missing-email guidance. Disabled email providers
  surface a contact-support error. Duplicate-account messaging remains neutral,
  and email verification remains enabled. SMTP delivery is not fixed by UI changes.
- Verification after these edits: 165 ML regressions, 18 backend inference/security
  tests and 22 authentication tests passed; mobile TypeScript and lint passed.
  API, private worker and signup page returned HTTP 200 after restart.
- User deferred SMTP setup until after this chat and deferred the database pooler
  connection. Hosted migrations and real signup/confirmed-result acceptance remain
  pending. Required user action: configure custom SMTP in Supabase and save the
  exact Session Pooler database connection as SUPABASE_DB_URL in backend/.env.
  Do not place SMTP/server credentials in the mobile environment or chat.


## Upload, selection and stylist experience — 25 November 2026

- Add a piece now checks the selected image through authenticated POST
  /ml/garments/analyse-upload before creating a wardrobe record. Existing file
  decoding, size/dimension restrictions and the ML clothing gate apply; category
  suggestions remain probabilistic. A valid image file alone does not establish
  a usable garment photo. Uncertain cutouts fall back visibly to the original.
- The review screen shows original/clean preview, a colour-derived garment name,
  broad editable category and colours. The user explicitly confirms or edits.
  No garment record is created by analysis; duplicate confirmation is preserved.
  The existing private original-photo storage remains unchanged; the clean view
  is an inference preview, not newly persisted derived-image storage.
- Outfit choices are filtered into tops, bottoms, dresses, layers, shoes and
  accessories. New selections replace a known same-section piece; dress and
  top/bottom choices are mutually exclusive. Existing outfit records are untouched.
- Stylist preferences now pass up to four owned garment requirements to the
  recommendation pipeline. Catalogue eligibility/budgets and ownership still
  apply. Clearing UI requirements removes their previous conversation locks.
- Stylist UI uses chronological user/assistant turns, quiet prompt starters,
  outfit cards, optional response feedback/details, conversation history, a
  preferences panel and a persistent composer. AI limitations remain visible;
  optional actions do not block conversation.
- Screen's new footer/autoscroll props default off for existing screens.
- Verification: 88 frontend tests, 72 existing upload/inference backend tests,
  10 focused upload/session tests, and 165 ML tests passed. TypeScript passed.
  Final lint passed without findings and the web export completed after the unused-import cleanup. Two additional selection-lock regressions passed.
- Hosted database/SMTP rollout remains deferred. No authentication bypass or
  hosted schema change was introduced for these interface improvements.


### Session try-on preparation handoff correction — 25 November 2026

The background stage writes prepared-manifest.json with source_path and
foreground_path. The session adapter now passes that updated manifest to the
human-parser isolation stage, matching the established prototype pipeline.
A new isolated stage-order regression passed: background -> isolation -> hosted
provider, with the provider intercepted. No live try-on photo was transmitted.
The mobile path currently reads the stored original JPEG, so it executes the
BiRefNet preparation stage again (mask cache may help). Prototype alpha-cutout
reuse is available only when a valid wardrobe_cutout reference is supplied.


## Saved garment preparation and loading states — 25 November 2026

Implemented authenticated prepare-upload and explicit confirmation endpoints.
Preparation returns a reviewed transparent cutout plus a separate padded JPEG
try-on reference. Signed proof binds the user, normalized source hash, category
and preparation version. Original photo storage is preserved. The upload screen
asks for isolated-image review before saving the derived assets; failed asset
confirmation retains the created garment ID for retry without creating another.

Candidate migration 202611250001_prepared_garments.sql adds forced-RLS references,
private wardrobe-derived storage, and account-deletion manifest coverage. It
applied successfully in disposable PostgreSQL with 374 existing database tests
passing. It has NOT been applied to hosted Supabase. Readiness checks keep the
existing upload flow available until derived storage is activated.

Closet cards can serve a reviewed cutout with original fallback; try-on reuses the
saved prepared JPEG only when source hash, owner, category and preparation version
match. Changed/missing/foreign evidence is not reused. A targeted regression
verifies both CPU preparation stages are bypassed for prepared input. Old assets
from replacement/deleted garments may remain until account cleanup; per-garment
orphan reconciliation remains deployment follow-up work.

Processing cards use a gentle indeterminate motion and rotating/pulsing motif,
respect reduced motion, and run in upload, stylist and try-on screens. No fabricated
percentage or promised completion time is displayed. TypeScript, lint and 88
frontend tests passed. Eight targeted preparation/performance checks passed.
Live hosted persistence and signed-in visual acceptance remain pending.

### 2026-11-25: stale Add a piece screen

The existing browser tab displayed the former manual editor even though the current Metro entry bundle contained the photo-analysis screen. Its attempted reload/navigation left the old view unchanged; a fresh tab loaded the current application and required sign-in. The original tab and unsaved draft were preserved.

The local launcher previously set CI=1, and Metro explicitly logged that reloads were disabled. start-integration.ps1 now removes CI for local development and starts Metro with --clear, enabling file watching and rebuilding cached transforms on startup. Only the identified web process was restarted; API and ML services remained running.

Verification: PowerShell parser reported zero launcher syntax errors; API and ML /healthz returned HTTP 200; the served entry bundle contains "A new piece." and "Check photo & discover details", and does not contain the former upload instructions. Authenticated upload verification still requires the user to sign into the fresh tab. Prepared-garment persistence remains dependent on the previously documented, unapplied hosted database migration.
### 2026-11-25: garment analysis response contract corrected

A live authenticated upload returned HTTP 503 because the ML pipeline emits scored attribute objects ({value, confidence}) while the established application response schema requires literal labels. All four garment attributes failed validation. The private worker now projects each scored attribute to its value when serializing the application response; internal pipeline results and confidence scores remain unchanged for recommendation scoring. No model retraining or database changes were needed.

Added an HTTP regression test using the actual nested attribute structure in ml/backend/tests/test_integration_worker.py. Added safe failure diagnostics for the inference bridge, account eligibility, Data API transport, signing-key dependency, response schema fields, and failed route templates. Logs exclude credentials, tokens, photo contents and response payloads.

Verification: 10 worker tests, 3 garment cache tests, 10 application upload/inference tests and 28 security tests passed (51 total). Restarted private worker and API. Retried the user's selected shirt in the authenticated browser; the review visibly displays a background-removed preview, Tops category, Shirt garment type, editable details and confirmation action. Did not save or confirm the garment on the user's behalf. Colour prediction on this photo is inaccurate (grey suggested for a shirt that appears blue); user review/edit is still required. Hosted prepared-garment migration remains pending as previously documented.
### 2026-11-25: cleaner AI stylist conversation UI

Updated mobile/src/app/stylist.tsx with a compact header, conversation-history and new-chat controls, three welcome prompts, a centered fixed composer, clearer user/assistant turns, quieter processing feedback, and collapsible warning notes. Kept existing request contracts, outfit saving, feedback, bookmarks, cancellation and garment selection. Removed the numerical ranking display from conversation details; outfit explanations and fit notes remain. History now presents one entry per conversation. New chat clears the message draft and closes panels. Preferences and history open at the top rather than retaining the previous scroll offset. Availability/retry status stays visible beside the composer.

mobile/src/components/Screen.tsx gained an opt-in conversation layout and optional scroll-reset key. Existing screen defaults and authentication guards remain unchanged. No dependencies were added.

Verification: TypeScript check and lint passed; existing 88 mobile tests passed. In the signed-in web app, verified prompt prefilling, preferences opening/closing, garment group controls, history opening, new-chat reset, and the final compact welcome/composer layout. Sending a new conversation remains unavailable because the hosted conversation-storage setup is pending. Native device keyboard/layout behavior was not tested in this change.

Background-removal clarification: Add a piece runs validation/background separation/classification before wardrobe confirmation. The current save request preserves the original photo. Reviewed clean and prepared references are persisted only when preparedStorageAvailable is true and the user confirms the prepared preview; otherwise closet-image falls back to the original. The pre-save preview alone does not mean a cleaned asset has been stored.

### 2026-11-25: muted denim colours and stylist setup diagnostics

Colour extraction is separate from FashionSigLIP: pipeline.process_upload feeds the white-composited cutout to the classifier, while extract_colors samples RGBA foreground pixels for KMeans and nearest CIELAB palette naming. The original palette had saturated blue anchors but lacked faded denim prototypes; muted blues could be closer to grey. Added several muted blue/light-blue/navy prototypes mapped to existing public names. Kept foreground masking, output format and existing manual edits unchanged. Worker restarted; cache fingerprints include the modified colour source. Existing stored colour labels are not rewritten.

Added four colour regression tests for faded denim, preserved neutrals, transparent background exclusion and canonical red/green. These and three cache tests passed. The actual user's jeans image was not reanalysed during this change; fixtures do not establish accuracy for every lighting condition or image.

Stylist send remains blocked by unavailable conversation storage. SUPABASE_DB_URL is absent from backend/.env, while a database password alone does not identify the exact usable pooler endpoint. Requested the exact Session Pooler URL privately in the environment file. Did not bypass persistence, ownership checks or authentication. Mobile now distinguishes pending chat setup, connection failures and missing worker configuration; Send also checks workerConfigured. Typecheck and lint passed. Migration application and authenticated live stylist recommendation verification remain pending the connection string.

### 2026-11-25: semantic colour cross-check

FashionSigLIP now precomputes two text prompts per existing colour label at model initialization. colour_evidence reuses the already-computed garment image embedding and returns relative prompt evidence. No additional image encoding, uploaded photo, external provider call or public response field is introduced. Pixel-based foreground colours remain the suggestions; existing saved records and user edits remain untouched.

For a dominant measured colour (share >= .55), semantic disagreement with relative margin >= .15 routes auto results to review and adds a plain-language colour warning. Related blue shades, related greys and burgundy/red are grouped to avoid needless review prompts. Weak semantic evidence and multicolour inputs do not force a semantic replacement. Failed background separation also requests colour review. These thresholds are routing heuristics, not calibrated accuracy claims. The existing mobile review form opens automatically for review results.

Verification: 10 colour/hybrid pipeline tests, 10 private worker tests and 3 cache tests passed. Tests cover blue/grey disagreements, shade agreement, weak evidence, multicolour inputs, foreground masking, pipeline review routing and unchanged image encoding count. Restarted the verified ML worker. Actual garment-photo accuracy still needs validation on varied user photos; no guarantee of colour accuracy is implied. Stylist remains blocked by the missing SUPABASE_DB_URL and unapplied hosted conversation-storage migration; no persistence/authentication bypass was added.
### 2026-11-25: existing garments can save reviewed clean wardrobe photos

Added POST /ml/garments/{garment_id}/prepare. It reads the owned saved garment/current original, validates a supported category, prepares a cutout and reference, rechecks account activity, and returns the existing signed review receipt bound to source hash/category/owner. The existing confirmation endpoint checks the source again before storing private derived assets. No automatic changes to saved metadata or original photos occur.

GarmentAnalysisPanel now offers Prepare clean wardrobe photo, a preview with warnings, Use clean photo in wardrobe, and Keep original photo. It checks prepared storage capability before expensive inference. Existing WardrobeImage already requests closet-image, which uses the saved clean asset when valid and falls back to the original. New Add a piece already supports reviewed prepared-asset saving. Both flows require the prepared-garments migration. Existing clean-photo conversion is explicit, not a mass backfill.

Validation: 10 focused prepared/upload tests passed; mobile typecheck and lint passed. Restarted the identified API. Live persistence/wardrobe display verification is still blocked by database migration access.

The supplied SUPABASE_DB_URL uses a reachable session pooler. A reserved character in its password required percent encoding; normalized privately without changing the password. Connections with full hostname/certificate verification fail without the Supabase database CA certificate (system trust and certifi were insufficient). Requested the Server root certificate from dashboard Database settings / SSL configuration. No hosted migrations were applied, no certificate checks were disabled, and database authentication has not yet been verified. Isolated psycopg tooling was installed under .integration/db-tools, leaving runtime dependency files unchanged.
### 2026-11-25: hosted integration migrations applied

Found backend/prod-ca-2021.crt. Using the privately saved pooler URL and this root certificate, connected successfully with sslmode=verify-full (certificate chain and hostname verification enabled). Inspected the existing Supabase migration ledger: all prerequisites through 202611230006 were recorded; the three integration tables were absent.

Applied 202611240001_pose_analysis.sql, 202611240002_ml_session_history.sql and 202611250001_prepared_garments.sql. Each migration body and its ledger entry committed in a single transaction, with bounded lock/statement timeouts. Requested PostgREST schema reload. No existing garment photos or user records were modified during this deployment.

Verified all three ledger entries and tables, enforced RLS on each table, authenticated execute privileges with anonymous execution denied for the new API functions, six derived-image storage policies, and private ml-session-images/wardrobe-derived buckets. API and worker health endpoints returned HTTP 200. Database authentication/certificate and migration blockers are cleared.

The signed-in browser workflow could not be verified in this turn because local browser access was unavailable. Refresh the stylist page so /ml/capabilities reads the new schema; then verify a real recommendation. For existing garments use Prepare clean wardrobe photo, inspect the preview, and confirm Use clean photo in wardrobe. New upload confirmation also now has prepared-image storage available. Existing wardrobe originals are not automatically backfilled. Actual prepared-image save/display and external-provider recommendation results remain acceptance checks, not claimed as completed here.

### 2026-11-25: PostgREST transaction mode corrected

A fresh signed-in capability retry produced HTTP 405 / PostgreSQL 25006 for read_pose_analysis and read_ml_sessions. The newly deployed wrappers were STABLE, so PostgREST opened read-only transactions, but require_active_account() takes a lifecycle FOR SHARE lock. Existing direct SQL database tests ran in writable transactions and did not exercise this PostgREST behavior. This was a server defect, not only stale UI state.

Added and applied migration 202611250002_inference_read_transactions: set the three affected read functions and their API wrappers to VOLATILE, preserving account locks, owner scoping, RLS and grants. Recorded the migration atomically and reloaded the PostgREST schema cache. Verified all six deployed declarations. Added a database regression asserting these declarations so direct SQL tests also cover the transaction-mode contract.

Stylist capability checks now refresh on screen focus and retry every 15 seconds while unavailable. Added credential-free RPC status/error-code diagnostics. Mobile typecheck/lint and 12 focused backend tests passed. The new database regression requires the disposable database suite; its equivalent catalog assertion passed against the deployed database. A successful authenticated browser capability response and generated recommendation remain to be confirmed.

### 2026-11-25: personalization transaction declarations corrected

The first submitted stylist requests failed before ML inference at read_personalization_preferences (HTTP 405, SQLSTATE 25006). Audited all api/app_private functions transitively calling require_active_account: the remaining mismatches were read_personalization_preferences and list_recommendation_feedback, plus their API wrappers.

Added/applied 202611250003_personalization_read_transactions.sql, recorded atomically in the migration ledger and requested PostgREST schema reload. Changed only volatility declarations to VOLATILE so PostgREST uses writable transactions needed by existing lifecycle FOR SHARE locks. No grants, RLS policies, authentication, locks or saved user data were weakened or changed. A repeat live catalog audit found zero remaining non-VOLATILE functions on these account-lock call chains. Added a recursive database regression to test_ml_session_database.py. The equivalent deployed catalog audit passed; the new test itself still requires the disposable PostgreSQL suite.

Expanded safe backend diagnostics to log operation/status/SQLSTATE for repository failures and worker operation/status for session inference failures. No user messages, garments, images or credentials are logged by these changes. Twelve focused inference/session API tests passed. Asked the user to submit the same selected-T-shirt request again; end-to-end recommendation success is not yet established.
### 2026-11-25: web reload session and stylist processing improvements

Reload sign-out was caused by webAuthStorage intentionally retaining sessions only in memory. Changed web storage to tab-scoped sessionStorage, preserving same-tab reloads and OAuth redirects; no localStorage is used. Sign-out removes the stored session. Storage failures are not silently treated as successful persistence. Existing users must sign in once with the updated bundle. Browser session restore behavior may preserve tab data depending on browser settings; no claim of guaranteed deletion on every browser close is made. Updated session and real-SDK OAuth tests to verify restoration and local sign-out cleanup. All 88 mobile tests, typecheck and lint passed.

Added the shared ProcessingCard to stylist waiting state with Crafting your look text. The pulse/rotation/indeterminate bar respect reduced-motion preferences and stop on unmount. No artificial percentages or fake processing stages are shown.

Saved wardrobe styling no longer repeats process_upload/BiRefNet on every image. It validates image dimensions, embeds/classifies each saved image once, retains the confirmed category slot and dominant colour label, preserves measured colour hex/share, and supplies the image to the existing CIR/vision ranking path. Original upload validation/preparation paths are unchanged. Corrected the adapter's interpretation catalog to send colour names (list[str]) rather than colour objects, matching LocalStylist evidence validation. Eleven private worker tests passed, including a regression asserting no upload/background pipeline call, one image embedding, and the edited colour label.

A live synthetic request reproduced a Cloudflare incomplete-answer rejection. Gemma requests now disable optional reasoning and allow a bounded 4096 output-token budget; complete-answer/schema/evidence validation is retained. A live direct Gemma interpretation returned valid recommend JSON in 19.7 seconds. Seven provider boundary tests passed. Added safe completion-reason and busy-worker diagnostics. Restarted the private worker with these changes. A final full synthetic recommendation probe is running; authenticated app persistence/reload and actual-user recommendation acceptance are not claimed by these checks.
Final synthetic probe returned HTTP 200, status needs_clarification, zero outfits, no warnings in 33.7 seconds. This confirms a valid private worker response through the live model path, not successful real-user outfit generation or full backend/database/browser persistence. No user photos or records were used in this probe.

### 2026-11-25: recommendation metadata fixed; single-analysis, single-save upload

The screenshot's incomplete/invalid metadata response came from Item validation in recommend(). The session adapter supplied nested scored attributes where row_to_item requires plain labels. Flattened pattern/formality/season/fit at this boundary, preserving internal ML confidence data. Added a regression that passes actual adapter rows through row_to_item and Item.model_validate. A live synthetic full private-worker request now returned HTTP 200, status recommended, one outfit in 75.0 seconds including model loading, with successful Gemma interpretation and outfit photo assessment. This verifies ML recommendation generation, not signed-in app history persistence with real garments.

Upload analysis now sends prepare_closet=true to the private worker. It performs upload gating, BiRefNet once, classification/colour checks, and garment isolation using the same cutout. For supported garments, parser preparation happens during this request; shoes use the foreground cutout directly. Uncertain background removal is rejected rather than silently storing the original as a clean image. The worker returns the cutout/prepared pair; the public API validates it and signs a source/owner/category-bound receipt, returning only the preview and receipt needed by the app. Explicit category corrections can be passed on a photo recheck.

Add a piece now displays the final prepared preview before Save. Save creates/preserves the original and confirms the already-reviewed derived assets, then returns to the wardrobe. It does not start a second preparation or require a second confirmation. The wardrobe's existing closet-image route serves the valid clean asset on a white canvas, preserving the transparent WEBP in private storage and original photo separately. Source/category changes invalidate preparation. Partial save failure retains savedId for retry instead of creating another garment.

Verification: 12 worker tests, 5 upload-review tests, 7 prepared-image tests and 88 mobile tests passed; mobile typecheck/lint passed. A new image-byte save/read regression confirms private derived storage, clean wardrobe output and unchanged originals. No real user records were altered by these tests. Final API/worker restarted to include explicit category correction support. Signed-in real upload/save/display acceptance remains to be checked in the user's browser.
### 2026-11-25: actual persisted recommendation, shared CPU contention and transparent closet images

Production logs showed the current stylist 503s were CPU-worker admission failures while a previous request held the single inference slot. Upload analysis also failed under the same contention. Inspection of actual stored session results found a recommended outfit; verified its API signature and StylistResult schema successfully, without printing messages, user IDs or garment details. Thus the real backend-to-worker-to-database path has produced a valid recommendation; a failed subsequent attempt must not be conflated with absent inference capability.

Added shared bounded active-request admission: at most three admitted ML requests, one CPU execution, up to 60 seconds waiting. Full queue or exceeded wait returns 429, not an immediate generic 503. The API preserves explicit busy responses and the client explains them. Stylist transport permits 300 seconds and the client 330 seconds to accommodate queue wait, model loading and vision evaluation. Processing remains session-bound, with existing post-inference eligibility checks; this is not a durable/background job system. Added safe admitted/finished timing logs.

Database counts at inspection: 8 wardrobe garments, 2 prepared records, 4 derived objects. The closet-image endpoint previously flattened valid transparent WEBP assets onto white JPEGs, explaining visible white rectangles even for saved cutouts. It now serves the integrity-checked transparent WEBP directly with no-store/nosniff headers. The authenticated image client accepts JPEG and WEBP, and WardrobeImage refreshes on route focus after a derived image is saved. Original/gallery JPEGs remain unchanged.

User requested existing garments also be included. Added owned clean-photo-review listing and CleanWardrobeReview on the wardrobe collection. It skips unsupported/already-prepared pieces, processes one selected photo at a time, previews the result, and offers save-and-continue or skip. Original files remain preserved. Remaining six garments have not been silently backfilled; the user reviews them through this active-session flow. The listing covers the newest 100 pieces; larger wardrobes remain a pagination follow-up.

Verification: 25 distinct focused backend tests (including transparent pixels and owned missing-photo listing), 14 worker/queue tests, 89 mobile tests, typecheck and lint passed. Actual saved recommendation signature/public-schema validation passed. API and worker restarted with the updates. Browser access remains unavailable in this chat, so rendered wardrobe transparency, user interaction with the review flow and a fresh queued request remain browser acceptance checks.
### 2026-11-25: AI Stylist bottom tab and large-photo upload alignment

Added AI Stylist (/stylist) to the shared appDestinations and bottom-nav icon map. It receives its own active state. Home, Wardrobe, the central Add action, Outfits and Account remain available.

Confirmed upload failure from live worker logs: parser labels had shape (1542,2048) while the pipeline's resized cutout alpha had shape (771,1024). Combined upload preparation was parsing the original full-resolution photo after the tagging pipeline had resized the cutout. Resize the EXIF-normalized source to the cutout's exact dimensions before human parsing; parser labels, foreground alpha and source pixels now share one coordinate space. The original upload/source file remains preserved. Added explicit foreground/source dimension validation in prepare_garment to fail clearly if a future caller supplies mismatched coordinates.

Verification: an HTTP regression reproduces the 2048x1542 original / 1024x771 cutout case, checks parser input dimensions, and verifies successful prepared output with transparency. Sixteen worker tests and six preparation-performance tests passed. Ninety mobile tests, typecheck and lint passed, including the AI Stylist active-tab regression. Restarted only the identified private worker. The user's actual uploaded photo was not replayed because browser access is unavailable; that real-photo upload remains an acceptance check.
### 2026-11-25: persistent stylist work, navigation and saved-look refinements

Introduced a user-scoped StylistStateProvider above Expo route screens. It owns the current conversation, selected items, draft/count, pending request, response, error and abort controller. Route unmount no longer aborts the request; signing out/changing users unmounts that state and aborts it. Work remains within an active app session, not a durable background worker. A shared synchronous request lock blocks rapid duplicate sends/saves, and Send is disabled while busy instead of acting as Cancel. Other routes show Crafting your look with a link back while a request is pending.

Selected garment IDs are now inserted into the previous intent before model interpretation so a UI-selected T-shirt is explicit evidence. Selection removal retains the existing previousRequiredIds behavior. Existing outfit generation already builds top+bottom or a dress, includes available shoes and considers optional layers; the user confirmed using available pieces. A missing-shoes note is added rather than inventing shoes or blocking all outfits.

Added a 1–5 look-count dropdown (the actual API maximum) and Another outfit using the existing conversation/seen exclusions. Added 2D Try-On to bottom navigation; moved Account to top-right headers. Saved outfits now show garment mosaics, shorter descriptions and grouped identical item sets by default, with a Show duplicate copies control. No records are deleted. Stylist Save checks the user's full paginated saved-outfit list before creating another identical set; saved buttons disable after saving. This client guard prevents normal repeated saves but is not a database uniqueness constraint for concurrent clients.

Verification: 93 mobile tests, typecheck and lint passed. Sixteen worker tests passed, including explicit selected-shirt intent and the existing selection-removal/metadata regressions. Credential/worker endpoint checks matched. A direct missing-selected-piece probe returned HTTP 200 with needs_clarification, validating the private boundary. The exact selected-shirt synthetic recommendation probe is running against the updated worker; successful real-user selection rendering and route-navigation behavior still require browser acceptance because browser tools are unavailable in this chat.
Selected-shirt live synthetic probe finished: HTTP 200 in 109.7 seconds, status needs_clarification after suitability assessment of synthetic fixture images, zero outfits. It did not reproduce the 503 service failure. This does not establish a successful outfit recommendation for the user's actual T-shirt.

### 2026-11-25: icon cleanup, retired UI removed and workflow verification

Replaced account, wardrobe and catalogue text glyphs with reusable native outline AppIcon components. Dashboard tiles and bottom-navigation wardrobe links use accessible Pressable/Link composition rather than malformed encoded text. Account stays top-right. Updated native layout styles separately from text styles.

Removed the obsolete Outfit suggestions form. /recommendations now redirects to /stylist so old links remain usable; dashboard, try-on and saved-ideas links lead to AI Stylist. Extracted RecommendationLooks and its feedback controls into a reusable component so existing saved recommendation data remains readable without shipping the retired form. Removed CleanWardrobeReview from the collection screen. Existing clean-image edit/preparation APIs and stored images remain intact.

Confirmed actual hosted counts: 10 wardrobe garments, 10 prepared-image records and 20 derived storage objects. wardrobe-derived and ml-session-images buckets remain private. Confirmed running web/API/worker HTTP 200. Fetched the actual served Expo entry bundle: AppIcon included; retired Outfit suggestions heading absent; A cleaner wardrobe panel absent; broken wardrobe glyph absent.

Automated verification completed:
- Mobile: 93 tests passed; TypeScript and ESLint passed.
- ML component: all 186 unittest tests passed (provider tests intercept inference except safe catalogue checks; this is not a claim of live try-on generation).
- Full backend: 473 passed, 376 skipped without the disposable DB, one existing Starlette deprecation warning.
- Refreshed isolated PostgreSQL harness with current app/tests/migrations, built the existing Docker test image, and ran with --network none: 308 workflow tests plus 68 registration/integration tests passed. Hosted user data was not mutated by this test run.

Workflow evidence / limits:
| Workflow | Verified in this run | Still requires live acceptance |
| --- | --- | --- |
| Session restore, sign-in/access guards | Mobile/backend/auth tests and isolated database registration tests | Actual browser reload/sign-in and email delivery |
| Add garment / combined processing / Save / clean closet image | ML high-resolution regression, backend receipt/save/read/image-alpha tests, actual prepared-record counts | Real signed-in upload and on-screen preview |
| Stylist selection, count, another look, navigation-safe state | Existing mobile/worker tests; prior live synthetic and real saved-response evidence documented above | Current signed-in message, navigation while pending, result rendering |
| Save/group duplicate outfits | Mobile pagination/grouping tests and backend/isolated outfit ownership workflows | Visual saved-look layout and concurrent multi-client save behavior |
| Try-on | Consent/ownership/contracts/provider and preparation boundary tests | Explicitly consented real photo, hosted generation and rendering |

Browser connector returned Local browser access is unavailable for this chat. The computer-use skill's guidance explicitly says Do not automate the ChatGPT desktop app UI, so native automation of the embedded browser was not used as a workaround. No full signed-in UI walkthrough, live SMTP delivery or real person-photo provider generation is claimed. These are the remaining end-to-end verification gaps.

### Stylist failure and web rendering correction (25 November 2026)

- The live Workers AI log showed `finish_reason=length` during outfit photo assessment. The Gemma request now explicitly supplies `chat_template_kwargs.enable_thinking=false` and `max_completion_tokens=4096`. Strict JSON schema and candidate-ID validation remain in place; no provider fallback was added.
- Verified the private live service with existing shirt/trousers/skirt fixture photos, a required shirt and count=2: HTTP 200, status `recommended`, two distinct looks, both containing the shirt. The cold request took 96.9 seconds; interpretation took 3.35 seconds / 81 output tokens and photo assessment 4.58 seconds / 93 output tokens. This is an ML-service verification, not an authenticated browser acceptance test.
- Fixed the cross-screen crafting banner condition so an empty pending string cannot become a raw View text child. Web loading animations now use the JS animation driver.
- Failed stylist responses offer a retry button and omit Save/feedback controls. Dashboard Add link styles are flattened for Expo Router Slot compatibility.
- Mobile typecheck and lint completed successfully; all 93 mobile tests passed. Browser acceptance with the user-selected wardrobe item remains pending because browser control was unavailable in the earlier check.

- All 23 targeted provider/private-worker regression tests passed with OMP/MKL/OpenBLAS test threads limited to 1 to avoid CPU oversubscription.


### Wardrobe outfit access and body-photo analysis (25 November 2026)

- Removed Outfits from the bottom navigation. Wardrobe header now links to Your outfits; outfit detail routes keep Wardrobe selected. Home, Wardrobe, central Add, AI Stylist and 2D Try-On remain available.
- Your outfits now has Saved outfits and Generated looks tabs. Saved outfits retains the existing collection and editing workflow. Generated looks uses the existing authenticated history endpoint, shows distinct looks from the latest 100 responses, and supports duplicate-safe saving; switching back refreshes the saved list. No records or routes were deleted.
- Added Account and onboarding links to body-photo analysis. Removed obsolete onboarding copy claiming photo analysis is unavailable. Shared private photo previews now contain the whole image. Analysis refreshes on return from onboarding and prefills only the user-entered profile height (inches converted to centimetres); users can edit it. Added processing animation and duplicate-submit protection.
- Existing MediaPipe validation, known-height calibration, signed estimates, explicit review/confirmation and separation from manual measurements remain in place. The API forwards only allowlisted pose-correction guidance, with tests ensuring arbitrary private worker text is never exposed.
- Live private MediaPipe service: model installed (5,777,746 bytes), detector executed on the existing angled person fixture and returned the expected actionable 422 pose rejection in 6.3 seconds. This verifies real model initialization/rejection, not a successful measurement from an authenticated user photo. No user body photo was downloaded or analysed during this check.
- Checks: 94 mobile tests; 21 API/pose receipt tests; 6 ML pose-analysis tests passed. Authenticated browser upload/review/save acceptance remains pending.


### Navigation UI refinement (25 November 2026)

- Replaced remaining navigation font symbols with a single native View-based outline icon set (home, wardrobe, stylist, try-on shirt, plus, back, account, catalog and outfits). No new native dependency. Bottom labels use 11px text and 15px line height; tab targets have a 60px minimum height. Selected tabs use a subtle pill behind their icon.
- Wardrobe Outfits shortcut now uses an icon plus text at widths >=380px; compact screens keep a labelled 44px icon target beside Account. Account also shows its selected state on body-analysis/profile pages.
- Outfits collection returns to Wardrobe; outfit details/creation return to Outfits; body analysis returns to Account. Explicit parent links work without browser history. The central Add action remains 48px and all new Slot children use plain/flattened style objects.
- Typecheck, lint and all 95 mobile tests passed, including direct-entry parent navigation. Rendered browser/mobile visual acceptance has not been verified in this turn.


### Oracle cloud deployment and Android Expo access — 25 November 2026

Deployed existing API, separate private CPU worker, static Expo web export and
Expo Go/Metro to the user-provided Ubuntu x86_64 VM (4 OCPUs / 32 GB RAM).
Systemd runs services independently of the laptop; temporary Cloudflare HTTPS
tunnels expose API/web/Expo only. The inference port remains loopback-only.
Private runtime environments and the receipt key were preserved; credentials,
local databases and personal photos were excluded from source archives.

Public web/phone/QR routes, API health/auth/CORS, SDK 58 Android/iOS manifests
and actual bundles passed checks. Chrome rendered the hosted landing page.
Real CPU blank-image validation, public garment cutout, pinned CIR/LaBSE loading
and text-only Gemma checks passed. TypeScript and lint passed. See
`deployment/oracle/README.md` at the parent project for exact service configs,
version lock, current testing URLs, evidence and recovery instructions.

Read-only database verification with the existing Supabase CA and verify-full
confirmed all three ML tables and migrations through 202611250003. Earlier
statements that schema rollout remained deferred were superseded by newer
project work and this check. No migrations were reapplied. User reports SMTP
is already configured; live email delivery remains unverified. Physical Android
and complete signed-in workflows remain acceptance tasks. Temporary addresses
are development-only and rotate; stable hosting URLs and an installed release
are separate release requirements.

Live hosted try-on smoke: private session endpoint returned HTTP 200, actual
provider weshop, generated JPEG present, 57.62 seconds. Used only the official
IDM demo public person and garment with prepared=true; no personal photos or
Supabase records were used. This verifies provider connectivity/generation,
not a signed-in personal-photo workflow or guaranteed future provider capacity.

Combined cloud upload test also returned HTTP 200 with both the reviewed
cutout and prepared JPEG reference in 11.37 seconds, using the official public
garment and prepare_closet=true. This exercised CPU human-parser isolation.
The Android QR was decoded locally and matches the intended exps HTTPS link.


### Android wardrobe sizing and native upload correction — 25 November 2026

The phone reported indefinitely stretching wardrobe cards and immediate try-on
network failure after gallery selection. Removed card height:100% in the wrapping
grid, aligned cells to their content, and bounded wardrobe image height using the
measured frame width (maximum 420 logical pixels). A simplified Yoga harness did
not reproduce the original device fault, so native confirmation was required.
After deployment/reopening Expo Go, the user confirmed normal sizing/scrolling
past the first two cards.

The immediate upload error was reproduced against the installed Expo SDK 58
convertFormDataAsync implementation: the SDK now defaults global fetch to its
Expo implementation, whose multipart encoder rejects the legacy {uri,name,type}
part before HTTP. Native photo upload now appends expo-file-system File instead,
with missing/empty/oversize file checks. Installed the SDK-compatible dependency
using expo install; it is included in Expo Go. Browser File handling and backend
request fields remain unchanged. The shared correction covers garment/gallery,
onboarding and try-on photo submission.

Private try-on preview now handles image decoding/display failures and offers
a protected-image retry. It does not publish public storage URLs.

Verification: 97 mobile tests passed, including two tests against the actual
installed SDK serializer (legacy rejection and File byte preservation/field
serialization); final TypeScript and ESLint passed. Eight backend session tests
passed, including actual multipart route -> intercepted provider -> signed record
-> protected image readback, plus provider-failure/no-output and missing-consent
checks. These API tests intercept external dependencies. The deployed Android
manifest/bundle return 200 and contain File uploads, bounded sizing and retry UI;
web export completed. No API schema, database migration or auth change was made.

On the physical Android phone, the user confirmed that try-on now begins
processing instead of failing immediately. Final generation/image display is
still being checked; processing start alone is not successful preview delivery.

Physical Android acceptance completed for the reported failures: after reopening
Expo Go and selecting the gallery photo again, the user confirmed normal
wardrobe sizing/scrolling, successful try-on processing, and final generated-image
display on the phone. A read-only, verify-full aggregate query also observed
completed try-on persistence; no private photos or record payloads were read.
This confirms the reported wardrobe and try-on workflow on the user's device,
not every unrelated application feature, future provider capacity or production
release readiness. Cloud services stayed active throughout the final request.


### Garment upload routing investigation (25 November 2026)

- The mobile environment targeted a quick Cloudflare tunnel. A direct anonymous upload probe appeared in the restarted local API diagnostics; the same probe through the configured tunnel did not. Browser preview now explicitly selects `EXPO_PUBLIC_WEB_API_URL=http://localhost:8000`, while native clients retain `EXPO_PUBLIC_API_URL`. This does not create a new tunnel or change mobile credentials. Restarted Expo and verified the compiled bundle contains the web API setting.
- Added a regression test proving browser and native requests choose their respective configured APIs. Typecheck, lint and 99 mobile tests passed. Forty backend inference/security checks passed.
- Added safe status logging for rejected analyse-upload requests and allowlisted photo-parser failure-stage logging. Photo content, credentials, and arbitrary worker diagnostics are not logged.
- Actual private garment-analysis request using an existing trousers fixture returned HTTP 200 in 39.3 seconds: Jeans / bottom, with closet preparation included. No wardrobe records were modified. The exact user image still requires a fresh browser retry against the corrected web API.


### 2D Try-On history controls (25 November 2026)

- Added Load previous sessions / Refresh previous sessions, per-result Load preview and confirmed Delete preview controls. Loading opens an existing saved image without generating again or sending a new person photo. The last 100 try-on results are queried independently of stylist traffic; previews load lazily when selected.
- New authenticated DELETE /ml/history/{id} is limited to owned try-on results. A retryable database tombstone first removes the result from history and image lookup; generated-image bytes are then deleted using user-scoped storage access. Failed cleanup reports an error and can be retried. Garment records, original images and stylist conversations are not deleted. Tombstones remain as private metadata until account cleanup.
- Migration 202611250004_tryon_history_controls applied after matching the exact isolated-test copy; verified TLS and authenticated-only function execution. No existing user preview was deleted during implementation or testing.
- Verification: 99 mobile tests plus typecheck/lint passed; 13 session API tests passed. Disposable PostgreSQL run passed 308 foundation and 72 later workflow tests, including deletion ownership, retryability, hidden deleted results and non-try-on refusal. Authenticated browser clicking/deletion has not been verified.


### Cutout attachment and partial-save recovery (25 November 2026)

- Reproduced a source-byte regression with a noisy image: normalized JPEG bytes change on re-encoding. `garment_image` verified stored bytes, then re-encoded them, so the upload preparation receipt no longer matched the original after creating the wardrobe item. It now validates the image but serves the integrity-checked stored JPEG unchanged. Existing saved preparations bound to the deterministic old second encoding remain usable only when verified against that same owned original, category and version. New saved proofs bind the stable source hash.
- Extracted staged Save orchestration. A matching reviewed cutout is required before creating any item. The created ID is retained in the user-scoped session draft before cutout attachment; retries patch/finish the same item rather than re-uploading. A synchronous lock blocks rapid repeated Save presses. Only a create-stage 409 produces the duplicate warning; cutout conflicts explain the incomplete save and request fresh preparation.
- Expired/changed preparations are cleared and Save stays disabled until a matching clean preview is ready. True duplicates offer a link to review existing wardrobe pieces. Existing originals-only records were not deleted or silently reprocessed; their existing detail-screen clean-photo review remains available. No user record was created or removed during tests.
- Backend: 91 wardrobe, prepared-image, upload-review and ML-session tests passed, including JPEG byte stability, receipt attachment, transparent WebP serving, legacy compatibility and source mismatch rejection. Mobile Save workflow tests verify a failed attachment followed by retry makes exactly one wardrobe create. API restarted with the fix; authenticated browser acceptance remains pending.
