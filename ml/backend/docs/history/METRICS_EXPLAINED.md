# Drape & Drop — Results and Metric Definitions

**Report date:** 23 November 2026  
**Scope:** Component measurements and attributed pretrained-model benchmarks

This document distinguishes results measured in this project from benchmarks reported by the authors of the adopted models. Published results provide context for model selection; they do not replace evaluation of the application's implementation.

## 1. Component results and published references

| Component | Evidence source | Metric | Result | Meaning |
|---|---|---|---:|---|
| **Background removal** | Project measurement: 100 garment-only photographs | **Intersection-over-union (IoU) ↑** | **0.963** | Intersection of predicted and reference foreground pixels divided by their union. A value closer to 1 indicates better silhouette overlap. |
| Background removal | Same experiment | **Dice coefficient ↑** | **0.974** | Twice the foreground intersection divided by the sum of the predicted and reference foreground areas. A value closer to 1 indicates better overlap. |
| **2D virtual try-on** | Project measurement: 20 paired upper-garment reconstructions | **Structural similarity (SSIM) ↑** | **0.878** | Compares local structure, contrast and brightness between the generated image and the reference photograph. A value closer to 1 indicates greater similarity. |
| 2D virtual try-on | Same experiment | **Learned perceptual image patch similarity (LPIPS) ↓** | **0.143** | Measures perceptual distance using learned image features. Lower values indicate greater perceptual similarity. |
| **FashionSigLIP backbone** | Publisher-reported category-to-product retrieval; average across five datasets | **Precision@1 ↑** | **0.758** | Measures whether the first retrieved product is relevant to the category query. This evaluates retrieval, not image-to-category classification accuracy. |
| FashionSigLIP backbone | Same publisher benchmark | **Mean reciprocal rank (MRR) ↑** | **0.812** | Measures how early the first relevant product appears in the ranked results. A higher value indicates that relevant products generally appear earlier. |
| **Outfit-completion checkpoint** | Checkpoint-author-reported Polyvore benchmark | **Fill-in-the-blank (FITB) accuracy ↑** | **56.39%** | Measures how often the original missing outfit item is selected from four candidates. Random selection has an expected accuracy of 25%. |
| Outfit-completion checkpoint | Same publisher benchmark | **Mean reciprocal rank (MRR) ↑** | **0.7447** | Rewards placing the correct missing item early in the candidate ranking: rank 1 contributes 1, rank 2 contributes 1/2, rank 3 contributes 1/3, and rank 4 contributes 1/4. |

**↑ Higher is better. ↓ Lower is better.** The source of each result must remain visible when this table is used in a report or presentation.

Published references: [Marqo-FashionSigLIP benchmark table](https://huggingface.co/Marqo/marqo-fashionSigLIP#benchmark-results) and [adopted OutfitTransformer-LaBSE checkpoint benchmark table](https://huggingface.co/fkuyumcu/OutfitTransformer-labse#benchmark-results). The latter contains checkpoint-author-reported results, not a reproduction of the original OutfitTransformer paper by this project.

## 2. What the strongest project measurements establish

### Garment background removal

The application's background remover achieved **mean IoU 0.963 and mean Dice 0.974** against supplied foreground masks. An all-foreground mask achieved mean IoU **0.442** on the same 100 images.

This is the strongest positive component finding: the predicted masks closely match the reference garment silhouettes on the selected product-photo sample. It supports the garment-only foreground-preparation stage. It does not establish successful removal of a donor person's body, arms or other clothing.

### Paired virtual try-on reconstruction

FASHN reconstructed 20 reference photographs after the original upper garment was erased. Generated reconstructions were compared with the original photographs. The actual erased inputs were also evaluated as a baseline.

| Evaluation region | Metric | Generated reconstruction | Erased-input baseline |
|---|---|---:|---:|
| Full image | SSIM ↑ | **0.878** | 0.815 |
| Full image | LPIPS ↓ | **0.143** | 0.408 |
| Garment bounding box | SSIM ↑ | **0.654** | 0.567 |
| Garment bounding box | LPIPS ↓ | **0.360** | 0.761 |

Generation improved mean similarity under both full-image and garment-crop measurements. The garment crop reduces the contribution of the preserved background and face, making it important alongside the full-image scores.

This is a **20-case paired reconstruction pilot** using upper garments and masking enabled. It differs from the application's default segmentation-free mode. It does not measure physical fit, sizing accuracy, complete-outfit performance or user satisfaction.

## 3. Application-specific categorization and recommendation audit

These results describe the tested application components. They remain separate from the publisher references above.

| Application evaluation | Sample | Measured result | Interpretation |
|---|---:|---:|---|
| Categorization: top-1 mapped-label agreement ↑ | 500 images | **50.8%** | The first predicted category matched the mapped reference label in 254 cases. |
| Categorization: top-3 mapped-label inclusion ↑ | 500 images | **85.0%** | The mapped reference label appeared among the first three predictions in 425 cases. This is not the accuracy of the final category choice. |
| Categorization: macro F1 ↑ | Same 500 images | **0.551** | Averages the F1 scores of the nine mapped target classes equally. F1 balances precision and recall. |
| CIR outfit completion: FITB accuracy ↑ | 500 questions | **22.2%** | The tested integration selected the original missing item in 111 cases. It did not demonstrate improvement over the 25% random expectation. |
| Outfit compatibility: accuracy ↑ | 1,000 balanced cases | **49.9%** | Measures correct compatible/incompatible decisions. A constant prediction would achieve 50% on this balanced sample. |
| Outfit compatibility: ROC-AUC ↑ | Same 1,000 cases | **0.476** | Measures whether a randomly selected compatible outfit receives a higher score than an incompatible one, with half credit for ties. Chance AUC is 0.500. |

The categorization audit used nine mapped source categories while retaining all 23 app categories as possible predictions. Some dataset groups are broader than the app labels, and raw photographs can contain several garments. These results therefore describe **mapped-label agreement on the selected sample**, not overall application accuracy.

The recommendation experiment evaluates the CIR adapter and its compatibility-scoring adaptation. It does not measure Gemini chatbot quality or personal fashion preferences. The completion-accuracy and compatibility-AUC confidence intervals include their respective chance baselines; the experiments do not establish improvement over chance or statistically worse-than-chance performance.

## 4. Metric definitions and interpretation

| Metric | Definition | Practical interpretation |
|---|---|---|
| Accuracy | Correct decisions divided by all evaluated cases | Meaningful only with the task, reference labels and sample stated. |
| Precision | Correct predictions of a class divided by all predictions of that class | Of the items assigned a category, how many belonged to it? |
| Recall | Correctly recovered examples of a class divided by all labelled examples of that class | Of the items belonging to a category, how many were found? |
| F1 | `2 × precision × recall / (precision + recall)`; zero when both are zero | Balances precision and recall. A high precision value alone can coexist with poor recall. |
| Macro F1 | Unweighted mean of the evaluated classes' F1 scores | Gives each declared target class equal weight. |
| Precision@1 | Relevance of the first retrieved result, averaged over queries | Describes the first result in a retrieval task. |
| MRR | Mean of `1 / rank` for the first relevant result | Rewards relevant results near the top. A query with no relevant retrieved result contributes zero under the usual convention. |
| ROC-AUC | Area under the receiver operating characteristic curve | Measures separation of positive and negative scores across thresholds; 0.500 is chance discrimination. |
| IoU | `foreground intersection / foreground union` | Measures foreground-mask overlap. |
| Dice | `2 × foreground intersection / (predicted foreground area + reference foreground area)` | Measures foreground-mask overlap with a different normalization from IoU. |
| SSIM | Structural similarity between an image and its reference | Describes image similarity, not the percentage of successful try-ons. |
| LPIPS | Learned perceptual distance between an image and its reference | Lower indicates closer perceptual similarity; it is not an accuracy percentage. |

## 5. Reporting boundaries

- **SSIM 0.878 does not mean 87.8% try-on accuracy.**
- **FashionSigLIP Precision@1 0.758 does not mean 75.8% categorization accuracy.** Its published task retrieves products from category text; our categorization task predicts a label from an image.
- **Published FITB accuracy 56.39% does not mean outfit-compatibility accuracy.** The adopted checkpoint card does not report a separate binary compatibility benchmark.
- **Publisher results do not replace project measurements.** Different tasks, features, datasets and protocols prevent a direct substitution.
- **The metrics cannot be averaged into one overall application score.** They evaluate different properties and use different units.

## 6. Suggested presentation statement

> Drape & Drop integrates pretrained fashion components into a wardrobe and virtual try-on workflow. Our strongest measured evidence concerns garment-only background removal and a paired virtual try-on reconstruction pilot. Published FashionSigLIP and outfit-completion benchmarks inform model selection; application-specific categorization and recommendation measurements are reported separately with their limitations.

## 7. Supporting documentation

- [System contributions and presentation summary](PROJECT_RESULTS.md).
- [Full evaluation report, confidence intervals, methods and limitations](EVALUATION.md).
- [Project aggregate metrics and provenance](docs/evaluation-assets/metrics-summary.json).
- [FashionSigLIP publisher results](https://huggingface.co/Marqo/marqo-fashionSigLIP#benchmark-results).
- [Adopted CIR checkpoint author's results](https://huggingface.co/fkuyumcu/OutfitTransformer-labse#benchmark-results).
- [Original SSIM paper](https://ece.uwaterloo.ca/~z70wang/publications/ssim.html).
- [LPIPS implementation and reference](https://github.com/richzhang/PerceptualSimilarity).

This document embeds no dataset photographs or individual annotations. Refer to the detailed evaluation report for dataset attribution, access and redistribution conditions.
