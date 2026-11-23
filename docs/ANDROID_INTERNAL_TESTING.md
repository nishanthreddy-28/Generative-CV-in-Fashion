# Android internal-testing preparation

Updated 2026-11-09. The signed Preview APK passed artifact verification. Device installation and Play submission remain pending.

- Expo SDK 58 / app version 0.4.1. Android application ID `com.drapedrop.app`, initial versionCode 1. This is the configured candidate identifier; verify ownership/availability in Play Console before the first signed upload. Do not change it after publishing without treating that as a different application.
- `mobile/eas.json` defines preview/internal APK and production AAB profiles. Production auto-increments the local versionCode. The existing app is linked to `@nishanthreddy28s-team/drapeanddrop` (`a3438576-3a83-41f1-9143-e5d53fa87e41`). Expo provisioned a managed Android signing key for the existing app ID. No dev-client profile is advertised because expo-dev-client is not installed.
- `mobile/app.config.js` rejects missing or non-HTTPS API/Supabase URLs and missing publishable keys for EAS build profiles. Configure only public frontend values in the matching preview/production Expo environment; never service-role keys, worker keys, JWTs or signing credentials. Backend environment and CORS origin approval are separate.
- Scheme `drapedrop` supports auth-confirm, reset-password and oauth-callback routes. Exact redirects/templates and Google provider configuration require hosted review. Android deep-link handling must be tested in the installed app, not inferred from web export or Expo Go.
- Native sessions use SecureStore with WHEN_UNLOCKED_THIS_DEVICE_ONLY, refresh follows AppState and each API call reads the current token. Web session tokens remain memory-only; a PKCE verifier alone survives the OAuth redirect. Token restoration/refresh contracts are covered locally; physical-device secure-storage behavior is pending.
- Expo config introspection confirmed camera and microphone permissions have `tools:node="remove"`; legacy read/write external-storage permissions are capped at Android API 32. The system photo picker is used. INTERNET, VIBRATE and development SYSTEM_ALERT_WINDOW also appear in introspected configuration. Inspect the final release merged manifest before publishing; development introspection is not a signed-release manifest.

## Build and device steps still required

Use Node 24 (`mobile/.nvmrc`; CI already uses Node 24). The host default Node 25 is outside React Native 0.88's supported engine range; final frontend checks use a temporary Node 24.22.2 runtime. Do not silently rely on the host default.

1. Complete hosted foundation/security acceptance and deploy an HTTPS FastAPI endpoint. Keep DATABASE_FOUNDATION_ENABLED=false until separately approved. Confirm preview/production frontend environment values target the intended project/API.
2. With the owner's Expo account, inspect `npx eas-cli@latest whoami`; if needed the owner completes private login and reviews project linking. The current development machine has verified access to the linked project.
3. Review application ID and signing ownership, then `cd mobile && npx eas-cli@latest build --platform android --profile preview`. Configure signing privately with Expo credential management. No keystore files enter Git. An actual APK build requires this account/signing setup; the local machine currently has only Java 11 and no configured Android SDK/adb, so a local native build was not attempted.
4. Install the resulting APK on a real Android device. Test signup, confirmation links, Google OAuth return, recovery, secure session restoration, foreground refresh, Back navigation, photo selection/cancel, authenticated images, CRUD/filtering, recommendations/bookmarks, try-on queue/cancel/expiry, and account-deletion denial/progress. Do not mark any passed without observed evidence.
5. Prepare Play Console internal testing and the production AAB using the production profile only after acceptance. Confirm versionCode progression and inspect the merged manifest, network configuration and signing certificate. Do not submit automatically.
6. Before store review: publish a public privacy-policy URL and external account-deletion instructions/contact; review Data Safety declarations against actual Auth, measurements, private photos, retention and trusted cleanup operations; supply app access/reviewer instructions and store listing/screenshots; complete applicable Play account/testing requirements. These depend on the owner's Console account and current Play requirements; no completed declaration or guaranteed approval is asserted.

## Local evidence

Android JavaScript/Hermes export succeeds. This produces a bundle, not an APK/AAB. Config introspection validates the package/version and permission removal markers. Build-time guards reject missing configuration and loopback URLs. Physical device, signed build, installed deep links, hosted photo picker/storage flow and Play acceptance remain unverified.

Sources checked for SDK 58: [app configuration](https://docs.expo.dev/versions/v58.0.0/config/app/), [image picker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [build profiles](https://docs.expo.dev/build/eas-json/). Recheck store requirements before submission.

## Preview backend selection

The internal Preview profile builds a standalone APK and embeds the current hosted API origin `https://drape-drop-api.onrender.com` and the development Supabase project `https://xpqhqhpqzkjaycraukrj.supabase.co`. Its public key matches that existing development project. It does not use the Mac’s local API or Supabase. The production build profile was not edited. The build has no configured hosted registration coordinator. Hosted customer data and social login remain gated by their existing configuration and backend acceptance.

The first cloud attempt failed at Read app config with no Expo Preview environment values and no installable artifact. The updated profile explicitly supplies the existing public HTTPS settings and disables dotenv loading so local values cannot slip into the artifact. No private signing material is included in the source tree.

When a signed APK is available, open its Expo build page on the phone, download the APK and tap the downloaded file. Android may prompt you to allow installs from the browser or Files app. You can turn that permission off after installing. The Expo preview profile bundles the app and does not require Expo Go or the development server. See [Expo APK instructions](https://docs.expo.dev/build-reference/apk/).

## Verified preview APK

Expo build `330bb690-1ddf-4f53-987f-ebc7635a02bd` finished and produced the installable `DrapeDrop-preview-0.4.1.apk` (92,833,733 bytes). Download it from the [verified Expo build page](https://expo.dev/accounts/nishanthreddy28s-team/projects/drapeanddrop/builds/330bb690-1ddf-4f53-987f-ebc7635a02bd). Google's `apksigner` verified the v2 signature with one signer. The archive integrity, manifest, native libraries, app ID, version and bundled JavaScript were checked. The bundled HTTPS origins match the configured Render API and development Supabase project. The APK supports Android API 24 and higher and includes arm64, ARMv7, x86 and x86_64 libraries. It has package `com.drapedrop.app`, version name `0.4.1`, version code `1` and target API `36`.

SHA-256 `c62c7f547fbdf91b236440a2be6a9dcbc675ab09ca9115b953edad71e4d6e629`.

The final build includes the local signup request fix and dark public theme. Physical-device installation, callback handling and hosted authenticated workflows have not yet been verified.
