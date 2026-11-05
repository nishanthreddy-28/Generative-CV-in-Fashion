# Drape & Drop — FastAPI security foundation

Version 0.1.0. This checkpoint provides authentication infrastructure, not working business APIs or deployed RLS.

## Setup

Use Python 3.12+ (verified locally with 3.13).

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
cp .env.example .env
# Configure your development project URL and publishable key privately.
.venv/bin/uvicorn app.main:app --reload
```

Only HTTPS Supabase project origins, publishable keys, and configured asymmetric signing algorithms are accepted. The template is not a real project configuration. Never supply a service-role or secret key to the normal adapter. No credentials are committed.

## Verify

```sh
cd backend
.venv/bin/python -m pytest -q
.venv/bin/python -m compileall -q app
```

## Current boundaries

- Fixed-origin, cached JWKS verification: issuer, audience, expiry, issued-at, optional not-before, UUID subject, authenticated role and non-anonymous identity.
- Request-only immutable principal; token hidden from its representation.
- Fresh user Authorization and publishable apikey headers for every Data API operation. No shared SDK login/session or privileged fallback.
- `active_user_data` requires verified identity and account eligibility. Eligibility is deliberately unconfigured and fails closed with 503, even with a valid JWT.
- No business endpoints or direct arbitrary-table proxy. Production application exposes only framework documentation, not the 35 audited business operations.
- No database tables/migrations/RLS policies, Storage provisioning, production configuration, Auth password endpoints, or frontend migration in this checkpoint.

Database identity/RLS and lifecycle denial across Data API/Storage cannot be certified until a live/local Supabase schema and policies are implemented and tested. Test-generated signing keys and HTTP transport stubs are confined to tests; they are not application mock data.

See [security architecture](../docs/backend/authentication-and-security.md), [API audit](../docs/backend/api-requirements.md), and [implementation checkpoint](../docs/backend/checkpoint-001-security-foundation.md).
