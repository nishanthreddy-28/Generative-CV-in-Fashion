# Database foundation v0.2.0

The versioned migration in `migrations/202611060001_foundation.sql` implements only the first six application tables from the reviewed physical proposal: profile, empty body profile, preferences, operational lifecycle, deletion tombstone and trusted administrator membership. It creates no garments, outfits, recommendation/job tables, buckets or application image access rules. Nothing in this directory has been applied to a hosted Supabase project by this checkpoint.

## Local verification

Install PostgreSQL tools (`initdb`, `pg_ctl`, `psql`) on PATH, then from the repository root:

```sh
backend/.venv/bin/python backend/tests/database/run_local.py
```

The runner initializes a fresh temporary cluster, listens only on its private Unix socket, applies test-only Auth/Storage primitives, applies the actual migration, runs database security tests and stops/removes the cluster. It never reads a hosted database URL or service key. The test primitives are not a replacement Auth service, and test fixtures are confined to tests. The suite exercises real PostgreSQL 15 RLS/grants/transactions, not Supabase's JWT gateway, PostgREST or Storage HTTP service.

## Development Supabase installation

1. Use a reviewed, backed-up development Supabase project. Inspect existing schemas, roles, policies and default grants first. The migration deliberately fails on existing foundation objects/roles; it is a one-time migration, not a rerunnable seed or a script for an unrelated existing database.
2. Apply the entire migration transaction through your trusted migration connection or SQL editor. It requires role/schema/function creation, ownership changes, access to existing `auth.users` and permission to add a policy to `storage.objects`. Use a trusted migration identity, not a frontend/service key in a source file. Verify hosted role-management permissions; local superuser success does not prove hosted migration privileges.
3. Expose only the new `api` schema for these application operations in Data API settings. Keep `app_private` non-exposed. Do not copy broad table grants from generic schema examples. Review any pre-existing exposed schemas, views, functions and object policies independently; this migration does not audit or revoke unrelated project permissions.
4. Verify real A/B/admin test identities through Data API and Storage using current JWTs and the publishable key. Test inactive/unknown accounts, custom schema headers, direct operation abuse and stale valid tokens. Confirm actual executor identity and RLS behavior. Complete these tests **before** enabling FastAPI integration.
5. Set `DATABASE_FOUNDATION_ENABLED=true` privately in the backend environment only after those checks. Until then protected profile/settings routes return 503 after authentication. No real project configuration or credentials were supplied/changed here.

Custom schema access uses `Content-Profile: api` on writes/RPC POST and `Accept-Profile: api` on GET. The normal adapter continues forwarding each request's own verified JWT; no service-role adapter or elevated retry exists. Sources: [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas), [Data API security](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL RLS](https://www.postgresql.org/docs/15/ddl-rowsecurity.html).

## Trusted provisioning and controls

No automatic Auth trigger or user-executable bootstrap activates an account. A trusted operator must verify the actual Auth UUID and any chosen confirmation/eligibility requirements from an authoritative Auth record, then invoke `app_private.bootstrap_user(uuid, text)` using the `dd_lifecycle_operator` authority. This role has no login/password, is not granted to normal API roles, and has only named control operations, not base-table grants. Provisioning is manual until the confirmation/bootstrap product decision is settled. It creates one empty body/preferences singleton and a profile using the supplied reviewed name (empty when incomplete); it never invents measurements or opt-in defaults.

Other trusted operations are `set_account_state(uuid,text)` for active/disabled, `set_catalog_membership(uuid,boolean)`, and `begin_account_deletion(uuid)`. The last only denies access and records minimal evidence; it does not perform cleanup, remove Auth or implement DELETE /account. There is no admin grant HTTP endpoint. A catalog administrator cannot grant permissions, alter lifecycle or view another person's private data. Repeated bootstrap preserves edited values and does not reactivate disabled/deleting subjects. Deleting state/tombstones prohibit reactivation. Tombstones intentionally have no Auth FK; retention/purge remains unimplemented pending approval.

Never give `dd_lifecycle_operator`, `dd_owner`, either executor or the control-reader role to `anon`, `authenticated`, `authenticator` or an ordinary frontend/worker identity. The trusted migration identity retains role membership to manage migrations; this does not authorize sharing its credentials. Private function execution and base-table grants are explicitly reset even if the project has broad default grants. Future migrations must repeat an explicit privilege audit: per-schema REVOKE defaults cannot negate a creator's global default grants.

## Permission boundary

All six tables use enabled and forced RLS and have no ordinary base-table grants. Exposed functions are invoker wrappers around allowlisted private functions. Personal operations execute as a dedicated non-owner/non-BYPASSRLS role with only SELECT and editable-column UPDATE privileges; owner/control fields are not writable. The narrow control-reader helper sees control tables only, derives the current subject from Auth claims and exposes booleans, not other users' rows. Its UPDATE(user_id) privilege is solely for SELECT FOR SHARE: its UPDATE policy rejects all actual writes. Trusted provisioning has a separate executor and no ordinary EXECUTE path.

Profile/settings writes lock the lifecycle row until commit. A competing disable/delete either follows an already accepted transaction or wins first and makes the mutation fail. Reads/Storage checks use statement-level visibility; no claim is made that already in-flight downloads or previously signed URLs are revoked. Missing/deleting/disabled state denies new operations and current-subject predicates return false after Auth removal, even for old unexpired JWTs.

The restrictive `storage.objects` policy adds active-account eligibility to every otherwise authorized authenticated operation. It grants no access by itself and creates no buckets or permissive policies. Actual Storage gateway behavior, signing and residual signed-URL access still need live tests. Existing unrelated permissive policies/alternate database roles are not certified by this migration.

## Remaining work

- Frontend Supabase Auth migration and real project integration; no frontend changes here.
- Body read/write API: table is provisioned empty, but no grants/RPC/routes permit normal measurement access until units, precision and conversion are reviewed. Current proposed types must be reviewed before real body data is accepted.
- Full deletion cleanup, completion semantics, Auth administrative deletion, tombstone retention and processor cleanup.
- Catalog/garment/image workflows and mixed-source outfits; the 35-contract inventory is unchanged.
- Live Supabase JWT/RLS/Data API/Storage tests, confirmation authority, callback/session/device tests and delivery revocation decisions.

Rollback is not automatic: do not drop schemas/roles on a populated project. Fix defects in a subsequent reviewed migration. The local test runner removes only its own disposable cluster.
