"""Calibrated front-view observations shared by web and mobile; no sizing claims."""
import math
import numpy as np
from fastapi import HTTPException


def estimate(points, mask, width, height, reference_height_cm):
    def reject(message):
        raise HTTPException(422, message)
    if not math.isfinite(reference_height_cm) or not 80 <= reference_height_cm <= 250:
        reject('Enter your known height between 80 and 250 cm.')
    mask = np.asarray(mask)
    if mask.ndim == 3 and mask.shape[-1] == 1:
        mask = mask[:, :, 0]
    if mask.ndim != 2 or not np.isfinite(mask).all():
        reject('The person outline is unclear. Use a plain background.')
    mh, mw = mask.shape
    rows = np.flatnonzero((mask > .5).sum(axis=1) >= max(2, mw * .02))
    if not len(rows) or rows[0] <= mh * .005 or rows[-1] >= mh * .995 or len(rows) < mh * .5:
        reject('Include your entire head and feet with space around them.')
    xy = lambda i: np.array([points[i].x * width, points[i].y * height])
    shoulders, hips = (xy(11)+xy(12))/2, (xy(23)+xy(24))/2
    shoulder_span = float(np.linalg.norm(xy(11)-xy(12)))
    hip_span = float(np.linalg.norm(xy(23)-xy(24)))
    if hip_span <= 0 or hips[1] <= shoulders[1]:
        reject('Face the camera standing straight.')
    center = int(round(hips[0] / width * mw))
    waist = int(round((shoulders[1] * .35 + hips[1] * .65) / height * mh))
    widths = []
    # A band median is less sensitive than one scanline to folds/mask noise.
    radius = max(2, round(mh * .008))
    for y in range(max(0, waist-radius), min(mh, waist+radius+1)):
        if not 0 <= center < mw or mask[y, center] <= .5:
            continue
        left = right = center
        while left > 0 and mask[y, left-1] > .5: left -= 1
        while right < mw-1 and mask[y, right+1] > .5: right += 1
        # Attached arms make a width unsuitable for silhouette context.
        if left == 0 or right == mw-1 or (right-left+1)/mw*width > shoulder_span*1.25:
            continue
        widths.append(right-left+1)
    if len(widths) < radius+1:
        reject('The waist outline is unclear or includes your arms. Keep arms slightly away from the torso.')
    median = float(np.median(widths))
    if (np.percentile(widths,90)-np.percentile(widths,10))/median > .2:
        reject('The waist outline varies too much. Use fitted clothing and a plain background.')
    scale = reference_height_cm / ((rows[-1]-rows[0]+1)/mh*height)
    values = dict(shoulder_landmark_span_cm=round(shoulder_span*scale,1),
        shoulder_hip_ratio=round(shoulder_span/hip_span,2),
        torso_landmark_length_cm=round(float(np.linalg.norm(hips-shoulders))*scale,1),
        clothed_waist_front_width_cm=round(median/mw*width*scale,1))
    return dict(**values, source='mediapipe_pose_server_v1', confirmed=False,
        reference_height_cm=reference_height_cm, image_width=width, image_height=height,
        landmark_visibility=min(points[i].visibility for i in [0,11,12,23,24,25,26,27,28]),
        original_estimates=values.copy(), edited_fields=[])
