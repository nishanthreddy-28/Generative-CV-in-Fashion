# Drape & Drop — System Contributions and Results

**Date:** 23 November 2026  
**Purpose:** Project presentation and report summary  
**Detailed methods and audit:** [Model Evaluation Report](EVALUATION.md)

## Project contribution

Drape & Drop integrates pretrained fashion models into a wardrobe and virtual try-on workflow. The engineering contribution is the connection between garment uploads, wardrobe metadata, clothing selection, garment preparation, recommendation components and generated photo previews.

The project uses existing model backbones. Its contribution should be assessed through the implemented workflow, integration decisions, component evaluation and documented limitations. The evidence does not establish a newly trained foundation model or a state-of-the-art recommendation system.

Two kinds of evidence are presented below:

- **Project-measured results:** outputs evaluated in this implementation against dataset labels or reference images.
- **Publisher-reported references:** published performance of an adopted backbone or checkpoint under the publisher's own protocol. These inform model selection and are not substituted for application measurements.

## 1. Garment background removal

**Function.** Prepare garment-only photographs by separating the clothing foreground from its background.

**Implemented component.** BiRefNet-lite through the application's background-removal function.

| Project-measured metric | Result | Evaluation sample |
|---|---:|---|
| Mean foreground IoU | **0.963** | 100 garment-only product photographs |
| Mean foreground Dice | **0.974** | Same 100 photographs |
| All-foreground baseline IoU | 0.442 | Same 100 photographs |

IoU and Dice measure overlap between the predicted foreground mask and the supplied reference mask. The observed overlap supports the usefulness of this preparation component on the tested product-photo sample.

**Presentation wording:** “Our garment background-removal component achieved mean IoU 0.963 and Dice 0.974 against reference masks on 100 product images.”

This is the strongest positive component result. It does not establish extraction quality for clothing worn by a donor person; that is a different segmentation problem.

## 2. Image-based virtual try-on

**Function.** Generate a photo preview of a person wearing a selected garment.

**Implemented component.** Local FASHN VTON inference integrated with the garment-selection and preview workflow.

| Project-measured metric | Generated reconstruction | Erased-input baseline |
|---|---:|---:|
| Full-image SSIM, higher is better | **0.878** | 0.815 |
| Full-image LPIPS, lower is better | **0.143** | 0.408 |
| Garment-crop SSIM | **0.654** | 0.567 |
| Garment-crop LPIPS | **0.360** | 0.761 |

These results come from **20 paired upper-garment reconstruction cases**. The original top was erased before generation, and the generated reconstruction was compared with the original reference photograph. The garment-crop scores reduce the influence of the preserved face and background.

**Presentation wording:** “A 20-case paired reconstruction pilot produced mean SSIM 0.878 and LPIPS 0.143, with improved mean similarity over the erased-input baseline.”

These are image-similarity measurements, not accuracy percentages. The pilot used masking enabled, which differs from the default segmentation-free application mode. It does not establish physical fit, performance on complete outfits or general success across arbitrary person–garment combinations.

## 3. Fashion understanding and categorization backbone

**Function.** Convert garment images into fashion-specific representations and rank the application's category prompts.

**Adopted backbone.** Marqo-FashionSigLIP.

The [model publisher's benchmark table](https://huggingface.co/Marqo/marqo-fashionSigLIP#benchmark-results) reports:

| Publisher-reported retrieval task | Precision@1 | MRR |
|---|---:|---:|
| Category-to-product, averaged across five datasets | **0.758** | **0.812** |
| Subcategory-to-product, averaged across four datasets | **0.767** | **0.811** |

These results support discussing the choice of a fashion-specific embedding backbone. The publisher retrieves products from category text; our category predictor instead starts from an image. Consequently, the published numbers are not our clothing-classification accuracy.

**Presentation wording:** “We adopted FashionSigLIP as a fashion-specific representation backbone. Marqo reports category-to-product retrieval Precision@1 of 0.758 across five datasets; application categorization was evaluated separately.”

Our separate audit recorded **50.8% top-1 mapped-label agreement** and **85.0% top-3 inclusion** on 500 raw catalogue photographs from nine mapped categories. Mapping ambiguity and multiple garments per image limit interpretation. These figures remain part of the project evaluation; the external retrieval benchmark does not replace them.

## 4. Outfit completion and compatibility

**Function.** Retrieve complementary garments and score candidate outfits within the recommendation workflow.

**Adopted checkpoint.** The OutfitTransformer-LaBSE CIR implementation published by `fkuyumcu`, with the application's compatibility-scoring adaptation.

The [checkpoint author's model card](https://huggingface.co/fkuyumcu/OutfitTransformer-labse#benchmark-results) reports:

| Publisher-reported completion metric | Result |
|---|---:|
| Four-choice fill-in-the-blank accuracy | **56.39%** |
| Mean reciprocal rank | **0.7447** |
| Recall@2 | **80.86%** |

These are author-reported complementary-item retrieval results on Polyvore. They are not results from the original OutfitTransformer paper, not a reproduction by this project, and not binary outfit-compatibility accuracy. The card does not provide a separate compatibility AUC or classification-accuracy benchmark.

**Presentation wording:** “We integrated a pretrained complementary-item retrieval checkpoint whose author reports 56.39% FITB accuracy on Polyvore. We evaluated our integration separately and identified a gap requiring further validation.”

Our integration achieved **22.2% FITB accuracy** on 500 questions. The compatibility adaptation achieved **49.9% accuracy and AUC 0.476** on 1,000 balanced cases. These measurements did not demonstrate improvement over chance. Differences in feature extraction are a candidate for investigation, not an established explanation or a reason to substitute the publisher's scores.

## Recommended presentation emphasis

1. **Demonstrate the implemented workflow:** garment input, wardrobe selection, preparation and a generated preview.
2. **Lead with the strongest project evidence:** foreground IoU/Dice, followed by the try-on reconstruction pilot and its baseline comparison.
3. **Explain model selection:** cite FashionSigLIP and CIR publisher results with the task and attribution visible beside each number.
4. **Describe integration findings:** retain the local categorization and recommendation results and explain the next validation work.

An appropriate closing statement is:

> Drape & Drop demonstrates an integrated fashion application using pretrained components. Our experiments provide positive evidence for garment-only background removal and a paired virtual try-on pilot. Published backbone benchmarks inform model selection, while our application-specific evaluation identifies categorization and recommendation limitations requiring further work.

The contribution is the implemented system and its measured behaviour. A claim of novel model training, superior recommendation accuracy or universal try-on reliability would require additional evidence.

## Evidence and references

- [Full evaluation, uncertainty intervals, protocols and limitations](EVALUATION.md).
- [Project aggregate metrics and provenance](docs/evaluation-assets/metrics-summary.json).
- [FashionSigLIP publisher benchmarks](https://huggingface.co/Marqo/marqo-fashionSigLIP#benchmark-results).
- [Adopted CIR checkpoint author's benchmarks](https://huggingface.co/fkuyumcu/OutfitTransformer-labse#benchmark-results).
- [FASHN VTON implementation](https://github.com/fashn-AI/fashn-vton-1.5).
- [BiRefNet implementation](https://github.com/ZhengPeng7/BiRefNet).

This summary embeds no dataset photographs or individual annotations. Dataset access and redistribution terms are documented in the detailed evaluation report.
