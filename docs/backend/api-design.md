# Drape & Drop API Design

## Status and scope

This document describes the API implementation currently present in the repository. It is a source-level design reference, not a claim that every migration, Storage policy, worker, or feature is enabled in a hosted environment.

It does not change the existing frontend contract inventory in [api-requirements.md](api-requirements.md). The source files named below are the authoritative evidence when this document differs from an older planning or checkpoint document.

## System boundary

The user-facing API is one FastAPI application created by `create_app()` in [`backend/app/main.py`](../../backend/app/main.py). It has no `/api` or `/v1` path prefix in source. Deployment may put a prefix in front of it through its configured public base URL.

```text
Expo mobile client
  -> FastAPI route
  -> JWT verification and account eligibility
  -> Supabase PostgREST RPC with the same user JWT
  -> PostgreSQL functions, grants and forced RLS
  -> FastAPI response
```

Images add a second controlled hop to Supabase Storage. FastAPI does not use a general service-role fallback for ordinary customer operations.

## Technology and interface conventions

- **HTTP API:** FastAPI and Pydantic request and response models.
- **Authentication:** Supabase Auth access JWT in `Authorization: Bearer <access-token>`.
- **Authorization:** FastAPI verifies JWT signature, issuer, audience, expiry, authenticated role and subject through [`JWTVerifier`](../../backend/app/security.py). It then forwards the same token to the Supabase Data API.
- **Database interface:** `UserDataAPI` makes bounded HTTP requests to Supabase PostgREST RPC endpoints. No SQLAlchemy, direct PostgreSQL connection, or Redis client is used in the ordinary API path. See [`data_api.py`](../../backend/app/data_api.py).
- **Response format:** JSON for normal APIs. Successful no-content mutations return `204`. Image routes return `image/jpeg` with `Cache-Control: private, no-store`.
- **Identifiers:** UUID strings in paths and JSON fields.
- **Pagination:** cursor-based. Clients must treat `nextCursor` as opaque and return it unchanged on the next request.
- **Timestamps:** response timestamps are timezone-aware ISO 8601 datetimes.

## Authentication and error design

### Protected request lifecycle

1. The Expo client restores its Supabase session and obtains the latest access token.
2. `SessionProvider.request()` attaches the token to a FastAPI request.
3. `verified_principal()` rejects missing, repeated, malformed, expired, or invalid bearer tokens with `401`.
4. `active_user_data()` creates a request-local `UserDataAPI` and calls the `account_access` RPC.
5. A disabled or deleting account is denied before normal business operations execute.
6. PostgreSQL RPC functions and forced RLS independently enforce the current subject and account state.

The ordinary app converts security exceptions in [`main.py`](../../backend/app/main.py) to these stable responses:

| Status | Meaning | Body |
| --- | --- | --- |
| `401` | Missing, malformed, expired, invalid, or unsupported authentication | `{ "detail": "Valid authentication required." }` |
| `403` | Authenticated identity lacks access or account is inactive | `{ "detail": "Access denied." }` |
| `503` | A required security or Supabase dependency is unavailable | `{ "detail": "Security dependency unavailable." }` |
| `404` | An owned or shared resource is absent or inaccessible | Route-specific safe message |
| `409` | A resource relationship or state conflicts with the operation | Route-specific safe message |
| `422` | Request field, cursor, multipart payload, or domain validation failed | Route-specific safe message |

Routes additionally use FastAPI's normal validation mechanism. Several module-specific route classes replace malformed request detail with safe generic `422` errors so personal values and binary data are not echoed back.

### Direct Supabase Auth operations

Sign-in, session refresh, password recovery, email confirmation and OAuth code exchange are performed by the Supabase client in the mobile application, not by ordinary FastAPI routes. See [`mobile/src/services/auth/supabase.ts`](../../mobile/src/services/auth/supabase.ts) and [`mobile/src/services/auth/contracts.ts`](../../mobile/src/services/auth/contracts.ts).

The separate registration coordinator is documented at the end of this document. It is a distinct disabled-by-default FastAPI application and is not included by `backend/app/main.py`.

## Resource models

### Garment

`GarmentRead` is used by wardrobe and catalog endpoints. Its conceptual fields are:

```text
id, name, category, color, brand, size, material, notes,
price where applicable, active where applicable, image URL metadata where applicable
```

Wardrobe categories are restricted to `Tops`, `Bottoms`, `Outerwear`, `Dresses`, `Shoes`, and `Accessories`. Source validation resides in [`wardrobe.py`](../../backend/app/wardrobe.py) and [`catalog.py`](../../backend/app/catalog.py).

### Outfit

An outfit contains its UUID, `name`, `description`, `occasion`, a wardrobe-only `garmentIds` compatibility projection, and typed `items`. Each item identifies exactly one source:

```json
{ "source": "wardrobe" | "catalog", "garmentId": "UUID" }
```

Manual create and replacement require between two and 100 unique items. See [`outfits.py`](../../backend/app/outfits.py).

### Cursor page

Collection endpoints use:

```json
{ "items": [], "nextCursor": "opaque-string-or-null" }
```

Cursor values are bound to the authenticated owner and the current filter set. A cursor cannot be reused by another user or with changed filters.

### Private image uploads

Wardrobe, catalog, and try-on submission endpoints use `multipart/form-data`. FastAPI limits request bytes, image dimensions, file count, and accepted formats. Supported source formats are JPEG, PNG, and WebP. Accepted images are normalized to JPEG before storage.

## Endpoint catalog

### Service health

| Method and path | Authentication | Purpose | Success |
| --- | --- | --- | --- |
| `GET /healthz` | None | Render or platform health probe | `200 { "status": "ok" }` |

Evidence: [`main.py`](../../backend/app/main.py).

### Profile, measurements and preferences

| Method and path | Request | Response | Source |
| --- | --- | --- | --- |
| `GET /profile` | None | Current profile object | [`foundation.py`](../../backend/app/foundation.py) |
| `PATCH /profile` | Sparse JSON fields: `name`, `style`, `location`, `bio` | `204` | [`foundation.py`](../../backend/app/foundation.py) |
| `GET /profile/body` | None | Current body profile object | [`body_profile.py`](../../backend/app/body_profile.py) |
| `PATCH /profile/body` | Sparse JSON fields: `units`, measurements, body/appearance fields, `undertone`, `fit` | `204` | [`body_profile.py`](../../backend/app/body_profile.py) |
| `GET /settings` | None | `{ units, emailNotifications }` | [`foundation.py`](../../backend/app/foundation.py) |
| `PATCH /settings` | `{ units, emailNotifications }` | `204` | [`foundation.py`](../../backend/app/foundation.py) |
| `GET /onboarding` | None | `{ processingAvailable: false, draft, reviewed }` | [`onboarding.py`](../../backend/app/onboarding.py) |
| `POST /onboarding/body-photo/{upload_id}` | Multipart `image`; the UUID is created and retained by the client for retry | `{ version, imageUrl }` | Normalizes and stores one private body-photo version |
| `GET /onboarding/body-photo/{image_id}` | UUID path parameter | Authenticated `image/jpeg`, `Cache-Control: private, no-store` | Owner-only private photo retrieval |
| `POST /onboarding/body-photo/{image_id}/review` | `{ name, location, units, height?, chest?, waist?, hips?, inseam? }` | Reviewed version `{ id, state, createdAt, reviewedAt, confirmedValues }` | Persists user-confirmed values to existing profile records atomically |
| `DELETE /onboarding/body-photo/{image_id}` | UUID path parameter | `204` | Discards only an unconfirmed draft; trusted cleanup removes its object |

All routes above require an active authenticated account. Measurement values must be JSON numbers between 1 and 300 with at most four decimal places. Ownership is implicit from the verified token and is never supplied by a client.

Onboarding photo versions use `pending`, `ready`, `reviewed`, `cleanup_pending`, and `removed` states. Uploads accept JPEG, PNG, or WebP input and are normalized to private JPEG objects capped at 10 MB. Reusing the same upload UUID and image content safely resumes an interrupted upload. Automatic photo analysis is unavailable while MediaPipe is deferred; the API reports `processingAvailable: false`, and the user enters or corrects every profile value before confirming. Onboarding does not block dashboard access. Replacing a reviewed photo retires the previous active object for trusted cleanup while preserving its minimal review record. Retention duration still requires a product decision.

Onboarding requests return the common `401`, `403`, and `503` errors described above. Missing or inaccessible photo IDs return `404`; draft-state or duplicate-content conflicts return `409`; invalid multipart/image content returns `413`, `415`, or `422` as applicable.

### Wardrobe

| Method and path | Request | Response | Notes |
| --- | --- | --- | --- |
| `GET /wardrobe` | `search`, `category`, `sort`, `limit`, `cursor` query values | Garment cursor page | Owner-only collection |
| `POST /wardrobe` | Multipart `metadata` JSON plus required `image` | `201` garment | Creates an owner-scoped garment |
| `GET /wardrobe/{garment_id}` | UUID path parameter | Garment | Owner-only |
| `PATCH /wardrobe/{garment_id}` | JSON metadata or multipart metadata with replacement image | `204` | Partial update |
| `DELETE /wardrobe/{garment_id}` | UUID path parameter | `204` | Schedules safe image cleanup when needed |
| `GET /wardrobe/{garment_id}/image` | UUID path parameter | `image/jpeg` | Authenticated owner-only image stream |

`GET /wardrobe` supports `sort=newest|name`, categories listed above, `limit` from 1 to 100, and an opaque owner-bound cursor. Image metadata reservation, upload, garment write, and cleanup handling are orchestrated by [`wardrobe.py`](../../backend/app/wardrobe.py).

### Shared catalog and catalog administration

All catalog reads currently require an active authenticated account. Normal customers only receive active catalog garments. Administrator access is derived from trusted `administrator_memberships` data through the `account_access` RPC.

| Method and path | Required role | Request | Response |
| --- | --- | --- | --- |
| `GET /catalog` | Active user | Search, category, sort, pagination query | Garment cursor page |
| `GET /catalog/{garment_id}` | Active user | UUID path parameter | Active garment |
| `GET /catalog/{garment_id}/image` | Active user | UUID path parameter | Private JPEG stream |
| `GET /admin/catalog/access` | Active user | None | `{ userId, isCatalogAdmin }` |
| `GET /admin/catalog` | Catalog administrator | Search, category, sort, pagination query | Includes inactive entries |
| `POST /admin/catalog` | Catalog administrator | Multipart metadata plus required image | `201` garment |
| `GET /admin/catalog/{garment_id}` | Catalog administrator | UUID path parameter | Catalog garment |
| `PATCH /admin/catalog/{garment_id}` | Catalog administrator | JSON or multipart update | `204` |
| `DELETE /admin/catalog/{garment_id}` | Catalog administrator | UUID path parameter | `204` |
| `GET /admin/catalog/{garment_id}/image` | Catalog administrator | UUID path parameter | Private JPEG stream |

Catalog mutations validate attributes, image integrity, administrator status, and secure object paths. See [`catalog.py`](../../backend/app/catalog.py).

### Outfits

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /outfits` | `limit`, `cursor`, `search`, `category`, `source`, `sort`, `created_from`, `created_before` | Outfit cursor page |
| `POST /outfits` | Manual outfit fields and item references, or `{ recommendationId }` | `201` outfit |
| `GET /outfits/{outfit_id}` | UUID path parameter | Outfit |
| `PATCH /outfits/{outfit_id}` | Sparse metadata fields | `204` |
| `PUT /outfits/{outfit_id}/items` | `{ items: [{ source, garmentId }] }` | Updated outfit |
| `POST /outfits/{outfit_id}/items` | `{ source, garmentId }` | `201` updated outfit |
| `DELETE /outfits/{outfit_id}/items/{item_id}` | UUID path parameters | Updated outfit |
| `DELETE /outfits/{outfit_id}` | UUID path parameter | `204` |

All outfit endpoints are owner-only. Wardrobe references must belong to the current owner. Catalog references must remain eligible shared catalog garments. Item replacements execute through controlled database operations to preserve aggregate integrity. See [`outfits.py`](../../backend/app/outfits.py).

### Recommendations and saved recommendations

| Method and path | Request | Response | Notes |
| --- | --- | --- | --- |
| `POST /recommendations` | `occasion`, `preferences`, `wardrobeOnly`, `limit` | Recommendation page | Deterministic `rules-v1` engine |
| `GET /recommendations` | Optional `limit` | Recent recommendation page | Owner-only history |
| `POST /recommendations/{recommendation_id}/save` | Optional save body | Saved recommendation | Prevents duplicate bookmarks |
| `GET /recommendations/saved` | `limit`, `cursor` | Saved recommendation page | Owner-only pagination |
| `DELETE /recommendations/saved/{saved_id}` | UUID path parameter | `204` | Owner-only removal |
| `GET /personalization/preferences` | None | `{ styleTags, colorTags, preferredFit, preferredOccasions, budgetMin, budgetMax, currency }` | Owner-only structured preferences |
| `PATCH /personalization/preferences` | Sparse preference fields | Updated preference object | Validates tags, fit, occasion values and INR bounds |
| `GET /recommendations/feedback` | Optional `limit` from 1 to 100 | `{ items: Feedback[] }` | Owner-only recent feedback |
| `PUT /recommendations/{recommendation_id}/feedback` | `{ sentiment, reasonCode, note? }` | Feedback record | Retry-safe upsert; one record per owner/result |
| `DELETE /recommendations/{recommendation_id}/feedback` | UUID path parameter | `204` | Owner-only removal |

Recommendations use current accessible wardrobe and active catalog data. Saved style and colour tags contribute literal text matches, preferred occasions contribute an explicit rule bonus, and budget bounds filter shared catalog pieces by listed INR price. Fit is saved through the existing body profile field; it is not used to score results because current garment records have no fit attribute. Recommendation requests preserve the applied personalization snapshot in private history. Generation is deterministic database logic, not an AI model or external ML provider. Feedback is a user-owned upsert with a constrained sentiment and reason code. See [`recommendations.py`](../../backend/app/recommendations.py), [`personalization.py`](../../backend/app/personalization.py), and [`saved_recommendations.py`](../../backend/app/saved_recommendations.py).

### Virtual try-on job infrastructure

| Method and path | Request | Response | Notes |
| --- | --- | --- | --- |
| `POST /try-on/jobs` | Multipart `person`, `garmentId`, `source`, `photoConsent=true` | `202` job | Explicit photo consent required |
| `GET /try-on/jobs` | `limit`, `cursor` | Job cursor page | Owner-only history |
| `GET /try-on/jobs/{job_id}` | UUID path parameter | Job | Owner-only detail |
| `POST /try-on/jobs/{job_id}/cancel` | None | Updated job | Only a queued job is cancellable |
| `GET /try-on/jobs/{job_id}/input` | UUID path parameter | Private JPEG stream | Owner-only input retrieval |

The job representation includes status, source, consent timestamps, failure code, `workerAvailable`, and `inputAvailable`. The code deliberately reports `workerAvailable: false`. No route creates generated try-on output or claims inference completion. See [`tryon.py`](../../backend/app/tryon.py).

### Account lifecycle and dashboard

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /dashboard` | None | Current user's wardrobe, saved outfit, recommendation, saved recommendation, and try-on job counts |
| `DELETE /account` | `{ "confirmation": "DELETE" }` | `202` deletion state |
| `GET /account/deletion` | None | `not_requested`, `deleting`, or `complete` status projection |

The account deletion endpoint requires a verified identity and relies on a database reauthentication requirement. It changes the account into a deny-first state. Cleanup workers are separate trusted processes and are not invoked by the normal request itself. See [`account.py`](../../backend/app/account.py), [`workers/deletion.py`](../../backend/workers/deletion.py), and [`dashboard.py`](../../backend/app/dashboard.py).

## Database and Storage contract

FastAPI calls only named RPC functions exposed through the Supabase Data API `api` schema. The private `app_private` tables are not direct frontend resources. The migrations define least-privilege roles, table constraints, and forced RLS.

Primary persistence groups:

- **Account:** `user_profiles`, `body_profiles`, `user_preferences`, `account_lifecycle`, `account_deletion_tombstones`, `administrator_memberships`
- **Wardrobe:** `wardrobe_garments`, `wardrobe_images`
- **Catalog:** `catalog_garments`, `catalog_images`
- **Outfits:** `saved_outfits`, `outfit_items`
- **Recommendations:** `recommendation_requests`, `recommendation_results`, `saved_recommendations`, `recommendation_feedback`
- **Try-on:** `tryon_jobs`, `tryon_images`
- **Cleanup and registration:** `deletion_tasks`, registration challenge, receipt, and rate-limit tables

Relevant schema sources are [foundation migration](../../supabase/migrations/202611060001_foundation.sql), [wardrobe migration](../../supabase/migrations/202611080002_wardrobe.sql), [catalog migration](../../supabase/migrations/202611080003_catalog.sql), [outfit migration](../../supabase/migrations/202611080004_outfits.sql), [recommendation migration](../../supabase/migrations/202611080007_recommendations.sql), and [try-on migration](../../supabase/migrations/202611090002_tryon_jobs.sql).

## Separate registration coordinator

`backend/registration/main.py` defines another FastAPI application with six public POST routes:

```text
POST /auth/registration/start
POST /auth/registration/link
POST /auth/registration/verify
POST /auth/registration/status
POST /auth/registration/finalize
POST /auth/registration/resend
```

This is intentionally isolated from the ordinary user-scoped API because it uses a separately configured trusted Supabase gateway and SMTP sender. Its middleware returns `503 Registration is not available yet` unless `DD_REGISTRATION_ENABLED=true` and every private prerequisite validates. It is therefore an implemented source candidate, not an enabled ordinary production API. See [`registration/main.py`](../../backend/registration/main.py) and [`registration/config.py`](../../backend/registration/config.py).

## Explicit non-features

The checked implementation contains no API module or external integration for:

- payment collection, subscriptions, invoices, or webhooks
- push or in-app notification delivery
- Redis caching
- external AI/ML garment classification
- virtual try-on inference or image generation
- a separate API Gateway service
- a separate admin web dashboard backend

## Verification boundary

This document is based on the checked source tree. It does not by itself confirm that a deployed environment has the current database migrations, Data API schema exposure, Supabase Storage policies, SMTP sender, OAuth providers, registration service, or worker scheduler configured. Those require their own hosted acceptance checks.


## Wardrobe creation duplicate-photo extension (local candidate)

`POST /wardrobe` retains its authenticated multipart contract (`metadata` JSON and one `image`). An optional strict boolean `allowDuplicate` in create metadata defaults to false. The backend normalizes the image and checks its SHA-256 against the current user's attached wardrobe photos through `api.create_wardrobe_checked`. A match returns 409 and no garment is inserted. The client can explicitly resubmit with `allowDuplicate: true` after confirmation; this is not an automatic mutation retry. Photos rejected by the check follow existing cleanup. PATCH metadata does not accept this flag. No matching garment IDs or other users' data are disclosed. Concurrent matching creates use an owner/hash transaction lock. Existing API errors and image security boundaries remain. This warning does not identify visually similar clothing or guarantee duplicate-free records through every legacy RPC path.


## Wardrobe gallery extension (local candidate)

All routes require an active authenticated owner and forward their JWT to Supabase.

- `GET /wardrobe/{garment_id}/photos`: list `{id, primary, createdAt}` records in upload order.
- `POST /wardrobe/{garment_id}/photos`: multipart `metadata` containing `{}` and one `image`; returns the updated list with 201. Maximum eight attached photos; validates and normalizes images as existing wardrobe uploads.
- `GET /wardrobe/{garment_id}/photos/{image_id}`: private JPEG bytes, hash/size checked, no-store.
- `PUT /wardrobe/{garment_id}/photos/{image_id}/primary`: select an attached owner photo as cover; returns updated list.
- `DELETE /wardrobe/{garment_id}/photos/{image_id}`: retire a secondary photo for cleanup; 204. Removing the primary returns 409 until another cover is selected.

Missing/foreign garments or associations return 404; invalid requests return 422; image validation also uses 413/415; dependency failures return 503. Existing garment list/detail response contracts remain unchanged and continue to project the cover. The gallery uses the existing private bucket. The attach transaction serializes on the garment; POST upload does not yet have an HTTP idempotency key, so clients must refresh after an uncertain response before submitting another upload.


## Outfit duplication (local candidate)

`POST /outfits/{outfit_id}/duplicate` requires the active owner, accepts no editable ownership fields and returns a new `OutfitRead` with 201. The database locks the source and copies its name (with a bounded ` (copy)` suffix), description, occasion and ordered source/garment references through existing creation validation in one transaction. New outfit-item UUIDs are created; original records are preserved. Source recommendation provenance is not cloned because the new record is a manual copy. Missing/foreign outfits and unavailable garment sources return 404; validation errors return 422; unauthenticated/forbidden requests return 401/403; dependency errors return 503. The mobile outfit detail screen exposes this action without automatically retrying the mutation.
