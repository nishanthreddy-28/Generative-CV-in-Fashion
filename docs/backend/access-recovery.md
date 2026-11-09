# Development and deployment access recovery

Checked 2026-11-09T13:28:56+05:30, Asia/Kolkata. Repository main started at 9276010. Project drape-drop-dev, reference xpqhqhpqzkjaycraukrj. This report records read-only hosted inspection and deployment HTTP checks.

## Supabase access diagnosis and recovery

The process environment supplied a non-empty SUPABASE_ACCESS_TOKEN with no whitespace, quoting, shell-assignment prefix or trailing backslash. A redirect-disabled authenticated project GET returned HTTP 401. Its value also failed the usual personal-access-token format check. The server response does not distinguish expiry, revocation, a malformed credential or a wrong credential type.

Removing that variable from the CLI subprocess environment allowed the existing saved CLI login to work. Supabase CLI 3.0.0 listed the exact project and successfully executed database metadata reads using enforced read-only transactions. This establishes a rejected environment credential shadowing a working saved login. Project metadata and SQL read authorization are restored through that saved session. The environment credential itself remains rejected. No reauthentication, credential rotation or permission changes were needed.

The first CLI version check encountered a local telemetry-cache write permission error. Running the official CLI with the required local permissions succeeded. This local filesystem restriction was separate from the Management API HTTP 401.

Common shell startup files did not contain a SUPABASE_ACCESS_TOKEN assignment. The parent application's inherited environment source remains unidentified. For subsequent commands use the working saved login explicitly:

```sh
env -u SUPABASE_ACCESS_TOKEN supabase projects list --output json
env -u SUPABASE_ACCESS_TOKEN supabase config pull --remote=xpqhqhpqzkjaycraukrj --dry-run
env -u SUPABASE_ACCESS_TOKEN supabase db query --remote=xpqhqhpqzkjaycraukrj --read-only "SELECT to_regclass('supabase_migrations.schema_migrations');"
```

The configuration preview can contain private values. Capture it privately and extract only approved fields. Avoid debug output, credential exports and dumping credential stores. The saved-login method preserves the user's existing secret storage.

## Verified hosted schema and history

- Schemas include auth, extensions, graphql, graphql_public, pgbouncer, public, realtime, storage and vault.
- api and app_private are absent. No ordinary application tables exist in public, api or app_private. Their proposed columns, indexes, constraints and user policies therefore have no deployed objects to inspect.
- supabase_migrations.schema_migrations is absent, along with its schema. There are no standard tracked migration records to compare. Version 202611060001 is not recorded and its foundation objects are absent. None of the fifteen local migrations has a hosted history entry. This describes current objects/history and does not prove that no historical manual SQL ever ran.
- No dd_* roles or application provisioning triggers exist. Public has one function, rls_auto_enable. No customer provisioning trigger exists on auth.users.
- Aggregate inspection found two Auth users, both email-confirmed. No user identity, email or credential fields were retrieved. The database is not entirely empty.
- Installed extensions are plpgsql, pg_stat_statements, uuid-ossp, pgcrypto and supabase_vault.
- Public grants schema usage to anon, authenticated and service_role. Application role membership, table grants, column privileges and forced application RLS cannot pass acceptance until the reviewed model exists.
- Default authenticator membership includes anon, authenticated and service_role. This managed baseline is not evidence of application authorization.

### Local migration order and SHA-256

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

There are no remote-only or duplicate standard history entries because the history relation is absent. Local names and hashes remain the review inputs. File presence does not establish deployment.

## Verified API, Auth, Storage and backup configuration

The official configuration dry run succeeded with dry_run=true and wrote=false.

- Hosted API schemas are public and graphql_public. The local config additionally declares api. app_private must stay unexposed.
- Hosted Auth site_url is http://localhost:3000 and additional_redirect_urls is empty. Production callback configuration is incomplete.
- Email confirmations are enabled. Hosted email OTP length is eight, while local config declares six. These are alternatives to the same Supabase email token, and cannot satisfy Workflow 01's independent link-and-code requirement.
- Public Auth settings returned HTTP 200, with signup enabled, mailer_autoconfirm=false and Google disabled.
- Custom SMTP sender/credentials, current email templates, hook signing configuration, provider client IDs and consent settings were not exposed by the selected safe config fields. Email delivery and Google login remain unverified.
- Storage has no buckets and no policies. Built-in storage tables have RLS enabled and forced RLS false. Private garment/catalog/input storage remains unprovisioned.
- Backup metadata read succeeded. PITR is disabled and the backups field was null. No usable restore point has been verified. Do not infer restore capability from a successful metadata request.

## Render diagnosis and HTTP results

The existing Render service previously reached live state after its missing publishable key was saved. In this recovery pass the actual /healthz returned HTTP 200 in 0.48 seconds with exactly {"status":"ok"}. /docs returned 200 in 0.25 seconds. A signed-out /profile returned 401.

The earlier 20-second timeout is no longer reproducible. Free-tier sleep or a transient network delay are plausible, but current dashboard/log access is unavailable, so the exact historical timeout cause is unproven. No startup or deployment repair was justified by the current successful HTTP responses.

The reviewed Render blueprint uses backend, Python 3.13, the locked requirements, Uvicorn with Render's PORT, a /healthz check and plan free. Access logging is disabled to avoid logging sensitive callback query strings. The liveness endpoint does not establish database, mail or Storage acceptance.

## Vercel and connection checks

Production https://drape-drop-eta.vercel.app/ returned 200. Its three HTML entry scripts returned 200, included the Render API origin and omitted the two development API origins checked. The /privacy, /login, /reset-password and /wardrobe deep-link requests returned the SPA HTML with 200. HTTP SPA responses alone do not establish client navigation or visual rendering.

Render accepted CORS preflight from the exact Production and existing Preview origins with HTTP 200 and matching Access-Control-Allow-Origin. An unapproved origin returned 400 without that header.

The existing Preview URL https://drape-drop-hqu9qom9i-nishanthreddy-28s-projects.vercel.app/ returned 302 toward vercel.com, consistent with Vercel deployment protection. Its current authenticated dashboard build status is unknown. Production is serving assets successfully. Current dashboard build logs, commit assignment and environment values cannot be inspected with the available tools.

Browser inventory returns no enabled browsers and “Local browser use is disabled in Work settings.” Current visual, JavaScript interaction and dashboard verification are blocked. The prior recorded browser click reaching Render remains historical evidence. This pass verifies HTTP/assets/CORS.

## Exact changes requiring separate approval

1. Review and approve the fifteen existing additive migrations in the order and hashes above. The proposed schemas, roles and application tables currently have no same-name collisions in inspected namespaces. Recheck drift immediately before applying anything.
2. Review the unconditional role/schema creation, least-privilege grants, forced application RLS and restrictive Storage eligibility gate. The gate affects authenticated Storage operations, so inspect for newly created unrelated buckets before application.
3. Review creation of private wardrobe-images, catalog-images and tryon-inputs buckets. Existing bucket-name conflict handling does not correct a wrong existing public/MIME/size configuration. Recheck all three settings.
4. Review auth.users signup provisioning and backfill of the two existing Auth users. Existing-account treatment under Workflow 01 dual verification requires an explicit decision. Do not silently treat existing users as having completed two independent proofs.
5. Verify a recoverable backup or approved private recovery/export plan. Rehearse migration application on disposable infrastructure and stop on conflicts. Keep the application flag disabled on any failure. Prefer an approved forward fix over reset or history repair. Auth and Storage deletion have separate recovery implications.
6. Separately approve exposing api in the hosted Data API and its schema/table/operation/column grants. Keep app_private unexposed.
7. Separately approve production Auth site URL https://drape-drop-eta.vercel.app and exact web callback allowlist entries ending /auth-confirm, /reset-password and /oauth-callback. Review the reserved sb_flow_id query matching for the Google SDK. Native drapedrop callbacks and a stable authorized Preview alias need their own reviewed entries.
8. Review the Workflow 01 independent challenge, trusted email hook/finalizer, transactional rate limits, sensitive retention, breach-screening provider and non-secret status API before adding its SQL or changing hosted authentication. Existing single-token email templates are insufficient. See the Workflow 01 design.
9. After schema/Auth/Storage changes are separately approved and applied, run hosted A/B and administrator acceptance, direct Data API/Storage checks, verification/replay races and worker failure drills. Feature-flag activation needs separate approval after those pass.

## Account-owner actions

- Remove the rejected SUPABASE_ACCESS_TOKEN override from the environment used to launch development tools, or privately replace it with a known-valid Management credential when raw API access is needed. The saved CLI login already permits current read-only inspection.
- Enable browser control in Work settings to permit Chrome/dashboard and actual workflow tests. Complete any browser login privately.
- In Supabase Authentication URL Configuration, review the exact site/callback values above before approving changes.
- In Google Cloud Console, choose or create the owner's OAuth web client and review authorized redirect URI https://xpqhqhpqzkjaycraukrj.supabase.co/auth/v1/callback. Configure its private secret only in Supabase's Google provider after approval. Enablement and account linking need real authorized account tests. [Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- Review a verified email sender and the chosen transactional delivery configuration. Configure credentials privately after approving the dual-proof design. A hook replaces SMTP delivery for the relevant Auth actions, so select the route deliberately. [Email delivery](https://supabase.com/docs/guides/auth/auth-smtp), [Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
- Complete Vercel's ordinary sign-in privately to inspect the protected Preview deployment. Its protection was preserved.

## Local changes and checks

Only recovery documentation was changed. Tests in this pass were actual project-list access, enforced read-only SQL metadata, config dry run, backup metadata and deployment HTTP/assets/CORS checks. No application test suite was repeated for documentation changes. Prior Workflow 01 evidence remains 71 frontend tests, 397 backend tests, 307 disposable PostgreSQL tests and passing builds. No real email, Google sign-in or persistent hosted application workflow was exercised.

The Workflow 01 completion tag remains pending. The recovery checkpoint commit and synchronization are reported in the handoff.
