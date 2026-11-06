# Version ledger

- Foundation: commit ebaf867; browser preview: 6f1768f.
- Frontend workflow checkpoint: commit 8b89d0f.
- Frontend verification preview: tag v0.4.0-frontend-verification-preview, package/app version 0.4.0. See versions/0.4.0-frontend-verification-preview.md.

Each future milestone must have a checkpoint, verification results, updated package/app version, commit and immutable annotated tag after its checks pass. Push the branch and exact tag. Incomplete external checks must remain explicit in the release note.

Restore a previous version using a separate branch or checkout from its tag. Preserve unfinished work in a commit before switching versions.

Existing historical tags (preserved unchanged):
- v0.0.1-frontend-foundations-preview
- v0.1.0-frontend-auth-preview
- v0.2.0-frontend-photos-preview
- v0.3.0-frontend-wardrobe-preview

Backend checkpoints:
- backend-v0.1.0-security-foundation-preview: backend package 0.1.0; JWT/user-scoped adapter infrastructure, 28 tests; no business API or live RLS acceptance yet. See backend/checkpoint-001-security-foundation.md.

- v0.4.1-workflow-preview: presentation-only workflow navigator improvements; see versions/0.4.1-workflow-preview.md.

- backend-v0.2.0-database-foundation: approved backend 0.2.0; six-table foundation migration, profile/settings APIs, 47 backend tests and 35 isolated PostgreSQL tests. Local evidence only; integration flag remains disabled. See backend/checkpoint-002-database-foundation.md.

- backend-v0.2.0-cli-linked-history-pending: CLI 3.0.0 installed, private login and exact development-project link verified; remote migration history blocked at Keychain lookup (exit 44), no history HTTP request or migration application. Backend remains 0.2.0. See backend/checkpoint-003-supabase-cli-linking.md.
