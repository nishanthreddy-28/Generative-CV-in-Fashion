# Local setup and verification

Use the repository root, Node 24 (`mobile/.nvmrc`), Python 3.12+ (local checks use 3.13), and PostgreSQL tools for isolated database tests. The active app is in `mobile/`; the older Vite frontend is historical.

## Frontend

```sh
cd mobile
npm ci --legacy-peer-deps
cp .env.example .env
npm run web -- --localhost --port 8082
```

If dependencies already exist, no reinstall is necessary for normal checks. Configure only the API origin, Supabase project origin and publishable key privately in `mobile/.env`. Expo public variables are bundled; never place Management tokens, service-role keys, passwords or refresh tokens there. See [Auth setup](docs/backend/frontend-supabase-auth-integration.md) for callbacks/email templates and native SecureStore/development-build requirements.

Open `/preview` on the printed local origin to inspect screens without loading account data. Native Android needs an API address reachable from the device/emulator; `localhost` in the template identifies that device, not automatically the laptop. Production HTTPS and package/deep-link configuration remain pending. Web authenticated business requests also need a reviewed FastAPI CORS configuration; no permissive CORS workaround is installed here.

## Backend

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload
```

For an existing environment, reuse `.venv`. Configure project details privately. **Keep DATABASE_FOUNDATION_ENABLED=false.** The existing four profile/settings operations intentionally reject normal access until the approved hosted migration/exposure/bootstrap/security checks pass. A running server does not make missing wardrobe/outfit/job endpoints available.

## Verify

From `mobile/`:

```sh
npm test
npm run typecheck
npm run lint
npm run export:android
```

From the repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests
backend/.venv/bin/python -m compileall -q backend/app
backend/.venv/bin/python backend/tests/database/run_local.py
```

The first pytest command skips database tests without an explicitly supplied disposable socket; the dedicated runner executes them in a fresh temporary PostgreSQL cluster and removes it afterward. It never connects to hosted Supabase. It uses minimal test-only Auth/Storage interfaces, not real managed services.

## Hosted and release boundaries

Do not apply hosted migrations, change Auth/Data API/Storage settings or enable the flag without separate approval. See [database prerequisites](supabase/README.md) and [integration acceptance plan](docs/backend/supabase-integration-verification.md). Native build, physical-device, signed AAB and Play internal testing remain separate gates. No ML integration has been started.

Use [WORKFLOW_STATUS.md](docs/WORKFLOW_STATUS.md) for the actual missing work and blockers. Historical audits remain snapshots; they do not override the current source.
