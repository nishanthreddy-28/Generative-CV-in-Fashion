# Backend checkpoint 001 — Security foundation

Date: November 5, 2026. Version 0.1.0. Intended tag: backend-v0.1.0-security-foundation-preview.

## Authorization and scope
The user approved implementation of the security baseline and confirmed asymmetric signing keys. This is the first infrastructure checkpoint. The earlier 35-contract audit and approved architecture are preserved in this commit. No frontend contract was silently migrated.

## Implemented
- FastAPI app factory, configuration validation and security exception handlers.
- Fixed-origin asynchronous JWKS verifier with bounded cache/cooldown and controlled unknown-key refresh.
- Signature, algorithm, issuer, audience, expiry, issued-at, not-before and subject checks; rejection of anon/service-role identities and anonymous Auth sign-ins.
- Immutable request principal and strict bearer dependency.
- User-scoped HTTP Data API adapter for GET/POST/PATCH/DELETE/RPC; publishable key only; fresh per-request token; redirect refusal; no automatic privileged retry.
- Account-eligibility dependency defaults to unavailable. Protected business access stays closed until authoritative lifecycle enforcement exists.
- Locked Python dependencies, env template without credentials and setup documentation.

## Verification
28 tests passed: generated-key verification/tampering/claims, key failure/rotation/unknown-kid bound, exact outgoing credentials across concurrent operation types, refresh between requests, failure/cancellation isolation, privileged-key configuration rejection and fail-closed protected dependency.
No live Supabase test identities, database RLS or Storage authorization have been exercised. These are transport/unit tests, not acceptance of all architecture C1 criteria. C1 database-subject proof and disabled/deleting account tests across direct Data API and Storage remain outstanding.
Known test-tool warning: installed Starlette warns its httpx TestClient path is deprecated; tests still pass. No business behavior is affected; review test transport compatibility on dependency upgrades.

## Next required integration work
1. Supply the non-secret development Supabase project URL and configure its publishable key privately; inspect actual issuer/audience/signing keys.
2. Review concrete relational schema, trusted membership and authoritative account lifecycle source before migrations.
3. Implement grants/constraints/RLS/Storage rules and real A/B/admin negative tests, including disabled/deleting accounts with valid JWTs.
4. Replace UnconfiguredEligibility only after its authoritative fail-closed mechanism is tested. Then expose business services.
5. Complete the explicit Supabase Auth frontend migration as its own milestone; preserve/reconcile existing auth contracts before editing callers.

No service-role client, schema, policies or frontend changes were introduced. The application intentionally cannot serve business data yet.
