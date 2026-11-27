# Oracle cloud testing deployment

Deployed 25 November 2026. This is a testing deployment, not a production launch.

## Open the application

- Website: https://YOUR_TUNNEL_HOST
- Android setup and QR: https://YOUR_TUNNEL_HOST/phone/
- Expo Go: `exps://ultimately-african-trees-mate.trycloudflare.com`
- API health: https://YOUR_TUNNEL_HOST/healthz

Install Expo Go on Android, open its QR scanner and scan the phone-page QR. The
website also opens directly in the phone browser. The laptop can be off: the VM
hosts the API, ML, static web assets, and Expo/Metro.

These Cloudflare Quick Tunnel hostnames change when their processes restart.
`testing-urls.json` records this deployment only. On the VM, the current source
of truth is `/opt/drape-drop/deployment-urls.json`. A stable domain/named tunnel
is still needed for release, stable auth redirects and a standalone APK.

## Architecture and files

Phone / browser -> Cloudflare HTTPS -> existing user-authenticated FastAPI ->
user-scoped Supabase. The API calls the private CPU ML service on loopback.
Gemma uses Workers AI; try-on uses the existing external WeShopAI/IDM adapters.
No autonomous background processing or Supabase service-role key was introduced.

| Service | VM endpoint | Purpose |
| --- | --- | --- |
| drape-api | 127.0.0.1:8000 | Application API |
| drape-ml | 127.0.0.1:8090 | Token-protected private CPU inference |
| nginx | 127.0.0.1:8080 | Exported Expo website and Android QR page |
| drape-expo | localhost:8081 | Expo Go development bundle server |
| drape-api-tunnel | outbound tunnel | Public HTTPS application API |
| drape-web-tunnel | outbound tunnel | Public HTTPS website |
| drape-expo-tunnel | outbound tunnel | Public HTTPS Expo bundle access |
| drape-refresh-links | boot-time oneshot | Synchronize current temporary URLs |

VM: Ubuntu 24.04 x86_64, VM.Standard.E5.Flex, 4 OCPUs, 32 GB RAM, ~100 GB boot disk.
E5 is not Always Free. The earlier console screenshot showed trial credit expiry
23 December 2026; inspect billing for actual usage and cost.

`/opt/drape-drop/api`, `ml`, and `mobile` hold the deployed source; `api-venv` and
`ml-venv` are separate. Node 24 lives under `node`. Code and runtimes are owned by
root. Unprivileged drapedrop services write only runtime state/caches/generated
assets; private environment files are excluded from the repository and web root.
The ML environment is root:drapedrop with mode 0640; API/mobile environment
files are readable only by their service owner. Systemd also restricts writes.

The deployment archive excluded local photo databases, wardrobe images, personal
try-on outputs, SSH keys, virtual environments and node_modules. Public model
assets were copied/downloaded; CIR/LaBSE revisions match the existing manifest.
CPU PyTorch and key ML libraries were aligned with the tested laptop versions.
`requirements-ml-linux.lock` records the resolved Linux environment, not Windows.
The existing backend requirements.lock remains the backend dependency source.

This folder contains the actual systemd and Nginx configurations plus the
VM-side link refresh script. It is an operations record, not a fresh-VM installer.

## Operations

Connect using your local key path; never copy the private SSH key to the VM:

```powershell
ssh -i "PATH_TO_YOUR_SSH_KEY" ubuntu@YOUR_SERVER_IP
```

On the VM:

```sh
sudo systemctl is-active drape-api drape-ml drape-expo
cat /opt/drape-drop/deployment-urls.json
sudo journalctl -u drape-api -u drape-ml -n 60 --no-pager
```

If a tunnel restarts outside boot, refresh configuration and the web export:

```sh
sudo systemctl start drape-refresh-links
cat /opt/drape-drop/deployment-urls.json
```

The refresh job is enabled after the three tunnels at boot. It refreshes CORS,
mobile API settings, the Expo proxy URL, generated website and QR page. It does
not update external Supabase redirect allowlists or existing installed builds.
No VM reboot was performed by the agent to test that boot-time orchestration.
A VM restart occurred during provisioning; enabled API/ML/tunnel services came
back, and their changed testing URLs were reconciled.

The local mobile .env now uses the hosted API. Its previous contents are backed
up privately at `.integration/mobile.env.before-oracle`. Other local environment
values and the stable receipt signing key were preserved.

## Verified

- Public HTTPS website, signup route, phone page and QR image return 200.
- Landing page visually rendered in Chrome.
- Public API /healthz returns 200; unauthenticated /ml/capabilities returns 401.
- API CORS allows the exact hosted website origin.
- Public Expo SDK 58 manifests and actual Android/iOS bundles return 200.
- Mobile TypeScript and ESLint checks passed; uploaded Linux TypeScript passed.
- ML dependency checks passed; CPU MediaPipe and garment gating reject blank
  images with 422.
- Public-demo garment returned a cutout and classification with HTTP 200 in
  56.11 seconds on its first verified request. This includes cold preparation;
  it does not establish steady-state or concurrent performance.
- Combined upload analysis/preparation returned HTTP 200 with both the clean
  cutout and prepared try-on reference in 11.37 seconds on the public garment.
- Live WeShopAI generation returned HTTP 200 with an image in 57.62 seconds,
  using only official public demo person/garment inputs and a prepared reference.
  This does not establish personal-photo accuracy, future quota or availability.
- Pinned CIR/LaBSE loaded in 8.02 seconds; Gemma structured text probe passed in
  6.66 seconds. No private user photo was transmitted for these checks.
- Read-only Supabase check used the existing CA and sslmode=verify-full; all
  pose/session/prepared tables and five integration/fix migration entries exist.
  No hosted migration or user data was changed in this deployment.

## Remaining acceptance and release work

- User reports custom SMTP is configured; actual delivery has not been tested by
  this deployment. Confirm signup/reset links return to an allowed app address.
- Supabase redirect allowlist must cover the current website /auth-confirm,
  /reset-password, and /oauth-callback where enabled. Temporary URLs change.
  Existing native custom-scheme redirects target a standalone Drape & Drop
  build; email/OAuth return paths in Expo Go require separate device verification.
- Real Android sign-in, upload/review/save, wardrobe clean-image readback, stylist
  generation/history/save and explicitly consented try-on still need acceptance.
- Public bundle delivery does not prove native camera/gallery, keyboard, session
  storage or photo permissions work on a physical device.
- Stable hostname, standalone Android build, provider availability/quotas,
  concurrency/load testing, backup/retention policy and billing monitoring remain.
- Pose outputs remain reviewed front-view observations, not circumferences or
  validated physical-fit measurements. Recommendation quality is not established
  by the deployment smoke tests.

## Android acceptance follow-up

On 25 November, fixed the SDK 58 native multipart URI incompatibility using
Expo FileSystem File uploads, bounded wardrobe sizing and added preview retry.
97 mobile tests, final typecheck/lint and eight backend session tests passed.
User confirmed the wardrobe scrolls normally and a generated try-on image appears
on the physical Android phone. See the integration checkpoint for evidence and
the exact limits of the intercepted API tests. Standalone APK/stable domain and
unrelated workflow acceptance remain release work.
