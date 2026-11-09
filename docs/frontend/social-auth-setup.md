# Public account pages and social authentication

The landing, login and signup pages default to a warm light editorial palette, with an explicit light/dark appearance switch on each page. The non-sensitive preference persists locally across navigation and refresh (browser local storage; native SecureStore). Storage failure leaves the in-memory switch usable. Other customer pages retain their existing light theme; this public-page switch does not claim full-app dark support. The signup flow remains email first with independent link and code verification before password selection.

## Current runtime boundary

Read-only Auth settings requests returned HTTP 200 for both the isolated local project and hosted xpqhqhpqzkjaycraukrj. Both reported Google and Apple disabled. Controls require an explicit frontend rollout setting and a positive server settings response. Missing, failed or non-boolean responses keep controls hidden. Review builds remove social rollout settings and Auth configuration.

The client implements Google and Apple through Supabase PKCE. Both use the SDK flow-specific verifier and the oauth-callback route. Provider cancellation and missing callbacks display a return-to-sign-in action. The shared session provider checks the backend account projection before admitting a social session. A denied identity is signed out locally. Roles and ownership never come from client-selected provider values or editable metadata.

## Required owner setup

1. In Google Cloud, configure the OAuth consent application, test users or publication status, and an OAuth web client. Add the exact Supabase callback URI `https://xpqhqhpqzkjaycraukrj.supabase.co/auth/v1/callback`. Configure the private client ID and secret in Supabase Authentication Providers Google.
2. In Apple Developer, configure the primary Sign in with Apple App ID, web Services ID, domain association and return URL. The return URL is the same Supabase Auth callback. Configure the Services ID and signed client secret in Supabase Authentication Providers Apple. Plan rotation of Apple's expiring signing secret using the supported provider setup.
3. In Supabase Authentication URL Configuration, allow the exact frontend callback `https://drape-drop-eta.vercel.app/oauth-callback`, approved stable Preview callbacks, local development callback `http://localhost:8082/oauth-callback`, and installed native callback `drapedrop://oauth-callback` as appropriate. Test the SDK's sb_flow_id query matching without broadening the allowlist unnecessarily.
4. Review application eligibility before enabling providers. Current SQL requires a dual-email receipt. New Google or Apple identities cannot yet receive an approved alternative receipt. This remains a backend/security architecture decision. Preserve current email-password verification and explicitly decide treatment of returning linked identities, Apple private relay addresses, disabled/deleting accounts, and existing accounts. The frontend cannot supply that authorization.
5. After provider and eligibility acceptance, set the relevant public rollout value to true in the correct frontend environment. `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` and `EXPO_PUBLIC_APPLE_AUTH_ENABLED` default false. Verify actual provider settings, new/returning users, cancellation, replay, expiry, native return and account isolation before release.

Provider secrets belong only in the provider console and Supabase. No hosted provider or account changes were performed for this frontend checkpoint.

Sources consulted are [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## Acceptance still required

Live OAuth requires provider credentials and the approved eligibility path. The provider glyphs and focus states still require cross-platform visual review with configured controls; disabled controls were not artificially enabled for screenshots. Native provider return paths remain unverified.

## Local browser verification — 2026-11-09 (Asia/Kolkata)

Browser access was restored for this review, superseding the earlier unavailable-browser limitation. The application was inspected at `http://localhost:8082` using 390 × 844 and 1280 × 900 viewports. Signup was also inspected at 320 × 760. The desktop view intentionally retains the existing centered phone-width application frame. Landing imagery loaded, the measured 390px document did not overflow horizontally, and the three public pages shared the dark palette and header.

- Clicked Discover and Get started from the landing page, and navigated between signup, login and home.
- Confirmed empty-email signup validation. A fresh disposable local email submission reached the verification route. That route then displayed “We couldn’t restore this attempt.” The cause was not established in this scoped UI task; complete signup is **not** accepted. No new password was set and the existing dual-proof requirements were preserved.
- Signed in with the existing isolated local review account, reached its actual dashboard, then signed out through the confirmation action. Password show/hide was exercised. This does not establish hosted login or account creation acceptance.
- Both social providers stayed hidden, consistent with their disabled local and hosted settings. No live provider round trip was claimed.
- Frontend checks: 80 tests passed, zero failed/skipped; typecheck and lint passed without warnings after import cleanup. The production web export passed in explicit review mode with the documented external API URL; this is build evidence, not a connected hosted deployment.

Screenshots are stored outside the repository under the session visualization directory: `cohesive-mobile-landing.png`, `cohesive-mobile-login.png`, `cohesive-desktop-landing.png`, `cohesive-desktop-login.png` and `cohesive-desktop-signup.png`.

The frontend and backend local processes were left running for personal review. No hosted settings, data, migrations, production registration flags or backend implementation were changed by this public-page work.

## Appearance correction and frontend checkpoint — 2026-11-09

This review supersedes the dark-only public-page direction above. Light is the default for a new installation/browser preference. Dark is optional, not forced by the system. The public appearance choice is independent of account identity and never stores credentials.

The landing now leads with the headline and Get started / Discover actions, followed by a bounded image at its original 4:5 proportions. This removes the previous square crop. Login/signup use compact forms and a restrained text footer instead of the cramped portrait panel. Existing email-first signup and account-access checks remain intact.

Browser evidence: inspected light landing, login and signup at 390 × 844 and 1280 × 900, plus landing/login at 320 × 760. The narrow document measured exactly 320px without horizontal overflow. Image load completion and original dimensions were checked. Switched to dark, navigated to signup/login, refreshed, confirmed the saved dark choice, then returned the review tab to light. Empty-email signup validation still displayed its field error. The signup restoration failure described above remains unresolved; these appearance changes do not claim to fix registration or enable social providers.

Fresh checks: 80 frontend tests passed; typecheck, lint and the explicit review-mode web production export passed. A backend regression invocation also passed 406 tests, with 315 database cases skipped in that ordinary invocation; no PostgreSQL suite or hosted acceptance was claimed for this UI correction.

The Git checkpoint covers the pending mobile frontend source, local public imagery, client authentication support and this document. Older backend, database-verification and project-audit working changes are deliberately left untouched and uncommitted in this frontend-only checkpoint. GitHub synchronization does not imply a successful hosted deployment or production authentication acceptance.
