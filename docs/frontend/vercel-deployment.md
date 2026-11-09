# Drape & Drop on Vercel

The existing Vercel project is [drape-drop](https://vercel.com/nishanthreddy-28s-projects/drape-drop), linked to `nishanthreddy-28/Generative-CV-in-Fashion`. Both the [failed Production build](https://vercel.com/nishanthreddy-28s-projects/drape-drop/3UYekAyuuPNapP9FyRLY1H94iQHg) and the [failed Preview build](https://vercel.com/nishanthreddy-28s-projects/drape-drop/EUxqGEWyLCaJNwiDS3tYNehe36Pe) stopped before installing dependencies because the project still pointed at the removed `frontend` directory. The dashboard also had a legacy Vite preset and no project environment variables.

## Build configuration

Set **Settings → Build and Deployment → Root Directory** to `mobile` and use Node **24.x**. The checked-in `mobile/vercel.json` specifies Other (framework null), `npm ci --legacy-peer-deps`, `npm run build`, and output `dist`. The Expo Metro single-page export serves generated assets directly and falls back to the app shell for client routes, including Auth callbacks and refreshes on detail pages. [Expo publishing guide](https://docs.expo.dev/guides/publishing-websites/#vercel)

On Node 24, run this from the repository:

```sh
cd mobile
npm ci --legacy-peer-deps
DRAPE_WEB_MODE=review npm run build
```

CI runs the same review export after the Android artifact upload. Expo ignores local dotenv files in this build command. Review mode also drops API and Supabase configuration from the export process, and the UI indicates that accounts and wardrobe data are unavailable.

## Preview and Production settings

Under **Settings → Environment Variables**, set the non-secret `DRAPE_WEB_MODE=review` in both scopes for visual review. Preview and Production can be switched independently. For connected deployment, set `DRAPE_WEB_MODE=connected` in the target scope and provide:

- `EXPO_PUBLIC_API_URL` with that environment's externally hosted FastAPI HTTPS origin. Use a staging API for Preview and a production API for Production.
- `EXPO_PUBLIC_SUPABASE_URL` with the matching Supabase HTTPS project origin.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with that project's `sb_publishable_` key.
- `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=false` until the target project's Google provider and callbacks pass acceptance.

These Expo values are public build inputs. Management tokens, database passwords, private keys and worker credentials belong outside the Vercel frontend project. Connected builds reject missing configuration, HTTP and local origins, URL credentials, and keys outside the publishable format. Rebuild after changing the target's variables.

## External API and Auth

Vercel serves the web bundle and assets. Deploy FastAPI separately with its matching Supabase/JWT configuration. Set its `API_CORS_ORIGINS` JSON list to the exact approved frontend origins for that API. Use a stable Preview alias when enabling connected Preview to avoid allowing arbitrary deployment origins. The client sends bearer tokens to FastAPI and uses Supabase directly for Auth. Web sessions are held in memory, with temporary PKCE verifier storage for redirects.

Set the exact Supabase web redirect allowlist for each approved origin and the `/auth-confirm`, `/reset-password` and, once enabled, `/oauth-callback` paths. Confirmation and recovery require the documented token-hash email templates. Validate Google PKCE redirect matching including the flow ID before exposing the button.

Dashboard, profile/body/preferences, wardrobe/catalog and image operations, outfits, recommendations, try-on jobs and deletion status require FastAPI. Account deletion completion and image retention need the separately scheduled trusted cleanup workers. Try-on supports job tracking without an inference worker. Keep `DATABASE_FOUNDATION_ENABLED=false` until hosted acceptance and explicit approval.

Verify Preview first. In each environment, open the root and refresh `/privacy`, `/reset-password`, and a protected route. Check that images and JavaScript load and that the protected route sends signed-out visitors to sign-in. Connected acceptance additionally needs real HTTPS API and Auth settings, a CORS preflight, signed-out API rejection, and approved test accounts.
