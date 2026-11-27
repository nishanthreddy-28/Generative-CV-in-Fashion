"""Reviewed pose observations shared by mobile and web; not validated anthropometry."""
from typing import Literal
from pydantic import Field, model_validator
from app.contracts.styling import StrictModel


class PoseEstimates(StrictModel):
    shoulder_hip_ratio: float = Field(gt=.3, lt=4)
    shoulder_landmark_span_cm: float = Field(gt=5, lt=110)
    clothed_waist_front_width_cm: float = Field(gt=5, lt=150)
    torso_landmark_length_cm: float = Field(gt=5, lt=120)


class BodyAnalysis(PoseEstimates):
    source: Literal['mediapipe_pose_browser_v1', 'mediapipe_pose_server_v1'] = 'mediapipe_pose_browser_v1'
    confirmed: Literal[True]
    image_width: int = Field(ge=128, le=12000)
    image_height: int = Field(ge=128, le=12000)
    landmark_visibility: float = Field(ge=.6, le=1)
    reference_height_cm: float = Field(ge=80, le=250)
    original_estimates: PoseEstimates | None = None
    edited_fields: list[str] = Field(default_factory=list, max_length=4)

    @model_validator(mode='after')
    def mark_corrections(self):
        self.edited_fields = ([name for name in PoseEstimates.model_fields
            if getattr(self,name) != getattr(self.original_estimates,name)] if self.original_estimates else [])
        return self


def context(value):
    return ('User-confirmed single-photo pose estimates, calibrated to user-entered height '
            f'{value.reference_height_cm:g} cm: shoulder landmark span {value.shoulder_landmark_span_cm:g} cm; '
            f'clothed waist FRONT width {value.clothed_waist_front_width_cm:g} cm; '
            f'torso landmark length {value.torso_landmark_length_cm:g} cm; '
            f'shoulder/hip landmark-span ratio {value.shoulder_hip_ratio:g}. '
            + ('User corrected these photo estimates: ' + ', '.join(value.edited_fields) + '. ' if value.edited_fields else '') +
            'These are unvalidated front-view observations, not waist/chest/hip circumferences. '
            'Never convert them to clothing sizes, body-type labels or fit guarantees. '
            'Use only as approximate silhouette context; manual tape measurements take precedence.')
