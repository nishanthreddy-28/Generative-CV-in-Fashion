# Workflow 01 — Table access review

Generated from all fifteen application migrations applied to disposable PostgreSQL. This is a local effective-schema review, not deployed RLS acceptance.

## Direct Data API and table access

Every one of the eighteen app_private tables has RLS enabled and forced. anon, authenticated and service_role have no direct table DML grant. Administrators still use authenticated and have no blanket customer-table privileges. app_private must remain unexposed. The API wrappers invoke controlled functions, with column grants and RLS applied to their non-bypass executor owners. Service-role BYPASSRLS never creates a missing SQL grant.

The following matrix describes customer-visible effects through reviewed RPCs. All access requires the current active identity. Administrator membership expands only catalog operations. Trusted maintenance is detailed in the SQL ACL appendix.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| user_profiles | Own RPC | Trusted bootstrap | Own editable fields | Auth cascade |
| body_profiles | Own RPC | Trusted bootstrap | Own fields and unit guard | Auth cascade |
| user_preferences | Own RPC | Trusted bootstrap | Own sparse fields | Auth cascade |
| account_lifecycle | Own access projection | Trusted bootstrap | Trusted lifecycle and own deletion request | Auth cascade |
| account_deletion_tombstones | Own status projection | Trusted deletion | Trusted cleanup stages | Denied by current application |
| administrator_memberships | Own permission projection | Trusted administrator operator | Trusted operator | Trusted revoke or Auth cascade |
| wardrobe_garments | Own | Own validated create | Own editable attributes | Own, subject to references |
| wardrobe_images | Own referenced image | Own staged upload | Own allowed image lifecycle | Physical object cleanup through trusted worker |
| catalog_garments | Active shared catalog, admin also inactive | Trusted catalog administrator | Trusted catalog administrator | Deactivation through RPC, SQL delete denied |
| catalog_images | Active referenced image, admin own management | Catalog administrator | Catalog administrator lifecycle or trusted cleanup | Physical object cleanup through trusted worker |
| saved_outfits | Own | Own validated aggregate | Own metadata | Own or deletion worker or Auth cascade |
| outfit_items | Own parent | Own parent, valid source | Position/relationship through aggregate replacement | Own parent operations or parent cascade |
| recommendation_requests | Own | Own bounded generation | Denied | Auth cascade |
| recommendation_results | Own, revalidated sources | Own generation | Denied, id-only lock grant rejects writes | Request cascade |
| saved_recommendations | Own, availability-aware | Own, unique recommendation | Denied | Own bookmark or parent cascade |
| tryon_images | Own valid association | Own staged upload | Own allowed lifecycle or trusted retention | Object cleanup through trusted worker |
| tryon_jobs | Own | Own validated submission | Own cancellation, trusted expiry | Auth cascade |
| deletion_tasks | Own status projection | Own accepted request via trusted executor | Trusted leased worker | Denied by current application |

## Trusted execution roles

dd_user_executor carries normal JWT-scoped operations. dd_control_reader reads lifecycle, tombstone and membership controls and has narrowly limited lock columns. dd_control_executor performs bootstrap, membership/lifecycle and cleanup operations through distinct entry points. dd_lifecycle_operator can invoke reviewed maintenance functions. None is granted to anon/authenticated/authenticator. dd_owner owns objects and has implicit SQL ACL rights, but its forced-RLS tables have no owner allow policy. Migration superuser authority remains a separate trust boundary.

132 application functions were inspected. All denied anonymous execution. Review function-specific grants in the exact SQL files before application. SQL SECURITY DEFINER functions use an empty search_path and schema-qualified object references.

## Exact local table and column ACL appendix

Entries below are SQL privileges. RLS predicates and RPC validation further constrain them. UPDATE column lists are included because table-level grants alone would miss those operations.

### account_deletion_tombstones

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Denied | Denied | Denied | Denied |
| dd_control_reader | Yes | Denied | Denied | Denied |
| dd_control_executor | Yes | Yes | Yes | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — control_read, trusted_control.

### account_lifecycle

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Denied | Denied | Denied | Denied |
| dd_control_reader | Yes | Denied | Columns user_id | Denied |
| dd_control_executor | Yes | Yes | Yes | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — control_read, control_lock, trusted_control.

### administrator_memberships

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Denied | Denied | Denied | Denied |
| dd_control_reader | Yes | Denied | Denied | Denied |
| dd_control_executor | Yes | Yes | Yes | Yes |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — control_read, trusted_control.

### body_profiles

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Denied | Columns body_shape, chest, fit, height, hips, inseam, skin_tone, undertone, units, updated_at, waist | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Yes | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active_select, own_active_update, bootstrap_select, bootstrap_insert.

### catalog_garments

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns active, brand, category, color, image_id, material, name, notes, price, size, updated_at | Denied |
| dd_control_reader | Yes | Denied | Columns id | Denied |
| dd_control_executor | Yes | Denied | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — outfit_catalog_reference_lock, catalog_read, catalog_insert, catalog_update, outfit_catalog_reference_read, retention_references.

### catalog_images

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns state | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Denied | Columns state | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — catalog_image_read, catalog_image_insert, catalog_image_update, trusted_retention.

### deletion_tasks

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Denied | Denied | Denied | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Yes | Yes | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — trusted_cleanup.

### outfit_items

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Denied | Yes |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Denied | Denied | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — outfit_item_owner_read, outfit_item_owner_insert, outfit_item_owner_delete.

### recommendation_requests

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Denied | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Denied | Denied | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active.

### recommendation_results

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns id | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Denied | Denied | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active, recommendation_history_immutable.

### saved_outfits

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns description, name, occasion, origin_recommendation_id, updated_at | Yes |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Denied | Denied | Yes |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — outfit_owner_read, outfit_owner_insert, outfit_owner_update, deletion_outfits, deletion_outfits_delete, outfit_owner_delete.

### saved_recommendations

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Denied | Yes |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Denied | Denied | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active.

### tryon_images

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns state | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Denied | Columns state | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active, trusted_retention.

### tryon_jobs

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns failure_code, finished_at, status, updated_at | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Denied | Columns failure_code, finished_at, status, updated_at | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active, retention_jobs.

### user_preferences

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Denied | Columns email_notifications, units, updated_at | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Yes | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active_select, own_active_update, bootstrap_select, bootstrap_insert.

### user_profiles

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Denied | Columns bio, location, name, style, updated_at | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Yes | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active_select, own_active_update, bootstrap_select, bootstrap_insert.

### wardrobe_garments

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns brand, category, color, image_id, material, name, notes, size, updated_at | Yes |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Denied | Denied | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active, retention_references.

### wardrobe_images

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| dd_user_executor | Yes | Yes | Columns state | Denied |
| dd_control_reader | Denied | Denied | Denied | Denied |
| dd_control_executor | Yes | Denied | Columns state | Denied |
| dd_lifecycle_operator | Denied | Denied | Denied | Denied |
| authenticated | Denied | Denied | Denied | Denied |
| anon | Denied | Denied | Denied | Denied |
| service_role | Denied | Denied | Denied | Denied |

RLS policies — own_active, trusted_retention.

## Proposed registration storage tables

The separate registration storage draft creates registration_challenges, registration_receipts and registration_rate_windows. SELECT, INSERT, UPDATE and DELETE are denied to every existing customer, administrator and maintenance role. RLS is enabled and forced, with no permissive policies or public RPCs. No activation occurs. The future trusted executor, atomic proof/resend methods and receipt-eligibility gate require a separately reviewed SQL implementation before the full Workflow 01 migration can be approved.

## Integrity findings

Owner UUIDs reference auth.users directly or via a composite owner-matching parent FK. Outfit items reference the same owner's parent and wardrobe garment, with exactly one wardrobe/catalog source and no duplicated garment records. Recommendation result items are JSON historical snapshots, not per-item foreign keys. Their access must be revalidated on each generation/read/save. Tombstones and deletion_tasks intentionally survive Auth removal and are trusted system evidence, rather than live customer-owned rows.

Referenced wardrobe/catalog garments can block deletion while an outfit still uses them. Deferred constraints allow coordinated deletion within a transaction. Auth cleanup removes owned outfit references before removing Auth. Composite FKs prevent cross-user parent/garment substitution independently of API validation.

Accepted wardrobe/catalog garments require a current valid image association. Pending image metadata exists separately. Manual outfit creation requires at least two items in the aggregate operation. Recommendation generation currently creates two-item results. Try-on submission requires valid photo/consent, while later cleanup preserves the job association and failure reason.

Owner/time/id indexes support deterministic keyset pagination. FK uniqueness supports composite references. Measurement numeric bounds/precision and units, category enums, price bounds, state enums and timestamps are present. Changing units requires explicit replacement/clearing of populated measurements. Retention uses current clock time, and creation/update defaults vary between transaction_timestamp and clock_timestamp by existing operation. Neither defines a timezone-free date.
