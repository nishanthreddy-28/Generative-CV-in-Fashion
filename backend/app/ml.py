"""Authenticated bridge to the private inference process. No prototype identities."""
import logging
import hashlib
from typing import Literal
from .ml_contracts import PoseEstimates
from uuid import UUID
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .ml_public import BodyEstimateResponse,SavedBodyResponse
from .foundation import Data
from .onboarding import onboarding_rpc, owner_object, BUCKET, OnboardingRoute
from .wardrobe import storage
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml", tags=["inference"], route_class=OnboardingRoute)

class BodyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    imageId: UUID
    referenceHeightCm: float = Field(ge=80, le=250, allow_inf_nan=False, strict=True)

async def infer(data, operation, content, fields=None):
    settings = data.settings
    if not settings.ml_worker_url or not settings.ml_worker_token:
        logger.warning("Private inference is not configured: %s", operation)
        raise HTTPException(503, "ML worker is not configured.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(165, connect=3), follow_redirects=False) as client:
            response = await client.post(settings.ml_worker_url + "/internal/v1/" + operation,
                headers={"Authorization": "Bearer " + settings.ml_worker_token.get_secret_value()},
                files={"image": ("input.jpg", content, "image/jpeg")}, data=fields or {})
        if response.status_code == 429:
            raise HTTPException(429,"Image processing is busy. Please retry shortly.")
        if response.status_code == 422:
            if operation == "garment-analysis":
                messages = {
                    "Background removal was uncertain. Choose a clearer garment photo.": "Background removal was uncertain. Choose a clearer garment photo.",
                    "This doesn't look like a piece of clothing. Try a photo of a single garment on a plain background.": "The clothing check was uncertain. Choose one garment on a plain background.",
                    "That image is too small to analyse. Try a larger photo.": "That image is too small to analyse. Try a larger photo.",
                    "Unsupported wardrobe category.": "This garment category is not supported for clean wardrobe photos.",
                    "Invalid image.": "The image could not be read. Choose a JPEG, PNG or WebP photo.",
                }
                try: detail=response.json().get("detail", "")
                except (ValueError,AttributeError): detail=""
                safe=messages.get(detail) if isinstance(detail,str) else None
                logger.warning("Garment upload rejected: %s",safe or "unrecognized validation reason")
                if safe: raise HTTPException(422,safe)
            if operation == "body-analysis":
                # Only expose known guidance; never forward arbitrary worker text.
                try:
                    worker_detail=response.json().get("detail", "")
                except (ValueError,AttributeError):
                    worker_detail=""
                guidance=(
                    "The photo must contain exactly one clearly visible person.",
                    "Body landmarks are missing or obscured.",
                    "The person is cropped or too close to the image edge.",
                    "Stand upright without leaning.",
                    "Face the camera squarely with level shoulders and hips.",
                    "Keep both arms straight and down beside the body.",
                    "Stand with both legs straight; seated or bent poses are not accepted.",
                    "Keep your legs uncrossed and both feet level.",
                    "The person outline is unclear.",
                    "Include the entire head and feet with space around them.",
                    "Include your entire head and feet with space around them.",
                    "The waist outline is unclear or includes your arms. Keep arms slightly away from the torso.",
                    "The waist outline varies too much. Use fitted clothing and a plain background.",
                )
                if isinstance(worker_detail,str):
                    for message in guidance:
                        if worker_detail.startswith(message):
                            raise HTTPException(422,message+" Use a clear, front-facing, full-body photo with space around your head and feet.")
            detail = "Use one clear person standing front-facing with head and feet visible." if operation == "body-analysis" else "Use one clear clothing photo."
            raise HTTPException(422, "The photo could not be analysed. " + detail)
        if response.status_code != 200:
            logger.warning("Private inference returned HTTP %s: %s", response.status_code, operation)
            raise HTTPException(503, "ML analysis is temporarily unavailable.")
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (httpx.HTTPError, ValueError):
        logger.warning("Private inference request failed: %s", operation)
        raise HTTPException(503, "ML analysis is temporarily unavailable.") from None

@router.post("/body-analysis",response_model=BodyEstimateResponse)
async def analyse_body(body: BodyRequest, data: Data):
    info = await onboarding_rpc(data, "onboarding_image", {"p_id": str(body.imageId)}, missing=True)
    if not isinstance(info, dict) or info.get("id") != str(body.imageId) or not info.get("present"):
        raise HTTPException(404, "Body photo is unavailable.")
    path = owner_object(data, info.get("object"))
    content = await storage(data, "GET", f"object/{BUCKET}/{path}")
    if info.get("sha256") != hashlib.sha256(content).hexdigest() or info.get("byteSize") != len(content):
        raise HTTPException(503, "Body photo integrity check failed.")
    result = await infer(data, "body-analysis", content, {"reference_height_cm": str(body.referenceHeightCm)})
    # Recheck ownership and availability after inference, including account eligibility.
    from .dependencies import DatabaseEligibility
    await DatabaseEligibility().require_active(data.principal, data)
    current = await onboarding_rpc(data, "onboarding_image", {"p_id": str(body.imageId)}, missing=True)
    if not isinstance(current, dict) or not current.get("present") or current.get("object") != info["object"]:
        raise HTTPException(409, "The source photo changed. Analyse the current photo.")
    from .ml_contracts import BodyAnalysis
    try:
        analysis = BodyAnalysis.model_validate(result)
        if analysis.reference_height_cm != body.referenceHeightCm:
            raise ValueError()
    except ValueError:
        raise HTTPException(503, "ML analysis returned an invalid result.") from None
    from .pose_receipts import issue
    receipt = issue(data.settings,data.principal.user_id,body.imageId,info["sha256"],analysis)
    return {"imageId": str(body.imageId), "analysis": analysis.model_dump(), "receipt": receipt}

class ConfirmBodyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    imageId: UUID
    receipt: str = Field(min_length=1,max_length=16384)
    reviewed: PoseEstimates
    confirmed: Literal[True]

async def available_photo(data, image_id):
    info = await onboarding_rpc(data,"onboarding_image",{"p_id":str(image_id)},missing=True)
    if not isinstance(info,dict) or info.get("id")!=str(image_id) or not info.get("present"):
        raise HTTPException(404,"Body photo is unavailable.")
    owner_object(data,info.get("object"))
    return info

def confirmed_projection(data, image_id, stored, image_hash):
    from .pose_receipts import verify
    proof,original = verify(data.settings,stored["receipt"],data.principal.user_id,image_id,saved=True)
    if proof["imageHash"]!=image_hash:
        raise HTTPException(409,"The source photo changed. Analyse the current photo.")
    reviewed=PoseEstimates.model_validate(stored["reviewed"])
    changed=[name for name in PoseEstimates.model_fields if getattr(reviewed,name)!=getattr(original,name)]
    return {"imageId":str(image_id),"confirmedAt":stored["confirmedAt"],
        "analysis":{**original.model_dump(),**reviewed.model_dump(),"confirmed":True,"edited_fields":changed}}

@router.post("/body-analysis/confirm",response_model=SavedBodyResponse)
async def confirm_body(body: ConfirmBodyRequest,data: Data):
    from .pose_receipts import verify
    from .foundation import rpc
    proof,_=verify(data.settings,body.receipt,data.principal.user_id,body.imageId)
    info=await available_photo(data,body.imageId)
    if proof["imageHash"]!=info.get("sha256"):
        raise HTTPException(409,"The source photo changed. Analyse the current photo.")
    await rpc(data,"save_pose_analysis",{"p_image_id":str(body.imageId),"p_receipt":body.receipt,
        "p_reviewed":body.reviewed.model_dump()},missing_detail="Body photo is unavailable.")
    saved=await read_confirmed_body(body.imageId,data)
    if saved.get("analysis") is None:
        raise HTTPException(409,"The profile changed during confirmation. Analyse the photo again.")
    return saved

@router.get("/body-analysis/{image_id}",response_model=SavedBodyResponse)
async def read_confirmed_body(image_id: UUID,data: Data):
    from .foundation import rpc
    info=await available_photo(data,image_id)
    stored=await rpc(data,"read_pose_analysis",{"p_image_id":str(image_id)})
    if stored is None:
        return {"imageId":str(image_id),"analysis":None}
    try:
        return confirmed_projection(data,image_id,stored,info["sha256"])
    except (KeyError,TypeError,ValueError):
        raise HTTPException(503,"Saved analysis returned an invalid result.") from None
