"""Private CPU inference API. Launch separately from the application API."""
import hmac
import io
import logging
import os
import threading
from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app):
    from .runtime import warm
    if os.environ.get("DRAPE_ML_WARM_MODELS") == "1":
        threading.Thread(target=warm,daemon=True,name="inference-warmup").start()
    yield
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps
logger = logging.getLogger(__name__)
app = FastAPI(title="Drape & Drop private inference", docs_url=None, redoc_url=None, openapi_url=None,lifespan=lifespan)
MAX_IMAGE = 10 * 1024 * 1024
slot = threading.BoundedSemaphore(1)
# Bound waiting requests as well as CPU execution. No detached background jobs.
stylist_admission = threading.BoundedSemaphore(3)

def acquire_slot():
    if not stylist_admission.acquire(blocking=False):
        raise HTTPException(429,"The inference queue is full. Retry shortly.")
    if not slot.acquire(timeout=60):
        stylist_admission.release()
        raise HTTPException(429,"The inference worker is busy. Retry shortly.")

def release_slot():
    slot.release()
    stylist_admission.release()


def authenticate(authorization: str = Header(default="")):
    expected = os.environ.get("DRAPE_ML_WORKER_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, "Worker credentials are not configured.")
    if not hmac.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(401, "Invalid worker credentials.")

def decode(raw):
    if not raw or len(raw) > MAX_IMAGE:
        raise HTTPException(413, "Photo exceeds the upload limit.")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"} or getattr(source, "n_frames", 1) != 1:
                raise ValueError()
            if min(source.size) < 128 or source.width * source.height > 16_000_000:
                raise ValueError()
            return ImageOps.exif_transpose(source).convert("RGB")
    except (OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, "Invalid image.") from None

@app.get("/healthz")
def health():
    return {"status": "ok", "device": "cpu"}

@app.post("/internal/v1/body-analysis", dependencies=[Depends(authenticate)])
def body_analysis(image: UploadFile = File(...), reference_height_cm: float = Form(...)):
    import math
    if not math.isfinite(reference_height_cm) or not 80 <= reference_height_cm <= 250:
        raise HTTPException(422, "Known height must be between 80 and 250 cm.")
    raw = image.file.read(MAX_IMAGE + 1)
    person = decode(raw)
    acquire_slot()
    try:
        from app.pose.validation import analyze_person
        return analyze_person(person, reference_height_cm)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Body analysis failed")
        raise HTTPException(503, "Body analysis is unavailable.") from None
    finally:
        release_slot()

_tagger = None

@app.post("/internal/v1/garment-analysis", dependencies=[Depends(authenticate)])
def garment_analysis(image: UploadFile = File(...), owner_scope: str = Form(...,min_length=1,max_length=64), prepare_closet: bool = Form(False), closet_category: str | None = Form(None)):
    import base64
    import tempfile
    from pathlib import Path
    raw=image.file.read(MAX_IMAGE+1)
    decode(raw)
    acquire_slot()
    from app.wardrobe.gates import GateError
    try:
        from .runtime import models
        from app.wardrobe.pipeline import process_upload
        tagger,_,_=models()
        with tempfile.TemporaryDirectory(prefix="drape-garment-") as temporary:
            root=Path(temporary)
            from .garment_cache import cache
            result=cache.analyse(raw,owner_scope,tagger,root,process_upload)
            # The application contract uses labels; the ML pipeline retains each
            # label's confidence internally for recommendation scoring.
            attributes={name:prediction["value"] for name,prediction in result.attributes.items()}
            response = {"category":result.category,"slot":result.slot,"attributes":attributes,
                "colors":result.colors,"confidence":result.confidence,"margin":result.margin,
                "alternatives":result.alternatives,"route":result.route,"warnings":result.warnings,
                "cutoutUsed":result.cutout_used,"cutoutMime":"image/webp",
                "cutoutBase64":base64.b64encode((root/result.image_path).read_bytes()).decode(),
                "model":"Marqo/marqo-fashionSigLIP"}
            if prepare_closet:
                import numpy as np
                from . import tryon
                from app.tryon.preparation import prepare_garment
                category=closet_category or {"top":"Tops","outer":"Outerwear","bottom":"Bottoms","full":"Dresses","shoes":"Shoes"}[result.slot]
                foreground=Image.open(root/result.image_path).convert("RGBA")
                if not result.cutout_used:
                    raise HTTPException(422,"Background removal was uncertain. Choose a clearer garment photo.")
                if category not in {"Tops","Bottoms","Outerwear","Dresses","Shoes"}:
                    raise HTTPException(422,"Unsupported wardrobe category.")
                if category!="Shoes":
                    if tryon._parser is None:
                        from fashn_human_parser import FashnHumanParser
                        tryon._parser=FashnHumanParser(device="cpu")
                    # The upload pipeline bounds the cutout to 1024px. Parse
                    # the same coordinate space, not the full-resolution input.
                    photo=decode(raw)
                    if photo.size!=foreground.size:
                        photo=photo.resize(foreground.size,Image.Resampling.LANCZOS)
                    labels=tryon._parser.predict(np.asarray(photo))
                    prepared,info,foreground=prepare_garment(photo,foreground,labels,
                        {"Tops":"tops","Outerwear":"tops","Bottoms":"bottoms","Dresses":"one-pieces"}[category],return_cutout=True)
                else:
                    prepared=Image.new("RGB",foreground.size,"white");prepared.paste(foreground,mask=foreground.getchannel("A"))
                    info={"warnings":[],"method":"foreground-only"}
                clean=io.BytesIO();foreground.save(clean,"WEBP",lossless=True)
                reference=io.BytesIO();prepared.save(reference,"JPEG",quality=95)
                response["preparation"]={"category":category,"cutoutBase64":base64.b64encode(clean.getvalue()).decode(),
                    "preparedBase64":base64.b64encode(reference.getvalue()).decode(),"warnings":info["warnings"],
                    "method":info["method"],"version":"garment-preparation-v1"}
            return response
    except GateError as error:
        raise HTTPException(422,error.message) from None
    except HTTPException:
        raise
    except Exception:
        logger.exception("Garment analysis failed")
        raise HTTPException(503,"Garment analysis is unavailable.") from None
    finally:
        release_slot()

from .styling import StylistInput
@app.post("/internal/v1/stylist",dependencies=[Depends(authenticate)])
def session_stylist(body:StylistInput):
    import time
    if not stylist_admission.acquire(blocking=False):
        raise HTTPException(429,"The stylist queue is full. Retry shortly.")
    acquired=False
    started=time.monotonic()
    try:
        acquired=slot.acquire(timeout=60)
        if not acquired:
            logger.warning("Stylist queue wait exceeded 60 seconds")
            raise HTTPException(429,"The stylist is busy. Retry shortly.")
        logger.info("Stylist request admitted after %.1f seconds",time.monotonic()-started)
        from .styling import run
        return run(body)
    except HTTPException:raise
    except Exception:
        logger.exception("Session stylist failed")
        raise HTTPException(503,"Stylist is unavailable.") from None
    finally:
        if acquired:slot.release()
        stylist_admission.release()
        logger.info("Stylist request finished in %.1f seconds",time.monotonic()-started)

@app.post("/internal/v1/session-tryon",dependencies=[Depends(authenticate)])
def session_tryon(person:UploadFile=File(...),image:UploadFile=File(...),category:str=Form(...),provider:str=Form("weshop"),prepared:bool=Form(False)):
    if category not in {"tops","bottoms","one-pieces"} or provider not in {"weshop","idm"}:
        raise HTTPException(422,"Unsupported try-on selection.")
    person_photo=decode(person.file.read(MAX_IMAGE+1))
    garment_photo=decode(image.file.read(MAX_IMAGE+1))
    acquire_slot()
    try:
        from .tryon import generate
        return generate(person_photo,garment_photo,category,provider,prepared=prepared)
    except HTTPException:raise
    except Exception:
        logger.exception("Session try-on failed")
        raise HTTPException(503,"Session try-on is unavailable.") from None
    finally:release_slot()

@app.post("/internal/v1/prepare-garment",dependencies=[Depends(authenticate)])
def prepare_garment_upload(image:UploadFile=File(...),category:str=Form(...)):
    import base64,io
    if category not in {"tops","bottoms","one-pieces"}:raise HTTPException(422,"Unsupported category.")
    photo=decode(image.file.read(MAX_IMAGE+1))
    acquire_slot()
    try:
        import numpy as np
        from . import tryon
        from app.wardrobe.background import remove_background
        from app.tryon.preparation import prepare_garment
        if tryon._parser is None:
            from fashn_human_parser import FashnHumanParser
            tryon._parser=FashnHumanParser(device="cpu")
        foreground=remove_background(photo)
        labels=tryon._parser.predict(np.asarray(photo))
        prepared,info,cutout=prepare_garment(photo,foreground,labels,category,return_cutout=True)
        clean=io.BytesIO();cutout.save(clean,"WEBP",lossless=True)
        reference=io.BytesIO();prepared.save(reference,"JPEG",quality=95)
        return {"cutoutBase64":base64.b64encode(clean.getvalue()).decode(),"preparedBase64":base64.b64encode(reference.getvalue()).decode(),
            "warnings":info["warnings"],"method":info["method"],"version":"garment-preparation-v1"}
    except ValueError:
        raise HTTPException(422,"The garment could not be isolated safely. Try a clearer photo.") from None
    finally:release_slot()
