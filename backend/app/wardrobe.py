"""Wardrobe CRUD with immutable private images, current-user RPCs and no elevated fallback."""
import base64
import hashlib
import io
import json
import logging
import time
import warnings
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

import anyio
import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError, field_validator
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException
from starlette.exceptions import HTTPException as StarletteHTTPException

from .errors import DependencyUnavailable, Forbidden, Unauthorized
from .foundation import Data, rpc

MAX_IMAGE = 10 * 1024 * 1024
MAX_REQUEST = MAX_IMAGE + 64 * 1024
BUCKET = 'wardrobe-images'
logger = logging.getLogger(__name__)
Category = Literal['Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories']
Short = Annotated[StrictStr, Field(max_length=200)]


class GarmentPatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: Annotated[StrictStr, Field(min_length=1, max_length=200)] | None = None
    category: Category | None = None
    color: Short | None = None
    brand: Short | None = None
    size: Short | None = None
    material: Short | None = None
    notes: Annotated[StrictStr, Field(max_length=2000)] | None = None

    @field_validator('*', mode='before')
    @classmethod
    def valid_text(cls, value):
        if value is None or isinstance(value,str) and '\x00' in value:
            raise ValueError('Use valid text; blank optional text clears the field.')
        return value

    @field_validator('name')
    @classmethod
    def name_not_blank(cls,value):
        if not value.strip(): raise ValueError('Name must not be blank.')
        return value.strip()


class GarmentCreate(GarmentPatch):
    name: Annotated[StrictStr, Field(min_length=1,max_length=200)]
    category: Category


class GarmentRead(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    name: Annotated[StrictStr,Field(min_length=1,max_length=200)]
    category: Category
    color: Short
    brand: Short
    size: Short
    material: Short
    notes: Annotated[StrictStr,Field(max_length=2000)]
    imageUrl: Annotated[StrictStr,Field(pattern=r'^/wardrobe/[0-9a-f-]{36}/image$')]


class GarmentPage(BaseModel):
    model_config = ConfigDict(extra='forbid')
    items: list[GarmentRead]
    nextCursor: str | None


class ImageInfo(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    object: StrictStr
    sha256: Annotated[StrictStr,Field(pattern='^[a-f0-9]{64}$')]
    byteSize: Annotated[int,Field(ge=1,le=MAX_IMAGE,strict=True)]


class WardrobeRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        async def safe(request):
            try: return await handler(request)
            except RequestValidationError:
                raise HTTPException(422,'Invalid wardrobe request.') from None
        return safe


router = APIRouter(route_class=WardrobeRoute)


def garment(value) -> GarmentRead:
    try: return GarmentRead.model_validate(value)
    except ValidationError: raise DependencyUnavailable() from None


async def wardrobe_rpc(data, operation, body):
    return await rpc(data,operation,body,missing_detail='Garment or image not found.')


def normalize_image(content: bytes) -> bytes:
    if not content or len(content)>MAX_IMAGE: raise HTTPException(413,'Image exceeds the upload limit.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if source.format not in ('JPEG','PNG','WEBP') or getattr(source,'n_frames',1)!=1:
                    raise HTTPException(415,'Choose a single JPEG, PNG or WebP image.')
                if source.width*source.height>16_000_000 or max(source.size)>8192:
                    raise HTTPException(413,'Image dimensions exceed the upload limit.')
                source.load()
                image=ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((2048,2048))
                output=io.BytesIO()
                image.save(output,format='JPEG',quality=85)
                result=output.getvalue()
        if len(result)>MAX_IMAGE: raise HTTPException(413,'Image exceeds the upload limit.')
        return result
    except HTTPException: raise
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        raise HTTPException(415,'The image could not be decoded safely.') from None


async def fields_and_image(request: Request, create: bool):
    # Authenticate first (Data dependency), then bound actual bytes, including chunked requests.
    raw=bytearray()
    async for chunk in request.stream():
        if len(raw)+len(chunk)>MAX_REQUEST: raise HTTPException(413,'Upload exceeds the request limit.')
        raw.extend(chunk)
    content_type=request.headers.get('content-type','')
    photo=None
    try:
        if content_type.split(';',1)[0]=='application/json' and not create:
            values=json.loads(raw)
        elif content_type.startswith('multipart/form-data;'):
            sent=False
            async def receive():
                nonlocal sent
                if sent: return {'type':'http.request','body':b'','more_body':False}
                sent=True
                return {'type':'http.request','body':bytes(raw),'more_body':False}
            parsed=Request(request.scope,receive=receive)
            async with parsed.form(max_files=1,max_fields=1,max_part_size=16*1024) as form:
                keys=[key for key,_ in form.multi_items()]
                if len(keys)!=len(set(keys)) or set(keys)-{'metadata','image'}:
                    raise HTTPException(422,'Invalid garment form fields.')
                metadata=form.get('metadata')
                if not isinstance(metadata,str) or len(metadata)>16000: raise HTTPException(422,'Garment metadata is required.')
                values=json.loads(metadata)
                upload=form.get('image')
                if upload is not None:
                    if not isinstance(upload,UploadFile): raise HTTPException(422,'Invalid garment image.')
                    photo=await upload.read(MAX_IMAGE+1)
        else: raise HTTPException(415,'Use multipart metadata and an image for creation.')
        model=(GarmentCreate if create else GarmentPatch).model_validate(values)
    except StarletteHTTPException as error:
        if error.status_code == 400:
            raise HTTPException(422,'Invalid garment multipart form.') from None
        raise
    except (ValidationError,ValueError,MultiPartException):
        raise HTTPException(422,'Invalid garment metadata.') from None
    if create and photo is None: raise HTTPException(422,'A garment image is required.')
    return model.model_dump(exclude_unset=True),photo


def object_path(data, value: str):
    try:
        parts=value.split('/')
        if len(parts)!=2 or parts[0]!=str(data.principal.user_id) or not parts[1].endswith('.jpg'):
            raise ValueError()
        UUID(parts[1][:-4])
    except (ValueError,AttributeError): raise DependencyUnavailable() from None
    return value


async def storage(data, method, path, *, content=None, body=None):
    if data.principal.expires_at<=time.time(): raise Unauthorized()
    req=httpx.Request(method,data.settings.supabase_url+'/storage/v1/'+path,
        headers={'Authorization':'Bearer '+data.principal.access_token,
                 'apikey':data.settings.supabase_publishable_key.get_secret_value(),
                 'Content-Type':'image/jpeg' if content is not None else 'application/json',
                 'x-upsert':'false'},
        **({'content':content} if content is not None else {'json':body} if body is not None else {}),
        extensions={'timeout':{'connect':5.0,'read':10.0,'write':10.0,'pool':5.0}})
    try:
        response=await data.transport.send(req,auth=None,follow_redirects=False,stream=True)
        try:
            if response.status_code==401: raise Unauthorized()
            if response.status_code==403: raise Forbidden()
            if response.status_code not in (200,201,204): raise DependencyUnavailable()
            output=bytearray()
            async for chunk in response.aiter_bytes():
                if len(output)+len(chunk)>MAX_IMAGE: raise DependencyUnavailable()
                output.extend(chunk)
            return bytes(output)
        finally: await response.aclose()
    except httpx.HTTPError: raise DependencyUnavailable() from None


async def clean_images(data):
    # Metadata deletion is atomic; uncertain external deletion remains durably retryable.
    try:
        pending=await wardrobe_rpc(data,'wardrobe_image_cleanup',{})
        if not isinstance(pending,list): raise DependencyUnavailable()
        for item in pending[:10]:
            path=object_path(data,item['object'])
            await storage(data,'DELETE','object/'+BUCKET,body={'prefixes':[path]})
            await wardrobe_rpc(data,'wardrobe_image_cleanup',{'p_finished':str(UUID(item['id']))})
    except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException,KeyError,ValueError,TypeError):
        logger.warning('Wardrobe image cleanup remains pending; reconciliation is required.')
        return


async def save(request,data,garment_id=None):
    changes,photo=await fields_and_image(request,garment_id is None)
    image_id=None
    if garment_id is not None:
        await wardrobe_rpc(data,'read_wardrobe',{'p_id':str(garment_id)})
    try:
        if photo is not None:
            image=await anyio.to_thread.run_sync(normalize_image,photo)
            image_id=uuid4()
            value=await wardrobe_rpc(data,'reserve_wardrobe_image',{
                'p_id':str(image_id),'p_sha256':hashlib.sha256(image).hexdigest(),'p_byte_size':len(image)})
            try: info=ImageInfo.model_validate(value)
            except ValidationError: raise DependencyUnavailable() from None
            expected_object=f'{data.principal.user_id}/{image_id}.jpg'
            if info.id!=image_id or info.object!=expected_object or info.byteSize!=len(image) or info.sha256!=hashlib.sha256(image).hexdigest():
                raise DependencyUnavailable()
            await storage(data,'POST','object/'+BUCKET+'/'+object_path(data,info.object),content=image)
        result=await wardrobe_rpc(data,'write_wardrobe',{'p_changes':changes,'p_id':str(garment_id) if garment_id else None,
                                                       'p_image_id':str(image_id) if image_id else None})
    except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException,ValidationError):
        if image_id:
            try: await wardrobe_rpc(data,'abandon_wardrobe_image',{'p_id':str(image_id)})
            except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException): pass
        await clean_images(data)
        raise
    await clean_images(data)
    return garment(result)


@router.post('/wardrobe',response_model=GarmentRead,status_code=201)
async def create_garment(request:Request,data:Data):
    return await save(request,data)


@router.patch('/wardrobe/{garment_id}',status_code=204)
async def patch_garment(garment_id:UUID,request:Request,data:Data):
    await save(request,data,garment_id)
    return Response(status_code=204)


@router.get('/wardrobe/{garment_id}',response_model=GarmentRead)
async def get_garment(garment_id:UUID,data:Data):
    return garment(await wardrobe_rpc(data,'read_wardrobe',{'p_id':str(garment_id)}))


@router.delete('/wardrobe/{garment_id}',status_code=204)
async def delete_garment(garment_id:UUID,data:Data):
    await wardrobe_rpc(data,'delete_wardrobe',{'p_id':str(garment_id)})
    await clean_images(data)
    return Response(status_code=204)


@router.get('/wardrobe',response_model=GarmentPage)
async def list_garments(data:Data,search:Annotated[str,Query(max_length=200)]='',
    category:Category|Literal['']='',sort:Literal['newest','name']='newest',
    limit:Annotated[int,Query(ge=1,le=100)]=24,cursor:Annotated[str|None,Query(max_length=4000)]=None):
    filters={'search':search,'category':category,'sort':sort}
    position=None
    if cursor:
        try:
            decoded=json.loads(base64.b64decode(cursor,altchars=b'-_',validate=True))
            if set(decoded)!={'owner','filters','position'} or decoded['owner']!=str(data.principal.user_id) or decoded['filters']!=filters: raise ValueError()
            position=decoded['position']
            if set(position)!={'id','value'}: raise ValueError()
            UUID(position['id'])
            if not isinstance(position['value'],str) or len(position['value'])>200: raise ValueError()
            if sort=='newest' and datetime.fromisoformat(position['value']).tzinfo is None: raise ValueError()
        except (ValueError,KeyError,TypeError): raise HTTPException(422,'Invalid collection cursor.') from None
    result=await wardrobe_rpc(data,'list_wardrobe',{'p_search':search,'p_category':category,'p_sort':sort,'p_limit':limit,'p_cursor':position})
    try:
        next_position=result['nextCursor']
        token=base64.urlsafe_b64encode(json.dumps({'owner':str(data.principal.user_id),'filters':filters,'position':next_position}).encode()).decode() if next_position else None
        return GarmentPage(items=[garment(item) for item in result['items']],nextCursor=token)
    except (ValidationError,KeyError,TypeError): raise DependencyUnavailable() from None


@router.get('/wardrobe/{garment_id}/image')
async def garment_image(garment_id:UUID,data:Data):
    try:
        info=ImageInfo.model_validate(await wardrobe_rpc(data,'wardrobe_image_info',{'p_garment_id':str(garment_id)}))
    except ValidationError: raise DependencyUnavailable() from None
    content=await storage(data,'GET','object/authenticated/'+BUCKET+'/'+object_path(data,info.object))
    if len(content)!=info.byteSize or hashlib.sha256(content).hexdigest()!=info.sha256: raise DependencyUnavailable()
    image=await anyio.to_thread.run_sync(normalize_image,content)
    return Response(image,media_type='image/jpeg',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
