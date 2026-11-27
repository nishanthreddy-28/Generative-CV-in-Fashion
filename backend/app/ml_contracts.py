"""Application projection of the existing MediaPipe output; widths are not girths."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class PoseEstimates(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    shoulder_hip_ratio: float = Field(gt=.3, lt=4)
    shoulder_landmark_span_cm: float = Field(gt=5, lt=110)
    clothed_waist_front_width_cm: float = Field(gt=5, lt=150)
    torso_landmark_length_cm: float = Field(gt=5, lt=120)

class BodyAnalysis(PoseEstimates):
    source: Literal["mediapipe_pose_server_v1"]
    confirmed: Literal[False]
    reference_height_cm: float = Field(ge=80, le=250)
    image_width: int = Field(ge=128, le=12000)
    image_height: int = Field(ge=128, le=12000)
    landmark_visibility: float = Field(ge=.6, le=1)
    original_estimates: PoseEstimates
    edited_fields: list[str] = Field(max_length=0)

class GarmentColor(BaseModel):
    model_config=ConfigDict(extra="forbid",allow_inf_nan=False)
    name:str=Field(max_length=100)
    hex:str=Field(pattern=r"^#[0-9a-fA-F]{6}$")
    share:float=Field(ge=0,le=1)

class GarmentAttributes(BaseModel):
    model_config=ConfigDict(extra="forbid")
    pattern:Literal["solid","striped","checked","floral","graphic","patterned"]
    formality:Literal["casual","smart_casual","formal","athletic"]
    season:Literal["warm","mild","cold"]
    fit:Literal["slim","regular","oversized"]

class GarmentAnalysis(BaseModel):
    model_config=ConfigDict(extra="forbid",allow_inf_nan=False)
    category:str=Field(min_length=1,max_length=100)
    slot:Literal["top","outer","bottom","full","shoes"]
    attributes:GarmentAttributes
    colors:list[GarmentColor]=Field(max_length=3)
    confidence:float=Field(ge=0,le=1)
    margin:float
    alternatives:list[dict]=Field(max_length=23)
    route:Literal["auto","review","ask"]
    warnings:list[str]=Field(max_length=20)
    cutoutUsed:bool
    cutoutMime:Literal["image/webp"]
    cutoutBase64:str=Field(max_length=4*1024*1024)
    model:Literal["Marqo/marqo-fashionSigLIP"]
