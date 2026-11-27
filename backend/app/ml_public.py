"""Public ML response contracts, kept separate from prototype model outputs."""
from datetime import datetime
from typing import Annotated,Literal
from uuid import UUID
from pydantic import BaseModel,ConfigDict,Field
from .ml_contracts import BodyAnalysis,PoseEstimates,GarmentAnalysis

class ReviewedBodyAnalysis(BodyAnalysis):
    confirmed:Literal[True]
    edited_fields:list[str]=Field(default_factory=list,max_length=4)
class BodyEstimateResponse(BaseModel):
    imageId:UUID
    analysis:BodyAnalysis
    receipt:str
class SavedBodyResponse(BaseModel):
    imageId:UUID
    analysis:ReviewedBodyAnalysis|None
    confirmedAt:datetime|None=None
class GarmentAnalysisResponse(BaseModel):
    source:Literal["wardrobe","catalog"]
    garmentId:UUID
    analysis:GarmentAnalysis

class StyledPiece(BaseModel):
    source:Literal["wardrobe","catalog"]
    garmentId:UUID
    name:str
    category:str
    color:str
class StyledLook(BaseModel):
    id:str
    items:list[StyledPiece]=Field(min_length=2,max_length=5)
    rankingScore:float=Field(allow_inf_nan=False)
    explanation:str
    fitNotes:list[str]
class StylistResult(BaseModel):
    id:UUID
    conversationId:UUID
    kind:Literal["stylist"]="stylist"
    engineVersion:Literal["gemma-cir-v1"]
    status:Literal["recommended","no_match","needs_clarification","unavailable","chat"]
    message:str
    userMessage:str
    outfits:list[StyledLook]
    warnings:list[str]
    modelVersion:str|None
    bookmarked:bool=False
    feedback:Literal["like","dislike"]|None=None
    createdAt:datetime|None=None
class SessionTryOnResult(BaseModel):
    id:UUID
    conversationId:UUID|None=None
    kind:Literal["tryon"]="tryon"
    provider:Literal["weshop","idm"]
    attempts:list[dict]
    warnings:list[str]
    source:Literal["wardrobe","catalog"]
    garmentId:UUID
    imageUrl:str=Field(pattern=r"^/ml/history/[0-9a-f-]{36}/image$")
    consentVersion:Literal["photo-consent-v1"]
    bookmarked:bool=False
    feedback:Literal["like","dislike"]|None=None
    createdAt:datetime|None=None
class SessionHistoryPage(BaseModel):
    items:list[Annotated[StylistResult|SessionTryOnResult,Field(discriminator="kind")]]
    nextCursor:None=None
