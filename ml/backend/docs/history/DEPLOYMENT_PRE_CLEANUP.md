# Supabase + Android integration handoff

For the additional IDM-VTON and Cloudflare FLUX try-on experiments, setup and
live-test results, see [TRYON_EXPERIMENTS.md](TRYON_EXPERIMENTS.md). These adapters
are in the backend. The cloud scaffold now selects WeShopAI with IDM-VTON as
the failure backup for one top. This source change still needs redeployment
and an authenticated mobile smoke test; other experimental providers remain
available through the studio.

For explicit Gemini/Cloudflare/NVIDIA/SiliconFlow stylist experiments and a
private-key comparison launcher, see [STYLIST_COMPARISON.md](STYLIST_COMPARISON.md).

The intended product is a mobile application backed by authenticated hosted
services. The local studio is a development client and test backend.
The updated cloud entry point defaults to Cloudflare Workers AI / Gemma 4;
set PHASE3_LLM_PROVIDER explicitly to select another supported provider.
Missing credentials produce an error rather than silently selecting Ollama. Provider secrets belong
on the backend, never in the mobile app.

Gemini visually assesses the bounded six-outfit shortlist in one request.
Text requests use a 45-second read timeout; image requests use 90 seconds.
Transient HTTP 408/500/502/503/504 errors have at most two retries with
exponential backoff and jitter. Retry scheduling has a 150-second budget per
Gemini call, with attempt timeouts capped to the remaining budget; this is not
a hard wall-clock cancellation deadline for every HTTP phase. Authentication,
validation and quota failures do not switch to a local model. A provider outage
can still fail the request. Restart the backend after transport changes, using
the environment containing its Gemini key.

Gemini quota safeguards: exact validated responses are cached in bounded process
memory (256 entries; 15 minutes for text, 24 hours for vision). Cache keys include
the model, credential namespace, schema, rules, complete payload and image bytes;
changed wardrobe/context/images miss the cache. Selection evidence and assessment
candidate IDs must pass their guards to be stored. Simultaneous matching requests
are coalesced, or return a busy message instead of duplicating calls.

After a confirmed daily-quota response, new uncached calls for the configured
credential/model stop until midnight Pacific time. Previously cached responses
can still be used. On Windows without IANA timezone data the guard instead
rechecks after one hour; AI Studio remains authoritative about actual quota.
These controls are process-local and reset on restart; multiple deployed workers
need a shared cache/quota store. They do not increase Google's allowance or select
Groq/Ollama automatically. Context/token caching on Google's side still makes an
API request and does not solve a requests-per-day cap.

The current studio supports wardrobe tagging, profiles and measurements,
recommendations, feedback, and photo-only try-on. Camera overlays and 3D were
removed. FASHN and preprocessing currently execute on the development laptop;
mobile integration requires moving these workers to backend GPU infrastructure.
The phone uploads photos and reads job status/results over authenticated HTTPS.

WeShopAI is an optional public-demo adapter, not a production availability
guarantee. Inputs are padded to satisfy its 0.5–2 aspect-ratio restriction.
The Gemini Pro manual workflow has been removed from the UI and accepted
try-on providers. Prepared inputs can still be downloaded for inspection.
Gemini image generation would require a separate API adapter, project access
and billing/eligible credits; it is not enabled by a web-app subscription alone.

The cloud adapters and mobile helpers below are an earlier integration scaffold.
They must be reconciled with the current photo-only job/preprocessing contract
before deployment; their presence does not mean the latest studio is deployed.

## What is prepared, and what is not deployed

- `supabase/001_prototype.sql`: separate `dd_*` tables and a private `dd-private`
  bucket, with owner-only policies. Review with the teammate before applying.
- `zerogpu/space.py`: hosted tag/chat/photo functions backed by Supabase. The
  caller's Supabase JWT is verified and forwarded to PostgREST/Storage, so RLS
  applies. No service-role key or local development identity is used.
- `mobile/inference.ts`: HTTPS Gradio job/SSE client for the three functions.
- `mobile/wardrobe.ts`: Supabase profile, measurement, feedback, upload, signed
  image, job-list and deletion helpers. The teammate's existing Supabase client
  supplies authentication and session refresh.

There is no Expo source, Supabase project configuration, Gemini secret or HF
Space account in this workspace. No cloud migration has been applied, no Space
has been published, and no Android release build has been installed or tested.
The cloud adapter has local contract tests; these do not prove hosted GPU
compatibility, quota attribution, dependency resolution or phone networking.

## Concrete setup sequence

1. Apply the versioned SQL in the integration Supabase project. It creates new
   tables, so align naming with existing app tables first. Never migrate
   `test_user_3` as a Supabase identity; real accounts use `auth.users.id` UUIDs.
2. The latest reviewed-source bundle is `storage/space-bundle-ready`. To prepare
   another, run `python scripts/build_space_bundle.py --output storage/new-space-bundle`
   from backend with a fresh output directory. It excludes local data, models
   and secrets, and deliberately refuses to overwrite an existing bundle.
3. Upload that reviewed directory to an eligible HF Gradio Space, selecting
   ZeroGPU. Configure secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` for the Workers/Gemma default
   (or the selected provider's credentials). Models are
   downloaded at startup. No dedicated GPU subscription is assumed.
4. Verify an authenticated tag, chat, and photo request with public test imagery.
   Verify unauthenticated and foreign-user reads fail. Check that Storage files
   remain private and signed image links expire. Test job recovery after a
   disconnected request, then delete the test photos and results.
5. Add the mobile helpers to the teammate's Expo app. Use the existing
   `@supabase/supabase-js` dependency. Pass `InferenceClient` an HTTPS Space URL
   and a session provider that obtains a fresh access token before each call.
6. Upload original garment bytes using `WardrobeStore.upload`, then call
   `InferenceClient.tag(path)`. Do not insert a wardrobe item until categorization
   returns `saved`. `exact_duplicate` refers to the existing item; semantic
   similarity returns a review warning.
7. Save a full supported profile object (fields match `app/phase3/profile.py`).
   Save garment circumferences with `saveMeasurements`; flat widths must be
   doubled. Measurements also support `preview_rotation` (0/90/180/270 clockwise)
   for upright garment references. `chat(message, count, conversationId)` returns complete outfits and
   owned, temporary signed image links. Re-sign links for later visits.
8. Upload a new person-photo object for each preview and call `photo(path, ids)`.
   This waits through the queue; show a processing state and use `previews()` to
   recover if the connection closes. Cloud jobs live in Supabase, not SQLite.
9. Integrate pose tracking with an Android native module or a bundled WebView
   preview, and port the avatar module into the app's viewer. The studio scripts
   rely on DOM events and cannot be pasted directly into React Native views.
10. Build a standalone release APK with bundled JavaScript and test on the
    Pixel 8: no laptop/Metro connection, cold launch, mobile data, denied camera,
    slow network, expired session, quota exhaustion, logout and private-photo
    deletion. Native camera/ML modules require a custom Expo build.

## Free service boundaries

As checked on 14 November 2026, eligible free HF personal accounts can host two
ZeroGPU Spaces. Published quotas include 5 GPU minutes/day for free signed-in
accounts and 2 minutes for unauthenticated use. API-call attribution must be
checked during deployment; a Supabase login is not an HF login. Several users
can share an anonymous quota. Queues, cold starts and exhausted quotas are
normal operating states. Never present cached sample images as a fresh result.

Supabase/Gemini also have free-tier limits. The native camera overlay and 3D
renderer can run on the phone; current photorealistic generation needs cloud
GPU inference. An entirely offline equivalent of the current diffusion model
on a Pixel 8 has not been implemented or established as practical.

Sources: https://huggingface.co/docs/hub/spaces-zerogpu,
https://supabase.com/docs/guides/storage/security/access-control,
https://docs.expo.dev/develop/development-builds/introduction/.

The FASHN human-parser dependency has additional license terms. Resolve its
commercial-use permissions before a startup release.
