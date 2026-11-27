"""Reproducible, labelled component benchmarks; never writes to the app DB.

Run from backend with the main environment (CPU), or the try-on environment
with --shared-packages ../.venv/Lib/site-packages (CUDA). The latter only
extends this process's import search path; it does not alter either environment.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import math
import os
from pathlib import Path
import random
import re
import sys
import time
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
DATA = ROOT / "storage/benchmarks"
OUT = DATA / "results/v1"
SEED = 20261122
MAPPING = {"denim": "Jeans", "dresses": "Dress", "shorts": "Shorts",
           "sweaters": "Sweater", "pants": "Trousers", "skirts": "Skirt",
           "cardigans": "Cardigan", "leggings": "Leggings", "rompers": "Jumpsuit"}
PINS = {"polyvore": "22cc0c748c293a598e1df561a76abe96273cb76a",
        "deepfashion": "886fbe26ceac0b2bc8195d606e3fde641e7157f8"}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    temp = Path(path).with_suffix(".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    temp.replace(path)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_csv(path, rows):
    with Path(path).open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def wilson(k, n):
    if not n:
        raise ValueError("An accuracy denominator cannot be zero")
    z = 1.959963984540054
    p = k / n
    den = 1 + z*z/n
    center = (p + z*z/(2*n))/den
    delta = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))/den
    return [max(0., center-delta), min(1., center+delta)]


def frozen_protocol():
    path = OUT / "protocol.json"
    expected = (OUT / "protocol.sha256").read_text().strip()
    if digest(path) != expected:
        raise ValueError("Frozen protocol changed; use a new version directory")
    p = read_json(path)
    for relative, expected_hash in p["source_hashes"].items():
        if digest(ROOT / relative) != expected_hash:
            raise ValueError(f"Source file changed: {relative}")
    return p


def prepare():
    import pyarrow.parquet as pq
    from PIL import Image

    if (OUT / "protocol.json").exists():
        frozen_protocol()
        print("Existing frozen protocol verified; no resampling.", flush=True)
        return
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    pv = DATA / "polyvore"
    outfits = {s: read_json(pv / "disjoint" / f"{s}.json") for s in ("train", "valid", "test")}
    item_sets = {s: {str(i["item_id"]) for o in rows for i in o["items"]} for s, rows in outfits.items()}
    lookup = {}
    for rows in outfits.values():
        for outfit in rows:
            for item in outfit["items"]:
                ref = f"{outfit['set_id']}_{item['index']}"
                iid = str(item["item_id"])
                if ref in lookup and lookup[ref] != iid:
                    raise ValueError("Ambiguous Polyvore item reference")
                lookup[ref] = iid
    safe = {"test": item_sets["test"] - item_sets["train"] - item_sets["valid"],
            "valid": item_sets["valid"] - item_sets["train"] - item_sets["test"]}
    fitb = []
    excluded_fitb = Counter()
    source_questions = read_json(pv / "disjoint/fill_in_blank_test.json")
    for row_no, q in enumerate(source_questions):
        parent = q["question"][0].rsplit("_", 1)[0]
        assert all(r.rsplit("_", 1)[0] == parent for r in q["question"])
        answer = f"{parent}_{q['blank_position']}"
        assert q["answers"].count(answer) == 1 and len(q["answers"]) == 4
        ids = [lookup[r] for r in q["question"] + q["answers"]]
        if not 1 <= len(q["question"]) <= 7:
            excluded_fitb["context_plus_answer_exceeds_8"] += 1
            continue
        if not set(ids) <= safe["test"]:
            excluded_fitb["not_strictly_test_only_item_ids"] += 1
            continue
        if len(set(lookup[r] for r in q["answers"])) != 4:
            excluded_fitb["duplicate_candidate_item_id"] += 1
            continue
        fitb.append({"source_row": row_no, "parent": parent,
                     "context": [lookup[r] for r in q["question"]],
                     "answers": [lookup[r] for r in q["answers"]],
                     "correct": q["answers"].index(answer)})
    eligible_fitb = len(fitb)
    fitb = sorted(rng.sample(fitb, 500), key=lambda r: r["source_row"])
    cp = {}
    cp_audit = {}
    for split, count in (("valid", 200), ("test", 1000)):
        by_label = {0: [], 1: []}
        excluded = Counter()
        lines = (pv / f"disjoint/compatibility_{split}.txt").read_text().splitlines()
        for row_no, line in enumerate(lines):
            label, *refs = line.split()
            ids = [lookup[r] for r in refs]
            if not 2 <= len(ids) <= 8:
                excluded["cardinality_outside_2_to_8"] += 1
                continue
            if not set(ids) <= safe[split]:
                excluded["not_strictly_split_only_item_ids"] += 1
                continue
            if len(set(ids)) != len(ids):
                excluded["duplicate_outfit_item_id"] += 1
                continue
            by_label[int(label)].append({"source_row": row_no, "label": int(label), "items": ids})
        cp[split] = sorted(sum((rng.sample(by_label[label], count//2) for label in (0, 1)), []),
                           key=lambda r: r["source_row"])
        cp_audit[split] = {"source_cases": len(lines), "eligible_by_label": {str(k): len(v) for k, v in by_label.items()},
                           "exclusions": dict(excluded)}

    # External zero-shot label audit: no local fitting. The mirror has no
    # official split annotations, so it must NOT be called an official test split.
    df_path = DATA / "deepfashion-inshop/data/data-00000-of-00001.parquet"
    metadata = pq.read_table(df_path, columns=["item_ID", "category1", "category2", "category3"]).to_pylist()
    products = defaultdict(lambda: defaultdict(list))
    for index, row in enumerate(metadata):
        if row["category2"] not in MAPPING:
            continue
        match = re.search(r"id_\d+", row["item_ID"])
        if not match:
            raise ValueError("Missing product grouping identifier")
        # Include department/category to avoid assuming IDs are globally unique.
        product = f"{row['category1']}:{row['category2']}:{match.group()}"
        products[row["category2"]][product].append((index, row))
    classification = []
    for class_no, (source_label, label) in enumerate(MAPPING.items()):
        n = 500 // len(MAPPING) + int(class_no < 500 % len(MAPPING))
        chosen = rng.sample(sorted(products[source_label]), n)
        for product in chosen:
            views = products[source_label][product]
            front = [v for v in views if v[1]["item_ID"].endswith("front")]
            index, row = rng.choice(front or views)
            classification.append({"row": index, "image_id": row["item_ID"], "product": product,
                                   "source_label": source_label, "label": label})
    classification.sort(key=lambda r: r["row"])
    assert len({r["product"] for r in classification}) == 500
    assert len(fitb) == 500 and len(cp["test"]) == 1000 and len(cp["valid"]) == 200

    required = {s: set() for s in ("test", "valid")}
    for q in fitb:
        required["test"].update(q["context"] + q["answers"])
    for split in cp:
        for case in cp[split]:
            required[split].update(case["items"])
    assert not required["test"] & required["valid"]
    image_dir = OUT / "images"
    image_dir.mkdir(exist_ok=True)
    image_hashes = {}
    split_hashes = {}
    for split, filename in (("test", "test"), ("valid", "validation")):
        found = set()
        hashes = set()
        parquet = pq.ParquetFile(pv / f"data/disjoint/{filename}.parquet")
        for batch in parquet.iter_batches(batch_size=512):
            for row in batch.to_pylist():
                iid = row["item_id"]
                if iid not in required[split]:
                    continue
                if iid in found:
                    raise ValueError("Duplicate image ID in image table")
                data = row["image"]["bytes"]
                with Image.open(io.BytesIO(data)) as image:
                    image.verify()
                path = image_dir / f"pv-{iid}.img"
                path.write_bytes(data)
                h = hashlib.sha256(data).hexdigest()
                image_hashes[path.name] = h
                hashes.add(h)
                found.add(iid)
        if found != required[split]:
            raise ValueError(f"Missing {len(required[split]-found)} benchmark images")
        split_hashes[split] = hashes
    if split_hashes["test"] & split_hashes["valid"]:
        raise ValueError("Identical image bytes appear in selected validation and test cases")
    selected_rows = {r["row"]: r for r in classification}
    for batch_start, batch in enumerate(pq.ParquetFile(df_path).iter_batches(batch_size=512, columns=["image"])):
        for offset, row in enumerate(batch.to_pylist()):
            index = batch_start*512 + offset
            if index not in selected_rows:
                continue
            path = image_dir / f"df-{index}.img"
            data = row["image"]["bytes"]
            with Image.open(io.BytesIO(data)) as image:
                image.verify()
            path.write_bytes(data)
            image_hashes[path.name] = hashlib.sha256(data).hexdigest()
    if len({image_hashes[f"df-{r['row']}.img"] for r in classification}) != 500:
        raise ValueError("Duplicate image content in classification selection")
    sources = list((pv / "disjoint").glob("*")) + [pv / "polyvore_item_metadata.json", df_path,
              pv / "data/disjoint/test.parquet", pv / "data/disjoint/validation.parquet",
              ROOT / "app/phase2/tagger.py", ROOT / "app/phase2/taxonomy.py",
              ROOT / "app/phase3/scorer.py", ROOT / "storage/phase3_model/manifest.json"]
    protocol = {"version": 1, "seed": SEED, "created_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "dataset_revisions": PINS, "classification_mapping": MAPPING,
                "classification_scope": "External zero-shot label audit, nine mapped categories, 23 possible outputs. Mirror has no official split column. No local training; upstream pretraining overlap cannot be verified.",
                "classification_selection": "500 distinct products; approximately equal classes; prefer a front view; select before inference; exclude ambiguous compound categories.",
                "recommendation_scope": "CIR component, official four-choice FITB and compatibility labels. Dataset item text replaces app's wardrobe metadata text; not end-to-end personalized or chatbot accuracy.",
                "compatibility_rule": "App's mean leave-one-out cosine; validation-only threshold maximizes balanced accuracy; ties use first ROC threshold; no test tuning.",
                "confidence_intervals": "Wilson 95% for accuracy; stratified case bootstrap (1000 resamples) for AUC. Items recur across outfits, so case-IID intervals may be optimistic; no population/user guarantee.",
                "fitb": fitb, "compatibility": cp, "classification": classification,
                "audit": {"split_item_overlap": {"train_test": len(item_sets['train'] & item_sets['test']),
                    "valid_test": len(item_sets['valid'] & item_sets['test']), "train_valid": len(item_sets['train'] & item_sets['valid'])},
                    "fitb_source_cases": len(source_questions), "fitb_eligible": eligible_fitb,
                    "fitb_exclusions": dict(excluded_fitb), "compatibility": cp_audit,
                    "selected_unique_images": {k: len(v) for k, v in required.items()},
                    "selected_test_validation_byte_hash_overlap": 0,
                    "classification_source_rows": len(metadata),
                    "classification_mappable_rows": sum(len(vs) for group in products.values() for vs in group.values()),
                    "classification_eligible_products": {k: len(v) for k,v in products.items()}},
                "source_hashes": {str(p.relative_to(ROOT)).replace('\\','/'): digest(p) for p in sources},
                "image_hashes": image_hashes}
    write_json(OUT / "protocol.json", protocol)
    (OUT / "protocol.sha256").write_text(digest(OUT / "protocol.json")+"\n")
    print("Protocol frozen", protocol["audit"], flush=True)


def verify_images(p):
    for name, expected in p["image_hashes"].items():
        if digest(OUT / "images" / name) != expected:
            raise ValueError(f"Benchmark image changed: {name}")


def runtime_info(torch):
    import importlib.metadata as md
    names = ["torch", "torchvision", "open_clip_torch", "sentence-transformers", "transformers", "numpy", "scikit-learn", "pyarrow"]
    return {"python": sys.version, "packages": {n: md.version(n) for n in names},
            "torch_runtime": torch.__version__, "cuda": torch.version.cuda,
            "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
            "protocol_sha256": digest(OUT / "protocol.json"), "runner_sha256": digest(__file__)}


def classify(device):
    import numpy as np
    import torch
    import torch.nn.functional as F
    from PIL import Image
    from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
    from app.phase2.tagger import Tagger
    from app.phase2.taxonomy import LABELS
    p = frozen_protocol()
    verify_images(p)
    provenance_path = OUT / 'classifier_provenance.json'
    if provenance_path.exists():
        provenance = read_json(provenance_path)
        hub = Path(os.getenv('HF_HUB_CACHE',str(Path.home()/'.cache/huggingface/hub')))
        cache = hub/'models--Marqo--marqo-fashionSigLIP'
        if (cache/'refs/main').read_text().strip() != provenance['cached_revision']:
            raise ValueError('Classifier cache revision differs from measured run')
        for name, expected in provenance['cached_files_sha256'].items():
            if digest(cache/'snapshots'/provenance['cached_revision']/name) != expected:
                raise ValueError('Classifier model hash mismatch')
    torch.set_num_threads(4)
    print("Loading actual application tagger", flush=True)
    tagger = Tagger(device=device)
    predictions = []
    started = time.perf_counter()
    with torch.inference_mode():
        for start in range(0, len(p["classification"]), 16):
            cases = p["classification"][start:start+16]
            images = []
            for case in cases:
                with Image.open(OUT / f"images/df-{case['row']}.img") as im:
                    images.append(tagger.preprocess(im.convert("RGB")))
            emb = F.normalize(tagger.model.encode_image(torch.stack(images).to(device)).float(), dim=-1)
            for case, feature in zip(cases, emb):
                result = tagger.classify(feature)
                top3 = [result["category"]]+[a["category"] for a in result["alternatives"]]
                predictions.append({**case, "prediction": result["category"], "top3": "|".join(top3),
                                    "correct": int(result["category"] == case["label"]),
                                    "top3_correct": int(case["label"] in top3)})
            print(f"Classification {len(predictions)}/{len(p['classification'])}", flush=True)
    true, pred = [r["label"] for r in predictions], [r["prediction"] for r in predictions]
    target_labels = list(MAPPING.values())
    correct = sum(r["correct"] for r in predictions)
    summary = {"n": len(predictions), "correct": correct, "accuracy": accuracy_score(true,pred),
               "accuracy_ci95": wilson(correct,len(predictions)),
               "top3_accuracy": np.mean([r["top3_correct"] for r in predictions]).item(),
               "macro_f1_mapped_classes": f1_score(true,pred,labels=target_labels,average="macro",zero_division=0),
               "per_class": classification_report(true,pred,labels=target_labels,output_dict=True,zero_division=0),
               "constant_majority_baseline": max(Counter(true).values())/len(true),
               "seconds_excluding_model_load": time.perf_counter()-started,
               "scope": p["classification_scope"], "runtime": runtime_info(torch)}
    matrix = confusion_matrix(true,pred,labels=LABELS)
    write_csv(OUT / "classification_predictions.csv", predictions)
    write_csv(OUT / "classification_confusion.csv", [{"true_label": label, **dict(zip(LABELS,map(int,row)))} for label,row in zip(LABELS,matrix)])
    write_json(OUT / "classification_metrics.json", summary)
    print(json.dumps({k:v for k,v in summary.items() if k not in ['per_class','runtime']},indent=2),flush=True)


def recommendation(device):
    import numpy as np
    import torch
    import torch.nn.functional as F
    from PIL import Image
    from app.phase3.scorer import PretrainedScorer
    from sklearn.metrics import (accuracy_score, average_precision_score, balanced_accuracy_score,
                                 confusion_matrix, f1_score, roc_auc_score, roc_curve)
    p = frozen_protocol()
    verify_images(p)
    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    scorer = PretrainedScorer()
    print("Loading actual CIR / ResNet18 / LaBSE assets", flush=True)
    scorer.load()
    scorer.visual.to(device)
    scorer.text.to(device)
    ids = sorted({r[3:-4] for r in p["image_hashes"] if r.startswith('pv-')})
    index = {iid:i for i,iid in enumerate(ids)}
    metadata = read_json(DATA / "polyvore/polyvore_item_metadata.json")
    descriptions = []
    for iid in ids:
        item = metadata[iid]
        # Product text only: never use compatibility labels or answer positions.
        text = ' '.join(str(item.get(k) or '').replace('_',' ') for k in ['title','url_name','description'])
        descriptions.append(' '.join(text.split()) or str(item.get('semantic_category') or 'clothing item'))
    feature_path = OUT / "cir_features.npz"
    signature = hashlib.sha256((digest(OUT/'protocol.json')+scorer.fingerprint+json.dumps(descriptions)).encode()).hexdigest()
    started = time.perf_counter()
    if feature_path.exists():
        with np.load(feature_path,allow_pickle=False) as data:
            if str(data['signature']) != signature or data['ids'].tolist() != ids:
                raise ValueError("Feature cache provenance mismatch")
            visual = torch.from_numpy(data['visual'].copy())
            text = torch.from_numpy(data['text'].copy())
        print("Verified cached features",len(ids),flush=True)
    else:
        features=[]
        with torch.inference_mode():
            for start in range(0,len(ids),32):
                tensors=[]
                for iid in ids[start:start+32]:
                    with Image.open(OUT/f"images/pv-{iid}.img") as im:
                        rgba=im.convert('RGBA')
                        rgb=Image.new('RGB',im.size,'white')
                        rgb.paste(rgba,mask=rgba.getchannel('A'))
                        tensors.append(scorer.transform(rgb))
                features.append(scorer.visual(torch.stack(tensors).to(device)).cpu())
                if start % 320 == 0:
                    print(f"Visual features {min(start+32,len(ids))}/{len(ids)}",flush=True)
            visual=torch.cat(features)
            print("Encoding product descriptions",flush=True)
            text=scorer.text.encode(descriptions,batch_size=32,convert_to_tensor=True,
                                    normalize_embeddings=True,show_progress_bar=True).cpu()
        np.savez(feature_path,visual=visual.numpy(),text=text.numpy(),ids=np.array(ids),signature=np.array(signature))
    assert visual.shape==(len(ids),512) and text.shape==(len(ids),768)
    assert torch.isfinite(visual).all() and torch.isfinite(text).all()
    scorer.visual.to('cpu')
    scorer.text.to('cpu')
    torch.cuda.empty_cache() if torch.cuda.is_available() else None
    fitb=[]
    with torch.inference_mode():
        targets=F.normalize(scorer.net.encode_items(visual,text),dim=-1)
        for length in sorted({len(q['context']) for q in p['fitb']}):
            cases=[q for q in p['fitb'] if len(q['context'])==length]
            for start in range(0,len(cases),64):
                batch=cases[start:start+64]
                contexts=torch.tensor([[index[i] for i in q['context']] for q in batch])
                answers=torch.tensor([[index[i] for i in q['answers']] for q in batch])
                query=scorer.net(visual[contexts],text[contexts])
                scores=(query[:,None,:]*targets[answers]).sum(-1).numpy()
                for q,values in zip(batch,scores):
                    # A numeric tie with the true item is awarded its pessimistic rank.
                    correct=q['correct']
                    rank=1+int(np.sum(values>=values[correct]))-1
                    fitb.append({'source_row':q['source_row'],'parent':q['parent'],'correct_index':correct,
                                 'prediction':int(np.argmax(values)),'rank':rank,
                                 **{f'score_{i}':float(s) for i,s in enumerate(values)}})
        cp_predictions={}
        for split,cases in p['compatibility'].items():
            rows=[]
            for length in sorted({len(q['items']) for q in cases}):
                grouped=[q for q in cases if len(q['items'])==length]
                for start in range(0,len(grouped),64):
                    batch=grouped[start:start+64]
                    indices=torch.tensor([[index[i] for i in q['items']] for q in batch])
                    v,t=visual[indices],text[indices]
                    sums=torch.zeros(len(batch))
                    for missing in range(length):
                        keep=[i for i in range(length) if i!=missing]
                        query=scorer.net(v[:,keep],t[:,keep])
                        target=F.normalize(scorer.net.encode_items(v[:,missing],t[:,missing]),dim=-1)
                        sums+=(query*target).sum(-1)
                    for case,value in zip(batch,(sums/length).tolist()):
                        rows.append({'source_row':case['source_row'],'label':case['label'],'score':value})
            cp_predictions[split]=sorted(rows,key=lambda r:r['source_row'])
    fitb.sort(key=lambda r:r['source_row'])
    ranks=np.array([r['rank'] for r in fitb])
    # Strict rank 1 handles ties conservatively; also record the argmax decision.
    fitb_summary={'n':len(fitb),'correct':int((ranks==1).sum()),'accuracy':float((ranks==1).mean()),
                  'accuracy_ci95':wilson(int((ranks==1).sum()),len(fitb)),
                  'mrr':float((1/ranks).mean()),'recall_at_2':float((ranks<=2).mean()),
                  'recall_at_3':float((ranks<=3).mean()),
                  'ndcg_at_3':float(np.where(ranks<=3,1/np.log2(ranks+1),0).mean()),
                  'random_chance_accuracy':0.25,'random_chance_mrr':sum(1/i for i in range(1,5))/4}
    validation=cp_predictions['valid']
    yv=np.array([r['label'] for r in validation]); sv=np.array([r['score'] for r in validation])
    fpr,tpr,thresholds=roc_curve(yv,sv,drop_intermediate=False)
    threshold=float(thresholds[np.argmax(tpr-fpr)])
    assert math.isfinite(threshold), 'Cannot choose an infinite compatibility threshold'
    test=cp_predictions['test']
    y=np.array([r['label'] for r in test]); scores=np.array([r['score'] for r in test])
    assert np.isfinite(scores).all()
    predictions=(scores>=threshold).astype(int)
    for row,pred in zip(test,predictions):
        row['prediction']=int(pred)
    rng=np.random.default_rng(SEED)
    neg=np.flatnonzero(y==0);pos=np.flatnonzero(y==1)
    aucs=[]
    for _ in range(1000):
        ix=np.concatenate([rng.choice(neg,len(neg),replace=True),rng.choice(pos,len(pos),replace=True)])
        aucs.append(roc_auc_score(y[ix],scores[ix]))
    cp_summary={'n':len(test),'positive':int(y.sum()),'negative':int((y==0).sum()),
                'auc':float(roc_auc_score(y,scores)),'auc_ci95_case_bootstrap':np.quantile(aucs,[.025,.975]).tolist(),
                'average_precision':float(average_precision_score(y,scores)),
                'accuracy':float(accuracy_score(y,predictions)),
                'accuracy_ci95':wilson(int((y==predictions).sum()),len(y)),
                'balanced_accuracy':float(balanced_accuracy_score(y,predictions)),
                'f1':float(f1_score(y,predictions)),
                'confusion_matrix_labels_0_1':confusion_matrix(y,predictions,labels=[0,1]).tolist(),
                'validation_n':len(validation),'validation_selected_threshold':threshold,
                'validation_balanced_accuracy':float(balanced_accuracy_score(yv,sv>=threshold)),
                'constant_majority_baseline':.5,'chance_auc':.5}
    write_csv(OUT/'fitb_predictions.csv',fitb)
    for split,rows in cp_predictions.items():
        write_csv(OUT/f'compatibility_{split}_predictions.csv',rows)
    summary={'fitb':fitb_summary,'compatibility':cp_summary,'scope':p['recommendation_scope'],
             'text_protocol':'title + url_name + description; collapse whitespace; semantic category fallback only for empty text; LaBSE normalized as app',
             'model_manifest':read_json(ROOT/'storage/phase3_model/manifest.json'),
             'seconds_excluding_model_load':time.perf_counter()-started,'runtime':runtime_info(torch)}
    write_json(OUT/'recommendation_metrics.json',summary)
    print(json.dumps({k:summary[k] for k in ['fitb','compatibility','seconds_excluding_model_load']},indent=2),flush=True)


def check():
    import numpy as np
    from sklearn.metrics import roc_auc_score
    lo,hi=wilson(86,100)
    assert lo<.86<hi and .77<lo<.79 and .91<hi<.93
    assert roc_auc_score([0,0,1,1],[.1,.2,.8,.9])==1
    assert roc_auc_score([0,0,1,1],[.9,.8,.2,.1])==0
    assert 1+int(np.sum(np.array([.1,.8,.2,.3])>=.8))-1==1
    assert 1+int(np.sum(np.array([.8,.8,.2,.3])>=.8))-1==2
    if (OUT/'protocol.json').exists():
        p=frozen_protocol()
        verify_images(p)
        assert len(p['fitb'])==500
        assert len({r['product'] for r in p['classification']})==500
        for split in ['valid','test']:
            assert Counter(r['label'] for r in p['compatibility'][split])=={0:len(p['compatibility'][split])//2,1:len(p['compatibility'][split])//2}
    print('Metric sanity checks and frozen-data checks passed.',flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','classify','recommend','check'])
    parser.add_argument('--device',choices=['cpu','cuda'],default='cpu')
    parser.add_argument('--shared-packages',type=Path)
    args=parser.parse_args()
    if args.shared_packages:
        sys.path.append(str(args.shared_packages.resolve()))
    # Restrict inference to already downloaded model assets.
    if args.command in ['classify','recommend']:
        os.environ['HF_HUB_OFFLINE']='1'
        os.environ['TRANSFORMERS_OFFLINE']='1'
    if args.command=='prepare': prepare()
    elif args.command=='classify': classify(args.device)
    elif args.command=='recommend': recommendation(args.device)
    else: check()


if __name__=='__main__':
    main()
