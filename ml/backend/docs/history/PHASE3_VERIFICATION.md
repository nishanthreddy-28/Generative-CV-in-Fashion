# Phase 3 verification — 3 November 2026

## Prototype extensions verified 14 November 2026

52 backend regression tests pass. New coverage includes exact-file rejection, same-owner semantic duplicate flags, foreign-owner acceptance, archived-item re-upload, one-to-five request counts, body/garment measurement comparisons, outfit-plan validation, owned result delivery/deletion, private rotated image responses, Supabase identity/path boundaries, and cloud chat/photo persistence with doubles. Preference personalization remains heuristic plus visual-model assessment; no calibrated fit predictor is implemented.

FASHN VTON 1.5 loaded and generated a public-sample try-on on the RTX 4060 Laptop GPU using CUDA PyTorch 2.11.0. Sampling took approximately 42 seconds for 20 steps. A separate real API test completed upload, actual GPU generation, status retrieval, image delivery, and denial to another user in 88.4 seconds, including loading. The test used an isolated temporary wardrobe and public model fixtures. The generated sample is `storage/tryon-sample.png`. These observations do not establish wardrobe-wide quality or a latency guarantee.

`scripts/verify_studio_browser.py` passed in headless Chrome with isolated HTTP fixtures: preference saving, semantic duplicate acknowledgement, garment editing/measurements, recommendation selection, feedback, replacement payloads, photo progress/result/deletion, and a 390-pixel layout. A public person photo supplies the synthetic camera stream; real MediaPipe 1.2.3 detects landmarks and renders selected transparent top/bottom cutouts with heuristic forearm masking. Camera stop passed. A real WebGL mannequin rendered from saved proportions, and automatic rotation changed the rendered image; reset also passed. Inspected images: `storage/camera-verification.png` and `storage/avatar-verification.png`. No moving-person Pixel 8 quality claim follows from these fixtures.

A real two-step bottom-then-top generation completed on the RTX 4060 with the modified worker. The public FASHN person/top and an existing local bottom were used; wardrobe items were not changed. The result `storage/tryon-evaluation/outfit.png` was visually inspected: the top was applied, but original lower clothing remained visible. This is a functional inference pass and a visual-quality limitation, not proof of successful complete-outfit replacement.

Inspection found the saved jeans reference was sideways and contained residual patterned bedding between the legs. A masked 30-step comparison removed original trousers but still generated shorts and changed body details (`masked/outfit.png`); it was not adopted as the default. A clockwise 90-degree corrected-input run with the original 20-step settings generated substantially more of the intended jeans (`upright/outfit.png`), but copied residual reference background onto one knee. Rotation controls were added across previews. This demonstrates input-preparation sensitivity; clean references and a broader evaluation set remain necessary. Model-default masking was not changed.

`node scripts/verify_mobile_client.mjs` passed the HTTPS/SSE response contract, outfit count, token placement and inference-error checks with simulated HTTP responses. `app/cloud_service.py` and the ZeroGPU entry point compile. Hosted package resolution, real Supabase RLS/storage, ZeroGPU execution/quota attribution and the teammate's Expo release remain unverified without those external projects. See `deployment/README.md` for the exact deployment sequence.

The real combined server also started with FashionSigLIP and returned the studio page, demo session, existing wardrobe (8 items for test_user_3), profile and recommendation health successfully. A real casual-outfit chat request returned HTTP 200, status recommended, and one outfit in 158.9 seconds using local Qwen, including cold loading. It saved the normal chat conversation and did not modify wardrobe garments. Gemini cannot be live-tested from this process because its key is in the user's separate terminal.

## Implemented

Standalone FastAPI recommendation/chat backend; pretrained CIR-based ranking; separate ResNet18/LaBSE feature cache; free local Qwen3-VL interpretation and image suitability assessment; supported outfit templates; required/excluded items; bounded candidate search and diverse shortlists; persisted follow-up/clarification state; no-match versus unavailable responses; authenticated item images; Supabase user-token verification; explicit loopback-only development identity.

The historical results below predate the prototype extensions above. No new model training or Supabase data/storage migration was performed. The browser test studio is implemented; React Native integration is deferred.

## Results

| Check | Result |
|---|---|
| Unit and API regression suite | 34 tests passed (27 original regressions plus 7 hosted-adapter tests) |
| Strict pretrained state-dict load | Passed |
| Real ResNet18 and LaBSE feature extraction from saved garment images | Passed |
| Finite, permutation-invariant leave-one-out scores | Passed |
| Real local interpretation: generic outfit request | Passed, no invented occasion/weather/item locks |
| Real local interpretation: dinner date and cold weather | Passed, both conditions retained |
| Real local image assessment | Passed transport/schema checks |
| Full API replay with real models | Passed: casual preference retained, complete outfit returned, owned image URLs served |
| Follow-up asking for another outfit | Passed: no repeat when the isolated wardrobe has only one combination |

The regression suite covers ownership, archived/foreign items, private image responses, invalid/expired authentication, missing configuration, contradictory selections, invalid metadata, inference failure, malformed/fabricated assessment IDs, finite scores, candidate limits, conversation conflicts, clarification persistence, and quoted evidence for newly selected items. Unit/API tests use test doubles for expensive model dependencies. Separate live scripts use actual local models.

Hosted deployment addition: an explicitly selected Gemini 3.8 Flash adapter now supports the same pipeline. Seven mocked transport tests cover structured text/image payloads, key placement, missing-key rejection, quota/access errors, incomplete/invalid responses, thought-part exclusion, explicit provider selection, and model-ID URL safety. No key is available in this environment, so live Gemini access, its outfit quality, and its latency remain unverified. The existing live reports below concern local Qwen only.

Two real interpreter issues were discovered and fixed during verification: placeholder text was mistaken for a clarification, and an unconstrained request spontaneously locked available garments. The fixes add a validated clarification decision and quote-based item-selection evidence with a bounded correction attempt. An exact-ID boundary check and replacement-preservation regression are also included.

## Model provenance

- CIR repository: `fkuyumcu/OutfitTransformer-labse`
- CIR revision: `7eaf8d92beb709db20498614b1bc04e43f08136a`
- CIR SHA-256: `bb5aad51daa663bc45c489d9711b69661ed75009df267c79be380df4b8614823`
- LaBSE revision: `836121a0533e5664b21c7aacc5d22951f2b8b25b`
- Local language model: `qwen3-vl:4b-instruct`, Q4_K_M
- Local model digest: `84f7ed8042fa7cdbd902f7dcb7d0370e032095047cc3244179f263b77b5bc318`

The model card lists MIT for the CIR release. Full manifests, including the ResNet hash and Ollama service version, are saved under storage. No remotely downloaded Python was executed; the inspected architecture was reconstructed locally and weights loaded with `weights_only=True`.

## Observed timing

- Separate recommendation-model smoke check: approximately 35.6 seconds including loading and a two-item partial-outfit check.
- Complete isolated API replay: approximately 36.8 seconds total for a recommendation plus follow-up, including recommendation-model loading with Ollama already warm.
- Three warm local-language checks (two interpretation requests and one partial-outfit visual assessment): approximately 5.7 seconds total.

These are individual observations on this machine, not p95 latency or throughput measurements. Larger wardrobes, concurrent callers, more candidates, or cold Ollama startup may take longer.

## Evaluation boundary

The full replay used an isolated temporary wardrobe made from same-owner saved top/bottom images plus a public sneaker photo with manually supplied fixture metadata. The real wardrobe database was not populated with those fixture garments. The external shoe source and test limitations are recorded in `storage/phase3_e2e_verification.json`; the temporary database was deleted automatically.

The current ranking function adapts a pretrained missing-item retriever by averaging leave-one-out cosine scores. It is not a published CP checkpoint or a calibrated probability. The original model's preprocessing provenance is incomplete. Passing this verification does not establish aesthetic accuracy, generalization to diverse wardrobes, contextual rejection accuracy, or readiness for a public startup launch. Independent human ratings, wider conversation replay, model comparison, deployment performance work, and the account/storage migration remain necessary.

Run instructions, endpoints, configuration, limits, and reproduction commands are in [PHASE3.md](PHASE3.md).
