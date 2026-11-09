# Remaining non-ML implementation — master checklist

Started 2026-11-09 on main. This is the single execution checklist; local verification never implies hosted/device acceptance.

- [x] 1 Account deletion/privacy (local implementation verified; hosted worker execution pending): fresh authentication, deny-first lifecycle, durable cleanup queue, scoped trusted worker, frontend/progress and tests.
- [x] 2 Dashboard (local): owner-only real counts, UI refresh/empty/error and tests.
- [x] 3 Profile/settings/body (local): sparse updates/clearing, bootstrap behavior, auth/ownership and refresh regression.
- [x] 4 API gaps (local implementation; Google provider acceptance pending): whole-outfit delete, supported password change, contract consistency; preserve completed features.
- [ ] 5 Images: interrupted upload reconciliation, try-on retention defaults, safe retryable private cleanup; integrate account deletion.
- [ ] 6 Hosted: local migration/release preparation; actual hosted reads only when authorized access is available; no writes/flag enablement without explicit approval.
- [ ] 7 Security: local Auth/JWT, identity/RLS/Storage tests; hosted acceptance separately pending.
- [ ] 8 E2E: locally available workflow regression; record unavailable real Supabase/device dependencies.
- [ ] 9 Runtime: start API/Expo, browser smoke/navigation and auth gates; inspect logs and stop task servers.
- [ ] 10 Android: package/versionCode, internal-build configuration, permissions/deep links/export; signing/build/device/Play steps separately evidenced.
- [ ] 11 Final gate: backend/SQL/frontend tests, typecheck/lint/compile/export, available dependency checks, secret review and GitHub checkpoints.

## External boundaries

Hosted database/settings mutations and feature-flag enablement require a concrete reviewed plan and explicit approval. No hosted writes are authorized by this checklist. Physical Android testing and signed builds require a device/build/signing setup. Privileged cleanup credentials belong only to a separate trusted worker, never the frontend or ordinary API fallback.

## Milestone 1 evidence

Deny-first deletion API, progress UI and separate trusted cleanup worker implemented. New account API/worker tests: 7 passed; full disposable SQL/RLS suite: 300 passed. Hosted worker configuration/execution is pending explicit approval. Password reauthentication/change is wired to actual Supabase Auth; provider-only reauthentication remains dependent on provider setup.

## Milestone 2 evidence

Dashboard real owner aggregates, sparse profile/preferences PATCH with explicit clearing, trusted Auth provisioning/backfill, whole-outfit delete, idempotent recommendation-to-outfit conversion and Google PKCE flow are implemented locally. SQL regression: 304 passed. Focused foundation/outfit/dashboard HTTP checks: 100 passed. Frontend: 58 passed; typecheck/lint passed. Google provider/callback configuration and actual OAuth sign-in remain hosted acceptance tasks, not claimed complete. Web session tokens remain memory-only; only a PKCE verifier survives a same-tab redirect.
