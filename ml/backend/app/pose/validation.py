"""Fail-closed person-photo gate, shared by studio and cloud generation."""
import math
import threading
import numpy as np
from fastapi import HTTPException
from app.core.config import STORAGE_DIR

MODEL = STORAGE_DIR / 'pose/pose_landmarker_lite.task'
LOCK = threading.Lock()
_detector = None
GUIDANCE = 'Upload one person standing straight, facing the camera, with head, arms and feet visible, arms down and legs straight. Seated, sideways, leaning, crossed-limb and cropped poses are not accepted.'


def check_pose(poses, width, height):
    def reject(reason):
        raise HTTPException(422, reason + ' ' + GUIDANCE)
    if len(poses) != 1:
        reject('The photo must contain exactly one clearly visible person.')
    p = poses[0]
    required = [0, 2, 5, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
    if len(p) != 33 or any(not all(math.isfinite(getattr(p[i], k, float('nan'))) for k in ('x','y','z')) or (p[i].visibility or 0) < .6 for i in required):
        reject('Body landmarks are missing or obscured.')
    if any(not .01 < p[i].x < .99 or not .01 < p[i].y < .99 for i in required):
        reject('The person is cropped or too close to the image edge.')
    point = lambda i: np.array([p[i].x * width, p[i].y * height])
    shoulder = (point(11)+point(12))/2
    hip = (point(23)+point(24))/2
    span = np.linalg.norm(point(11)-point(12))
    hipspan = np.linalg.norm(point(23)-point(24))
    torso = hip[1]-shoulder[1]
    if span < width*.08 or hipspan < width*.04 or torso <= 0 or abs(hip[0]-shoulder[0]) > torso*.15:
        reject('Stand upright without leaning.')
    if (abs(p[11].y-p[12].y)*height > span*.12 or abs(p[23].y-p[24].y)*height > hipspan*.15
            or abs(p[11].z-p[12].z) > span/width*.5 or abs(p[23].z-p[24].z) > hipspan/width*.5
            or not min(p[11].x,p[12].x) < p[0].x < max(p[11].x,p[12].x)):
        reject('Face the camera squarely with level shoulders and hips.')
    def angle(a,b,c):
        u,v=point(a)-point(b),point(c)-point(b)
        return math.degrees(math.acos(float(np.clip(np.dot(u,v)/max(np.linalg.norm(u)*np.linalg.norm(v),1e-8),-1,1))))
    for s,e,w,h,k,a in [(11,13,15,23,25,27),(12,14,16,24,26,28)]:
        if not p[s].y < p[e].y < p[w].y or abs(point(w)[0]-point(s)[0]) > span*.65 or angle(s,e,w) < 155:
            reject('Keep both arms straight and down beside the body.')
        if not p[h].y < p[k].y < p[a].y or angle(h,k,a) < 160 or angle(s,h,k) < 160:
            reject('Stand with both legs straight; seated or bent poses are not accepted.')
    if (p[11].x-p[12].x)*(p[27].x-p[28].x) <= 0 or abs(p[27].y-p[28].y)*height > torso*.15:
        reject('Keep your legs uncrossed and both feet level.')
    return {'validated': True, 'policy': 'standing_front_v1'}


def detect_person(image):
    global _detector
    with LOCK:
        try:
            import mediapipe as mp
            if _detector is None:
                if not MODEL.is_file():
                    raise RuntimeError('missing pose model')
                options = mp.tasks.vision.PoseLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)), num_poses=2, output_segmentation_masks=True)
                _detector = mp.tasks.vision.PoseLandmarker.create_from_options(options)
            rgb = np.ascontiguousarray(image.convert('RGB'))
            result = _detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        except Exception as exc:
            raise HTTPException(503, 'Person-photo validation is unavailable. Install MediaPipe and run scripts/setup_pose_validation.py before generating previews.') from exc
        # Copy native result memory while holding the detector lock.
        poses = result.pose_landmarks
        masks = [m.numpy_view().copy() for m in result.segmentation_masks or []]
    verdict = check_pose(poses, image.width, image.height)
    if not result.segmentation_masks:
        raise HTTPException(422, 'The person outline is unclear. ' + GUIDANCE)
    mask=masks[0].squeeze(axis=-1) if masks[0].ndim == 3 else masks[0]
    rows=np.flatnonzero((mask > .5).sum(axis=1) >= max(2,image.width*.02))
    if not len(rows) or rows[0] <= image.height*.005 or rows[-1] >= image.height*.995:
        raise HTTPException(422, 'Include the entire head and feet with space around them. ' + GUIDANCE)
    return verdict, poses[0], mask


def validate_person(image):
    return detect_person(image)[0]


def analyze_person(image, reference_height_cm):
    from app.pose.measurements import estimate
    _, landmarks, mask = detect_person(image)
    return estimate(landmarks, mask, image.width, image.height, reference_height_cm)
