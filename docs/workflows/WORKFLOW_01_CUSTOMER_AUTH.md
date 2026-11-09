# Workflow 01 — Customer authentication

Updated 2026-11-09, Asia/Kolkata. Started from main at 751c2aa. This workflow is partial and requires security review before activation.

## Implemented locally

Registration asks for email, password and confirmation. Name is no longer mandatory. Both password fields retain visibility controls. Live feedback covers eight characters, uppercase, lowercase, number, special character, recognizable common patterns and available email/name fragments. Confirmation feedback updates while typing. Rule feedback never embeds the password. This small local pattern filter cannot certify that a password has never been compromised.

Registration submission is deliberately disabled in the screen and guarded in its submit handler until the required dual-proof service is available. Existing login, recovery, isolated email callbacks, refresh, logout, native SecureStore and latest-token forwarding remain in place. Recovery is accessible to signed-in customers as well as guests. Production stays in the previously authorized review mode. Google remains hidden until provider/callback acceptance.

## Verified Supabase limitation

Supabase documents its six-digit Token as an alternative to ConfirmationURL, and TokenHash as the hash of the same Token. Redeeming these twice cannot establish two independent proofs. The current auth-confirm route is a legacy single-proof confirmation flow, and is insufficient for the requested registration acceptance. It must be replaced as part of the approved dual-proof implementation. Both new proofs would demonstrate access to one mailbox, so this requirement is not a second authentication factor. [Email template variables](https://supabase.com/docs/guides/auth/auth-email-templates)

The Send Email hook receives the Auth user and email action/token data and can replace SMTP delivery. Signature verification and replay handling are required. Neither hook configuration nor availability on the current account has been verified. Supabase leaked-password protection requires Pro or above, so a free deployment needs a separately approved breach corpus or screening service. [Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Password security](https://supabase.com/docs/guides/auth/password-security)

## Proposed dual-proof architecture — approval required

1. Keep Supabase as the credential authority. Confirm-email must be enabled before accepting registration. A trusted, signature-verified Send Email hook creates the challenge for the actual Auth user/email/action. Client-supplied user IDs and metadata cannot establish ownership or a verified state.
2. Generate an independent random link secret and six-digit OTP with a cryptographically secure generator. Store the link digest and an HMAC of OTP plus attempt identity using a private server pepper. A bare hash of six digits is vulnerable to offline enumeration. Never expose the underlying Supabase confirmation token in the email or client.
3. Persist the minimal challenge in an unexposed trusted schema. Conceptual attributes are attempt ID, Auth UUID, normalized address fingerprint, link digest, OTP MAC, expiry, attempts, link-proof timestamp, consumption/supersession state, dispatch state and finalization state. Store the Supabase confirmation token encrypted with a separately managed key if deferred redemption needs it. Keep plaintext OTP and link secret transient through delivery. Client roles receive no table grants.
4. Send one transactional email containing the independent link and OTP. Bind both to the same attempt and original registration session. A separate high-entropy registration capability must be established before dispatch and stored securely. Review cross-device handoff before implementation. Never bind solely to an email address, editable metadata, or sequential ID.
5. Use one database transaction with row locking for each proof, failed-attempt increment, expiry check and resend. Propose a 60-second resend cooldown, five attempts per challenge and durable address/session/network limits. These rate-limit thresholds require review. Resend supersedes the old challenge atomically. Expiry is ten minutes.
6. Link GET displays the confirmation screen without consuming a proof, because mail scanners follow links. An explicit POST validates the link secret and session binding. OTP verification requires six digits, the same attempt/capability, an unexpired successful link proof and remaining attempts. Constant-time MAC comparison, one-use transition and replay rejection are required.
7. Only after both proofs succeed may a narrow trusted finalizer redeem the retained Supabase confirmation token. Preserve Auth session semantics, discard any hook/finalizer session, and require normal password sign-in afterward. Model finalization as retryable because Auth HTTP and PostgreSQL cannot commit atomically. Persist both-proof success before contacting Auth. Handle crash, timeout, resend race and already-redeemed tokens without granting application eligibility from client state.
8. Add a trusted dual-verification eligibility check covering FastAPI, direct Data API and Storage. Decide how pre-existing verified accounts and verified Google identities are treated before enabling it. A callback URL or client boolean cannot authorize application access.
9. Keep ordinary user data calls scoped to the user's verified JWT. A hook/finalizer needs its own narrowly scoped credentials and role. Privileged credentials must stay separate from ordinary APIs and frontend values.

This changes the existing single-confirmation architecture. Exact migration SQL depends on verified hosted schema, grants, trigger inventory and the reviewed finalization capability. No executable migration has been added on assumptions.

## Proposed endpoints — not implemented

These extend the Auth workflow and require approval against the preserved API inventory.

- POST /auth/registration/start initiates a Supabase signup and binds the registration session. Request contains email/password and no ownership fields. It must enforce the password policy and breach screening server-side and redact validation bodies and logs. Generic accepted response carries only an opaque attempt capability or equivalent secure binding. Password handling remains transient and is forwarded only to Supabase.
- POST /auth/registration/email-hook is a signature-verified, replay-protected Auth hook endpoint. It sends the dual-proof email and returns the provider's required hook response. It accepts no public account-creation authority.
- POST /auth/registration/link accepts the opaque attempt, original-session capability and link secret. Success records link proof without authenticating.
- POST /auth/registration/verify accepts attempt, capability and OTP. Success records both proofs and starts or completes trusted finalization.
- POST /auth/registration/resend accepts the attempt capability and creates a replacement challenge with a generic delivery response.
- GET /auth/registration/status returns minimal proof/finalization status only to the bound attempt holder.

Use generic invalid/expired proof errors, HTTP 429 with Retry-After for limits, and HTTP 503 for dependency failures. Never include tokens, submitted passwords, OTPs, email addresses or internal exceptions in responses or telemetry. Do not automatically retry signup, resend or finalization from the browser.

## Google and session requirements

Existing Google PKCE code validates the Supabase destination, callback flow and verifier slot. Provider enablement and real callback/account-linking acceptance remain pending. Delegate identity linking to Supabase's supported verified-identity behavior. Never merge application owners from client email equality. Verify existing password account, existing Google identity, cancellation, duplicate signup, unverified matching email and failed callback with authorized accounts. [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)

Web tokens currently live in memory and a full page reload ends the session. Native sessions use SecureStore. Persistent web login requires a separate reviewed session design, such as an HttpOnly-cookie backend-for-frontend with CSRF protection. Persistent web sessions are not implemented by saving bearer tokens to localStorage.

## Hosted inspection and approval boundary

The latest authorized read-only migration-history attempt returned HTTP 401. Failed access does not establish an empty database. Browser control subsequently reported disabled in Work settings. Hosted Auth settings, templates, confirmation expiry, SMTP sender, Google configuration, callbacks, actual grants and existing customer compatibility remain unknown.

Before approval, restore accepted read access and inspect migrations, Auth settings, schema, constraints, policies, grants, buckets and backups. Compare the fifteen local migration versions and hashes in the [hosted handoff](../backend/hosted-integration-handoff.md). Review the proposed challenge schema, least-privilege hook/finalizer grants, dual-verification eligibility, existing-account treatment, mail delivery provider, breach-screening source, rate limits, retention and rollback plan. Then prepare the exact additive SQL and dashboard changes for explicit approval.

Do not enable DATABASE_FOUNDATION_ENABLED before hosted acceptance. Keep ordinary backend SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY separate from any future hook signing secret, HMAC pepper, encryption key or trusted finalizer credential. Proposed secret names and provider-specific configuration will be finalized with the approved implementation.

## Acceptance and deployment status

Frontend policy regression tests exercise character classes, common patterns, repetition, identity fragments and secret-free feedback. Existing SDK tests cover mocked signup/login, invalid credentials, unconfirmed email, refresh, secure storage, recovery and OAuth contracts. They do not establish real delivery, hosted persistence, Google linking or dual-proof correctness.

Required acceptance still includes valid/invalid/expired/replayed proofs, resend invalidation, mixed registration sessions, concurrent finalization, rate limits, hook signature/replay, mail scanner safety, mail-provider failures and account eligibility on every access path. Add real PostgreSQL race tests and hosted authorized A/B tests when the approved implementation is available.

The previously verified Production frontend is https://drape-drop-eta.vercel.app/ and API is https://drape-drop-api.onrender.com/docs. Production review mode disables account actions. Current browser verification is blocked by Work settings. Workflow 01 is not complete. Its completion tag must only identify the accepted implementation after dual verification, real email, Google and session acceptance. Workflow 02 remains pending review.

### Local checkpoint evidence

The final frontend run passed 71 tests, including four new password/navigation regressions. Typecheck and lint passed. The backend regression run passed 397 and skipped the 307 socket-dependent database tests. The dedicated disposable PostgreSQL run passed all 307 tests. Android Hermes export and the review web build passed. Local website and backend docs both returned HTTP 200. Browser testing, real emails and real Google sign-in remain unverified for this checkpoint.


The repeat inspection after the reported access restoration still returned Management API HTTP 401. Browser inventory still reported “Local browser use is disabled in Work settings” and returned no available browsers. No further authentication retries were made. The separate public Auth settings GET succeeded with HTTP 200 and reported disable_signup=false, mailer_autoconfirm=false and Google=false. This verifies only those public capabilities. It does not expose migration history, SMTP, templates, callback allowlists, hooks or project permissions.
