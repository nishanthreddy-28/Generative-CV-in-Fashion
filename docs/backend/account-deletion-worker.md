# Deny-first account deletion — local milestone

DELETE /account requires {confirmation:"DELETE"}, a verified user JWT and a password/OAuth amr timestamp within five minutes, checked again in the database's verified JWT context. JWT iat/refresh is not reauthentication. A repeated accepted request is safe. The Settings UI reauthenticates the same identity with Supabase password sign-in, clears sensitive input and opens a progress screen; GET /account/deletion exposes only the verified subject's minimal cleanup status even while normal application access is denied. Social-only reauthentication needs its provider's real session flow; the current Settings UI supports password accounts and does not invent provider credentials.

Migration 202611090003_account_deletion.sql marks lifecycle deleting, retains tombstone evidence and inserts a private durable task in one transaction. Application/Data API/Storage policies immediately deny normal access. Separate trusted worker functions lease tasks, expose only fixed personal-bucket manifests, require confirmed Storage deletion before Auth removal, remove outfit references in dependency order and verify Auth/storage absence before completion. Auth cascades cover profiles/body/preferences, wardrobe, outfits/items, generated/saved recommendations, try-on jobs/images and admin membership. Shared catalog records survive. Task/tombstone records do not require a live Auth identity. Failed cleanup leaves denial in force and retries after lease expiry/backoff.

The ordinary FastAPI process never loads worker credentials and cannot invoke worker RPCs. workers/deletion.py is an explicitly operated administrative tool, not a fallback. It uses a private **DD_CLEANUP_SECRET_KEY** (sb_secret format), SUPABASE_URL and matching **DD_CLEANUP_APPROVED_PROJECT_REF**, fixed HTTPS origin, apikey-only authentication, no redirects, bounded manifest pages and sanitized errors. No credentials, subject IDs, image paths or sensitive response bodies are logged. The modern key/header choice follows Supabase's [key migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys); amr semantics follow its [JWT reference](https://supabase.com/docs/guides/auth/jwt-fields). No worker secrets are present in frontend settings or tracked templates.

After explicit hosted approval and private worker configuration only, run from backend:

```sh
.venv/bin/python -m workers.deletion --execute
```

Without --execute no network/action occurs. Schedule repeated invocations in a trusted deployment; no scheduler or hosted Auth/Storage action was run here. Worker secret permission and project identity must be privately verified before use. A Supabase secret has administrative authority; the worker narrows its own code paths but does not claim the key itself is least-privilege. Compromise/rotation and deployment isolation remain operator responsibilities.

Local verification: new account API/worker tests passed (7), complete disposable PostgreSQL regression passed (300), frontend typecheck/lint passed. This proves local code, denial, ownership, cleanup sequencing, retry leases and cascade integrity; it is not hosted security/deletion acceptance. A missing worker leaves the account inaccessible and cleanup pending, never falsely complete. Local processing against mocked external transport is test-only.
