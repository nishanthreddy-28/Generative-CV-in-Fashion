# Hosted stylist comparison and account setup

This is for the chatbot and outfit-photo assessment, not virtual try-on generation.
The default remains Gemini. Experimental providers are selected explicitly and
never substituted automatically. New adapters have simulated transport tests;
live access and outfit judgment are unverified until the comparison runs.

## Accounts and private keys

### Gemini

Use the existing free-tier project/key. Check each model's active quota at
https://aistudio.google.com/rate-limit . The comparison includes 3.6 Flash as a
baseline, 3.8 Flash, and 3.5 Flash-Lite. 3.7 is omitted because its endpoint routes
to 3.8, not an independent model/quota. Do not enable billing for this free demo.

### Cloudflare

Use the existing Workers Free account and Workers AI token. In the dashboard,
Workers AI > Use REST API shows the account ID and the token creation flow.
The same account's daily neurons are shared by chat/vision and image generation.
The runner tests Gemma 4 26B-A4B and Qwen 3.8 27B. It cannot inspect the billing
plan; keep the account on Workers Free to stop at the free daily limit.

https://developers.cloudflare.com/workers-ai/get-started/rest-api/

### NVIDIA

1. Open https://build.nvidia.com/ and sign in/create an NVIDIA account.
2. Join the free NVIDIA Developer Program if requested and complete verification.
3. Open https://build.nvidia.com/google/gemma-4-31b-it and choose the hosted
   API/code view. Use **Get API Key**, follow its prompts and copy the key privately.
4. Check the model's displayed prototyping limits. No GPU, container download,
   paid hosting or NVIDIA AI Enterprise deployment is required for this hosted test.

Hosted prototyping access is rate-limited and has separate terms from production.
The previous Qwen3.5-397B hosted selection returned HTTP 410 on 2026-11-23 and is
absent from NVIDIA's current hosted catalogue. Its old self-hosted model page is
not evidence of hosted API availability. The comparison now checks the public
`https://integrate.api.nvidia.com/v1/models` list before inference and stops if its
explicit selection is missing. This read-only catalogue request uses no key or
inference tokens; it does not establish account-specific permission or uptime.
Gemma 4 uses prompt-requested JSON with strict local validation, since NVIDIA's
model-specific reference does not document server-side `response_format`.
Old "4,000 credits" instructions do not describe the current trial system:
https://forums.developer.nvidia.com/t/request-more-4-000-credits-option-on-build-nvidia-com/344567

### SiliconFlow

1. Open the international dashboard at https://cloud.siliconflow.com/ and sign up.
2. Review the account's model access, available trial balance and billing settings.
3. This experiment selects `Qwen/Qwen3-VL-8B-Instruct`. The dashboard catalogue
   supplied on 2026-11-23 marks the previous Qwen2.5-VL-7B choice as deprecated.
   Verify that this exact
   model is accessible and the test can use free access/credits with postpaid
   billing disabled. Public pricing does not establish a recurring free vision tier.
4. Create a key in the dashboard's API Keys area only if that zero-cost test is
   available. Otherwise leave SiliconFlow skipped; do not top up just to run it.

The runner blocks SiliconFlow until `SILICONFLOW_FREE_TEST_CONFIRMED=1`. This is
your confirmation, not an automatic billing guarantee. It never switches to the
China endpoint or to another paid model. Pricing: https://www.siliconflow.com/pricing

The account currently shows no free trial credit. SiliconFlow is therefore excluded
from the default comparison. Its catalogue lists models, not a promise of free API
access. Do not confirm the zero-cost prompt unless account access or credits change.
Qwen3.8-27B is another catalogue candidate for a later comparison; neither candidate
has been measured here. These vision-language models assess photos and return text;
they do not replace the separate virtual try-on image generator.

Never paste keys in chat, screenshots, source files or the APK. The PowerShell
launcher accepts hidden, session-only input, reuses keys already in the process
environment, and permits Enter to skip a provider. It writes no token to disk.

## Run the comparison

From `drapedrop-phase2/backend` in your usual PowerShell terminal:

```powershell
.\scripts\compare_stylists.ps1 -CloudflareAccountId YOUR_ACCOUNT_ID
```

This selects Gemini, Cloudflare and NVIDIA. To test the newly created NVIDIA key
alone, without restarting the app:

```powershell
.\scripts\compare_stylists.ps1 -Providers nvidia
```

Paste the NVIDIA hosted API key only into the hidden terminal prompt. The runner
uses `google/gemma-4-31b-it`, at most six inference HTTP attempts plus one public
catalogue check, and records actual results.
Possession of a key does not itself establish successful model access.

If hosted inference times out, isolate one text request before spending attempts
on the full suite:

```powershell
.\scripts\compare_stylists.ps1 -Providers nvidia -Smoke -NvidiaTimeoutSeconds 180
```

The comparison's NVIDIA read timeout defaults to 180 seconds (30–300 configurable).
The app retains its existing 60-second text / 120-second vision limits. A larger
diagnostic timeout is not a reliability fix or a production latency target. A
timeout alone cannot distinguish network delay, queueing or slow generation.
Smoke reports contain only one text case; no vision or fashion accuracy is measured.

SiliconFlow can be selected explicitly with `-Providers siliconflow` only after
verifying zero-cost access; the existing confirmation guard still applies.

To start with only existing Gemini/Cloudflare accounts:

```powershell
.\scripts\compare_stylists.ps1 -Providers gemini,workers -CloudflareAccountId YOUR_ACCOUNT_ID
```

No restart of the running app is needed to execute this separate comparison.
Results are under `storage/stylist-comparison/<timestamp>/`:
- `REPORT.md`: summary, clearly marking unrun or errored models.
- `results.json`: per-case outputs, latency, HTTP attempts and reported token usage.
- `summary.csv`: compact comparison table.

No keys are included. No wardrobe database or private person photos are read.
Vision inputs are two specific public IDM-VTON demo examples with checked file
hashes. Missing or modified fixtures mean text-only testing, never substitution
with user images. The cases test general intent, explicit locks/exclusions/weather,
ambiguity, visible colors/sleeves, and a styling judgment for human review.

The default is six cases per model with at most six HTTP attempts total per model.
Gemini's existing transient retries count against that cap. Other adapters do not
automatically retry. The runner stops the model on its first API/response error,
including quota, then records that error. Missing credentials are **not run**,
not failed quality checks. Gemini 3.7 is intentionally not called.

A few contract checks on synthetic requests and two public images are not fashion
accuracy, uptime or a broad vision benchmark. Review the actual styling reasons
and run representative held-out garment cases before choosing the final model.

## Try one in the local app

The normal launcher now accepts explicit providers and model IDs, for example:

```powershell
.\scripts\start_studio.ps1 -LlmProvider gemini -LlmModel gemini-3.8-flash
.\scripts\start_studio.ps1 -LlmProvider workers -CloudflareAccountId YOUR_ACCOUNT_ID
.\scripts\start_studio.ps1 -LlmProvider nvidia
```

Use a separate launch for each; stop the existing server normally first and retain
the terminal environment containing its credentials. NVIDIA/Cloudflare prompts are
hidden. SiliconFlow additionally requires the zero-cost confirmation. Selecting
an alternate stylist does not alter the virtual try-on engine.

API contracts used:
- https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- https://docs.nvidia.com/nim/vision-language-models/1.7.0/examples/qwen/api.html
- https://docs.api.nvidia.com/nim/reference/google-gemma-4-31b-it-infer
- https://integrate.api.nvidia.com/v1/models
- https://docs.siliconflow.com/en/userguide/capabilities/vision
