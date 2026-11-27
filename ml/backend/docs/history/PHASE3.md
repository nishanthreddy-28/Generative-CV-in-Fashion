Photo-only UI update: the studio no longer loads live-camera or 3D viewers.

Choose one/two wardrobe pieces, or use `POST /phase3/tryon/uploads` with a person

`file`, one/two `garments` and matching `categories` (tops/bottoms/one-pieces).

Direct try-on references receive orientation/size/alpha normalization; they do

not run background removal. Wardrobe tagging still explicitly uses rembg U2Net.



# Phase 3 backend



## Local and hosted photo previews - 16 November 2026

The studio offers **FASHN on this computer** when `storage/tryon-env` and local weights are installed, and **Qwen on Hugging Face**. The selector defaults to the configured server engine; local becomes selectable when installed. Generation location is disclosed beside the selector. Each job records its engine; later server settings do not reroute it or silently fall back.

Both `/phase3/tryon/outfit` and `/phase3/tryon/uploads` accept optional multipart `engine` (`fashn_local` or `qwen`) and `photo_type` (`model` for clothing worn by someone, or `flat-lay` for product-only photos). Without an engine, `PHASE3_TRYON_PROVIDER` defaults to `qwen`. The single-item compatibility endpoint accepts these options too.

The corrected FASHN worker uses model-worn garment parsing when selected, rather than treating arms/skin as part of a flat-lay reference. A meta-device constructor and safetensors pread loader avoid a second full model copy on 16 GB Windows laptops. The isolated worker uses cached weights, GPU generation and CPU pose detection. It uses 30 steps by default. Top-only generation was verified on this laptop's RTX 4060 8 GB; text and fine details can still change. Two local garments remain experimental sequential edits. Start comparisons with one garment.

Qwen sends the person and reference photos to `hugging-apps/qwen-image-outfit-swap`. One generation handles a one/two-garment reference board. The adapter selects the generated half of its before/after response and validates output host/size. Free GPU quotas and queues apply. A saved `hf auth login` or explicit backend `HF_TOKEN` uses the account's available quota; never put the token in the UI. No paid fallback is configured. Deleting a local job removes stored inputs/results; deleting a hosted job cannot remove the provider's cached copies.

`fitdit` remains an explicit legacy backend setting. The prepared cloud Space still uses hosted Qwen, and has not been redeployed by this change. Camera and avatar viewers are not loaded by the current UI.

The complementary-retrieval recommendation search and final diversity changes

described below are active in both the studio API and cloud recommendation engine.

Restart the backend process to load these changes.



This service uses pretrained weights for wardrobe-based recommendations.



## Local test studio



The studio includes saved style/body/comfort preferences, editable garment tags and circumferences, one-to-five outfit recommendations, feedback, item replacement, and shared selection for photo previews. Garment/body circumference comparisons are supplied to visual assessment and displayed with recommendations. They do not establish clothing size or physical fit. Profile colour/fit affinity and exact-outfit feedback remain small heuristic adjustments; no personalization model was trained.



Photo preview supports `POST /phase3/tryon` (multipart `file` and owned `item_id`) and `POST /phase3/tryon/outfit` (`file` and repeated `item_ids`). Poll `GET /phase3/tryon/{id}`, then fetch `/image`. `DELETE /phase3/tryon/{id}` removes a finished job's person photo, intermediate images, log and result. It requires the isolated `storage/tryon-env` and FASHN weights. Run one server process, with one photo job at a time. Restarted jobs are marked failed. Results are private under `storage/tryon-jobs` until deleted. Top+bottom generation applies the bottom then the top using the same loaded model. This is experimental: later steps can change previous clothing, and original clothing can remain. Shoes and additional outer layers are omitted with explicit warnings. The human-parser dependency has additional licensing terms requiring review before commercial use.



hoto-only UI update: the studio no longer loads live-camera or 3D viewers.

Choose one/two wardrobe pieces, or use `POST /phase3/tryon/uploads` with a person

`file`, one/two `garments` and matching `categories` (tops/bottoms/one-pieces).

Direct try-on references receive orientation/size/alpha normalization; they do

not run background removal. Wardrobe tagging still explicitly uses rembg U2Net.



# Phase 3 backend



## Local and hosted photo previews - 16 November 2026

The studio offers **FASHN on this computer** when `storage/tryon-env` and local weights are installed, and **Qwen on Hugging Face**. The selector defaults to the configured server engine; local becomes selectable when installed. Generation location is disclosed beside the selector. Each job records its engine; later server settings do not reroute it or silently fall back.

Both `/phase3/tryon/outfit` and `/phase3/tryon/uploads` accept optional multipart `engine` (`fashn_local` or `qwen`) and `photo_type` (`model` for clothing worn by someone, or `flat-lay` for product-only photos). Without an engine, `PHASE3_TRYON_PROVIDER` defaults to `qwen`. The single-item compatibility endpoint accepts these options too.

The corrected FASHN worker uses model-worn garment parsing when selected, rather than treating arms/skin as part of a flat-lay reference. A meta-device constructor and safetensors pread loader avoid a second full model copy on 16 GB Windows laptops. The isolated worker uses cached weights, GPU generation and CPU pose detection. It uses 30 steps by default. Top-only generation was verified on this laptop's RTX 4060 8 GB; text and fine details can still change. Two local garments remain experimental sequential edits. Start comparisons with one garment.

Qwen sends the person and reference photos to `hugging-apps/qwen-image-outfit-swap`. One generation handles a one/two-garment reference board. The adapter selects the generated half of its before/after response and validates output host/size. Free GPU quotas and queues apply. A saved `hf auth login` or explicit backend `HF_TOKEN` uses the account's available quota; never put the token in the UI. No paid fallback is configured. Deleting a local job removes stored inputs/results; deleting a hosted job cannot remove the provider's cached copies.

`fitdit` remains an explicit legacy backend setting. The prepared cloud Space still uses hosted Qwen, and has not been redeployed by this change. Camera and avatar viewers are not loaded by the current UI.

The complementary-retrieval recommendation search and final diversity changes

described below are active in both the studio API and cloud recommendation engine.

Restart the backend process to load these changes.



This service uses pretrained weights for wardrobe-based recommendations.



## Local test studio



The studio includes saved style/body/comfort preferences, editable garment tags and circumferences, one-to-five outfit recommendations, feedback, item replacement, and shared selection for photo previews. Garment/body circumference comparisons are supplied to visual assessment and displayed with recommendations. They do not establish clothing size or physical fit. Profile colour/fit affinity and exact-outfit feedback remain small heuristic adjustments; no personalization model was trained.



Photo preview supports `POST /phase3/tryon` (multipart `file` and owned `item_id`) and `POST /phase3/tryon/outfit` (`file` and repeated `item_ids`). Poll `GET /phase3/tryon/{id}`, then fetch `/image`. `DELETE /phase3/tryon/{id}` removes a finished job's person photo, intermediate images, log and result. It requires the isolated `storage/tryon-env` and FASHN weights. Run one server process, with one photo job at a time. Restarted jobs are marked failed. Results are private under `storage/tryon-jobs` until deleted. Top+bottom generation applies the bottom then the top using the same loaded model. This is experimental: later steps can change previous clothing, and original clothing can remain. Shoes and additional outer layers are omitted with explicit warnings. The human-parser dependency has additional licensing terms requiring review before commercial use.



Live preview requires a secure browser context such as `http://127.0.0.1:8001`. It downloads pinned MediaPipe assets and processes frames locally. Select clean transparent top/bottom/one-piece cutouts. Two-triangle placement follows the torso/legs, with smoothing, width/length adjustments and heuristic forearm masking. Lower garments require visible ankles. It does not simulate sleeves, remove original clothing or render shoes. A rotatable Three.js mannequin uses approximate cross-sections derived from saved measurements and front garment decals; missing measurements use defaults. Back/side garment geometry is approximated. This is a stylized template, not a body reconstruction or cloth simulation. Three.js 0.180.0 and its MIT license are vendored locally. Pixel 8 moving-camera and native integration tests remain necessary.



From the backend directory, stop the previous server on port 8001, then run the combined studio:



```powershell

# Keep your existing GEMINI_API_KEY in this same terminal.

$env:PHASE3_LLM_PROVIDER = 'gemini'

$env:PHASE3_GEMINI_MODEL = 'gemini-3.6-flash'

.\scripts\start_studio.ps1 -UserId test_user_3

```



Open `http://127.0.0.1:8001/` after startup completes. This single process serves Phase 2 uploads, personalized recommendations and try-on. The separate Phase 2 server is unnecessary. Initial model startup can take several minutes. The script uses port 8001 by default; `-Port 8002` chooses another port. Without an explicitly selected provider, it selects Gemini when a key is available, otherwise local Ollama. It does not read keys from another terminal.



To test: save body/style/comfort preferences, upload tops/bottoms/shoes, and correct tags under **Correct a garment / add measurements**. Enter full garment circumferences in cm (flat width × 2). Use **Preview rotation** to put the neckline/waistband at the top; this is saved per garment and applied to photo/live/avatar preview images while the original file stays unchanged. Use clean garment-only references: leftover background can be copied into the result. Choose the outfit count, ask for outfits, and use feedback or **Replace this piece**. **Preview this outfit** carries the selection into every preview; you can also select individual wardrobe items. Choose a clear front-facing person photo for generation, or start the camera and show your full body. Load the 3D avatar, drag to rotate, pinch/scroll to zoom, and try auto rotation. Saved profile changes rebuild its proportions. Download or delete a completed photo preview.



Identical upload bytes are blocked with HTTP 409 `exact_duplicate` before ML runs. New uploads store SHA-256 with an owner-scoped active-item unique index. Different photos above the visual-similarity threshold remain accepted with `duplicate_of`, `duplicate_score` and a possible-duplicate warning. Archived items can be uploaded again. Legacy rows have no original-upload hash and remain similarity-only until re-uploaded; existing duplicates were not deleted.



The GPU environment and weights have already been installed on this machine. For a new Windows NVIDIA machine, run `.\scripts\setup_tryon.ps1` once. The local GPU executes photo generation; a free CPU-only hosting tier will not reproduce its latency. The combined studio retains Phase 2's development-only identity and media handling: keep it bound to loopback. The Android application integration remains separate.



Supabase/ZeroGPU deployment source, owner-only SQL policies and mobile client helpers are in [deployment/README.md](deployment/README.md). They are prepared for integration and have local contract tests; no cloud project or Android release has been deployed from this workspace.



## Hosted LLM choice for deployment



Current local configuration uses `gemini-3.6-flash`, the model ID that passed the user's text/image structured-output probe. Earlier trials with `gemini-3.8-flash` returned timeouts and HTTP 503. A passed probe does not establish ongoing availability or recommendation quality. Hosted access and free quotas must be checked in the user's Google project before deployment.



Google currently lists a free tier for this model; actual access and request/token/day quotas depend on the project and region. Free-tier content is listed as used to improve Google's products, whereas standard paid-tier content is listed as not used for that purpose. Free tier is appropriate for an opt-in prototype; review those terms before sending real users' personal photos. For a public service, plan sufficient paid capacity and suitable data handling rather than promise unlimited free inference. Sources: https://aistudio.google.com/docs/pricing#gemini-3.8-flash and https://aistudio.google.com/docs/rate-limits . Self-hosted Qwen has no API charge, but its compute/hosting still costs resources.



Set these as backend environment variables in the hosting dashboard:



```text

PHASE3_LLM_PROVIDER=gemini

PHASE3_GEMINI_MODEL=gemini-3.6-flash

GEMINI_API_KEY=<your server-side Google AI Studio API key>

```



Use `.env.production.example` as a checklist; the application does not automatically load that template. Do not put the key in frontend code, URLs, source control, or chat. Do not set the development identity on a deployed service. Supabase authentication configuration is still required.



The hosted adapter inherits the same intent, selection-evidence, candidate-ID and Pydantic guards as local Qwen. It sends collages inline over HTTPS, keeps the key in a request header, bounds concurrent provider calls, and distinguishes quota/access/response failures from `no_match`. It never silently switches provider or enables billing. There is no automatic fallback to localhost on a deployed server. Local behavior remains the default until `PHASE3_LLM_PROVIDER=gemini` is explicitly set.



The native Gemini request/response adapter is covered by mocked transport tests. With `GEMINI_API_KEY` set in your terminal, run `python scripts/verify_phase3_gemini.py` from the backend directory to check live chat interpretation and image input. The script sends generated samples only and does not read the wardrobe. A passing smoke test verifies API access and output format. Run the saved conversation and outfit evaluation separately to assess recommendation quality and latency. The pretrained recommendation scorer and feature encoders still run in Python and require backend memory even when the LLM is hosted.



## Models and status



- Recommendation: `fkuyumcu/OutfitTransformer-labse`, pinned to revision `7eaf8d92beb709db20498614b1bc04e43f08136a` by the downloaded manifest. The published model card lists MIT. Source: https://huggingface.co/fkuyumcu/OutfitTransformer-labse . The reconstructed architecture matches the inspected public `model.py`; loading uses `weights_only=True` and strict state-dict matching. No downloaded Python is executed.

- Feature encoders: torchvision ResNet18 IMAGENET1K_V1 and sentence-transformers/LaBSE. Features are separate from Phase 2 FashionSigLIP vectors. Local cached features invalidate on image/description/model changes.

- Outfit ranking: mean leave-one-out complementary retrieval cosine. This is our adaptation of a CIR checkpoint, **not a published whole-outfit compatibility checkpoint or calibrated probability**. The model card does not completely specify original image/text preprocessing; standard ResNet transforms and factual metadata descriptions are used here. Real wardrobe quality must therefore be established independently.

- Language and visual suitability: local `qwen3-vl:4b-instruct` through Ollama. It handles request extraction and judges a shortlist of up to six collages. It does not incur API charges; hardware, electricity, downloads, and deployed hosting are not free. See https://ollama.com/library/qwen3-vl:4b-instruct and https://docs.ollama.com/capabilities/structured-outputs . This is a practical local default, not a proven best model for this dataset.



## Setup (PowerShell, from backend)



Use the existing project virtual environment:



```powershell

$pythonExe = '..\..\.venv\Scripts\python.exe'

& $pythonExe -m pip install -r requirements-phase3.txt

& $pythonExe scripts/setup_phase3.py

ollama pull qwen3-vl:4b-instruct

```



Setup stores the CIR weights, checkpoint provenance, ResNet state, and LaBSE snapshot under `storage/phase3_model`. It requires network access and multiple GB of disk space. Serving loads only local files. The feature cache is under `storage/phase3_features`.



For a local session using an existing wardrobe owner:



```powershell

$env:PHASE3_DEV_USER_ID = 'test_user_3'

& $pythonExe -m uvicorn app.phase3.api:app --host 127.0.0.1 --port 8001

```



Open http://127.0.0.1:8001/docs . The development identity applies to direct loopback requests only. Never deploy with `PHASE3_DEV_USER_ID` set or expose that process through a proxy/tunnel. For authenticated access, unset it and configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; requests must supply a Supabase access token. Identity is obtained from Supabase Auth, not a caller-supplied user ID.



The current data remains in the existing SQLite wardrobe database. Mapping legacy test user names to Supabase account IDs and moving images to private Supabase Storage are separate migration work. Do not expose the original Phase 2 app publicly: its existing caller-supplied identities and static `/media` route have not been migrated by this Phase 3 change. The standalone Phase 3 app uses authenticated image endpoints and does not mount public media.



## Endpoints



- `GET /phase3/health`: process availability, selected language provider, and model-load flag. It explicitly reports `quality_validated=false`.

- `POST /phase3/recommendations`: structured `Intent` object, useful for engine verification before chat.

- `POST /phase3/chat`: `{"message":"Recommend one outfit","conversation_id":null}`. Reuse the returned conversation ID for updates, another option, or replacements.

- `GET /phase3/items/{id}/image?thumbnail=false`: owned, active item image. Requires the same authentication as recommendations.



Structured example:



```json

{

  "occasion": "dinner date",

  "weather": "cold outside",

  "preferences": [],

  "required_ids": [],

  "excluded_ids": [],

  "count": 1,

  "outerwear": "optional",

  "another": false

}

```



Statuses are `recommended`, `no_match`, `needs_clarification`, and `unavailable`. Dependency failures never become `no_match`. Unknown garment properties trigger clarification. A shortlist rejection is worded as failure to find a suitable result among checked candidates, not proof that all possibilities are impossible.



Interpretation uses an explicit clarification flag. Newly locked/excluded garments require exact quoted selection evidence validated against the user message and owned inventory. Unsupported selections cause one bounded correction attempt, then an unavailable response rather than arbitrary item locks. This guard was added after a real model run exposed invented locks on a general request. Full semantic reliability still requires broader conversation evaluation.



Outfits use top+bottom+shoes or full+shoes, optionally one outer. Locking full+top or two garments in one slot requires clarification. More than 200 active garments requires narrowing. Another-option history is bounded to the last 100 outfit IDs. Conversations use per-operation database connections and optimistic concurrency; simultaneous conflicting updates return HTTP 409. Clarification state is persisted. No account/user data is sent to a paid or external LLM by the default adapter.



## Recommendation search update, 16 November 2026



The production pretrained scorer now shortlists complementary items before evaluating whole outfits. Up to 256 possible outfits are enumerated exactly. Larger wardrobes use slot-constrained CIR retrieval with a beam of 64 candidates per template (separates / one-piece, each with / without an outer layer), producing at most 256 complete candidates for leave-one-out scoring. This removes the previous 20,000-combination rejection when using the production scorer. The 200-item wardrobe limit remains. Alternative scorers without retrieval retain the old explicit combination limit.



Retrieval uses the same pinned ResNet18/LaBSE features and CIR checkpoint as the scorer, with separate feature caches from Phase 2. It adds no dependencies, weights or API services. Required items, exclusions, complete-outfit templates and previously returned outfit IDs are enforced during construction. Saved colour/fit affinity and exact-outfit feedback influence beam selection and final ranking. Occasion, weather and style are still assessed by the existing stylist on the bounded image shortlist; this update does not introduce a trained personalization model or semantic occasion retrieval.



Selection uses maximum-overlap penalties on the unlocked base garments, so changing only the outer layer does not appear as an entirely different outfit. Diversity is recomputed after visual suitability rejections. The visual assessment budget remains six candidates, in batches of two, stopping after enough acceptable outfits. The beam can miss useful outfits; a shortlist rejection is not evidence that the whole wardrobe is unsuitable. Aesthetic improvement is not established by functional tests.



Verification: `python -m unittest discover -s tests -v` covers the regression suite including bounded search, deterministic ties, all four templates, locks/exclusions/history, malformed retrieval, and diversity after rejection. `python scripts/verify_recommendation_search.py` reads existing same-user garment images and checks real checkpoint retrieval against the existing two-item LOO score. It also exercises a synthetic 27,000-combination wardrobe using three repeated image references under 90 in-memory IDs. The JSON report explicitly distinguishes work-bound checks from aesthetic accuracy; the wardrobe database is never edited.



Photo try-on service/model options and the two linked hosted demos are reviewed in [TRYON_OPTIONS.md](TRYON_OPTIONS.md).



## Verification



```powershell

& $pythonExe -m unittest discover -s tests -v

& $pythonExe scripts/verify_phase3_model.py

& $pythonExe scripts/verify_phase3_chat.py

& $pythonExe scripts/verify_phase3_e2e.py

```



On this Windows sandbox, asyncio's socket initialization was blocked. API tests were run outside that sandbox after approval. This is an environment issue, not a reason to disable authentication or replace real models with heuristics.



Unit/API tests use explicitly named test doubles for the scorer and language service. Verification scripts use actual local pretrained artifacts and saved images, writing separate reports under storage. The model script uses a same-user top/bottom pair because the existing sample wardrobes do not establish a complete outfit evaluation set. The end-to-end script adds a public sneaker image in an isolated temporary wardrobe, never in the real database. Its source is https://images.unsplash.com/photo-1542291026-7eec264c27ff and the local fixture is `storage/phase3_eval/red_sneaker.jpg`. No fixture is redistributed in source control. These checks establish functional inference and interfaces, **not recommendation accuracy**.



Before a public launch: complete real wardrobe testing with shoes and one-piece/outerwear cases, rate visual/contextual quality with independent humans, assess false rejections, tune shortlist/diversity choices, measure cold/warm latency on deployment hardware, bound request concurrency and add rate limits at the gateway, finish account/storage migration, and verify data retention/deletion. Vision-language explanations are model-generated, may be mistaken, and are not used as independent ground truth.

