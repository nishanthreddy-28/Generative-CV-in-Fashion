# Workflow 01 — Migration and authentication approval review

Prepared 2026-11-09T14:36:15+05:30, Asia/Kolkata, on main after ce4e7e4. Preparation only.

## Approval recommendation

**Hold hosted execution and application activation.** The fifteen existing migrations were successfully applied and security-tested locally. They support the current application, but they do not enforce independent link-and-OTP registration. The new registration storage draft is separately validated and intentionally grants no runtime access. It does not implement proof-validation RPCs, a finalizer or an eligibility gate. A verified hosted recovery point is also missing.

This package is ready for architecture review. It is not a recommendation to apply all SQL or enable authentication/data actions. Release approval must wait for the remaining coordinator/gate implementation and hosted acceptance. No hosted writes were performed.

## Independent hosted inspection

The restored Supabase CLI 3.0.0 session accessed drape-drop-dev / xpqhqhpqzkjaycraukrj after SUPABASE_ACCESS_TOKEN was removed only from each subprocess environment. Hosted reads used --read-only, and config preview reported wrote=false. Personal Auth records, password hashes, identities, tokens and SMTP/OAuth secrets were not retrieved.

The project is hosted PostgreSQL 17.11. Reinspection returned zero application tables, columns, constraints and indexes in public/api/app_private, zero dd_* roles, zero Auth provisioning triggers and zero application/Storage policies. api and app_private and the standard migration-history relation are absent. Storage has zero buckets. Auth still has two users, both email-confirmed. These aggregate checks match the recovery report. No customer identity or account state was altered.

The recovered schema list and extension inventory match [access recovery](../archive/backend/access-recovery.md). Application functions and trusted executor roles do not yet exist. public.rls_auto_enable is the existing public function. Managed Storage tables have RLS enabled but not forced. Managed schema owners and default role memberships must be preserved.

There is no standard history record for version 202611060001 or any other local version. Foundation objects are also absent. This verifies current state, rather than proving that no manual SQL ever ran historically. There are no remote-only, duplicate or mismatched rows to enumerate because the history relation does not exist.

## Current Auth configuration and differences

The configuration comparison was independently repeated from a temporary local directory with deliberately different, non-secret OTP/password comparison values. No repository config or hosted setting was written.

- Hosted site URL is http://localhost:3000. Additional redirect URLs are empty.
- Email confirmation is enabled.
- Email OTP length is eight, and OTP expiry is 3600 seconds.
- Email resend minimum frequency is one minute.
- Minimum password length is six. Password character requirements are unset.
- Hosted API exposure is public and graphql_public. Local source additionally declares api.
- An independent public Auth read confirmed email signup enabled, email auto-confirm disabled and Google disabled. The public JWKS endpoint returned ES256 signing keys. Real Google login has not been performed.
- Custom SMTP sender readiness, delivery credentials, current template bodies, hook setup and Google client/consent configuration remain unverified. They require an authorized dashboard inspection. Browser access is still disabled in Work settings.

The recovery report was accurate about missing application objects and callbacks. One clarification is required for bucket collisions. All three bucket migrations include an explicit DO-block compatibility check after ON CONFLICT DO NOTHING. They fail if an existing bucket is public or has incompatible MIME/size settings. They do not silently accept an incompatible bucket.

## Minimum schema required by the existing code

Supabase Auth UUID remains the sole customer identity. Profile/body/preferences are one-to-one records. Wardrobe garments and images belong to that UUID. Outfits use owner-matching parent/item FKs and reference actual wardrobe/catalog garments. Recommendation requests/results/bookmarks retain owner and provenance. Try-on jobs retain input references and consent. Lifecycle, trusted membership, tombstones and deletion tasks support access denial and cleanup.

All eighteen existing tables have current backend or frontend callers. They are not proposed future features. Foundation alone does not satisfy the running frontend. Sign-in projects catalog access through /admin/catalog/access, and dashboard aggregates depend on wardrobe, outfits, recommendations/bookmarks and try-on tables. The current full application therefore uses the fifteen-file sequence below. A standalone registration service can be developed separately, while business operations stay gated.

Source reviewed includes backend/app/security.py, dependencies.py, data_api.py, foundation.py and the body/wardrobe/catalog/outfit/recommendation/job/account/dashboard modules, mobile domain/API/Auth contracts, session.tsx, navigation and all fifteen SQL files. No application endpoint contract was changed.

Key conclusions follow.

- JWT verification fixes issuer/audience/asymmetric algorithms and checks expiry/role. UserDataAPI constructs each request with the verified subject's current JWT, explicitly disables credential fallback, and avoids shared authorization headers.
- Normal clients receive API RPC execution, not direct app_private table access. SECURITY DEFINER functions run as non-bypass roles with empty search_path, column grants and forced RLS.
- Normal administrator status comes from trusted administrator_memberships and an eligibility check, not editable metadata or a client role.
- Owner columns are immutable to user mutation grants. Composite FKs and source checks reject cross-owner children and garment references.
- Nullable measurement fields are supported. Units are required whenever measurements exist. Existing bounds are 1–300 and four decimal places. These are current code constraints, not a newly resolved unit/product policy.
- Profile bootstrap permits an empty name, preserving the revised registration screen's lack of a mandatory name. Later profile editors still require a meaningful name when submitted.
- Tombstones and deletion tasks deliberately retain minimal subject evidence without a live Auth FK. They are trusted system records.
- Recommendation items include bounded JSON snapshots. They lack per-item FKs, so read/save/source revalidation is essential. Existing SQL does that revalidation.
- Account deletion is a queued operational workflow. Defining its SQL does not run the Storage/Auth deletion worker or certify actual cleanup.

## Exact application migration SQL and hashes

The linked files are the exact SQL under review. Existing migrations were not edited or rewritten. Apply-once migration tracking is intentional. Blanket IF NOT EXISTS would hide drift. Bootstrap and duplicate bookmark operations are idempotent where the application requires retries.

- [202611060001_foundation.sql](../../supabase/migrations/202611060001_foundation.sql) — Foundation roles, profile/body/preferences, lifecycle, tombstones, trusted membership and account eligibility.
  SHA-256 `3accf159b38649e14f5abcf2e74ac6d6bd52e85a9a72a0d70f0b85744efad10e`.
- [202611080001_body_profile_api.sql](../../supabase/migrations/202611080001_body_profile_api.sql) — Body read and partial-update RPCs with numeric precision and unit-change validation.
  SHA-256 `b315e47a4a8f8511a4fd2319e72b366a07e2255313c41c154b5f4ae65ef2e642`.
- [202611080002_wardrobe.sql](../../supabase/migrations/202611080002_wardrobe.sql) — Wardrobe/image metadata, private wardrobe bucket, owner constraints and upload/CRUD RPCs.
  SHA-256 `e69a9c2f7f8a44a1bd7804b3b6b1eb1f0f047fad7b2c5ae6bb7730e44e938058`.
- [202611080003_catalog.sql](../../supabase/migrations/202611080003_catalog.sql) — Catalog/image metadata, private catalog bucket, trusted administrator mutations and shared authenticated reads.
  SHA-256 `fb8e22cce1728566d24c543b5505b916a19dd4d091a4c3a5be32c027cd399abd`.
- [202611080004_outfits.sql](../../supabase/migrations/202611080004_outfits.sql) — Owner-scoped outfits and typed wardrobe/catalog references with composite ownership FKs.
  SHA-256 `90e47938cd3f632d89c5b73304c238da5c71a9cc8bd12afca1a3b655084a285c`.
- [202611080005_outfit_editing.sql](../../supabase/migrations/202611080005_outfit_editing.sql) — Outfit metadata/item mutation RPCs and atomic replacement.
  SHA-256 `d642c31c57133e153d42392eaaf6b5cb606eb38b132191ea2d6df7ded1712b31`.
- [202611080006_outfit_filtering.sql](../../supabase/migrations/202611080006_outfit_filtering.sql) — Outfit keyset filtering/pagination and ordering indexes.
  SHA-256 `84bf8fcb16ca9aef55f2e436388552cbcaa0038e75d2bc81dedd4b6726316b0b`.
- [202611080007_recommendations.sql](../../supabase/migrations/202611080007_recommendations.sql) — Bounded deterministic recommendation requests/results, snapshots and source revalidation.
  SHA-256 `2fe96dfa0c81a37dfc9a52a94d3ff78643a97e6ae05c9297f8a792f915bb72fb`.
- [202611090001_saved_recommendations.sql](../../supabase/migrations/202611090001_saved_recommendations.sql) — Owner bookmarks, uniqueness, availability-aware reads and pagination.
  SHA-256 `de904f53ed3efff3f214e01652b03e37061d5809137fef5b8d6814814990502d`.
- [202611090002_tryon_jobs.sql](../../supabase/migrations/202611090002_tryon_jobs.sql) — Private try-on input metadata, job/consent lifecycle, history and cancellation.
  SHA-256 `4766aa97821b4e65520d86dd91c3fae19e1595a3a7d7e3d58482ffa8e6ad1c27`.
- [202611090003_account_deletion.sql](../../supabase/migrations/202611090003_account_deletion.sql) — Account-deletion task queue, leases, tombstones, cleanup RPCs and deferred input FK replacement.
  SHA-256 `08a639b17d3b8078be992cca116db3e95fdc3ff55a4a3ebb7fc07bcbc6ee2d7d`.
- [202611090004_dashboard.sql](../../supabase/migrations/202611090004_dashboard.sql) — Owner-scoped dashboard aggregates.
  SHA-256 `fe71e621dee9c7518883b2ea2828b0823424b72e4351cec8d9e4214db6056c34`.
- [202611090005_profile_integration.sql](../../supabase/migrations/202611090005_profile_integration.sql) — Sparse profile/preferences updates, Auth signup trigger and existing-user backfill.
  SHA-256 `005fe4e4f2c0a6fc76e3a624ac4c46a46e7503b8cfb3a54a78d52da37bf04e65`.
- [202611090006_outfit_gaps.sql](../../supabase/migrations/202611090006_outfit_gaps.sql) — Outfit deletion and recommendation-to-outfit conversion.
  SHA-256 `c5ec202aee56f58c05d900ddacdc6220cdaa284e1446a0c30a21f39bd11d6e34`.
- [202611090007_image_retention.sql](../../supabase/migrations/202611090007_image_retention.sql) — Image reconciliation, queued-input expiry, bounded cleanup RPCs and retention indexes.
  SHA-256 `60723986f9a6e4d2d7dbc2e585bdfd36e84ba98a09bc0db3ddf61e4bec704d55`.

Review every file before executing. The sequence creates roles, schemas, tables, constraints, indexes, API functions and policies. It also adds private buckets, Auth provisioning/backfill, worker entry points and schema-cache notifications. These are substantial security changes, not a metadata-only deployment.

The actual non-additive DDL is in 202611090003_account_deletion.sql. It drops the existing try-on input FK and recreates it as deferred NO ACTION within the same transaction. This preserves rows and supports coordinated cleanup, but must be explicitly included in approval. DELETE statements elsewhere are function bodies for authorized future operations. The migration sequence does not immediately invoke those user-data deletion functions. The Auth backfill does execute immediately.

No same-name application table/schema/role collision was found in the inspected namespaces. Recheck immediately before any approved apply because hosted state can change.

## RLS matrix and integrity review

The complete per-table SELECT/INSERT/UPDATE/DELETE matrix, role ACLs and exact update-column lists are in [table access review](WORKFLOW_01_RLS_MATRIX.md). It covers all eighteen existing tables plus the registration draft.

Local metadata inspection verified forced RLS on all eighteen tables, 132 functions with no anonymous execution, and empty search_path on all definer functions. Customer and administrator table access is denied directly. Approved RPCs apply ownership, lifecycle and trusted catalog membership. Service-role bypass does not supply table grants. Trusted maintenance uses narrowly named entry points and separate secrets.

The existing 307 SQL tests include A/B isolation, missing/unauthenticated subjects, owner overrides, invalid references, RLS and column grants, administrator elevation prevention, lifecycle denial and concurrency. Those tests use local Auth/Storage interfaces. Hosted JWT propagation, gateway roles, actual Storage bytes and Google identity linking remain required acceptance.

## Registration draft SQL and its boundary

The exact proposed storage-only SQL is [registration storage draft](sql/WORKFLOW_01_REGISTRATION_STORAGE.sql).

SHA-256 `2ccbaef09d919cef75274f14fa6371921957237a1907c3caf25a307030756b27`.

It creates three justified objects in app_private.

- registration_challenges binds an Auth UUID, email MAC, original-session hash, independent link digest, OTP HMAC, ten-minute expiry, attempt count, proof timestamps and finalization state. A partial unique index permits one pending/finalizing attempt per UUID.
- registration_receipts retains a minimal successful dual-email record and same-owner composite challenge reference. The deferred FK permits coordinated Auth cascades.
- registration_rate_windows persists keyed counters across instances/restarts using HMAC address/session/network keys. It is trusted operational data and does not create a new customer identity.

All three have forced RLS and revoked direct client/service-role grants. No permissive policy, trusted executor or API wrapper is installed. The tables are inert until a separate reviewed implementation adds atomic proof/resend/rate-limit operations and receipt eligibility. Expiry constraints validate structure. They do not enforce request-time expiration or rate limits without that protocol.

The composite receipt FK intentionally retains its challenge evidence. The completed state permits proof hashes to be scrubbed, while retaining identifiers and proof timestamps. Retention and archival must be approved, and no cleanup grant is supplied by this draft.

The draft stays outside supabase/migrations. It cannot be included accidentally in the ordinary migration runner. After the trusted protocol is completed, review it again, assign a new additive version and hash the final SQL. Do not mark the draft applied or treat its successful local syntax check as completed registration.

## Independent dual-email verification design

Supabase's built-in confirmation URL and email OTP represent the same token. The custom flow needs independent secrets and an application eligibility gate. The proposed coordinator continues to delegate credentials and sessions to Supabase Auth.

1. A backend registration endpoint validates input and password policy and rate-limits the request. Supabase alone stores credentials. Backend password handling is transient and redacted. Comprehensive compromised-password checking needs a selected corpus/service or approved provider feature. The local UI's small pattern filter is insufficient.
2. Allocate a random attempt capability and an original-session binding before dispatch. A signature-verified Auth email hook binds the actual Auth UUID/email/action to that server-created attempt. Public callers cannot establish this binding by submitting a UUID or editable metadata. The protocol must reject unrelated direct Auth signups and hook replays, and serialize same-email retries. This correlation must be implemented/tested before activation.
3. Generate the independent link secret with at least 256 bits and the six-digit OTP with a cryptographically secure generator. Store SHA-256 link/capability digests and an HMAC of attempt UUID, exact email binding and OTP under a server-only pepper. A plain hash of six digits permits offline enumeration. Use constant-time proof comparison. Send only the independent link and OTP in one email, never the underlying Supabase confirmation token.
4. Use row locks plus atomic counters across proof verification and resend. Proposed thresholds are a one-minute resend cooldown and five wrong attempts per challenge, plus durable address/session/network budgets. Expiry is ten minutes. Account-owner review must finalize aggregate budgets, retention, network-key privacy and cross-device behavior.
5. Mail-scanner GET requests display a page and never consume a proof. An explicit link POST validates the same attempt and original-session binding. OTP POST requires that link proof, a matching unexpired attempt and remaining attempts. One correct proof alone grants nothing. Invalid/expired/replayed requests return generic errors. Resend supersedes pending challenges transactionally and never resets aggregate rate limits.
6. When both proofs succeed, persist finalizing with both proof timestamps in the same transaction. Expiry applies when accepting proofs. A bounded finalization retry may continue after proof expiry only for that already-proven attempt. Resend must reject a finalizing/complete attempt, so it cannot invalidate an in-flight authoritative confirmation.
7. Recommended finalization uses a separate trusted Auth administrative process to confirm the exact Auth UUID after re-reading its authoritative email/identity and matching the bound attempt. This avoids storing a redeemable Supabase token, but introduces a powerful Auth admin capability that needs explicit approval, isolation and audit. Ordinary FastAPI user operations keep their publishable-key/current-JWT architecture.
8. Persist the receipt only after authoritative Auth confirmation is observed. Auth HTTP and database transactions are not atomic. A crash before Auth confirmation leaves finalizing denied. A crash after Auth confirmation but before the receipt also leaves application access denied. An idempotent finalizer re-reads the exact user and finishes the same attempt. Account deletion/disable/email change must win or invalidate finalization without reactivation.
9. The final receipt check must be added to current_account_active, require_active_account, API account_access and Storage access paths, with live lifecycle locking and authoritative confirmation evidence. DATABASE_FOUNDATION_ENABLED only gates FastAPI. It cannot protect direct Data API or Storage paths by itself.
10. Supabase may issue an authenticated token after confirmation. That token still grants no application eligibility without the trusted receipt. Discard any server-side transient session and require ordinary sign-in. Refresh remains Supabase's responsibility.

### Important incompatibility with the existing foundation

bootstrap_user currently inserts state active, and the Auth trigger/backfill invokes it. Neither eligibility function currently requires the independent dual-verification receipt or authoritative email-confirmation status. Applying the fifteen migrations and exposing api/Storage therefore cannot satisfy Workflow 01 merely by leaving the FastAPI feature flag false. Direct managed-service paths require the gate too.

Do not silently grandfather the two confirmed Auth users, or mark Google accounts as having passed dual-email verification. Their UUIDs and identities must be preserved. Decide whether they must perform the new challenge or receive an explicitly approved alternate eligibility method before implementing activation SQL.

The earlier design proposed encrypting and later redeeming the original Supabase token. That remains an alternative, with token expiry/redeem-race and key-management costs. The recommended trusted Admin API finalizer is a proposal, not a change to approved architecture. Neither finalizer nor activation SQL is included in this package. Full Workflow 01 execution remains on hold until this decision and its implementation are reviewed.

## Google OAuth and sessions

Existing frontend PKCE code restricts the destination to the configured Supabase Auth origin, binds sb_flow_id to the verifier slot, and handles failure/cancellation through error paths. The UI stays hidden until the provider is configured and a real callback is accepted.

After approval, the owner must configure a Google OAuth Web client with Supabase redirect URI https://xpqhqhpqzkjaycraukrj.supabase.co/auth/v1/callback and store its secret privately in the Supabase Google provider. The web return target is the approved frontend /oauth-callback, including the SDK's flow-id query matching. Choose a stable Preview origin instead of a blanket wildcard. Native drapedrop callbacks need separate installed-device testing.

Use Supabase's supported verified-identity linking. Never merge application UUIDs because a client supplies the same email. Acceptance must cover verified password-to-Google, existing Google-to-password, unverified matching-email, duplicate signup, cancelled OAuth and failed callback. New Google identities need an explicitly reviewed eligibility method before application access.

Native sessions use SecureStore. Web tokens currently live in memory and a reload ends the session. Durable web sessions require a separately reviewed design, such as an HttpOnly-cookie BFF with CSRF protection. A persistent web sign-in claim would currently be inaccurate.

## Email, callbacks and password settings requiring review

Before changing production Auth, review the following exact targets.

- Site URL https://drape-drop-eta.vercel.app.
- Exact allowed web paths /auth-confirm, /reset-password and /oauth-callback on that origin. Review per-flow query matching and the corresponding drapedrop native callbacks.
- A stable authorized Preview origin and its exact callback paths.
- Server-enforced minimum eight characters and required character classes, identity/predictability checks and comprehensive breach screening. Current hosted minimum is six.
- The custom independent OTP is six digits with ten-minute expiry. Changing the built-in Auth OTP to six digits alone does not implement independent verification.
- A verified mail sender and reviewed delivery provider. A Send Email hook replaces SMTP delivery for its Auth actions. It must preserve recovery/email-change flows, verify signatures and replay windows, redact logs, and handle partial delivery and provider failures without issuing a second independent active challenge.
- Template copy must describe both independent steps, scanner-safe link handling, expiry and resend semantics. Password recovery must retain its own Supabase security semantics.

SMTP/templates, provider secrets and dashboard settings have not been changed. Exact provider-specific credentials and a sender domain belong to the owner. Real email delivery must be verified with authorized test accounts after approval.

## Private Storage review

The existing application requires exactly wardrobe-images, catalog-images and tryon-inputs. All are private, JPEG-only and limited to 10 MiB. Wardrobe and try-on object paths use the authenticated UUID and generated image UUID. Catalog objects use catalog/image-UUID.jpg.

The backend decodes supported JPEG/PNG/WebP input, rejects unsupported/animated or decompression-risk images, bounds bytes and dimensions, normalizes orientation, converts RGB and writes fresh JPEG data. Metadata includes size and SHA-256. Accepted garments reference an attached image, while interrupted uploads remain pending for reconciliation.

The application retrieves authenticated bytes through FastAPI using the current user's token and rechecks metadata/ownership. It does not currently depend on public URLs or signed URLs. A future signed URL would be a bearer capability until expiry and must not substitute for account-denial requirements.

Storage policies allow own metadata-bound inserts/reads/deletes, forbid overwrites, and apply restrictive active-account gates. Catalog writes additionally require trusted membership. RLS and bucket settings must both pass hosted HTTP acceptance. The restrictive account gate may affect other buckets added later, so re-inventory before applying.

Deletion and retention workers are separate trusted processes. They delete physical objects before acknowledging metadata cleanup. Queued input retention defaults to 24 hours, and pending upload reconciliation defaults to one hour. These values require product approval. Cleanup is bounded and retryable, but hosted scheduling, monitoring and failure drills remain pending. The image worker currently reports only completed count and can exit successfully after per-object Storage failures. Operational failure visibility needs review before enabling a scheduler.

## Backup, existing users and recovery

An independent backup metadata read succeeded, with PITR=false and zero listed backups. This does not certify a usable restore point. No production export was made. The two confirmed Auth users remain present by aggregate inspection.

Before any hosted write, obtain an owner-approved encrypted export/recovery artifact through a trusted supported database connection or approved platform backup. It must cover the existing Auth records and dependencies, relevant schemas/roles and configuration inventory. Keep it outside Git and ordinary logs. Restore rehearsal must verify those exact recovery artifacts privately. Supabase Auth, Storage and external provider settings have separate recovery boundaries.

The local rehearsal used two synthetic pre-existing Auth UUIDs and minimal Auth/Storage test interfaces. All fifteen migrations preserved both UUIDs and created their profiles. pg_dump/pg_restore into a second local database reproduced the users and profiles. Both databases shared a local cluster, so global roles were reused rather than restored from the dump. That proves a local SQL recovery technique, not hosted backup availability or full managed Auth recovery.

Each migration has its own transaction. A failure inside one rolls it back, while earlier committed migrations remain applied. Inspect actual committed versions and objects before a reviewed retry. Do not rerun the complete sequence blindly, repair history, reset the database or automatically run down migrations. A reviewed forward correction is generally preferable. Restoring a backup can discard post-backup writes and needs explicit approval.

Role grants, policies, functions and bucket creation can be changed in a subsequent reviewed migration. Dropping application objects after real customer use could destroy new data. Auth confirmation, delivered emails, consumed proofs and physical image/Auth deletion cannot be undone by rolling back PostgreSQL DDL. Keep registration, API exposure and worker execution gated throughout staging.

## Validation evidence and limits

- Backend regression command from backend was .venv/bin/python -m pytest -q. Result was 397 passed and 307 skipped because no test socket was supplied. The existing Starlette TestClient deprecation warning remained.
- Frontend npm test passed 71. Typecheck and lint passed. No frontend code changed in this preparation.
- Dedicated backend/.venv/bin/python backend/tests/database/run_local.py applied every SQL file and passed 307 tests.
- The new reproducible validator is supabase/verification/validate_workflow01.py. It applied every existing migration, inspected final ACL/RLS/functions, preserved two synthetic identities, rehearsed dump/restore and tested the registration draft's constraints, ownership/grants/RLS and Auth cascade behavior.
- Local PostgreSQL is 15. Hosted PostgreSQL is 17.11. No running local managed Supabase stack was used. Hosted PostgreSQL compatibility, PostgREST, Auth hooks, JWT gateway and Storage HTTP acceptance remain unverified.
- No real verification email, Google login, cross-device challenge or managed Auth finalization occurred. No hosted writes, policy changes, feature-flag changes or completion tag were made.

## Exact approval gates

1. Approve the recovery/export method and privately verify a usable artifact first.
2. Review the fifteen existing SQL hashes, trigger/backfill effects, FK replacement, private buckets and role/grant matrix. Approval must name the project and versions. A dry run and drift recheck precede any later apply.
3. Review the registration storage-only draft separately. It is not in the migration chain and must not be promoted as a complete dual-verification migration.
4. Decide the trusted finalizer, original-session/hook correlation, existing-account and Google eligibility, durable web sessions, aggregate rate limits, retention and mail/breach-screening provider. Complete and validate the corresponding trusted SQL/API protocol and eligibility changes before requesting its execution approval.
5. Separately approve Data API exposure, Auth redirects/password/provider/templates/hook settings, Storage configuration and worker schedules. Current user scopes and privileged service separation must be preserved.
6. Enable DATABASE_FOUNDATION_ENABLED only after actual hosted user A/B, administrator, direct gateway, inactive-account, Storage and cleanup acceptance passes. Workflow 01's completion tag remains pending.

The immediate review decision is on the architecture and recovery safeguards. A blanket production execution approval would be premature.

## Local protocol candidate

**Current design supersedes the earlier storage-only and confirmation proposals.**

The proof-first candidate uses a separate registration coordinator and TLS SMTP. Ordinary FastAPI and Storage requests use the current customer's verified JWT.

### Exact SQL under review

1. Apply the fifteen original migrations in their existing order. Their files and hashes above remain the production review inputs.
2. [Registration storage draft](sql/WORKFLOW_01_REGISTRATION_STORAGE.sql), SHA-256 `fc1523d55e688d40ccdd85c90cd1bb9649266ec01f7448908ac2bb60cae29ccf`.
3. [Registration protocol draft](sql/WORKFLOW_01_REGISTRATION_PROTOCOL.sql), SHA-256 `c57db09b2626977681371eac0f2f6a3e280b370dcf7bd72ac0a19ea4e8e4cbcd`.

Starting registration inserts a time-limited challenge with no Auth UUID. Multiple attempts for the same normalized email can coexist within rate limits. A resend locks and supersedes only the bound attempt. Link and code proofs are independent and expire after ten minutes. After both pass, the browser submits a password and matching confirmation. Passwords are transient and only Supabase Auth stores credentials.

The coordinator calls Auth admin create with a server-owned attempt marker in app metadata. Inside the same Auth creation transaction, the activation trigger locks the attempt, checks the email and proof state, links the new UUID, inserts the receipt, and activates the pending lifecycle row. Ordinary Auth signups and editable metadata cannot issue receipts. A failed transaction rolls back account creation and activation together. Auth email uniqueness selects one winner under concurrent completion. An existing account is never overwritten. A retry after a lost success response reads the committed attempt status.

The two SQL drafts remain outside the hosted migration directory. The registration trigger listens for Auth INSERT and confirmation UPDATE because the current GoTrue admin API confirms the email after inserting the row. The isolated Supabase stack exercised this sequence through real GoTrue. Verify the exact hosted Auth version before rollout.

### Effective managed Auth grants

The real local stack exposed a difference from the PostgreSQL test primitives. Managed Auth has RLS on auth.users. Grants submitted by a role without the Auth schema grant option can also produce warnings without granting access. The protocol now verifies effective auth.uid() access for its required roles and adds a SELECT policy for the non-login dd_control_reader role, restricted to the JWT subject. Column grants limit that role to the three identity fields used by eligibility. The authenticated role receives no Auth table grant. The disposable runner now reproduces managed Auth RLS.

The local schema owner supplied the missing effective privileges and policy. Before hosted approval, determine the supported operator able to grant Auth schema usage and install the scoped policy in the hosted project. Treat missing authority as a blocker. Do not assume the ordinary migration role can make these changes.

### Proposed deployment settings and order

- Recheck live drift immediately before application. Verify a privately stored recovery artifact and its restore procedure. The previously observed backup metadata did not identify a usable restore point. A new read-only aggregate query returned PostgreSQL 17.11, no tracked history relation, no application tables in api/app_private, zero buckets and two confirmed Auth users.
- Use an approved controlled apply window. Keep the coordinator disabled, the customer API flag false, the public site in review mode, and the api schema unexposed until the receipt gate is installed and verified. Freeze new hosted Auth signups before applying foundational provisioning in a separately approved operation. Verify no existing unrelated Storage configuration will be affected. If any SQL fails, stop, identify which transactions committed, and review a forward fix or the approved recovery procedure. Preserve the two existing UUIDs and all Auth data.
- Expose api alongside the managed public and graphql_public schemas after SQL verification. Keep app_private unexposed. Preserve the three private bucket configurations in the reviewed original SQL. Verify actual bucket privacy and A/B object access before release.
- Set the Auth site URL to `https://drape-drop-eta.vercel.app`. The candidate recovery allowlist entries are `https://drape-drop-eta.vercel.app/reset-password`, `http://localhost:8081/reset-password` for approved development, and `drapedrop://reset-password` for the installed client. Add the exact recovery URL of an approved stable Preview alias when known. The registration email uses its own website link and does not require a Supabase Auth confirmation callback. Use the approved Auth recovery template with the recovery token hash and destination. Keep Google disabled. Verify hosted public-signup disablement and continued admin-user creation against an isolated test project before approving that setting combination.
- Configure the separate coordinator from [its private environment template](../../backend/registration/.env.example). It reads a pinned password corpus and requires a fixed Supabase project, approved HTTPS origins, a separate Auth admin key, a random server pepper and an authorized SMTP sender. Its secret grants include Auth admin operations. Isolate it from the existing Render customer API and verify request logging, trusted proxy configuration, timeout and abuse controls. SMTP for registration and Supabase delivery for password recovery require separate acceptance.
- After functional and security acceptance, request separate approval to enable the customer feature flag and deploy connected Vercel settings. The public keys and HTTPS service URLs are the only frontend configuration. Schedule worker jobs separately with explicit approved project binding and secret storage.

### Remaining release risks

- The original reservation bug is addressed in the proof-first candidate. Existing Auth accounts still require the ordinary sign-in or approved recovery path. Before hosted rollout, recheck for any earlier unverified Auth accounts and review how to handle them without replacing credentials or deleting identities. Verify mail rate limits and interrupted resend against the hosted environment. In the real local race, one verified attempt succeeded and the other received a temporary provider error. Retrying the losing attempt returned a duplicate conflict, with the original credentials preserved.
- Review the retention of email addresses and original-session digests in completed/expired records. The implemented bounded expiry job clears stale link/code digests and old rate counters. It does not decide successful proof retention or delete unfinished Auth users.
- Decide how the two legacy confirmed accounts establish eligibility without fabricated receipts. The candidate preserves them but withholds application access. Any migration or customer communication needs explicit approval.
- Browser authentication still uses the existing memory-only session. Persistent browser sign-in needs a reviewed server-side session design and refresh/revocation tests. The registration capability is scoped to the original tab and does survive reload.
- Test a real approved SMTP sender, callback URLs, Auth admin request shapes, verification on Android, signed-in customer isolation, and scheduled cleanup. The local tests use disposable PostgreSQL and controlled Auth/SMTP responses.
