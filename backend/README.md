# Drape & Drop — backend foundation

Version 0.2.0 adds a versioned database migration and protected profile/settings APIs to the asymmetric JWT security foundation. It is implemented locally; it is not deployed to Supabase.

## Setup

Use Python 3.12+ (verified locally with 3.13):

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
cp .env.example .env
# Configure development project details privately.
.venv/bin/uvicorn app.main:app --reload
```

Only HTTPS Supabase project origins, publishable keys and configured asymmetric signing algorithms are accepted. Never supply privileged keys to the ordinary adapter. Leave `DATABASE_FOUNDATION_ENABLED=false` until the migration, schema exposure and live integration checks in [database setup](../supabase/README.md) pass. The env template is not real project configuration.

## Implemented boundary

- Cached fixed-origin JWKS signature/issuer/audience/expiry/claim validation, immutable principal and per-request current-user Data API JWT; no privileged fallback or shared auth state.
- GET/PATCH `/profile` and GET/PATCH `/settings` (existing API contracts 10/11/14/15). PATCH returns 204. Full-form clearing, input validation and protected-field rejection; no auth contract is changed.
- Database integration is opt-in and fail-closed by default. When enabled, eligibility is fetched using the same JWT, and its reported subject must match FastAPI's verified subject. Inactive accounts are denied; missing/malformed/dependency data never authorizes access. Database operations independently enforce eligibility so a change after the FastAPI check is still denied.
- Six private RLS tables, least-privilege execution roles, trusted bootstrap/membership/lifecycle operations, post-Auth tombstone survival and a restrictive Storage eligibility gate. See [migration/setup](../supabase/README.md).
- The frontend now uses Supabase Auth directly; see [Auth integration](../docs/backend/frontend-supabase-auth-integration.md). FastAPI does not duplicate signup/login/recovery/refresh endpoints.
- GET/PATCH `/profile/body` are implemented locally with a new additive migration, current numeric bounds, precision protection and atomic partial updates. Existing body editor wiring is reused. Hosted deployment is pending; the flag remains false. See [body API](../docs/backend/body-profile-api.md).
- Wardrobe list/detail/create/partial-update/delete and authenticated image retrieval are implemented locally with an additive migration; hosted Storage/RLS acceptance remains pending. See [wardrobe API](../docs/backend/wardrobe-api.md).
- Catalog browsing and trusted administrator create/edit/deactivate, private image upload/retrieval and frontend access projection are implemented locally. See [catalog management](../docs/backend/admin-catalog-management.md). No hosted migration or security acceptance is claimed.
- Owner-only manual outfit creation/list/detail and typed wardrobe/catalog item relationships are implemented locally. See [outfit foundation](../docs/backend/outfit-creation-foundation.md). Outfit editing, filtering, recommendation saves and mixed-source frontend integration remain out of scope.
- No recommendations/try-on implementation, full account deletion, privileged backend client or production configuration.

## Verification

From `backend`:

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m compileall -q app
```

Database tests skip in this command unless an isolated test socket is supplied. From repository root, run the full disposable PostgreSQL suite:

```sh
backend/.venv/bin/python backend/tests/database/run_local.py
```

Database tests use test-only minimal Auth/Storage interfaces, real PostgreSQL grants/RLS and separate connections for disable/mutation races. They do not certify Supabase JWT gateway, PostgREST schema exposure, hosted role privileges, Storage HTTP/signing or physical-device workflows. Those remain required before activation/release. Existing Starlette TestClient deprecation warning is unchanged; no production behavior depends on that test transport.

Backend CI runs both the ordinary pytest suite and this dedicated PostgreSQL runner. The ordinary suite's database skips do not replace the dedicated job step. The updated workflow must still pass on the remote runner after a separately approved push.

See [checkpoint 002](../docs/backend/checkpoint-002-database-foundation.md), [security architecture](../docs/backend/authentication-and-security.md) and [35-contract audit](../docs/backend/api-requirements.md).
