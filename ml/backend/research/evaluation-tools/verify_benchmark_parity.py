"""Independently compare saved benchmark scores to public app methods."""
import csv
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def main():
    import numpy as np
    import torch
    from app.phase3.scorer import PretrainedScorer
    out=ROOT/'storage/benchmarks/results/v1'
    protocol=json.loads((out/'protocol.json').read_text())
    with np.load(out/'cir_features.npz',allow_pickle=False) as data:
        ids=data['ids'].tolist()
        v=torch.from_numpy(data['visual'].copy())
        t=torch.from_numpy(data['text'].copy())
    lookup={iid:i for i,iid in enumerate(ids)}
    scorer=PretrainedScorer()
    scorer.load()
    # Feed identical frozen item features through actual app APIs. This tests
    # evaluation mathematics independently without touching wardrobe records.
    scorer.features=lambda item:(v[lookup[item['id']]],t[lookup[item['id']]])
    rows=list(csv.DictReader((out/'compatibility_test_predictions.csv').open(encoding='utf-8-sig')))
    reference={int(r['source_row']):float(r['score']) for r in rows}
    cp=protocol['compatibility']['test'][:12]
    actual=scorer.score([[{'id':iid} for iid in q['items']] for q in cp])
    cp_error=max(abs(a-reference[q['source_row']]) for a,q in zip(actual,cp))
    rows=list(csv.DictReader((out/'fitb_predictions.csv').open(encoding='utf-8-sig')))
    ref={int(r['source_row']):[float(r[f'score_{i}']) for i in range(4)] for r in rows}
    errors=[]
    with torch.inference_mode():
        for q in protocol['fitb'][:12]:
            scores=scorer.retrieve_scores([[{'id':iid} for iid in q['context']]],
                                         [{'id':iid} for iid in q['answers']])[0]
            errors.extend(abs(a-b) for a,b in zip(scores,ref[q['source_row']]))
    error=max(errors)
    assert cp_error<1e-6 and error<1e-6,(cp_error,error)
    result={'passed':True,'compatibility_cases':12,'fitb_cases':12,
            'compatibility_max_abs_error':cp_error,'fitb_max_abs_error':error,
            'test':'Saved runner outputs vs actual PretrainedScorer.score and retrieve_scores using identical frozen features',
            'scope':'Validates scoring parity; not evidence of model accuracy or metadata equivalence'}
    (out/'parity_verification.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2),flush=True)


if __name__=='__main__':main()
