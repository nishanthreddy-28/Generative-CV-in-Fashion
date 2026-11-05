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
npm run export:android
```

## Current scope
Introduction and a clear authentication-unavailable screen. No sign-in, account persistence, personal data, backend, ML, or Play Store release is implemented.
Copy `.env.example` to `.env` when an API exists. No requests run from these public introduction screens. `src/services/api/client.ts` is the future integration boundary.

The Android application ID, icons, signing and Play Console configuration must be finalized before a release build. No production identifier is committed yet.

## Preview the implemented screens in a browser
```sh
npm run web -- --localhost --port 8081
```
Open http://localhost:8081 on the development computer. This renders the actual React Native screens through React Native Web; it is not Android device verification. Click **Get started** to inspect the authentication-unavailable screen, then use Back to return.

The preview server must remain running. This localhost URL is not a publicly hosted deployment.
