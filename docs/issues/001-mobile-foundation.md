# Issue 001: Android mobile foundation
Status: implementation verified; awaiting review and Android device validation (local issue specification; not created on GitHub)
Branch: feature/mobile-foundation

## Decisions
- Android first; iOS later.
- Introduction is public; personal features require sign-in.
- React Native + Expo + TypeScript replaces the web frontend.
- No mock user data or demo authentication.
- Next authentication UI: email/password and Google.
- Visual feedback: more expressive and fashion-focused; larger editorial imagery.

## Acceptance criteria
- TypeScript and lint pass.
- Android JavaScript export succeeds.
- Introduction navigates to an honest authentication-unavailable screen.
- API service handles missing configuration, HTTP failure, cancellation and timeout.
- Figma introduction direction is available for review.

## Review checkpoints
1. Mobile foundation and introduction (current).
2. Figma visual approval, authentication UI and session integration boundary.
3. Body profile, wardrobe and catalog.
4. Recommendations and virtual try-on.
5. Settings, administration and release preparation.

Device verification and signed Android build are still required. Milestone tags follow verification and review.

## Verification — November 5, 2026
Using isolated Node 24.22.2:
- `npm run typecheck`: passed.
- `npm run lint`: passed with ESLint 9; ESLint 10 was incompatible with Expo's React plugin.
- `npm run export:android`: passed; 1,149 modules, Hermes bundle exported.
- `npx expo install --check`: local map passed; network validation was unavailable in sandbox.
- API failure checks: missing configuration, network failure and pre-cancelled request passed.
- `git diff --check`: passed.
- Figma screenshot inspected after editorial-image revision.

Not verified: Android device interaction, native signed build, authentication, Play Console submission. No release tag created.

The machine has Java 11 and no Android SDK. Local native builds need Android tooling; cloud builds require a future Expo project/account setup. An isolated Node 24 runtime was used; the global Node installation was not changed.
