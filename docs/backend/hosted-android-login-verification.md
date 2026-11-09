# Hosted backend and Android login verification

2026-11-09, Asia/Kolkata. Project `drape-drop-dev`, reference `xpqhqhpqzkjaycraukrj`.

## 1. Migration compatibility — completed

The previous five foundation failures shared one cause. The foundation's final privilege reset removed the authenticated caller's permission to execute the new subject helper. The corrected explicit grant follows the reset. An additional preview test incorrectly queried a private table as the API role. Its assertion now uses the non-owner executor, matching the application architecture. The ordinary API role remains denied direct table access.

Canonical migrations now match the compatibility SQL installed on the hosted project. Custom executor roles use `app_private.request_subject()`, which preserves the subject from the verified Data API JWT through a narrow private helper. Authoritative email checks and cleanup existence checks use operator-owned private functions with restricted execution, without granting custom roles direct managed Auth access. The original migration versions are retained. Registration migrations are canonical versions `202611090008` and `202611090009`. Historical review SQL paths point to these files and contain no executable duplicate. Version `202611090010` adds an explicit, trusted, expiring development-access mechanism.

Checks passed against fresh disposable PostgreSQL: 308 database cases and nine registration cases. Backend regression evidence is 406 passed, 315 database cases skipped in the ordinary backend invocation, and one existing Starlette deprecation warning. The dedicated database run supplies the database evidence independently.

## 2. Recovery backup — completed

Private exports include the hosted `auth`, `storage` and `public` schema definitions and data, plus the custom-role export. The Auth data export contains both original accounts, identities and credential records. A network-isolated PostgreSQL 17.11 restore succeeded. Both original Auth UUIDs and password hashes matched the restored records exactly. File hashes and an authenticated-encryption round trip were checked before migration application.

The encrypted recovery archive is under the ignored `supabase/.temp/hosted-recovery-20261109/` directory. Its private recovery key and source exports are in the restricted local recovery directory `/tmp/dd-hosted-recovery-20261109/`. These must be transferred privately to durable owner-controlled recovery storage before temporary-directory cleanup. No credential values or identity UUIDs are included here.

## 3. Hosted database setup — completed

The first 17 migration versions were rehearsed against the actual hosted database in a rollback transaction, then applied together in one transaction. Both original Auth accounts remained present. The deployed application had 21 forced-RLS tables and three private buckets before the preview-access table was added. Version `202611090010` was subsequently applied after its own local security checks. Migration history records the executed statements and versions.

API exposure now includes `public`, `graphql_public` and `api`. `app_private` remains unexposed. Direct public Supabase signup is disabled so it cannot reserve addresses outside the independent-proof registration flow. Google and Apple remain disabled.

## 4. Security and Render — verification passed, Render sync pending

Hosted rollback tests passed for active user A/B profile isolation, cross-user mutation rejection, ordinary-user catalog-administration denial, forged client role metadata, and disabled/deleting-account denial. All test-only account-state changes rolled back.

Using the owner's explicitly authorized administrative Auth operation, an existing verified identity was authenticated and its JWT was passed to the ordinary user-scoped Data API. The administrative credential remained in process memory and was not used for application database or Storage calls. Verification sessions were revoked afterward.

The real FastAPI application, running locally against hosted Auth and data, returned 200 for dashboard, profile, wardrobe and catalog-access projection. Actual signature verification ran against hosted JWKS. Anonymous and forged-token dashboard calls returned 401. A normal user's catalog mutation returned 403. A disposable garment/private image completed create, private byte retrieval and update. Anonymous image retrieval was denied. The temporary garment was removed through its owner API and subsequent lookup returned 404.

Render browser control is currently disabled in Work settings and no Render API credential is configured. The existing Blueprint sets the verified hosted backend's foundation flag to true for the authorized deployment. Its actual external activation remains pending verification through the external endpoint. Git publication alone does not establish successful Blueprint sync.

## 5. Existing account — verified, limited development admission

The owner chose to reuse an already-existing verified email account. Its UUID and password were preserved. A seven-day `development_preview_access` grant was added for that account. It remains a normal user and receives no administrator membership. This is explicit development authorization and is recorded independently of the dual-email registration receipts. Expired, disabled, deleting, banned and deleted accounts remain denied by the eligibility function.

Password entry remains private to the owner. The administrator-assisted verification session proves hosted Auth/JWT/data integration and does not establish that an unknown password has been tested. A fresh account creation was unnecessary because the requested email already existed.

## 6. Existing APK — target verified, installed login pending

The signed APK is Expo build `330bb690-1ddf-4f53-987f-ebc7635a02bd`, package `com.drapedrop.app`, version `0.4.1`, version code `1`. Its signature and ZIP integrity passed. Bundled JavaScript contains `https://drape-drop-api.onrender.com` and `https://xpqhqhpqzkjaycraukrj.supabase.co`. This is the correct hosted API and development Auth project for the existing account. No rebuild is required solely to activate that account server-side.

No connected Android device, Android SDK, `adb` or emulator was found. Installed APK email/password login, dashboard rendering, wardrobe navigation and logout therefore remain unverified. The owner selected emulator testing if available. No emulator was available. The APK's existing API integration has no local demo fallback.

## Remaining completion gates

- Verify actual Render Blueprint sync and external authenticated endpoints after publication. If Auto Sync is disabled, the owner must run Manual Sync on the existing Blueprint or restore browser control.
- Complete private password sign-in with the existing account on Android, then test dashboard, wardrobe and logout.
- Self-service registration remains a separate hosted dependency. The current APK lacks a hosted registration-service URL. Authorized SMTP sender credentials and hosted registration deployment are required for a later registration-enabled APK.
- Google/Apple provider setup and installed callback acceptance remain pending.
