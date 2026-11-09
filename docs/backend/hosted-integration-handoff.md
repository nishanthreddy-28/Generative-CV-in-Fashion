# Hosted integration handoff — local preparation only

Prepared 2026-11-09 (Asia/Kolkata). Project drape-drop-dev / xpqhqhpqzkjaycraukrj.

## Verified local state

Supabase CLI 3.0.0; linked reference matches. Local api.schemas now includes api alongside public/graphql_public. app_private remains unexposed. DATABASE_FOUNDATION_ENABLED remains false. No hosted writes were performed. Private cleanup worker credentials are not configured in this process.

## Hosted access result

A locally supplied SUPABASE_ACCESS_TOKEN was present privately. The initial redirect-disabled GET failed before an HTTP status. A local diagnostic then verified that system Python has neither an available default CA file nor CA directory; the backend has a certifi CA bundle. This is evidence of a local trust-store problem, not proof that the original exception was exclusively TLS.

At 2026-11-09T08:42:29.329715+05:30, one additional GET to https://api.supabase.com/v1/projects/xpqhqhpqzkjaycraukrj/database/migrations used the backend CA bundle with certificate verification enabled and redirects disabled. It reached the Management API and returned **HTTP 401**. Response body and authorization headers were suppressed. No more requests were made after this authentication rejection. Token validity, revocation or project permission cannot be diagnosed from the suppressed response; do not assume a specific cause or modify credentials automatically.

Hosted migration history, including version 202611060001, remains unverified. No remote migration list can be compared honestly, and failure is not empty history. The current blocker is Management API authentication; a trusted project owner must privately provide accepted read access or perform an authorized read-only history inspection. Never paste replacement credentials into chat.

## Ordered approval and acceptance steps

1. Restore accepted read-only Management API authentication privately (the CA-backed transport reached HTTP 401); inspect history and compare the exact local inventory below. No credentials in chat/logs. Inspect current hosted schemas, grants, policies, Auth and Storage before any changes.
2. Review all additive SQL below, especially provisioning trigger/backfill, forced RLS, restrictive Storage policies, worker privileges and retention defaults. Obtain explicit hosted-application approval. No SQL has been applied remotely.
3. After separate approval, run `supabase migration list --linked` and `supabase db push --linked --dry-run`. Inspect the exact planned versions; only a separately approved `supabase db push --linked` may apply that plan. Never repair, reset or seed as part of this handoff.
4. Separately approve hosted Data API exposure: include api, never app_private; verify schema/table/operation/column privileges. Local config is not proof of hosted configuration. Do not push configuration automatically.
5. Verify private wardrobe-images, catalog-images and tryon-inputs buckets (JPEG, 10 MiB), restrictive policies and authenticated byte retrieval. Inspect bucket collisions before applying SQL. Configure a separately approved isolated worker/scheduler for deletion and image reconciliation; ordinary API requests must never use its secret.
6. Configure confirmed-email policy and exact Auth callbacks for deployed web origin plus drapedrop://auth-confirm, drapedrop://reset-password and drapedrop://oauth-callback. Existing email/recovery screens require token_hash links with matching verification type: inspect frontend-supabase-auth-integration.md before changing templates. Google callbacks include the reserved sb_flow_id query parameter to select the correct verifier slot in the installed SDK. Review allowlist query matching for this exact callback (without broad unrelated redirects) and test it on web/native before approval. Configure Google credentials privately and verify PKCE; activation is not assumed.
7. Backend requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, JWT_AUDIENCE, JWT_ALGORITHMS and explicit API_CORS_ORIGINS. Frontend requires EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Worker-only DD_CLEANUP_SECRET_KEY and DD_CLEANUP_APPROVED_PROJECT_REF never enter frontend bundles or ordinary API fallbacks.
8. Run actual user A/B JWT propagation, trusted-admin and direct Data API/Storage acceptance. Test active/disabled/deleting accounts with still-valid JWTs, concurrent users, expired tokens, confirmation/recovery/refresh, and cleanup failure/retry/tombstones. Confirm actual Storage bytes and Auth removal, not only metadata.
9. Only after all hosted checks pass, obtain explicit feature-flag enablement approval. Keep DATABASE_FOUNDATION_ENABLED=false until then. Verify Android separately before release.

## Current blockers

Hosted history/security state is unverified, and no hosted mutation approval is granted. Worker credentials/scheduler, Google callback/provider acceptance and real-user E2E remain pending. No inference worker exists by design. Local SQL/HTTP tests never imply hosted acceptance.

## Exact local migration review inventory

These SHA-256 values describe local files only, applied inside disposable local PostgreSQL tests. Compare every version against actual hosted history before approval.

- `202611060001_foundation.sql` — `3accf159b38649e14f5abcf2e74ac6d6bd52e85a9a72a0d70f0b85744efad10e`
- `202611080001_body_profile_api.sql` — `b315e47a4a8f8511a4fd2319e72b366a07e2255313c41c154b5f4ae65ef2e642`
- `202611080002_wardrobe.sql` — `e69a9c2f7f8a44a1bd7804b3b6b1eb1f0f047fad7b2c5ae6bb7730e44e938058`
- `202611080003_catalog.sql` — `fb8e22cce1728566d24c543b5505b916a19dd4d091a4c3a5be32c027cd399abd`
- `202611080004_outfits.sql` — `90e47938cd3f632d89c5b73304c238da5c71a9cc8bd12afca1a3b655084a285c`
- `202611080005_outfit_editing.sql` — `d642c31c57133e153d42392eaaf6b5cb606eb38b132191ea2d6df7ded1712b31`
- `202611080006_outfit_filtering.sql` — `84bf8fcb16ca9aef55f2e436388552cbcaa0038e75d2bc81dedd4b6726316b0b`
- `202611080007_recommendations.sql` — `2fe96dfa0c81a37dfc9a52a94d3ff78643a97e6ae05c9297f8a792f915bb72fb`
- `202611090001_saved_recommendations.sql` — `de904f53ed3efff3f214e01652b03e37061d5809137fef5b8d6814814990502d`
- `202611090002_tryon_jobs.sql` — `4766aa97821b4e65520d86dd91c3fae19e1595a3a7d7e3d58482ffa8e6ad1c27`
- `202611090003_account_deletion.sql` — `08a639b17d3b8078be992cca116db3e95fdc3ff55a4a3ebb7fc07bcbc6ee2d7d`
- `202611090004_dashboard.sql` — `fe71e621dee9c7518883b2ea2828b0823424b72e4351cec8d9e4214db6056c34`
- `202611090005_profile_integration.sql` — `005fe4e4f2c0a6fc76e3a624ac4c46a46e7503b8cfb3a54a78d52da37bf04e65`
- `202611090006_outfit_gaps.sql` — `c5ec202aee56f58c05d900ddacdc6220cdaa284e1446a0c30a21f39bd11d6e34`
- `202611090007_image_retention.sql` — `60723986f9a6e4d2d7dbc2e585bdfd36e84ba98a09bc0db3ddf61e4bec704d55`
