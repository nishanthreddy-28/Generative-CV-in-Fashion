# CPU cloud deployment and mobile handoff

Deploy `cloud/space.py` on a CPU-capable Python host. It runs tagging, MediaPipe
and recommendation ranking on CPU, and calls external services for Gemma and
try-on. No local generation GPU or ZeroGPU allocation is used by this entry point.

Backend secrets:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- Optional `HF_TOKEN` for the retained hosted demos

Configuration: `PHASE3_LLM_PROVIDER=workers`,
`PHASE3_WORKERS_MODEL=@cf/google/gemma-4-26b-a4b-it`.
WeShopAI is the default try-on provider with IDM-VTON fallback for one top.
These are the only active try-on adapters. Cloudflare chat remains supported;
Cloudflare FLUX generation, Qwen generation, FitDiT and local FASHN are removed.

Apply `supabase/001_prototype.sql` to the integration project after aligning its
dd_* tables with the mobile app. Use authenticated private storage and real user
JWTs; never a development user ID or provider key in the APK.

Build a source-only upload directory from backend:

```powershell
& '..\.venv\Scripts\python.exe' scripts/build_space_bundle.py --output storage/cloud-upload
```

This contains source and deployment requirements, not databases, user photos,
environments, weights or secrets. Startup downloads the required public model
assets. Persistent user data belongs in Supabase; local model/feature caches may
need rebuilding when the host's disk resets. Measure startup RAM/CPU and warm
latency on the selected host before the demo.

The current cloud API serializes inference through a bounded shared queue. It
still needs a real authenticated deployment smoke test, concurrency/job-recovery
validation and the actual Expo release-build test. No cloud service was published
as part of the cleanup.

See [mobile contract](mobile/INTEGRATION.md) for estimate/review/confirm, chat
conversation state, profile saving and independent try-on uploads. Historic
deployment notes are in `../docs/history/DEPLOYMENT_PRE_CLEANUP.md`.
