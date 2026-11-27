"""Download the official pose model once; no photo uploads."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from app.pose.validation import MODEL

def main():
    MODEL.parent.mkdir(parents=True,exist_ok=True)
    response=httpx.get('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',timeout=90)
    response.raise_for_status()
    if len(response.content)<1000000: raise RuntimeError('Incomplete pose model download')
    temporary=MODEL.with_suffix('.download')
    temporary.write_bytes(response.content)
    temporary.replace(MODEL)
    print('Pose validation model installed.')

if __name__=='__main__': main()
