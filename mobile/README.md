# Drape & Drop mobile
Android first, built with Expo SDK 58, React Native, TypeScript and Expo Router.

## Run
Use Node 24 LTS (`.nvmrc`). Node 25 is outside this Expo SDK’s supported range.

```sh
npm ci
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

Real authentication, persistence, email delivery and AI results require backend integration. Google sign-in is an explicit integration placeholder. Sessions are held in memory only. See [workflow checkpoint](../docs/issues/002-frontend-workflows-checkpoint.md) and [API contract](../docs/frontend-api-contract.md).

Copy `.env.example` to `.env` only when a compatible API exists. Public introduction and workflow preview screens do not load private records.

The Android application ID, icons, signing and Play Console configuration must be finalized before a release build. No production identifier is committed yet.

## Preview the implemented screens in a browser
```sh
npm run web -- --localhost --port 8082
```
Open http://localhost:8082/preview on the development computer. This renders the actual React Native screens through React Native Web; it is not Android device verification. Use the workflow index to inspect account forms, empty collections, draft editors, and integration notices.

The preview server must remain running. This localhost URL is not a publicly hosted deployment.
