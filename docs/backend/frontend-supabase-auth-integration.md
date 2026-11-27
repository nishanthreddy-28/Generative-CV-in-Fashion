# Frontend Supabase Auth integration

The Expo app now uses Supabase Auth for email/password signup, sign-in, local sign-out, session refresh and email recovery. FastAPI v0.2.0 remains the authority for business requests and account eligibility.

## Developer setup

Copy `mobile/.env.example` to `mobile/.env`. Set `EXPO_PUBLIC_SUPABASE_URL` to the HTTPS project origin and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the corresponding `sb_publishable_` key. Set `EXPO_PUBLIC_API_URL` separately to reach FastAPI. Expo public variables are bundled into the client. Keep Management API tokens, service-role keys, database passwords and refresh tokens out of these variables and source control.

Build the Expo app with SecureStore included and the existing `drapedrop` scheme registered. Use a native development build to exercise email callbacks and storage. Web sessions use memory for the lifetime of the page. A page reload requires sign-in again.

In the development Supabase project, review email/password and email confirmation settings and configure email delivery. Allowlist the exact native destinations `drapedrop://auth-confirm` and `drapedrop://reset-password`. For web testing, allowlist the same paths on the specific development origin. Use HTTPS for deployed web origins.

The confirmation and recovery email templates must link to the requested callback using the one-time token hash. In both templates, point the action link to:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Continue in Drape &amp; Drop</a>
```

The routes use the dedicated confirmation and recovery destinations, respectively. The default email template's callback format may differ. The implementation expects `token_hash` and explicitly calls `verifyOtp`. [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) · [Mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)

## Session lifecycle and link handling

- The provider waits for Supabase's initial session event before allowing access through the existing screen gates. Signup without a session prompts for email confirmation. Confirmation uses a temporary Auth client and returns the user to sign-in. A signup session, when Supabase returns one, establishes authentication. FastAPI still controls whether the account can use application data.
- Native session data uses Expo SecureStore with device-only Keychain accessibility where supported. The adapter splits large session payloads into bounded chunks and publishes a new manifest only after writing the replacement. Browser persistence is disabled. [Expo SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/)
- The primary client runs SDK-managed auto-refresh in the foreground and stops it in the background. Concurrent requests use the same SDK session authority. Each business request obtains the current session through `getSession`, verifies it still belongs to the initiating app identity, checks expiry, and sends only the access JWT via the existing shared API client. Business requests retain their current paths, bodies, timeout and response handling. Requests are not automatically replayed after a 401. [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- Local sign-out closes the session gate and clears account drafts immediately. The SDK attempts server revocation for this session. Server revocation can fail offline, and already issued access JWTs may remain valid until expiry.
- Expo Router receives confirmation and reset links. Each route accepts a single well-formed token hash, and the user confirms the action before the app consumes it. Recovery requires an Auth-verified recovery session before the new password form is available. This short-lived in-memory session is separate from the primary app session and cannot be forwarded to FastAPI by the app. Leaving or restarting the app during recovery can require a fresh link. Auth access and refresh tokens are never accepted from URL parameters. Keep callback URLs and one-time link hashes out of analytics and logs. Use verified Android App Links or iOS Universal Links for production to reduce custom-scheme interception risk.
- Auth email verification is performed by Supabase. The client does not use JWT decoding or user metadata to establish email confirmation, application eligibility or administrator permission.

## API contract impact and remaining decisions

The frontend stops calling the legacy custom login, signup, forgot-password, reset-confirmation and logout endpoints. Backend routes and the API audit are unchanged. Supabase requests use the Auth SDK. The existing signed-in password-change form remains in workflow preview. Real users are directed to email recovery pending approval of a current-password change and reauthentication flow. The app no longer submits a password to the legacy FastAPI endpoint.

Backend v0.2.0 does not implement `/auth/me` or an application bootstrap endpoint. The client does not call either or attempt to provision a profile. Admin access stays closed in the live UI until there is an approved trusted membership projection. Account deletion retains its existing `DELETE /account` contract and remains dependent on backend implementation.

## Verification and hosted status

`npm test` passed all 19 tests. `npm run typecheck`, `npm run lint` and Expo Android export also passed. Dependency installation reported 12 moderate npm audit findings and engine warnings under Node 25. The repository specifies Node 24.

Local automated coverage uses the real Supabase SDK with intercepted HTTP, plus in-memory storage fixtures for the native adapter. It covers confirmation-required signup, login and mapped failures, restoration, sign-out, refresh deduplication, concurrent JWT forwarding, invalid/expired or superseded sessions, recovery-link validation and isolation, missing configuration, privileged-key rejection and large secure-storage payloads. These tests do not exercise native SecureStore or mount the screen gates on a physical device.

Hosted Auth email flows, Android link dispatch, process restart with native storage, and FastAPI acceptance of a hosted user JWT are pending. Before accepting the integration, exercise signup, confirmation, login, app restart, foreground/background refresh, logout, expired and reused recovery links, and password reset with a developer-provided test account and configured Auth project. Validate a post-refresh FastAPI request after the separate backend integration milestone is ready. The Management API migration-history check remains outside this task.
