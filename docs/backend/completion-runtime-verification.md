# Completion runtime and quality evidence

2026-11-09, local development only. This supplements the single master checklist; it is not hosted or device acceptance.

## Runtime actually exercised

Started the documented FastAPI app with `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8019` in backend, with an explicit loopback CORS allowlist. Started Expo with `CI=1 EXPO_OFFLINE=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8019 npm run web -- --host localhost --port 8099` in mobile. Startup completed without application errors. The foundation flag was not changed.

- GET /openapi.json: 200; 28 path templates advertised, including implemented business routes.
- Without credentials, GET /dashboard, /profile, /wardrobe, /catalog, /outfits, /recommendations, /recommendations/saved, /try-on/jobs and /account/deletion: 401. No hosted data was read or written.
- Browser preflight from http://localhost:8099 with Authorization/Content-Type: 200, exact allowed origin. Unapproved origin: 400. No wildcard or cookie credential allowance.
- Expo /, /preview, /try-on?preview=1 and /oauth-callback returned HTML 200. Actual Expo JavaScript bundle compiled and returned 200 (about 5.4 MB development bundle). These HTTP checks do not execute React in a browser.
- Browser automation was attempted but Work settings report local browser use disabled. No visual inspection, navigation interaction, console inspection or real signed-in submission/history is claimed. Physical Android device is unavailable.
- API startup/request logs and Metro compilation output were inspected; no application stack trace remained. NODE MODULE_TYPELESS/Metro color warnings and Starlette TestClient deprecation are tool warnings, not acceptance failures.

## Problems found and corrected

CORS configuration was absent: added an explicit validated origin allowlist, tested preflight and unauthorized behavior. A new privacy route initially imported a nonexistent theme barrel: corrected to the existing shared Screen styles, then repeated export/typecheck/lint. Google OAuth after local sign-out now explicitly adopts the returned session and restarts foreground refresh. A real-SDK PKCE regression revealed flow-specific verifier slots in installed Supabase Auth; callback now forwards sb_flow_id explicitly so native return paths select and remove the correct verifier without borrowing another flow. Failed/missing flow slots fail closed. Web tokens remain memory-only.

Retention SQL tests found an ambiguous record/table alias and a test-fixture deferred-trigger conflict; both were corrected and the complete database suite repeated. Worker authorization is tested as service_role through the exact wrapper, with schema lookup explicitly granted but ordinary table access still revoked.

Moderate glob/minimatch advisories in Expo and lint build tooling were corrected using narrow dependency overrides, retaining SDK 58. Full npm audit reports zero advisories. Advisory references: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 and https://github.com/advisories/GHSA-g3hv-75wg-m249. Lockfile changed intentionally. Full tests/export validate compatibility; no SDK downgrade or audit force-fix was used.

## Automated evidence and limits

Backend 397 passed; generic run's 307 PostgreSQL skips are executed separately: 307 passed in a fresh disposable cluster applying every local migration. Frontend SDK/workflow suite 60 passed, including real installed Supabase SDK with injected test transport, not actual hosted Auth. Typecheck, lint, Python compilation and Android Hermes export pass. pip check passes for dependency consistency; Python vulnerability scanning is not claimed. Final frontend verification uses Node 24.22.2, avoiding the host's unsupported Node 25 engine.

Local SQL fixtures emulate minimal Supabase interfaces. They verify actual PostgreSQL constraints, privileges and forced RLS, not hosted gateway behavior, mail delivery, real Storage bytes or configured worker scheduling. API/SDK tests intentionally use isolated test transports; production code has no mock fallback. No installable signed APK/AAB or device testing was completed. See hosted handoff and Android internal-testing instructions for explicit remaining dependencies.

Accepted deletion also clears local personal/photo drafts, hides normal protected screens and invalidates normal in-flight request results. Only exact GET /account/deletion remains allowed in that session; SDK sign-out remains available. Server lifecycle/RLS enforcement remains authoritative. This local cache safeguard has no hosted dependency.
