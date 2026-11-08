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
Frontend screens cover account forms, dashboard, personal and body profiles, wardrobe, catalog, outfits, recommendations, try-on, preferences and administration. Open `/preview` to review all flows without a backend. Preview uses no fabricated records and never submits changes.

Supabase email/password Auth source is integrated: signup, confirmation/recovery callbacks, login/logout, refresh and native secure session restoration. Hosted email/callback and device acceptance remain pending. Native sessions use SecureStore; web sessions end on page reload. Google sign-in is unavailable. Business persistence is limited to the locally tested FastAPI profile/preferences foundation, which stays disabled pending hosted verification. Wardrobe/catalog/outfit/job APIs and AI processing are not implemented. See [current workflow status](../docs/WORKFLOW_STATUS.md), [Auth setup](../docs/backend/frontend-supabase-auth-integration.md) and the preserved [35-contract inventory](../docs/backend/api-requirements.md).

Configure `.env` privately using the API origin, Supabase project origin and publishable key template. Never bundle privileged credentials. A reachable API does not supply missing routes or authorize enabling the database flag. Public introduction and workflow preview screens do not load private records.

The Android application ID, icons, signing and Play Console configuration must be finalized before a release build. No production identifier is committed yet.

## Preview the implemented screens in a browser
```sh
npm run web -- --localhost --port 8082
```
Open http://localhost:8082/preview on the development computer. This renders the actual React Native screens through React Native Web; it is not Android device verification. Use the workflow index to inspect account forms, empty collections, draft editors, and integration notices.

The preview server must remain running. This localhost URL is not a publicly hosted deployment.

## Drafts and versions
Non-password editing drafts are held only in session memory across screen navigation. Closing/reloading the app clears them; sign-in changes and sign-out also clear them. No personal draft is written to a local database. Discard resets a draft explicitly.

Version history is in [the ledger](../docs/VERSIONS.md). Version 0.4.0 is a frontend preview; device, Figma and backend integration checks remain explicit in its release note.
