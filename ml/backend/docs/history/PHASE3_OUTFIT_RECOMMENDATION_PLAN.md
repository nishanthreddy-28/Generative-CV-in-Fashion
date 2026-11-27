# Drape&Drop: Phase 3 outfit recommendation research and execution plan

Research date: 2 November 2026.

Status at the initial research review: literature, repository, model-card, and backend contract review. External results below are not project results. Proposed architecture choices and release targets are engineering recommendations, not experimentally established outcomes.

Implementation update, 3 November 2026: a standalone pretrained Phase 3 backend has been added under `drapedrop-phase2/backend/app/phase3`. The CIR checkpoint and required encoders have been downloaded and real inference checked. Local Qwen3-VL through Ollama supplies conversation interpretation and visual suitability assessment. The current ranking method is a leave-one-out adaptation of the pretrained CIR model, not the originally proposed newly trained CP model. See `drapedrop-phase2/backend/PHASE3.md` and the generated verification reports for current behavior and limitations. No model training was performed; frontend and body profile integration remain subsequent work.

## Execution decision updated 3 November 2026

User priorities: complete the Phase 3 recommendation backend before integrating the frontend; support conversational requests and general requests; target a credible public-facing product under a short schedule. Body profile personalization remains a subsequent milestone. This section takes precedence over the broader experimental schedule below.

Confirmed implementation preference: use existing pretrained recommendation models for the first release. Custom training and fine-tuning are outside the initial implementation scope. Load and evaluate existing checkpoints with their exact feature encoders, verify applicable usage terms, and build the wardrobe search, conversation, and request-suitability services around the selected artifacts. Earlier training proposals below remain optional research directions rather than prerequisites. No recommendation model has yet been integrated or independently validated in this workspace.

Deliver the first version as a standalone service exercised through API requests and a saved conversation replay suite. Frontend work begins after the recommendation service passes the agreed functional and quality gates. Supabase integration is a storage/authentication dependency that can sit behind repository interfaces; no frontend is needed to assess the engine.

### Selected implementation direction

1. Interpret the message into a validated request and merge explicit changes into stored conversation state. Preserve unspecified values as unknown. Resolve garment references only to owned items. Ask a concise clarification if a required reference is ambiguous.
2. Construct eligible complete outfits, preserving locked items, exclusions, availability, and supported templates. Keep hard requirements separate from preferences inferred by the model. A date has multiple possible dress codes, so occasion must not become a single rigid category rule.
3. Batch-score candidate sets using one validated pretrained whole-outfit compatibility model and its exact required encoder. Begin with checkpoint loading, artifact/usage review, and real-image evaluation. Do not assume model-card performance transfers to wardrobe photos. Cache its features separately from existing categorization vectors when the encoder differs.
4. Evaluate request relevance separately. For open-ended situations, a bounded multimodal reranker over a small shortlist is the proposed addition to assess the candidate images against the stated event and conditions. It returns structured decisions and unknowns grounded in the supplied items. Benchmark its incremental quality, latency, and request cost before making it mandatory. This is a proposed engineering combination, not a published validated result for Drape&Drop.
5. Apply deterministic ownership/constraint checks and a quality decision calibrated on reviewed examples. Return fewer outfits where appropriate. Insufficient inventory, no suitable result, ambiguous request, unknown garment properties, and model/service failure are distinct states.
6. Generate concise explanations after selection. Explanations cannot introduce different items or unverified properties. A supplied weather report is context; a claim that footwear is waterproof requires evidence beyond a generic shoe photo.

### Quality work that stays in scope

- Use human-corrected garment metadata for the initial recommender-only check, then evaluate the combined system with actual Phase 2 predictions.
- Freeze a representative set of real garment photos and conversation tasks. Include plain requests, occasion requests, sparse wardrobes, missing shoes, one-piece outfits, ambiguous garment names, locked items, follow-up replacements, and contradictory updates.
- Compare one simple baseline against the selected candidate pipeline. Reserve the larger multi-model research matrix for future work. Run a targeted multimodal ablation only to decide whether that extra serving cost improves contextual relevance.
- Review judgments blind to model names and explanations. Track visual compatibility, request satisfaction, at-least-one-useful-result rate, false no-match rate, unsupported claims, diversity, and latency/cost separately.
- Establish quality thresholds on tuning data and freeze them before final evaluation. A top-ranked outfit is not automatically acceptable; a raw sigmoid is not a calibrated aesthetic probability. A universal success percentage or latency guarantee is not established by this plan.
- Record model/encoder versions, recommendation IDs, item versions, structured intent, and feedback from the first version. This supports reproducible bug reports and later targeted fine-tuning.

### First handover before frontend integration

An authenticated recommendation API; consistent response schemas for outfits and failure/clarification states; example conversations; owned-item image responses; a reproducible model artifact configuration; a quality report on held-out examples; and measurements for the intended hosting hardware. Keep frontend-facing schemas stable once these are accepted.

The first practical task is a short checkpoint feasibility and real-wardrobe quality experiment. If the candidate cannot be reproduced or fails the quality comparison, record that result and evaluate the bounded multimodal alternative before investing in a custom training program. The product quality target remains fixed while the serving method is selected from evidence.

## Decision and scope

Build a wardrobe-constrained recommender that returns complete, compatible combinations of items the user actually owns. Implement general outfit compatibility first. Add body profile personalization only after the core passes a separate evaluation gate.

Revise the earlier pairwise-only recommendation: a type-aware pair scorer remains a baseline; the leading learned candidate is a compact model that evaluates the whole set of garments. Evaluate a multimodal, training-free alternative as a challenger rather than assume a trained model must win.

The first product supports: recommend outfits from this wardrobe; build around one or more locked garments; complete a partial outfit; replace one item while keeping the others. Initially return 3-5 distinct outfits when inventory permits, and fewer with an explanation when it does not. Body measurements, skin tone, body photos, chat, RAG, and try-on are not dependencies of this milestone. Occasion and weather can be added after basic compatibility is measured.

## Research findings and practical decisions

| Source | Verified relevance | Decision |
|---|---|---|
| [Type-Aware Embeddings, ECCV 2018](https://arxiv.org/abs/1803.09196), [author code](https://github.com/mvasil/fashion-compatibility) | Models type-dependent complementarity, distinguishing it from visual similarity. | Train a small type-aware baseline with the same features and data used by the main candidate. |
| [OutfitTransformer, WACV 2023](https://arxiv.org/abs/2204.04812) | Scores unordered garment sets and supports partial-outfit completion. The paper's disjoint results are lower than its nondisjoint results. | Main architectural reference for the learned candidate; evaluate on unseen items. |
| [VICTOR paper](https://arxiv.org/abs/2207.13458), [official implementation](https://github.com/stevejpapad/Visual-InCompatibility-Transformer) | Includes whole-outfit assessment and identifying mismatching garments. | Useful design reference for future replace-one-item diagnostics. Not an initial extra model. |
| [Text2Outfit, ICCV 2025](https://openaccess.thecvf.com/content/ICCV2025/papers/Zhai_Text2Outfit_Controllable_Outfit_Generation_with_Multimodal_Language_Models_ICCV_2025_paper.pdf) | Uses an LLM framework for controlled text/seed-to-outfit retrieval and composition. | Relevant to a later conversational interface. Public, usable official weights/code were not verified in this review. |
| [TATTOO, 2025 preprint](https://arxiv.org/abs/2509.23242) | Uses a frozen multimodal model to form target descriptions and aesthetic attributes for retrieval. Its limitations discuss dependence on a closed-source model for its best results. | Evaluate an explicitly labeled adaptation as the main training-free challenger; measure request cost and latency. |
| [A100, CVPR 2022](https://openaccess.thecvf.com/content/CVPR2022/html/Zou_How_Good_Is_Aesthetic_Ability_of_a_Fashion_Model_CVPR_2022_paper.html), [author dataset repository](https://github.com/AemikaChow/AiDLab-fAshIon-Data) | Provides an external assessment grounded in aesthetic judgments. | Supplement synthetic compatibility tasks with external aesthetic evaluation and human wardrobe evaluation. |
| [AesRec, 2026 preprint](https://arxiv.org/abs/2602.03416) | Explores structured aesthetic ratings, substantially produced using a VLM with human consistency checks. | Useful supplementary lead; model-produced ratings must not replace independent human judgments. Availability and terms need verification before use. |

This is a task-fit shortlist, not a claim to have established the universally strongest model. Do not compare headline scores from different datasets, candidate pools, or split protocols.

### Repository and checkpoint findings

- [bigohofone/outfit-transformer](https://github.com/bigohofone/outfit-transformer) explicitly describes itself as non-official, has an MIT code license, feature precomputation, CP/CIR training commands, and a linked checkpoint archive. The archive was not downloaded; its contents and reported results remain unverified.
- [FlorindoDev/OutfitTransformer-weights](https://huggingface.co/FlorindoDev/OutfitTransformer-weights), with [source code](https://github.com/FlorindoDev/OutfitTransformer), publishes CP/CIR artifacts and describes FashionCLIP feature dependencies. Treat these as community candidates. Verify exact revision, license, encoder, split provenance, and state-dict compatibility before use.
- [fkuyumcu/OutfitTransformer-labse](https://huggingface.co/fkuyumcu/OutfitTransformer-labse) exposes configuration, model code, and weights. It uses ResNet-18 and LaBSE features. It is another comparison candidate, not a direct consumer of current FashionSigLIP vectors.
- [sahirp/complete-the-look](https://huggingface.co/sahirp/complete-the-look) targets scene-to-product retrieval. That task differs from evaluating a set of individually uploaded wardrobe garments; matching input dimensions would not establish applicability.

Use community checkpoints first to establish a reproducible reference, then compare the custom candidate. No claim of independent reproduction until the exact artifacts have run under a pinned configuration.

## Current integration boundary

The current backend configuration names `hf-hub:Marqo/marqo-fashionSigLIP` and a 768-dimensional embedding. Its supported slots are `top`, `bottom`, `outer`, `full`, and `shoes`. The stored visual representation can be reused by a model trained for that feature space. The [official Marqo model card](https://huggingface.co/Marqo/marqo-fashionSigLIP) describes retrieval/classification capabilities; those results do not certify outfit compatibility.

Represent every cached feature with encoder ID, pinned revision, preprocessing version, dimension, normalization, and item/image version. Maintain a separate compatibility-model version. An equal vector dimension does not make two encoder spaces interchangeable. If a community scorer requires FashionCLIP, extract and cache its required features separately; do not pad or relabel current vectors.

## Data comes before model integration

### External training and reference evaluation

Use the official [Polyvore Outfits release](https://huggingface.co/datasets/mvasil/polyvore-outfits), subject to access approval and clarified terms. Its current card both restricts access to academic/nonprofit research and contains broader CC BY language. Resolve that inconsistency with the authors before treating deployment rights as settled. Request institutional access rather than assume an unverified mirror solves this issue.

Primary protocol: item-disjoint training, validation, and test data. Audit IDs, exact image hashes, decoded-image duplicates, and near duplicates where practical. Official split labels do not certify the absence of every image duplicate. Never generate training negatives from validation/test items. Keep a manifest recording all exclusions.

Map the original fine categories into the five product slots. Preserve fine categories internally for realistic replacement sampling. Extract supported garment subsets from outfits that contain accessories. Split and deduplicate before this transformation, and check again afterward: different source outfits can collapse into the same supported subset. Recompute training and test examples consistently. This is a modified benchmark and must be reported separately from an unchanged paper reproduction.

A fashion encoder may have incomplete public training-data provenance. Do not claim that item-disjoint downstream splits prove its pretraining excluded those products. A newly photographed wardrobe evaluation is therefore essential.

### Real wardrobe evaluation

Proposed initial collection: approximately 8-12 consenting wardrobes with 20-40 supported items each. This is a practical starting sample, not a power calculation. Include different styles, photo conditions, and wardrobes with limited shoes or outerwear. Record unsupported categories rather than forcing them into an incorrect slot.

Reserve entire wardrobes for final evaluation. Collect separate tuning wardrobes. Use human-corrected categories for an initial recommender-only experiment, then repeat with actual Phase 2 predictions to measure the combined system. This distinguishes recommendation failures from tagging failures.

For each held-out wardrobe, define tasks with no seed, one locked garment, several locked garments, completion, and replacement. Judges see identical item images and no method name, score, or generated explanation. Compare candidates side by side with randomized placement; allow ties. Use at least three independent judgments per comparison where feasible, including wardrobe-owner relevance and another person's visual compatibility assessment as separate outcomes. Keep training feedback and final evaluation feedback separate.

## Proposed learned candidate

This is a proposed adaptation, not an exact reproduction of OutfitTransformer.

1. Keep the existing image encoder frozen initially; cache normalized image vectors.
2. Learn a projection from the 768-dimensional vector into an initial 256-dimensional working space.
3. Add learned slot/type features. Use padding masks and no arbitrary item-order position features.
4. Pass the garment set and an outfit token through a small attention encoder. Start with 2-4 blocks, then tune depth, width, and regularization on validation data.
5. Produce a scalar outfit ranking score. It is not a calibrated probability of being fashionable.

Initial features: image plus type. Compare an optional metadata/text branch only after the visual version works. Train with the same kinds of descriptions available at serving time. Catalog marketing text cannot silently substitute for sparse wardrobe attributes. Include unknown values and metadata dropout; never invent fabric or weather resistance from uncertain labels.

### Training tasks

First train curated outfits versus corrupted outfits. Create same-slot and, where possible, same-fine-category replacements while preserving outfit length and slot composition. This reduces shortcuts such as spotting two bottoms instead of learning style.

Add a listwise completion objective: remove an item, score several same-category replacements with the remaining outfit, and rank the curated item above sampled alternatives. Begin with random negatives and introduce harder negatives gradually. Cross-outfit membership does not prove incompatibility; replacements are noisy supervision. Exclude known co-occurring positives, retain several known positives when available, and inspect failure examples.

Train on the item counts and templates used in the product. Do not assume a model trained only on full catalog outfits gives reliable scores to partial outfits. Validate rankings separately for one-piece and top/bottom templates, and for optional outerwear; score scale can vary with outfit length.

Select configurations on validation data, report multiple training seeds, and evaluate the locked test once after choices are fixed. Keep a simple pooling model as an additional check that attention complexity actually helps.

## Proposed training-free challenger

Use a multimodal model to produce a concise, structured description of a complementary item for a partial outfit. Encode that description in the matching fashion text space and rank only the user's eligible items. Generate alternatives to avoid a single imagined ideal eliminating good wardrobe choices. Cache results where inputs match.

This is a TATTOO-inspired adaptation unless its exact prompts, fusion, and evaluation are reproduced. Record the model/version, prompt, images, and retrieval settings. Evaluate a bounded reranking pass only on a small candidate list, checking consistency under reordered candidates. Measure hallucinated attributes, repeated choices, latency, API cost, and service failure behavior. Do not use the same multimodal model's opinion as the final quality judge.

The challenger can become a proposal source, a limited reranker, or the serving approach if the independent results justify its cost. It is not automatically an ensemble component. A stronger explanation alone is not evidence of stronger outfit selection.

## Serving pipeline

```text
User wardrobe + optional locked/excluded item IDs
    -> verify ownership and fetch active items
    -> validate categories and construct supported outfit templates
    -> construct candidate combinations
    -> score complete candidates in batches
    -> preserve high-quality candidates and select varied results
    -> return real item IDs, image links, model version, and concise reasons
```

Supported initial templates: top + bottom + shoes; full garment + shoes; optionally one outer item. Templates express the supported product scope and can be extended. Do not treat every other clothing arrangement as universally invalid.

For small wardrobes, enumerate all eligible combinations. For example, 12 tops x 8 bottoms x 4 shoes = 384 combinations before outerwear. Rank that bounded set directly. Use a configurable measured candidate budget for larger wardrobes and compare pruning against exhaustive search on smaller ones. Pruning should preserve different templates and seed choices. Raw cross-category cosine similarity must not silently determine all proposals.

Completion can initially score each eligible missing item with the fixed partial outfit. A separate complementary-retrieval head is an optimization for larger inventories: train it after the compatibility reference works, then measure how often its shortlist retains good final outfits. Approximate vector indexing is unnecessary for a wardrobe of tens or hundreds of items.

Select 3-5 varied results from the good-scoring pool using garment overlap and visual similarity, preserving locked garments. A diversity bonus must not promote obviously weak outfits. If there are insufficient eligible items or no acceptable candidates under a validated threshold, return fewer suggestions or a specific missing-slot explanation.

Return short facts from reliable metadata, for example item colours and supported template. Treat replacement-score changes as model diagnostics, not proofs of human aesthetic preference. Generated explanations are optional and evaluated separately.

## Models to compare fairly

Use the same candidate pools, slots, and held-out wardrobe tasks for:

1. Template-valid random baseline.
2. Transparent metadata-based baseline with documented colour/formality preferences.
3. Type-aware pair model using frozen current features.
4. Simple pooled-set model using the same features.
5. Compact attention set model using the same features.
6. One reproducible community pretrained reference with its required encoder.
7. The multimodal training-free challenger.

Ablations: image only; image plus type; optional metadata; raw versus processed photos; candidate pruning; diversity selection. Use the same encoder when claiming an architecture improvement. Use the same architecture when claiming an encoder improvement. A frozen generic encoder can be a limited additional comparison if fashion pretraining provenance makes benchmark interpretation uncertain.

## Acceptance gates before body personalization

These are proposed project gates to register before examining final test outcomes, not published universal thresholds.

| Check | Proposed gate |
|---|---|
| Ownership, item existence, archive status, locked/excluded items, and template constraints | Zero violations in the evaluation suite |
| Offline compatibility and completion | Reproducibly outperform simple baselines under the same protocol; report AUC, four-choice FITB with candidate construction, and eligible-pool Recall@K/MRR |
| Human comparison | Aim for at least 60% preference against the strongest simple baseline, with a wardrobe-clustered confidence interval above 50%; report ties and minority-style failures |
| Real wardrobe usability | Track fraction of requests with at least one acceptable result in the top three; set the numerical gate after a tuning-only pilot and before final evaluation |
| Diversity | No duplicate outfits; report repeated-item rate and quality/diversity tradeoff with seeds held fixed |
| Performance | Initial engineering target: p95 below 2 seconds for cached-feature ranking at a declared wardrobe size on chosen hardware, excluding upload, model startup, and optional external explanations; revise before final testing if measured constraints require it |
| Reproducibility | Dataset manifests, encoder/checkpoint revisions, configuration, seed, and model hash recorded |

Estimate uncertainty at wardrobe level rather than pretend repeated ratings of one outfit are independent people/wardrobes. Report confidence intervals. FITB often has several aesthetically valid answers; original-item retrieval alone is insufficient to decide product quality. A100 is an extra external test, subject to access and protocol compatibility.

## Backend and Supabase boundary

Proposed endpoints:

- `POST /recommendations`: number of requested outfits plus optional locked/excluded item IDs and template options.
- `POST /recommendations/complete`: fixed items and the desired missing slot.
- `POST /recommendations/replace`: existing outfit and the item to replace.
- `POST /recommendation-feedback`: recommendation ID, action, and optional structured reason.

Responses contain item IDs, temporary image links, a ranking score if useful internally, model version, and any insufficient-inventory reason. Do not label a raw score as an accuracy percentage. Record recommendation runs, item snapshots/versions, candidate method, and feedback.

Supabase stores items, versioned embeddings, recommendation records, and feedback. Python hosts inference. A repository interface permits the research prototype to run against local data while Supabase integration proceeds. Cache embeddings outside the critical request path; invalidate item/metadata-dependent recommendations when relevant corrections occur.

Training and feature extraction can use a separate GPU environment. Head-only serving may fit a CPU service, but memory/latency must be measured before committing to hardware. Do not promise training duration or hosting cost before a small experiment.

## Execution sequence and deliverables

| Milestone | Work | Evidence needed to advance |
|---|---|---|
| A: data and reproducibility | Verify permitted access, audit splits, map taxonomy, build wardrobe evaluation protocol, inspect checkpoint dependencies | Runnable data loader, manifests, approved access, pinned artifacts |
| B: reference recommendation | Implement shared candidate generator, transparent baselines, and one community reference | Repeatable offline metrics and visible suggestions from real wardrobes |
| C: core model comparison | Train compact set and pair/pooling baselines; evaluate the multimodal challenger | Same-protocol comparisons, robustness checks, selected candidate justified by results |
| D: product integration | Add complete/replace/recommend APIs, ownership checks, image responses, frontend results, feedback | End-to-end wardrobe-only use and declared latency measurements |
| E: frozen general recommendation evaluation | Run held-out wardrobe/human study and external tests; inspect failures | Core acceptance gates pass; model and report frozen |
| F: body profile personalization | Re-rank compatible candidates using optional profile and user preferences | Separate study comparing identical wardrobes with/without personalization |

If the attention model fails to beat the pair model, diagnose data, features, and evaluation rather than shipping complexity. If the multimodal challenger materially improves real wardrobe quality within acceptable cost, retain it under a measured serving budget. If neither transfers adequately from catalog data, prioritize collecting real wardrobe compatibility judgments before trying a larger architecture.

## Adding the body profile later

Keep the validated general compatibility model as the base. Add a separate profile-aware ranking stage over its candidates. Body fit suitability requires appropriate profile/outfit relevance data or explicitly supplied user preferences; broad body-shape labels alone do not provide validated supervision. A future study should assess whether personalization improves the user's selections while preserving basic compatibility. This separation allows either stage to be improved without retraining the whole system and prevents profile work from hiding a weak core recommender.

