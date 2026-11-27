import logging
"""Active-session stylist, history and feedback; no elevated Supabase access."""
import base64
import hashlib
import hmac
import io
import json
import time
from typing import Literal
from uuid import UUID,uuid4
import anyio
import httpx
import jwt
from fastapi import APIRouter,HTTPException,Request,Response,Query
from PIL import Image
from pydantic import BaseModel,ConfigDict,Field
from .ml_public import StylistResult,SessionHistoryPage
from .outfits import OutfitItem
from .foundation import Data,rpc
from .dependencies import DatabaseEligibility
from .wardrobe import list_garments as wardrobe_list,garment_image
from .catalog import list_garments as catalog_list,read_image as catalog_image
router=APIRouter(prefix="/ml",tags=["session inference"])
AUDIENCE="drape:session-result:v1"

def signing_key(settings):
    if not (settings.ml_receipt_signing_key or settings.ml_worker_token):raise HTTPException(503,"Inference is not configured.")
    return hmac.new((settings.ml_receipt_signing_key or settings.ml_worker_token).get_secret_value().encode(),AUDIENCE.encode(),hashlib.sha256).digest()

def sign_record(data,ident,conversation,kind,value):
    return jwt.encode({"sub":str(data.principal.user_id),"aud":AUDIENCE,"iat":int(time.time()),
        "id":str(ident),"conversationId":str(conversation),"kind":kind,"data":value},
        signing_key(data.settings),algorithm="HS256")

def decode_record(data,row):
    try:
        value=jwt.decode(row["receipt"],signing_key(data.settings),algorithms=["HS256"],audience=AUDIENCE,
            options={"require":["sub","aud","iat","id","conversationId","kind","data"]})
        if value["sub"]!=str(data.principal.user_id) or value["id"]!=row["id"] or value["conversationId"]!=row["conversationId"] or value["kind"]!=row["kind"]:
            raise ValueError()
        return value["data"]
    except (jwt.PyJWTError,ValueError,TypeError,KeyError):
        raise HTTPException(503,"Saved inference evidence is invalid.") from None

async def worker_json(data,operation,payload,timeout=300):
    settings=data.settings
    if not settings.ml_worker_url or not settings.ml_worker_token:
        raise HTTPException(503,"ML worker is not configured.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout,connect=3),follow_redirects=False) as client:
            result=await client.post(settings.ml_worker_url+"/internal/v1/"+operation,json=payload,
                headers={"Authorization":"Bearer "+settings.ml_worker_token.get_secret_value()})
        if result.status_code==429:
            raise HTTPException(429,"The stylist is handling another request. Please retry shortly.")
        if result.status_code!=200:
            logging.getLogger(__name__).warning("Session inference failed: %s HTTP %s",operation,result.status_code)
            raise HTTPException(503,"Inference is unavailable or busy. Please try again.")
        value=result.json()
        if not isinstance(value,dict):raise ValueError()
        return value
    except (httpx.HTTPError,ValueError):
        raise HTTPException(503,"Inference could not finish during this session.") from None

async def active(data,request=None):
    await DatabaseEligibility().require_active(data.principal,data)
    if request is not None and await request.is_disconnected():
        raise HTTPException(499,"Request cancelled.")

def thumbnail(content):
    with Image.open(io.BytesIO(content)) as image:
        image=image.convert("RGB");image.thumbnail((512,512))
        output=io.BytesIO();image.save(output,"JPEG",quality=85)
        return base64.b64encode(output.getvalue()).decode()

class StylistRequest(BaseModel):
    model_config=ConfigDict(extra="forbid")
    message:str=Field(min_length=1,max_length=4000)
    count:int|None=Field(default=None,ge=1,le=5,strict=True)
    wardrobeOnly:bool=Field(default=True,strict=True)
    conversationId:UUID|None=None
    requiredItems:list[OutfitItem]=Field(default_factory=list,max_length=4)

class WorkerItem(BaseModel):
    id:str=Field(max_length=60)
class WorkerOutfit(BaseModel):
    id:str=Field(max_length=100)
    items:list[WorkerItem]=Field(min_length=2,max_length=5)
    ranking_score:float=Field(allow_inf_nan=False)
    explanation:str=Field(max_length=4000)
    fit_notes:list[str]=Field(default_factory=list,max_length=20)
class WorkerResult(BaseModel):
    status:Literal["recommended","no_match","needs_clarification","unavailable","chat"]
    message:str=Field(max_length=8000)
    outfits:list[WorkerOutfit]=Field(default_factory=list,max_length=5)
    warnings:list[str]=Field(default_factory=list,max_length=100)
    model_version:str|None=None
    state:dict

@router.post("/stylist",response_model=StylistResult)
async def stylist(body:StylistRequest,request:Request,data:Data):
    if not body.message.strip():raise HTTPException(422,"Enter a message.")
    conversation=body.conversationId or uuid4()
    previous={}
    if body.conversationId:
        history=await rpc(data,"read_ml_sessions",{"p_limit":1,"p_conversation_id":str(conversation),"p_bookmarked":False})
        if not isinstance(history,list) or not history:raise HTTPException(404,"Conversation unavailable.")
        previous=decode_record(data,history[0]).get("state",{})
    preferences=await rpc(data,"read_personalization_preferences",{})
    if not isinstance(preferences,dict):raise HTTPException(503,"Preferences are unavailable.")
    wardrobe=await wardrobe_list(data,limit=40)
    pieces=[("wardrobe",piece) for piece in wardrobe.items]
    if not body.wardrobeOnly:
        catalog=await catalog_list(data,limit=20)
        for piece in catalog.items:
            low,high=preferences.get("budgetMin"),preferences.get("budgetMax")
            if (low is not None or high is not None) and (piece.price is None or low is not None and piece.price<low or high is not None and piece.price>high):
                continue
            pieces.append(("catalog",piece))
    if len({(item.source,item.garmentId) for item in body.requiredItems})!=len(body.requiredItems):
        raise HTTPException(422,"Choose each required piece only once.")
    existing={(source,piece.id) for source,piece in pieces}
    for required in body.requiredItems:
        if required.source=="catalog" and body.wardrobeOnly:
            raise HTTPException(422,"Enable catalogue pieces to select this garment.")
        if (required.source,required.garmentId) in existing:continue
        if required.source=="wardrobe":
            from .wardrobe import get_garment
            piece=await get_garment(required.garmentId,data)
        else:
            from .catalog import get_garment
            piece=await get_garment(required.garmentId,data)
            low,high=preferences.get("budgetMin"),preferences.get("budgetMax")
            if (low is not None or high is not None) and (piece.price is None or low is not None and piece.price<low or high is not None and piece.price>high):
                raise HTTPException(422,"This selected catalogue piece is outside your saved budget.")
        pieces.append((required.source,piece))
    references={}
    inputs=[]
    snapshots={}
    for source,piece in pieces:
        if piece.category=="Accessories":continue
        image=await (garment_image(piece.id,data) if source=="wardrobe" else catalog_image(piece.id,data))
        encoded=await anyio.to_thread.run_sync(thumbnail,image.body)
        ident=source+":"+str(piece.id)
        references[ident]={"source":source,"garmentId":str(piece.id),"name":piece.name,"category":piece.category,"color":piece.color}
        snapshots[ident]=hashlib.sha256(image.body).hexdigest()
        inputs.append({"id":ident,"name":piece.name,"category":piece.category,"color":piece.color,"imageBase64":encoded})
    required_ids=[item.source+":"+str(item.garmentId) for item in body.requiredItems]
    if any(ident not in references for ident in required_ids):
        raise HTTPException(422,"A selected piece is unavailable or belongs to an unsupported category.")
    manual=await rpc(data,"read_body_profile",{})
    context={"savedPreferences":preferences,"userEnteredBodyProfile":manual,
        "instruction":"Manual measurements are user entered; photo front widths are not circumferences. Do not guarantee physical fit."}
    from .pose_receipts import verify as verify_pose
    onboarding=await rpc(data,"onboarding_status",{})
    reviewed=(onboarding or {}).get("reviewed")
    if reviewed:
        saved=await rpc(data,"read_pose_analysis",{"p_image_id":reviewed["id"]})
        if saved:
            _,original=verify_pose(data.settings,saved["receipt"],data.principal.user_id,reviewed["id"],saved=True)
            context["confirmedPhotoObservations"]={"referenceHeightCm":original.reference_height_cm,"reviewed":saved["reviewed"],
                "instruction":"Unvalidated front-view observations; never infer clothing sizes or circumferences."}
    feedback={}
    old_feedback=await rpc(data,"list_recommendation_feedback",{"p_limit":100})
    old_results=await rpc(data,"recent_recommendations",{"p_limit":50})
    sentiments={item["recommendationId"]:item["sentiment"] for item in old_feedback.get("items",[])}
    for old in old_results.get("items",[]):
        if old["id"] not in sentiments:continue
        identifiers=sorted(piece["source"]+":"+piece["garmentId"] for piece in old["items"])
        feedback[hashlib.sha256("|".join(identifiers).encode()).hexdigest()[:20]]=.06 if sentiments[old["id"]]=="like" else -.06
    recent=await rpc(data,"read_ml_sessions",{"p_limit":20,"p_bookmarked":False})
    for entry in recent:
        if entry.get("kind")!="stylist" or entry.get("feedback") not in {"like","dislike"}:continue
        previous_result=decode_record(data,entry)
        for look in previous_result.get("outfits",[]):
            feedback.setdefault(look["id"],.06 if entry["feedback"]=="like" else -.06)
    raw=await worker_json(data,"stylist",{"ownerScope":str(data.principal.user_id),"requiredIds":required_ids,"message":body.message,"count":body.count,"garments":inputs,
        "previous":previous.get("intent",{}),"previousRequiredIds":previous.get("uiRequiredIds",[]),"lastIds":previous.get("lastIds",[]),"seen":previous.get("seen",[]),
        "extraContext":json.dumps(context,separators=(",",":")),"feedback":feedback})
    await active(data,request)
    try:
        result=WorkerResult.model_validate(raw)
        outfits=[]
        for outfit in result.outfits:
            if any(item.id not in references for item in outfit.items):raise ValueError()
            if len({item.id for item in outfit.items})!=len(outfit.items):raise ValueError()
            for item in outfit.items:
                ref=references[item.id]
                current=await (garment_image(UUID(ref["garmentId"]),data) if ref["source"]=="wardrobe" else catalog_image(UUID(ref["garmentId"]),data))
                if hashlib.sha256(current.body).hexdigest()!=snapshots[item.id]:
                    raise HTTPException(409,"A garment photo changed. Request outfits again.")
            outfits.append({"id":outfit.id,"items":[references[item.id] for item in outfit.items],
                "rankingScore":outfit.ranking_score,"explanation":outfit.explanation,"fitNotes":outfit.fit_notes})
        value={"userMessage":body.message,"engineVersion":"gemma-cir-v1","status":result.status,"message":("The stylist could not finish this request. Please try again later." if result.status=="unavailable" else result.message),"outfits":outfits,
            "warnings":result.warnings+["Candidate pool: newest 40 wardrobe pieces and up to 20 eligible catalogue pieces; accessories are excluded.",
                "Ranking scores are uncalibrated and are not suitability probabilities."],"modelVersion":result.model_version,
            "state":result.state}
    except (ValueError,TypeError,KeyError):
        raise HTTPException(503,"Stylist returned invalid results.") from None
    ident=uuid4()
    await rpc(data,"save_ml_session",{"p_id":str(ident),"p_conversation_id":str(conversation),"p_kind":"stylist",
        "p_receipt":sign_record(data,ident,conversation,"stylist",value)})
    return {"id":str(ident),"conversationId":str(conversation),**{k:v for k,v in value.items() if k not in {"state","imageObject","imageHash"}}}

@router.get("/history",response_model=SessionHistoryPage)
async def history(data:Data,limit:int=Query(default=20,ge=1,le=100),kind:Literal["tryon"]|None=None,bookmarked:bool=False):
    rows=await (rpc(data,"read_tryon_sessions",{"p_limit":limit}) if kind=="tryon" else rpc(data,"read_ml_sessions",{"p_limit":limit,"p_bookmarked":bookmarked}))
    if not isinstance(rows,list):raise HTTPException(503,"Inference history is unavailable.")
    values=[]
    for row in rows:
        value=decode_record(data,row)
        values.append({"id":row["id"],"conversationId":row["conversationId"],"kind":row["kind"],
            "bookmarked":row["bookmarked"],"feedback":row["feedback"],"createdAt":row["created_at"],
            **{k:v for k,v in value.items() if k not in {"state","imageObject","imageHash"}}})
    return {"items":values,"nextCursor":None}

class HistoryUpdate(BaseModel):
    model_config=ConfigDict(extra="forbid")
    bookmarked:bool|None=None
    feedback:Literal["like","dislike",""]|None=None

@router.patch("/history/{result_id}",status_code=204)
async def update_history(result_id:UUID,body:HistoryUpdate,data:Data):
    await rpc(data,"update_ml_session",{"p_id":str(result_id),"p_bookmarked":body.bookmarked,"p_feedback":body.feedback},
        missing_detail="Inference result unavailable.")
    return Response(status_code=204)

@router.get("/capabilities")
async def capabilities(data:Data):
    from .errors import DependencyUnavailable
    pose_storage=False
    session_storage=False
    try:
        await rpc(data,"read_pose_analysis",{"p_image_id":str(uuid4())})
        pose_storage=True
    except DependencyUnavailable:pass
    try:
        await rpc(data,"read_ml_sessions",{"p_limit":1,"p_bookmarked":False})
        session_storage=True
    except DependencyUnavailable:pass
    prepared_storage=False
    try:
        await rpc(data,"read_prepared_garment",{"p_id":str(uuid4())});prepared_storage=True
    except DependencyUnavailable:pass
    return {"preparedStorageAvailable":prepared_storage,"workerConfigured":bool(data.settings.ml_worker_url and data.settings.ml_worker_token),
        "poseStorageAvailable":pose_storage,"sessionStorageAvailable":session_storage,
        "processingMode":"active-session"}
