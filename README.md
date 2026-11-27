# Drape & Drop

A wardrobe application with an Expo mobile/web frontend, a FastAPI application API, a private CPU ML service, and Supabase authentication, database and private storage.

## Repository layout

| Folder | Purpose |
| --- | --- |
| `mobile/` | Expo screens, session state, API clients and frontend tests |
| `backend/` | Authenticated business APIs, private images, integration and database tests |
| `ml/backend/app/` | Background removal, FashionSigLIP, MediaPipe, recommendations and try-on |
| `ml/backend/integration_worker/` | Private inference endpoints called by the application API |
| `ml/backend/scripts/` | Model downloads and verification tools |
| `supabase/` | Database migrations, policies and verification scripts |
| `deployment/` | Integration contracts and Oracle/Linux deployment references |
| `docs/` | Architecture, API specifications and integration history |
| `.github/workflows/` | Frontend and backend CI |

The request flow is `Expo -> FastAPI application API -> private ML worker / Supabase`. The ML service uses CPU inference locally, Cloudflare Workers AI / Gemma 4 for the stylist, and WeShopAI / IDM-VTON for hosted try-on.

## First setup on Windows

Install Python 3.13 and Node.js 24. From the repository root, create the API and ML environments.

```powershell
py -3.13 -m venv backend/.venv
& './backend/.venv/Scripts/python.exe' -m pip install -r backend/requirements.lock
py -3.13 -m venv ml/.venv
& './ml/.venv/Scripts/python.exe' -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
& './ml/.venv/Scripts/python.exe' -m pip install -r ml/backend/requirements.txt
Push-Location mobile
npm ci --legacy-peer-deps
Pop-Location
```

Create private configuration files from the templates.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item ml/backend/.env.example ml/backend/.env
Copy-Item mobile/.env.example mobile/.env
```

Configure your Supabase project URL and publishable key, backend provider credentials and deployment URLs in those files. Generate long random secrets for the worker and receipt signing. Set API `ML_WORKER_TOKEN` and worker `DRAPE_ML_WORKER_TOKEN` to the same secret. Keep `ML_RECEIPT_SIGNING_KEY` stable so saved results remain readable. Only public configuration belongs in the mobile environment.

For local browser testing, use `EXPO_PUBLIC_WEB_API_URL=http://localhost:8000`. A physical phone needs a reachable API URL in `EXPO_PUBLIC_API_URL`. Configure the Supabase schema using the versioned migrations and the database deployment guides. An existing configured development project already has its applied migration history.

Download model assets from the ML backend directory.

```powershell
Push-Location ml/backend
& '../.venv/Scripts/python.exe' scripts/setup_models.py
& '../.venv/Scripts/python.exe' scripts/setup_pose_validation.py
Pop-Location
```

FashionSigLIP, background-removal and human-parser assets may download on first use. Allow disk space for the model assets and time for the initial CPU startup.

## Run

```powershell
./start-integration.ps1
```

Open http://localhost:8081. The API listens on port 8000 and the private worker on port 8090. The launcher starts background processes and writes local logs under `.integration/logs/`. It requires the dependencies and private environment files described above.

## Verification

```powershell
Push-Location mobile
npm run typecheck
npm run lint
npm test
Pop-Location
Push-Location backend
& '.venv/Scripts/python.exe' -m pytest tests -q
Pop-Location
Push-Location ml/backend
& '../.venv/Scripts/python.exe' -m unittest discover -s tests
Pop-Location
```

Database isolation tests need a disposable PostgreSQL installation. See `backend/tests/database/run_local.py`. Live provider checks need configured credentials and can consume provider allowance.

## Source copy and local data

This copy contains application source, migrations, dependency manifests, lockfiles, tests and setup scripts. Installed environments, node_modules, model weights, local databases, private images, generated previews, build outputs, temporary testing URLs, SSH keys and live environment files are excluded. Historical research tools are retained without generated result images. The original project folder remains the working reference for your private configuration and local assets.

Existing FASHN generation archives are separate from this repository. The small CPU human parser remains an active dependency. Earlier notes under docs describe past checkpoints; current runtime entry points are the root launcher, `backend/app/main.py`, and `ml/backend/integration_worker/main.py`.

## GitHub

Review the source and configure the destination remote before publishing. Provider secrets and private runtime files must remain in ignored locations. The integrated source follows the existing repository history. Environment files and runtime data remain local.
