# Drape & Drop — Master Workflow Status and Main Consolidation

Updated 2026-11-08T19:39:25+05:30 (Asia/Kolkata). This is the current source/integration status; older milestone/audit documents remain historical snapshots.

## Acceptance summary

**Main source consolidation is complete through Auth checkpoint `bbccff9aee3255bd6b37a8f9d68129dcef199052`; full application acceptance is BLOCKED.** Local `main` was fast-forwarded from `e70b2f9c6e33a455d04e8aa4b6a1dd9b44c80b3d`, preserving ten existing commits without conflicts. All relevant Expo/FastAPI/Supabase Auth/security/foundation code is on one integration line. No legacy demo authority was merged over it. New consolidation documentation/CI/status-copy changes belong to a follow-up commit on main; its final SHA is reported by `git log -1` and in the delivery message rather than embedding a self-referential commit hash in this file.

**17 workflow groups:0 COMPLETE,12 PARTIAL,5 BLOCKED,0 wholly NOT IMPLEMENTED groups.** Each group contains some existing UI or security/design work; many backend actions inside these groups are explicitly NOT IMPLEMENTED. This is not a percent-complete estimate. No business workflow is verified through real hosted Auth→FastAPI→Data API→database/Storage. Local introduction/navigation is verified but is only a subflow of group17.

Statuses mean: COMPLETE = whole stated workflow verified; PARTIAL = source exists, missing layers/acceptance; BLOCKED = known architectural/external acceptance dependency prevents honest completion; NOT IMPLEMENTED = named action has no implementation. Source merge, local unit tests and JS exports do not imply hosted/device/production acceptance.

## Inventory, preservation and branch plan

Pre-consolidation state: feature/backend-security-foundation at bbccff9, no tracked/staged changes, two untracked reports. These reports remain untracked and byte-for-byte unchanged:

- docs/PROJECT_COMPLETION_AUDIT.md — detailed25-section historical audit.
- docs/backend/supabase-remote-migration-history.md — hosted-history/credential diagnostic evidence.

Ignored real mobile/backend .env files were also preserved. No migration or environment value changed; no secrets are written here. No new branch, tag, stash, reset, force push, deletion of history or remote Supabase action was performed.

Local branches and cached remote-tracking branches at inventory:

- `feature/backend-security-foundation bbccff9aee3255bd6b37a8f9d68129dcef199052`

- `feature/mobile-foundation d61b7808ba3873c99465a07b22da66f45fe5a05c`

- `main bbccff9aee3255bd6b37a8f9d68129dcef199052`

- `origin/HEAD e70b2f9c6e33a455d04e8aa4b6a1dd9b44c80b3d`

- `origin/feature/backend-security-foundation bb46044315e6102ab12444bdd56aaf2af37730f9`

- `origin/feature/mobile-foundation d61b7808ba3873c99465a07b22da66f45fe5a05c`

- `origin/frontend/workflow-0-foundations 3185c50e74c5d0e67968ab38854504a04291779a`

- `origin/main e70b2f9c6e33a455d04e8aa4b6a1dd9b44c80b3d`

Remote-tracking refs are cached local evidence. No fetch, remote branch update or push was used for consolidation. `origin/HEAD` is a symbolic alias. Three local branches/four remote-tracking branch heads remain; main now advances locally, origin/main remains unchanged.

Incorporated commits (old main..Auth checkpoint, oldest first):

- `ebaf8677c5a531a0310df0481011031902c798ae feat(mobile): replace web frontend with Android Expo foundation`

- `6f1768f9906c70876c2d4da0ce041baebcee05b2 feat(mobile): enable browser preview and document checkpoint`

- `8b89d0fdc7e079e68b1c73a05e2d4eee7dbdc6c7 feat(mobile): implement API-driven frontend workflow screens`

- `d61b7808ba3873c99465a07b22da66f45fe5a05c feat(frontend): retain drafts and version verification checkpoint`

- `fd0f3dc50a959b27a4cd68ff899ad513e449f11e feat(backend): add fail-closed JWT and user-scoped access foundation`

- `3c790de8a952b639087e26305e8c9774a4d4056f docs(database): inventory entities relationships and API coverage`

- `bb46044315e6102ab12444bdd56aaf2af37730f9 feat(preview): clarify status and group workflow navigation`

- `4d3d87c60499c068bc7f6ec4592e99e23ec220ba feat(backend): checkpoint approved v0.2.0 database foundation`

- `74636c2932a2f55c94fc1f399e72cc670b736418 chore(supabase): checkpoint CLI link with migration history pending`

- `bbccff9aee3255bd6b37a8f9d68129dcef199052 chore(auth): checkpoint authentication integration`

These include the complete feature/mobile-foundation ancestry, cached origin/feature/mobile-foundation and origin/feature/backend-security-foundation, plus local database/CLI/Auth commits. No cherry-picking or rewritten history was needed.

### Historical web branch disposition — user approved

`origin/frontend/workflow-0-foundations` at3185c50 and its four divergent preview commits are deliberately **not merged**. The user explicitly selected “Keep legacy demo flows archived”. The branch and tags remain intact; no Git archive/delete operation was needed. Reviewed files include StudioContext/Studio routes, IndexedDB database/auth/domain/garment services, Account/Photos/Wardrobe pages, media controls, domain/garment tests and the old frontend plan. Their relevant capability differences are accounted for:

- Local PBKDF2 demo accounts, browser-session IDs and an explicit create-admin simulation conflict with Supabase Auth/trusted membership; superseded, not imported.
- Persistent personal photo gallery and replace/delete cascade to local sessions/results has no approved35-contract counterpart. Current app selects transient try-on input and single garment photos. No permanent gallery or unencrypted IndexedDB body-image store is introduced.
- Local wardrobe/catalog CRUD, enum color filtering, page-number pagination, soft-delete/status and shorter field limits differ from current cursor APIs, free-text color/brand/size/material and trusted catalog controls. Current app retains corresponding screens/request wiring; actual server CRUD is still absent, not falsely recovered by merging local simulation.
- Old onboarding/profile/preferences browser data and demo reset are historical features, not application/Auth deletion or trusted cleanup. There is no silent conversion of old account/image IDs into Supabase rows.
- Old tests exercise old local-only domain rules, not current FastAPI/RLS contracts; they remain accessible with the branch. Older backend/Next/Node/Spring references are historical plans, not additional hidden backend implementations.

Preserved annotated tags (peeled commit):

- `backend-v0.1.0-security-foundation-preview fd0f3dc50a959b27a4cd68ff899ad513e449f11e`

- `backend-v0.2.0-cli-linked-history-pending 74636c2932a2f55c94fc1f399e72cc670b736418`

- `backend-v0.2.0-database-foundation 4d3d87c60499c068bc7f6ec4592e99e23ec220ba`

- `database-v0.1.0-entity-inventory 3c790de8a952b639087e26305e8c9774a4d4056f`

- `v0.0.1-frontend-foundations-preview 9977481d26e612deff32bbcab1f40321a73ef178`

- `v0.1.0-frontend-auth-preview c9febb57e5177337658d88fc29f12c134f52c550`

- `v0.2.0-frontend-photos-preview 52af9b0fa593e3ba03639036fb3da323171c8b4e`

- `v0.3.0-frontend-wardrobe-preview 3185c50e74c5d0e67968ab38854504a04291779a`

- `v0.4.0-frontend-verification-preview d61b7808ba3873c99465a07b22da66f45fe5a05c`

- `v0.4.1-workflow-preview bb46044315e6102ab12444bdd56aaf2af37730f9`

Six newer tag commits are now ancestors of main. Four older Vite-preview tags remain on the archived divergent history. Existing tags are unchanged; no new Auth/consolidation tag or push is authorized by this record.

## Current source and runtime boundary

- Frontend: Expo58/React Native0.88.1/TypeScript, Expo Router, Supabase JS SDK, SecureStore on native and memory on web.
- Backend: FastAPI0.2.0 application with asymmetric JWKS verifier, immutable principal, current-user-JWT Data API adapter, fail-closed account dependency, four profile/settings HTTP operations.
- Database: one migration `supabase/migrations/202611060001_foundation.sql`; six private forced-RLS tables, five exposed api invoker RPC wrappers,11 private helper functions, five non-login/non-bypass trust roles. Normal access has no service-role fallback.
- Approved planned layers: Supabase PostgreSQL/Storage, remaining business services, trusted cleanup and eventual recommendation/try-on worker. No production mock routes, fake success, model provider or ML implementation was added.
- Current contract inventory remains35 unchanged. SDK Auth supersedes current callers of legacy custom Auth contracts; the transition is explained in frontend-supabase-auth-integration.md without creating a second competing backend.
- Feature flag remains false. No exposed api schema deployment, hosted migration or real account/bootstrap/Storage verification was done in consolidation. Last dashboard observations are historical evidence in the previous audit, not a fresh inspection.

## Workflow inventory — code, persistence, history and gaps

All listed active source is now on main through bbccff9. History shorthand: **M**=8b89d0f mobile workflow implementation (then d61b780 drafts), **F**=fd0f3dc security infrastructure, **D**=4d3d87c six-table/four-route foundation, **A**=bbccff9 Supabase Auth. Each is incorporated, not merely available on another branch. Tests described as local are not hosted acceptance.

### 1. Signup, confirmation, login and logout — PARTIAL

- **Frontend / history:** A; AuthScreen, auth-confirm, session.tsx and services/auth. Email/password SDK signup/login, verification/recovery hashes and local logout exist. Google action is unavailable.
- **Backend / database:** FastAPI has no Auth facade; Supabase Auth owns credentials/sessions. No normal client bootstrap. Auth identity external; lifecycle/profile bootstrap local only.
- **Test evidence:** Auth tests cover safe errors, signup metadata, SDK restoration/logout and gate helper.
- **Missing functionality / integration problem:** Hosted allowlisted callbacks/template/email delivery and native callback verification are pending. The prior dashboard had no redirect URLs/default confirmation format. Do not fake signup or role assignment.

### 2. Session persistence, refresh and recovery — PARTIAL

- **Frontend / history:** A; SessionProvider, contracts/currentAccessToken, secureSessionStorage and reset-password. Foreground refresh and latest JWT forwarding; web intentionally memory-only.
- **Backend / database:** Bearer JWT goes to FastAPI; refresh token stays SDK-side. No app session table. Local signOut does not guarantee already-issued JWT revocation.
- **Test evidence:** SDK refresh deduplication/current-token isolation, link-client isolation and large Unicode storage tests pass.
- **Missing functionality / integration problem:** Native process restart/lock/SecureStore fault tests, mounted login/logout races and hosted reset expiry/reuse remain unverified. Same-user resource cache risk remains; sent mutations can commit after logout.

### 3. Account settings and profile management — BLOCKED

- **Frontend / history:** M/A/D; profile/index, settings, preferences and EditorScreen. Full-form clearing and guarded reads/saves.
- **Backend / database:** GET/PATCH/profile +GET/PATCH/settings implemented with Pydantic/RPC;204 mutations. user_profiles/user_preferences local tables with own-active RLS and constrained column grants.
- **Test evidence:** FastAPI/schema/overposting/clearing/lifecycle-race API tests plus SQL isolation tests pass locally.
- **Missing functionality / integration problem:** Hosted migration/api exposure/trusted bootstrap and current JWT propagation must pass before flag activation. Live current-password change remains unavailable; recovery is used instead.

### 4. Body profile and measurements — BLOCKED

- **Frontend / history:** M; profile/body and bodyFields. Optional measurements/appearance inputs; required units cm/in;1–300 validation.
- **Backend / database:** body_profiles local bootstrap table; normal read/write route/RPC/grants absent. Proposed numeric(10,4) is not an approved product rounding policy.
- **Test evidence:** Shared frontend enum/numeric tests and actual database units/check constraints.
- **Missing functionality / integration problem:** Unit-specific bounds/precision/conversion remain unresolved. BodyProfile type omits bodyShape/skinTone/undertone although forms submit them. Do not accept real body writes by assumption.

### 5. Dashboard and user preferences — PARTIAL

- **Frontend / history:** M/A/D; dashboard count rendering, preferences editor and resource read/loading/error/empty UI.
- **Backend / database:** GET/dashboard missing; settings GET/PATCH exist locally. Counts are projections, not a dashboard table. Preferences string Enabled/Disabled/empty maps bool/null.
- **Test evidence:** Preference API/SQL tests and shared read/error/transport tests.
- **Missing functionality / integration problem:** Define recommendationCount meaning, implement real aggregates after domain tables. No fabricated dashboard totals; theme is type-only, not implemented setting.

### 6. Wardrobe management and garment CRUD — PARTIAL

- **Frontend / history:** M/A; wardrobe routes, CollectionScreen, EditorScreen, validation and PhotoField.
- **Backend / database:** Contracts16/20–23 wired in frontend; all corresponding FastAPI routes, wardrobe/image tables and cleanup operations absent.
- **Test evidence:** Form/transport/draft tests only; no business CRUD E2E.
- **Missing functionality / integration problem:** Need reviewed garment/asset migration, content validation, ownership FK/RLS, transactional association, conflicts and referenced-garment deletion behavior. Archived browser CRUD is not server persistence.

### 7. Catalog browsing and administration — PARTIAL

- **Frontend / history:** M/A; catalog detail/filter collection and admin catalog editors; live admin gate closed.
- **Backend / database:** Contracts17/19/24–28 missing. Only trusted catalog_manage membership/control predicates exist in local foundation. No catalog table/CRUD/upload implementation.
- **Test evidence:** Trusted membership/forged-metadata SQL tests; frontend validation helpers.
- **Missing functionality / integration problem:** Need actual catalog/asset schema, active-authenticated reads, trusted-admin writes, server-side validation and trusted UI membership projection. No demo-admin account is imported.

### 8. Outfit creation, editing, saving and deletion — BLOCKED

- **Frontend / history:** M/A; outfits/new and outfits/[id], collection and recommendation save. Manual>=2 distinct wardrobe IDs; edit metadata only; deletion promises garment preservation.
- **Backend / database:** Contracts18/29–32 missing; saved_outfits/outfit_items proposed only.
- **Test evidence:** Shared validation and request tests; no aggregate/backend transaction tests yet.
- **Missing functionality / integration problem:** Outfit.garmentIds and all detail links assume wardrobe, but recommendations can include catalog. Approve mixed-source representation before honest integration; decide reference deletion and save idempotency.

### 9. Outfit items and filtering — BLOCKED

- **Frontend / history:** M; wardrobe selector limit24/cursor and collection search/category/sort. No standalone outfit-item edit endpoint.
- **Backend / database:** No item table/FKs or filtering/pagination backend. Proposed separate wardrobe/catalog refs with exactly-one source and composite owner FKs.
- **Test evidence:** UI helper tests, no current item-integrity tests because table absent.
- **Missing functionality / integration problem:** Mixed-source response adaptation; aggregate minimum2 manual items cannot be guaranteed by ER edge alone. Recommendation-save minimum remains unresolved. No implicit item-replacement API added.

### 10. Image upload, display and deletion — BLOCKED

- **Frontend / history:** M; library picker one JPEG/PNG/WebP with reported<=10MiB; multipart; URL-only Image display; no standalone permanent gallery.
- **Backend / database:** No upload/decoder/asset table/bucket/positive Storage policy/URL renewal/deletion service. Local restrictive active-account Storage policy grants no access itself.
- **Test evidence:** Multipart transport tests and test-only Storage primitive lifecycle isolation; not actual Storage service authorization.
- **Missing functionality / integration problem:** Approve immutable validation/attachment/cleanup, input/output retention, EXIF/dimensions, private delivery and disabled/deleting signed-capability revocation. Accepted garment needs exactly1 valid current image; drafts can omit it.

### 11. Recommendations and saved recommendations — PARTIAL

- **Frontend / history:** M/A; occasion/preferences/wardrobeOnly form, results rendering and save recommendationId action.
- **Backend / database:** Contracts33/29B missing; request/result/item/provenance persistence proposed only; no generator/producer.
- **Test evidence:** Form/transport tests; no real result/save tests.
- **Missing functionality / integration problem:** Actual generation NOT IMPLEMENTED and ML is excluded from this task. Expiry/save window, minimum count, source permissions/idempotency and preview retention undecided. Never invent recommendations for UI completion.

### 12. Try-on workflow and job lifecycle — PARTIAL

- **Frontend / history:** M/A; person photo+garment source/id+true consent; queued/processing/completed/failed UI and explicit Check status.
- **Backend / database:** Contracts34/35 missing; job/asset/consent persistence, worker and processing absent. No history/relaunch job recovery.
- **Test evidence:** Photo/multipart/helper tests; no worker or hosted job tests.
- **Missing functionality / integration problem:** Processing NOT IMPLEMENTED; ML excluded. Define durable acceptance/worker/retention first. Valid input evidence must survive later byte cleanup; expired input is not invalid submission. Expired-job API behavior remains undecided.

### 13. Account deletion and data cleanup — PARTIAL

- **Frontend / history:** M/A; exact DELETE confirmation+dialog and existing DELETE/account request.
- **Backend / database:** DELETE/account absent; local begin_account_deletion only sets denial/tombstone. Lifecycle Auth FK cascades; minimal tombstone has no live Auth FK. No purge/Auth removal/Storage cleanup orchestrator.
- **Test evidence:** SQL disabled/deleting same-claims denial, bootstrap idempotency, tombstone survival and races pass.
- **Missing functionality / integration problem:** Full deletion NOT IMPLEMENTED. Agree retention/legal basis, cleanup/retry/completion and processor revocation; do not report success from denial alone.

### 14. API validation, errors and authorization — PARTIAL

- **Frontend / history:** A/M; session request attaches latest JWT, transport handles204/non-JSON/errors/timeouts, skips preview private requests.
- **Backend / database:** Four Pydantic HTTP operations with extra-forbid and safe401/403/503 behavior.31 other FastAPI contracts have no route; some are legacy SDK-owned Auth responsibilities.
- **Test evidence:** 47 backend mock-HTTP/JWT/API tests and frontend transport tests pass.
- **Missing functionality / integration problem:** No common field-error mapping, business pagination/upload validation, rate limiting/observability or web CORS configuration. Existing35 contract texts unchanged. No blanket service-role fallback or anonymous data path.

### 15. Database constraints, indexes and relationships — PARTIAL

- **Frontend / history:** D; local schema plus reviewed entity/logical/physical design. No frontend database client.
- **Backend / database:** Six application tables/PK indexes; Auth FKs, enum/length/measurement/tombstone checks; forcedRLS. Nine additional proposed tables absent. Migration202611060001 unchanged.
- **Test evidence:** 35 disposable PostgreSQL cases; checks include owner/grants/lifecycle/concurrency and catalog; prior extra constraint evidence remains historical.
- **Missing functionality / integration problem:** Hosted PG17/operator privileges/exposure unverified; local PG15 Auth/Storage fixtures do not reproduce managed services. New migrations need reviewed source/asset/aggregate invariants, not overwriting foundation.

### 16. RLS, JWT and cross-user isolation — PARTIAL

- **Frontend / history:** F/D/A; authenticated current-token adapter and trusted source identity; normal client role=user.
- **Backend / database:** Fixed-origin asymmetric JWKS, principal UUID/claims, no shared request auth state or elevation. SQL own-active grants/RLS and constrained nonowner helper roles.
- **Test evidence:** JWT rotation/tamper/claim rejection/token concurrency plus SQLA/B/direct-call/metadata-admin/inactive cases pass.
- **Missing functionality / integration problem:** Real hosted JWT→PostgREST→auth.uid, direct Data API/Storage checks, signing/rotation, authoritative email-confirmation source if required and capability revocation are pending. Flag false.

### 17. Android navigation and application readiness — PARTIAL

- **Frontend / history:** M/A; Expo Router, public introduction and clearly labeled preview, library photo picker, SecureStore plugin, drapedrop scheme.
- **Backend / database:** No signed native build or production API/Supabase acceptance. Appversion0.4.1; package/versionCode/signing/EAS/Play setup absent.
- **Test evidence:** 19frontend tests/typecheck/lint, Android/web JS export and prior browser smoke. No mounted native/device acceptance.
- **Missing functionality / integration problem:** Physical device photo picker/Back/relaunch/deep links, accessibility, package/signing/AAB, privacy/Data Safety/deletion and internal testing pending. JS export is not Play readiness.

## Consolidation changes and validation

The main fast-forward imports existing code without rewriting it. Follow-up changes are deliberately bounded:

- Root README/QUICK_START and architecture/mobile/backend/Supabase docs now describe actual Expo/FastAPI/SDK Auth scope instead of claiming all backend is future or all sessions are memory-only. Original PRD/API/security/schema designs and historical audits are not rewritten.
- Preview copy now distinguishes connected account forms from nonpersistent personal/admin previews and identifies local backend0.2.0 rather than old0.1.0. No business data or success response is supplied.
- Backend CI installs PostgreSQL tools and executes the existing dedicated runner after ordinary tests, closing the “green CI with SQL tests skipped” verification gap. No new database service or privileged runtime client is introduced. Remote Actions execution remains unverified until separately approved push.
- Ignore rules cover signing credential JSON, .jks/.keystore/.p12 and nested mobile/build/coverage outputs. No existing user files are removed or secrets rewritten.
- Version ledger identifies the committed Auth preview and consolidation line without creating a new tag or changing app/backend versions.

Files changed by this follow-up: .github/workflows/backend-checks.yml, .gitignore, README.md, QUICK_START.md, docs/architecture.md, docs/VERSIONS.md, docs/WORKFLOW_STATUS.md, mobile/README.md, mobile/src/app/preview.tsx, backend/README.md, supabase/README.md. The two excluded untracked reports remain untouched. Existing backend/frontend domain implementation, locked dependencies,35API contracts, migration, policies and real env values are preserved.

### Actual test execution on main

- `cd mobile && npm test` —19passed,0failed,0skipped (9Auth SDK/helper/storage +10workflow/transport/draft cases).
- `npm run typecheck` and `npm run lint` —exit0. Node module-type warnings remain; final export also warns that FORCE_COLOR overrides NO_COLOR. Laptop Node25 is outside configured Node24; supported-toolchain clean-install acceptance is pending.
- `backend/.venv/bin/python -m pytest -q backend/tests` —47passed,0failed,35skipped because no disposable socket supplied; Starlette httpx TestClient deprecation warning.
- `backend/.venv/bin/python backend/tests/database/run_local.py` —35passed,0failed,0skipped. The same35initially skipped cases were actually run, not converted to successes by omission. Fresh Unix-socket-only PG15 cluster; test Auth/Storage interfaces then actual migration; cluster stopped/removed.
- `backend/.venv/bin/python -m compileall -q backend/app` —exit0.
- From mobile, with EXPO_PUBLIC_API_URL/EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY unset and EXPO_NO_DOTENV=1: `npx expo export --platform android --max-workers 2 --output-dir /tmp/dd-main-consolidation-android` and corresponding `--platform web --output-dir /tmp/dd-main-consolidation-web` —exit0.Final exports:1253Android modules/888web modules. Outputs outside repository; these tests intentionally omit project configuration, so they do not exercise live Auth.
- `git diff --check` —exit0. Updated CI YAML parsed successfully with the dedicated SQL runner/tool PATH step present; all expanded credential/generated-file ignore probes passed. Local Markdown links resolved. SHA-256 checks confirmed the two excluded reports, private env files, migration, approved API/security/schema documents and dependency files unchanged. Typecheck/lint and both exports were repeated after the preview-copy update; no further runtime source changes followed.

Totals:101unique repository cases passed (19+47+35),0failed; broad invocation's35database skips disclosed and executed separately. No new business implementation tests are invented because absent routes/tables remain absent. Existing SDK tests intercept HTTP; API tests intercept upstream requests; SQL tests use real PostgreSQL with test-only interfaces. None establishes hosted security or signed-in E2E.

**Hosted Supabase checks not executed:** actual account signup/email/callback, managed JWT gateway/identity, profile/settings through PostgREST, disabled/deleting direct API and real Storage objects/capabilities. No appropriate designated account/approved remote foundation installation exists for this milestone. No hosted migration or settings write performed.

**Device/native checks not executed:** physical Android photo picker/Back/SecureStore/relaunch/deep links, native compile, signedAAB/internal testing/Play publication. No suitable device/release setup provided. AndroidJS export is recorded separately.

## Incomplete work and safety stop

The requested “functional application” acceptance cannot safely be marked complete.31contract routes are missing from FastAPI, the real project has not accepted the foundation, and already-approved security architecture leaves measurement, mixed-source references, private image capabilities, job/save expiry and cleanup semantics unresolved. Implementing those by guessing would change reviewed requirements; applying the hosted foundation without approval is explicitly forbidden. ML is explicitly out of scope. No fake result or old local demo is substituted to hide these gaps.

No merge conflict occurred; no source was silently chosen over conflicting edits. There is no further branch containing a production backend that can be merged to solve missing implementations. The remaining work is feature implementation and external acceptance, not a Git merge problem. Source consolidation can stay on main while these gates remain BLOCKED/PARTIAL.

## Next milestones and acceptance criteria

1. **Review source consolidation:** verify main includes bbccff9 and all ten incorporated commits, excluded reports unchanged, legacy branches/tags retained and bounded follow-up diff/tests accepted. No automatic push/tag.
2. **Approve hosted foundation integration separately:** review exact development project/reference and unchanged migration SHA; managedPG17 privileges, api-only exposure/grants/trusted bootstrap and recovery plan. Only after approval apply remotely; inspect actual history/schema/grants. Keep flagfalse until required A/B/admin/active/disabled/deleting/directDataAPI/Storage matrix passes.
3. **Accept Auth/profile/preferences end-to-end:** exact callbacks/templates/email delivery, authoritative confirmation rule, designated accounts; real login/latest-refreshed-token→FastAPI→profile/settings persistence and native restart/logout switching. No success claim based on mocks.
4. **Resolve domain decisions before new business migrations:** measurement/units, imagevalidation/private delivery/retention, mixed-source outfit representation and deletion references; preserve35contract inventory until an adaptation is explicitly approved. Then body/wardrobe/catalog and outfit aggregates, each tested against real storage/ownership constraints.
5. **Define remaining service lifecycles:** recommendations/save expiry/idempotency and try-on submission/status/history/cleanup, without starting ML in consolidation. Full account deletion needs trusted purge/Auth/Storage reconciliation. These are NOT IMPLEMENTED beyond current UI/local controls.
6. **Release only after real workflow acceptance:** CIremote run, supported Node24 install, device/accessibility/native build, package/signing/deep links, privacy/DataSafety/deletion/internal testing. No Play readiness inferred from exports.
