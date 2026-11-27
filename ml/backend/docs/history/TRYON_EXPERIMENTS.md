# Hosted try-on comparison

WeShopAI and FASHN remain available. IDM-VTON and Cloudflare FLUX are additional,
explicitly selected experiments, not automatic fallbacks. No default is changed.
The local studio must be restarted to load the new adapters. Restart it using
the existing launch environment containing the chatbot credentials.

## IDM-VTON

Choose **IDM-VTON demo — one top**, select exactly one upper-body garment, upload
the person photo, and generate. The API rejects bottoms, one-pieces and multiple
garments before starting a job. The demo applies its own upper-body auto-mask.
It does not run FASHN, BiRefNet or a local GPU worker. Photos are uploaded to
the official https://huggingface.co/spaces/yisol/IDM-VTON service.

Hugging Face GPU quotas and queues apply. `HF_TOKEN` or a saved `hf auth login`
can authenticate the request, but neither guarantees remaining quota. A quota
failure is reported without retrying another provider.

The official repository states CC BY-NC-SA 4.0 for its code/checkpoints; keep
this option for noncommercial evaluation, not an assumed commercial licence:
https://github.com/yisol/IDM-VTON

Public-only smoke test, from the backend directory:

```powershell
../.venv/Scripts/python.exe scripts/test_idm_public_examples.py
```

This reads only images already published as examples by the official demo and
saves inputs, result (if any), elapsed time and a report under
`storage/provider-evaluation`. It never reads saved wardrobe/person photos.

## Cloudflare Workers AI / FLUX.2 Klein 4B

Create a Cloudflare Free account, open **Workers AI → Use REST API → Create a
Workers AI API Token**, and copy the account ID. Use the provided token template
(custom tokens need Workers AI Read and Edit for that account). No domain or
custom Worker is needed to use this direct REST adapter.

Configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the backend
environment. The `.env.production.example` file is only documentation and is
not loaded automatically. Never put the token in the APK, a screenshot, chat,
source control or a frontend environment variable.

For a local test, run the following in the PowerShell window used to launch
the backend. The hidden token prompt keeps its value out of command history:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = Read-Host 'Cloudflare account ID'
$cloudflareSecureToken = Read-Host 'Workers AI API token' -AsSecureString
$cloudflareTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cloudflareSecureToken)
try {
    $env:CLOUDFLARE_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cloudflareTokenPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cloudflareTokenPointer)
    $cloudflareSecureToken.Dispose()
}
# Start the backend here using its existing launch command and Gemini credentials.
```

After restarting, **Cloudflare FLUX image edit** is enabled when configuration is
present. Select one garment or one top and one bottom. Its health flag verifies
configuration presence/format only, not token validity, account plan or quota.
Every generated preview uses one API request with separate person/garment
references; no generation is automatically retried or sent to another provider.
It uses originals/stored wardrobe references, not the local FASHN preparation.

The existing launcher also supports a hidden session-only prompt:

```powershell
.\scripts\start_studio.ps1 -WorkersAI -CloudflareAccountId YOUR_ACCOUNT_ID
```

Run this from the backend folder, retaining any existing `-LlmProvider` setting
from your normal launch command. Paste a **Workers AI API token**, not the Global
API Key, at the hidden prompt. This neither changes the default try-on provider
nor writes the token to disk. Select Cloudflare in the app after startup.

Stay on **Workers Free**, without enabling paid usage, for the no-charge test.
The adapter cannot inspect or enforce the Cloudflare account's billing plan.
On a paid account the same request can be billed. The documented allowance is
10,000 neurons daily across Workers AI; requests stop after the Free allowance.
Do not mistake this for unlimited free images or guaranteed availability.

Cloudflare documents references below 512x512; the adapter preserves aspect ratio
and fits each within 511x511, flattening transparency on white. Output is requested
at 768x1024 with seed 42. Small logos and exact identity may not survive. The
model is a general image editor, not a validated clothing-fit simulator.

Sources:
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/
- https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

## Comparison

Use the same inputs across providers, starting with one top. Separately record
garment colour/print/logo/silhouette fidelity, face/pose preservation, changes to
unselected clothing/background, success/failure and full elapsed time. A passed
adapter test or a reachable demo is not evidence that generated images are good.
Only compare top+bottom pairs on providers that explicitly support those inputs.
Do not route requests to a paid service or change providers automatically.

## Validation on 2026-11-23

- Regression suite: 112 tests passed; these primarily use simulated providers.
- JavaScript syntax check passed for the preview client.
- Official IDM-VTON live smoke test completed in 34.37 seconds including public
  example downloads, uploads, queue, generation and result download. This is one
  observation, not a representative latency benchmark or uptime guarantee.
- Artifacts: `storage/provider-evaluation/idm-public-20261123-054852/` contains
  the public example person, garment, generated result and `report.json`.
- Visual inspection: blue wrap-top colour, sheen and shape transferred; the
  original pink top remains visible as a narrow strip at the hem. Quality needs
  broader comparisons before choosing the final model.
- No saved user photos were uploaded by this test. Automatic approval review
  rejected the attempted test with existing saved photos before it executed;
  the successful test used only examples already published by the official demo.
- Cloudflare live generation has not been tested: no account/token is configured.
- The already running studio had not loaded the new options when checked; restart
  using its existing environment, then refresh the page. No user server was stopped.

## Preparation and aspect-ratio optimizations

- Owned wardrobe cutouts are reused only when their original alpha mask passes
  the existing cutout sanity gate, before applying preview rotation. Garment
  semantic isolation still runs, so donor skin/other garments are not knowingly
  retained just because the background is already transparent.
- Background alpha and human-parser label masks are cached by image pixels and
  policy version under `storage/mask-cache`, outside the public media directory.
  The cache stores grayscale masks, not extra RGB photos. It is bounded to 128
  entries; entries older than seven days are ignored/removed on cache accesses
  and writes. Clear this directory when changing parser weights/label semantics.
- Parser imports/model loading happen only on cache misses, including across
  separate preparation processes. Corrupt/stale/mismatched cache entries are
  misses; they never justify substituting a stale mask for a different image.
- Categorization reuses its original gate embedding when removal falls back to
  the unchanged opaque original. Usable cutouts still get the second embedding;
  category prompts, gates, thresholds and classification weights are unchanged.
- IDM-VTON person and garment inputs are padded to its native 768x1024 canvas,
  preserving aspect ratio before the upstream resize. The output is cropped to
  the person's original framing and size. This prevents input widening but does
  not guarantee the generative model preserves exact body shape or logos.

Local observations on 2026-11-23, not representative performance guarantees:

| Measurement | First run | Cached repeat |
| --- | ---: | ---: |
| BiRefNet operation, public 768x1024 garment | 38.339 s | 0.044 s |
| Both preparation subprocesses, one saved wardrobe garment | 25.103 s | 2.089 s |

The first BiRefNet observation includes lazy imports/model initialization; the
repeat is in the same process. The full preparation comparison includes separate
process startup on both runs and reuses an already valid wardrobe cutout. It is
a cold-vs-cached comparison of the optimized implementation, not a controlled
before/after comparison with the old version. New images still require inference.
Provider queue/generation time and FASHN loading are not included.

Measurements are saved in
`storage/provider-evaluation/preparation-cache-benchmark/timings.json` and
`background-timings.json`. No external inference or image upload was used for
these preparation measurements.
