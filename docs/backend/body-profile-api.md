# Body Profile API

Implemented locally on main; hosted deployment and security acceptance remain pending. The database feature flag stays false. This change adds no service-role client, account provisioning or body-analysis feature.

## HTTP contract and existing frontend

- `GET /profile/body`: verified, active user only. Returns the real current user's flat editor record with units, height/chest/waist/hips/inseam, bodyShape, skinTone, undertone and fit. Nullable measurements remain JSON null; unset text/units are represented as empty strings for the editor. Missing rows return404, not fabricated defaults. Trusted bootstrap already creates an actual incomplete body row.
- `PATCH /profile/body`: verified, active user only; returns204. Accepts the existing complete form snapshot and, as explicitly requested in this implementation task, partial objects. Only supplied keys change; explicit null clears a nullable value and blank optional text clears it. An empty patch is a no-op only for an existing accessible row. Ownership and timestamps cannot be submitted.
- The existing `mobile/src/app/profile/body.tsx` already targets this exact path through EditorScreen and the current-session JWT request helper. It sends all form fields, then refetches after204. No route or shared editor rewrite was needed. The BodyProfile type now includes the existing appearance fields and nullable measurements.

## Validation and meaning

The current frontend/schema rules and existing table constraints are reused: finite numeric measurements1–300, units cm/in, optional bodyShape/skinTone text up to200 characters, undertone Warm/Cool/Neutral/Not sure, fit Fitted/Regular/Relaxed/Oversized. Measurements must be JSON numbers, not strings or booleans. More than four meaningful fractional places are rejected before numeric(10,4) storage can silently round them. Empty optional numeric inputs are null, not zero.

This does not introduce unit-specific clinical ranges or automatic conversion. Changing units must explicitly replace or clear every currently populated measurement in that same patch; omitted measurements cannot silently acquire a different unit. Clearing units while measurements remain fails the existing database constraint. Long-term range/conversion/product precision policy is not otherwise settled here.

Validation errors return422 with safe detail, without echoing personal measurements or nonfinite input. Missing profile returns404. Missing/invalid authentication returns401; inactive or forbidden access returns403. Unavailable/malformed upstream operations return503. No automatic elevated retry or insert occurs on failure. Other profile/settings API behavior is unchanged.

## Database boundary

The unchanged `202611060001_foundation.sql` provides the existing body_profiles table, own-active policies, lifecycle lock and trusted bootstrap. New additive `202611080001_body_profile_api.sql` grants body SELECT/editable-column UPDATE to the existing nonowner/non-BYPASSRLS user executor; creates constrained private read/update functions and api invoker wrappers; explicitly restricts function execution; revokes temporary schema CREATE. Ordinary users still have no direct base-table DML, no protected-role membership and no ownership-field write privilege.

Every operation derives identity from auth.uid(), reached via the existing verified current-user-JWT Data API adapter. PATCH locks eligibility and the body row, validates all submitted JSON fields inside SQL as well as FastAPI, and updates only supplied values in one transaction. This preserves disjoint concurrent patches and serializes against disable/deletion. No user ID parameter exists. Direct RPC callers cannot bypass field/precision/unit validation.

The additive migration is authored but **not applied to hosted Supabase**. Only user-approved fresh disposable local clusters apply the migration chain for tests. The foundation file is not modified. A separately approved deployment must install both migrations in order, expose/review the api schema, inspect actual grants and pass hosted acceptance before any feature-flag change.

## Verification commands

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
```

The general pytest invocation skips SQL cases without the disposable socket. The dedicated runner applies the ordered local migration chain only inside its temporary cluster and executes both foundation and body database suites. API tests intercept external HTTP; database tests use real PostgreSQL grants/RLS/constraints and separate connections for concurrency, with minimal test-only Supabase interfaces. Fixtures are confined to tests; no mock business data is added to the application.

From mobile:

```sh
npm test
npm run typecheck
npm run lint
```

Hosted JWT/PostgREST, managed-role privileges and native-device integration remain unverified. False feature flag behavior is tested: even valid authenticated principals cannot use the body endpoints until integration is enabled after separate approval.

Latest local implementation checks:126backend/API/security cases passed; the ordinary run skipped67database cases, all67then passed in the dedicated disposable PostgreSQL runner.20frontend cases, typecheck, lint, Python compilation and diff whitespace checks passed. Existing Node module-type and Starlette TestClient deprecation warnings remain. No hosted, device or production acceptance is claimed.
