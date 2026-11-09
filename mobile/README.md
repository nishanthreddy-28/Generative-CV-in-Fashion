# Drape & Drop mobile
Android first, built with Expo SDK 58, React Native, TypeScript and Expo Router.

## Run
Use Node 24 LTS (`.nvmrc`). Node 25 is outside this Expo SDK’s supported range.

```sh
npm ci --legacy-peer-deps
npm start
```
Use a compatible Android development build or emulator. Android SDK is required for local native builds. See https://docs.expo.dev/develop/development-builds/introduction/.

## Verify
```sh
npm run typecheck
npm run lint
npm test
npm run export:android
```

## Current scope
The customer app covers authentication, dashboard, personal and body profiles, preferences, wardrobe, catalog, outfits, recommendations, try-on job tracking, and trusted catalog administration. Personal and administrator routes are protected. The public website review build displays a service availability notice.

Supabase Auth is wired for email/password signup, confirmation, recovery, login/logout, refresh, and native secure session restoration. Google OAuth code is gated pending provider and callback verification. Web sessions end on reload. The FastAPI workflows and PostgreSQL policies have local test coverage. Hosted persistence remains gated by `DATABASE_FOUNDATION_ENABLED=false`, and try-on inference is deferred. See [customer experience](../docs/frontend/customer-experience.md), [Auth setup](../docs/backend/frontend-supabase-auth-integration.md), and the [current checklist](../docs/REMAINING_FULL_STACK_CHECKLIST.md).

Configure `.env` privately using the API origin, Supabase project origin and publishable key template. Never bundle privileged credentials. The public introduction does not load private records. Enable the database feature only after hosted acceptance and approval.

The candidate Android package is `com.drapedrop.app`. See [Android internal testing](../docs/ANDROID_INTERNAL_TESTING.md) for signing, device checks and Play Console preparation.

## Preview the implemented screens in a browser
```sh
npm run web -- --localhost --port 8081
```
Open http://localhost:8081/ on the development computer. Review the welcome, account and privacy screens. Reviewing personal screens requires an authorized account and usable backend configuration.

The preview server must remain running. This localhost URL is not a publicly hosted deployment.

## Drafts and versions
Non-password editing drafts are held only in session memory across screen navigation. Closing/reloading the app clears them; sign-in changes and sign-out also clear them. No personal draft is written to a local database. Discard resets a draft explicitly.

Version history is in [the ledger](../docs/VERSIONS.md). Version 0.4.0 is a frontend preview; device, Figma and backend integration checks remain explicit in its release note.

For the hosted visual review, use the [Vercel Production site](https://drape-drop-eta.vercel.app/). Welcome, sign-in, registration and recovery pages use compact mobile layouts. Credential submissions stay gated until the approved Auth integration is ready. Service status controls are kept outside customer screens. The current Render Free instance can take about a minute to wake after idle. See the [deployment runbook](../docs/frontend/vercel-deployment.md) for configuration and verification.
