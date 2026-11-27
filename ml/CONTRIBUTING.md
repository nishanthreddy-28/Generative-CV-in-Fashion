# Working on Drape & Drop ML

1. Use the [code map](backend/docs/CODE_MAP.md) to locate the relevant feature.
2. Change domain behavior in the feature package, HTTP behavior in `app/api`,
   and shared data validation in `app/contracts`.
3. Update tests for changed contracts, ownership, errors or model-independent logic.
   Regression tests must not require paid or live model calls.
4. Run `./test.ps1`. Use the specific real-model smoke script when inference,
   garment preparation or MediaPipe behavior changes.
5. Update current guides and mobile contracts when behavior changes.

## Boundaries

- Keep routes thin; network/provider logic belongs in `chat` or `tryon`.
- Reuse contracts instead of duplicating request/response models.
- Enforce ownership at each public boundary using verified sessions.
- Keep provider credentials in backend environment variables, never the APK.
- Avoid model downloads, paid requests or jobs during module import.
- Keep `storage`, `.venv`, user photos and database files out of source control.
- Keep research/history out of runtime imports and deployment bundles.

## Compatibility

Use feature names rather than development phases in new source code. Keep existing
`/phase3/*` routes, JSON contracts and environment variables until a versioned
migration is agreed with the mobile developer. `phase2_api` in the local session
response and names such as `phase3.db` are retained compatibility details.

Tests verify software behavior; they do not establish recommendation accuracy,
anthropometric accuracy, provider uptime or deployment readiness.
