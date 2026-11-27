# Hosted readiness execution checklist

Started 2026-11-09 on main at 557b6aa. This checklist tracks implementation and evidence; a local pass is not hosted acceptance. Preserve the existing uncommitted Workflow 01 review package. No hosted writes or feature-flag changes are authorized before exact-package approval.

## Work order

- [x] Inspect current Git state, existing application/Auth/Storage architecture, fifteen migrations, deployment configuration and the Workflow 01 drafts.
- [x] Recheck live aggregate history, application schemas, Auth user count and bucket count. Full private Auth and backup configuration are still pending.
- [x] Implement a disabled local candidate with independent proofs, durable throttles, expiry, resend and trusted finalization. Proof-first account creation replaces the abandoned-attempt reservation path.
- [x] Test local provisioning, receipt-based Data API/Storage denial, frontend admission, concurrency and replay. Hosted acceptance remains open.
- [x] Connect the inbox steps, resend, account-access messages and verification progress restoration behind a disabled rollout setting. The phone shell and Google gate remain in place.
- [x] Send only edited fields from the shared editor so saving one field preserves other server values. Keep existing visual design.
- [ ] Implement persistent browser sign-in after review of server-side sessions, cookie/CSRF controls and refresh revocation. Browser sign-in remains memory-only. Registration progress uses the original tab.
- [x] Exercise the existing private image authorization regression suite locally. Report per-object cleanup failures to the scheduler and leave work pending for retry.
- [x] Record exact draft SQL/hashes, the proposed Auth/Storage settings, existing-user effects and the recovery prerequisite. The package is marked hold for production pending the listed risks.
- [x] Run backend, disposable PostgreSQL, frontend, typecheck/lint, web and Android-export checks.
- [x] Verify local Expo route and bundle, local API protection, and public Vercel/Render health and CORS through HTTP.
- [ ] Visually exercise the updated flows in Chrome. Computer use reported disabled in Work settings during this pass.
- [x] Prepare disabled coordinator settings and a bounded expiry command. Existing signed Android and worker runbooks remain the deployment handoff. Actual scheduler and signing acceptance are pending.

## Approval and external gates

- BLOCKED: hosted schema/Auth/Storage writes and foundation activation require approval of the final exact package.
- BLOCKED: verified hosted recovery artifact/restore point and existing-account eligibility treatment need owner review.
- [x] Remove pre-verification email reservation. Temporary attempts do not create Auth identities, and confirmation and activation commit together.
- BLOCKED: sender/delivery configuration and narrowly isolated registration/finalizer credentials must be configured privately after approval.
- BLOCKED: real test-account creation and email/password/OTP entry belong to the owner after hosted setup acceptance.
- BLOCKED: signed-in hosted workflow, user A/B, administrator, Storage-byte and cleanup acceptance depend on that setup.
- BLOCKED: physical Android tests have no available device; signing/build service access remains a separate requirement.
- DEFERRED: Google activation and ML/inference/image generation.

## Evidence log

Update completed checks with actual commands/counts and dates below. Do not mark blocked items complete from mocks, local schema files or HTTP liveness alone.

### Runtime and hosting evidence

- Local Expo returned 200 for /verify-registration and its JavaScript bundle contained the new inbox screen. Local FastAPI /healthz returned 200 and signed-out /profile returned 401. Existing review servers were left running.
- Vercel returned 200 for home, login, the wardrobe deep link and all three first-party entry scripts. Render returned 200 for /healthz and 401 for signed-out /profile. Production-origin CORS returned 200 with the matching origin. An unapproved origin returned 400 with no matching header.
- Supabase read-only aggregate inspection showed zero application tables in api/app_private, no migration history relation, zero Storage buckets and two confirmed Auth users. No hosted writes, user changes or feature-flag changes occurred.
- Review [the exact local SQL and rollout blockers](workflows/WORKFLOW_01_MIGRATION_APPROVAL.md#local-protocol-candidate). A real test account, live mail, hosted isolation, workers and Android device tests remain pending.

### Local test evidence

- Backend pytest passed 405 tests. Its 315 database cases were skipped there and passed in the disposable PostgreSQL runner (307 existing cases and eight registration cases).
- The database tests found an intermittent registration issue caused by reading the clock separately for issue time and expiry. One timestamp now defines both, and proof expiry is measured after acquiring the row lock. The final disposable suite passed.
- Frontend passed 77 tests, plus typecheck and lint. The production-mode review web build and Android JavaScript export passed. A signed Android build and physical-device run remain pending.
- Python compilation and dependency consistency checks passed. Git diff whitespace check passed. No checkpoint commit or deployment was created for this working tree.

### Proof-first registration and local demo

- [x] A fresh attempt and resend create no Auth identity. Auth creates the user after both proofs and binds the receipt and activation in the same transaction.
- [x] Ran the actual local Supabase services and Mailpit with published ports bound to loopback. Exercised an abandoned attempt, code without a link, link without a code, finalization retry, signed-in customer APIs, duplicate protection and a race between two distinct verified attempts. The losing race returned a transient 503 and then 409 on retry.
- [x] The local Expo preview at http://localhost:8082 serves the revised landing, sign-in, signup and inbox pages. Signup is enabled only in this isolated preview. New test messages are captured at http://127.0.0.1:54324. Use a disposable email address there. Production registration remains closed.
- [x] Moved the primary landing actions ahead of the campaign image and sign-in inputs ahead of decorative content. Kept the existing phone-width shell. Verified served routes and bundle. Visual browser control remained disabled.
- [ ] Confirm the supported hosted role can grant the required Auth helper usage and install the own-row eligibility policy. This was necessary on actual local Supabase because auth.users RLS hid the email confirmation from the executor.
- [ ] Rehearse private backup and restore, resolve treatment of the existing accounts, and get exact hosted approval before applying the new package. Hosted data, settings, migrations and flags were untouched.

Proof-first checks passed with 406 backend tests, 307 existing PostgreSQL tests and eight registration PostgreSQL tests. The backend runner skips socket-dependent cases, which the dedicated runner executes. The 78 frontend tests, typecheck, lint, review web build, Python compilation and Android JavaScript export passed. Both local APIs and the Expo preview remain running. The demo account was created through the real local registration flow and has no seeded wardrobe records.
