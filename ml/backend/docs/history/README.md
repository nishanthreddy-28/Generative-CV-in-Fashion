# Drape&Drop — Phase 2 (Digital Wardrobe)

## Latest mobile preparation update (23 November 2026)

Body analysis now runs **once on the backend**, shared by the web studio and
mobile cloud API. It replaces the older browser MediaPipe analysis described
below. Multi-row waist front-width estimates reject unstable outlines and likely
merged arms. Results are unconfirmed until reviewed; original estimates and
corrections are retained. Known height is still entered, and no circumference or
physical-fit accuracy is claimed. 2D try-on stays independent.

The cloud entry point now defaults to **Workers AI / Gemma 4**, respecting an
explicit provider configuration. It no longer forces Gemini. Cloud follow-ups
carry previous main clothing IDs; multiple recommendations require distinct
main clothing, with warnings when fewer results can be found. Main outfit
alternatives receive shortlist priority over shoe/jacket-only variants. Long
requests retain saved pose/preferences and manual fit context. These are behavior
improvements, not a new measurement of CIR ranking accuracy.

See [mobile integration contract](deployment/mobile/INTEGRATION.md) for the typed
client methods, review/save flow, configuration and release checks. The separate
Expo application and live hosted deployment still need integration verification.

One garment photo in → one tagged, stored wardrobe item out.
Zero-shot tagging with Marqo-FashionSigLIP. **Nothing is trained.**

---

## Setup (Windows, conda env `drape`, Python 3.11)

```bash
conda activate drape
cd backend
pip install -r requirements.txt
```

First run downloads ~400MB of model weights to the HF cache.

If `rembg` fights pip over `onnxruntime`, install it alone first:
```bash
pip install onnxruntime==1.19.2
pip install rembg==2.0.59 --no-deps
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Docs at http://localhost:8000/docs — you can upload a photo straight from there.

```bash
curl -F "file=@shirt.jpg" -F "user_id=me" http://localhost:8000/items
```

---

## Architecture

```
app/
  config.py            every tunable threshold, one place
  schemas.py           THE CONTRACT — Phase 3 imports from here
  db.py                SQLite, WAL, soft deletes, embeddings as BLOB
  main.py              FastAPI, model loaded once at lifespan
  phase2/
    taxonomy.py        23 categories + prompt banks + colour anchors
                       ← tuning means editing ONLY this file
    tagger.py          SigLIP wrapper: embed → classify
    color.py           KMeans + CIELAB colour naming
    gates.py           G1–G5
    pipeline.py        orchestration
  routes/
    items.py           POST / GET / PATCH / DELETE
```

### Flow

```
bytes
 → G1  validate, EXIF-rotate, downscale to 1024px
 → G2  is-this-clothing gate (on the raw image)
 →     rembg background removal
 → G3  cutout sanity (falls back to original, doesn't fail)
 →     embed once  ← everything below reuses this
 →     category + attributes + colour
 → G4  confidence routing → auto | review | ask
 → G5  duplicate check against user's existing embeddings
 →     store
```

**One forward pass per upload.** The embedding drives classification,
attributes, and duplicate detection, and is stored for Phase 3.

---

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/items` | multipart `file` + `user_id` → tagged item |
| GET | `/items?user_id=X&slot=top` | wardrobe list |
| PATCH | `/items/{id}?user_id=X` | user correction, sets `source=user_corrected` |
| DELETE | `/items/{id}?user_id=X` | soft delete (`is_archived=1`) |

`POST` returns `route`:
- `auto` — accept silently
- `review` — show top-3 as a one-tap picker
- `ask` — too uncertain, make the user choose

PATCH **never re-runs the model**. The user's label is ground truth; the
embedding stays untouched because it's a visual fact, independent of the label.

---

## Evaluation — do this before Phase 3

1. Photograph 60–80 of your own garments. Deliberately over-represent the
   known confusion pairs (Shorts↔Skirt, Jacket↔Coat↔Blazer) and mix photo
   types: flat-lay, hanger, worn, folded.
2. Put them in `eval/images/`, fill in `eval/labels.csv`.
3. `python -m eval.run_eval`

### Gates

| Metric | Threshold | Why |
|---|---|---|
| Slot accuracy | ≥ 95% | A shirt in the `bottom` slot breaks outfits catastrophically |
| Category top-1 | ≥ 80% | |
| Category top-3 | ≥ 93% | The picker covers the gap |
| Formality accuracy | ≥ 75% | Phase 3's second dependency |
| Crashes | 0 | |

### When gates fail

- **Slot fails** → merge or split categories in `taxonomy.py`. Not a prompt problem.
- **Category fails, slot passes** → prompt tuning. Read the confusion table,
  add distinguishing prompts to the losing class only.
- **Formality fails** → the attribute banks are the weakest part of the design.
  Widen them before touching anything else.

Timebox prompt tuning. Returns diminish fast.

The **by-photo-type** breakdown is the interesting result for the paper —
published fashion classifiers are evaluated on catalog images, not on photos
users actually take.

---

## Thresholds

All in `config.py`. The ones you'll actually move:

| Constant | Default | Effect |
|---|---|---|
| `MARGIN_THRESH` | 0.04 | ↑ = more items flagged for review |
| `CONFIDENCE_THRESH` | 0.25 | ↑ = more items force a user choice |
| `CLOTHING_GATE_THRESH` | 0.45 | ↑ = stricter about non-clothing |
| `DUPLICATE_THRESH` | 0.95 | ↓ = more aggressive duplicate warnings |

Tune against the eval set, not against vibes.

---

## Contract for Phase 3

Phase 3 imports `schemas.Item` and calls `db.list_items` / `db.list_embeddings`.
It never touches the tagger.

```python
Item {
  id, user_id, created_at
  image_url, thumb_url
  category                    # 1 of 23
  slot                        # top | outer | bottom | full | shoes
  attributes { pattern, formality, season, fit }
  colors [{ name, hex, share }]
  confidence, margin, source
}
```
Embeddings come from `db.list_embeddings(conn, user_id)` → `[(id, np.float32[768])]`,
already L2-normalised, so a dot product is cosine similarity.

**Freeze `schemas.py` once the eval passes.** If it shifts later, the
recommender gets rewritten.

---

## Known limits (v1)

- One garment per photo. Multi-item flat-lays are rejected at G2.
- No accessories, bags or hats in the taxonomy.
- Photos of a person wearing the item work, but rembg keeps the person —
  acceptable for tagging, not for try-on.
- Colour naming uses 21 anchors; heavy prints return up to 3 clusters with shares.

## Phase 3 recommendation backend

The standalone pretrained recommendation and local conversational service runs separately from this Phase 2 app. See [PHASE3.md](PHASE3.md) for models, setup, authentication, API examples, verification, and current quality limitations.

## Model evaluation

Start with [System Contributions and Results](PROJECT_RESULTS.md) for a presentation summary of the implemented workflow, positive findings and attributed backbone references.

See [EVALUATION.md](EVALUATION.md) for measured component results, confidence intervals, baselines, experimental settings and limitations. The report includes aggregate figures for academic reporting and a public repository; local benchmark datasets and reports containing source photographs are excluded from Git.

## Photo context, conversational routing and hosted try-on (23 November 2026)

Compatibility scoring and outfit recommendation are implemented. Their measured
quality remains a separate improvement task: the evaluated compatibility AUC
was 0.476 and four-choice outfit completion was 22.2% against 25% chance.
These scores do not support claiming reliable recommendation accuracy. The
changes below improve application behavior and do not replace those evaluations.

| Component | Current behavior | Limits |
| --- | --- | --- |
| Chat input | Greetings such as `hii`, thanks and basic help return a fixed request for proper outfit input, with examples. Gemini routes other non-styling messages to the same fallback. Blank messages are rejected. Conversation ownership and saved outfit constraints are preserved. | General intent routing still depends on the interpreter; no perfect semantic accuracy is claimed. |
| Body photo | Optional browser MediaPipe Pose Landmarker detects one person, checks visible landmarks and rejects unsuitable framing/pose. A user-entered height calibrates rough shoulder landmark span, clothed waist **front width**, torso length and shoulder/hip landmark-span ratio. | This is not validated anthropometry. Height is entered, not inferred. Widths are not chest/waist/hip circumferences or clothing sizes. Clothing, perspective, hair, shoes and pose can bias the estimates. |
| Recommendation context | Only confirmed estimates are saved under the authenticated user profile and supplied to Gemini's outfit assessment as approximate silhouette context. Manual tape measurements retain precedence. Changing the saved reference height invalidates the old photo analysis. | The pretrained compatibility scorer does not receive body measurements. No measured ranking improvement or physical fit guarantee follows from this context. |
| Try-on | WeShopAI is the studio default. If generation fails for exactly one top, IDM-VTON is attempted and the actual provider, attempts and warnings are recorded. FASHN remains selectable. Existing local garment cleanup is used for WeShopAI when installed; preparation failures fall back to the original reference. | One garment for WeShopAI; IDM-VTON backup only supports tops. Both hosted demos have availability/queue/quota limits. IDM-VTON is a noncommercial research demo. Numeric pose estimates cannot condition these hosted interfaces. |
| Photo reuse | Body analysis and try-on have independent uploads. The explicit **Use this photo for try-on** button copies an analyzed photo only when requested. Saving attributes does not change the try-on upload. | Strict standing/full-body MediaPipe validation applies only to measurement analysis. Try-on checks image format, size and dimensions, then sends the photo to the selected generator. It does not require measurements or measurement posture. |
| Mobile handoff | The optional cloud scaffold uses the shared WeShopAI/IDM adapter and stores actual provider metadata. Saved profile JSON supports the body-analysis object. | Cloud redeployment, authenticated end-to-end verification and a native/mobile pose capture UI remain outstanding. The current pose UI is the browser studio. |

In the studio, expand **Analyze a full-body photo**, enter your known height,
analyze a straight front-facing photo with head and feet visible, review the
estimates and confirm. Ask for an outfit afterward, or choose one garment and
generate a preview. Measurement analysis requires a standing, front-facing
full-body photo. Try-on can use an upper-body photo for tops; for bottoms and
dresses include the relevant garment area and legs. Seated photos are not
blocked by the measurement validator in try-on; generator quality may vary.

Selecting a photo in the body-analysis panel starts analysis automatically when
a known height is available. Selecting a try-on photo only sets that form's
photo; it does not populate, open or run body analysis. The backend validates
posture first; browser MediaPipe then estimates the attributes. Shoulder span,
clothed waist front width, torso length and shoulder/hip ratio appear in editable
number fields. The user can restore the original estimates, correct values and
confirm before saving. Saved profiles retain the original estimates and mark
which fields the user corrected; recommendation context uses the reviewed values.
Saved attributes can be reopened and edited after refreshing. Changing height
requires a new analysis to update the photo scale. No circumference or absolute
height is inferred automatically, and numeric corrections do not modify the
garment size or body geometry generated by the current try-on providers.

Supported clothing groups include shirts, T-shirts, blouses and knitwear;
jeans, trousers, shorts and skirts; and one-pieces such as dresses and jumpsuits.
Single outer garments are experimental; layered outfits, shoes and accessories
are not reliably rendered. The application does not infer or restrict gender.
Men's and women's clothing use the same pipeline, but quality has not been
benchmarked separately by gender or for every category. IDM-VTON's top-only
restriction applies to the backup, not to the WeShopAI/FASHN category mapping.

Install backend requirements and the pose model before first use on another
server. This workstation has both installed:

```powershell
& '../../.venv/Scripts/python.exe' -m pip install -r requirements.txt
& '../../.venv/Scripts/python.exe' scripts/setup_pose_validation.py
```

If the measurement validator or pose model is unavailable, measurement analysis
returns a service-unavailable error; 2D try-on remains independent. Rejected
measurement photos return HTTP 422 with capture instructions. Pose checking
runs on the backend CPU and does not call a paid service.

Restart the studio after updating the source:

```powershell
& .\scripts\start_studio.ps1
```

The launcher uses Gemini for the chatbot and defaults try-on to WeShopAI when
`PHASE3_TRYON_PROVIDER` has not already been configured. Select WeShopAI in the
studio if an older environment setting selects another engine. Provider keys
remain on the backend; no paid image-generation API was used for verification.

Verification includes API regression checks for conversation routing and
ownership, confirmed profile persistence, provider fallback, failure reporting,
cloud provider metadata and preparation timeouts; geometry checks cover scale
calculation, missing height, low visibility, turned pose and cropped images.
A real browser test completed detection, estimate review and a validated save
payload on an existing front-facing benchmark photo. This is a workflow check,
not a body-measurement accuracy evaluation. A separate WeShopAI request using
official public IDM-VTON sample inputs completed in 71.5 seconds and returned a
valid image; the backup was not needed in that live request.

The pose implementation follows the [MediaPipe Web Pose Landmarker documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
Hosted inputs and capabilities follow the official [WeShopAI Space](https://huggingface.co/spaces/WeShopAI/WeShopAI-Virtual-Try-On)
and [IDM-VTON Space](https://huggingface.co/spaces/yisol/IDM-VTON).
