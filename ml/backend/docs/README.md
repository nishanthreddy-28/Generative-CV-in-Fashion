# Documentation

Current guides describe the code that runs today. Historical documents describe
past experiments and can mention retired providers, old paths and earlier results.

| Guide | Purpose |
|---|---|
| [Getting started](GETTING_STARTED.md) | Install, configure, start and test |
| [Code map](CODE_MAP.md) | Find implementation and tests by feature |
| [Architecture](ARCHITECTURE.md) | Understand data flow and runtime boundaries |
| [Mobile contract](../deployment/mobile/INTEGRATION.md) | Integrate the separate Expo app |
| [Deployment](../deployment/README.md) | CPU host, Supabase and secrets |
| [Contributing](../../CONTRIBUTING.md) | Make a maintainable change |
| [Model results](history/PROJECT_RESULTS.md) | Previous measured results and limits |
| [Detailed evaluation](history/EVALUATION.md) | Dataset protocols and uncertainty |
| [Aggregate metrics](evaluation-assets/metrics-summary.json) | Machine-readable past results |

## Records

- `STRUCTURE_MIGRATION.json`: exact module/file mapping for the feature refactor.
- `CLEANUP_MANIFEST.json`: earlier cleanup and data-preservation checks.
- `maintenance/`: source records of one-time migrations; not operational commands.
- `history/`: older plans, verification notes and reports; not the current setup guide.

Keep current instructions here rather than appending new instructions to old
reports. Preserve historical measurements with their original evaluation scope.
