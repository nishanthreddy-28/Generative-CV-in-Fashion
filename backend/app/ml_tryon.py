"""Active-session try-on with private generated images and signed provenance."""
import base64
import hashlib
from typing import Literal
from uuid import UUID,uuid4
import anyio
import httpx
from fastapi import APIRouter,HTTPException,Request,Response
from .ml_public import SessionTryOnResult
from .foundation import Data,rpc
from .tryon import submission
from .wardrobe import normalize_image,storage,garment_image
from .catalog import read_image as catalog_image
from .ml_sessions import active,sign_record,decode_record
router=APIRouter(prefix="/ml",tags=["session try-on"])
BUCKET="ml-session-images"

@router.post("/session-tryon",response_model=SessionTryOnResult)
async def session_tryon(request:Request,data:Data,provider:Literal["weshop","idm"]="weshop"):
    await rpc(data,"read_ml_sessions",{"p_limit":1,"p_bookmarked":False})
    garment_id,source,raw=await submission(request)
    item=await rpc(data,"read_wardrobe" if source=="wardrobe" else "read_catalog",{"p_id":str(garment_id)},
        missing_detail="Garment unavailable.")
    categories={"Tops":"tops","Outerwear":"tops","Bottoms":"bottoms","Dresses":"one-pieces"}
    if not isinstance(item,dict) or item.get("category") not in categories:
        raise HTTPException(422,"Choose one top, bottom or dress. Shoes and accessories are not supported.")
    category=categories[item["category"]]
    if provider=="idm" and category!="tops":raise HTTPException(422,"IDM-VTON supports one upper-body garment.")
    person=await anyio.to_thread.run_sync(normalize_image,raw)
    image=await (garment_image(garment_id,data) if source=="wardrobe" else catalog_image(garment_id,data))
    from .prepared_garments import prepared_reference
    reference=await prepared_reference(data,garment_id,hashlib.sha256(image.body).hexdigest(),item["category"]) if source=="wardrobe" else None
    settings=data.settings
    if not settings.ml_worker_url or not settings.ml_worker_token:raise HTTPException(503,"ML worker is not configured.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(165,connect=3),follow_redirects=False) as client:
            response=await client.post(settings.ml_worker_url+"/internal/v1/session-tryon",
                headers={"Authorization":"Bearer "+settings.ml_worker_token.get_secret_value()},
                files={"person":("person.jpg",person,"image/jpeg"),"image":("garment.jpg",reference or image.body,"image/jpeg")},
                data={"category":category,"provider":provider,"prepared":"true" if reference else "false"})
        if response.status_code==422:raise HTTPException(422,"The selected images could not be prepared for try-on.")
        if response.status_code!=200:raise HTTPException(503,"Hosted try-on is temporarily unavailable.")
        result=response.json()
        if result.get("provider") not in {"weshop","idm"} or result.get("mime")!="image/jpeg":raise ValueError()
        encoded=result["imageBase64"]
        if not isinstance(encoded,str) or len(encoded)>14*1024*1024:raise ValueError()
        generated=base64.b64decode(encoded,validate=True)
        output=await anyio.to_thread.run_sync(normalize_image,generated)
    except (httpx.HTTPError,ValueError,KeyError,TypeError):
        raise HTTPException(503,"Try-on could not finish during this session.") from None
    await active(data,request)
    current=await (garment_image(garment_id,data) if source=="wardrobe" else catalog_image(garment_id,data))
    if hashlib.sha256(current.body).digest()!=hashlib.sha256(image.body).digest():
        raise HTTPException(409,"The garment photo changed. Request the preview again.")
    ident=uuid4();conversation=uuid4()
    path=f"{data.principal.user_id}/{ident}.jpg"
    value={"provider":result["provider"],"attempts":result.get("attempts",[]),"warnings":result.get("warnings",[]),
        "source":source,"garmentId":str(garment_id),"imageObject":path,"imageHash":hashlib.sha256(output).hexdigest(),
        "imageUrl":f"/ml/history/{ident}/image","consentVersion":"photo-consent-v1"}
    await storage(data,"POST","object/"+BUCKET+"/"+path,content=output)
    try:
        await active(data,request)
        await rpc(data,"save_ml_session",{"p_id":str(ident),"p_conversation_id":str(conversation),"p_kind":"tryon",
            "p_receipt":sign_record(data,ident,conversation,"tryon",value)})
    except Exception:
        try:await storage(data,"DELETE","object/"+BUCKET,body={"prefixes":[path]})
        except Exception:pass
        raise
    return {"id":str(ident),"kind":"tryon",**{k:v for k,v in value.items() if k not in {"imageObject","imageHash"}}}

@router.get("/history/{result_id}/image")
async def generated_image(result_id:UUID,data:Data):
    row=await rpc(data,"read_ml_session",{"p_id":str(result_id)},missing_detail="Preview unavailable.")
    value=decode_record(data,row)
    path=f"{data.principal.user_id}/{result_id}.jpg"
    if row["kind"]!="tryon" or value.get("imageObject")!=path:raise HTTPException(404,"Preview unavailable.")
    content=await storage(data,"GET","object/authenticated/"+BUCKET+"/"+path)
    if hashlib.sha256(content).hexdigest()!=value.get("imageHash"):
        raise HTTPException(503,"Preview integrity check failed.")
    return Response(content,media_type="image/jpeg",headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})


@router.delete("/history/{result_id}",status_code=204)
async def delete_preview(result_id:UUID,data:Data):
    # RPC scopes the tombstone to this active owner and kind=tryon; retries are safe.
    await rpc(data,"delete_tryon_session",{"p_id":str(result_id)},missing_detail="Preview unavailable.")
    path=f"{data.principal.user_id}/{result_id}.jpg"
    await storage(data,"DELETE","object/"+BUCKET,body={"prefixes":[path]})
    return Response(status_code=204)
