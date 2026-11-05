# Authentication and security architecture

Drape & Drop · November 5, 2026 · **Draft for review; documentation only**

## 1. Status, scope and evidence

**Approved:** React Native/Expo frontend; Supabase Auth owns identity and token issuance; FastAPI owns business validation/authorization; Supabase PostgreSQL and Storage hold application records and images. Option A requires user-scoped access with RLS. FastAPI verifies incoming access JWTs and derives identity from verified claims. Personal data is isolated; authenticated catalog reads are shared; only trusted administrators may mutate catalog data. No service-role credential reaches the frontend.

**Recommended:** the concrete request-scoped Data API mechanism, authoritative administrator membership model, security controls and implementation sequence below. These are proposals to review, not deployed capabilities.

**Unresolved:** project settings, signing algorithm, token lifetimes, mobile recovery flow, storage retention, role provisioning, immediate revocation and the disposition of existing auth contracts. No live Supabase project configuration was inspected.

Repository evidence:

- [API requirements](api-requirements.md) inventories 35 existing method/endpoint contracts. It remains unchanged.
- [Session provider](../../mobile/src/features/session.tsx) currently calls custom `/auth/login` and `/auth/logout`, accepts `{accessToken,user}`, holds tokens only in memory, and clears drafts on expiry/sign-out.
- [Auth services](../../mobile/src/services/api/resources.ts) implement custom signup/reset requests; `/auth/me` is declared but unused.
- [API transport](../../mobile/src/services/api/client.ts) sends bearer access tokens, uses a 20-second deadline, ignores error bodies, and has no refresh/retry integration.
- [Domain types](../../mobile/src/types/domain.ts) contain application role `user | admin`; [settings](../../mobile/src/app/settings.tsx) calls password change and account deletion.
- [Recovery screen](../../mobile/src/app/reset-password.tsx) expects a query `token` sent with a password to FastAPI. [App config](../../mobile/app.json) declares `drapedrop` scheme but no completed auth callback integration.
- Backend contains only empty README/placeholder files; no JWT dependency, database client, schema or RLS exists. No Supabase SDK is currently integrated into the frontend.

This document creates no implementation, migrations, SQL policies, project configuration or fake responses. Logical table names are provisional design labels. Admin workflow details remain for later review.

## 2. Approved trust boundaries

1. Expo authenticates directly with Supabase Auth using the project URL and a publishable (or legacy anon) key. This key identifies the application, not an authenticated person.
2. Auth issues access/refresh tokens. Only the access JWT goes to FastAPI's business endpoints. Passwords and refresh tokens normally stay between the frontend and Auth.
3. FastAPI validates the JWT and creates an immutable request principal from verified claims.
4. A user-scoped repository sends that same JWT to Supabase Data API/Storage. Supabase independently verifies it and establishes the PostgreSQL authenticated role/claims used by RLS.
5. Services validate business rules; RLS and relational constraints independently enforce ownership and reference integrity.
6. Separate, narrowly invoked administrative/background components may use privileged credentials where necessary. They are not the fallback for failed user requests.

**Important:** Supabase JWT `role: authenticated` is a database execution role. It is not Drape & Drop's application administrator role. A publishable key alone is not user context. Verified `sub` is authoritative; client `userId`, headers, profile fields and role values are not.

Supabase documents the distinction between API keys and user authentication. Elevated secret/service-role credentials bypass RLS, so the normal repository must never use them. [API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## A. Authentication lifecycle

### A1. Signup

**Approved responsibility:** Supabase Auth registration. **Recommended flow:** frontend uses the supported Auth signup operation; password policy and rate limits are enforced by Auth. A display name may be submitted as editable profile metadata, never administrator permission. Configure email confirmation explicitly rather than assuming project defaults. If confirmation is required, do not treat a returned user without a session as signed in. Decide whether application profile defaults are created by a carefully scoped trigger or a post-login bootstrap service; a failed bootstrap must not broaden permissions. [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)

### A2. Email verification

Supabase sends the verification email and verifies the link/OTP using its configured flow. The app must handle the chosen allowlisted redirect, complete the supported session establishment/exchange and subscribe to authentication events. Do not trust an `emailVerified` boolean from the client. **Unresolved:** whether FastAPI requires confirmed email in addition to a valid user token. **Requirement if enabled:** obtain confirmation status from an authoritative verified source, such as the Supabase Auth user record returned by a trusted server-side Auth lookup for the verified subject. A custom claim may be used only after its trusted issuance, meaning, freshness and verification are explicitly designed and approved. Neither an arbitrary decoded JWT nor the presence of an email address proves confirmation; do not assume every Supabase access JWT contains an email-verification claim. The exact lookup/claim mechanism, caching and dependency-failure behavior remain unresolved. No custom verification endpoint is approved here.

The existing scheme is only a starting point: choose production app/universal links, development redirects and exact callback paths. Never accept arbitrary return URLs or log link tokens. Prefer a tested PKCE-compatible mobile flow where applicable; the exact email template and exchange must match the selected Supabase flow. [Mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)

### A3. Login

Frontend uses Supabase password sign-in and obtains the Auth session. It passes the current access token to FastAPI, not a client-created identity token. User-facing application role should be loaded from a trusted backend source; editable profile data never controls it. Auth-state events update the frontend session and wipe personal drafts on sign-out/account change. The current custom Session wrapper needs an explicitly approved adapter/migration; it is not Supabase's native session structure.

### A4. Access-token usage

Send `Authorization: Bearer <access JWT>` over HTTPS on business requests. Do not put access/refresh tokens in ordinary URLs, telemetry or image filenames. Supabase Auth, not FastAPI, signs tokens. FastAPI does not mint alternative user tokens or impersonate a body-supplied user ID. Fetch the current token at request time to avoid retaining a stale token after refresh.

### A5. Token refresh and restoration

Supabase Auth handles token refresh; FastAPI business APIs do not receive/store refresh tokens. Recommend one frontend Auth client, serialized refresh through its session management, and foreground/background lifecycle integration. React Native storage must implement a suitable persistence adapter; choose OS-backed protection and test full session size/lifecycle rather than assuming ordinary AsyncStorage is secure. Web preview needs its own storage/XSS analysis. Supabase's React Native guide demonstrates persistence and app-state refresh integration; it does not establish this project's secure-storage choice. [React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native)

Refresh rotation includes reuse protections and documented exceptions; do not build a second independent refresh loop. Session lifetimes and inactivity controls depend on actual project configuration. A network outage should not be confused with a revoked session. After a genuinely expired/invalid session, require sign-in. Decide whether to retry an authenticated read once after refresh; do not blindly replay uploads or mutations after ambiguous completion. [Sessions](https://supabase.com/docs/guides/auth/sessions)

### A6. Password recovery

Frontend requests recovery through Supabase Auth and shows enumeration-safe confirmation. An allowlisted recovery link establishes the appropriate recovery session/code exchange; the app then performs the supported authenticated password update. An arbitrary `?token=` is not sufficient proof. The existing raw token/password FastAPI call must be reconciled before integration. Keep recovery tokens, URL fragments and codes out of logs and analytics. Define expired/reused-link behavior and return-to-login behavior without inventing a second recovery authority. [Password recovery guidance](https://supabase.com/docs/guides/auth/passwords), [Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)

### A7. Password change

Use Supabase Auth's password update flow for a signed-in identity. Required recent sign-in, nonce reauthentication and password policy must match actual Auth settings. The current `{currentPassword,newPassword}` business request cannot be assumed equivalent to Supabase's update operation; discuss whether to remove/migrate it or retain an explicitly justified compatibility operation. Do not route passwords through ordinary business logging. Determine whether other sessions must be revoked after a change; do not promise automatic global logout. [Update user](https://supabase.com/docs/reference/javascript/auth-updateuser)

### A8. Logout and session revocation

Select sign-out scope explicitly: Supabase supports local, global and other-session scopes; the documented default is global. Recommend current-device logout as the ordinary action unless the product chooses otherwise, with a separate all-device action only if approved. Clear local tokens and personal drafts consistently, and handle server/network failure according to the chosen scope.

**Limit:** revoking refresh sessions does not cryptographically invalidate an already-issued access JWT. Signature verification can accept it until expiry. Do not claim immediate revocation. [Sign-out reference](https://supabase.com/docs/reference/javascript/auth-signout)

For stronger logged-out-session revocation guarantees, recommend an active-session check for sensitive actions. Independently, A9 requires authoritative disabled/deleting account denial across all normal access paths. Any live session lookup must use a deliberately narrow trusted mechanism; ordinary users must not gain access to `auth.sessions`. Decide whether business-wide immediate logged-out-session revocation is worth the extra state/latency and ensure direct Data API/Storage paths cannot bypass any such approved guarantee. Key rotation is not a per-user logout mechanism.

### A9. Account lifecycle access-denial requirement

**Required security outcome:** disabled or deleting accounts must be denied normal application access even while their access JWT remains cryptographically valid. JWT signature/expiry checks are necessary but do not prove the account is active. This requirement is distinct from the unresolved choice of immediate revocation for an otherwise active user's logged-out session.

The eventual design must enforce an authoritative active-account decision on all normal access paths:

- **FastAPI:** enforce account eligibility before normal service/database/storage operations; valid credentials do not override a disabled/deleting state. Recommend 403 for disallowed account state, consistent with B3.
- **Direct Data API:** ownership checks must also require account eligibility through reviewed RLS/grants or equivalent database enforcement. A caller bypassing FastAPI with its JWT must still be denied, including shared catalog reads and admin mutations.
- **Storage:** deny normal object reads, uploads, replacements, deletes and new URL signing for ineligible accounts through the reviewed Storage authorization design. A FastAPI-only or Data API-only pre-request check does not cover this path.

Recommended acceptance tests transition an account from active to disabled/deleting, then reuse the same unexpired JWT against FastAPI, direct Data API and authenticated Storage operations. All normal operations must be denied, without credential elevation. Repeat with an administrator account. Narrow trusted deletion/cleanup operations may continue; they must not reopen normal user access.

**Unresolved mechanisms:** authoritative lifecycle record/source, protected transition permissions, atomicity and concurrent-request handling, database/Storage eligibility predicates, caching/failure behavior and any permitted denial latency. Unknown eligibility must not silently grant access. These are design obligations, not deployed checks. Previously issued signed image URLs and downloaded copies are a separate capability boundary: ordinary JWT/RLS checks cannot be assumed to invalidate them. Before claiming lifecycle denial for image delivery, decide a revocable delivery mechanism or explicitly approve and document the residual URL-validity window; do not describe that limitation as already resolved.

### A10. Account deletion

Keep existing `DELETE /account` recorded, but do not implement it yet. Recommended orchestration: verify JWT and recent-auth policy; derive target solely from verified subject; mark account as deleting/deny further work; stop new jobs; remove/reconcile owned images and generated outputs; remove application records/associations; invoke narrowly scoped server-side Auth administrative deletion; confirm completion and clear local session. Make stages retryable and auditable because database, Storage and Auth are not one transaction.

Supabase notes that deleting an Auth user does not immediately invalidate its existing JWT, and that Storage ownership can obstruct user deletion. Cleanup order and interim RLS denial must account for both. [User management](https://supabase.com/docs/guides/auth/managing-user-data)

Auth administrative deletion requires server-side privileged access. This is an explicit exception to normal user-scoped operations, not permission to use the privileged client for profile/wardrobe CRUD. [Admin delete-user reference](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)

**Unresolved:** hard versus soft deletion, backup/processor retention, failure recovery and whether asynchronous deletion needs a reviewed change to the existing success contract. The current frontend treats success as completed deletion; do not silently change that meaning.

## B. FastAPI authentication design

### B1. Verification responsibilities

**Recommended dependency:** `require_authenticated_user` parses exactly one well-formed bearer credential and validates it with a maintained JWT library. Never implement cryptography manually or authorize a merely decoded token.

- Pin the expected Supabase issuer/project and JWKS URL from trusted server configuration. Never fetch a key URL taken from untrusted `iss`, `jku` or `x5u` headers.
- Verify signature with an explicit allowed algorithm set matching the project's signing configuration. Reject `none`, wrong algorithms, wrong-project keys and symmetric/asymmetric algorithm confusion.
- Validate exact `iss`, expected `aud` (normally authenticated user tokens; confirm project claims), required `exp`, future `nbf` if present, sensible `iat` and bounded clock skew.
- Require a valid UUID `sub` and allowed database role `authenticated`. Reject anon tokens, API keys, service-role tokens and refresh/provider tokens as business-user credentials. If anonymous Auth sign-ins are ever enabled, explicitly reject or separately authorize `is_anonymous` identities; they can use the authenticated DB role.
- Check additional approved claims such as session_id/aal when a route requires recent session/MFA assurance. Do not infer email confirmation or freshness from a client object. If confirmed email is required, apply A2's authoritative-source check after token verification; mere decoding or signature validation cannot establish a claim that is absent or whose semantics have not been approved.
- Reject invalid claims before calling repositories. Do not expose cryptographic internals in errors or log raw tokens.

Asymmetric projects publish public keys through `/auth/v1/.well-known/jwks.json`. A legacy HS256 project does not expose its signing secret there; Supabase recommends Auth-server verification or moving to asymmetric signing rather than treating an empty JWKS as permission to skip verification. Determine actual project configuration first. [JWT verification](https://supabase.com/docs/guides/auth/jwts)

Cache trusted keys with bounded expiry and controlled unknown-kid refresh; refresh once, fail closed if no trusted match, and rate-limit unknown-kid fetches. Distinguish invalid credentials from temporary inability to retrieve trusted keys (503, not a falsely authenticated request). Test rotations and key retirement. Supabase's endpoint has caching implications, so define a purge/runbook; old keys cannot be trusted indefinitely. [Signing keys](https://supabase.com/docs/guides/auth/signing-keys)

### B2. Principal and dependency layers

The dependency yields a request-only immutable principal: verified user UUID, token expiry, issuer/audience, verified session/assurance claims if needed, and the original bearer JWT as a non-loggable credential. Do not deserialize arbitrary body fields into it. Application permissions are separately resolved from an authoritative source.

Recommended chain: route → authentication dependency → optional permission dependency → business service → user-scoped repository/storage adapter. Pass the principal explicitly; repositories cannot default to a global admin client. Reuse HTTP connection pools safely, but never share mutable per-user headers or Auth session state across requests. Error handling must not retry a forbidden/empty result with service-role access.

### B3. 401 versus 403

- **401:** missing/malformed/invalid/expired access credentials or an authoritatively revoked session where that check is enforced. Include the appropriate Bearer challenge. Frontend currently expires local session on 401.
- **403:** authenticated identity lacks an application permission, required assurance or allowed account state. Keep insufficient privilege distinct from expiry.
- **404 recommendation:** conceal existence of another user's private resource consistently; use the same response for genuinely missing IDs. Lists may legitimately be empty under RLS; do not turn empty visibility into an unscoped lookup.
- **422:** invalid business input; **409:** state conflicts; **429:** rate limiting; **503:** temporary verification/service dependency failure. Exact error envelope remains to be approved; current frontend ignores bodies.

## C. User-scoped database access and RLS

### C1. Recommended identity propagation: Supabase Data API

1. FastAPI first verifies the JWT as above.
2. Build a request-scoped Data API request with the project publishable/legacy anon key in `apikey` and the verified **user access JWT** in `Authorization: Bearer ...`.
3. Supabase's API validates the token and supplies authenticated role and request claims to PostgreSQL. `auth.uid()` resolves to the JWT subject, so RLS evaluates the same user FastAPI authorized.
4. Use this request identity for selects, mutations, RPC and Storage operations. Include owner filters as defense in depth, but do not substitute filters for RLS.
5. The later selected Python SDK/version must be tested to prove it forwards this context; an SDK's default API-key bearer header must never accidentally replace the user token. User-scoped clients should not perform Auth sign-in/refresh server-side.

#### Acceptance criteria for the future user-scoped adapter

These criteria are required evidence before normal user database integration is accepted; no tests or adapter are implemented by this document.

1. **Exact credential propagation:** for every normal SELECT, INSERT, UPDATE, DELETE and RPC request, transport-level tests prove that outgoing Authorization contains the access JWT of the current verified request principal, and apikey contains only the approved nonprivileged project key. The JWT must be the current request's token, not a cached previous user's token or an SDK default API-key bearer value. After frontend refresh, the next FastAPI request and its outgoing Data API call use the refreshed token.
2. **Database identity proof:** integration tests using distinct real test identities A and B demonstrate that Supabase evaluates each request as its own verified subject under RLS. Verify read, write and reference ownership; receiving any successful HTTP response alone is not proof of correct identity.
3. **No silent elevation:** missing/expired/invalid user credentials, RLS denials, zero affected rows, empty results, SDK errors and dependency failures never trigger a service-role/secret-key retry or an unscoped repository. Tests assert that privileged adapters are not invoked and that no elevated credential is sent. Missing identity fails closed before issuing normal requests. Do not log credentials while collecting this evidence.
4. **Concurrent isolation:** interleave A and B requests, including reads, writes, RPC, failures, cancellations and connection-pool reuse. Assert that each outgoing request retains only its own token and each result has only permitted visibility. No shared mutable Authorization header, SDK auth session or per-user default state may cross request boundaries. Shared transport pools are acceptable only with immutable per-request credentials.
5. **Credential lifecycle:** after a request finishes, a subsequent request cannot inherit its token. Test expiry, token refresh between requests and error cleanup; never refresh or sign in through the user-scoped backend client. Apply equivalent isolation evidence to user-scoped Storage calls.
6. **Configuration boundary:** the normal adapter must be constructible without privileged secrets and must reject configuration intended for service-role access. A separate privileged component remains inaccessible as an automatic fallback. Pin and test the actual selected Python SDK/transport behavior rather than assuming constructor defaults establish user context.

This avoids direct-connection identity emulation as the default. A user JWT is not a PostgreSQL password. Merely extracting user_id in Python or connecting with a postgres/service-role credential does not activate user RLS.

**Alternative requiring separate review:** direct PostgreSQL access would require verified claims, a non-owner/non-superuser/non-BYPASSRLS role, transaction-local claim/role setup, safe pooled-connection reset and tests proving identity isolation. Do not add `SET` claims to a privileged connection and assume it is safe. No direct SQL claim injection or elevated connection is approved by this document.

### C2. RLS coverage and operation semantics

Logical relations requiring a security design: profiles, body_profiles, user_preferences, wardrobe_garments, garment_images if separate, outfits, outfit_items, recommendation_requests/results/associations, try_on_jobs/inputs/results, consent records if introduced, account lifecycle state, catalog/catalog_images and privileged role membership. Exact schema is unresolved. `auth.users` remains managed by Supabase; expose no raw Auth tables to the application. Storage object authorization uses `storage.objects` through Storage API operations.

**Least-privilege requirement:** RLS must be combined with appropriate schema, table, operation and column privileges. Expose only approved API schemas; grant schema usage and access to specific objects only where needed. Review inherited/PUBLIC/default grants, table privileges, view access, sequence privileges where applicable and function EXECUTE permissions rather than assuming new objects are safe by default. Limit SELECT/INSERT/UPDATE/DELETE separately; do not grant unrelated operations such as TRUNCATE or schema/table creation to normal callers. Column grants or constrained invoker operations must protect owner IDs, role/membership, lifecycle flags and worker-managed fields. A broad table UPDATE/INSERT grant must not unintentionally override intended column restrictions. RLS constrains rows; it is not a substitute for these privileges or business constraints.

For every exposed personal relation, enable RLS and use default deny. Restrict grants as well as row policies. Parent/child relations and any exposed views/RPC must be audited; invoker behavior is recommended, and elevated functions/views need explicit review. Index ownership/reference keys. [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

### C3. Illustrative ownership predicates — design examples only

These are policy descriptions, **not executable policies, migrations or created tables**. Assume a provisional immutable `owner_id` column matching Auth user UUID:

- SELECT own row: authenticated role, non-null `auth.uid()` and `owner_id = auth.uid()`.
- INSERT: WITH CHECK requires the new owner to match `auth.uid()`; server derives owner rather than trusting submitted owner IDs.
- UPDATE: USING requires the old row's owner to match; WITH CHECK requires the resulting row's owner to match. Exclude owner changes from ordinary grants/DTOs.
- DELETE: USING permits only the owner, plus approved lifecycle restrictions.
- Profile keyed by `id` instead of owner_id: same equality pattern using the actual user-key column.

Read visibility alone is insufficient for writes. Policies must be tested for every command, including zero affected rows. Avoid an additional permissive authenticated-all policy that accidentally ORs away ownership restrictions.

### C4. Cross-user relationships

RLS on an outfit's own owner does not alone prove its referenced garments belong to that owner. Recommend relational ownership constraints/validated invoker operations for outfit items, selected wardrobe garments, saved recommendations and try-on jobs. Validate both parent and referenced child in the same atomic operation. An outfit item insert/update must require ownership of its parent outfit AND referenced wardrobe garment; recommendation saves require the recommendation's owner; a job's wardrobe input must belong to its owner.

Use composite ownership keys/foreign keys where appropriate so references stay valid under races and direct Data API writes. Do not assume a foreign key checks ownership. Shared catalog references follow a distinct authenticated-read rule; mixed-source representation remains unresolved in the API audit. Never copy a client's desired owner_id into child rows unchecked.

### C5. Shared catalog and administrator policies

**Approved:** authenticated shared reads; only trusted admins mutate. **Recommended predicate:** catalog SELECT is allowed to authenticated users; INSERT/UPDATE/DELETE requires authoritative `is_catalog_admin(auth.uid())` or equivalent. Updates enforce permission on both old and resulting rows; images follow the same permissions. There is no administrator override to other users' measurements/photos/wardrobes by default.

Recommended role source: private, server-controlled membership relation keyed by Auth UUID, with no ordinary-user insert/update/delete grants. An admin-check helper should expose only a boolean for the current caller; if SECURITY DEFINER is needed, tightly set its search path, qualify objects, restrict execution and audit recursion/ownership behavior. Its design requires review; it is not created here. FastAPI permission checks and RLS must use the same authority. Alternative trusted app_metadata/custom claims may lag until refresh; neither user_metadata nor client role fields may authorize catalog writes.

### C6. Privileged access and background work

Maintain a separate privileged adapter with named operations for necessary Auth user deletion, trusted cleanup/workers or explicit role provisioning. Prefer user-scoped admin catalog access, since trusted membership plus RLS suffices. Service-role bypasses RLS: enforce explicit ownership/job scoping, constrained inputs, audit records and least-privilege worker interfaces within any privileged operation.

Do not store user refresh tokens to keep long jobs alive; user JWTs may expire during processing. A worker may need a scoped trusted operation tied to an authorized job's persisted owner and input references. Do not allow arbitrary client URLs, object keys, owner IDs or SQL in worker messages. Recheck account deletion and job ownership before reading inputs/writing results. Separate environment credentials and rotation procedures; do not commit or log keys.

### C7. Direct Data API access and business-rule bypass

Because the frontend legitimately possesses the public project key and its own JWT, it may call exposed Data API/Storage paths directly. FastAPI-only validation cannot be the sole defense for ownership, cross-references, role changes, job state or other security-critical invariants. Enforce C2's explicit least-privilege schema/object/operation/column grants alongside constraints, RLS and narrowly exposed invoker RPCs. Test direct API attempts to invoke unapproved functions, mutate protected columns and perform disallowed operations on otherwise owned rows; RLS ownership alone does not prevent them. Account eligibility must also be enforced on direct Data API and Storage paths as required by A9, not merely in FastAPI. Use these combined controls to prevent direct users setting protected processing fields. Resolve transactional operations before implementation rather than allowing unrestricted table writes because RLS checks owner_id. Supabase distinguishes object grants from row policies; Data API pre-request checks do not automatically cover Storage or Realtime. Security-critical liveness checks must protect every enabled access path. [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)

## D. Role and ownership model

- **Normal user:** authenticated Supabase identity, owns personal records and may read shared catalog; cannot manage roles/catalog or other users' records.
- **Administrator:** authenticated identity with trusted catalog-management membership. Continues using database role authenticated; not granted service_role or universal personal-data access.
- **User-owned:** profile, body/appearance descriptors, preferences, wardrobe/image objects, saved outfits/associations, recommendation artifacts, try-on input/job/output, and consent/lifecycle records if modeled.
- **Shared:** catalog garments and catalog images. Public internet access is not implied by authenticated shared access.
- **Trusted worker/admin service:** machine privilege distinct from a product administrator; permitted only through reviewed exceptional operations.

FastAPI obtains identity from verified sub, server resolves application permissions, and RLS uses the JWT subject. All list/read/write paths, nested references, storage paths and job lookups must preserve this invariant.

## E. Security risks and mitigations

### JWT tampering, replay and expiry

Use signature/claim checks, trusted key discovery and short-lived access credentials with a reviewed skew/rotation policy. Never trust a decoded role or a request-supplied issuer. Bearer-token theft remains usable until expiry or additional revocation checks apply. Redact credentials, recovery URLs and signed image URLs in proxy/application traces. Keep clock synchronization monitored.

### Refresh-token theft and privilege escalation

Use reviewed protected mobile persistence, Auth-managed rotation, minimum logging and dependency hygiene. Keep publishable keys distinct from secrets. Never use display metadata for permission checks. Resolve current catalog membership authoritatively when rapid admin demotion matters. Do not equate a stale application UI role with backend authority.

### IDOR, over-posting and SQL injection

Token subject controls owner, not path/body owner fields. Reject cross-owner references atomically; whitelist editable fields so users cannot set owner, role, job status, result object key or processing flags. Use parameterized database/SDK operations and allowlisted sort/filter fields; never interpolate search, category, cursor or IDs into SQL/RPC source. Return consistent private-resource errors without leaking another user's data.

### File validation and private image access

Current client permits single JPEG/PNG/WebP up to 10 MiB if size is reported. Server must independently bound streamed size, verify decoded format/dimensions, sanitize metadata/EXIF, generate object names and isolate processing. Do not trust MIME/filename or fetch arbitrary client-supplied URLs. Use private buckets for user garments/person photos/results; authorize uploads/downloads/deletions with both bucket and ownership/reference checks. Upsert/replacement requires all relevant Storage permissions; access is denied by default without policies. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

Current Image components load imageUrl without bearer headers. **Recommendation:** authorize a record read, then issue short-lived signed URLs compatible with that shape; URL lifetime/renewal remains undecided. Treat URLs as bearer capabilities; do not log/share them or claim signing out immediately revokes them. Catalog bucket visibility also needs an explicit choice consistent with authenticated-only reads.

### Sensitive images and retention

Recommend minimization: retain body/person inputs only as long as needed for the approved purpose, separate inputs/results, strip location metadata, prohibit secondary model training by default and avoid image/body values in logs. Establish consent wording/version, retention durations, user deletion, backup expiry and processor/ML-provider handling before production. RLS does not protect images already downloaded or signed URLs already shared. Encrypt transport and use platform storage protections; audit object creation/replacement/deletion and orphan cleanup. Exact policy/legal requirements are unresolved, not claimed complete.

### Availability, side effects and telemetry

Rate-limit auth-sensitive/business/upload operations, cap job concurrency, set dependency deadlines and distinguish auth failures from outages. Make retried writes/deletions safe; the existing 20-second client timeout can hide a committed server mutation. Configure browser CORS narrowly without treating CORS as authorization. Log request IDs, operation/result and minimal pseudonymous identifiers, not tokens, password bodies, full signed URLs or sensitive profiles. Test concurrent requests for cross-user header leakage.

## F. Contract reconciliation and unresolved decisions

The approved architecture changes the owner of authentication behavior, but **does not silently replace any of the 35 recorded API contracts**. The audit is an inventory of existing expectations, not proof those endpoints should all become FastAPI handlers.

- `/auth/login`, `/auth/signup`, `/auth/password-reset`, `/auth/password-reset/confirm`, `/auth/password`, `/auth/logout`: existing frontend contracts conflict with direct Supabase Auth responsibility. A reviewed frontend migration and explicit compatibility/deprecation decision are required; do not create a duplicate password authority by default.
- `/auth/me`: declared but unused; decide whether it becomes an authenticated application identity/permission projection or remains unused. No new schema is approved here.
- `/account`: remains a business orchestration requirement; privileged Auth deletion must be isolated and recent-auth/deletion semantics approved.
- All profile/wardrobe/catalog/outfit/recommendation/try-on structures remain as audited until independently changed by review. Session refresh integration will require approved frontend work; currently a 401 clears local state immediately.

Decisions still required:

1. Actual Supabase project issuer, audience, signing keys/algorithms, JWT lifetime/skew, key-rotation cache policy and allowed Auth identity types.
2. Confirmation requirements, SMTP/rate-limit settings, callback domains/app links, PKCE/OTP recovery mechanics and verified-email enforcement.
3. Native protected storage adapter, web-preview persistence, one-client refresh lifecycle, offline behavior and safe retry rules.
4. Logout scope, password-change reauthentication/global revocation and whether immediate logged-out-session revocation is required. Disabled/deleting account denial across FastAPI, direct Data API and Storage is required by A9; its authoritative source, enforcement mechanism, cache/race behavior and signed-URL residual-access decision remain unresolved.
5. Trusted admin membership versus server-managed claims; provisioning/demotion process, MFA requirements and shared authorization helper design. Detailed admin workflow remains deferred.
6. Final tables/ownership keys, child constraints, exposed schema/grants/invoker RPCs, transactional business rules, views and profile bootstrap.
7. User-scoped Data API Python adapter/library choice and proof that requests never inherit service-role/default headers.
8. Storage bucket layout, object naming, signed URL expiry/renewal, catalog privacy, upload replacement and cleanup.
9. Account deletion lifecycle, recent-auth proof, failures/async completion, backups and processor retention; live-token denial after deletion.
10. Mixed catalog/wardrobe outfit references, worker credentials, async recommendation/try-on scope and permission rechecks.
11. Error envelope/status conventions, enumeration behavior, logging/audit retention and test environment credentials.

## G. Implementation sequence after document approval

1. Approve this architecture and record unresolved security decisions, including explicit auth-contract migration; no code before review.
2. Inspect/configure the actual development Supabase Auth project, redirects and signing configuration; establish secret management and safe test identities.
3. Approve the relational ownership model, transactional/grant design, Storage paths and RLS threat/test cases before creating migrations.
4. Implement the approved least-privilege grants, schema/constraints/RLS/Storage policies and disabled/deleting account enforcement in development, with negative tests against direct Data API access for user A/user B/admin/unauthenticated identities. Prove cross-user reference and protected-field denial before adding normal CRUD.
5. Build FastAPI verification dependency, principal and request-scoped user Data API adapter; test invalid/expired/wrong-project JWTs, rotation, missing claims, all C1 acceptance criteria, shared-client isolation and absence of privileged fallback.
6. Implement profile/bootstrap/preferences and wardrobe business services against user-scoped repositories; verify image authorization and cleanup. Review admin workflows before catalog mutation implementation.
7. **Explicit milestone — Supabase Auth frontend migration:** after separate implementation approval and auth-contract reconciliation, migrate the session provider from the custom in-memory authentication flow to a single Supabase Auth session authority. Include signup/login, email-verification callbacks, password-recovery callbacks and password updates, Auth-managed token refresh, protected session persistence/restoration, auth-state event handling and latest-access-token retrieval for each business API request. Do not retain an independent competing refresh/session system. Approve the treatment of all existing custom auth contracts before changing their callers. Milestone acceptance requires end-to-end signup/verification/login, recovery, refresh while active/backgrounded, app-restart restoration, expiry/logout, and a post-refresh request proving FastAPI receives and forwards the latest token. Include account-state denial checks from A9. None of this migration is claimed implemented here.
8. Implement outfits/recommendations/try-on references and reviewed worker access; test owner deletion, token expiry and race cases.
9. Add isolated account-deletion orchestration; verify negative and partial-failure scenarios, revocation semantics and retention.
10. Run complete integration/RLS/storage tests, device recovery/deep-link tests and credential-leak checks before release readiness claims.

Approval of the document authorizes planning only until implementation is separately requested. No policies, SQL, backend/frontend code, keys or fake responses were created by this task.
