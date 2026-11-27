"""Signed, reviewed derived garments; source photos remain immutable."""
import base64,hashlib,io,re
from typing import Literal
from uuid import UUID,uuid4
import anyio,httpx,jwt
from fastapi import APIRouter,HTTPException,Request,Response
from PIL import Image
from pydantic import BaseModel,ConfigDict,Field
from .foundation import Data,rpc
from .onboarding import parse_photo
from .ml import infer
from .ml_sessions import signing_key,active
from .wardrobe import garment_image,storage,normalize_image
router=APIRouter(prefix="/ml/garments",tags=["prepared garments"])
CATEGORIES={"Tops":"tops","Bottoms":"bottoms","Outerwear":"tops","Dresses":"one-pieces"}
VERSION="garment-preparation-v1"
class Prepared(BaseModel):
    model_config=ConfigDict(extra="forbid")
    cutoutBase64:str=Field(max_length=8*1024*1024)
    preparedBase64:str=Field(max_length=8*1024*1024)
    warnings:list[str]
    method:Literal["foreground-only","foreground-and-garment"]
    version:Literal["garment-preparation-v1"]
class Confirm(BaseModel):
    model_config=ConfigDict(extra="forbid")
    receipt:str=Field(max_length=24*1024*1024)
    confirmed:Literal[True]

@router.get("/clean-photo-review")
async def clean_photo_review(data:Data):
    from .wardrobe import list_garments
    page=await list_garments(data,limit=100)
    items=[]
    for garment in page.items:
        if garment.category not in CATEGORIES:continue
        record=await rpc(data,"read_prepared_garment",{"p_id":str(garment.id)})
        if not record:items.append({"id":str(garment.id),"name":garment.name,"category":garment.category})
    return {"items":items,"hasMore":bool(page.nextCursor)}

@router.post("/prepare-upload")
async def prepare_upload(request:Request,data:Data,category:Literal["Tops","Bottoms","Outerwear","Dresses"]):
    import time
    photo=await parse_photo(request)
    result=Prepared.model_validate(await infer(data,"prepare-garment",photo,{"category":CATEGORIES[category]}))
    await active(data,request)
    now=int(time.time())
    receipt=jwt.encode({"sub":str(data.principal.user_id),"aud":"prepared-garment-v1","iat":now,"exp":now+1800,
        "sourceHash":hashlib.sha256(photo).hexdigest(),"category":category,"result":result.model_dump()},
        signing_key(data.settings),algorithm="HS256")
    return {**result.model_dump(),"receipt":receipt,"category":category}

@router.post("/{garment_id}/prepare")
async def prepare_existing(garment_id:UUID,request:Request,data:Data):
    """Prepare a saved original for explicit review, without changing metadata."""
    import time
    item=await rpc(data,"read_wardrobe",{"p_id":str(garment_id)},missing_detail="Garment unavailable.")
    category=item["category"]
    if category not in CATEGORIES:
        raise HTTPException(422,"Clean reference preparation currently supports tops, bottoms, outerwear and dresses.")
    photo=await garment_image(garment_id,data)
    result=Prepared.model_validate(await infer(data,"prepare-garment",photo.body,{"category":CATEGORIES[category]}))
    await active(data,request)
    now=int(time.time())
    receipt=jwt.encode({"sub":str(data.principal.user_id),"aud":"prepared-garment-v1","iat":now,"exp":now+1800,
        "sourceHash":hashlib.sha256(photo.body).hexdigest(),"category":category,"result":result.model_dump()},
        signing_key(data.settings),algorithm="HS256")
    return {**result.model_dump(),"receipt":receipt,"category":category}

@router.post("/{garment_id}/prepared")
async def confirm_prepared(garment_id:UUID,body:Confirm,data:Data):
    try:
        proof=jwt.decode(body.receipt,signing_key(data.settings),algorithms=["HS256"],audience="prepared-garment-v1")
        if proof["sub"]!=str(data.principal.user_id):raise ValueError()
        result=Prepared.model_validate(proof["result"])
    except (jwt.PyJWTError,ValueError,KeyError):
        raise HTTPException(409,"Preparation expired. Review the garment photo again.") from None
    garment=await rpc(data,"read_wardrobe",{"p_id":str(garment_id)},missing_detail="Garment unavailable.")
    image=await garment_image(garment_id,data)
    source_hash=hashlib.sha256(image.body).hexdigest()
    # Previously reviewed saved photos used a second JPEG encoding. Accept only
    # that deterministic legacy representation of this same owned source.
    matches=source_hash==proof["sourceHash"]
    if not matches:
        matches=hashlib.sha256(await anyio.to_thread.run_sync(normalize_image,image.body)).hexdigest()==proof["sourceHash"]
    if garment["category"]!=proof["category"] or not matches:
        raise HTTPException(409,"The photo or category changed. Prepare it again.")
    ident=uuid4();folder=f"{data.principal.user_id}/{ident}"
    objects=[]
    try:
        for suffix,encoded,mime in [(".webp",result.cutoutBase64,"image/webp"),(".jpg",result.preparedBase64,"image/jpeg")]:
            content=base64.b64decode(encoded,validate=True)
            await storage(data,"POST","object/wardrobe-derived/"+folder+suffix,content=content,content_type=mime)
            objects.append(folder+suffix)
        receipt=jwt.encode({"sub":str(data.principal.user_id),"aud":"saved-prepared-v1","garmentId":str(garment_id),
            "sourceHash":source_hash,"category":proof["category"],"version":VERSION,"cleanObject":folder+".webp",
            "preparedObject":folder+".jpg","cleanHash":hashlib.sha256(base64.b64decode(result.cutoutBase64)).hexdigest(),"preparedHash":hashlib.sha256(base64.b64decode(result.preparedBase64)).hexdigest()},
            signing_key(data.settings),algorithm="HS256")
        await rpc(data,"save_prepared_garment",{"p_id":str(garment_id),"p_receipt":receipt})
    except Exception:
        try:await storage(data,"DELETE","object/wardrobe-derived",body={"prefixes":objects})
        except Exception:pass
        raise
    return {"saved":True,"garmentId":str(garment_id)}

async def verified_preparation(data, garment_id, source_hash, category, original=None):
    from .errors import DependencyUnavailable

    try:
        record = await rpc(data, "read_prepared_garment", {"p_id": str(garment_id)})
    except DependencyUnavailable:
        return None
    if not record:
        return None
    try:
        proof = jwt.decode(record["receipt"], signing_key(data.settings),
                           algorithms=["HS256"], audience="saved-prepared-v1")
        if (proof["sub"] != str(data.principal.user_id) or proof["garmentId"] != str(garment_id)
                or proof["category"] != category or proof["version"] != VERSION):
            return None
        if proof["sourceHash"] != source_hash:
            if not re.fullmatch(r"[a-f0-9]{64}", proof["sourceHash"]):
                return None
            if original is None:
                original = (await garment_image(garment_id, data)).body
            if hashlib.sha256(original).hexdigest() != source_hash:
                return None
            legacy = await anyio.to_thread.run_sync(normalize_image, original)
            if hashlib.sha256(legacy).hexdigest() != proof["sourceHash"]:
                return None
        return proof
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        return None


async def read_derived_image(data, proof, object_key, hash_key):
    if not proof:
        return None
    path = proof.get(object_key)
    if not isinstance(path, str) or not path.startswith(str(data.principal.user_id) + "/") or ".." in path:
        return None
    content = await storage(data, "GET", "object/authenticated/wardrobe-derived/" + path)
    return content if hashlib.sha256(content).hexdigest() == proof.get(hash_key) else None


async def prepared_reference(data, garment_id, source_hash, category):
    proof = await verified_preparation(data, garment_id, source_hash, category)
    return await read_derived_image(data, proof, "preparedObject", "preparedHash")


THUMBNAIL_SIDE = 448
PRIVATE_IMAGE_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


def make_closet_thumbnail(content: bytes) -> bytes:
    with Image.open(io.BytesIO(content)) as source:
        image = source.convert("RGBA" if "A" in source.getbands() or "transparency" in source.info else "RGB")
        image.thumbnail((THUMBNAIL_SIDE, THUMBNAIL_SIDE), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, "WEBP", quality=78)
        return output.getvalue()


@router.get("/{garment_id}/closet-image")
async def closet_image(garment_id: UUID, data: Data, size: Literal["full", "thumbnail"] = "full"):
    original = await garment_image(garment_id, data)
    item = await rpc(data, "read_wardrobe", {"p_id": str(garment_id)}, missing_detail="Garment unavailable.")
    proof = await verified_preparation(
        data, garment_id, hashlib.sha256(original.body).hexdigest(), item["category"], original.body
    )
    clean = await read_derived_image(data, proof, "cleanObject", "cleanHash")
    if size == "thumbnail":
        content = await anyio.to_thread.run_sync(make_closet_thumbnail, clean or original.body)
        return Response(content, media_type="image/webp", headers=PRIVATE_IMAGE_HEADERS)
    if clean is None:
        return original
    return Response(clean, media_type="image/webp", headers=PRIVATE_IMAGE_HEADERS)
