"""Owned garment analysis; original photos and user metadata remain unchanged."""
import logging
from pydantic import ValidationError
from typing import Literal
from uuid import UUID
from fastapi import APIRouter,HTTPException,Request
from .ml_contracts import GarmentAnalysis
from .ml_public import GarmentAnalysisResponse
from .foundation import Data,rpc
from .ml import infer
router=APIRouter(prefix="/ml/garments",tags=["inference"])

@router.post("/{source}/{garment_id}/analysis",response_model=GarmentAnalysisResponse)
async def analyse_garment(source:Literal["wardrobe","catalog"],garment_id:UUID,data:Data):
    from .wardrobe import garment_image as wardrobe_image
    from .catalog import read_image as catalog_image
    image=await (wardrobe_image(garment_id,data) if source=="wardrobe" else catalog_image(garment_id,data))
    result=await infer(data,"garment-analysis",image.body,{"owner_scope":str(data.principal.user_id)})
    # Reject results for garments removed or deactivated during CPU work.
    await rpc(data,"read_wardrobe" if source=="wardrobe" else "read_catalog",{"p_id":str(garment_id)},
        missing_detail="Garment is unavailable.")
    import hashlib
    current=await (wardrobe_image(garment_id,data) if source=="wardrobe" else catalog_image(garment_id,data))
    if hashlib.sha256(current.body).digest()!=hashlib.sha256(image.body).digest():
        raise HTTPException(409,"The garment photo changed. Analyse the current photo.")
    from .ml_contracts import GarmentAnalysis
    try:
        parsed=GarmentAnalysis.model_validate(result)
    except ValueError:
        raise HTTPException(503,"Garment analysis returned an invalid result.") from None
    return {"source":source,"garmentId":str(garment_id),"analysis":parsed.model_dump()}

class UploadAnalysis(GarmentAnalysis):
    preparation:dict|None=None

@router.post("/analyse-upload",response_model=UploadAnalysis)
async def analyse_upload(request:Request,data:Data,category:Literal["Tops","Bottoms","Outerwear","Dresses","Shoes"]|None=None):
    from .onboarding import parse_photo
    from .dependencies import DatabaseEligibility
    try:
        photo=await parse_photo(request)
    except HTTPException as error:
        logging.getLogger(__name__).warning("Garment photo parsing rejected: HTTP %s reason=%s",error.status_code, error.detail if isinstance(error.detail,str) and error.detail in {
            "Choose one body photo.","Choose a valid body photo.","Invalid photo upload form.",
            "Choose a single JPEG, PNG or WebP image.","The image could not be decoded safely.",
            "Image dimensions exceed the upload limit.","Photo exceeds the 10 MB upload limit."
        } else "image validation")
        raise
    result=await infer(data,"garment-analysis",photo,{"owner_scope":str(data.principal.user_id),"prepare_closet":"true",**({"closet_category":category} if category else {})})
    await DatabaseEligibility().require_active(data.principal,data)
    try:
        import time,hashlib,jwt,anyio
        from .prepared_garments import Prepared,signing_key,normalize_image
        preparation=result.pop("preparation",None)
        analysis=GarmentAnalysis.model_validate(result)
        if preparation:
            prepared_category=preparation.pop("category")
            expected=category or {"top":"Tops","outer":"Outerwear","bottom":"Bottoms","full":"Dresses","shoes":"Shoes"}[analysis.slot]
            if prepared_category!=expected:raise ValueError("Preparation category mismatch")
            ready=Prepared.model_validate(preparation)
            now=int(time.time())
            receipt=jwt.encode({"sub":str(data.principal.user_id),"aud":"prepared-garment-v1","iat":now,"exp":now+1800,
                "sourceHash":hashlib.sha256(photo).hexdigest(),
                "category":prepared_category,"result":ready.model_dump()},signing_key(data.settings),algorithm="HS256")
            return {**analysis.model_dump(),"preparation":{"receipt":receipt,"category":prepared_category,
                "cutoutBase64":ready.cutoutBase64,"warnings":ready.warnings}}
        return analysis.model_dump()
    except ValueError as error:
        logging.getLogger(__name__).warning("Garment result schema mismatch: %s", [(item["loc"], item["type"]) for item in error.errors(include_input=False)] if isinstance(error,ValidationError) else type(error).__name__)
        raise HTTPException(503,"The garment analysis was incomplete. Please try again.") from None
