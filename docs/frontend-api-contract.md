# Proposed frontend API contract

These are integration assumptions made by the frontend, not implemented or verified backend endpoints. The backend phase must confirm or adapt them before connecting production data.

## Transport
EXPO_PUBLIC_API_URL is the public service base URL. Protected requests send Authorization: Bearer <accessToken>. JSON requests use application/json; uploads use FormData with the transport-generated boundary. Responses must be JSON except successful no-content deletions (204).

Errors: 401 expires the client session; 403 denies access; 404 means missing record; 409 requests reloading; 422 requests correcting details. Backend must enforce ownership and administrator permissions independently of client gates.

## Authentication
- POST /auth/login: email, password; returns accessToken and user { id, email, name?, role: user | admin }.
- POST /auth/signup: name, email, password; accepts request for email verification.
- POST /auth/password-reset: email; enumeration-safe reset request.
- POST /auth/password-reset/confirm: token, password from reset link.
- POST /auth/password: authenticated currentPassword, newPassword.
- POST /auth/logout; GET /auth/me.
- DELETE /account: authenticated confirmation: DELETE.
Google OAuth, token refresh and persistence have no completed contract yet.

## Profile and preferences
- GET/PATCH /profile: name, style, location, bio.
- GET/PATCH /profile/body: units, height, chest, waist, hips, inseam, fit, bodyShape, skinTone, undertone. Appearance descriptors are optional user input, not inferred results.
- GET/PATCH /settings: units, emailNotifications.
- GET /dashboard: wardrobeCount, savedOutfitCount, recommendationCount.

## Garments and collections
- GET /wardrobe and /catalog: search, category, sort (newest | name), limit and optional cursor. Returns { items, nextCursor? }.
- GET/PATCH/DELETE /wardrobe/:id; POST /wardrobe.
- GET /catalog/:id.
- GET/POST /admin/catalog; GET/PATCH/DELETE /admin/catalog/:id. Admin only.
Garment records use id, name, category, color?, brand?, imageUrl?, notes?, size?, material?, price?. Catalog price currently uses INR.
Create/update garment forms send multipart metadata (JSON string) plus optional image; creation requires an image. Backend validates image type/size and all fields.

## Outfits and recommendations
- GET /outfits: collection envelope and pagination/filter parameters.
- POST /outfits: name, occasion?, description?, garmentIds; or recommendationId when saving a returned recommendation.
- GET/PATCH/DELETE /outfits/:id.
- POST /recommendations: occasion, preferences, wardrobeOnly. Returns { items: Outfit[] }.
Outfit records use id, name, description?, imageUrl?, garmentIds, occasion?.

## Virtual try-on
- POST /try-on multipart: person photo, garmentId, source (wardrobe | catalog), photoConsent (true).
- GET /try-on/:id returns { id, status: queued | processing | completed | failed, imageUrl?, error? }.
The client checks progress on explicit refresh. Real processing, retention, consent policy and generated results require backend/ML implementation.
