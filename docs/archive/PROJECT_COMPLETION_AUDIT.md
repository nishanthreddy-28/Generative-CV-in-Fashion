# Drape & Drop project completion audit

2026-11-09, Asia/Kolkata. Read-only audit of the non-ML application on `main` at `557b6aa59ea99de4565f3b4a779acd00158dede7` and its working tree. This report supersedes the previous snapshot. Its earlier version remains in Git history.

## Overall completion

The non-ML application is implemented substantially beyond the public site. The branch contains the customer and admin Expo screens, 43 FastAPI route handlers, 15 application migrations, and cleanup workers. The current working tree also has proof-first registration, an updated phone layout and revised eligibility checks. An isolated local Supabase stack previously exercised real signup, email proofs through a local inbox, customer sign-in and several authenticated reads. Production currently exposes a public review website. There is no hosted application schema or Storage bucket, and no complete hosted customer workflow has been verified.

Statuses apply to the specific boundary in each item. **COMPLETE** means implemented and verified there. **PARTIAL** means implementation exists with remaining work. **BROKEN** means the stated behavior fails or source shows a reproducible failure path. **UNVERIFIED** means evidence is insufficient. **BLOCKED** requires an external dependency or approval. **NOT STARTED** means no meaningful implementation. **DEFERRED** applies only to Phase 2 ML.

## 1. Frontend

- **PARTIAL — Landing and mobile layout.** The deployed phone-width layout was verified previously in Chrome. The working tree now puts account actions before the campaign image. Current local and deployed pages serve HTML. Visual review of the new working-tree layout is outstanding. See [landing](../../mobile/src/app/index.tsx) and [shared route shell](../../mobile/src/app/_layout.tsx).
- **PARTIAL — Signup, sign-in and verification.** Expo screens connect to the proof-first coordinator and Supabase. Local API and mailbox verification passed in the prior implementation run. Current local routes load. Full browser interaction and hosted sign-in remain open. See [Auth screen](../../mobile/src/features/AuthScreen.tsx) and verification screen (historical source; removed from the current app).
- **PARTIAL — Password recovery.** Forgot-password, callback, password update and return-to-sign-in are wired. Real mail, recovery template, password policy parity and installed native callback are unverified. See [reset screen](../../mobile/src/app/reset-password.tsx).
- **PARTIAL — Dashboard and navigation.** Customer, admin and deletion-progress route boundaries are defined. Local authenticated dashboard read passed. Signed-in browser navigation and failure-state acceptance remain open. See [dashboard](../../mobile/src/app/dashboard.tsx) and [navigation](../../mobile/src/features/navigation.ts).
- **PARTIAL — Profile, preferences and body measurements.** Forms use the corresponding APIs, including sparse updates in the working tree. Local profile read and local contract/database checks exist. Signed-in browser save, reload and product decisions on units remain open.
- **PARTIAL — Wardrobe and photos.** Real authenticated endpoints back listing, detail, filters and form actions. Local authenticated list read passed. Real browser photo selection, upload, replacement and cleanup remain unverified against the full stack.
- **PARTIAL — Outfit management.** Creation, edit, filtering, pagination, item replacement and deletion are wired. Outfit metadata still sends merged displayed values instead of only edited fields, which can overwrite newer edits from another tab. See [outfit editor](../../mobile/src/app/outfits/[id].tsx).
- **PARTIAL — Recommendations.** Deterministic generation, explanations, saves, availability and conversion to outfit are wired. Real browser generation and persistence have not been accepted.
- **PARTIAL — Admin UI and permissions.** Catalog management pages require the backend role projection. A normal customer projection was exercised locally. An actual trusted admin session and catalog write through the browser remain open.
- **PARTIAL — Loading, empty, validation, error and success states.** Shared screens and resource hooks implement them. No fresh browser acceptance across every state. Draft-driven unload warnings also apply to some non-edit list state.
- **PARTIAL — Frontend-to-backend integration.** App clients use current JWTs. Local production-style routes and CORS previously passed. Production runs in review mode, and browser testing of connected customer writes remains open.

## 2. Authentication and security

- **COMPLETE — Proof-first signup and login, local boundary.** A fresh attempt creates only a challenge. The real local Supabase run created the demo account after both proofs and authenticated it with its password. That run exercised HTTP and the local mailbox. Hosted registration is separately blocked below.
- **COMPLETE — Independent link and code proof, local boundary.** The local run rejected a code without its link and refused finalization with the link alone. SQL tests cover wrong bindings, expiration and attempts. See [registration coordinator](../../backend/registration/main.py) and [protocol SQL](../workflows/sql/WORKFLOW_01_REGISTRATION_PROTOCOL.sql).
- **PARTIAL — Expiry, resend, duplicates and concurrency.** Disposable SQL tests passed. Actual local concurrent verified attempts produced one account. The losing attempt returned a transient 503 then 409 on retry. A lost resend response can strand the previous binding because the old row's binding is cleared before delivery is confirmed. A fresh signup can recover within rate limits.
- **COMPLETE — Secure activation, local boundary.** Real Auth creation and receipt activation ran together. PostgreSQL tests deny early activation and reject stale, mismatched or user-editable proof claims. Deployment depends on managed Auth privilege changes.
- **BROKEN — Hosted rollout using the current migration role.** A fresh read-only query found that hosted `postgres` has no `auth` schema USAGE grant option and is not a member of either managed owner role. `auth.users` has RLS. The current package needs a supported way to supply the scoped policy and effective helper access. This is a privilege prerequisite confirmed from metadata, not a trial migration.
- **PARTIAL — Browser sessions and logout.** Native session storage and refresh are wired. Browser tokens are intentionally memory-only, so reload ends sign-in. Logout clears the client session and calls the SDK. FastAPI checks bearer validity and account eligibility, with no immediate per-session revocation check. Test residual valid bearer handling and define the expected revocation window. See [browser storage](../../mobile/src/services/auth/webStorage.ts) and [JWT verifier](../../backend/app/security.py).
- **PARTIAL — Customer isolation and administrator authorization.** User-scoped RPCs, forced app RLS, composite relationships and trusted admin membership have local regression coverage. No hosted A/B exercise, admin write test or private byte delivery test.
- **PARTIAL — Password recovery and change policy.** Reset and settings use SDK password update. They do not run the coordinator's pinned breach corpus. Provider enforcement and real recovery delivery are unverified. Review consistent policy across signup, reset and change.
- **PARTIAL — Google readiness.** A PKCE adapter and callback exist. The hosted public Auth settings returned Google disabled. Provider credentials, callbacks and identity linking have no acceptance evidence.

## 3. Backend

- **COMPLETE — Local API architecture and endpoint inventory.** 43 decorated business route handlers in the FastAPI modules, separate from health, documentation and six registration POST handlers. Local API and request-validation regression evidence exists. This item covers implementation structure.
- **PARTIAL — Authentication dependencies and authorization.** Asymmetric JWKS, issuer/audience/expiry checks, current JWT forwarding and fail-closed eligibility are implemented. Local test and real customer read evidence exists. Hosted security acceptance is pending.
- **PARTIAL — Profile, settings and body APIs.** GET/PATCH on /profile, /settings and /profile/body, with partial-write and database validation. Complete signed-in persistence and units acceptance.
- **PARTIAL — Wardrobe, outfits and recommendations APIs.** CRUD, cursor lists, item ownership, deterministic rules and bookmark/conversion paths have local tests. Exercise hosted persistence through the actual UI.
- **PARTIAL — Catalog/admin APIs.** Shared authenticated reads and trusted admin mutations, with deactivation and private bytes. Verify actual hosted memberships and A/B access.
- **PARTIAL — Image upload, access and deletion.** Image decoding and normalized private upload with scoped paths, retrieval and cleanup exist. Storage worker and private access need hosted verification.
- **PARTIAL — Validation, error handling and logging.** Bounded registration inputs, redacted credential validation, safe HTTP errors and disabled deployment access logs are present. Hosted monitoring, mail delivery failures, proxy handling and dependency alerts need verification.

## 4. Database and Storage

- **BLOCKED — Hosted Auth configuration.** A fresh public settings request showed direct signup enabled, auto-confirm disabled and Google disabled. App registration remains closed on the hosted review site. The direct Auth path can bypass the proof-first coordinator and reserve an address if someone submits signup there. It does not currently grant application access. Shut or control that path as part of a reviewed rollout, and decide how existing Auth identities will be handled. Previously reported localhost site URL and empty callback allowlist were not reverified in this pass.
- **PARTIAL — Application schemas, indexes and constraints.** Fifteen migration files and two review-only proof-first SQL drafts cover the local model. Disposable PostgreSQL and actual local Supabase exercised the schema. Hosted metadata returned zero application tables in api/app_private and zero application roles.
- **BLOCKED — Hosted migration history and configuration.** The hosted history relation is absent. No live entry for the foundation or later migrations was observed. Do not infer deployment from Git. Verify schema exposure, exact file hashes and operator privileges before approved apply.
- **PARTIAL — RLS and ownership.** Locally tested ownership and forced application RLS. Managed Auth RLS required the additional scoped policy. Hosted grants and Storage policies are uninstalled. See [ownership matrix](../workflows/WORKFLOW_01_RLS_MATRIX.md) and [current approval package](../workflows/WORKFLOW_01_MIGRATION_APPROVAL.md#local-protocol-candidate).
- **PARTIAL — Private Storage.** The SQL defines wardrobe-images, catalog-images and tryon-inputs with private paths. Hosted inspection found zero buckets and zero Storage policies. Test real bytes, direct cross-user denial and cleanup after approved deployment.
- **BLOCKED — Existing customer data preservation.** Current aggregate query found two hosted Auth users, both confirmed. The draft denies normal application eligibility without a receipt. Decide onboarding or recovery for these accounts without fabricating receipts. The audit read no personal identity fields.
- **BLOCKED — Backup and recovery.** The previous backup inspection found no verified usable restore point. A fresh private backup and recovery rehearsal are still required before hosted writes.
- **COMPLETE — Local versus hosted drift identified.** Local Supabase accepted the workflow after scoped grants. Hosted PostgreSQL 17.11 has managed Auth with RLS, no app objects or buckets, and no standard migration-history relation. These are fresh metadata observations.

## 5. End-to-end customer workflows

These statuses cover the full customer interaction, persistent data and hosted acceptance.

- **PARTIAL — Registration and verification.** Real local coordinator, Mailpit, Auth, database receipt and retry were exercised. Browser step-by-step review and real delivery are open.
- **PARTIAL — Login, logout and recovery.** Real local demo login and signed-in reads passed in the previous run. No fresh session was created during this read-only audit. Real recovery delivery, logout/revocation acceptance and refresh persistence remain open.
- **PARTIAL — Profile and body management.** Local authenticated profile read and API/SQL write coverage. No fresh browser edit or persisted hosted read-back.
- **PARTIAL — Wardrobe management.** Real local list read and automated CRUD/ownership coverage. Full uploaded-photo round trip with an authorized customer is still open.
- **PARTIAL — Outfit management.** Local backend/SQL coverage. Browser-created outfits and persistent hosted reads are unverified. Fix stale metadata writes.
- **PARTIAL — Recommendations.** Local deterministic generation and ownership/persistence tests. No signed-in hosted creation or save acceptance.
- **PARTIAL — Admin operations.** Local authorization and mutation tests. Actual admin browser workflow is unverified.
- **PARTIAL — Account deletion and cleanup.** Deny-first state, progress API, queue, leases and cleanup exist. No real hosted deletion or proof of Auth, rows and objects being cleaned through the full scheduled workflow.

## 6. Background processing

- **PARTIAL — Job infrastructure.** Try-on submission, queued state, cancellation, history, expiry and consent evidence exist. Actual inference is Phase 2. The current UI can collect a private photo for a job that cannot produce a result. Decide whether to hide submission for the non-ML release.
- **PARTIAL — Cleanup workers.** Account deletion and image reconciliation have local code/tests. The isolated registration expiry command also exists.
- **NOT STARTED — Hosted worker deployment and scheduling.** The Render blueprint defines the web service only. No worker scheduler or operational evidence was found.
- **PARTIAL — Retry and failure handling.** Leases, durable metadata and failure returns exist. Hosted retries, idempotency, throughput, alerting and interrupted runs need tests.
- **PARTIAL — Expired verification cleanup.** The sweep clears expired pending link/code hashes and old rate windows. It does not prune locked, superseded or aged finalizing rows and retains email/session metadata. Define retention and scrub/delete incomplete records on an approved schedule.
- **PARTIAL — Temporary images and account cleanup.** The workers handle eligible objects and Auth removal separately from ordinary user requests. Real hosted scheduling, storage authorization and deletion completion remain open.

## 7. Deployment and infrastructure

- **COMPLETE — Public review website availability.** Vercel production returned 200 for home, sign-in SPA routing and all three first-party entry scripts. The current proof-first/UI changes are outside that published commit.
- **PARTIAL — Render API.** Deployment exists. The initial health and protected API probes timed out. A bounded retry returned 200 on /healthz and 401 on signed-out /profile. The cause of the initial timeouts is unverified. Connected customer data remains unavailable.
- **BLOCKED — Supabase hosted deployment.** No app schema, buckets, required grants or customer acceptance. Exact hosted approval and a verified recovery artifact are outstanding.
- **PARTIAL — Environment and secret handling.** Templates separate publishable and privileged credentials. Ordinary user calls never use the registration/worker key. Production coordinator secrets, corpus, SMTP and scheduler credentials need private setup and review. Ignored environment values were not printed.
- **PARTIAL — CORS and callback configuration.** Render allowed the production web origin with 200 and rejected an unapproved origin with 400. SDK callback paths exist. Hosted callback/template review and connected testing are outstanding.
- **PARTIAL — Preview and production separation.** Vercel Preview redirected to authentication (302). Public production serves review mode. No authenticated Preview or connected Production verification.
- **PARTIAL — Health, logs and reliability.** /healthz is liveness. No evidence of a hosted readiness check covering Auth, data or Storage, or worker alerting. Render logs and dashboard settings were not inspected.
- **PARTIAL — Git checkpoint.** Live GitHub main matches local HEAD `557b6aa`. The proof-first Auth, local preview, UI and worker updates are uncommitted. Earlier feature tags are historical. Review intended paths before a separately authorized checkpoint.

## 8. Android readiness

- **COMPLETE — Local Expo configuration and export.** Package `com.drapedrop.app`, version 0.4.1, scheme `drapedrop`, internal APK and production AAB profiles are present. Android JavaScript/Hermes export passed in the preceding run.
- **BLOCKED — Connected production configuration.** The app needs approved HTTPS API/Auth/registration URLs and a working hosted schema.
- **PARTIAL — Auth callbacks and secure session storage.** Deep-link paths, SDK and SecureStore are wired. Proof-first registration and recovery on an installed release are unverified.
- **PARTIAL — Permissions and identity.** Photo picker and permission removal rules exist. Inspect the final merged release manifest and verify the package with the signing owner.
- **BLOCKED — Signing and physical-device acceptance.** No verified signed APK/AAB or physical device run. Check installed navigation, Back, refresh, callback, picker and private images.
- **BLOCKED — Play submission.** Review signing, testing tracks, listing and data safety. The current privacy route redirects to home, so the release policy and deletion instructions still need an approved public page. See [Android preparation](../ANDROID_INTERNAL_TESTING.md).

## 9. Testing and evidence

- **COMPLETE — Local suites, prior checkpoint.** Logs show 406 backend tests passed (database cases skipped in the ordinary invocation), 315 in the dedicated disposable PostgreSQL runner (307 original plus eight registration), and 78 frontend tests. No suite was rerun in this audit. These include Auth/JWT, role/owner boundaries, database RLS and Storage-policy cases.
- **COMPLETE — Local static checks and builds, prior checkpoint.** Typecheck, lint, Python compilation, review web build and Android JavaScript export passed. No installed/signed Android artifact.
- **PARTIAL — Runtime smoke.** Fresh HTTP checks returned 200 for local login at 8081 and 8082, signup at 8082, FastAPI health at 8003 and the local inbox. A GET to the POST-only registration route returned 405, confirming reachability. The earlier local run verified real credentials, dashboard/profile/wardrobe reads and the duplicate race. No user was created or modified during the audit.
- **BLOCKED — Fresh browser visual and signed-in UI testing.** Browser control returned disabled in Work settings. HTML and bundle responses do not establish interaction or visual acceptance.
- **BLOCKED — Real email and hosted-account workflow acceptance.** Mailpit is a local test inbox. Hosted mail delivery, callbacks, verified accounts, and actual customer CRUD are outstanding.

## 10. Phase 2

- **DEFERRED — Image classification and ML recommendations.**
- **DEFERRED — MediaPipe measurement inference.** Manual measurements are part of the current app.
- **DEFERRED — Virtual try-on inference and image generation.** Existing non-ML job infrastructure is documented above.

## Critical gaps and execution order

1. **Hosted migration authority and signup entry point.** Confirm a supported least-privilege way to install the Auth helper and scoped policy, or revise the model. Hosted direct signup is still open and can reintroduce address reservation outside the coordinator. Review closing that route, existing-user eligibility, backup/recovery and the exact migration package together. Keep hosted activation gated.
2. **Registration abuse and failure recovery.** A public caller can consume the five-per-hour email budget for another address. Review proof-of-human/abuse controls and trusted proxy rate keys. Fix durable resend recovery and retention. The local adapter also treats SMTP delivery failure as an accepted attempt, so delivery monitoring matters.
3. **Deploy and verify hosted Auth and data.** After approval, apply the exact reviewed package and configure private buckets, callbacks, templates and a verified sender. Test both independent proofs, concurrency, A/B isolation, disabled/deleting accounts, real private bytes and trusted admin operations before enabling the flag.
4. **Complete connected workflow acceptance.** Fix outfit stale writes, implement approved persistent browser sessions, verify logout/recovery policy and run the real owner account through the main customer workflows. Validate loading/error states visually.
5. **Operate cleanup and ship Android.** Schedule and observe cleanup with retries, publish approved privacy/deletion information, then sign and test an internal Android build. Keep ML deferred.

Implemented but undeployed work includes proof-first registration and managed Auth eligibility, the new landing/sign-in UI, and working-tree editor and cleanup corrections. The main branch already contains the business handlers and migrations, but a pushed file does not provision the hosted database. Deployed surfaces with unverified functionality include Render's connected customer routes, the authenticated Preview site and Supabase's real mail/callback behavior.

**Highest-priority next task:** validate a supported, least-privilege hosted Auth eligibility design that works without assuming managed-owner access. The current hosted role evidence makes this the dependency that must be resolved before the rest of the rollout.

Only this audit document was updated. No application source, migration, hosted configuration, deployment, data, feature flag or Git history changed.

## Follow-up visual QA and local access

- **PARTIAL — Sign-in and shared forms.** The supplied screenshot showed a separate password visibility row, vertically spaced account links, and an editorial crop that removed the face. The visibility control now sits inside the field. The account links share a wrapping row. The image uses its portrait proportions in a compact editorial panel. The shared input changes also apply to signup, verification password entry, recovery and customer editors.
- **COMPLETE — Local HTTP and account smoke checks.** The stopped loopback registration process was restarted with its existing configuration. A fresh disposable signup passed both independent mailbox proofs and completed. The existing demo login succeeded. Signed-in dashboard, profile, body profile, wardrobe, outfit and recommendation reads returned 200. Admin catalog returned 403 for that member. Expo served all ten checked route URLs with HTTP 200. SPA responses do not establish browser navigation or screen rendering.
- **BLOCKED — Mobile and desktop screenshot matrix and click-through.** The in-app browser tool returned “Local browser use is disabled in Work settings.” The supplied screenshot was reviewed. No new browser screenshots or authenticated UI interactions were captured. There was no authorized admin account available for visual QA. The member denial was verified by API.
- **PARTIAL — Social sign-in.** The current Google implementation requires provider and callback setup. Apple is not implemented. Sign-in copy now states availability without presenting inactive providers as usable controls. This QA pass changed neither provider configuration nor authentication logic.
- **COMPLETE — Frontend checks for this follow-up.** 78 tests passed. Typecheck, lint and production review-mode web export passed. The remaining visual work is to inspect every major screen at mobile and desktop widths, including account forms, signed-in navigation and the trusted admin workspace.
