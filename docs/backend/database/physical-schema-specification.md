# Physical Schema Design Specification v0.1 — Drape & Drop

November 6, 2026 · **Proposed design for review, not an implemented or deployed database**

## 1. Scope, evidence and precedence

This specification translates the conceptual inventory and logical model into proposed PostgreSQL storage, integrity, permission and transaction boundaries. It creates no tables, SQL, migrations, indexes, policies, clients or application behavior. Only this document is created. Proposed names, types, defaults and constraints below require review; inclusion does not make them approved.

Inspected repository evidence:

- [Entity inventory](entity-inventory.md), E01–E17, and [logical relational model](relational-model.md), R01–R22, including its operational-lifecycle/tombstone, incomplete-image, aggregate minimum-count and input-expiration clarifications.
- [API requirements](../api-requirements.md), all 35 contracts; [security architecture](../authentication-and-security.md), especially A2/A9/A10, B1, C1–C7 and G; [security checkpoint](../checkpoint-001-security-foundation.md); [backend setup](../../../backend/README.md).
- Backend [configuration](../../../backend/app/config.py), [JWT verifier](../../../backend/app/security.py), [Data API adapter](../../../backend/app/data_api.py), [dependencies](../../../backend/app/dependencies.py) and [app factory](../../../backend/app/main.py). These implement request-scoped security infrastructure only; eligibility remains unconfigured and fail-closed. They prove neither real RLS nor Storage behavior.
- Frontend [domain types](../../../mobile/src/types/domain.ts), [resources](../../../mobile/src/services/api/resources.ts), [transport](../../../mobile/src/services/api/client.ts), [form schemas](../../../mobile/src/features/schema.ts), [validation/serialization](../../../mobile/src/features/validation.ts), [editor](../../../mobile/src/features/EditorScreen.tsx), [collections](../../../mobile/src/features/CollectionScreen.tsx), [session](../../../mobile/src/features/session.tsx), [outfit builder](../../../mobile/src/app/outfits/new.tsx), [outfit detail](../../../mobile/src/app/outfits/[id].tsx), [recommendations](../../../mobile/src/features/RecommendationsScreen.tsx), [try-on](../../../mobile/src/app/try-on.tsx) and [photo picker](../../../mobile/src/components/PhotoField.tsx).
- [Original PRD](../../PRD.md) and [original architecture](../../architecture.md). Their Next.js/Node assumptions are superseded by Expo/FastAPI/Supabase. No ecommerce, social, avatar, training dataset or gallery scope is inferred.

**Approved:** Supabase Auth identity and asymmetric JWT verification; user-JWT-scoped Supabase access; FastAPI business validation; RLS plus least-privilege grants; authenticated catalog reads and trusted administrator writes; all-path disabled/deleting denial. **This task explicitly selects Approach B:** separate wardrobe/catalog references with exactly one target. This does not approve an outfit API adaptation.

**Recommended:** every physical choice below, including 15 tables, private base schema, constrained operations, asset separation and deletion actions. **Unresolved:** product retention/expiry, mixed-source API adaptation, units, trusted operation mechanics and integration-specific privilege details. Existing API/security documents remain unchanged and authoritative. No live project/database configuration was inspected.

## 2. Proposed table inventory and exposure

Recommend a non-exposed `app_private` schema for all 15 base tables. An exposed `api` schema would contain only explicitly reviewed operations/projections, not these tables. Schema names are proposals, not current configuration. Data API access to each table is **indirect only** through that boundary; no anonymous access. Section 9 explains the additional review required for operation execution privileges. “User write” below means a validated owner-scoped operation, never an unrestricted base-table grant.

| Proposed table | Entity / relationship IDs | Responsibility, separation and essentiality | Classification and allowed operations |
|---|---|---|---|
| user_profiles | E02; R01 | Essential current profile singleton; separated from sensitive measurements and protected identity state. | User-owned: own read/update. Admin has no extra access. No routine worker access; bootstrap/cleanup only. |
| body_profiles | E03; R02 | Essential persistence for body/appearance editor, even with empty optional values; separated for sensitive-data permissions. | User-owned sensitive: own read/update. Scoped recommendation processing may read only needed fields; no catalog-admin override. |
| user_preferences | E04; R03 | Essential settings singleton; separated so preference changes cannot reinterpret body values. | User-owned: own read/update; bootstrap/cleanup only otherwise. |
| account_lifecycle | E15; R04 | Essential authoritative operational state tied to a live Auth identity. Separate from user-editable records. | Trusted system: eligibility predicate only to normal/admin callers; protected lifecycle transitions and cleanup. |
| account_deletion_tombstones | E15; R04 | Recommended minimal deletion coordination/evidence independent of live Auth. Separate to avoid cascading away denial evidence. Requires retention/basis approval. | Trusted system only: named deletion/cleanup operations; no normal/admin catalog access. |
| administrator_memberships | E16; R05 | Recommended private catalog permission authority; separate trusted grants from editable profiles. Permission source is required; table choice awaits review. | Trusted system grant/revoke only. Current-subject permission predicate; catalog admin cannot self-grant. |
| image_assets | E06/E08/E14; R07/R08/R19/R20/R22 | Essential durable locator/validation/cleanup responsibility; one common table avoids duplicating metadata, not access boundaries. Parent keeps current association. | Private owned or shared-catalog by immutable purpose; user submits permitted uploads, never validation/output facts. Scoped verifier/worker/cleanup writes. |
| wardrobe_garments | E05; R06/R07 | Essential owned garment metadata plus one current image FK. No separate garment-image join table for the single-image contract. | User-owned CRUD through guarded operations. Admin has no private override; processing reads authorized inputs only. |
| catalog_garments | E07; R08/R12/R18 | Essential one shared catalog, not a second admin catalog. Current image FK embeds E08 association. | Active authenticated read; active trusted catalog admin CRUD. No ordinary worker mutation. |
| saved_outfits | E09; R09/R10/R16 | Essential durable header and independent saved metadata; optional detachable result provenance. | User-owned CRUD; item replacement is not an existing API. No extra admin access. |
| outfit_items | E10; R10/R11/R12 | Essential relational membership, separate from header to enforce source FKs, ownership and uniqueness. | User-owned via aggregate create/delete/read only; no standalone item API or direct DML. |
| recommendation_requests | E11; R13/R14 | Conditional separate short-lived request aggregate, recommended to bind generation options to results without repeating them. No history feature; could consolidate if equivalent evidence is retained. | User-owned request context, protected generation acceptance. Scoped producer writes results; no client result fabrication. |
| recommendation_results | E12; R14/R15/R16 | Essential owner-bound result identity during a supported save window; separate from saved outfits so expiry never deletes saved state. | User read/save own generated result; trusted producer/expiry writes. No ordinary update/create/delete of result content. |
| recommendation_items | E12 reference children; R15 | Essential membership persistence in this relational proposal; same source integrity as outfit items, no JSON array bypass. | Inherits result ownership; trusted producer/expiry only, owner read via aggregate. |
| try_on_jobs | E13/E14/E17; R17–R21 | Essential job state. Embed input/output FKs, submission evidence and one consent fact rather than separate one-to-one tables. | User submit/read own; trusted processing controls status/output/error; narrowly scoped cleanup. |

E01 remains external Supabase-managed Auth persistence, not a sixteenth table. No business password, session or refresh-token table. No separate consent-history table is justified by a single `photoConsent=true` submission; broader consent requirements remain open. Dashboard counts, `imageUrl`, role presentation and source/ID response projections are **derived**, not tables. Optional look previews do not justify a gallery or new upload endpoint.

## 3. Proposed columns and PostgreSQL types

Authority notation in descriptions: **client-editable** means an allowlisted field through a validated operation; **server-managed** is derived from verified identity/database state; **trusted** requires a narrowly authorized system/producer operation. No row below grants direct writes. UUID generation is a reviewed server/database facility, not a selected extension. All timestamp defaults are proposed database transaction time, not client clocks.

Prefer constrained `text` for small vocabularies rather than native PostgreSQL enums at this stage: vocabulary changes need review without implying new public states. UUIDs identify resources. `varchar(200/2000)` follows actual single/multiline validation. `numeric(10,4)` is a proposed measurement precision, not an approved rounding rule; values outside precision must be explicitly validated rather than silently rounded. `numeric(9,2)` stores optional INR price up to 1,000,000; fractional-price rounding beyond two places needs review. Timestamps use `timestamptz`.

No JSONB column is justified: current fields and source references have fixed structure, and a JSON list would weaken FK/ownership guarantees. Provider payloads, biometric embeddings and body snapshots are not added. Optional strings accept current blank input; proposed boundary maps blank optional fields to NULL and emits the editor-compatible empty representation. Required strings must remain nonblank. Confirm this normalization before implementation. Full-form PATCH must retain explicit clearing behavior; it is not a sparse patch.

Defaults marked “None” require explicit values or NULL as allowed; they are not silent product defaults. Defaults for units/preferences and profile name need review. Empty bootstrap profile name is an internal incomplete state, not fabricated completed profile data.

### 3.1 user_profiles

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| user_id | uuid | No | Verified subject, explicitly assigned | PK and Auth FK | Server-managed singleton identity; no user-editable UUID. |
| name | varchar(200) | No | None; explicit bootstrap value | Nonblank on completed profile update | Client-editable name. Bootstrap uses verified signup name if available, otherwise explicit empty incomplete value; default behavior requires review. |
| style | varchar(2000) | Yes | None | Length bound | Client-editable style description. |
| location | varchar(200) | Yes | None | Length bound | Client-editable personal location; not a geolocation entity. |
| bio | varchar(2000) | Yes | None | Length bound | Client-editable personal biography. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |

### 3.2 body_profiles

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| user_id | uuid | No | Verified subject, explicitly assigned | PK and Auth FK | Server-managed singleton identity; no user-editable UUID. |
| units | text | Yes | None | cm or in; required when measurements populated | Client-selected measurement meaning; conversion rules unresolved, not reinterpreted by preference changes. |
| height | numeric(10,4) | Yes | None | Finite positive; current input range 1–300 | Client-editable optional measurement. Unit-specific ranges/precision and conversion need review. |
| chest | numeric(10,4) | Yes | None | Finite positive; current input range 1–300 | Client-editable optional measurement. Unit-specific ranges/precision and conversion need review. |
| waist | numeric(10,4) | Yes | None | Finite positive; current input range 1–300 | Client-editable optional measurement. Unit-specific ranges/precision and conversion need review. |
| hips | numeric(10,4) | Yes | None | Finite positive; current input range 1–300 | Client-editable optional measurement. Unit-specific ranges/precision and conversion need review. |
| inseam | numeric(10,4) | Yes | None | Finite positive; current input range 1–300 | Client-editable optional measurement. Unit-specific ranges/precision and conversion need review. |
| body_shape | varchar(200) | Yes | None | Length bound | Client-editable bodyShape from form; absent from current domain type. |
| skin_tone | varchar(200) | Yes | None | Length bound | Client-editable skinTone description, not inferred ethnicity/biometrics. |
| undertone | text | Yes | None | Warm, Cool, Neutral, Not sure | Client-editable optional selection. |
| fit | text | Yes | None | Fitted, Regular, Relaxed, Oversized | Client-editable optional selection. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |

### 3.3 user_preferences

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| user_id | uuid | No | Verified subject, explicitly assigned | PK and Auth FK | Server-managed singleton identity; no user-editable UUID. |
| units | text | Yes | None | cm or in | Client-editable entry/display preference, separate from body units. |
| email_notifications | boolean | Yes | None | Boundary maps Enabled/Disabled | Client-editable preference; NULL means unset, not silently opted in. Does not authorize a marketing system. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |

### 3.4 account_lifecycle

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| user_id | uuid | No | Trusted bootstrap subject | PK and Auth FK | Trusted immutable live subject. |
| state | text | No | None; trusted assignment | active, disabled or deleting | Trusted eligibility authority; no user write or role metadata fallback. |
| state_changed_at | timestamptz | No | Database transaction time | Trusted transition timestamp | Trusted control/evidence, not a public lifecycle API. |

### 3.5 account_deletion_tombstones

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| former_subject_id | uuid | No | Verified deletion subject | PK; deliberately NO Auth FK | Trusted minimal former identity; sensitive identifier retained only for approved security/deletion basis. |
| deletion_started_at | timestamptz | No | Database transaction time | Immutable | Trusted evidence and retry coordination. |
| cleanup_stage | text | No | Explicit initial stage | Proposed: denying, purging, auth_removed, complete | Trusted internal progress only; does not introduce API statuses or settle completion semantics. |
| auth_deleted_at | timestamptz | Yes | None | Trusted confirmation only | Trusted timestamp only after Auth deletion confirmed. |
| cleanup_completed_at | timestamptz | Yes | None | Trusted confirmation only | Trusted evidence of agreed cleanup completion, not a retention duration. |

### 3.6 administrator_memberships

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| user_id | uuid | No | Trusted grant subject | PK part; Auth FK | Trusted subject; never a signup default. |
| permission | text | No | Explicit catalog_manage | PK part; catalog_manage only in v0.1 | Trusted bounded permission, not client-submitted role. |
| granted_at | timestamptz | No | Database transaction time | Trusted | Trusted current-membership evidence; revocation removes membership, no unapproved role-history feature. |

### 3.7 image_assets

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| owner_id | uuid | Yes | Verified subject for private assets | Auth FK; unique(id, owner_id) | Server-managed private owner; NULL only for catalog-purpose assets, never anonymous personal ownership. |
| purpose | text | No | Trusted operation assigns | wardrobe, catalog, person_input, tryon_output, look_preview | Immutable trusted purpose. look_preview is conditional on approved recommendation/saved preview lifecycle. |
| bucket_id | text | No | Server-selected bucket | Unique with object_path | Server-managed canonical bucket, names not configured by this design. |
| object_path | text | No | Server-generated immutable path | Unique with bucket_id | Server-managed unguessable locator; no arbitrary client URL/path or path traversal. |
| availability | text | No | pending | pending, available, cleanup_pending, removed | Trusted bytes lifecycle, not a public job status. removed retains evidence without asserting bytes exist. |
| detected_media_type | text | Yes | None | JPEG/PNG/WebP allowlist on acceptance | Trusted decoder result; not browser filename/MIME. |
| byte_size | bigint | Yes | None | Positive; proposed maximum 10 MiB | Trusted measured bytes, including uploads with missing client size. |
| validated_at | timestamptz | Yes | None | Required before available attachment | Trusted validation evidence retained after cleanup. |
| removed_at | timestamptz | Yes | None | Required when removed | Trusted cleanup evidence; not an expiry duration. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |

### 3.8 wardrobe_garments

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Auth FK; composite keys below | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| name | varchar(200) | No | None | Nonblank after trim | Client-editable through validated operation. |
| category | text | No | None | Six audited categories | Client-editable selection; no inferred classification/model fields. |
| color | varchar(200) | Yes | None | Length bound | Client-editable optional color; empty text handling follows Section 3. |
| brand | varchar(200) | Yes | None | Length bound | Client-editable optional brand; empty text handling follows Section 3. |
| size | varchar(200) | Yes | None | Length bound | Client-editable optional size; empty text handling follows Section 3. |
| material | varchar(200) | Yes | None | Length bound | Client-editable optional material; empty text handling follows Section 3. |
| notes | varchar(2000) | Yes | None | Length bound | Client-editable optional multiline notes. |
| image_asset_id | uuid | Yes | None | Asset FK; required at acceptance | Server-resolved current image; clients submit bytes, not arbitrary asset IDs/paths. |
| record_state | text | No | Explicit accepted on successful creation | draft or accepted; acceptance guard | Server-managed internal state only. Draft storage is optional, not a new public workflow. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |

### 3.9 catalog_garments

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| name | varchar(200) | No | None | Nonblank after trim | Catalog-admin-editable through validated operation. |
| category | text | No | None | Six audited categories | Catalog-admin-editable selection; no inferred classification/model fields. |
| color | varchar(200) | Yes | None | Length bound | Catalog-admin-editable optional color; empty text handling follows Section 3. |
| brand | varchar(200) | Yes | None | Length bound | Catalog-admin-editable optional brand; empty text handling follows Section 3. |
| size | varchar(200) | Yes | None | Length bound | Catalog-admin-editable optional size; empty text handling follows Section 3. |
| material | varchar(200) | Yes | None | Length bound | Catalog-admin-editable optional material; empty text handling follows Section 3. |
| notes | varchar(2000) | Yes | None | Length bound | Catalog-admin-editable optional multiline notes. |
| image_asset_id | uuid | Yes | None | Asset FK; required at acceptance | Server-resolved current image; clients submit bytes, not arbitrary asset IDs/paths. |
| record_state | text | No | Explicit accepted on successful creation | draft or accepted; acceptance guard | Server-managed internal state only. Draft storage is optional, not a new public workflow. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |
| price_inr | numeric(9,2) | Yes | None | 0–1000000 when set | Catalog-admin-editable optional price; API price remains numeric and INR remains current display meaning. |

### 3.10 saved_outfits

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Auth FK; composite keys below | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| name | varchar(200) | No | None | Nonblank after trim | Client-editable for saved outfits; trusted-generated for recommendation results. |
| description | varchar(2000) | Yes | None | Length bound | Client-editable saved notes; trusted-generated result description. |
| occasion | varchar(200) | Yes | None | Result also matches request occasion | Client-editable saved metadata; generated result context. Manual occasion is free text. |
| preview_asset_id | uuid | Yes | None | Owner-consistent asset FK; conditional use | Server-managed optional preview association only if independent preview retention is approved; otherwise unset. |
| origin_recommendation_id | uuid | Yes | None | Owner-consistent optional result FK | Server-managed provenance only; may detach on result expiry without changing owner/items. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |

### 3.11 outfit_items

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| outfit_id | uuid | No | Validated parent | PK part; composite parent FK | Server-managed parent from aggregate operation. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Composite parent/source FKs; no separate Auth FK | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| position | integer | No | Validated sequence starting at 0 | PK part; nonnegative | Server-managed stable array order, not a separately addressable product item. |
| wardrobe_garment_id | uuid | Yes | None | Composite FK with owner_id; XOR | Client selects an existing private target; trusted resolver validates ownership and writes it. |
| catalog_garment_id | uuid | Yes | None | Catalog FK; XOR | Client selects an existing shared target; trusted resolver validates visibility and writes it. |

### 3.12 recommendation_requests

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Auth FK; composite keys below | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| occasion | text | No | None | Everyday, Work, Evening, Weekend, Special occasion | Client request selection, validated and persisted by accepted generation operation. |
| preferences | varchar(2000) | No | Empty string | Length bound | Client request text, short-lived; no persistent body snapshot. |
| wardrobe_only | boolean | No | None | Required request option | Client selection constrains authorized result sources. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |
| expires_at | timestamptz | No | Explicit reviewed save window | Later than created_at | Trusted retention boundary; no duration selected here. |

### 3.13 recommendation_results

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Auth FK; composite keys below | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| request_id | uuid | No | Accepted generation request | Composite request/owner FK | Trusted producer provenance, not arbitrary client UUID. |
| name | varchar(200) | No | None | Nonblank after trim | Client-editable for saved outfits; trusted-generated for recommendation results. |
| description | varchar(2000) | Yes | None | Length bound | Client-editable saved notes; trusted-generated result description. |
| occasion | varchar(200) | Yes | None | Result also matches request occasion | Client-editable saved metadata; generated result context. Manual occasion is free text. |
| preview_asset_id | uuid | Yes | None | Owner-consistent asset FK; conditional use | Server-managed optional preview association only if independent preview retention is approved; otherwise unset. |
| expires_at | timestamptz | No | Explicit reviewed save window | Later than created_at; not beyond request window | Trusted save deadline; current-time validity checked during save, not a clock-dependent CHECK. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |

### 3.14 recommendation_items

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| result_id | uuid | No | Generated result | PK part; composite result/owner FK | Trusted producer parent. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Composite parent/source FKs; no separate Auth FK | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| position | integer | No | Validated sequence starting at 0 | PK part; nonnegative | Trusted stable response order. |
| wardrobe_garment_id | uuid | Yes | None | Composite FK with owner_id; XOR | Trusted producer selects an authorized private target from request context; ordinary users cannot write generated membership. |
| catalog_garment_id | uuid | Yes | None | Catalog FK; XOR | Trusted producer selects an authorized shared target subject to wardrobe_only; ordinary users cannot write generated membership. |

### 3.15 try_on_jobs

| Column | PostgreSQL type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|
| id | uuid | No | Server-generated UUID | PK | Server-managed stable resource identity; never supplied as ownership authority. |
| owner_id | uuid | No | Verified subject, explicitly assigned | Auth FK; composite keys below | Server-managed immutable owner; verified requesting subject or persisted authorized task subject, never the worker identity or an unchecked request-body UUID. |
| wardrobe_garment_id | uuid | Yes | None | Composite FK with owner_id; XOR | Client selects an existing private target; trusted resolver validates ownership and writes it. |
| catalog_garment_id | uuid | Yes | None | Catalog FK; XOR | Client selects an existing shared target; trusted resolver validates visibility and writes it. |
| person_input_asset_id | uuid | No | Accepted validated submission | Composite asset/owner FK; unique association | Server-managed input association; retain asset evidence even after bytes removed. |
| input_validated_at_submission | timestamptz | No | Trusted acceptance time | Immutable evidence | Trusted record that the input was authorized, validated and available at submission; cleanup cannot rewrite it as invalid. |
| output_asset_id | uuid | Yes | None | Composite asset/owner FK; unique association | Trusted worker attaches authorized output only. |
| photo_consent | boolean | No | None | Must be true at acceptance | Client submits true; trusted operation records receipt for this owner/job, not a general legal consent assertion. |
| consent_recorded_at | timestamptz | No | Trusted acceptance time | Immutable | Trusted receipt timestamp; no invented policy-version value. |
| status | text | No | queued | queued, processing, completed, failed | Trusted transitions only; no user-authored status. |
| error | text | Yes | None | Sanitized application-safe message | Trusted failure presentation; never provider secrets, raw traces, URLs or tokens. |
| created_at | timestamptz | No | Database transaction time | Immutable | Server-managed creation/sort timestamp; not an API field. |
| updated_at | timestamptz | No | Database transaction time | Trusted update operation advances it | Server-managed update timestamp; not an approved optimistic-lock contract. |

The repeated garment/look column definitions are explicit above for each table. `price` is not persisted for wardrobe because its editor does not submit it. `theme` is not persisted because it exists only in a type without a supported control/request. No email/password/refresh token, user-editable role, permanent body photo, model payload or customer/order fields are introduced.

## 4. Keys, integrity and acceptance constraints

All requirements below describe proposed constraints/guards, not executable SQL. An ordinary FK enforces existence, not authorization or bytes availability. RLS complements, rather than replaces, these rules.

### 4.1 Identity and ownership

- The root is the existing Supabase Auth UUID. Singleton `user_id` columns are both PK and Auth reference; other private rows have immutable `owner_id`. Defaulting an owner is not enough: every operation derives/checks the current verified subject, and normal users cannot supply another owner.
- `administrator_memberships` has PK `(user_id, permission)`: no duplicate current permission. Ordinary signup creates no membership. Lifecycle PK gives at most one authoritative live state; application readiness requires one active row. Missing/unknown lifecycle denies, including after Auth deletion.
- Tombstone `former_subject_id` is a PK **without a live Auth FK**. A trusted transition creates/updates it before removing Auth and may retain only reviewed evidence afterward. Operational lifecycle cannot survive without its live identity; tombstone can. No client update, normal read or automatic TTL is implied.
- Unique `(id, owner_id)` keys are proposed on wardrobe_garments, saved_outfits, recommendation_requests, recommendation_results and image_assets. Although `id` is already unique, these composite candidate keys are justified as FK targets proving owner equality, not as speculative performance indexes.
- Outfit children reference `(outfit_id, owner_id)` on saved_outfits. Result children reference `(result_id, owner_id)` on recommendation_results. Results reference `(request_id, owner_id)` on recommendation_requests. Private wardrobe alternatives reference `(wardrobe_garment_id, owner_id)` on wardrobe_garments. Private asset associations use `(asset_id, owner_id)` on image_assets. These reject cross-user parent/target references under concurrent requests even if service validation misses a check.
- Catalog image FK references asset ID, with an additional guard requiring catalog purpose and NULL personal owner. Private images require matching owner and expected purpose. Purpose/owner/locator are immutable after creation; independent asset-state transitions are constrained against live attachments.

### 4.2 Approach B and aggregate membership

For every outfit item, recommendation item and try-on job, exactly one of wardrobe_garment_id/catalog_garment_id is non-NULL. Separate FKs ensure the selected target exists. The private alternative additionally matches the parent's owner. There is no client-controlled owner override and no polymorphic ID without an FK. Catalog selection requires active authenticated catalog visibility; a catalog admin is not thereby owner of private references.

`outfit_items` PK is `(outfit_id, position)` and recommendation_items PK is `(result_id, position)`. For each table, separate conditional unique memberships on `(parent_id, wardrobe_garment_id)` when wardrobe is selected and `(parent_id, catalog_garment_id)` when catalog is selected reject duplicate source/target entries. UUID equality across the two source tables is not considered the same garment. This avoids depending on nullable composite uniqueness semantics. Position uniqueness preserves array order, without requiring contiguous positions for all stored states.

Manual outfit acceptance requires **at least two distinct items**, validated over the complete aggregate in one transaction. An ER edge, row CHECK, FK or unique key alone cannot prove the count. Guard direct insert/update/delete of children; itemless headers must never be exposed as accepted manual outfits. Recommendation result acceptance must be nonempty. The minimum for recommendation-based save remains unresolved; do not enforce manual two-item rules on generated saves by assumption. `wardrobe_only=true` must prohibit catalog result children through an aggregate guard that also protects subsequent changes.

Each try-on job has exactly one selected garment, exactly one distinct input asset and at most one distinct output asset. Unique input/output associations prevent cross-job reuse in this proposal; a guard also prevents one object being attached in different domains. Input/output must have the expected immutable purpose and matching job owner. At acceptance input bytes must be validated and available, photo_consent must be true and immutable submission evidence recorded. Later asset availability may become removed without invalidating original acceptance. A completed readable response needs an available output; expiring it requires reviewed API behavior, not a new status assumed by this design.

### 4.3 Images, time and trusted fields

An accepted garment has one non-NULL current image FK. Its scalar FK permits at most one; a row-level acceptance check requires a value. A **transactional cross-row guard** additionally requires the referenced asset's matching owner/purpose, successful validation and available bytes evidence. Asset cleanup/attachment updates must use the same locking protocol so a required image cannot become removed concurrently. No CHECK can prove remote bytes exist. Optional internal draft rows may have no image and are never returned as accepted collection items; draft persistence itself is not approved product scope.

Unique `(bucket_id, object_path)` prevents two application asset identities for one object. A lock on the asset and an attachment check across garment/job/preview parents prevents unapproved shared attachment; a per-parent unique index alone cannot enforce a cross-table rule. Purpose and all associations must be validated even on direct API calls. Cross-domain sharing, including a preview reused by a saved outfit, remains prohibited until its independence/cleanup rules are approved.

Trusted generated results, job state/output/error, timestamps, lifecycle and membership are not user-writable fields. Enforce a trusted transition graph and immutable owner/source/submission evidence with constrained database operations/guards as well as grants. Use row checks for categorical/length/range/nonblank/XOR constraints; use transactional guards for aggregate/cross-row state. The proposed precision must not accept NaN or infinite measurements, negative prices or out-of-range values. Reject invalid typed input before database coercion can truncate/round it.

Save verifies result owner, request owner, active lifecycle, unexpired result/request and all current target permissions in the **same transaction**. Lock the result/request against expiry deletion. Time-based validity belongs in that transaction, not a CHECK comparing against a changing clock. Duplicate-save behavior is not decided: no unique saved-outfit provenance constraint is proposed yet. Provenance is optional; copied metadata and independent item rows remain valid after its removal.

## 5. Mixed-source representation and API boundary

Approach B is applied consistently to outfit_items, recommendation_items and try_on_jobs. An internal projection can derive `{source, garmentId}` from the selected FK. Internal source projection is not a new HTTP response contract.

Manual POST /outfits still accepts wardrobe-only garmentIds and resolves each to the verified owner's wardrobe. Try-on already supplies source plus garmentId and maps directly. Saving recommendationId resolves server-held result references; it never trusts a client-supplied result's item list.

**Blocking incompatibility:** Outfit responses still contain only garmentIds, and outfit detail links every ID to `/wardrobe/:id`. A mixed-source result/save cannot be represented honestly through that response/navigation. Do not insert catalog IDs there, silently copy catalog garments into wardrobe, or reduce generation to wardrobe-only when the request allowed catalog. A separately approved typed-reference/navigation adaptation or explicit conversion workflow is required before delivering mixed-source outfits. This specification does not alter the 35 contracts or choose that adaptation.

## 6. Image and Storage design

Recommend separate image_assets metadata with current association fields on parents. E06/E08 are therefore not extra join tables; R19/R20 live in jobs, R21 is embedded consent evidence. One scalar garment image matches the actual single-photo form. Pending/replaced/removed asset records support external cleanup without inventing a gallery.

Canonical identity is bucket plus object path; asset UUID is the database reference. Use private buckets for private wardrobe, person input and generated output. Recommend catalog objects also remain in a non-public bucket, with active authenticated shared reads and trusted catalog-admin writes; “shared” must not mean anonymous public bytes. Bucket names and physical split by purpose remain review choices. Paths are server-generated with subject/purpose separation, never trusted from multipart filenames. Membership alone does not allow catalog admins to read personal images.

Proposed coordination:

1. Authenticate and check authoritative lifecycle, target access and multipart fields. Allocate a purpose-bound pending asset with verified owner; choose a fresh immutable path.
2. Upload bytes to a restricted staging location. Verify real size, decode/media type and safe dimensions/resource limits; client MIME/filename are untrusted. JPEG/PNG/WebP and 10 MiB reflect picker behavior; decompression limits, metadata stripping and malware/content controls require review. Pending bytes are not readable as accepted images or usable as worker inputs.
3. Trusted validation marks the asset available and records measured metadata. Storage access must prevent a user overwriting bytes after validation. Prefer immutable new objects and prohibit normal overwrite of finalized paths. If users can directly upload to pending paths, finalize must seal/copy to a path they cannot mutate before acceptance; integration testing must prove the absence of a validate/overwrite race.
4. Attach asset and accept garment/job in a database transaction with owner/purpose/state checks. A draft can remain without image but never counts as an accepted garment. For replacement, validate the new object first, then atomically swap the current FK.
5. Once old bytes are unreferenced and eligible for cleanup, mark cleanup_pending, delete through Storage, then record removed. Retrying an already absent object is safe after verifying its canonical identity. Reconcile uncertain Storage responses before declaring removal or deleting a pending asset row.

Upload-success/database-failure leaves a pending orphan; database-success/response-timeout does not prove rollback. A trusted sweeper reconciles pending/cleanup_pending rows and storage orphans using a reviewed grace period, which is **not selected here**. Do not delete objects with a live required association. Database FKs do not validate Storage bytes or atomically delete them. Unexpected missing bytes on an available asset are integrity incidents: stop delivery/processing and reconcile, never fabricate an image URL.

Persist neither signed URLs nor provider URLs as object identity. Authorized reads derive a short-lived URL from the canonical asset only after eligibility/ownership checks; optional imageUrl is a response projection. The frontend renders URLs without Authorization headers and has no renewal flow. Signed URL lifetime, refresh and disabled/deleting residual validity need explicit review. A revocable delivery mechanism or an approved bounded capability window is required before claiming all-path image denial. Removing metadata alone does not revoke already issued URLs or downloaded images.

Input bytes may expire while a retained job remains. Preserve the asset association/validated timestamp and immutable input_validated_at_submission, with availability=removed and removed_at distinct from invalid submission. Never retroactively describe the accepted job as missing its required submission. Output and preview cleanup have their own unresolved retention/API semantics; no default duration is set.

## 7. Proposed indexes and query justification

Every entry is a proposal. PKs and unique constraints already supply their own indexes; do not add another identical index. Composite FK targets that repeat an ID have an integrity purpose. Exact ordering/collation and plans require representative-data testing; no speculative full-text/vector/JSON/provider indexes are proposed.

| Table / indexed columns | Query or constraint | Unique? | Trade-off / write overhead |
|---|---|---|---|
| Every listed PK, including singleton subject, resource id, membership pair and parent/position | Identity lookup and singleton/ordered child integrity; GET job by id needs no extra status index | Yes | One required index per PK; children/identity insert/delete maintenance |
| wardrobe_garments, saved_outfits, recommendation_requests, recommendation_results: (id, owner_id); image_assets: (id, owner_id) | Composite owner-consistent FK targets | Yes | Additional wider indexes despite unique id; justified by enforceable ownership, not duplicate performance claims |
| image_assets: (bucket_id, object_path) | Canonical object identity, duplicate-object rejection and cleanup resolution | Yes | Text-key maintenance; immutable paths avoid update churn |
| outfit_items: (outfit_id, wardrobe_garment_id) and (outfit_id, catalog_garment_id), conditional by selected source | Duplicate membership prevention | Yes | Two source-specific indexes maintained only for relevant alternative |
| recommendation_items: (result_id, wardrobe_garment_id) and (result_id, catalog_garment_id), conditional by source | Duplicate generated membership prevention | Yes | Same source-specific cost during generation/expiry |
| try_on_jobs: person_input_asset_id; output_asset_id when present | One input/output association per job family | Yes | Required association uniqueness; cross-table reuse still needs guard |
| wardrobe_garments: (owner_id, created_at, id); (owner_id, name, id) | Owner list with stable newest/name cursor | No | Two list-order indexes; each garment write updates these keys only when changed |
| catalog_garments: (created_at, id); (name, id) | Shared/admin catalog newest/name cursor | No | Two shared-list indexes; no duplicate admin copy |
| saved_outfits: (owner_id, created_at, id); (owner_id, name, id) | Owned saved-list newest/name cursor | No | Two list indexes; name edits maintain name index |
| recommendation_results: (request_id, owner_id) | Request aggregate loading/expiry FK lookup | No | Extra insertion/expiry cost; PK does not start with request_id |
| recommendation_requests: (owner_id, id) | Owned dependency cleanup; possible count once semantics approved | No | One owner lookup index; no claim this defines recommendationCount |
| recommendation_requests: expires_at | Bounded expiry cleanup if persisted request aggregate is approved | No | One timestamp index per request; omit if request table consolidated |
| saved_outfits: origin_recommendation_id when present | Detach provenance at result expiry | No | Sparse maintenance on recommendation saves |
| outfit_items and recommendation_items: (wardrobe_garment_id, owner_id) and catalog_garment_id, each when selected | Source delete restriction and whole-result invalidation | No | Four reverse-reference indexes, distinct from parent-leading unique keys |
| try_on_jobs: (wardrobe_garment_id, owner_id) and catalog_garment_id, conditional by source | Referenced garment deletion checks | No | Two source reverse-lookup indexes |
| try_on_jobs: (owner_id, id) | Account cleanup without public job-history feature | No | One owned-dependency lookup index |
| image_assets: (owner_id, id); (availability, created_at) | Account cleanup and pending/orphan reconciliation | No | Two maintenance indexes; cleanup frequency/grace period requires review |
| wardrobe_garments.image_asset_id; catalog_garments.image_asset_id; saved_outfits.preview_asset_id; recommendation_results.preview_asset_id (non-NULL) | Attachment checks and asset-delete restriction | No | One per FK path; omit conditional preview indexes if preview storage is deferred |

No separate lifecycle-state index is justified: current eligibility is a subject-PK lookup. No status index is needed for GET /try-on/{id}; add a (status, created_at) worker queue index only if database polling is chosen and reviewed. Category/search currently have no fixed matching semantics; start with indexed owner/order scans plus filtering, measure, then review category composites or a substring-search index. A name B-tree supports name sort, not arbitrary substring searches. No separate expiry index on result is required if all result expiry follows its indexed parent request window; independent result-window cleanup would require review. Other Auth-owner checks use the listed owner-leading paths; results can be removed through their indexed request aggregate during account cleanup. Item owners are proven through composite parent/source FKs rather than redundant direct Auth FKs; admin membership begins with user_id.

## 8. Data lifecycle and FK deletion mapping

Default recommendation is conservative restriction where product behavior remains open. These are proposed physical actions, not deployed cascades. “Trusted transaction” means explicit dependency-safe deletion rather than an unreviewed permissive cascade. External bytes/Auth/providers are outside PostgreSQL's transaction.

| FK / dependency family | Proposed deletion action | Rationale and external work |
|---|---|---|
| user_profiles/body_profiles/user_preferences → Auth | CASCADE only at the final approved Auth-removal stage | Subject singletons have no meaning without live identity; normal deletion first coordinates cleanup and eligibility. A DB cascade is not the whole account workflow. |
| account_lifecycle → Auth | CASCADE at final Auth removal | Only live operational state; missing lifecycle fails closed. Tombstone has already been retained independently. |
| administrator_memberships → Auth | CASCADE | Do not retain effective grants for a removed identity; minimal deletion evidence is separate. |
| wardrobe_garments, saved_outfits, recommendation_requests/results, try_on_jobs, private image_assets → Auth | RESTRICT with trusted ordered cleanup first | Prevent Auth removal from hiding unresolved private images/jobs or broken dependency cleanup. Do not rely on provider behavior alone. |
| account_deletion_tombstones → Auth | No FK | Former subject evidence survives removal; any retention purge is a separate trusted reviewed operation. |
| outfit_items → saved_outfits via parent/owner | CASCADE | Deleting an owned outfit removes its membership only; does not delete garments. |
| recommendation_results → recommendation_requests via request/owner | CASCADE during reviewed aggregate expiry | A short-lived request owns its results; first detach saved provenance and handle conditional preview independence. |
| recommendation_items → recommendation_results via result/owner | CASCADE | Never leave partial result membership after parent removal. |
| outfit_items → wardrobe/catalog garment | RESTRICT | Saved outfits cannot silently lose items. Dependency-removal UX remains unresolved; returning conflict must be reviewed. |
| recommendation_items → wardrobe/catalog garment | RESTRICT by FK; trusted transaction may invalidate/delete the entire affected unsaved result before retry | Do not delete one result item and leave a misleading accepted result. Saved outfits remain independent. |
| try_on_jobs → wardrobe/catalog garment | RESTRICT until job removal under approved retention | Active jobs require target; terminal detach/snapshot is not approved. Conservative restriction avoids inventing retained private source snapshots. Review terminal-job deletion UX before rollout. |
| saved_outfits → origin result via result/owner | Trusted transaction sets only origin_recommendation_id to NULL before result removal | Preserve non-NULL outfit owner and independent metadata/items. Composite SET NULL must never null owner; choose supported targeted action or this explicit transaction after version review. |
| wardrobe_garments/current image → image_assets | RESTRICT | Swap/delete parent before old asset cleanup; accepted garment cannot lose current image. Deleting garment does not automatically delete bytes. |
| catalog_garments/current image → image_assets | RESTRICT | Same attachment safety, plus catalog-admin authorization. |
| saved_outfits/recommendation_results preview → image_assets | RESTRICT while attached | Conditional feature must define copy/ownership independence before use; expiry cannot remove saved outfit image by accident. |
| try_on_jobs input/output → image_assets via asset/owner | RESTRICT row deletion while job retained | Input bytes can become removed with evidence row retained; accepted submission history survives. Output-byte cleanup requires reviewed expired-result behavior. |
| Any image asset → actual Storage bytes | No application FK to bytes; asynchronous Storage coordination | Mark eligible, delete scoped canonical object, reconcile outcome, then record removed; do not edit storage.objects as an application shortcut. |

Image replacement swaps to a validated new association atomically, then cleans up old bytes after reference recheck. Ordinary parent deletion queues now-unreferenced eligible objects for cleanup; it never deletes another record's object. Try-on input cleanup may precede job cleanup, retaining only approved metadata/evidence. Retention periods, tombstone duration, external processor/backup deletion, terminal snapshots and deletion completion semantics remain open.

Account deletion first records deleting state plus minimal tombstone atomically, denying all normal access. Quiesce/claim-stop workers, then delete owned outfit/result children, jobs, garments, optional previews, asset bytes and records in safe order; revoke memberships and remove singleton data. Shared catalog remains. Confirm processor/Storage cleanup as required, then narrowly invoke Auth administrative deletion; retain approved minimal tombstone only. A retry resumes the existing subject-scoped stage. Never return current DELETE /account success merely because cleanup was queued: audited success implies completion. Hard/soft deletion, synchronous feasibility and recovery presentation require approval before this route is implemented.

## 9. Supabase security and permission design

### 9.1 Proposed exposure and operation matrix

All normal FastAPI-to-Data-API calls must retain the **current verified user JWT plus publishable key**. No service-role retry, shared mutable authorization/session or database-owner connection. Request/user A/B concurrency, refresh, failure and cancellation tests must prove this. The existing transport supports an internal rpc resource; it does not yet configure custom-schema headers or real database operations. Proposed `api` exposure therefore requires a later explicit adapter/schema integration decision, not a claim of present compatibility.

| Surface | Normal active authenticated caller | Active trusted catalog administrator | Trusted producer / cleanup | Grants, RLS and restrictions |
|---|---|---|---|---|
| app_private schema and all 15 base tables | No direct schema/table DML grants | Same; membership is application permission, not database-owner role | Only named task scope; no broad private-data browsing | Non-exposed schema; review PUBLIC/inherited/default grants. RLS enabled/default deny even on private tables; operation executors must not silently bypass it. |
| api schema | USAGE and EXECUTE on allowlisted owner operations/read projections only | Additional catalog mutation operation permission, checked from protected membership | Producer/cleanup-only operations not executable by ordinary authenticated/anon roles | No CREATE, TRUNCATE, unrestricted function execution or raw table/proxy access; no public sensitive projections. |
| Profile/body/preferences operations | Own read and allowlisted field updates | Own only | Bootstrap/cleanup; scoped processing read of required body fields | Subject equality plus active lifecycle; immutable singleton identity; no table-wide UPDATE that defeats column restrictions. |
| Wardrobe/outfit operations | Own allowed CRUD/aggregate operations | Own only | Authorized read for a bound task; cleanup by explicit subject/job | Composite ownership, source/asset validation and minimum-item guards apply inside operation, not just FastAPI. |
| Shared catalog operations | Read accepted catalog/images | Read plus guarded CRUD | No catalog mutation by ordinary try-on/recommendation workers | Current authoritative membership AND active lifecycle on mutation; no member write path through ordinary users. |
| Recommendation operations | Submit context/read/save own, never supply generated result fields | Same | Named producer writes only authorized request/result/item content; expiry deletes approved aggregates | Producer privilege separate from normal request JWT. User request is not authority to fabricate results. |
| Try-on operations | Submit approved fields/read own | Same | Claim/transition only assigned job, attach validated owner-bound output; cleanup after lifecycle check | No ordinary status/error/output/timestamp writes. Prevent deletion races and cross-job asset reuse. |
| Lifecycle/membership/tombstone | Narrow current-subject eligibility/permission boolean only, no normal row CRUD | Cannot self-grant or override disabled state | Narrow lifecycle/grant/delete operation per trusted responsibility | No editable metadata authority or public subject lookup; avoid RLS predicate recursion. |
| Storage API | Own permitted finalized reads; controlled pending upload only; guarded cleanup if authorized | Shared catalog reads/guarded catalog upload and replacement | Bound input read/output write/delete for approved task only | Private buckets, matching immutable path/purpose/owner and lifecycle on every enabled authenticated path; deny finalized overwrite. |
| Supabase Auth | Auth SDK signup/login/verification/recovery/refresh/session lifecycle | Same | Isolated necessary Auth deletion only | Never expose raw auth.users or service credentials; no business password/refresh-token persistence. |

At table/column level, normal roles receive **no direct base-table grants**, including SELECT/INSERT/UPDATE/DELETE; projections/functions expose only required columns. An operation executor receives only the specific tables, commands and columns it needs (separate executor roles by domain/authority where their grant sets differ): editable profile/garment metadata differs from ownership/lifecycle/result fields. Do not combine table-wide UPDATE with narrower column grants and call protected columns restricted. No schema creation, role administration, TRUNCATE, unrestricted sequences or automatic EXECUTE grants. Review views, function default grants, helper execution and search paths in addition to RLS.

### 9.2 Transaction executor review requirement

**Recommended physical boundary requiring explicit security review:** keep base DML inaccessible to clients and offer narrow transactional operations. Prefer invoker behavior wherever its base grants remain safe. An invoker function cannot magically access tables on which its caller has no privileges; claiming both would be incorrect.

For aggregate writes with the no-base-DML proposal, a possible reviewed mechanism is a constrained SECURITY DEFINER operation owned by a dedicated **non-table-owner, non-superuser, non-BYPASSRLS** execution role. That role has only the required column/operation grants; functions are schema-qualified with a fixed safe search path, no dynamic client SQL and explicit EXECUTE allowlists. RLS must apply to the executor and evaluate the verified request's Auth subject/lifecycle; merely switching execution role must not replace or trust caller-supplied JWT context. This is an elevated-function proposal, **not approval to implement it** or to alter the security architecture's invoker preference. Prove effective role, JWT subject, policy behavior and absence of owner bypass in integration tests. If that cannot be proven, choose a separately reviewed invoker-plus-database-guard design with equivalent direct-write protection before implementation.

All exposed operations must enforce the security-critical subset of business validation themselves: ownership, source references, lifecycle, minimum manual items, asset attachment, result save-window and trusted processing fields. A user with a public key and JWT can invoke them directly. FastAPI still performs full API validation/orchestration, but cannot be the only location of invariant enforcement.

Generated recommendation content and worker outputs require a distinct narrow producer authority. Do not expose a user-executable function accepting arbitrary “generated result” or “completed job” data. Recommend non-bypass producer task operations bound to a preauthorized request/job and persisted owner, not blanket table grants or a stored user refresh token. Credential/task-capability provisioning and synchronous recommendation producer handoff require review; no service-role key is used for ordinary user CRUD. Auth deletion or cleanup, if a privileged API is unavoidable, remains a separate named exception with explicit subject/object scope and no fallback from denied user operations.

### 9.3 RLS and lifecycle predicates

Every private row policy requires verified subject equality and authoritative active state; child operations also preserve parent/target integrity. Shared catalog reads require active authenticated identity; writes additionally require current catalog membership. Admins are denied personal data of others. Trusted-control rows are not user-editable; safe eligibility/membership helpers expose only the current caller's necessary answer and must avoid recursive policy dependencies.

Lifecycle is checked independently at FastAPI, Data API operations/RLS and Storage; a Data API pre-request hook alone does not cover Storage. Missing lifecycle or dependency failure denies normal access. Account disable/delete must also prevent new worker claims, input reads and output attachment; workers recheck persisted owner state. Serialize the deleting transition against competing acceptance/finalization operations with a documented lock/recheck protocol so cleanup cannot race into recreated data. Denial latency for already in-flight operations must be reviewed and tested, not assumed instantaneous. Missing operational row after Auth deletion continues to deny valid old JWTs; tombstone is trusted evidence, not a normal-access grant.

If confirmed email is required, bootstrap/eligibility must obtain it from an authoritative verified Auth source. Neither an arbitrary decoded JWT nor client-supplied metadata is proof. Authoritative Auth-to-application reconciliation and disabled-account administration are implementation decisions, not deployed capabilities. Signed URL residual access is still Section 6's unresolved delivery boundary.

Required integration tests cover normal A/B/admin, disabled/deleting same unexpired JWT, direct Data API and Storage, forbidden column writes/RPC calls, non-owner asset attachment, concurrent save/expiry/delete, shared catalog, frozen output/status, grants/defaults and unknown lifecycle. Repeat identity-isolation evidence under pooled concurrent calls and token refresh. The existing 28 backend tests do not certify database or Storage acceptance.

## 10. Transaction and coordination boundaries

No new public endpoint is proposed. These are internal operations supporting existing contracts. External object/Auth/provider work is not included in a PostgreSQL transaction.

| Operation | PostgreSQL atomic boundary | Storage / external coordination | Retry, idempotency and recovery |
|---|---|---|---|
| Bootstrap | Insert-if-absent profile, empty body, preferences and trusted lifecycle eligibility together; subject PKs prevent duplicates | Verify authoritative Auth identity/confirmation before active eligibility; Auth signup is separate | Repeated verified subject converges to one set; never overwrite user's later values or self-reactivate disabled state. Trigger vs protected operation unresolved. |
| Garment create/replacement | Lock lifecycle, garment/current/new asset; validate matching owner/purpose/availability; attach and mark accepted or swap FK atomically | Upload/verify new bytes first; cleanup old/orphan bytes afterward | Resource/asset identity and immutable path make internal retries safe. A client retry after lost response can still create another garment because contract has no idempotency key; do not claim end-to-end exactly-once. |
| Manual outfit create | Validate all distinct owned sources and active subject, enforce at least two; create header/items together, invisible until accepted | No required new upload | All-or-nothing; request timeout may follow commit. Duplicate POST behavior is unresolved. No standalone child mutation bypass. |
| Recommendation generation | Create owner-bound request; later publish validated nonempty result headers/items as complete aggregates, respecting wardrobeOnly and reviewed expiry | Authorize needed body/wardrobe inputs; trusted model/provider operation separate, synchronous API must finish within transport behavior | Producer retries bound to internal request/result IDs, no fabricated user results. External failures return failure or an authorized empty completed result as appropriate, not fake looks. Duration/deadline and orphan request cleanup reviewed. |
| Recommendation save | Lock result/request against expiry, check owner/deadline/sources/lifecycle, copy header/items into independent saved outfit and optional provenance atomically | Conditional preview copying/retention cannot be assumed atomic or approved | Save/expiry lock yields one deterministic outcome. Duplicate save policy and lost-response retry semantics need approval; do not invent a unique provenance rule. |
| Try-on acceptance | Lock lifecycle/selection/input; validate bytes evidence/consent, insert queued job plus immutable submission evidence atomically | Upload/verify person input first; dispatch only committed jobs | Dispatcher must recover commit-before-dispatch failure by retrying same job ID. No outbox table required yet: durable queued job is recoverable; delivery mechanism requires review. Client repeated POST may create duplicates. |
| Worker claim/transition/output | Conditional queued→processing claim; finalization locks job/lifecycle, validates matching output, attaches once and transitions completed/failed | Provider call outside transaction; output upload verified before attach | Repeated delivery cannot run competing finalizers. Crash-after-claim/stuck-processing recovery and provider idempotency require review; no new public retry/cancel status. Clean unattached outputs if finalization denied. |
| Input expiry / asset cleanup | Confirm eligibility for cleanup, preserve job evidence, mark asset cleanup_pending; after deletion record removed | Delete canonical bytes asynchronously, reconcile unknown outcomes | Repeating deletion of absent authorized bytes safe. Never erase submission evidence or approved live-required garment/output association. Durations unresolved. |
| Account deletion | Transition to deleting plus upsert tombstone atomically; serialize against acceptance/finalization. Perform dependency-safe stage transactions afterward | Stop workers; clean Storage/processors; privileged Auth deletion isolated at final stage | Resume same subject/stage after partial failure; remain denied throughout. Do not re-enable on failure. Public success/completion behavior requires review, not automatic async acceptance. |

Use consistent lock ordering (lifecycle before aggregate, then source/asset rows, with deterministic item order) and bounded retries for database serialization/deadlock failures. Recheck authorization after retry. Do not hold long database locks during model, upload or network calls. Internal idempotency is not a reason to invent an HTTP idempotency header/endpoint or claim existing clients send one.

## 11. API compatibility review — all 35 contracts retained

Each numbered row corresponds to the unchanged [audited inventory](../api-requirements.md). “Maps” means the proposed storage can support existing fields, not an implemented endpoint. Errors/loading/empty states remain current frontend behavior: collections require items arrays, singleton editors require useful objects, optional numeric clearing uses NULL, status errors use sanitized text, and error bodies currently are not rendered as field errors.

| API | Existing operation | Proposed persistence / trusted operation | Mapping, mismatch or decision |
|---|---|---|---|
| 01 | POST /auth/login | External Supabase Auth; derived profile/permission projection if required | Current custom Session is not Supabase SDK session. Explicit frontend migration still required; no password table. |
| 02 | POST /auth/signup | External Auth plus trusted bootstrap | Name maps to profile after verified identity; no automatic role/membership. Verification/empty-name defaults need review. |
| 03 | POST /auth/password-reset | External Auth | No application reset-token persistence. Existing route migrates explicitly, no invented server capability. |
| 04 | POST /auth/password-reset/confirm | External Auth recovery lifecycle | Current query token/password contract differs from SDK callback/session recovery; reconcile in migration. |
| 05 | POST /auth/password | External Auth | Current currentPassword/newPassword flow and reauthentication need review; no stored password/hash. |
| 06 | POST /auth/logout | External Auth session revocation | No business session table. Existing access JWT may outlive logout; session revocation policy remains open. |
| 07 | GET /auth/me | Auth identity + profile + trusted permission projection | Declared-only. role response is derived authority, never input role; does not expose membership table. |
| 08 | DELETE /account | Lifecycle, tombstone, all owned dependencies; isolated Auth/Storage cleanup | Current completion response cannot silently become queued acceptance; retention/recent-auth/deletion semantics block implementation. |
| 09 | GET /dashboard | Derived owned wardrobe/outfit counts; recommendation aggregate if approved | No statistics table. Exact recommendationCount definition is unresolved and sensitive to expiry. |
| 10 | GET /profile | user_profiles | Flat fields map. Bootstrap must avoid permanent 404/null that blocks editor; empty profile presentation reviewed. |
| 11 | PATCH /profile | Validated own profile update | Name/style/location/bio map; full form clearing preserved; trimmed/nonblank normalization reviewed. |
| 12 | GET /profile/body | body_profiles | Flat unit/measurement/appearance fields map; BodyProfile type currently omits appearance/nullability. |
| 13 | PATCH /profile/body | Validated own body update | NULL numeric clearing maps; unit conversion/ranges/precision need agreement before constraints ship. |
| 14 | GET /settings | user_preferences | units and emailNotifications projection maps; boolean is translated to current strings. No theme feature. |
| 15 | PATCH /settings | Validated own preferences update | Enabled/Disabled maps to boolean; blank/unset to reviewed NULL behavior; does not reinterpret measurements. |
| 16 | GET /wardrobe | Owned accepted wardrobe + current assets | search/category/sort/limit/cursor project Page<Garment>; imageUrl derived; cursor/search semantics need finalization. |
| 17 | GET /catalog | Shared accepted catalog + assets | Active authenticated shared read; no private backlink exposure. Same Page shape. |
| 18 | GET /outfits | Own saved headers/items + optional assets | Metadata maps; mixed-source garmentIds response is blocked. Empty category is a no-op, not a new outfit category field. |
| 19 | GET /admin/catalog | Same catalog, trusted current membership | No separate admin-owned catalog; detailed admin workflow still deferred. |
| 20 | POST /wardrobe | Guarded garment + validated image association | Multipart metadata/image maps. Required image accepted only after validation; no client asset/owner fields. |
| 21 | GET /wardrobe/{id} | Owned accepted garment + asset projection | Maps existing optional Garment fields; no wardrobe price write is inferred. |
| 22 | PATCH /wardrobe/{id} | Guarded metadata update / optional image swap | Full multipart metadata plus optional replacement image maps; no image gallery. |
| 23 | DELETE /wardrobe/{id} | Reference checks and owned garment deletion; external orphan cleanup | RESTRICT while saved/job dependencies exist is proposed, not approved UX. No false success. |
| 24 | POST /admin/catalog | Trusted catalog creation + validated catalog image | price maps to price_inr; rounding >2 decimals requires review; no inventory/order attributes. |
| 25 | GET /admin/catalog/{id} | Same catalog detail under membership check | Maps; does not expose private references or personal image locators. |
| 26 | PATCH /admin/catalog/{id} | Trusted metadata/price update + optional image swap | Maps subject to fractional-price and replacement validation decisions. |
| 27 | DELETE /admin/catalog/{id} | Shared dependency checks + catalog cleanup | Saved/job references restrict deletion; withdrawal/terminal-job behavior needs approval. |
| 28 | GET /catalog/{id} | Shared authenticated detail + image | Maps, including existing explicit source=catalog try-on navigation. |
| 29 | POST /outfits | Atomic manual header/items OR result-owner/save-window validated copy | Manual wardrobe-only garmentIds maps with min two. recommendationId resolves server results; mixed-source saved response and generated-save minimum/duplicates need approval. |
| 30 | GET /outfits/{id} | Own independent saved header/items | Wardrobe-only maps. Catalog items cannot be source-less garmentIds linked to wardrobe; separate API/navigation adaptation required. |
| 31 | PATCH /outfits/{id} | Own name/occasion/description only | Maps raw optional empty strings; does not expose item/source/owner/provenance mutation. |
| 32 | DELETE /outfits/{id} | Delete owned header; cascade own items | Garments remain; conditional preview cleanup separate, provenance does not delete result. |
| 33 | POST /recommendations | Request/results/items + trusted producer and expiry | Synchronous Page<Outfit>, no new status/history API. Durable saveable result ID supported; mixed-source encoding, save window, preview retention and count remain open. |
| 34 | POST /try-on | Validated source, input asset, job and embedded consent | Multipart source/garmentId/person/photoConsent maps. No user status/output writes. Consent policy/version not supplied and not fabricated. |
| 35 | GET /try-on/{id} | Own job + authorized output projection | Four existing statuses preserved. Expired input evidence supported internally; expired output/job HTTP behavior remains unresolved. |

Common list rules: default limit 24 as currently sent; stable keyset cursor includes filter/sort context and deterministic ID tiebreaker. Sign/validate cursors or otherwise reject tampering; cursors never confer ownership. Search matching/case/collation need review before indexes/contract behavior are fixed. Empty search/category must not fail a legitimate unfiltered request. nextCursor ends with absent/null/empty as audited; no total/page-count contract is added.

The transport has a 20-second deadline, no idempotency keys and no runtime schema validation except partial login checks. Remote image delivery has no bearer header or automatic refresh. Collection pages replace rather than append results. These are integration constraints, not permissions to redesign the frontend in this task.

## 12. Decisions and unresolved review gates

### A. Directly supported by approved architecture

- Auth UUID root; asymmetric JWT verification with signature/issuer/audience/expiry/claims checks. Current caller token must reach Supabase, without cross-request leakage or privileged fallback.
- User-owned data isolation and source ownership consistency; authenticated shared catalog with trusted mutations; no client-derived admin authority.
- Approach B is expressly selected by this physical-specification request. API adaptation remains separate.
- RLS plus least-privilege schema/table/operation/column/function grants; direct access must not bypass security-critical business validation.
- Disabled/deleting denial on FastAPI, direct Data API and Storage even with valid JWT; authoritative verification status if email confirmation required.

### B. Recommended physical choices requiring approval

- Fifteen-table proposal, private base schema and narrowly exposed transaction boundary; separate singletons, live lifecycle/tombstone and trusted membership, common assets, independent outfit/result children and embedded job consent/input/output.
- UUID resource IDs, bounded strings, constrained text vocabularies, measurement/price precision, nullable unset preferences, timestamp defaults, optional normalization and composite ownership keys.
- Accepted-image guard, source XOR, distinct item membership/order, conservative FK restrictions, independent saved metadata/items and detachable provenance.
- Short-lived recommendation request persistence; no JSONB, derived dashboard and transient image URLs. Conditional preview fields remain unset until their lifecycle is approved.
- Index inventory, lock order, asset staging/immutable finalization and cleanup reconciliation.
- Any elevated transactional executor must receive explicit review of its least privileges and RLS behavior; invoker preference is preserved, not silently replaced. No implementation is authorized by this recommendation.

### C. Product decisions requiring user input

1. Mixed wardrobe/catalog outfit response/navigation adaptation. This blocks mixed-source recommendation and saved outfit delivery; no catalog-copy shortcut chosen.
2. Recommendation save-window/retention, recommendationCount meaning, generated-save minimum, duplicate-save behavior and preview ownership/copy rights.
3. Garment/catalog deletion conflict UX, source withdrawal and terminal-job snapshot/detach versus restriction until expiry.
4. Try-on input/output/job retention, expired-result API presentation, processor deletion and consent policy/version/withdrawal. Current true flag alone does not prove legal sufficiency.
5. Body unit conversion/canonical storage/ranges/rounding, price fractional precision, optional/default profile/preference values and blank normalization.
6. Account deletion completion/hard-or-soft semantics, recent-auth policy, tombstone basis/minimum fields/retention and signed-URL residual delivery window or revocable alternative.

### D. Supabase implementation details requiring review and integration tests

1. Actual schemas exposed by PostgREST, adapter schema selection, grants/default privileges, executor ownership/RLS identity and safe helper behavior. Never certify with an HTTP success alone.
2. Trusted lifecycle source/reconciliation with Auth state and authoritative email verification; bootstrap mechanism and serialization against deletion; fail-closed behavior on outages.
3. Private membership provisioning/revocation and active-admin tests; admin workflow remains deferred.
4. Producer/worker task authority, credentials and assigned scope, claiming/recovery and no unapproved result fabrication; no user refresh-token retention.
5. Storage policy visibility, subject/purpose matching, sealed immutable bytes, direct-upload/replace/delete attacks, disabled/deleting path denial and signed URL residual behavior.
6. Composite FK targets/deletion behavior and enforcement of cross-table attachments/aggregate checks under concurrent writes. PostgreSQL version/features and schema permissions must be verified before choosing any executable mechanism.
7. Real A/B/admin negative tests and measured query plans. Current security infrastructure has no business routes, schema, policy, real Storage proof or authoritative eligibility implementation.

## 13. Final review summary and next milestone

**Proposed count: 15 application tables**, not deployed objects: user_profiles, body_profiles, user_preferences, account_lifecycle, account_deletion_tombstones, administrator_memberships, image_assets, wardrobe_garments, catalog_garments, saved_outfits, outfit_items, recommendation_requests, recommendation_results, recommendation_items and try_on_jobs. Request separation, membership representation and conditional preview fields remain reviewable; count is not a requirement to implement all without approval.

Entity mapping: E01 stays in Supabase Auth; E02→user_profiles; E03→body_profiles; E04→user_preferences; E05→wardrobe_garments; E06/E08→image_assets plus garment current-image FKs; E07→catalog_garments; E09→saved_outfits; E10→outfit_items; E11→recommendation_requests; E12→recommendation_results/recommendation_items; E13→try_on_jobs; E14→image_assets plus job input/output FKs; E15→account_lifecycle/account_deletion_tombstones; E16→administrator_memberships; E17→embedded job consent fact. R01–R22 remain traceable through Section 2; no relationship is silently dropped.

Most important constraints are immutable verified ownership, composite owner-consistent FKs, exactly-one source, distinct membership, singleton identities, manual aggregate min two, valid image at garment/job acceptance, unexpired owner-bound save and preserved input-submission/tombstone evidence. Security requires user JWT context, all-path lifecycle checks, private base privileges, constrained transaction execution and narrow trusted producer/cleanup authority. SQL transactions cover accepted aggregate writes; Storage/provider/Auth effects require staged, retryable reconciliation.

Source inconsistencies requiring later discussion: legacy technology docs conflict with the approved stack; BodyProfile omits form appearance/null numeric values; Preferences.theme is type-only; source-less garmentIds and wardrobe-only detail links conflict with mixed catalog recommendations; current auth Session/routes are not yet Supabase Auth SDK lifecycle; current UI numeric validation leaves unit semantics and decimal rounding unspecified; completed job needs an image but expiry has no contract; image URL renewal, recommendationCount, defaults and account deletion completion remain undefined. None is corrected by changing code or the 35 contracts here.

Next milestone: review this physical proposal and its blockers, approve table/permission/transaction choices, and resolve the critical product/integration decisions. Then prepare an implementation plan and concrete database/Storage negative-test matrix; only after separate implementation approval write development migrations/policies and prove identity, lifecycle, direct-access and concurrency invariants against Supabase. The frontend Auth migration remains an explicit separate milestone covering provider, signup/login, callbacks, recovery, refresh/restoration and latest-token API retrieval. No deployment or database acceptance is claimed by this document.
