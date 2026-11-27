# Drape & Drop — Model Evaluation Report

**Report date:** 23 November 2026  
**Experiment version:** 1  
**Evaluation type:** Exploratory component benchmarks using pretrained models  
**Selection seed:** `20261122`

## Executive summary

Drape & Drop was evaluated against external dataset labels and reference images to measure clothing categorization, outfit completion, outfit compatibility, background removal and 2D virtual try-on. Test selections were recorded before inference. Predictions, model settings, dataset revisions and integrity checks were retained for inspection.

**Background removal provides the strongest positive evidence:** BiRefNet-lite achieved mean intersection-over-union (IoU) of **0.963** and mean Dice of **0.974** on 100 garment-only product photographs. The same examples give an all-foreground baseline IoU of 0.442.

**Virtual try-on provides promising pilot evidence:** FASHN achieved full-image SSIM of **0.878** and LPIPS of **0.143** across 20 paired reconstruction cases. Garment-area evaluation and an erased-input baseline are reported alongside these figures to make background preservation less likely to dominate the interpretation.

The recommendation adapter did **not demonstrate an improvement over chance** in the tested setting. Four-choice outfit completion achieved 22.2% accuracy against 25% expected random accuracy; compatibility achieved ROC-AUC 0.476 against chance AUC 0.500. These findings identify a component requiring further investigation.

These experiments characterize the evaluated components and data subsets. They do not establish an overall application accuracy, personalized recommendation quality or physical garment fit.

## 1. Results overview

All results below were computed from this project's evaluation runs. Model-publisher benchmark scores are not substituted for measured results. Values are rounded for presentation; the [aggregate metrics summary](docs/evaluation-assets/metrics-summary.json) preserves numerical precision.

| Component | Metric | Cases | Measured result | 95% interval | Reference baseline |
|---|---|---:|---:|---:|---:|
| Categorization audit | Top-1 mapped-label agreement ↑ | 500 | **50.8%** | 46.4%–55.2% | 11.2%, most frequent mapped class |
| Categorization audit | Top-3 mapped-label inclusion ↑ | 500 | **85.0%** | Not computed | — |
| Categorization audit | Macro F1 across nine mapped classes ↑ | 500 | **0.551** | Not computed | — |
| Outfit completion | Four-choice FITB accuracy ↑ | 500 | **22.2%** | 18.8%–26.0% | 25.0%, random expectation |
| Outfit compatibility | ROC-AUC ↑ | 1,000 | **0.476** | 0.439–0.508 | 0.500, chance |
| Outfit compatibility | Classification accuracy ↑ | 1,000 | **49.9%** | 46.8%–53.0% | 50.0%, constant prediction |
| Background removal | Mean foreground IoU ↑ | 100 | **0.963** | 0.933–0.983 | 0.442, all foreground |
| Background removal | Mean foreground Dice ↑ | 100 | **0.974** | 0.948–0.991 | — |
| FASHN paired pilot | Mean full-image SSIM ↑ | 20 | **0.878** | 0.859–0.898 | 0.815, erased input |
| FASHN paired pilot | Mean full-image LPIPS ↓ | 20 | **0.143** | 0.128–0.158 | 0.408, erased input |

↑ Higher is better. ↓ Lower is better. The categorization sample contains nine mapped target classes while retaining all 23 app categories as possible predictions. Try-on cases are paired upper-garment reconstructions with masking enabled. Background-removal cases are garment-only photographs.

**The metrics use different units and must not be averaged into an overall project score.** In particular, SSIM 0.878 is not 87.8% try-on accuracy, and top-3 inclusion of 85.0% is not top-1 classification accuracy.

## 2. Strongest measured findings

### 2.1 Strongest positive component result: background removal

The actual application background remover, BiRefNet-lite through `rembg`, processed 100 product images from the official VITON-HD test archive. Each predicted alpha mask was compared with the corresponding supplied cloth mask.

| Measure | BiRefNet-lite | All-foreground baseline |
|---|---:|---:|
| Mean IoU | **0.963** | 0.442 |
| Median IoU | **0.994** | 0.453 |
| Mean Dice | **0.974** | — |

IoU measures the intersection of predicted and labelled foreground divided by their union. Dice measures twice the intersection divided by the sum of their foreground areas. These foreground-overlap metrics are more informative here than pixel accuracy, which can be dominated by correctly identifying background.

**Supported interpretation:** the remover closely matches the supplied garment masks on this selected product-photo sample. This supports foreground preparation for garment-only inputs.

**Boundary of the finding:** the experiment does not measure removal of a donor person's arms, body or other clothing. The mean IoU is lower than the median, showing that some failures remain despite strong performance on many examples.

### 2.2 Promising result requiring broader validation: 2D try-on

Twenty cases were sampled from the frozen VITON-HD subset before generation. For each case, the ground-truth person photograph already contains the reference top. FASHN's masking path first erases the original clothing, then generates a reconstruction conditioned on the corresponding garment image. The actual erased input was retained as a baseline.

| Evaluation region | Metric | FASHN reconstruction | Erased-input baseline | FASHN 95% interval |
|---|---|---:|---:|---:|
| Full image | SSIM ↑ | **0.878** | 0.815 | 0.859–0.898 |
| Full image | LPIPS ↓ | **0.143** | 0.408 | 0.128–0.158 |
| Garment bounding box | SSIM ↑ | **0.654** | 0.567 | 0.585–0.722 |
| Garment bounding box | LPIPS ↓ | **0.360** | 0.761 | 0.325–0.397 |

SSIM measures local structural similarity. LPIPS measures perceptual distance using learned image features. The reconstructions have better mean similarity than the erased-input baseline under both full-image and garment-crop measures.

The garment crop is the tight bounding box of the ground-truth upper-garment parsing labels `5`, `6` and `7`, following the [VITON-HD authors' grouping](https://github.com/shadow2496/VITON-HD/blob/main/datasets.py). The same box is used for the reference, generated image and baseline, without resizing the crop. The lower garment-crop SSIM makes clear why full-image SSIM alone should not be treated as garment-fidelity performance.

An additional mask audit estimated **99.82% mean coverage** of labelled upper-garment pixels by the captured grey erasure mask; minimum case coverage was **98.89%**. This audit uses the exact grey fill colour, so original grey pixels can slightly overestimate coverage. No selected case was removed after generation.

**Supported interpretation:** FASHN can reconstruct upper garments with measurable perceptual similarity in this paired setting.

**Boundary of the finding:** this is a 20-case pilot using frontal-view women and upper garments. It does not establish performance on arbitrary new garment transfers, men, trousers, complete outfits, physical fit or user satisfaction. Masking was enabled for the benchmark, which differs from the application's default segmentation-free mode.

### 2.3 Useful categorization finding: candidate coverage and class variation

The mapped target label appeared among the top three predictions for **425 of 500 images (85.0%)**. The first prediction matched the mapped label in **254 cases (50.8%)**. This difference suggests that label confusion and target-garment ambiguity merit investigation; it does not establish that a user-facing review workflow would succeed.

The highest observed per-class F1 values were **0.907 for Jumpsuit** and **0.903 for Dress**. These are descriptive results within the selected categories, not substitutes for the overall result. The complete per-class table is included to retain the weaker findings.

| Mapped app class | Images | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Jeans | 56 | 42.7% | 62.5% | 0.507 |
| Dress | 56 | 89.5% | 91.1% | 0.903 |
| Shorts | 56 | 100.0% | 30.4% | 0.466 |
| Sweater | 56 | 84.0% | 37.5% | 0.519 |
| Trousers | 56 | 70.0% | 12.5% | 0.212 |
| Skirt | 55 | 90.9% | 36.4% | 0.519 |
| Cardigan | 55 | 68.1% | 89.1% | 0.772 |
| Leggings | 55 | 50.0% | 9.1% | 0.154 |
| Jumpsuit | 55 | 92.5% | 89.1% | 0.907 |

Precision measures how often predictions of a class are correct. Recall measures how many examples of that class are recovered. F1 balances the two; a high precision value alone can coexist with poor recall.

![Clothing categorization confusion matrix showing counts for nine mapped target categories](docs/evaluation-assets/classification_confusion.png)

[Download the vector confusion matrix](docs/evaluation-assets/classification_confusion.svg).

## 3. Recommendation results and their engineering value

### Outfit completion

The complementary-item retrieval (CIR) adapter was given a partial outfit and the four original benchmark candidates. It selected the original answer in **111 of 500 questions**.

| Measure | Observed | Random expectation |
|---|---:|---:|
| FITB accuracy | **22.2%** | 25.0% |
| Mean reciprocal rank (MRR) | **0.512** | 0.521 |
| Recall@2 | **52.0%** | 50.0% |
| Recall@3 | **77.2%** | 75.0% |

MRR gives a correct answer ranked first, second, third or fourth a contribution of `1`, `1/2`, `1/3` or `1/4`. The recall baselines follow directly from uniformly ordering four candidates with one designated correct answer.

The accuracy interval includes 25%. These results do not demonstrate an improvement over random choice; they also do not establish that the adapter is statistically worse than chance.

### Outfit compatibility

The application's mean leave-one-out cosine score was evaluated on 500 supplied positive outfits and 500 supplied negative outfits. A decision threshold of **0.141226** was selected using 200 separate validation cases, then applied unchanged to the test sample.

Test ROC-AUC was **0.476**, accuracy was **49.9%**, average precision was **0.494**, and positive-class F1 was **0.087**. The AUC interval includes 0.500. The tested score therefore provides no convincing evidence of useful separation between the supplied positive and negative outfits.

![Four-choice completion accuracy and compatibility ROC compared with chance baselines](docs/evaluation-assets/recommendation_results.png)

[Download the vector recommendation figure](docs/evaluation-assets/recommendation_results.svg).

These negative findings are useful: they identify a recommendation configuration that requires investigation before making a high-accuracy claim. The checkpoint example and the application use different image transforms and text-feature extraction conventions. That difference is a candidate for validation-set investigation; these experiments have not established it as the cause of the observed results.

The benchmark uses dataset product descriptions in place of the application's wardrobe-metadata descriptions. It evaluates the CIR component and its scoring adaptation, not the full personalized recommendation or Gemini chatbot workflow. Supplied negative outfits are benchmark labels, not universal judgements of human fashion preference.

## 4. Experimental design

### Published backbone reference: Marqo-FashionSigLIP

The [official Hugging Face model card](https://huggingface.co/Marqo/marqo-fashionSigLIP#benchmark-results), checked on 23 November 2026, reports the following **publisher-reported retrieval benchmarks**:

| Publisher task | Datasets averaged | Precision@1 | Precision@10 | MRR |
|---|---:|---:|---:|---:|
| Category-to-product retrieval | 5 | 0.758 | 0.716 | 0.812 |
| Subcategory-to-product retrieval | 4 | 0.767 | 0.683 | 0.811 |

These tasks use a category or subcategory to retrieve relevant products. Drape & Drop's categorization audit instead starts with an image and predicts a category. Consequently, Precision@1 of 0.758 must not be described as 75.8% clothing-classification accuracy or used to replace the project's measured mapped-label agreement of 50.8%.

These published values can support the choice of a fashion-specific embedding backbone. They remain external reference results, with different tasks and protocols, and were not reproduced in this project's experiment. They are also distinct from the CIR adapter evaluated for outfit recommendation.

Suggested report wording:

> Marqo reports category-to-product retrieval Precision@1 of 0.758, averaged across five datasets, for the FashionSigLIP backbone. Our application-specific image-to-category audit is reported separately because the task, label mapping and evaluation protocol differ.

### Data and selection

For a contribution-focused presentation of the implementation and the distinction between measured and publisher-reported evidence, see [System Contributions and Results](PROJECT_RESULTS.md).

| Component | Data source | Selection and scope |
|---|---|---|
| Categorization | [Marqo DeepFashion In-shop mirror](https://huggingface.co/datasets/Marqo/deepfashion-inshop) | 500 distinct products, approximately balanced across nine mapped categories; one view per product, preferring a front view |
| Completion and compatibility | [Authors' Polyvore Outfits repository](https://huggingface.co/datasets/mvasil/polyvore-outfits) | Samples from supplied disjoint test and validation files; original FITB candidate sets retained |
| Background removal | [Official VITON-HD archive](https://github.com/shadow2496/VITON-HD) | 100 sampled test product images with supplied cloth masks |
| Try-on | Same VITON-HD subset | 20 sampled paired test cases; selected before generation |

The categorization sample covers nine mapped source groups: `denim → Jeans`, `dresses → Dress`, `shorts → Shorts`, `sweaters → Sweater`, `pants → Trousers`, `skirts → Skirt`, `cardigans → Cardigan`, `leggings → Leggings`, and `rompers → Jumpsuit`. Ambiguous merged groups such as tees/tanks were excluded. All 23 app output categories remained available.

Some retained source groups are still broader than the app labels: for example, pants can include joggers. Catalogue labels may also be noisy. Consequently, **mapped-label agreement** is the appropriate description of this audit. The raw 224 × 224 mirror images can contain multiple garments; the complete application upload and garment-isolation workflow was not evaluated. The mirror contains no official partition column, and the original partition download was unavailable. This is not an official DeepFashion test-split result.

Polyvore file inspection found overlapping item IDs between the nominally disjoint splits. Cases involving those overlaps were excluded before sampling. Selected test item IDs are absent from the supplied training and validation item sets. Selected validation item IDs are absent from training and test item sets. Selected validation and test images also share no identical byte hashes. FITB questions were limited to contexts of one to seven items; compatibility outfits contained two to eight items.

### Model and inference configuration

| Component | Tested implementation |
|---|---|
| Categorization | Marqo-FashionSigLIP with the application's unchanged prompt banks and classification method |
| Recommendation | Frozen ResNet18 visual features, normalized LaBSE text features and the pinned CIR checkpoint; mean leave-one-out cosine for compatibility |
| Background removal | `birefnet-general-lite` through the actual application remover; ONNX Runtime CPU provider; alpha and reference masks thresholded at 128 |
| Try-on | FASHN VTON 1.5; `tops`; flat-lay reference; 50 sampling steps; seed 42; guidance 1.5; `segmentation_free=False` |
| Image scoring | RGB reference resolution 768 × 1024; generated and erased-input images resized with Lanczos; SSIM with uniform 7 × 7 windows; LPIPS AlexNet v0.1 on inputs scaled to `[-1, 1]` |

Categorization and recommendation feature extraction used an NVIDIA GeForce RTX 4060 Laptop GPU with PyTorch `2.11.0+cu128`. FASHN generation also used CUDA with bfloat16 inference. Background removal and image-quality scoring used the CPU. Package versions, checkpoint hashes and configuration details are recorded in the [aggregate summary](docs/evaluation-assets/metrics-summary.json).

Dataset revisions were pinned to `886fbe26ceac0b2bc8195d606e3fde641e7157f8` for the DeepFashion mirror and `22cc0c748c293a598e1df561a76abe96273cb76a` for Polyvore. The CIR checkpoint revision was `7eaf8d92beb709db20498614b1bc04e43f08136a`; the cached FashionSigLIP revision was `c56244cc94f92419e8369fa71efdaf403b124ce8`.

### Uncertainty and verification

Accuracy intervals use the Wilson 95% method. Compatibility AUC uses 1,000 stratified case-bootstrap resamples. Image-metric means use 2,000 case-bootstrap resamples. Repeated Polyvore items create dependence between cases, so case-level intervals may be optimistic. These intervals do not account for annotation errors, mapping ambiguity or distribution shift.

Completed internal checks included:

- Matching every selected categorization image byte hash, product identifier and source label against its actual parquet row.
- Reconstructing categorization, FITB and compatibility metrics from saved predictions and source labels.
- Reconstructing the compatibility threshold using validation data only.
- Comparing 12 FITB and 12 compatibility cases against the application's scoring methods with identical frozen features. Maximum absolute differences were below `1e-6`.
- Checking that identical images produce SSIM `1.0` and LPIPS `0.0`.
- Verifying frozen input hashes and recording the try-on erasure-mask audit.

These checks support traceability and computational correctness. Independent external replication remains necessary, and complete upstream pretraining corpora were not available for overlap verification.

## 5. Reproduction and evidence

The machine-readable [metrics summary](docs/evaluation-assets/metrics-summary.json) and aggregate figures accompany this document. Local run records, including frozen selections and per-case predictions, are retained separately under `storage/benchmarks/results/v1/`.

Evaluation entry points are:

| Script | Purpose |
|---|---|
| [`benchmark_models.py`](scripts/benchmark_models.py) | Frozen sample preparation, categorization, CIR inference and integrity checks |
| [`prepare_viton_benchmark.py`](scripts/prepare_viton_benchmark.py) | Selected official VITON-HD archive downloads and member verification |
| [`benchmark_image_quality.py`](scripts/benchmark_image_quality.py) | Background-removal inference, FASHN generation and paired similarity metrics |
| [`verify_benchmark_parity.py`](scripts/verify_benchmark_parity.py) | Agreement with the application's scoring methods |
| [`validate_benchmark_results.py`](scripts/validate_benchmark_results.py) | Reconstruction of metrics and source-label checks |
| [`audit_tryon_masks.py`](scripts/audit_tryon_masks.py) | Inspection of clothing erasure coverage |
| [`plot_benchmarks.py`](scripts/plot_benchmarks.py) | Aggregate confusion-matrix and recommendation figures |

The recorded local workflow uses separate application and CUDA environments, cached model assets and separately downloaded datasets. **A clean-clone dependency and acquisition workflow still needs to be validated before claiming independent, one-command reproducibility.** No application model, prompt bank or configuration was tuned to improve these reported scores.

## 6. Appropriate reporting and next validation steps

A suitable description for an academic project report is:

> We conducted an exploratory component evaluation using fixed subsets of external fashion datasets. The evaluated background remover achieved mean IoU 0.963 across 100 garment-only photographs. A 20-case paired upper-garment reconstruction pilot achieved full-image SSIM 0.878 and LPIPS 0.143. Categorization and recommendation results are reported with their dataset mappings, baselines and limitations. Personalized recommendation quality and end-to-end application accuracy were not established.

The next evaluations should prioritize:

1. **Categorization:** align the target taxonomy with independently reviewed labels and evaluate the actual garment-preparation workflow.
2. **Recommendation:** investigate the feature-extraction contract on validation data, compare against useful retrieval baselines, and reserve an untouched test selection for final assessment.
3. **Try-on:** expand the paired pilot, include broader people, poses and garment types, and add a separate unpaired evaluation with blinded human assessments of fidelity and identity preservation.
4. **Personalization and chatbot quality:** collect independently labelled relevance judgements and a task-specific evaluation suite before assigning accuracy or ranking-quality figures.
5. **Reproduction:** verify the documented pipeline from a clean installation and seek an independent rerun.

## 7. Public sharing and source attribution

This Markdown document and its companion assets contain aggregate statistics and evaluation plots. They do not embed source photographs, per-image dataset annotations, personal photos or model weights.

Keep the original local HTML report, evidence archive and dataset directories out of a public upload until their contents have been reviewed: those local artifacts contain dataset examples or individual annotations. The original [DeepFashion agreement](https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion.html) restricts dataset redistribution and specifies non-commercial research use. [VITON-HD](https://github.com/shadow2496/VITON-HD#license) specifies CC BY-NC 4.0 and attribution requirements. Obtain datasets through the original providers and retain their terms and citations. The Polyvore provider's access conditions should also be reviewed before redistribution.

### References

1. Liu et al. **DeepFashion: Powering Robust Clothes Recognition and Retrieval with Rich Annotations.** CVPR, 2016. [Dataset and citation](https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion.html). [Evaluation mirror](https://huggingface.co/datasets/Marqo/deepfashion-inshop).
2. Vasileva et al. **Learning Type-Aware Embeddings for Fashion Compatibility.** ECCV, 2018. [Authors' dataset repository](https://huggingface.co/datasets/mvasil/polyvore-outfits).
3. Choi et al. **VITON-HD: High-Resolution Virtual Try-On via Misalignment-Aware Normalization.** CVPR, 2021. [Official implementation and dataset](https://github.com/shadow2496/VITON-HD).
4. Wang et al. **Image Quality Assessment: From Error Visibility to Structural Similarity.** IEEE Transactions on Image Processing, 2004. [Original SSIM paper](https://ece.uwaterloo.ca/~z70wang/publications/ssim.html).
5. Zhang et al. **The Unreasonable Effectiveness of Deep Features as a Perceptual Metric.** CVPR, 2018. [LPIPS implementation](https://github.com/richzhang/PerceptualSimilarity).
6. [Marqo-FashionSigLIP model](https://huggingface.co/Marqo/marqo-fashionSigLIP).
7. [Evaluated OutfitTransformer-LaBSE checkpoint](https://huggingface.co/fkuyumcu/OutfitTransformer-labse).
8. [BiRefNet implementation](https://github.com/ZhengPeng7/BiRefNet).
9. [FASHN VTON 1.5 implementation](https://github.com/fashn-AI/fashn-vton-1.5).
