# Remaining non-ML implementation — master checklist

Started 2026-11-09 on main. This is the single execution checklist; local verification never implies hosted/device acceptance.

- [x] 1 Account deletion/privacy (local implementation verified; hosted worker execution pending): fresh authentication, deny-first lifecycle, durable cleanup queue, scoped trusted worker, frontend/progress and tests.
- [x] 2 Dashboard (local): owner-only real counts, UI refresh/empty/error and tests.
- [x] 3 Profile/settings/body (local): sparse updates/clearing, bootstrap behavior, auth/ownership and refresh regression.
- [x] 4 API gaps (local implementation; Google provider acceptance pending): whole-outfit delete, supported password change, contract consistency; preserve completed features.
- [x] 5 Images (local; hosted scheduler/retention approval pending): interrupted upload reconciliation, try-on retention defaults, safe retryable private cleanup; integrate account deletion.
- [ ] 6 Hosted acceptance BLOCKED: local schema exposure preparation and exact migration/hash handoff complete. Initial history GET failed before HTTP status; a CA-store diagnostic justified one verified-TLS attempt, which reached HTTP 401. Stopped on authentication rejection; no remote writes. Accepted access/approval still required.
- [x] 7 Local security acceptance: Auth/JWT, concurrency/identity, RLS/Storage model and account-denial regressions pass. Hosted Auth/Data API/Storage acceptance remains unverified.
- [ ] 8 Hosted/device E2E BLOCKED: local backend, SDK contract and PostgreSQL workflow regressions pass. No claim of signed-in hosted or physical-device E2E.
- [ ] 9 Visual runtime BLOCKED: actual API/Expo startup, HTTP routes, web bundle compilation and auth/CORS gates verified. Browser use is disabled in Work settings; visual navigation/state checks remain pending. Task servers remain running for user review.
- [ ] 10 Signed Android/device acceptance BLOCKED: package/versionCode, preview APK/production AAB profiles, release URL guards, permission introspection and Hermes export prepared. Expo account/signing and a device are unavailable; local Java 11/no SDK cannot produce an installable build.
- [x] 11 Local quality gate: backend/SQL/frontend tests, typecheck/lint/compile/export, dependency checks, secret review and GitHub milestones. This does not waive the blocked hosted/visual/device acceptance above.

## External boundaries

Hosted database/settings mutations and feature-flag enablement require a concrete reviewed plan and explicit approval. No hosted writes are authorized by this checklist. Physical Android testing and signed builds require a device/build/signing setup. Privileged cleanup credentials belong only to a separate trusted worker, never the frontend or ordinary API fallback.

## Milestone 1 evidence

Deny-first deletion API, progress UI and separate trusted cleanup worker implemented. New account API/worker tests: 7 passed; full disposable SQL/RLS suite: 300 passed. Hosted worker configuration/execution is pending explicit approval. Password reauthentication/change is wired to actual Supabase Auth; provider-only reauthentication remains dependent on provider setup.

## Milestone 2 evidence

Dashboard real owner aggregates, sparse profile/preferences PATCH with explicit clearing, trusted Auth provisioning/backfill, whole-outfit delete, idempotent recommendation-to-outfit conversion and Google PKCE flow are implemented locally. SQL regression: 304 passed. Focused foundation/outfit/dashboard HTTP checks: 100 passed. Frontend: 58 passed; typecheck/lint passed. Google provider/callback configuration and actual OAuth sign-in remain hosted acceptance tasks, not claimed complete. Web session tokens remain memory-only; only a PKCE verifier survives a same-tab redirect.

## Milestone 3 evidence

Trusted image reconciliation, interrupted-upload retirement, 24-hour queued-input expiration, preserved consent/submission evidence and retryable Storage cleanup implemented. Dedicated worker tests: 2 passed; complete disposable PostgreSQL suite: 307 passed. Real service_role wrapper authorization is exercised locally; hosted key/worker/scheduler remain unconfigured. No privileged fallback was added to ordinary API operations.

## Final local verification and handoff

Backend: 397 passed. The generic run skipped 307 database tests because no test socket was configured; the dedicated fresh-cluster run executed all 307 successfully. Frontend final SDK/workflow suite: 60 tests; typecheck/lint, Python compilation and Android Hermes export pass. Full npm audit (including dev tools) reports zero advisories after narrow glob/minimatch overrides; pip check reports no dependency conflicts (not a Python vulnerability scan). No credentials or generated output are tracked.

Runtime: FastAPI started on 127.0.0.1:8019; Expo on localhost:8099. OpenAPI and HTML/bundle responses returned 200. Nine protected API paths returned 401 without credentials; approved web preflight returned 200 and an unapproved origin 400. Browser use is disabled in Work settings; no visual or installed-device test is claimed. No fake signed-in data was supplied to bypass missing hosted acceptance.

See [hosted handoff](backend/hosted-integration-handoff.md), [Android internal testing](ANDROID_INTERNAL_TESTING.md) and [worker operations](backend/account-deletion-worker.md). Next action is privately restoring accepted Management API read access (verified TLS now reaches HTTP 401), then read-only hosted migration/configuration inspection, followed by review of the exact SQL plan before requesting hosted writes. Measurement/unit product decisions remain unresolved. All local implementations stay versioned on main; no ML or inference was added.

Accepted deletion also clears local personal/photo drafts, hides normal protected screens and invalidates normal in-flight request results. Only exact GET /account/deletion remains allowed in that session; SDK sign-out remains available. Server lifecycle/RLS enforcement remains authoritative. This local cache safeguard has no hosted dependency.

## Personal website review gate — 2026-11-09

Current instruction overrides the earlier server shutdown procedure: leave both review servers running and wait for user feedback. Do not resume UI redesign, hosted mutation/acceptance, Android release or final completion until the user approves the website.

- Website: http://localhost:8081; customer sign-in: http://localhost:8081/login. The previous preview navigator has now been removed.
- FastAPI: http://localhost:8000; OpenAPI/docs available. Frontend API origin matches this process. CORS explicitly allows localhost:8081 and 127.0.0.1:8081 for this session only.
- Local launch uses existing private .env configuration and Node 24. No secret values were exposed or copied; DATABASE_FOUNDATION_ENABLED remains false.
- HTTP verification: website routes and actual compiled JS bundle returned 200; protected API routes returned 401 without credentials; review-origin CORS preflight returned 200. Browser automation remains disabled in Work settings, so visual navigation, responsive layouts and browser console checks have not been verified.
- Read-only public Supabase Auth settings returned 200: email provider enabled, signup enabled, Google provider disabled. No user login/signup or hosted data mutation was performed. Actual email/callback/session acceptance remains pending.
- User may review frontend navigation/forms/validation and signed-out gates through /preview, and attempt real email/password login with an existing confirmed account. Preview does not load or save personal records. Live wardrobe/outfit/recommendation/job persistence remains gated until separately approved hosted acceptance and flag enablement.
- Servers were intentionally left running for personal review. Waiting for feedback; no final acceptance claimed.

## Customer app feedback implementation — 2026-11-09

User requested a real customer experience, route locks and removal of frontend workflow review. Implemented root session/admin/deleting route guards, removed /preview and all public review links, disabled query-based preview unlocking, added signed-in app navigation and a real-data dashboard layout. Google button stays hidden until its provider/callback acceptance and explicit UI availability configuration. No data or authentication bypass was added to make screens appear populated.

Current review supersedes the earlier /preview instructions: signed-out users see welcome/auth; signed-in users see their app; ordinary users cannot navigate into admin screens. Backend application operations remain fail-closed with DATABASE_FOUNDATION_ENABLED=false. See frontend/customer-experience.md for the checkpoint. Both development servers stay running; further website approval is pending. Hosted changes and final acceptance remain separate approval boundaries.
