# Drape & Drop — Supabase development integration preflight

November 6, 2026 · Backend **v0.2.0 — Database Foundation** · **Preflight only; no hosted security acceptance**

## 1. Project identity and evidence

User-confirmed target:

- Name: **drape-drop-dev**.
- Reference: **xpqhqhpqzkjaycraukrj**.
- URL: https://xpqhqhpqzkjaycraukrj.supabase.co.
- Intended use: disposable development/integration testing, explicitly confirmed by the user.

A credential-free HTTPS GET to this project's `/auth/v1/.well-known/jwks.json` returned **200**, with **one public EC key advertising ES256**. Only status, key count, type and algorithm were recorded; no key material, credentials or tokens were printed. This confirms public endpoint reachability and compatibility with the configured asymmetric verifier. It does **not** independently confirm the dashboard name, project ownership, database state, JWT audience, actual user-token verification or API schema exposure. No signed user token was obtained or tested.

Inspected [Supabase setup](../../supabase/README.md), [foundation migration](../../supabase/migrations/202611060001_foundation.sql), [backend configuration](../../backend/app/config.py), [environment template](../../backend/.env.example), [backend setup](../../backend/README.md), [local database runner](../../backend/tests/database/run_local.py), [database tests](../../backend/tests/test_foundation_database.py), [read-only inspection](../../supabase/verification/inspect_foundation.sql), [integration checklist](supabase-integration-verification.md), [checkpoint 002](checkpoint-002-database-foundation.md), [API audit](api-requirements.md), repository ignore rules and local tool/configuration presence.

Migration SHA-256 at inspection:

```text
3accf159b38649e14f5abcf2e74ac6d6bd52e85a9a72a0d70f0b85744efad10e
```

The existing integration checklist's “project not selected” observation predates this supplied target. The target is now identified; privileged access and hosted evidence are still missing. That historical document was not modified.

## 2. CLI, authentication, link and local tools

- `supabase` executable: **not installed/on PATH**. No installation was performed.
- CLI authentication: **not verifiable**, rather than conclusively logged out. The CLI cannot run; `SUPABASE_ACCESS_TOKEN` is absent and `~/.supabase/access-token` is absent. Native credential-store contents were not inspected or printed.
- Local project link: **no repository link found**; `supabase/.temp/project-ref` and `supabase/config.toml` are absent. No link was created.
- `psql`, `initdb` and `pg_ctl`: present under `/opt/homebrew/bin`, each PostgreSQL **15.18**.
- Docker executable: present. Daemon availability was not checked in this preflight; the dedicated PostgreSQL runner does not need Docker.
- Backend virtual-environment Python exists. It was used for the public read-only HTTP probe.
- No Supabase connector is available to this session.

No backend/root `.env` or `.env.local` was present. SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, DATABASE_URL, SUPABASE_DB_URL, DATABASE_FOUNDATION_ENABLED, PGSERVICE, PGSERVICEFILE and PGPASSFILE were all absent from the process environment. Presence checks did not print secret values. No default `~/.pgpass` or `~/.pg_service.conf` was found; contents of credential stores were not read.

## 3. Migration prerequisites and private surface

The one-time migration is wrapped in BEGIN/COMMIT and creates new objects without IF NOT EXISTS. Existing objects with these names must be inspected before application; collision errors must not be bypassed by dropping objects or editing history blindly.

**New schemas:** `app_private` and `api`, owned by the new `dd_owner` role. **Existing platform dependencies:** Supabase-managed `auth` and `storage` schemas, `auth.users(id)` with UUID identities, `auth.uid()`, `storage.objects` with functioning RLS, and the anon/authenticated/service_role roles. The hosted Auth gateway must produce the trusted JWT context used by auth.uid(). Do not install the local test primitive SQL on Supabase.

**Private tables:** user_profiles, body_profiles, user_preferences, account_lifecycle, account_deletion_tombstones and administrator_memberships. All are in app_private with enabled and forced RLS. Identity FKs point to Auth except the deletion tombstone, whose former_subject_id intentionally has no live Auth FK. The migration creates only PK indexes; no garment/outfit/recommendation tables, buckets or permissive image rules.

**Protected roles:** dd_owner, dd_user_executor, dd_control_reader, dd_control_executor and dd_lifecycle_operator are NOLOGIN, non-superuser, non-CREATEROLE, non-CREATEDB and non-BYPASSRLS. The migration grants them to its trusted migration identity for ownership/maintenance. Never grant them directly or indirectly to authenticated, anon, authenticator or a normal application/worker identity. A product catalog administrator is not a PostgreSQL execution role.

**Private functions and authority:**

- current_account_active/current_catalog_admin: subject-scoped boolean predicates, using a protected control-reader role.
- require_active_account: internal lifecycle row lock/check; no normal-user EXECUTE grant. Its reader role has UPDATE(user_id) only to support SELECT FOR SHARE; RLS rejects actual UPDATE results.
- read_profile/update_profile and read_preferences/update_preferences: allowlisted private implementations executing as dd_user_executor, retaining the verified JWT subject and subject to RLS.
- bootstrap_user, set_account_state, begin_account_deletion and set_catalog_membership: trusted operator functions only, no ordinary or anonymous execution. No automatic Auth trigger/bootstrap is created.

All private implementations use a fixed empty search_path. SECURITY DEFINER functions use dedicated non-table-owner/non-BYPASSRLS roles; the exposed wrappers remain SECURITY INVOKER. Hosted role ownership and effective RLS behavior must be proven, not inferred from local superuser tests.

**Migration identity must be able to:** create these roles/schemas/tables/functions; grant and assume the new roles; change ownership; manage default grants and RLS; reference Auth identities/use auth.uid(); and create the restrictive policy on the existing storage.objects table. The project’s actual migration role and Storage object-owner privileges have not been inspected. Supabase platform permissions may differ from local PostgreSQL; any failure needs review, not broad privilege escalation.

## 4. Required grants and API exposure comparison

Required exposed application schema: **api**. Its five existing RPC wrappers are account_access, read_profile, update_profile, read_preferences and update_preferences. They support internal eligibility plus the existing four profile/settings HTTP contracts; they are not five new public FastAPI contracts.

`authenticated` needs schema USAGE on api and app_private and EXECUTE only on the explicit wrapper/private-operation allowlist. **Schema USAGE is not Data API exposure and is not a table grant.** app_private must stay outside the exposed schema list even though the wrappers require function lookup there. No anon execution is granted. Normal users, anonymous users and service_role have no base-table grants from this migration; do not copy a generic “GRANT ALL ON ALL TABLES” setup recipe.

The user executor has SELECT on profile/preferences and UPDATE only on editable profile/preference columns plus updated_at. It has no owner/control-field mutation or body-table access grant. The control reader has limited control-table reads; the trusted control executor has only the base operations needed by its named functions. The lifecycle operator invokes trusted functions without base-table access. Broad ambient/default function grants are explicitly reset for current objects; future migrations still require a grants audit.

**Remote comparison result: UNVERIFIED.** No management token, dashboard session used by this task, or privileged database connection is configured. Consequently the current exposed schemas, effective grants, migrations, policies, buckets and server version were not retrieved. The public JWKS response cannot reveal them. Do not assume the project exposes only public, or that a default public schema would support this backend.

After authorized access, inspect Dashboard → Data API settings or the read-only Management API configuration. Compare its db_schema with the requirement that api is included and app_private/auth/storage are not exposed as application Data API schemas. Review any existing unrelated public/graphql configuration before changing it. The migration's NOTIFY reloads schema cache; it does **not** add api to the hosted exposed-schema setting. Editing a future local config.toml does not prove the remote setting changed. [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)

When enabled later, the current backend uses Content-Profile: api on POST/PATCH/DELETE and Accept-Profile: api on GET. While DATABASE_FOUNDATION_ENABLED=false it does not activate that integration. Keep the flag false during this preflight.

The Management API config response can include sensitive fields such as jwt_secret. Never dump the full response. Once a management token is privately provided, this **future read-only** command prints only schema configuration:

```sh
cd /Users/nanni/ReactLeran/DrapeDrop
backend/.venv/bin/python - <<'PY'
import os
import httpx
response = httpx.get(
    'https://api.supabase.com/v1/projects/xpqhqhpqzkjaycraukrj/postgrest',
    headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN']},
    timeout=15,
    follow_redirects=False,
)
if response.status_code != 200:
    raise SystemExit(f'Configuration read failed: HTTP {response.status_code}; body suppressed')
config = response.json()
print('Exposed schemas:', config.get('db_schema'))
print('Extra search path:', config.get('db_extra_search_path'))
PY
```

This command was not run: the required private access is absent. The reference endpoint requires read access to Data API configuration. [Management API configuration reference](https://supabase.com/docs/reference/api/v1-get-postgrest-service-config)

## 5. Backend environment variables

The backend reads `.env` relative to its **working directory**, using no environment prefix. Run it from backend, with private configuration in backend/.env, or inject variables into that process. Do not assume launching from repository root loads backend/.env automatically.

Required application configuration:

- SUPABASE_URL: non-secret; use `https://xpqhqhpqzkjaycraukrj.supabase.co`.
- SUPABASE_PUBLISHABLE_KEY: required project configuration, supplied privately. It must start with sb_publishable_. A publishable key is designed for public clients but is not a management/service credential; do not substitute a legacy JWT key, sb_secret_ key or service-role key. Its actual project value was not retrieved.

Optional non-secret settings and exact current defaults:

- JWT_AUDIENCE: `authenticated`; verify against real Auth-issued tokens before hosted acceptance.
- JWT_ALGORITHMS: JSON array `["ES256","RS256"]`. The publicly observed key is ES256; a narrower `["ES256"]` is compatible with that observation, but no local setting was changed and rotation/configuration must be reviewed.
- JWT_LEEWAY_SECONDS: `15`, accepted range 0–60.
- JWKS_TTL_SECONDS: `300`, accepted range 1–600.
- DATABASE_FOUNDATION_ENABLED: **false**, mandatory boundary for this task. The code and template retain this value/default.

Issuer is derived as SUPABASE_URL + `/auth/v1`; there is no separate issuer environment setting. The normal FastAPI runtime requires **no database password, management access token, service-role key or user refresh token**. Those must not be added to its ordinary Data API adapter.

## 6. Private credentials and Git exclusion findings

Privately configure only the authority needed for the next stage:

- CLI/Management API access: authenticate using the CLI's supported private login/credential-store flow, or inject SUPABASE_ACCESS_TOKEN into a trusted operator process. Never put its value on a command line, into shell tracing, into this report or into Git. Do not assume a CLI-native credential is automatically available as an environment token to Python.
- Migration database access: database password through a secure interactive prompt/CLI credential store or an external permission-restricted libpq passfile. SUPABASE_DB_PASSWORD is an operator/CLI input when that mechanism is chosen, not a backend Settings requirement. Copy the exact connection host/user/port/TLS requirements from this project's Dashboard Connect view; do not invent a pooler region/hostname or assume direct IPv6 connectivity.
- For psql inspection, prefer an external libpq service file and passfile (for example under ~/.config/drape-drop-dev), restrictive file permissions and PGSERVICEFILE/PGPASSFILE pointing there. Define the `drape_drop_dev` service against this project, require verified TLS with the appropriate trust configuration, and keep passwords out of service-file connection arguments/process listings. No such files were created here.
- Real test-account passwords/access/refresh tokens will be needed later for hosted verification. Keep them in ephemeral private test storage. Any privileged Auth/Storage fixture provisioning key is a separately scoped operator exception if needed, never the credential used to make normal A/B/admin calls. No provisioning key is needed for this preflight.

**Verified Git behavior:** `.env`, `.env.local`, backend/.env, backend/.env.local, backend/.env.integration, supabase/.env and .env.production are ignored by the existing `.env*` rule. Only backend/.env.example and mobile/.env.example are tracked environment filenames, deliberately unignored as templates. Their real values were not changed.

**Coverage gaps:** repository `.pgpass`, `.pg_service.conf`, integration-secrets.json and supabase/.temp/project-ref are **not currently ignored**. Arbitrary secret filenames are not protected merely because `.env*` is ignored. Keep credentials outside the checkout; before future CLI initialization/linking, inspect any generated ignore rules and explicitly exclude supabase/.temp locally or through an approved repository ignore change. The ref itself is non-secret, but CLI-generated connection/cache files must be reviewed. No .gitignore, local Git exclusion, credential file or template was modified here. Avoid forced staging of ignored files.

Safe checks to repeat before any later commit:

```sh
cd /Users/nanni/ReactLeran/DrapeDrop
git check-ignore -v backend/.env backend/.env.integration
git ls-files -- backend/.env backend/.env.integration
git status --short
```

The tracked-file check should produce no secret-file paths. Ignoring files does not protect a file already tracked or shell/log output.

## 7. Safe CLI installation and linking procedure — documented, not executed

After review, install the CLI using the official supported distribution, authenticate privately, initialize local configuration without overwriting the migration, and link the explicit reference. CLI linking is not migration application. Inspect installed-version help before proceeding; the commands below use the currently documented --linked flags. [CLI link reference](https://supabase.com/docs/reference/cli/supabase-link)

```sh
cd /Users/nanni/ReactLeran/DrapeDrop
brew install supabase/tap/supabase
supabase --version
supabase login
supabase projects list
supabase init
```

Verify projects list shows the exact reference and intended account/organization. Inspect files produced by init, check the migration hash remains unchanged, and ensure generated private/cache directories are excluded **before linking**. Do not use overwrite/force options. Then:

```sh
supabase link --project-ref xpqhqhpqzkjaycraukrj
supabase projects list
supabase migration list --linked
```

Use the secure interactive database-password prompt or supported private credential store; never a literal --password value. Verify the local link is exactly xpqhqhpqzkjaycraukrj and the remote migration history/collision inventory matches expectations. Do not mistake local container `supabase status` for hosted account login status. Do not run config push, migration repair, db reset, seeds or role inclusion as part of linking.

No installation, login, init, link or migration-history command was executed in this preflight. These are next-stage instructions, not assertions about the current machine.

## 8. Exact next-stage migration and verification commands

**Documented only. Remote execution requires the next approval.** From repository root, after the private link/connection and target have been independently checked:

```sh
cd /Users/nanni/ReactLeran/DrapeDrop
shasum -a 256 supabase/migrations/202611060001_foundation.sql
supabase migration list --linked
supabase db push --linked --dry-run
```

The dry-run must propose only the reviewed foundation migration, with no unreviewed history discrepancy. It is not a privilege/security acceptance test. Inspect collisions using trusted read-only database access before application. After explicit migration approval, the application command is:

```sh
supabase db push --linked
```

Do not add --include-seed, --include-all, --include-roles, --yes or db reset. The roles needed here are already inside the reviewed migration; there is no separate roles.sql requirement. Preserve CLI-managed migration history by using one application method, not executing the SQL manually and then blindly pushing it again. [CLI migration push reference](https://supabase.com/docs/reference/cli/supabase-db-push)

Using the externally configured libpq service and passfile, the existing inspection script is read-only and can run for pre/post-application evidence:

```sh
PGSERVICE=drape_drop_dev psql -X -v ON_ERROR_STOP=1 -f supabase/verification/inspect_foundation.sql
```

This assumes PGSERVICEFILE/PGPASSFILE were privately configured as described above; no database URL/password is embedded. Review/sanitize evidence before saving it. The script inspects catalog/grants/policies and bucket configuration, not private application rows, image paths, password hashes or key values. API exposure and actual HTTP gateway behavior still require their own checks.

Existing **local** verification commands, independent of hosted configuration:

```sh
cd /Users/nanni/ReactLeran/DrapeDrop/backend
.venv/bin/python -m pytest -q
.venv/bin/python -m compileall -q app
cd /Users/nanni/ReactLeran/DrapeDrop
backend/.venv/bin/python backend/tests/database/run_local.py
```

The dedicated runner creates/applies the migration only in its own disposable local PostgreSQL cluster and runs test_foundation_database.py; it is **not a hosted Supabase runner**. The regular pytest command skips those database tests without its explicitly supplied socket. Never point DD_TEST_PG_SOCKET at a hosted/shared database: its fixtures create test identities/control state directly through test-only interfaces. Do not execute supabase_test_primitives.sql on the real project. Previously recorded results remain 47 backend tests and 35 local database tests; they were not rerun or reclassified as hosted passes for this preflight.

**Hosted runner gap:** no automated end-to-end Supabase HTTP verification runner currently exists in the repository. The dedicated runner cannot verify actual Auth-issued JWT propagation, PostgREST schema exposure, Storage HTTP/signing or hosted administrator authority. The next milestone must execute and record the existing [hosted checklist](supabase-integration-verification.md), using real A/B/admin sessions plus a narrowly scoped temporary private verification bucket, or separately approve a live-test harness. No fictional hosted test command is supplied here.

## 9. Remaining blockers and approval gate

1. CLI installation/private authentication and safe local initialization/linking remain undone.
2. Publishable-key configuration, trusted migration/database access and Data API configuration read access remain unavailable.
3. The project's actual schema exposure/grants/roles/policies/migration history/Storage prerequisites have not been inspected. There is no completed required-versus-observed remote configuration comparison.
4. Hosted role-management and storage.objects policy-owner permissions must be checked before application; the migration deliberately fails on collisions. Default grants and transitive role membership need live inspection.
5. Real Auth signing/audience/confirmation behavior, A/B/admin identities, current-token refresh/concurrency, direct Data API denial and actual Storage positive/negative controls still need hosted evidence.
6. Storage fixture policy/bucket scope, signing residual access and cleanup handling need explicit review. Begin-deletion is not account cleanup; body units/precision/conversion, retention and completion semantics remain unresolved.
7. No feature activation is authorized by this preflight. DATABASE_FOUNDATION_ENABLED stays false, even after linking or migration application, until the required integration checks and subsequent review are complete.

**Stop point:** only this preflight report was created. No application code, API contract, migration, configuration/template, credential file or other document was changed. No migrations were applied locally or remotely in this task, and no remote database/API/Storage setting was changed. The only target-project network request was the public read-only JWKS GET. Await approval before the next setup/application stage modifies the remote project.
