# Database Entity Inventory v0.1 — Drape & Drop

## 1. Scope and evidence

Preliminary logical inventory, November 5, 2026. No entities are deployed by this document. Names and attributes are conceptual, not final tables, types or SQL.

Inspected [API requirements](../api-requirements.md), [approved security architecture](../authentication-and-security.md), [backend setup](../../../backend/README.md), [security checkpoint](../checkpoint-001-security-foundation.md), backend/app security/config/dependencies/data_api/main, mobile/src/types/domain.ts, mobile/src/services/api resources/client, shared form schemas and screens, and original docs/PRD.md, docs/architecture.md and README.md.

The original PRD/architecture describe Next.js/Node/server actions; those technology assumptions are superseded by the approved Expo/FastAPI/Supabase baseline. Their wardrobe, outfit and try-on goals remain product context. They do not authorize extra ecommerce, social or avatar entities.

**Existing requirements:** audited frontend operations, Supabase Auth UUID identity, user-scoped RLS, trusted catalog administration and disabled/deleting account denial. **Proposed entities:** persistence boundaries below. **Unresolved:** exact schema, image separation, retention, mixed-source references and lifecycle mechanisms. Backend currently verifies tokens and forwards request-scoped credentials but exposes no business APIs; account eligibility is deliberately unconfigured/fail-closed. No database state was inspected.

## 2. Entity inventory

Each identity below must be stable and server-controlled. User ownership derives from the verified Auth subject, never a client role or submitted owner value.

### E01. Auth identity (external, not a new application credential entity)

- Purpose / persistence justification: Supabase-managed identity links application ownership. Persistence is supplied by Supabase Auth; do not duplicate password/refresh-token tables.
- Conceptual attributes: Auth UUID; email/confirmation/session information remains authoritative in Auth.
- Primary identity requirement: Existing Auth UUID.
- Ownership: Trusted system; personal identity.
- Relationships: Parent identity for all user-owned records, lifecycle and membership.
- Sensitive personal data: Yes: identity/email.
- Relevant APIs: Audited /auth/* contracts require explicit migration to direct Auth; /account orchestrates deletion.
- Security considerations: Never infer administrator status from editable Auth metadata. JWT database role authenticated is not application admin.

### E02. User profile

- Purpose / persistence justification: Persist user-editable personal details across sessions. Separate from Auth identity because business profile fields have their own access rules.
- Conceptual attributes: Name, style description, location, biography.
- Primary identity requirement: At most one current profile per Auth UUID; separate surrogate identity is optional.
- Ownership: User-owned.
- Relationships: One profile belongs to one Auth identity.
- Sensitive personal data: Yes.
- Relevant APIs: GET/PATCH /profile; dashboard identity context.
- Security considerations: Whitelist editable fields; no role/lifecycle controls; decide bootstrap/default record behavior.

### E03. Body profile and appearance

- Purpose / persistence justification: Persist optional measurements and self-reported fit/appearance for personalization. A single profile entity is justified; separate appearance entity is not yet required.
- Conceptual attributes: Measurement unit, height/chest/waist/hips/inseam, fit, body shape, skin tone description, undertone.
- Primary identity requirement: At most one current record per Auth UUID.
- Ownership: User-owned.
- Relationships: Belongs to one identity; recommendations may use authorized current values.
- Sensitive personal data: Yes: sensitive body/appearance information.
- Relevant APIs: GET/PATCH /profile/body.
- Security considerations: No automatic body analysis implied. Resolve nullable values and unit conversion; frontend BodyProfile type omits appearance fields.

### E04. User preferences

- Purpose / persistence justification: Persist units and email preferences independent of a device session. Separate logical entity; combining with profile physically remains open.
- Conceptual attributes: Units and email-notification preference. Theme exists in a type but has no current editor/API payload.
- Primary identity requirement: At most one current set per Auth UUID.
- Ownership: User-owned.
- Relationships: Belongs to one identity.
- Sensitive personal data: Yes: account preferences.
- Relevant APIs: GET/PATCH /settings via /preferences.
- Security considerations: Client cannot change auth/security/role settings here. Resolve overlap with body-profile units.

### E05. Wardrobe garment

- Purpose / persistence justification: Persist the user’s physical wardrobe metadata for listing, selection and outfits.
- Conceptual attributes: Name, category, color, brand, size, material, notes; image reference.
- Primary identity requirement: Stable garment ID distinct from owner identity.
- Ownership: User-owned.
- Relationships: Identity has many garments; garment may participate in many outfits/recommendations/jobs.
- Sensitive personal data: Yes: personal wardrobe/photos and free text.
- Relevant APIs: GET/POST /wardrobe; GET/PATCH/DELETE /wardrobe/{id}; selectors in outfits and try-on.
- Security considerations: Owner immutable to ordinary clients; references must share owner; no invented classification outputs.

### E06. Garment image reference / storage asset

- Purpose / persistence justification: Persist the association to a durable Storage object; signed imageUrl is a delivery value, not durable identity. Separate image row is optional because current UI consumes one image per garment.
- Conceptual attributes: Bucket/object locator, owning garment, validated media metadata, upload/replacement state if needed.
- Primary identity requirement: Unique object locator; separate asset ID only if separate records approved.
- Ownership: User-owned.
- Relationships: Current garment has zero or one image in response; creation requires one upload. Historical replacements are not a product requirement.
- Sensitive personal data: Yes: personal image and possible embedded metadata.
- Relevant APIs: Multipart POST/PATCH wardrobe; imageUrl on garment reads.
- Security considerations: Validate bytes; authorize object access and replacement; coordinate orphan cleanup. Removing local replacement does not request deletion of stored image.

### E07. Shared catalog garment

- Purpose / persistence justification: Persist shared clothing information available to authenticated users. Separate from owned wardrobe; do not conflate their identities.
- Conceptual attributes: Garment metadata plus optional price labeled INR by frontend.
- Primary identity requirement: Stable catalog garment ID.
- Ownership: Shared authenticated catalog.
- Relationships: Many users may read/reference a catalog piece; trusted admins manage it.
- Sensitive personal data: Normally product data; avoid personal data in notes/images.
- Relevant APIs: GET /catalog and /catalog/{id}; admin catalog CRUD.
- Security considerations: Trusted admin writes only, no universal personal-data access. Currency/variants/inventory are not modeled by existing contract.

### E08. Catalog image reference / storage asset

- Purpose / persistence justification: Persist product image association. Separate rows versus a single catalog image field remains open; gallery not required.
- Conceptual attributes: Storage object locator, catalog garment association, validated media metadata.
- Primary identity requirement: Unique object locator; optional asset identity.
- Ownership: Shared catalog, trusted administrator-managed.
- Relationships: Catalog garment has zero or one displayed image; create form requires one.
- Sensitive personal data: Normally no personal data; content review still necessary.
- Relevant APIs: Admin multipart create/update; catalog/admin read imageUrl.
- Security considerations: Authenticated sharing does not mean public bucket access; use trusted mutation permissions.

### E09. Saved outfit

- Purpose / persistence justification: Persist manually assembled or recommendation-saved looks.
- Conceptual attributes: Name, occasion, description, constituent references; optional image reference; optional provenance if justified.
- Primary identity requirement: Stable outfit ID.
- Ownership: User-owned.
- Relationships: One identity has many outfits; each outfit has item associations.
- Sensitive personal data: Yes: style preferences and possible personal imagery.
- Relevant APIs: GET/POST /outfits; GET/PATCH/DELETE /outfits/{id}.
- Security considerations: Deleting outfit preserves garments. Metadata PATCH does not currently edit garment membership.

### E10. Outfit item / garment reference

- Purpose / persistence justification: Persist which garments make up each outfit and enforce ownership per association. Relational association is recommended instead of trusting a free ID array.
- Conceptual attributes: Parent outfit, referenced garment identity and source; ordering only if needed to preserve returned array.
- Primary identity requirement: Association identity or unique parent/reference combination; exact key open.
- Ownership: User-owned through parent; targets may be owned wardrobe or shared catalog.
- Relationships: Outfit has many items; garment can occur in many outfits.
- Sensitive personal data: Yes through owner/style linkage.
- Relevant APIs: POST /outfits; GET /outfits/{id} garmentIds; recommendation save.
- Security considerations: Both parent and wardrobe target must share owner. Existing garmentIds lacks source and detail links all IDs to wardrobe; mixed-source decision required.

### E11. Recommendation request

- Purpose / persistence justification: Persist owner and request context if results are saved/retrieved beyond the request; retention is unresolved, not necessarily an indefinite history table.
- Conceptual attributes: Occasion, preference text, wardrobeOnly, owner; optional processing/provenance metadata if approved.
- Primary identity requirement: Server request identity if persisted; no request ID is currently returned.
- Ownership: User-owned with trusted processing fields.
- Relationships: Identity has zero or many requests; request yields zero or many results.
- Sensitive personal data: Yes: preferences and potentially body/wardrobe provenance.
- Relevant APIs: POST /recommendations.
- Security considerations: Authorize every input; prevent clients writing processing results. Current API expects synchronous items, not a job contract.

### E12. Recommendation result

- Purpose / persistence justification: A retrievable owner-bound result identity is justified by saving recommendationId in a later request. Physical persistence versus bounded server retention needs review.
- Conceptual attributes: Name, description, occasion, garment references, optional output image; source request and expiry if chosen.
- Primary identity requirement: Stable returned recommendation ID for the supported save window.
- Ownership: User-owned; trusted generated result fields.
- Relationships: Request may yield many results; result may become a saved outfit.
- Sensitive personal data: Yes.
- Relevant APIs: POST /recommendations response; POST /outfits with recommendationId; dashboard recommendationCount.
- Security considerations: Reject cross-user/expired references; decide duplicate save behavior and whether saved content is snapshotted. Count meaning remains open.

### E13. Try-on job

- Purpose / persistence justification: Persistence is required because a returned job ID is checked by a later request, potentially after background processing.
- Conceptual attributes: Owner, selected garment/source, input image reference, queued/processing/completed/failed status, output reference, safe error; lifecycle timestamps if approved.
- Primary identity requirement: Stable server job ID.
- Ownership: User-owned; trusted system controls processing state.
- Relationships: Identity has many jobs; each current submission uses one garment and one person image; job produces zero or one displayed result.
- Sensitive personal data: Yes: personal photo and generated appearance.
- Relevant APIs: POST /try-on; GET /try-on/{id}.
- Security considerations: No user-authored result/status; verify garment ownership/access and active account. No job history/cancel endpoint exists.

### E14. Try-on input/output asset references

- Purpose / persistence justification: Persist input/output object associations so workers can read inputs and later job reads can deliver output. Separate assets or job fields remain open.
- Conceptual attributes: Object locator, input/output purpose, associated job/owner; validation and retention metadata if approved.
- Primary identity requirement: Unique Storage object locator; optional separate asset ID.
- Ownership: User-owned, worker-managed outputs.
- Relationships: Each job currently one person input and at most one displayed output; garment image remains a separate authorized reference.
- Sensitive personal data: Yes: highly sensitive personal images.
- Relevant APIs: POST /try-on person upload; job response imageUrl.
- Security considerations: Private delivery, short retention, consent linkage and deletion cleanup; URL expiry must not undermine lifecycle denial guarantees.

### E15. Account lifecycle state

- Purpose / persistence justification: Authoritative persisted eligibility is required to deny disabled/deleting accounts despite valid JWTs. Exact source/physical representation remains unresolved.
- Conceptual attributes: Identity, active/disabled/deleting eligibility, trusted transition context; cleanup progress separately only if necessary.
- Primary identity requirement: One authoritative eligibility identity per Auth UUID.
- Ownership: Trusted administrative/system data about a user.
- Relationships: Gates all normal records, catalog access and Storage operations for that identity.
- Sensitive personal data: Yes: account/security state.
- Relevant APIs: All protected operations; DELETE /account initiates orchestration.
- Security considerations: User cannot self-enable or overwrite state. Check across FastAPI/direct Data API/Storage. Auth deletion must not remove the only denial evidence too early.

### E16. Trusted administrator membership

- Purpose / persistence justification: Trusted permission persistence is required somewhere; separate membership relation is the security document’s recommendation, not a settled schema.
- Conceptual attributes: Auth identity, granted catalog permission, trusted grant/revoke provenance.
- Primary identity requirement: Unique identity/permission membership, if relation chosen.
- Ownership: Trusted administrative/system.
- Relationships: Auth identity has zero or relevant catalog memberships.
- Sensitive personal data: Yes: security/authorization information.
- Relevant APIs: Admin catalog mutations; optional /auth/me projection unresolved.
- Security considerations: No user writes, no client role authority. Alternative server-managed claim source has refresh/demotion lag. Admin workflow review deferred.

### E17. Try-on consent evidence (conditional)

- Purpose / persistence justification: Existing photoConsent=true input justifies recording consent evidence with submission; does not require a standalone generic consent ledger.
- Conceptual attributes: Subject, job/input association, consent assertion; server receipt time and policy/version only after policy approved.
- Primary identity requirement: Job-associated consent fact; separate consent identity optional.
- Ownership: User-associated evidence, trusted recorded context.
- Relationships: Current job can hold one submission consent; wider history not specified.
- Sensitive personal data: Yes: personal processing authorization.
- Relevant APIs: POST /try-on only.
- Security considerations: A client boolean alone is not proof of complete consent compliance. No policy-version field or consent-management API exists; retention/withdrawal unresolved.

### No separate entity justified yet

Dashboard counts are derived projections, not a required statistics table. Pagination cursors, transient validation/errors, UI draft memory, JWT/JWKS cache, passwords and refresh tokens are not application business entities. ImageUrl need not be stored as a long-lived signed URL. Separate body-analysis/classification/model entities, catalog gallery, user gallery, consent-policy ledger, deletion-job table, audit-event store or ML model registry need further requirements before separate persistence is chosen. No cart/order/payment/social data is justified.

## 3. Relationship inventory

- Auth identity → profile/body/preferences: zero-or-one each before bootstrap; intended one current set after bootstrap. Creation timing/defaults unresolved.
- Auth identity → wardrobe garments, outfits, recommendation requests/results and try-on jobs: one-to-many; every owned record resolves to exactly one owner.
- Wardrobe/catalog garment → displayed image: zero-or-one response association; creation requires one. Physical image history/multiple assets remain undecided.
- Outfit → outfit items: one-to-many; manual creation currently requires at least two selected wardrobe pieces. Items → garment: each item must resolve to exactly one authorized target. Wardrobe target owner must equal outfit owner. Shared catalog target rules differ.
- Garment → outfit/recommendation/job references: zero-to-many. Current frontend expects saved outfit garmentIds to resolve as wardrobe IDs, conflicting with mixed-source recommendations.
- Recommendation request → results: zero-to-many; each result has an owner, whether request/result use separate physical records or an aggregate. Saving must resolve an owned result atomically into an owned outfit.
- Try-on job → person input: one; job → generated output: zero-or-one for current contract. Input reuse across jobs is not assumed. Each job references one selected wardrobe or catalog garment.
- Job → consent evidence: one submission fact if stored, separate entity optional. No general consent history requirement inferred.
- Auth identity → authoritative lifecycle: one logical current state; → admin membership: zero-or-more permissions or one current membership depending on representation. Neither is user-editable.

All parent/child relationships must prevent attaching another user’s child or parent even if IDs are known. Shared catalog access never grants visibility into another user’s outfits or photos.

## 4. Ownership and trust boundaries

Supabase Auth UUID is the root identity, obtained from FastAPI-verified JWT sub. Application references point to that identity, but raw Auth tables are not exposed to ordinary users. Display name/email/role copies are not independent authentication authorities.

User-owned: profiles, measurements/appearance, preferences, wardrobe/images, saved outfits/items, recommendations, try-on/jobs/images and associated consent. Shared authenticated catalog: product records/images, with trusted mutations. Trusted administrative/system: lifecycle state, permission membership, worker-owned status/result fields and cleanup controls. Product admin does not gain blanket access to user-owned records. Trusted service-role operations are separately scoped exceptions; no elevated fallback.

All normal database requests use the authenticated JWT context and RLS. Ownership is server-derived. Account eligibility must additionally deny normal FastAPI, direct Data API and Storage access for disabled/deleting users, including valid-JWT cases. Current UnconfiguredEligibility has not implemented that database-backed decision.

## 5. Existing API coverage

The following preserves all 35 method/endpoint combinations from the audit. Mapping is conceptual, not a replacement contract or deployed handler inventory. Auth operations remain recorded even though their direct-Supabase migration requires explicit reconciliation.

- **API 01 — `POST /auth/login`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 02 — `POST /auth/signup`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 03 — `POST /auth/password-reset`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 04 — `POST /auth/password-reset/confirm`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 05 — `POST /auth/password`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 06 — `POST /auth/logout`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 07 — `GET /auth/me`:** Supabase-managed Auth identity/session; no new application credentials entity. /auth/me may project trusted membership/profile, but is declared-only and unused.
- **API 08 — `DELETE /account`:** Lifecycle state plus owned profile/body/preferences, garments/assets, outfits/items, recommendations, try-on/assets/consent and Auth identity; deletion orchestration spans services.
- **API 09 — `GET /dashboard`:** Derived counts of owned garments, saved outfits and recommendation results; no separate dashboard entity.
- **API 10 — `GET /profile`:** User profile.
- **API 11 — `PATCH /profile`:** User profile.
- **API 12 — `GET /profile/body`:** Body profile with self-reported appearance.
- **API 13 — `PATCH /profile/body`:** Body profile with self-reported appearance.
- **API 14 — `GET /settings`:** User preferences; current API strings/units preserved.
- **API 15 — `PATCH /settings`:** User preferences; current API strings/units preserved.
- **API 16 — `GET /wardrobe`:** Owned wardrobe garments/image associations; deletion must resolve dependent outfit/recommendation/job references.
- **API 17 — `GET /catalog`:** Shared catalog garments/image associations; authenticated reads.
- **API 18 — `GET /outfits`:** Owned saved outfits/items and associated image reference; metadata PATCH does not currently mutate items; DELETE preserves wardrobe garments.
- **API 19 — `GET /admin/catalog`:** Shared catalog garments and image associations; authoritative membership and lifecycle checks. Detailed admin workflow review deferred.
- **API 20 — `POST /wardrobe`:** Owned wardrobe garments/image associations; deletion must resolve dependent outfit/recommendation/job references.
- **API 21 — `GET /wardrobe/{id}`:** Owned wardrobe garments/image associations; deletion must resolve dependent outfit/recommendation/job references.
- **API 22 — `PATCH /wardrobe/{id}`:** Owned wardrobe garments/image associations; deletion must resolve dependent outfit/recommendation/job references.
- **API 23 — `DELETE /wardrobe/{id}`:** Owned wardrobe garments/image associations; deletion must resolve dependent outfit/recommendation/job references.
- **API 24 — `POST /admin/catalog`:** Shared catalog garments and image associations; authoritative membership and lifecycle checks. Detailed admin workflow review deferred.
- **API 25 — `GET /admin/catalog/{id}`:** Shared catalog garments and image associations; authoritative membership and lifecycle checks. Detailed admin workflow review deferred.
- **API 26 — `PATCH /admin/catalog/{id}`:** Shared catalog garments and image associations; authoritative membership and lifecycle checks. Detailed admin workflow review deferred.
- **API 27 — `DELETE /admin/catalog/{id}`:** Shared catalog garments and image associations; authoritative membership and lifecycle checks. Detailed admin workflow review deferred.
- **API 28 — `GET /catalog/{id}`:** Shared catalog garments/image associations; authenticated reads.
- **API 29 — `POST /outfits`:** Saved outfit/items from owned wardrobe IDs OR owned recommendation result. Mixed-source references and duplicate-save semantics unresolved.
- **API 30 — `GET /outfits/{id}`:** Owned saved outfits/items and associated image reference; metadata PATCH does not currently mutate items; DELETE preserves wardrobe garments.
- **API 31 — `PATCH /outfits/{id}`:** Owned saved outfits/items and associated image reference; metadata PATCH does not currently mutate items; DELETE preserves wardrobe garments.
- **API 32 — `DELETE /outfits/{id}`:** Owned saved outfits/items and associated image reference; metadata PATCH does not currently mutate items; DELETE preserves wardrobe garments.
- **API 33 — `POST /recommendations`:** Recommendation request/result identities and authorized profile/body/wardrobe/catalog inputs; synchronous response contract preserved.
- **API 34 — `POST /try-on`:** Owned try-on job, person/output object references, garment reference, submission consent; system-controlled state.
- **API 35 — `GET /try-on/{id}`:** Owned try-on job, person/output object references, garment reference, submission consent; system-controlled state.

### Contract/model mismatches requiring review

Outfit garmentIds has no source discriminator although recommendations allow catalog pieces; detail links all IDs to wardrobe. Single imageUrl hides Storage identity/expiry and cannot express an image collection. BodyProfile omits appearance fields and nullable numeric writes. Preferences/body duplicate units without conversion. Recommendation results need a saveable identity but lifetime/history/count semantics are unspecified. Try-on jobs persist across requests yet lack history/cancel APIs. Profile GET must provide usable defaults or bootstrap because missing records block the editor. Auth contracts predate direct Supabase Auth; keep their migration explicit. None is changed here.

## 6. Integrity and security concerns

- Conceptual foreign keys: owned records → Auth identity; images → parent garment/job; outfit items → outfit and authorized garment; results → request if requests retained; saved recommendation provenance → owned result if retained; jobs → owner, authorized garment, input/output asset; consent → subject/job; membership/lifecycle → authoritative identity.
- A foreign key alone does not prove equal ownership. Enforce parent/child ownership and source-specific reference validity atomically, including direct Data API writes and concurrent updates. Cross-user recommendation saves must fail.
- Conceptual uniqueness: one current profile/body/preferences/lifecycle per user; stable resource IDs; unique object locator; membership permission per user; prevent accidental duplicate outfit item association unless repeated pieces become an explicit requirement. Duplicate recommendation saves remain a product decision.
- Restrict ordinary writes to editable attributes. Owner IDs, membership grants, lifecycle status, processing result/status and object associations need trusted constraints/operation boundaries. RLS must combine with least-privilege schema/table/operation/column/function grants.
- Account deletion spans Auth, database rows, Storage and workers; it is not a single automatic database cascade. Mark eligibility before cleanup, prevent new jobs, clean owned images and references, and keep retryable cleanup/denial evidence. Whether separate cleanup records are necessary is unresolved.
- Outfit deletion preserves garments. Wardrobe/catalog deletion may restrict, detach or snapshot dependent items: choose before schema. Deleted recommendation provenance must not invalidate an otherwise saved outfit unless explicitly intended.
- Avoid permanent signed URLs as canonical image identity. Protect private images, EXIF/body data, request preferences and consent evidence. Lifecycle denial cannot be claimed to revoke already downloaded files or existing signed URLs automatically.
- Future RLS must cover each exposed owned relation and its child references, authenticated catalog reads and trusted-admin writes. Lifecycle source must be usable for eligibility checks without exposing or permitting users to change it. Avoid circular policy dependencies; no policy or helper is created here.

## 7. Unresolved architectural decisions

1. Mixed-source outfit references: typed targets, snapshot/copy semantics and compatibility with existing garmentIds.
2. Single image field versus separate asset associations; replacement history, cleanup and ownership metadata.
3. Recommendation request/result aggregation versus separate records, lifetime, saved provenance, duplicate-save policy and dashboard count definition.
4. Try-on job transitions, input/output retention, retries, worker permissions and cleanup after account deletion.
5. Profile/body/preferences bootstrap, defaults, units conversion and blank/null update meaning.
6. Authoritative lifecycle source, transition authority, race/denial timing and retaining evidence after Auth deletion.
7. Administrator membership relation versus trusted claim source; provisioning/demotion. Admin workflow review remains deferred.
8. Consent fact on job versus separate evidence records; consent policy/version, retention and withdrawal requirements.
9. Deletion/restriction/snapshot behavior for referenced wardrobe/catalog garments and expiring recommendations.
10. Private Storage layout, URL renewal/revocation, product image visibility and sensitive image retention.
11. API exposure/grants and which transactional operations must be restricted against direct Data API manipulation.

## 8. Proposed next step

Review and approve the logical boundaries and unresolved choices first. Next milestone: a logical relational model documenting keys, mandatory/optional relationships, reference source rules, allowed lifecycle transitions, deletion actions and an ownership/permission test matrix. Reconcile contract mismatches explicitly before physical schema design. Only after that review should migrations, grants, constraints, RLS/Storage policies and integration tests be implemented.

No application/frontend code, existing contracts, security architecture, database clients, SQL, migrations, tables, policies or indexes were modified by this inventory.
