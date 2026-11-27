"""Session-scoped adapter over the existing candidate/ranking/Gemma pipeline."""
import base64
import json
import logging
import tempfile
from datetime import datetime,timezone
from pathlib import Path
from fastapi import HTTPException
from pydantic import BaseModel,ConfigDict,Field
from app.core.config import IMAGES_DIR
from app.contracts.styling import Intent
from app.recommendations.service import recommend
from app.profiles.service import bounded_context
from app.wardrobe.pipeline import process_upload
from app.wardrobe.gates import GateError
from .runtime import models

class GarmentInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    id:str=Field(min_length=1,max_length=60)
    name:str=Field(max_length=200)
    category:str=Field(max_length=100)
    color:str=Field(max_length=200)
    imageBase64:str=Field(max_length=1024*1024)

class StylistInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    ownerScope:str=Field(min_length=1,max_length=64)
    message:str=Field(min_length=1,max_length=4000)
    count:int|None=Field(default=None,ge=1,le=5)
    garments:list[GarmentInput]=Field(max_length=64)
    requiredIds:list[str]=Field(default_factory=list,max_length=4)
    previous:dict=Field(default_factory=dict)
    previousRequiredIds:list[str]=Field(default_factory=list,max_length=4)
    lastIds:list[str]=Field(default_factory=list,max_length=5)
    seen:list[str]=Field(default_factory=list,max_length=100)
    extraContext:str=Field(default="",max_length=16000)
    feedback:dict[str,float]=Field(default_factory=dict,max_length=200)

def run(body:StylistInput):
    tagger,scorer,stylist=models()
    rows=[]
    warnings=[]
    slots={"Tops":"top","Bottoms":"bottom","Dresses":"full","Shoes":"shoes","Outerwear":"outer"}
    with tempfile.TemporaryDirectory(prefix="session-",dir=IMAGES_DIR) as directory:
        temporary=Path(directory)
        for garment in body.garments:
            if garment.category not in slots:continue
            try:
                raw=base64.b64decode(garment.imageBase64,validate=True)
                # Saved images have already passed upload validation. Reuse the
                # confirmed category/colour and avoid repeating BiRefNet per turn.
                import io,hashlib
                from types import SimpleNamespace
                from PIL import Image
                with Image.open(io.BytesIO(raw)) as source:
                    photo=source.convert("RGB")
                if min(photo.size)<128 or photo.width*photo.height>16_000_000:
                    raise ValueError("Invalid saved image")
                tags=tagger.classify(tagger.embed(photo))
                filename=hashlib.sha256(raw).hexdigest()+".jpg"
                photo.save(temporary/filename,"JPEG",quality=90)
                from app.wardrobe.color import extract_colors
                colors=extract_colors(photo.convert("RGBA"))
                # Preserve measured hex/share; use the user's dominant colour label
                # when provided. Do not fabricate RGB measurements for free text.
                if colors and garment.color.strip():
                    colors[0]={**colors[0],"name":garment.color.split(",")[0].strip()}
                result=SimpleNamespace(category=tags["category"],slot=tags["slot"],colors=colors,
                    attributes=tags["attributes"],confidence=tags["confidence"],margin=tags["margin"],
                    image_path=filename,thumb_path=filename)
            except GateError:
                warnings.append("A garment photo could not be analysed; review its source photo.")
                continue
            except (ValueError,TypeError):
                raise HTTPException(422,"Invalid garment image.") from None
            colors=result.colors
            row={"id":garment.id,"user_id":"session","created_at":datetime.now(timezone.utc).isoformat(),
                "image_path":str((temporary/result.image_path).relative_to(IMAGES_DIR)),
                "thumb_path":str((temporary/result.thumb_path).relative_to(IMAGES_DIR)),
                "category":result.category if result.slot==slots[garment.category] else garment.category,
                "slot":slots[garment.category],"colors":json.dumps(colors),
                "pattern":result.attributes["pattern"]["value"],"formality":result.attributes["formality"]["value"],
                "season":result.attributes["season"]["value"],"fit":result.attributes["fit"]["value"],
                "confidence":result.confidence,"margin":result.margin,"source":"user_corrected"}
            rows.append(row)
        available_ids={row["id"] for row in rows}
        if not set(body.requiredIds)<=available_ids:
            return {"status":"needs_clarification","message":"A selected garment photo could not be analysed. Review that photo or remove the selection.",
                "outfits":[],"warnings":warnings,"model_version":stylist.model,
                "state":{"intent":body.previous,"seen":body.seen,"lastIds":body.lastIds}}
        catalog=[{"id":row["id"],"category":row["category"],"slot":row["slot"],"colors":[color["name"] for color in json.loads(row["colors"])]} for row in rows]
        previous=Intent.model_validate(body.previous) if body.previous else Intent()
        previous=previous.model_copy(update={"required_ids":[ident for ident in previous.required_ids if ident not in body.previousRequiredIds]})
        # UI-selected pieces are explicit user intent, not model-inferred IDs.
        # Supply them before interpretation so "this T-shirt" refers to the
        # selection and never needs fabricated quoted evidence.
        if body.requiredIds:
            previous=previous.model_copy(update={"required_ids":list(dict.fromkeys(previous.required_ids+body.requiredIds)),
                "excluded_ids":[ident for ident in previous.excluded_ids if ident not in body.requiredIds]})
        interpreted=stylist.interpret(body.message,previous,catalog,body.lastIds)
        user_intent=interpreted.intent
        if body.requiredIds:
            user_intent=Intent.model_validate({**user_intent.model_dump(),"required_ids":body.requiredIds,
                "excluded_ids":[ident for ident in user_intent.excluded_ids if ident not in body.requiredIds]})
        if body.count is not None:user_intent=user_intent.model_copy(update={"count":body.count})
        if interpreted.action=="chat":
            result={"status":"chat","message":interpreted.reply,"outfits":[],"warnings":warnings,"model_version":stylist.model}
        elif interpreted.needs_clarification:
            result={"status":"needs_clarification","message":interpreted.clarification,"outfits":[],"warnings":warnings,"model_version":stylist.model}
        else:
            context=user_intent.model_copy(update={"preferences":bounded_context(user_intent.preferences+([body.extraContext] if body.extraContext else []))})
            result=recommend(rows,context,scorer,stylist,previous=body.seen,last_ids=body.lastIds,allow_without_shoes=True,feedback=body.feedback).model_dump()
            if result["status"]=="unavailable":
                logging.getLogger("uvicorn.error").warning("Stylist recommendation unavailable: %s",result["message"])
            result["warnings"]+=warnings
            if result["status"]=="recommended" and not any(row["slot"]=="shoes" for row in rows):
                result["warnings"].append("No shoes are available in this wardrobe yet. Add a pair to complete the look.")
        outlines=result.get("outfits",[])
        new_seen=(body.seen+[outfit["id"] for outfit in outlines])[-100:]
        last=[item["id"] for item in outlines[0]["items"]] if outlines else body.lastIds
        result["state"]={"intent":user_intent.model_dump(),"seen":new_seen,"lastIds":last,"uiRequiredIds":body.requiredIds}
        return result
