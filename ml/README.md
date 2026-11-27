# Drape & Drop ML

Python backend and mobile integration clients for a wardrobe, personalized outfit
recommendations and hosted photo try-on. The Expo app is maintained separately.

## Start here

| I want to… | Read |
|---|---|
| Run or test the project | [Getting started](backend/docs/GETTING_STARTED.md) |
| Find the code for a feature | [Code map](backend/docs/CODE_MAP.md) |
| Understand the request flow | [Architecture](backend/docs/ARCHITECTURE.md) |
| Connect the mobile app | [Mobile contract](backend/deployment/mobile/INTEGRATION.md) |
| Configure hosting and secrets | [Deployment](backend/deployment/README.md) |
| Make a change | [Contributing](CONTRIBUTING.md) |
| Read results and historical decisions | [Documentation index](backend/docs/README.md) |

## Project layout

```text
ml/
├── start.ps1              Start the local development client
├── test.ps1               Run regression, data and mobile-client checks
├── .venv/                 Local Python runtime; not source control
└── backend/
    ├── app/
    │   ├── main.py        Combined development entry point
    │   ├── api/           HTTP routes and authentication boundary
    │   ├── contracts/     Shared request/response models
    │   ├── core/          Configuration and shared cache utilities
    │   ├── wardrobe/      Validation, background removal and tagging
    │   ├── pose/          MediaPipe validation and body-photo estimates
    │   ├── profiles/      Preferences, reviewed estimates and fit notes
    │   ├── recommendations/ Candidate search, scoring and orchestration
    │   ├── chat/          Interpretation and visual-stylist providers
    │   ├── tryon/         WeShopAI / IDM-VTON and preview jobs
    │   ├── persistence/   Local wardrobe/conversation repositories
    │   └── cloud/         Supabase-backed orchestration
    ├── web/studio/        Browser development client
    ├── deployment/        Cloud entry point, Supabase SQL, mobile clients
    ├── scripts/           Setup, preparation and verification commands
    ├── tests/             Automated regression tests
    ├── docs/              Current guides, results and history
    ├── eval/              Classification evaluation input/tool
    ├── research/          Historical experiments; not deployed
    └── storage/           Private data, model assets and caches
```

From this folder in PowerShell, run `./start.ps1` or `./test.ps1`.
Installation and credential instructions are in getting started.

CPU components run in the backend. Cloudflare Workers AI / Gemma 4 handles chat
and visual assessment. WeShopAI generates try-on, with IDM-VTON backup for one
top; IDM can also be selected directly. The sibling `../FASHN_Archive` is outside
the active app. Its VTON generator is separate from the small CPU human parser
retained for garment isolation.

The integrated application starts from the repository root. See ../README.md for the current setup and integration status.
Photo widths are not circumferences or clothing-size guarantees. Recommendation
quality remains under evaluation. Existing `/phase3/*` endpoints and `PHASE3_*`
settings stay compatible; source packages now use feature names.
