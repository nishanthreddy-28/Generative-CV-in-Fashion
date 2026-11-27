# Getting started

Commands below start in the `ml` folder. PowerShell is used because the
existing development environment is on Windows. Node is needed for mobile-client
contract checks; Python and Node are not bundled into the mobile APK.

## Existing workstation

```powershell
.\start.ps1
```

Open `http://127.0.0.1:8001`. The default stylist is Cloudflare Workers AI / Gemma
4 and default try-on is WeShopAI. Missing Cloudflare account ID/token are requested
in the backend terminal. The token is entered through a hidden prompt.

To choose another port:

```powershell
.\start.ps1 -Port 8002
```

The local launcher sets a loopback-only development user. This is a development
client, not the public mobile backend. Use the deployment guide for real accounts.

## New workstation

The existing project uses Python 3.13; cloud configuration currently specifies
Python 3.12. Verify package resolution on the chosen deployment platform.

```powershell
py -3.13 -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
& '.\.venv\Scripts\python.exe' -m pip install -r backend/requirements.txt
Push-Location backend
& '..\.venv\Scripts\python.exe' scripts/setup_models.py
& '..\.venv\Scripts\python.exe' scripts/setup_pose_validation.py
Pop-Location
```

Setup downloads public pretrained assets. FashionSigLIP/background/parser assets
may also be fetched on first use. Keep sufficient RAM and disk space; measure
startup and warm performance on the actual host. A GPU is not required for the
selected stack. The archived FASHN generation environment is not part of setup.

## Configuration

Use `backend/.env.production.example` as the list of settings. It is a template
and is not loaded automatically. Configure secrets in the backend process or the
host's secret manager. Never put provider tokens in the APK.

| Setting | Purpose |
|---|---|
| `PHASE3_LLM_PROVIDER=workers` | Select Cloudflare stylist |
| `PHASE3_WORKERS_MODEL=@cf/google/gemma-4-26b-a4b-it` | Select Gemma model |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Backend Cloudflare credentials |
| `PHASE3_TRYON_PROVIDER=weshop` | Try-on default; only `weshop`/`idm` accepted |
| `HF_TOKEN` | Optional hosted-demo access token |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Deployed authentication/storage |

`PHASE3_*` names are retained for compatibility despite the renamed source packages.
The moved local environment works through its Python executable; old pip.exe or
activation shortcuts may retain absolute paths. Use `python.exe -m pip` or recreate
the environment on another machine.

## Verification

```powershell
.\test.ps1
```

This runs regression tests, private-data/layout integrity checks and the mobile
transport check. `verify_layout.py` checks the retained local FASHN archive too;
run the ordinary unit suite alone on a clean CI checkout without local data/archive:

```powershell
Push-Location backend
& '..\.venv\Scripts\python.exe' -m unittest discover -s tests
Pop-Location
```

Optional real MediaPipe/browser check on this workstation, from backend:

```powershell
& '..\.venv\Scripts\python.exe' scripts/verify_body_pose_browser.py --image storage/pose-check/dataset-3.png
```

This uses an isolated fixture and requires Chrome. Do not run live-provider smoke
scripts as ordinary tests; they need credentials, can consume allowance, and have
separate reliability/quality limits.
