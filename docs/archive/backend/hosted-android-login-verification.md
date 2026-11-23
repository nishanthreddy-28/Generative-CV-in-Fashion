# Hosted backend and Android login verification

2026-11-09, Asia/Kolkata. Project `drape-drop-dev`, reference `xpqhqhpqzkjaycraukrj`.

## 1. Migration compatibility — completed

The previous five foundation failures shared one cause. The foundation's final privilege reset removed the authenticated caller's permission to execute the new subject helper. The corrected explicit grant follows the reset. An additional preview test incorrectly queried a private table as the API role. Its assertion now uses the non-owner executor, matching the application architecture. The ordinary API role remains denied direct table access.

Canonical migrations now match the compatibility SQL installed on the hosted project. Custom executor roles use `app_private.request_subject()`, which preserves the subject from the verified Data API JWT through a narrow private helper. Authoritative email checks and cleanup existence checks use operator-owned private functions with restricted execution, without granting custom roles direct managed Auth access. The original migration versions are retained. Registration migrations are canonical versions `202611090008` and `202611090009`. Historical review SQL paths point to these files and contain no executable duplicate. Version `202611090010` adds an explicit, trusted, expiring development-access mechanism.

Checks passed against fresh disposable PostgreSQL: 308 database cases and nine registration cases. Backend regression evidence is 406 passed, 315 database cases skipped in the ordinary backend invocation, and one existing Starlette deprecation warning. The dedicated database run supplies the database evidence independently.

## 2. Recovery backup — completed

Private exports include the hosted `auth`, `storage` and `public` schema definitions and data, plus the custom-role export. The Auth data export contains both original accounts, identities and credential records. A network-isolated PostgreSQL 17.11 restore succeeded. Both original Auth UUIDs and password hashes matched the restored records exactly. File hashes and an authenticated-encryption round trip were checked before migration application.

The encrypted recovery archive is under the ignored `supabase/.temp/hosted-recovery-20261109/` directory. Its recovery key is preserved in owner-only durable storage at `~/.drapedrop-recovery/20261109/recovery.key`. Source exports and restore evidence are in the restricted local recovery directory `/tmp/dd-hosted-recovery-20261109/`. The encrypted archive and durable key were verified before and after application. No credential values or identity UUIDs are included here.

## 3. Hosted database setup — completed

The first 17 migration versions were rehearsed against the actual hosted database in a rollback transaction, then applied together in one transaction. Both original Auth accounts remained present. The deployed application had 21 forced-RLS tables and three private buckets before the preview-access table was added. Version `202611090010` was subsequently applied after its own local security checks. Migration history records the executed statements and versions.

API exposure now includes `public`, `graphql_public` and `api`. `app_private` remains unexposed. Direct public Supabase signup is disabled so it cannot reserve addresses outside the independent-proof registration flow. Google and Apple remain disabled.

## 4. Security and Render — hosted API acceptance passed

Hosted rollback tests passed for active user A/B profile isolation, cross-user mutation rejection, ordinary-user catalog-administration denial, forged client role metadata, and disabled/deleting-account denial. All test-only account-state changes rolled back.

Using the owner's explicitly authorized administrative Auth operation, an existing verified identity was authenticated and its JWT was passed to the ordinary user-scoped Data API. After explicit owner approval of private Auth verification, the administrative credential remained in process memory and was not used for application database or Storage calls. An earlier unapproved retrieval attempt was rejected by automatic approval review and did not execute. Successful verification sessions were revoked afterward. One earlier external verification reached its assertions but its logout failed with a network routing error; that earlier session revocation is unconfirmed. No token was persisted, and no blanket logout of the owner’s other sessions was performed. The final verification session was successfully revoked.

The real FastAPI application, running locally against hosted Auth and data, returned 200 for dashboard, profile, wardrobe and catalog-access projection. Actual signature verification ran against hosted JWKS. Anonymous and forged-token dashboard calls returned 401. A normal user's catalog mutation returned 403. A disposable garment/private image completed create, private byte retrieval and update. Anonymous image retrieval was denied. The temporary garment was removed through its owner API and subsequent lookup returned 404.

The owner completed Manual Sync on existing Blueprint `exs-dboll6ou01pc73flnjeg` after GitHub checkpoint `4220d8189da8d49dfcaf71734854b929b8c9db98` configured the tested foundation flag. Before that sync, external authenticated dashboard requests returned 503; after sync the actual Render endpoints `/healthz`, `/dashboard`, `/profile`, `/wardrobe` and `/admin/catalog/access` each returned 200. Anonymous and forged-JWT requests returned 401, and an ordinary-user catalog mutation returned 403. The access endpoint reports permissions; its 200 response does not confer administrator status.

The final external acceptance also created a disposable garment (201), retrieved its private image through Render, verified anonymous image rejection, updated it through the owner API, deleted it, and confirmed subsequent lookup returned 404. The fixture was removed and the final verification session was successfully revoked. These are hosted API results, not Android UI acceptance. Browser dashboard control remains unavailable, so a Render dashboard deploy-commit inspection was not claimed.

## 5. Existing account — verified, limited development admission

The owner chose to reuse an already-existing verified email account. Its UUID and password were preserved. A seven-day `development_preview_access` grant was added for that account. It remains a normal user and receives no administrator membership. This is explicit development authorization and is recorded independently of the dual-email registration receipts. Expired, disabled, deleting, banned and deleted accounts remain denied by the eligibility function.

A read-only check confirmed that this account has a confirmed email, an email identity and an existing password. No password value or hash was retrieved for this check. Development admission expires at 2026-11-16 21:46:10 IST. Password entry remains private to the owner. The administrator-assisted verification session proves hosted Auth/JWT/data integration and does not establish that an unknown password has been tested. A fresh account creation was unnecessary because the requested email already existed.

## 6. Existing APK — target verified, installed login pending

The signed APK is Expo build `330bb690-1ddf-4f53-987f-ebc7635a02bd`, package `com.drapedrop.app`, version `0.4.1`, version code `1`. Its signature and ZIP integrity passed. Bundled JavaScript contains `https://drape-drop-api.onrender.com` and `https://xpqhqhpqzkjaycraukrj.supabase.co`. This is the correct hosted API and development Auth project for the existing account. No rebuild is required solely to activate that account server-side.

No connected Android device, Android SDK, `adb` or emulator was found. Installed APK email/password login, dashboard rendering, wardrobe navigation and logout therefore remain unverified. The owner selected emulator testing if available. No emulator was available. The APK's existing API integration has no local demo fallback.

## Remaining completion gates

- Complete private password sign-in with the existing account on Android, then test dashboard, wardrobe and logout.
- Self-service registration remains a separate hosted dependency. The current APK lacks a hosted registration-service URL. Authorized SMTP sender credentials and hosted registration deployment are required for a later registration-enabled APK.
- Google/Apple provider setup and installed callback acceptance remain pending.

## Final source/history comparison

All 18 canonical migration versions matched the SQL stored in hosted migration history. Final hosted metadata reports both original Auth accounts, 22 forced-RLS application tables, and three private buckets. The canonical disposable run passed 308 foundation/application tests plus nine registration/preview-access tests. The earlier backend run passed 406 tests with 315 database cases skipped in that ordinary invocation.

Steps 1–4 are complete within the recorded database/API acceptance scope. Step 5 reuses the owner’s selected account, with verified hosted Auth/JWT access, external dashboard access and a normal-user projection; private password entry remains untested. Step 6 has a verified APK target but no installed-device/emulator test result. Self-service signup and provider OAuth remain outside this existing-account login acceptance.
