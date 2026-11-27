# Backend

Start with the [project README](../README.md), then the
[code map](docs/CODE_MAP.md) or [getting started](docs/GETTING_STARTED.md).

- `app/`: API, contracts, persistence and feature packages.
- `web/studio/`: browser development interface.
- `deployment/`: CPU cloud entry point, private Supabase migration and mobile clients.
- `scripts/`, `tests/`: operational commands and verification.
- `docs/`: current guides and clearly separated historical reports.
- `storage/`: private runtime data, required assets and caches; never publish.
- `eval/`, `research/`: evaluation inputs and historical experiments.

The canonical development entry point is `app.main:app`. From the project root,
use `start.ps1` and `test.ps1`. Current try-on providers are WeShopAI and IDM-VTON.
