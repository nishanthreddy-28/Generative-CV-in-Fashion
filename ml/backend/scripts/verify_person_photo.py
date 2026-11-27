"""Real, local person-photo gate smoke check; no external inference calls."""
import argparse
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from PIL import Image
from fastapi import HTTPException
from app.pose.validation import validate_person

parser=argparse.ArgumentParser()
parser.add_argument('--accept',nargs='*',default=[])
parser.add_argument('--reject',nargs='*',default=[])
args=parser.parse_args()
for expected,paths in [(True,args.accept),(False,args.reject)]:
    for path in paths:
        try:
            with Image.open(path) as image: validate_person(image)
            actual=True; reason='accepted'
        except HTTPException as exc:
            if exc.status_code != 422: raise
            actual=False;reason=exc.detail
        print(f'{path}: {reason}',flush=True)
        assert actual == expected, f'Unexpected validation result for {path}'
print('PASS: real person-photo validation expectations.')
