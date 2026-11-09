# Supabase remote migration history

> Current recovery evidence is recorded in [access recovery](access-recovery.md). The saved CLI login successfully inspected the hosted database after excluding the rejected process token. The standard migration-history relation, api/app_private schemas and foundation objects are absent. Historical failures below remain part of the earlier evidence.


Checked at 2026-11-06T08:54:38+05:30 (Asia/Kolkata, UTC+05:30).

## Current result

The signed-in Supabase dashboard for **drape-drop-dev** (`xpqhqhpqzkjaycraukrj`) showed “LAST MIGRATION No migrations”. Its Database Migrations page showed “Run your first migration”. [Project migration history](https://supabase.com/dashboard/project/xpqhqhpqzkjaycraukrj/database/migrations)

- Local entry — `202611060001` (`foundation`).
- Remote entries shown — none.
- Missing remotely — `202611060001` (`foundation`). The dashboard has no recorded entry for this version.
- Unexpected entries, duplicate versions and name mismatches — none in the displayed history.

Migration history records tracked versions. Any SQL applied outside that history would require separate schema inspection.

## Where verification got stuck

The dashboard session can read this project. The separate process credential returned HTTP 401 on both the project endpoint and the migration-history endpoint. The responses did not establish why the credential was rejected. A non-empty environment variable establishes presence only. The earlier CLI project listing established access for the CLI session only.

Use the dashboard result above for this history checkpoint. Retry Management API authentication only when API access is needed and a known-valid credential is available. The next database step is the separately approved read-only schema and privilege inspection for the exact project. Migration application remains a separate decision.

## Prior API attempts

Checked at 2026-11-06T08:29:06+05:30 (Asia/Kolkata, UTC+05:30).

Project **drape-drop-dev**, reference `xpqhqhpqzkjaycraukrj`. The local link matches.

Method: GET `https://api.supabase.com/v1/projects/xpqhqhpqzkjaycraukrj/database/migrations` with redirects disabled and a Bearer credential from the process environment.

- Environment credential available.
- HTTP 401. Unauthorized. Response body suppressed.
- Local migrations: `202611060001` (foundation).
- Remote history unverified.
- Version `202611060001` has unknown remote status.
- Missing, unexpected, duplicate and mismatched entries are undetermined.

## Management API authentication diagnostic

Checked at 2026-11-06T08:30:17+05:30 (Asia/Kolkata).

Project reference `xpqhqhpqzkjaycraukrj`.
`SUPABASE_ACCESS_TOKEN` is present and non-empty.
Requests used Bearer authentication from the process environment, with redirects disabled and response bodies suppressed from output.

- Project GET `https://api.supabase.com/v1/projects/xpqhqhpqzkjaycraukrj` returned HTTP 401 Unauthorized.
- Migration-history GET skipped. Remote history remains unverified.

## Management API retry

Checked at 2026-11-06T08:56:04+05:30 (Asia/Kolkata).

- Credential does not match the standard Supabase personal access token format.
- GET returned HTTP 401.
- The response did not establish a specific credential failure.
