"""Private try-on job infrastructure. No inference worker or generated output."""
import base64
import hashlib
import json
import logging
from datetime import datetime
from typing import Annotated,Literal
from uuid import UUID,uuid4
import anyio
from fastapi import APIRouter,Request,Response,HTTPException,Query
from pydantic import BaseModel,ConfigDict,StrictBool,ValidationError
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartException
from .foundation import Data,rpc
from .errors import DependencyUnavailable,Forbidden,Unauthorized
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from .wardrobe import MAX_IMAGE,MAX_REQUEST,ImageInfo,normalize_image,storage,object_path

class TryOnRoute(APIRoute):
    def get_route_handler(self):
        handler=super().get_route_handler()
        async def safe(request):
            try:return await handler(request)
            except RequestValidationError:raise HTTPException(422,'Invalid try-on job request.') from None
        return safe


router=APIRouter(route_class=TryOnRoute)
BUCKET='tryon-inputs'
logger=logging.getLogger(__name__)


class Job(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id:UUID
    status:Literal['queued','processing','completed','failed']
    garmentId:UUID
    source:Literal['wardrobe','catalog']
    createdAt:datetime
    updatedAt:datetime
    finishedAt:datetime|None
    consentVersion:Literal['photo-consent-v1']
    consentAt:datetime
    failureCode:Literal['CANCELLED','WORKER_FAILED','INPUT_EXPIRED']|None
    error:str|None
    workerAvailable:Literal[False]
    workerMessage:str
    canCancel:StrictBool
    inputAvailable:StrictBool
    inputUrl:str


class JobPage(BaseModel):
    items:list[Job]
    nextCursor:str|None


def job(value):
    try:
        result=Job.model_validate(value)
        if result.inputUrl!=f'/try-on/jobs/{result.id}/input' or result.canCancel!=(result.status=='queued'):raise ValueError()
        if any(value.tzinfo is None for value in [result.createdAt,result.updatedAt,result.consentAt]):raise ValueError()
        return result
    except (ValueError,ValidationError):raise DependencyUnavailable() from None


async def call(data,name,body):
    return await rpc(data,name,body,missing_detail='Job, garment or input photo unavailable.',conflict_detail='This job cannot be cancelled in its current state.')


async def cleanup(data):
    try:
        pending=await call(data,'tryon_image_cleanup',{})
        if not isinstance(pending,list):raise DependencyUnavailable()
        for item in pending[:10]:
            path=object_path(data,item['object'])
            await storage(data,'DELETE','object/'+BUCKET,body={'prefixes':[path]})
            await call(data,'tryon_image_cleanup',{'p_finished':str(UUID(item['id']))})
    except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException,KeyError,ValueError,TypeError):
        logger.warning('Try-on input cleanup remains pending; reconciliation is required.')


async def submission(request):
    if not request.headers.get('content-type','').startswith('multipart/form-data;'):raise HTTPException(415,'Use multipart photo submission.')
    raw=bytearray()
    async for chunk in request.stream():
        if len(raw)+len(chunk)>MAX_REQUEST:raise HTTPException(413,'Upload exceeds the request limit.')
        raw.extend(chunk)
    sent=False
    async def receive():
        nonlocal sent
        if sent:return {'type':'http.request','body':b'','more_body':False}
        sent=True;return {'type':'http.request','body':bytes(raw),'more_body':False}
    try:
        async with Request(request.scope,receive=receive).form(max_files=1,max_fields=3,max_part_size=1024) as form:
            keys=[key for key,_ in form.multi_items()]
            if len(keys)!=4 or len(set(keys))!=4 or set(keys)!={'person','garmentId','source','photoConsent'}:raise ValueError()
            if form.get('photoConsent')!='true' or form.get('source') not in ['wardrobe','catalog']:raise ValueError()
            ident=UUID(form.get('garmentId'))
            photo=form.get('person')
            if not isinstance(photo,UploadFile):raise ValueError()
            content=await photo.read(MAX_IMAGE+1)
            return ident,form['source'],content
    except (ValueError,TypeError,AttributeError,MultiPartException,StarletteHTTPException):
        raise HTTPException(422,'A valid garment, source, photo and explicit consent are required.') from None


@router.post('/try-on/jobs',response_model=Job,status_code=202)
async def submit(request:Request,data:Data):
    garment_id,source,photo=await submission(request)
    # Check target before writing personal image metadata or bytes.
    await call(data,'read_wardrobe' if source=='wardrobe' else 'read_catalog',{'p_id':str(garment_id)})
    image=await anyio.to_thread.run_sync(normalize_image,photo);ident=uuid4();digest=hashlib.sha256(image).hexdigest()
    reserved=False
    try:
        value=await call(data,'reserve_tryon_image',{'p_id':str(ident),'p_sha256':digest,'p_byte_size':len(image)})
        reserved=True
        try:info=ImageInfo.model_validate(value)
        except ValidationError:raise DependencyUnavailable() from None
        if info.id!=ident or info.object!=f'{data.principal.user_id}/{ident}.jpg' or info.sha256!=digest or info.byteSize!=len(image):raise DependencyUnavailable()
        await storage(data,'POST','object/'+BUCKET+'/'+object_path(data,info.object),content=image)
        value=await call(data,'submit_tryon',{'p_garment_id':str(garment_id),'p_source':source,'p_image_id':str(ident),'p_consent':True})
    except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException):
        if reserved:
            try:await call(data,'abandon_tryon_image',{'p_id':str(ident)})
            except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException):pass
        await cleanup(data)
        raise
    await cleanup(data)
    return job(value)


@router.get('/try-on/jobs/{job_id}',response_model=Job)
async def detail(job_id:UUID,data:Data):return job(await call(data,'read_tryon',{'p_id':str(job_id)}))


@router.post('/try-on/jobs/{job_id}/cancel',response_model=Job)
async def cancel(job_id:UUID,data:Data):
    await call(data,'cancel_tryon',{'p_id':str(job_id)})
    await cleanup(data)
    return job(await call(data,'read_tryon',{'p_id':str(job_id)}))


@router.get('/try-on/jobs/{job_id}/input')
async def input_image(job_id:UUID,data:Data):
    try:info=ImageInfo.model_validate(await call(data,'tryon_input_info',{'p_id':str(job_id)}))
    except ValidationError:raise DependencyUnavailable() from None
    content=await storage(data,'GET','object/authenticated/'+BUCKET+'/'+object_path(data,info.object))
    if len(content)!=info.byteSize or hashlib.sha256(content).hexdigest()!=info.sha256:raise DependencyUnavailable()
    content=await anyio.to_thread.run_sync(normalize_image,content)
    return Response(content,media_type='image/jpeg',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})


def position(value):
    if not isinstance(value,dict) or set(value)!={'id','createdAt'} or not all(isinstance(v,str) for v in value.values()):raise ValueError()
    UUID(value['id'])
    if datetime.fromisoformat(value['createdAt']).tzinfo is None:raise ValueError()
    return value


@router.get('/try-on/jobs',response_model=JobPage)
async def history(data:Data,limit:Annotated[int,Query(ge=1,le=100)]=24,cursor:Annotated[str|None,Query(max_length=4000)]=None):
    cursor_value=None
    if cursor:
        try:
            value=json.loads(base64.b64decode(cursor,altchars=b'-_',validate=True))
            if not isinstance(value,dict) or set(value)!={'owner','position'} or value['owner']!=str(data.principal.user_id):raise ValueError()
            cursor_value=position(value['position'])
        except (ValueError,TypeError,KeyError,OverflowError,RecursionError):raise HTTPException(422,'Invalid job cursor.') from None
    value=await call(data,'list_tryon',{'p_limit':limit,'p_cursor':cursor_value})
    try:
        if not isinstance(value,dict) or set(value)!={'items','nextCursor'} or not isinstance(value['items'],list) or len(value['items'])>limit:raise ValueError()
        next_position=position(value['nextCursor']) if value['nextCursor'] is not None else None
        token=base64.urlsafe_b64encode(json.dumps({'owner':str(data.principal.user_id),'position':next_position}).encode()).decode() if next_position else None
        return JobPage(items=[job(item) for item in value['items']],nextCursor=token)
    except (ValueError,TypeError,KeyError,OverflowError):raise DependencyUnavailable() from None
