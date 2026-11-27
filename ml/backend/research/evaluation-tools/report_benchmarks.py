"""Build a standalone, evidence-linked report from measured results only."""
import base64
import csv
import hashlib
import html
import json
from pathlib import Path
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'storage/benchmarks/results/v1'


def load(name): return json.loads((OUT/name).read_text(encoding='utf-8'))
def pct(x): return f'{100*x:.1f}%'
def esc(x): return html.escape(str(x))
def ci(values,percent=True):
    return '–'.join(pct(x) if percent else f'{x:.3f}' for x in values)


def table(headers,rows):
    return '<div class="scroll"><table><thead><tr>'+''.join(f'<th>{esc(x)}</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{esc(x)}</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table></div>'


def embedded(path):
    from PIL import Image
    with Image.open(path) as im:
        fmt=im.format.lower()
    mime='image/jpeg' if fmt in ['jpg','jpeg'] else f'image/{fmt}'
    return f'data:{mime};base64,'+base64.b64encode(Path(path).read_bytes()).decode()


def main():
    c=load('classification_metrics.json')
    r=load('recommendation_metrics.json')
    p=load('protocol.json')
    verification=load('parity_verification.json')
    seg=load('segmentation_metrics.json') if (OUT/'segmentation_metrics.json').exists() else None
    fashn=load('fashn_metrics.json') if (OUT/'fashn_metrics.json').exists() else None
    for name,data in [('segmentation',seg),('fashn',fashn)]:
        if data:
            with (OUT/f'{name}_predictions.csv').open('w',newline='',encoding='utf-8-sig') as f:
                writer=csv.DictWriter(f,fieldnames=list(data['predictions'][0]))
                writer.writeheader()
                writer.writerows(data['predictions'])
    fit=r['fitb'];cp=r['compatibility']
    rows=[['Clothing categorization','Top-1 mapped-label accuracy',pct(c['accuracy']),str(c['n']),ci(c['accuracy_ci95'])],
          ['Clothing categorization','Top-3 accuracy',pct(c['top3_accuracy']),str(c['n']),'Secondary metric; not top-1 accuracy'],
          ['Clothing categorization','Macro F1 (9 mapped classes)',f"{c['macro_f1_mapped_classes']:.3f}",str(c['n']),'23 available output categories'],
          ['Outfit completion','Four-choice FITB accuracy',pct(fit['accuracy']),str(fit['n']),ci(fit['accuracy_ci95'])],
          ['Outfit completion','Mean reciprocal rank',f"{fit['mrr']:.3f}",str(fit['n']),'Random expected MRR: 0.521'],
          ['Outfit compatibility','ROC-AUC',f"{cp['auc']:.3f}",str(cp['n']),ci(cp['auc_ci95_case_bootstrap'],False)],
          ['Outfit compatibility','Accuracy',pct(cp['accuracy']),str(cp['n']),ci(cp['accuracy_ci95'])]]
    if seg:
        rows += [['Background removal','Mean IoU',f"{seg['iou']['mean']:.3f}",str(seg['n']),ci(seg['iou']['bootstrap_ci95'],False)],
                 ['Background removal','Mean Dice',f"{seg['dice']['mean']:.3f}",str(seg['n']),ci(seg['dice']['bootstrap_ci95'],False)]]
    if fashn:
        rows += [['FASHN paired pilot','Mean SSIM ↑',f"{fashn['ssim']['mean']:.3f}",str(fashn['n']),ci(fashn['ssim']['bootstrap_ci95'],False)],
                 ['FASHN paired pilot','Mean LPIPS ↓',f"{fashn['lpips']['mean']:.3f}",str(fashn['n']),ci(fashn['lpips']['bootstrap_ci95'],False)]]
    intro=f"""<header><p class="eyebrow">DRAPE & DROP / LABELLED EVALUATION / VERSION 1</p>
    <h1>Model evaluation results</h1><p class="lead">Frozen examples. Dataset ground truth. Saved predictions.</p></header>
    <aside>The current recommendation adapter has not demonstrated an improvement over chance on this sample. FITB: {pct(fit['accuracy'])} versus 25% chance; compatibility AUC: {cp['auc']:.3f} versus 0.500 chance. The confidence intervals include chance. These results do not support a high-accuracy recommendation claim.</aside>
    <h2>Measured results</h2><p>These are component evaluations with different units. They cannot be combined into one overall app accuracy.</p>"""
    body=intro+table(['Component','Metric','Measured result','Cases','95% interval / scope'],rows)
    body+=f"""<h2>Clothing categorization</h2><p><b>{c['correct']} of {c['n']} images were assigned the mapped dataset category.</b> The correct label appeared in the top three choices in {pct(c['top3_accuracy'])} of cases. Top-3 accuracy does not mean the app chose correctly.</p>
    <p>The frozen sample contains 500 distinct products from the <a href="https://huggingface.co/datasets/Marqo/deepfashion-inshop">Marqo DeepFashion In-shop mirror</a>. Nine directory categories have explicit mappings to app labels; ambiguous merged categories such as tees/tanks are excluded. All 23 app categories remain possible predictions. One view per product is selected, preferring a front view. Dataset images are used directly, at the mirror’s 224×224 resolution; this does not evaluate the complete upload/cropping/background-removal workflow.</p>
    <p><b>Scope:</b> external zero-shot label audit, not an official DeepFashion test-split result. The mirror has no official partition column, and the original partition download refused access. There was no local fitting. The publisher says it used this dataset for model evaluation; overlap with upstream model pretraining cannot be independently ruled out. This subset covers {p['audit']['classification_mappable_rows']:,} of {p['audit']['classification_source_rows']:,} source images before sampling. It does not measure all app labels, garment attributes or the non-clothing rejection gate. Some source groups are broader than the app labels (for example pants can include joggers), and catalogue labels can be noisy; interpret this as agreement with the declared mapping rather than independently verified fine-grained garment truth. No label was relabelled after seeing a prediction.</p>"""
    class_rows=[]
    for source_label,label in p['classification_mapping'].items():
        m=c['per_class'][label]
        class_rows.append([source_label,label,int(m['support']),pct(m['precision']),pct(m['recall']),f"{m['f1-score']:.3f}"])
    body+=table(['Source group','Mapped app class','Images','Precision','Recall','F1'],class_rows)
    if (OUT/'classification_confusion.png').exists():
        body+=f'<figure class="plot"><img src="{embedded(OUT/"classification_confusion.png")}" alt="Measured classification confusion matrix"><figcaption>Counts of predicted labels for each mapped dataset category.</figcaption></figure>'
    with (OUT/'classification_predictions.csv').open(encoding='utf-8-sig') as f: predictions=list(csv.DictReader(f))
    errors=[r for r in predictions if r['correct']=='0'][:6]
    body+='<h3>First six errors in frozen source order</h3><p>Examples are selected by source order, not by visual quality. A photo can contain several garments although the dataset names one target product.</p><div class="examples">'
    for row in errors:
        body+=f'<figure><img src="{embedded(OUT/f"images/df-{row["row"]}.img")}" alt="Dataset clothing example"><figcaption>Dataset: {esc(row["label"])}<br>Predicted: {esc(row["prediction"])}</figcaption></figure>'
    body+='</div>'
    body+=f"""<h2>Outfit completion and compatibility</h2><p>These use the <a href="https://huggingface.co/datasets/mvasil/polyvore-outfits">authors’ Polyvore disjoint files</a>. The selected item IDs are absent from the supplied training split; validation and test selections share no item IDs or identical image bytes. The source files contain some overlapping item IDs despite the split name, so those items were excluded before sampling. Exclusion counts and source hashes are saved in the protocol.</p>
    <p><b>Completion:</b> hide one item, score the original four candidate items, and check whether the original answer ranks first. Correct answer positions are derived from the original outfit references, not assumed to be the first choice. {fit['correct']}/{fit['n']} answers were correct; random choice has expected accuracy 25%. MRR rewards a correct answer in second, third or fourth place with 1/2, 1/3 or 1/4.</p>
    <p><b>Compatibility:</b> use the app’s mean leave-one-out cosine to score 500 positive and 500 supplied negative outfits. A threshold of {cp['validation_selected_threshold']:.6f} was chosen only on 200 separate validation cases to maximize balanced accuracy. Test data was not used to choose the threshold. AUC {cp['auc']:.3f} estimates how often a randomly selected positive receives a higher score than a negative, awarding half credit to ties. Test F1 is {cp['f1']:.3f}; average precision is {cp['average_precision']:.3f}. A constant majority prediction gives 50% accuracy on this balanced set.</p>
    <p><b>Scope:</b> the ResNet18/LaBSE/CIR component is evaluated with dataset product text. The app normally constructs text from wardrobe metadata, so these results are not end-to-end personalized recommendation or Gemini chatbot accuracy. Generated negative outfits are benchmark negatives, not an objective judgment that humans would dislike them. Outfit size is limited to 2–8 items; FITB contexts have 1–7 items. The pretrained checkpoint’s exact historical training IDs are not independently available.</p>
    <p><b>Independent scoring check passed:</b> 12 compatibility cases and 12 FITB cases were recomputed through the app’s public scoring methods using the same frozen features. Maximum absolute differences were {verification['compatibility_max_abs_error']:.2g} and {verification['fitb_max_abs_error']:.2g}. This checks the runner’s scoring mathematics; it does not prove model accuracy.</p>
    <p>The <a href="https://huggingface.co/fkuyumcu/OutfitTransformer-labse">checkpoint’s example feature extraction</a> uses an image resize and raw LaBSE pooler output that differ from the app’s standard ResNet transform and normalized SentenceTransformer output. This is a plausible issue to investigate on validation data; it has not been established as the cause by these tests. No model or application preprocessing was changed to improve the reported scores.</p>"""
    matrix=cp['confusion_matrix_labels_0_1']
    body+=table(['Actual / predicted','Incompatible (0)','Compatible (1)'],[['Incompatible (0)',*matrix[0]],['Compatible (1)',*matrix[1]]])
    if (OUT/'recommendation_results.png').exists():
        body+=f'<figure class="plot"><img src="{embedded(OUT/"recommendation_results.png")}" alt="Measured FITB accuracy and compatibility ROC"><figcaption>Left: measured completion accuracy with its interval. Right: test-set compatibility ROC.</figcaption></figure>'
    if seg:
        body+=f"""<h2>Background removal</h2><p>The actual CPU BiRefNet-lite background remover processed {seg['n']} official VITON-HD garment-only product images. Its alpha mask and the supplied cloth mask were each thresholded at 128. Mean intersection-over-union (IoU) is <b>{seg['iou']['mean']:.3f}</b>; mean Dice is <b>{seg['dice']['mean']:.3f}</b>. An all-foreground mask has mean IoU {seg['all_foreground_baseline_iou']['mean']:.3f} on the same examples.</p>
        <p>IoU = intersection / union of predicted and labelled foreground pixels. Dice = twice the intersection / sum of foreground areas. Values nearer 1 indicate closer mask overlap. These measure garment-only foreground removal, not successful removal of a donor person, hair, arms or other garments.</p>"""
        body+='<h3>Three lowest-IoU cases</h3><div class="paired">'
        for row in sorted(seg['predictions'],key=lambda q:q['iou'])[:3]:
            iid=row['id']
            body+='<figure><div class="triplet">'
            for label,path in [('Garment image',ROOT/f'storage/benchmarks/viton-hd/cloth/{iid}.jpg'),('Dataset mask',ROOT/f'storage/benchmarks/viton-hd/cloth-mask/{iid}.jpg'),('BiRefNet alpha',OUT/f'segmentation_masks/{iid}.png')]:
                body+=f'<div><img src="{embedded(path)}" alt="{esc(label)}"><small>{label}</small></div>'
            body+=f'</div><figcaption>{esc(iid)} · IoU {row["iou"]:.3f}</figcaption></figure>'
        body+='</div>'
    else:
        body+='<h2>Background removal</h2><p>Not yet measured. No IoU or Dice claim is supported until the labelled mask run finishes.</p>'
    if fashn:
        body+=f"""<h2>2D try-on: paired reconstruction pilot</h2><p>20 cases were sampled before generation from the frozen official <a href="https://github.com/shadow2496/VITON-HD">VITON-HD</a> test subset. Each reference person wears the target top in the ground-truth photograph. <a href="https://github.com/fashn-AI/fashn-vton-1.5">FASHN</a> first erases the original top using its own masking path, then reconstructs the person with that product image. This avoids scoring a direct copy of the already-dressed input as a successful try-on. The actual agnostic intermediate was saved and scored as a baseline.</p>
        <p>Settings: 50 steps, seed 42, flat-lay garment, tops, masking enabled (segmentation_free=False), guidance 1.5. This evaluates a paired reconstruction setting, which differs from the app’s default segmentation-free generation. Outputs are Lanczos resized to the reference 768×1024 for scoring. It covers upper garments on this dataset, not trousers or whole outfits.</p>"""
        body+=table(['Measure','FASHN output','Agnostic-input baseline','Direction'],[
            ['SSIM',f"{fashn['ssim']['mean']:.3f}",f"{fashn['agnostic_baseline_ssim']['mean']:.3f}",'Higher is better'],
            ['LPIPS (AlexNet v0.1)',f"{fashn['lpips']['mean']:.3f}",f"{fashn['agnostic_baseline_lpips']['mean']:.3f}",'Lower is better'],
            ['Garment-crop SSIM',f"{fashn['garment_crop_ssim']['mean']:.3f}",f"{fashn['garment_crop_baseline_ssim']['mean']:.3f}",'Higher is better'],
            ['Garment-crop LPIPS',f"{fashn['garment_crop_lpips']['mean']:.3f}",f"{fashn['garment_crop_baseline_lpips']['mean']:.3f}",'Lower is better']])
        body+='<p>SSIM compares local structure; <a href="https://github.com/richzhang/PerceptualSimilarity">LPIPS</a> compares learned perceptual features. Neither is an accuracy percentage, sizing measurement, identity guarantee or proof that an unpaired garment transfer is correct. Full-image background preservation can raise similarity, so the report includes the agnostic baseline and visual examples. Twenty cases are a pilot, not a full benchmark.</p>'
        body+='<p>Garment-crop scores use the tight bounding box of the supplied person-parsing labels 5, 6 and 7 (upper garments), following the <a href="https://github.com/shadow2496/VITON-HD/blob/main/datasets.py">dataset authors’ label grouping</a>. The same box is used for reference, output and baseline, without resizing the crop. This reduces background influence. These additional metric settings were frozen before numerical image scoring.</p>'
        if (OUT/'tryon_mask_audit.json').exists():
            audit=load('tryon_mask_audit.json')
            body+=f'<p>The mask audit estimates that {pct(audit["mean_coverage"])} of labelled upper-garment pixels were erased on average; minimum case coverage was {pct(audit["minimum_coverage"])}. This uses the exact grey fill colour in the captured agnostic input; original grey pixels can slightly overestimate coverage. Every selected case is retained. Incomplete erasure can inflate paired similarity, so inspect this audit alongside the results.</p>'
        body+='<div class="paired">'
        for row in fashn['predictions'][:3]:
            iid=row['id']
            body+='<figure><div class="triplet">'
            for label,path in [('Erased input',OUT/f'fashn_paired/{iid}-agnostic.png'),('FASHN output',OUT/f'fashn_paired/{iid}.png'),('Ground truth',ROOT/f'storage/benchmarks/viton-hd/image/{iid}.jpg')]:
                body+=f'<div><img src="{embedded(path)}" alt="{esc(label)}"><small>{label}</small></div>'
            body+=f'</div><figcaption>{esc(iid)} · SSIM {row["ssim"]:.3f} · LPIPS {row["lpips"]:.3f}</figcaption></figure>'
        body+='</div>'
    else:
        body+='<h2>2D try-on</h2><p>Not yet measured. A fixed paired reconstruction pilot is prepared; there is no try-on accuracy percentage to report.</p>'
    body+='''<h2>How to explain this to a professor</h2><p>A dataset supplies the answers independently of our app. We freeze the examples, run the unchanged components, compare predictions to those answers, and calculate the metric. We do not treat a confidence score, a successful API request or an attractive sample image as predictive accuracy.</p>
    <p>Accuracy = correct top predictions / test cases. Precision asks how many predictions of a class were correct. Recall asks how many labelled examples of that class were found. F1 balances precision and recall; macro F1 averages the declared classes equally. An accuracy confidence interval reflects sampling uncertainty under its assumptions; it does not mean that 95% of individual predictions are correct.</p>
    <p>The compatibility threshold is selected on validation data and then locked. After seeing these test results, any change to prompts, features, model or threshold needs a separate untouched test set for a new final claim. The seed and sample IDs are preserved so poor results cannot be removed silently.</p>
    <h2>What remains unmeasured</h2><p>Personal taste and personalized ranking require held-out user relevance judgements, such as labelled wardrobe candidate sets for Precision@K, Recall@K or NDCG@K. Gemini chatbot quality requires an independently labelled task suite and authorized API access. Clothing attributes and non-clothing rejection need their own labels. A paired try-on pilot cannot establish unpaired garment fidelity, identity preservation or physical fit. No such values are invented here.</p>
    <h2>Reproducibility and limits</h2><p>Frozen seed: 20261122. Dataset revisions, selected row IDs, mappings, exclusions, source SHA-256 hashes, model hashes, settings and package versions accompany this report. Accuracy intervals use Wilson 95%; AUC and mean-image metrics use seeded bootstrap intervals. Polyvore items can recur across cases, so case-level intervals may be optimistic. These are sample/component results; they are not population-level guarantees or paper-benchmark reproductions. For pretrained components, complete upstream training corpora are not available to independently verify whether every evaluation image was unseen.</p>
    <p>Academic datasets and examples are for this research evaluation; consult the original terms before including them in a commercial application. VITON-HD is CC BY-NC 4.0. Cite Vasileva et al. (ECCV 2018), Liu et al. (CVPR 2016), Choi et al. (CVPR 2021), and Zhang et al. (CVPR 2018) when using the corresponding dataset or metric.</p>
    <h3>Evidence files</h3><ul>'''
    for name in ['protocol.json','protocol.sha256','classification_predictions.csv','classification_confusion.csv',
                 'classification_metrics.json','classifier_provenance.json','fitb_predictions.csv',
                 'compatibility_test_predictions.csv','compatibility_valid_predictions.csv',
                 'recommendation_metrics.json','parity_verification.json','segmentation_metrics.json','fashn_metrics.json',
                 'segmentation_predictions.csv','fashn_predictions.csv','tryon_mask_audit.json']:
        if (OUT/name).exists(): body+=f'<li><a href="{name}">{name}</a></li>'
    body+='</ul>'
    style='''body{margin:0;background:#f6f3ee;color:#25212c;font:16px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:42px 32px 72px}header{border-bottom:3px solid #594275;padding-bottom:24px}h1{font:600 44px/1.15 Georgia,serif;margin:10px 0}h2{font:600 27px/1.25 Georgia,serif;margin-top:38px}h3{font-size:18px}.eyebrow{font-size:12px;letter-spacing:2px;color:#594275}.lead{font-size:20px}aside{background:#fff0dd;border-left:5px solid #a65c19;padding:18px 24px;margin:28px 0}a{color:#513571}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;background:white}td,th{padding:12px 14px;text-align:left;border-bottom:1px solid #e6e0e9}th{background:#ede6f2}.examples{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0;background:white;padding:12px;border:1px solid #ded7e4}figure img{width:100%;height:220px;object-fit:contain}figcaption{font-size:13px;line-height:1.5;margin-top:8px}.triplet{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.triplet img{height:auto;max-height:480px}.triplet small{display:block;text-align:center}.paired{display:grid;gap:20px}code{font-size:13px;overflow-wrap:anywhere}@media(max-width:700px){main{padding:24px 16px}h1{font-size:32px}.examples{grid-template-columns:repeat(2,1fr)}}@media print{body{background:white}main{padding:0;max-width:none}h2,figure,tr{break-inside:avoid}a{color:inherit}aside{border:1px solid #aaa}.scroll{overflow:visible}}'''
    style+='.plot{margin-top:20px}.plot img{height:auto;max-height:none}'
    (OUT/'report.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drape & Drop — Labelled Evaluation</title><style>'+style+'</style><main>'+body+'</main></html>',encoding='utf-8')
    export={'classification':c,'recommendation':r,'background_removal':seg,'tryon_pilot':fashn,'scoring_parity':verification}
    (OUT/'measured_metrics.json').write_text(json.dumps(export,indent=2),encoding='utf-8')
    with (OUT/'summary.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.writer(f);writer.writerow(['Component','Metric','Measured result','Cases','95% interval / scope']);writer.writerows(rows)
    instructions='''Run from drapedrop-phase2/backend. No application model/config changes are needed.

Frozen-data integrity and metric sanity checks:
../.venv/Scripts/python.exe scripts/benchmark_models.py check
../.venv/Scripts/python.exe scripts/validate_benchmark_results.py

Classifier (existing CUDA environment; uses main packages only as import fallback):
storage/tryon-env/Scripts/python.exe scripts/benchmark_models.py classify --device cuda --shared-packages ../.venv/Lib/site-packages

Recommendation component:
storage/tryon-env/Scripts/python.exe scripts/benchmark_models.py recommend --device cuda --shared-packages ../.venv/Lib/site-packages

Scoring parity with actual app APIs:
../.venv/Scripts/python.exe scripts/verify_benchmark_parity.py

Background removal (CPU, resumable):
../.venv/Scripts/python.exe scripts/benchmark_image_quality.py segment

FASHN paired pilot (CUDA, resumable):
storage/tryon-env/Scripts/python.exe scripts/benchmark_image_quality.py generate

Paired image metrics (CPU, LPIPS package and cached official AlexNet required):
../.venv/Scripts/python.exe scripts/benchmark_image_quality.py score
../.venv/Scripts/python.exe scripts/audit_tryon_masks.py

Figures and report:
../.venv/Scripts/python.exe scripts/plot_benchmarks.py
../.venv/Scripts/python.exe scripts/report_benchmarks.py

Do not modify protocol.json or resample after inspecting results. For a changed model, choose a separate untouched final test set. Dataset files are pinned in protocol.json. The bundle includes predictions and scripts but not the full datasets/model weights. The large downloads are already stored under storage/benchmarks.
'''
    (OUT/'REPRODUCE.txt').write_text(instructions,encoding='utf-8')
    with zipfile.ZipFile(OUT/'benchmark_evidence.zip','w',zipfile.ZIP_DEFLATED) as bundle:
        for path in OUT.iterdir():
            if path.is_file() and not path.name.startswith('report-preview') and path.suffix in ['.json','.csv','.html','.txt','.sha256','.png','.svg','.py']:
                bundle.write(path,path.name)
        for name in ['benchmark_models.py','prepare_viton_benchmark.py','benchmark_image_quality.py','verify_benchmark_parity.py','report_benchmarks.py','validate_benchmark_results.py','plot_benchmarks.py','audit_tryon_masks.py']:
            bundle.write(ROOT/'scripts'/name,'scripts/'+name)
    print('Created',OUT/'report.html')


if __name__=='__main__':main()
