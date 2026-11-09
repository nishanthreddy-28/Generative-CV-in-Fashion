# Android internal-testing preparation

Local preparation, 2026-11-09. No Play release, signing key, cloud build or physical-device acceptance is claimed.

- Expo SDK 58 / app version 0.4.1. Android application ID `com.drapedrop.app`, initial versionCode 1. This is the configured candidate identifier; verify ownership/availability in Play Console before the first signed upload. Do not change it after publishing without treating that as a different application.
- `mobile/eas.json` defines preview/internal APK and production AAB profiles. Production auto-increments the local versionCode. There is no EAS project/account link or signing credential configured by this task. No dev-client profile is advertised because expo-dev-client is not installed.
- `mobile/app.config.js` rejects missing or non-HTTPS API/Supabase URLs and missing publishable keys for EAS build profiles. Configure only public frontend values in the matching preview/production Expo environment; never service-role keys, worker keys, JWTs or signing credentials. Backend environment and CORS origin approval are separate.
- Scheme `drapedrop` supports auth-confirm, reset-password and oauth-callback routes. Exact redirects/templates and Google provider configuration require hosted review. Android deep-link handling must be tested in the installed app, not inferred from web export or Expo Go.
- Native sessions use SecureStore with WHEN_UNLOCKED_THIS_DEVICE_ONLY, refresh follows AppState and each API call reads the current token. Web session tokens remain memory-only; a PKCE verifier alone survives the OAuth redirect. Token restoration/refresh contracts are covered locally; physical-device secure-storage behavior is pending.
- Expo config introspection confirmed camera and microphone permissions have `tools:node="remove"`; legacy read/write external-storage permissions are capped at Android API 32. The system photo picker is used. INTERNET, VIBRATE and development SYSTEM_ALERT_WINDOW also appear in introspected configuration. Inspect the final release merged manifest before publishing; development introspection is not a signed-release manifest.

## Build and device steps still required

Use Node 24 (`mobile/.nvmrc`; CI already uses Node 24). The host default Node 25 is outside React Native 0.88's supported engine range; final frontend checks use a temporary Node 24.22.2 runtime. Do not silently rely on the host default.

1. Complete hosted foundation/security acceptance and deploy an HTTPS FastAPI endpoint. Keep DATABASE_FOUNDATION_ENABLED=false until separately approved. Confirm preview/production frontend environment values target the intended project/API.
2. With the owner's Expo account, inspect `npx eas-cli@latest whoami`; if needed the owner completes private login and reviews project linking. Linking/signing setup is an external step, not performed here.
3. Review application ID and signing ownership, then `cd mobile && npx eas-cli@latest build --platform android --profile preview`. Configure signing privately with Expo credential management. No keystore files enter Git. An actual APK build requires this account/signing setup; the local machine currently has only Java 11 and no configured Android SDK/adb, so a local native build was not attempted.
4. Install the resulting APK on a real Android device. Test signup, confirmation links, Google OAuth return, recovery, secure session restoration, foreground refresh, Back navigation, photo selection/cancel, authenticated images, CRUD/filtering, recommendations/bookmarks, try-on queue/cancel/expiry, and account-deletion denial/progress. Do not mark any passed without observed evidence.
5. Prepare Play Console internal testing and the production AAB using the production profile only after acceptance. Confirm versionCode progression and inspect the merged manifest, network configuration and signing certificate. Do not submit automatically.
6. Before store review: publish a public privacy-policy URL and external account-deletion instructions/contact; review Data Safety declarations against actual Auth, measurements, private photos, retention and trusted cleanup operations; supply app access/reviewer instructions and store listing/screenshots; complete applicable Play account/testing requirements. These depend on the owner's Console account and current Play requirements; no completed declaration or guaranteed approval is asserted.

## Local evidence

Android JavaScript/Hermes export succeeds. This produces a bundle, not an APK/AAB. Config introspection validates the package/version and permission removal markers. Build-time guards reject missing configuration and loopback URLs. Physical device, signed build, installed deep links, hosted photo picker/storage flow and Play acceptance remain unverified.

Sources checked for SDK 58: [app configuration](https://docs.expo.dev/versions/v58.0.0/config/app/), [image picker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [build profiles](https://docs.expo.dev/build/eas-json/). Recheck store requirements before submission.
