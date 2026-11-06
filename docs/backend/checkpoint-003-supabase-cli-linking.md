# Checkpoint 003 — Supabase CLI installed and linked; history pending

November 6, 2026 · Backend remains **0.2.0**.

## Outcome

- Supported Homebrew installation completed: `brew install supabase/tap/supabase`.
- Installed/verified CLI: **3.0.0**.
- Private interactive Terminal/browser login: **successful**, exit status 0. Tokens and verification codes are not included in this document or repository.
- Authenticated project listing confirmed exact reference **xpqhqhpqzkjaycraukrj**, name **drape-drop-dev**, status ACTIVE_HEALTHY. No alternate project was selected.
- Missing local configuration initialized once with `supabase init`, without force/overwrite. Existing migration and documentation were preserved.
- Local configuration inspected: project_id DrapeDrop, local schemas public/graphql_public, PostgreSQL major version 17, default seed configuration enabled with ./seed.sql (no seed file was created and no seed command was run). These are generated local defaults, not evidence of remote API schema exposure or approved production/Auth settings. The foundation still needs api exposure in the later reviewed integration stage.
- CLI link command `supabase link --project-ref xpqhqhpqzkjaycraukrj` completed with exit status 0. The ignored `supabase/.temp/project-ref` file independently matches the exact reference. CLI output labels the linked target's environment unverified; the user has identified it as disposable development. Linking is not hosted security acceptance.
- **Remote migration history: NOT VERIFIED.** No empty-history or applied-migration claim is made.

## Stop condition / exact observed error

Installed CLI help reports that migration-list remote access without a database password may require database_write and optional network-ban write authority. To preserve the no-remote-role/settings-change boundary, that database connection path was not executed. The documented GET-only Management API history endpoint was selected instead.

Before any HTTP history request, private credential retrieval using the standard CLI Keychain service/account lookup failed:

```text
Migration-history credential access failed; Keychain exit status: 44
No remote history request was made.
```

This does not negate the successful CLI login or project listing: it means this direct credential lookup could not retrieve the credential used by the CLI. No alternate credential-store path, export, password guess or privileged fallback was attempted. Per the user's stop-on-failure rule, history verification stopped here. Raw credential-store output and all secret values were suppressed.

The endpoint selected for a future authorized read is GET `/v1/projects/xpqhqhpqzkjaycraukrj/database/migrations`, requiring database_migrations_read authority. It was **not called**. [Official migration-history API](https://supabase.com/docs/reference/api/v1-list-migration-history)

Next required input is privately configured read-only history access (or a privately configured trusted database connection with a reviewed read-only history path). No credentials should be pasted into chat. Further remote inspection/application still requires approval.

## Migration integrity

Local foundation migration: `supabase/migrations/202611060001_foundation.sql`.

Approved preflight SHA-256 and current SHA-256 are identical:

```text
3accf159b38649e14f5abcf2e74ac6d6bd52e85a9a72a0d70f0b85744efad10e
```

Local migration version: **202611060001**. It was not applied to the remote project in this task. Remote version/history remains unknown.

## Git and private-file protection

Root ignore rules now exclude supabase/.temp, supabase/.branches, .supabase credential directories, .pgpass, .pg_service.conf, integration-secrets.json and *.key. Existing .env* rules and explicit template exceptions remain. Generated supabase/.gitignore also excludes .temp/.branches and local dotenv key files. Cache/link/connection files and credentials are not staged or committed. Generated config uses environment references rather than literal credentials.

Version checkpoints:

- Approved foundation: commit **4d3d87c**, annotated tag **backend-v0.2.0-database-foundation**. This captures the previously approved local backend/schema/test/docs work; it does not imply a hosted deployment.
- This partial CLI workflow: annotated tag **backend-v0.2.0-cli-linked-history-pending**. Its name explicitly preserves the unresolved verification. Local tags only; no Git push was performed in this task.

Installed CLI 3 uses `--remote` for migration-list targets; the earlier preflight's `--linked` examples came from the then-published reference and are not the installed version's syntax. No database mutation command was run to test either syntax. Use installed-version help in the next approved stage.

## Preserved boundaries

No migration application, database reset, migration repair, config push or seed command ran. No remote schemas/grants/roles/policies/Storage settings were changed by this task. No application code or existing API contract was changed. DATABASE_FOUNDATION_ENABLED remains false in the template/default; no private backend environment was created. Body/unit decisions, actual Storage authorization, account deletion completion and hosted security acceptance remain unresolved/unclaimed.

Stop here. Successful linking is recorded; migration-history verification and the broader integration milestone are incomplete.
