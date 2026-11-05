# Backend API requirements from the existing frontend

Inspected November 5, 2026. Source baseline: commit `d61b780` (`v0.4.0-frontend-verification-preview`), package version 0.4.0. This document describes the actual React Native/Expo implementation in `mobile/src`, not an implemented backend. Only this document is created for this task; frontend changes and backend implementation require discussion first. Admin endpoints are inventoried for completeness; admin workflow approval is deferred.

## 1. Evidence and interpretation

Inspected all route files under `mobile/src/app`, shared screens/features, components, hooks, types, API client/services, app configuration and environment example. Principal sources:

- [`client.ts`](../../mobile/src/services/api/client.ts): sole `fetch` transport, HTTP handling, timeout.
- [`resources.ts`](../../mobile/src/services/api/resources.ts): authentication functions and generic resource wrapper.
- [`session.tsx`](../../mobile/src/features/session.tsx): login result checks, bearer requests, expiry and logout.
- [`domain.ts`](../../mobile/src/types/domain.ts): compile-time result types.
- [`schema.ts`](../../mobile/src/features/schema.ts), [`validation.ts`](../../mobile/src/features/validation.ts): form fields and payload conversion.
- [`EditorScreen.tsx`](../../mobile/src/features/EditorScreen.tsx), [`CollectionScreen.tsx`](../../mobile/src/features/CollectionScreen.tsx): generic read/write/list contracts instantiated by route files.
- [`AuthScreen.tsx`](../../mobile/src/features/AuthScreen.tsx), [`RecommendationsScreen.tsx`](../../mobile/src/features/RecommendationsScreen.tsx), [`PhotoField.tsx`](../../mobile/src/components/PhotoField.tsx), [`Screen.tsx`](../../mobile/src/components/Screen.tsx), [`useResource.ts`](../../mobile/src/hooks/useResource.ts): interactions, images, states and gates.

**Observed** means a request exists in code. **Declared only** means a service exists without a screen caller. **Decision needed** means no contract is implemented; no new endpoint is implied as settled. Error statuses below are proposed backend cases compatible with the transport, not evidence of a running server. Symbolic structures below describe fields; they are not example API data or mock responses.

## 2. Page/feature inventory

- `/`, `/preview`, `+not-found`, `_layout`: static content/navigation; no data API. Preview links expose forms with `preview=1`, not real account access.
- `/login`, `/signup`, `/forgot-password`: `AuthScreen`; login, registration, reset request. Google button displays an integration notice and makes no request.
- `/reset-password`: reset confirmation with `token` from route query.
- `/dashboard`: account-specific counts from `/dashboard`.
- `/profile`: personal profile read/update via `EditorScreen`.
- `/profile/body`: measurements, fit and self-reported appearance read/update.
- `/wardrobe`: owned garment collection; search, category, sort, cursor navigation.
- `/wardrobe/add`: multipart create with selected garment photo.
- `/wardrobe/:id`: read, multipart update and confirmed deletion.
- `/catalog`: authenticated shared catalog collection; same list controls.
- `/catalog/:id`: garment detail and navigation to `/try-on?garmentId=...&source=catalog`.
- `/outfits`: owned saved outfits collection, search/sort and cursor navigation.
- `/outfits/new`: paginated wardrobe selector; manual outfit creation.
- `/outfits/:id`: owned detail, metadata update, confirmed deletion; links garment IDs to wardrobe details.
- `/recommendations`: request tailored looks, render API results, save a returned recommendation.
- `/try-on`: wardrobe selection, optional catalog detail read, person photo submission, explicit job-status refresh and generated image display.
- `/settings`: session email (already in login response), password change, sign-out and confirmed account deletion. No settings GET on this page itself.
- `/preferences`: settings read/update through `EditorScreen`.
- `/admin`: static catalog-management links behind admin gate; no separate admin-summary API.
- `/admin/catalog`, `/admin/catalog/new`, `/admin/catalog/:id`: admin list, create, detail, update and delete via shared screens; workflow review deferred.

## 3. Shared transport and result structures

### Transport

- Base URL: `EXPO_PUBLIC_API_URL`, with trailing slash removed; paths concatenate directly. There is no automatic `/api` or `/v1` prefix. A prefix can be part of the configured base URL.
- `Accept: application/json`; JSON body sets `Content-Type: application/json`. Multipart requests omit Content-Type so the platform sets the boundary.
- Protected calls send `Authorization: Bearer <accessToken>`. No cookies/credentials mode, Supabase client, refresh token, API key or service-role key is used by the frontend.
- Default method GET; supported explicit methods POST, PATCH, DELETE. Path IDs are URL-encoded.
- Every successful response except HTTP 204 must have a content type containing `application/json` and parse as JSON. 204 returns `undefined`, including for mutations. JSON-null and missing structures can break reads; use the structures specified below.
- Mutation callers generally discard response bodies. Where stated, “ignored success body” means any valid JSON response or 204 currently works, not that a particular backend envelope is established.
- Transport deadline: 20 seconds including uploads. Cancellation stops the client request; it does not prove the server rolled back a write. No idempotency keys or automatic retries are implemented. Read screens provide manual retry.
- Type assertions do not validate response JSON at runtime. Only login checks token presence, user ID and recognized role (not complete field types).
- Web preview requires a CORS decision for its development origin and Authorization/Content-Type headers; native Android is not browser CORS. Production must use HTTPS. No production host is configured.

### Referenced shapes

- `User`: `{ id: string, email: string, name?: string, role: "user" | "admin" }`.
- `Session`: `{ user: User, accessToken: string }` (camelCase).
- `Garment`: `{ id: string, name: string, category: string, color?: string, brand?: string, imageUrl?: string, notes?: string, size?: string, material?: string, price?: number }`. No owner ID, image storage key, classification state, currency or timestamps are consumed.
- `Outfit`: `{ id: string, name: string, garmentIds: string[], description?: string, imageUrl?: string, occasion?: string }`.
- `Page<T>`: `{ items: T[], nextCursor?: string | null }`; always return `items`, including `[]` for an empty collection. No total count/page number is consumed. Empty/absent nextCursor ends pagination.
- `Dashboard`: `{ wardrobeCount: number, savedOutfitCount: number, recommendationCount: number }`.
- `Profile`: `{ name: string, style?: string, location?: string, bio?: string }`.
- Body editor read shape: flat object with `units`, `height`, `chest`, `waist`, `hips`, `inseam`, `bodyShape`, `skinTone`, `undertone`, `fit`. Numeric empty values may be null on writes. `BodyProfile` type omits appearance fields and nullable numeric values: mismatch to resolve.
- Preferences editor read shape: `{ units?: string, emailNotifications?: string }`. `Preferences.theme` exists in types but has no UI/request field.
- `TryOnJob`: `{ id: string, status: "queued" | "processing" | "completed" | "failed", imageUrl?: string, error?: string }`. Completed jobs require imageUrl to display a result; absent image triggers a UI error.

### Field sets and serialization

- Profile write: `name` required; `style`, `location`, `bio` optional strings.
- Body write: `units` required (`cm` or `in`); optional numeric `height/chest/waist/hips/inseam`, each currently validated 1–300 regardless of unit; optional `bodyShape`, `skinTone`; `undertone` one of Warm/Cool/Neutral/Not sure; `fit` Fitted/Regular/Relaxed/Oversized.
- Garment metadata: `name`, `category` required; `color`, `brand`, `size`, `material`, `notes` optional. Category: Tops/Bottoms/Outerwear/Dresses/Shoes/Accessories.
- Admin catalog metadata adds optional `price`, validated 0–1,000,000 and labeled INR. Catalog display hardcodes INR.
- Preferences write: optional `units` (`cm`/`in`) and `emailNotifications` (`Enabled`/`Disabled`), not a boolean.
- `payloadFor` sends every schema field, trims text, emits `""` for blank strings and `null` for blank numeric fields. PATCH is therefore a full form snapshot, not a sparse changed-field patch. Unknown loaded fields are not echoed.
- General text maximum: 200 characters; multiline maximum: 2,000. Password minimum: 8, including existing-password/login validation. Whitespace-only required fields fail. Email uses a basic pattern. No backend field-error mapping exists.
- Outfit builder and outfit editor send their raw string values, not `payloadFor`-trimmed values; optional fields can be absent in builder and empty strings in editor.

### Error conventions used below

`Common` = possible 401 expired/missing token, 403 forbidden, 422 validation failure, 429 throttling, 500/503 service failure. Resource APIs additionally need 404 for missing/inaccessible IDs; mutation conflicts may use 409. Uploads additionally need 413 oversized content and 415 unsupported content. These status choices are recommendations for discussion.

The client ignores every error body (including FastAPI `detail`). It maps 401/403/404/409/422 to fixed messages, every other non-2xx to a generic failure; 400, 410, 413, 415 and 429 have no dedicated presentation. Authenticated read/session requests expire local state on 401. Login/reset functions use the transport directly. Network errors, timeouts, missing configuration, bad paths and unexpected successful non-JSON responses are client-side error states, not API response schemas. An error body standard remains undecided.

## 4. API inventory

Each entry states its own method, auth, body/query, response, possible errors and caller. `id` means a URL path parameter, not an owner identifier supplied by the user.

### API 01 — `POST /auth/login`

- Status: Observed.
- Purpose: Sign in and establish in-memory session.
- Authentication/role: Public credentials exchange.
- Request: JSON { email: string, password: string }; email trimmed; password unmodified; no query.
- Expected response: Session. Login requires truthy accessToken, user.id and role user/admin; navigates to dashboard.
- Possible errors: 400/422 malformed credentials; 401 invalid credentials; 403 unverified/disabled account (decision); 429; 500/503.
- Frontend source (relative to `mobile/src/`): features/AuthScreen.tsx; features/session.tsx; services/api/resources.ts.

### API 02 — `POST /auth/signup`

- Status: Observed.
- Purpose: Request registration; UI assumes email next steps, not immediate login.
- Authentication/role: Public.
- Request: JSON { name: string, email: string, password: string }; name/email trimmed; confirm password never sent.
- Expected response: Declared { message: string }; body ignored by UI, which displays fixed instructions and clears fields.
- Possible errors: 400/422; 409 duplicate identity or enumeration-safe alternative (decision); 429; 500/503.
- Frontend source (relative to `mobile/src/`): features/AuthScreen.tsx; services/api/resources.ts.

### API 03 — `POST /auth/password-reset`

- Status: Observed.
- Purpose: Request reset email.
- Authentication/role: Public.
- Request: JSON { email: string }; trimmed.
- Expected response: Declared { message: string }; ignored; fixed enumeration-safe success text.
- Possible errors: 400/422; 429; 500/503; do not disclose whether account exists.
- Frontend source (relative to `mobile/src/`): features/AuthScreen.tsx; services/api/resources.ts.

### API 04 — `POST /auth/password-reset/confirm`

- Status: Observed.
- Purpose: Set new password from reset link.
- Authentication/role: Valid recovery token supplied in body; no bearer requirement in caller.
- Request: JSON { token: string, password: string }; token read from /reset-password?token=...; matching confirmation stays local.
- Expected response: Ignored success body; shows success, clears passwords, offers sign-in.
- Possible errors: 400/422 invalid password/token; 401 or 410 invalid/expired/used recovery token (decision); 429; 500/503.
- Frontend source (relative to `mobile/src/`): app/reset-password.tsx.

### API 05 — `POST /auth/password`

- Status: Observed.
- Purpose: Change current password.
- Authentication/role: Authenticated user, with current-password verification.
- Request: JSON { currentPassword: string, newPassword: string }; confirmation local; new must differ locally.
- Expected response: Ignored success body; UI keeps existing session and says to sign in on next session.
- Possible errors: Common; 400/401 current password mismatch semantics must be decided; 409 password reuse/policy if appropriate.
- Frontend source (relative to `mobile/src/`): app/settings.tsx.

### API 06 — `POST /auth/logout`

- Status: Observed.
- Purpose: Revoke/logout session.
- Authentication/role: Authenticated user.
- Request: No body/query.
- Expected response: Ignored success body (typed void); local session/drafts cleared in finally even on failure.
- Possible errors: Common; 401 may be treated as already signed out by server; revocation semantics undecided.
- Frontend source (relative to `mobile/src/`): features/session.tsx; app/settings.tsx.

### API 07 — `GET /auth/me`

- Status: Declared only.
- Purpose: Read current user identity.
- Authentication/role: Authenticated user.
- Request: No body/query.
- Expected response: User.
- Possible errors: Common.
- Frontend source (relative to `mobile/src/`): services/api/resources.ts authApi.me; no current screen invokes it..

### API 08 — `DELETE /account`

- Status: Observed.
- Purpose: Permanently delete own account and related personal data.
- Authentication/role: Authenticated user; stronger recent-auth requirement is undecided.
- Request: JSON { confirmation: "DELETE" }; UI typed confirmation and modal; no userId.
- Expected response: Ignored success body; success expires local session and navigates to introduction.
- Possible errors: Common; 409 deletion conflict; server must not report completion while deletion remains unfinished without a changed contract.
- Frontend source (relative to `mobile/src/`): app/settings.tsx.

### API 09 — `GET /dashboard`

- Status: Observed.
- Purpose: Read personal overview counts.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: No body/query.
- Expected response: Dashboard; actual counts including real zero values.
- Possible errors: Common.
- Frontend source (relative to `mobile/src/`): app/dashboard.tsx; hooks/useResource.ts.

### API 10 — `GET /profile`

- Status: Observed.
- Purpose: Load current user form values.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: No body/query.
- Expected response: Profile; flat object, no data wrapper. New-account default/empty-object behavior must be settled; 204 hides these editors.
- Possible errors: Common; 404 currently blocks editing, so creation/default semantics are important.
- Frontend source (relative to `mobile/src/`): app/profile/index.tsx; features/EditorScreen.tsx.

### API 11 — `PATCH /profile`

- Status: Observed.
- Purpose: Save current user form snapshot.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: JSON Profile write field set; all schema keys included; blank text "", blank numbers null.
- Expected response: Ignored success body; then GET refetch (no returned resource merge).
- Possible errors: Common; 409 concurrent update if implemented.
- Frontend source (relative to `mobile/src/`): app/profile/index.tsx; features/EditorScreen.tsx.

### API 12 — `GET /profile/body`

- Status: Observed.
- Purpose: Load current user form values.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: No body/query.
- Expected response: Body editor read shape; flat object, no data wrapper. New-account default/empty-object behavior must be settled; 204 hides these editors.
- Possible errors: Common; 404 currently blocks editing, so creation/default semantics are important.
- Frontend source (relative to `mobile/src/`): app/profile/body.tsx; features/EditorScreen.tsx.

### API 13 — `PATCH /profile/body`

- Status: Observed.
- Purpose: Save current user form snapshot.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: JSON Body write field set; all schema keys included; blank text "", blank numbers null.
- Expected response: Ignored success body; then GET refetch (no returned resource merge).
- Possible errors: Common; 409 concurrent update if implemented.
- Frontend source (relative to `mobile/src/`): app/profile/body.tsx; features/EditorScreen.tsx.

### API 14 — `GET /settings`

- Status: Observed.
- Purpose: Load current user form values.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: No body/query.
- Expected response: Preferences editor read shape; flat object, no data wrapper. New-account default/empty-object behavior must be settled; 204 hides these editors.
- Possible errors: Common; 404 currently blocks editing, so creation/default semantics are important.
- Frontend source (relative to `mobile/src/`): app/preferences.tsx; features/EditorScreen.tsx.

### API 15 — `PATCH /settings`

- Status: Observed.
- Purpose: Save current user form snapshot.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: JSON Preferences write field set; all schema keys included; blank text "", blank numbers null.
- Expected response: Ignored success body; then GET refetch (no returned resource merge).
- Possible errors: Common; 409 concurrent update if implemented.
- Frontend source (relative to `mobile/src/`): app/preferences.tsx; features/EditorScreen.tsx.

### API 16 — `GET /wardrobe`

- Status: Observed.
- Purpose: Search/filter/sort a paginated collection.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Query: search string (including empty), category string (empty means all), sort newest|name, limit=24, optional cursor; no body. Cursor is opaque to client; server must accept omitted/empty filter values. Outfits also sends category="" despite no category control.
- Expected response: Page<Garment>. Next page replaces list; first-page action clears cursor.
- Possible errors: Common; 400/422 invalid/expired cursor or filters.
- Frontend source (relative to `mobile/src/`): app/wardrobe/index.tsx; features/CollectionScreen.tsx.

### API 17 — `GET /catalog`

- Status: Observed.
- Purpose: Search/filter/sort a paginated collection.
- Authentication/role: Authenticated user in current UI; catalog is shared, not user-owned.
- Request: Query: search string (including empty), category string (empty means all), sort newest|name, limit=24, optional cursor; no body. Cursor is opaque to client; server must accept omitted/empty filter values. Outfits also sends category="" despite no category control.
- Expected response: Page<Garment>. Next page replaces list; first-page action clears cursor.
- Possible errors: Common; 400/422 invalid/expired cursor or filters.
- Frontend source (relative to `mobile/src/`): app/catalog/index.tsx; features/CollectionScreen.tsx.

### API 18 — `GET /outfits`

- Status: Observed.
- Purpose: Search/filter/sort a paginated collection.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Query: search string (including empty), category string (empty means all), sort newest|name, limit=24, optional cursor; no body. Cursor is opaque to client; server must accept omitted/empty filter values. Outfits also sends category="" despite no category control.
- Expected response: Page<Outfit>. Next page replaces list; first-page action clears cursor.
- Possible errors: Common; 400/422 invalid/expired cursor or filters.
- Frontend source (relative to `mobile/src/`): app/outfits/index.tsx; features/CollectionScreen.tsx.

### API 19 — `GET /admin/catalog`

- Status: Observed.
- Purpose: Search/filter/sort a paginated collection.
- Authentication/role: Authenticated administrator; server must verify trusted role, not client input.
- Request: Query: search string (including empty), category string (empty means all), sort newest|name, limit=24, optional cursor; no body. Cursor is opaque to client; server must accept omitted/empty filter values. Outfits also sends category="" despite no category control.
- Expected response: Page<Garment>. Next page replaces list; first-page action clears cursor.
- Possible errors: Common; 400/422 invalid/expired cursor or filters.
- Frontend source (relative to `mobile/src/`): app/admin/catalog/index.tsx; features/CollectionScreen.tsx.

### API 20 — `POST /wardrobe`

- Status: Observed.
- Purpose: Create garment with its image.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: multipart/form-data: metadata = JSON string of Garment metadata; image = required file. No query.
- Expected response: Ignored success body; navigates to collection, no returned ID consumed.
- Possible errors: Common; 413; 415; 409 duplicate if server defines uniqueness.
- Frontend source (relative to `mobile/src/`): app/wardrobe/add.tsx; features/EditorScreen.tsx; components/PhotoField.tsx.

### API 21 — `GET /wardrobe/{id}`

- Status: Observed.
- Purpose: Read garment for editing.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Path id; no body/query.
- Expected response: Garment (editor reads schema fields and imageUrl); no wrapper.
- Possible errors: Common; 404.
- Frontend source (relative to `mobile/src/`): app/wardrobe/[id].tsx; features/EditorScreen.tsx.

### API 22 — `PATCH /wardrobe/{id}`

- Status: Observed.
- Purpose: Update garment details and optionally replace image.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Path id; multipart metadata = full Garment metadata JSON string; image optional. Missing image should preserve stored image; no explicit stored-image deletion flag exists.
- Expected response: Ignored success body; navigates to collection.
- Possible errors: Common; 404; 409; 413; 415.
- Frontend source (relative to `mobile/src/`): app/wardrobe/[id].tsx; features/EditorScreen.tsx; components/PhotoField.tsx.

### API 23 — `DELETE /wardrobe/{id}`

- Status: Observed.
- Purpose: Delete selected garment after confirmation.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Path id; no body/query.
- Expected response: Ignored success body; collection navigation. Relationship cleanup/restrictions unresolved.
- Possible errors: Common; 404; 409 referenced garment/deletion conflict.
- Frontend source (relative to `mobile/src/`): app/wardrobe/[id].tsx; features/EditorScreen.tsx.

### API 24 — `POST /admin/catalog`

- Status: Observed.
- Purpose: Create garment with its image.
- Authentication/role: Authenticated administrator; server must verify trusted role, not client input.
- Request: multipart/form-data: metadata = JSON string of Admin catalog metadata; image = required file. No query.
- Expected response: Ignored success body; navigates to collection, no returned ID consumed.
- Possible errors: Common; 413; 415; 409 duplicate if server defines uniqueness.
- Frontend source (relative to `mobile/src/`): app/admin/catalog/new.tsx; features/EditorScreen.tsx; components/PhotoField.tsx.

### API 25 — `GET /admin/catalog/{id}`

- Status: Observed.
- Purpose: Read garment for editing.
- Authentication/role: Authenticated administrator; server must verify trusted role, not client input.
- Request: Path id; no body/query.
- Expected response: Garment (editor reads schema fields and imageUrl); no wrapper.
- Possible errors: Common; 404.
- Frontend source (relative to `mobile/src/`): app/admin/catalog/[id].tsx; features/EditorScreen.tsx.

### API 26 — `PATCH /admin/catalog/{id}`

- Status: Observed.
- Purpose: Update garment details and optionally replace image.
- Authentication/role: Authenticated administrator; server must verify trusted role, not client input.
- Request: Path id; multipart metadata = full Admin catalog metadata JSON string; image optional. Missing image should preserve stored image; no explicit stored-image deletion flag exists.
- Expected response: Ignored success body; navigates to collection.
- Possible errors: Common; 404; 409; 413; 415.
- Frontend source (relative to `mobile/src/`): app/admin/catalog/[id].tsx; features/EditorScreen.tsx; components/PhotoField.tsx.

### API 27 — `DELETE /admin/catalog/{id}`

- Status: Observed.
- Purpose: Delete selected garment after confirmation.
- Authentication/role: Authenticated administrator; server must verify trusted role, not client input.
- Request: Path id; no body/query.
- Expected response: Ignored success body; collection navigation. Relationship cleanup/restrictions unresolved.
- Possible errors: Common; 404; 409 referenced garment/deletion conflict.
- Frontend source (relative to `mobile/src/`): app/admin/catalog/[id].tsx; features/EditorScreen.tsx.

### API 28 — `GET /catalog/{id}`

- Status: Observed.
- Purpose: Read shared catalog detail or resolve catalog try-on selection.
- Authentication/role: Authenticated user.
- Request: Path id; no body/query.
- Expected response: Garment; imageUrl and optional INR price rendered directly.
- Possible errors: Common; 404.
- Frontend source (relative to `mobile/src/`): app/catalog/[id].tsx; app/try-on.tsx.

### API 29 — `POST /outfits`

- Status: Observed.
- Purpose: Create manual outfit OR save returned recommendation.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: JSON variant A: { name: string, garmentIds: string[], occasion?: string, description?: string }; local builder requires at least 2 selected wardrobe IDs. Variant B: { recommendationId: string }; mutually exclusive variants should be enforced.
- Expected response: Ignored success body; manual builder clears drafts and navigates to collection; recommendation UI marks returned recommendation ID saved.
- Possible errors: Common; 404 invalid/missing garment or recommendation; 409 duplicate-save decision.
- Frontend source (relative to `mobile/src/`): app/outfits/new.tsx; features/RecommendationsScreen.tsx.

### API 30 — `GET /outfits/{id}`

- Status: Observed.
- Purpose: Read owned outfit metadata and garment links.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Path id; no body/query.
- Expected response: Outfit; garmentIds must exist as an array (detail directly maps it).
- Possible errors: Common; 404.
- Frontend source (relative to `mobile/src/`): app/outfits/[id].tsx.

### API 31 — `PATCH /outfits/{id}`

- Status: Observed.
- Purpose: Edit saved outfit metadata only.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: JSON { name: string, occasion: string, description: string }; full local values; no garmentIds edit action.
- Expected response: Ignored success body; then detail GET refetch.
- Possible errors: Common; 404; 409.
- Frontend source (relative to `mobile/src/`): app/outfits/[id].tsx.

### API 32 — `DELETE /outfits/{id}`

- Status: Observed.
- Purpose: Delete outfit while preserving wardrobe garments.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Path id; no body/query.
- Expected response: Ignored success body; navigate to outfits.
- Possible errors: Common; 404; 409 if relevant.
- Frontend source (relative to `mobile/src/`): app/outfits/[id].tsx.

### API 33 — `POST /recommendations`

- Status: Observed.
- Purpose: Request outfit recommendations.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: JSON { occasion: "Everyday"|"Work"|"Evening"|"Weekend"|"Special occasion", preferences: string, wardrobeOnly: boolean }; preferences defaults ""; no cursor/query.
- Expected response: Page<Outfit>; items consumed, nextCursor ignored. No scores, explanation structure, or job ID consumed.
- Possible errors: Common; 409/422 unmet wardrobe/profile prerequisites (decision); 503 recommendation service unavailable.
- Frontend source (relative to `mobile/src/`): features/RecommendationsScreen.tsx; app/recommendations.tsx.

### API 34 — `POST /try-on`

- Status: Observed.
- Purpose: Submit one person photo and selected existing garment for generation.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: multipart: person=file, garmentId=string, source="wardrobe"|"catalog", photoConsent="true" (string); no JSON metadata or garment file. Consent required locally.
- Expected response: TryOnJob; preferably quick job acceptance (e.g. 202 JSON); frontend can display any declared status immediately.
- Possible errors: Common; 404 garment; 413; 415; 409 prerequisites; 503 worker unavailable.
- Frontend source (relative to `mobile/src/`): app/try-on.tsx; components/PhotoField.tsx.

### API 35 — `GET /try-on/{id}`

- Status: Observed.
- Purpose: Read job progress/result after explicit Check status action.
- Authentication/role: Authenticated user; scope data to verified token subject (admin role does not imply ownership of another user’s personal records).
- Request: Path id = returned job ID; no body/query.
- Expected response: TryOnJob. No automatic polling, websocket, history, cancellation, result-download/save request implemented.
- Possible errors: Common; 404; 410 expired result (generic UI currently). Worker failure can also be status=failed with error string in a successful job response.
- Frontend source (relative to `mobile/src/`): app/try-on.tsx.

## 5. Data ownership and authorization

### User-owned data

Profile, measurements/appearance descriptors, preferences, wardrobe garments/images, saved outfits, recommendation requests/results, try-on jobs/person photos/generated results belong to the authenticated subject. Frontend requests do not send owner IDs. Resolve ownership server-side from a verified Supabase identity. Reject cross-user references in outfit garmentIds, recommendationId, garment selections and job IDs. Decide whether forbidden IDs return 403 or conceal existence with 404.

Deletion of an account must address auth identity, profile/body/preferences, garments/storage objects, outfit associations, recommendations, jobs, inputs and generated outputs. Deleting an outfit should not delete garments (UI explicitly promises this). Wardrobe deletion behavior for referenced outfits is not specified. No account export endpoint or UI is implemented.

### Admin-managed/shared data

Catalog records and their imagery are shared and writable only by trusted admins. Current normal catalog reads still require sign-in. No anonymous catalog access is implied. No admin assignment UI, role-management API or admin dashboard statistics request exists. Do not derive admin authority from signup fields, client role flags or user-editable Supabase metadata. RLS/service-role boundaries and admin provisioning remain architectural decisions. Preserve this inventory for the later admin review.

### Session constraints

No Supabase SDK/auth subscription exists. Only memory state represents authentication. GET /auth/me is declared but unused; refresh and startup restoration are absent. 401 clears sessions/drafts, while role changes cannot be reflected until a new server response/session flow is added. Client content gates are presentation only, not authorization. No secrets should enter EXPO_PUBLIC variables; service-role credentials belong exclusively on the server.

## 6. Images and storage

- `PhotoField` selects one library image, not camera/video; config disables camera and microphone permission. It requests quality 0.85; no crop or multi-image management workflow exists.
- Accepted client MIME types: image/jpeg, image/png, image/webp. Size check rejects greater than 10 * 1024 * 1024 bytes only if fileSize is provided; exactly that size currently passes. MIME defaults to image/jpeg and filename to garment.jpg when absent. Server must verify bytes, type, dimensions, decompression limits and true size independently.
- Native FormData uses uri/name/type; web uses a File. Local URI is not a backend retrieval URL. Files are uploaded only on submit, not selection.
- Garment upload: metadata JSON string plus image file. Edit with no new image preserves existing imagery under the expected contract. Remove selected photo clears the local replacement; it does not request deletion of an existing stored image.
- Try-on uploads a person photo only; server resolves garmentId/source and validates access. Consent is a true string, without policy version, timestamp or durable consent identifier supplied by client.
- Record reads return imageUrl as a directly loadable URL. React Native Image requests do not include the API bearer header. Private Supabase buckets therefore need signed URLs or another agreed mechanism. URL expiry/refresh, cache policy and deletion/revocation semantics are unresolved. Public catalog URLs may be appropriate only after a separate access decision.
- Only one imageUrl per garment/outfit/job is consumed. No image-list API, presigned upload handshake, image status endpoint, original/thumbnail distinction or background-removal result is requested.
- Full-body inputs and appearance data require an explicit retention/access policy. Do not expose private object paths as public URLs by convenience. Decide EXIF handling, image validation and cleanup on failed writes/replacements/deletion.

## 7. Loading, empty, validation and failure behavior

- `useResource` requests only with a session, outside preview, and with admin role for admin reads. Requests cancel on dependency changes/unmount. Loading uses a spinner; errors use a notice with manual Try again. Empty collections use items=[] notices, filter reset and navigation actions.
- Dashboard accepts true zero counts; preview shows no invented statistics. No separate progress/activity feed API exists.
- Editors render only after non-null successful read or in preview/create mode. 404 or null/204 on first profile/body/settings GET leaves the real editor unavailable. Backend bootstrap/default-record strategy must be decided before integration.
- Create screens do not prefetch a detail record. Shared save/delete buttons disable during their request. Mutations keep draft input on ordinary errors; expiry clears session memory. Successful writes clear relevant drafts or refetch data/navigate; there is no optimistic fake record insertion.
- Client field validation occurs before calls, with required, string length, enum, email, password, numeric checks. Server must revalidate all inputs. FastAPI 422 field details are not mapped to fields by the current client.
- Outfit builder requires >=2 garment IDs, but recommendation save only requires a returned ID. Preview has no fake garments, so cannot create a populated outfit/try-on.
- Recommendation requests show busy/error state and distinguish returned empty items. Save status is screen-local; reload does not know which recommendations were previously saved. Duplicate-save/idempotency semantics need agreement.
- Try-on validates person, garment and consent. Queued/processing results expose manual Check status; failed jobs show error; completed-without-image shows a specific notice. There is no persisted job history to recover a job after app restart.
- Draft retention is session-memory only; passwords remain screen state. No database/localStorage/automatic server draft endpoint is used. Browser unload warning exists only while a changed draft hook is mounted.
- Public introduction, workflow preview and placeholders must not be used to infer successful account or ML functionality. Google action is explicitly unavailable.

## 8. Integration issues to discuss before modifying the frontend

No frontend changes were made during this audit. These findings are concrete integration gaps, not requests to implement them without approval.

1. **Supabase contract mismatch:** native Supabase session fields/verification flows are not the custom Session above. Decide FastAPI auth facade versus direct Supabase Auth; determine JWT verification, refresh, secure storage, expiry and role source. Do not implement both competing flows accidentally.
2. **Recovery/verification redirects:** reset form expects a query token and raw POST; Supabase may use code/session exchange. App scheme is drapedrop, but callback routes/exchange/email verification/resend are not implemented. Android package ID and production redirect hosts remain unconfigured.
3. **Error bodies ignored:** decide backend error schema and whether a later approved client adapter will display field errors, retry-after, password policy and recovery-token expiry. Current generic handling is insufficient to promise rich backend validation UX.
4. **Body/profile defaults and types:** form appearance fields are absent from BodyProfile; numeric null writes conflict with non-nullable optional numbers. Measurements use the same 1–300 bounds for cm/in; switching units does not convert values. Settings.units and body.units are separate fields with no synchronization. Decide source of truth and migrations.
5. **PATCH clearing and concurrency:** all fields are sent; empty text and null numbers can erase server values. Decide absent/blank/null semantics. No revision/ETag is sent, even though 409 text suggests reload. No idempotency keys protect retrying uploads/outfit saves after timeouts.
6. **Mixed-source outfits:** recommendation form allows wardrobe plus catalog, but Outfit has only garmentIds and saved-outfit detail links all IDs to /wardrobe/:id. Backend must not silently mix catalog IDs into wardrobe IDs. Decide typed garment references, snapshotting/copying, and how deleted source garments affect saved looks.
7. **Recommendation latency/identity:** POST /recommendations expects completed items within 20 seconds and recommendation.id usable by POST /outfits. No recommendation-job protocol, durable ID/expiry rule or saved-state field exists. Long-running ML requires a discussed contract change.
8. **Image access/expiry:** private image requests have no bearer header. Signed URL expiry has no renewal/error-recovery UI. Decide private storage read mechanism and how new/updated image URLs invalidate caches.
9. **Profile creation:** GET failures prevent form submission; use defaults/upsert or an explicit onboarding contract. The code has no POST /profile or body creation route.
10. **Catalog product model:** category/fit/etc. are display strings; sizes are free text, price is optional floating number and UI fixes INR. There are no SKU variants, inventory, purchase/cart/payment or retailer-link fields. This is a fashion-intelligence catalog, not an implemented ecommerce checkout.
11. **Session/race behavior:** logout clears memory in finally, even if server revocation fails, but UI success navigation only follows successful resolution. Expiry drops drafts; changing passwords does not explicitly expire current session. Decide server token-revocation and password-change behavior.
12. **Try-on lifecycle:** jobs have no client history/cancel/delete/download calls, no persistent job ID, consent-policy version or retention UI. Define cleanup, retries and failure ownership before ML orchestration.
13. **Preview/account separation:** preview skips reads and write handlers, but settings preview can still display session.user.email if an actual session exists. Do not treat the preview banner as a complete security guarantee. Backend still authorizes every operation.
14. **Client boundary:** several screens call request directly rather than feature-specific services. Response shape checks are compile-time only. A later frontend adapter may be needed, but no refactor is authorized by this audit.

## 9. Features with no settled API contract

Google OAuth; email verification/resend/callback; refresh/session restoration; photo/body/skin analysis; garment classification/attribute extraction; storage URL renewal; job history/cancellation; account data export; consent policy retrieval; admin provisioning. These are gaps or future architecture decisions, not observed endpoints. No paths, payloads or fake responses are assigned to them here.

## 10. Proposed FastAPI/Supabase module boundaries — for discussion

- **Authentication/session:** chosen Supabase Auth integration, JWT verification, user response adapter, recovery/verification redirects, revocation.
- **Accounts/profiles:** profile bootstrap, body measurements, preferences, deletion lifecycle and ownership rules.
- **Wardrobe:** owned garments, metadata validation, query/cursor behavior and outfit references.
- **Catalog:** shared read model; separately authorized admin mutations, pending later workflow review.
- **Outfits:** manual creation, metadata editing, recommendations-to-saved conversion and mixed-source references.
- **Recommendations:** request validation, wardrobe/profile orchestration and latency/job decision; ML remains separate from this requirements audit.
- **Try-on:** uploads, consent, owned job status and result lifecycle; async worker integration later.
- **Storage/images:** Supabase Storage access policies, signed URLs, validation, atomic replacement and orphan cleanup.
- **Shared API infrastructure:** errors, pagination, CORS, rate limits, logging, configuration, authorization dependencies and database/RLS boundaries.
- **Dashboard:** derived counts with explicit meanings; avoid separate fabricated analytics records.

### Architectural decisions required before implementation

1. Direct Supabase Auth or FastAPI facade? How are refresh/recovery/verification and Google callbacks handled?
2. What authoritative role/RLS policies protect users and admins? Admin workflow details will be reviewed later.
3. What defaults create a first user's profile/body/preferences, and how do blank/null/unit updates work?
4. How are wardrobe versus catalog references represented in recommendations and saved outfits?
5. Private versus public buckets, signed URL lifetime/renewal, image replacement, consent and retention?
6. Synchronous versus asynchronous recommendations; job/duplicate-save/idempotency rules?
7. Versioned endpoint base, error envelope, stable pagination/cursor expiry, concurrency and success status conventions?
8. Account deletion/revocation guarantees, referenced garment deletion and worker cleanup behavior?

Recommended next step: discuss these decisions and approve the auth/data/storage contracts first. Then design the FastAPI modules and Supabase schema/RLS. Do not implement or silently alter frontend contracts from this document alone.
