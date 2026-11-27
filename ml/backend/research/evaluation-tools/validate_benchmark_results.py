"""Reconstruct metrics from raw predictions and check original dataset labels."""
import csv
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'storage/benchmarks/results/v1'


def read_csv(name):
    with (OUT/name).open(encoding='utf-8-sig') as f: return list(csv.DictReader(f))


def main():
    import numpy as np
    from sklearn.metrics import roc_auc_score,balanced_accuracy_score,roc_curve
    p=json.loads((OUT/'protocol.json').read_text())
    c=json.loads((OUT/'classification_metrics.json').read_text())
    r=json.loads((OUT/'recommendation_metrics.json').read_text())
    classifiers=read_csv('classification_predictions.csv')
    expected={q['image_id']:q for q in p['classification']}
    assert len(classifiers)==len(expected)==500
    assert len({q['image_id'] for q in classifiers})==500
    top1=top3=0
    for row in classifiers:
        assert row['label']==expected[row['image_id']]['label']
        assert row['product']==expected[row['image_id']]['product']
        top1+=row['prediction']==row['label']
        top3+=row['label'] in row['top3'].split('|')
    assert top1==c['correct'] and top1/500==c['accuracy'] and top3/500==c['top3_accuracy']
    questions=json.loads((ROOT/'storage/benchmarks/polyvore/disjoint/fill_in_blank_test.json').read_text())
    preds=read_csv('fitb_predictions.csv')
    assert {int(q['source_row']) for q in preds}=={q['source_row'] for q in p['fitb']}
    correct=0;ranks=[]
    for row in preds:
        q=questions[int(row['source_row'])]
        parent=q['question'][0].rsplit('_',1)[0]
        truth=q['answers'].index(parent+'_'+str(q['blank_position']))
        assert int(row['correct_index'])==truth
        values=[float(row[f'score_{i}']) for i in range(4)]
        rank=sum(x>=values[truth] for x in values)
        assert rank==int(row['rank'])
        correct+=rank==1;ranks.append(rank)
    assert correct==r['fitb']['correct'] and correct/500==r['fitb']['accuracy']
    assert math.isclose(sum(1/x for x in ranks)/500,r['fitb']['mrr'])
    cp_preds={}
    for split in ['valid','test']:
        rows=read_csv(f'compatibility_{split}_predictions.csv')
        lines=(ROOT/f'storage/benchmarks/polyvore/disjoint/compatibility_{split}.txt').read_text().splitlines()
        assert {int(q['source_row']) for q in rows}=={q['source_row'] for q in p['compatibility'][split]}
        assert len(rows)==len(p['compatibility'][split])
        for row in rows: assert int(row['label'])==int(lines[int(row['source_row'])].split()[0])
        cp_preds[split]=(np.array([int(q['label']) for q in rows]),np.array([float(q['score']) for q in rows]))
    yv,sv=cp_preds['valid'];yt,st=cp_preds['test']
    fpr,tpr,thresholds=roc_curve(yv,sv,drop_intermediate=False)
    threshold=thresholds[np.argmax(tpr-fpr)]
    assert threshold==r['compatibility']['validation_selected_threshold']
    assert math.isclose(roc_auc_score(yt,st),r['compatibility']['auc'])
    assert math.isclose(balanced_accuracy_score(yt,st>=threshold),r['compatibility']['balanced_accuracy'])
    checks=['All 500 classification labels and product IDs match frozen selection',
            'Classification top-1 and top-3 independently reconstructed',
            'All 500 FITB answers checked against original question/outfit references',
            'FITB accuracy and MRR independently reconstructed',
            'All 1200 compatibility labels checked against original source lines',
            'Compatibility threshold reconstructed from validation only',
            'Test AUC and balanced accuracy independently reconstructed']
    result={'passed':True,'checks':checks}
    (OUT/'result_validation.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
