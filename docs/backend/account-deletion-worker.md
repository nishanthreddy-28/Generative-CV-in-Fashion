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

## Image reconciliation worker

`cd backend && .venv/bin/python -m workers.images --execute` uses the same separately configured private worker secret and exact approved project reference. It is not invoked by ordinary API requests. No hosted execution has been performed.

Local retention defaults: pending uploads become eligible after 1 hour; queued try-on jobs expire after 24 hours from consent. Both SQL arguments accept 1–168 hours for a trusted scheduler; ordinary clients cannot set them. These are operational defaults, subject to product/legal review before deployment. Processing jobs are protected. Expiration records INPUT_EXPIRED, retains submission/consent/image identity, and makes the input unavailable before bytes are deleted. Completed/failed job inputs become eligible after the window; cancelled inputs are immediately eligible. No inference output is generated.

Reconciliation locks image state against concurrent attach operations, excludes all current garment references (including inactive catalog garments), limits each manifest to 100 objects and acknowledges removal only after Storage metadata confirms absence. Failed deletes remain cleanup_pending and are retried. Concurrent workers may harmlessly repeat an idempotent delete; no metadata is marked removed before absence is verified. Schedule bounded repeated runs and monitor failures/backlog privately; there is no hosted scheduler yet. Output retention for a future inference worker remains outside this non-ML release.

Migration 202611090007 explicitly grants private schema lookup to service_role for trusted invoker wrappers. It grants no application-table access to that role. Trusted definer helpers have fixed search paths and narrow executor grants/RLS. The service-role secret remains confined to this separate approved worker.
