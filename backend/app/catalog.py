"""Catalog reads and administrator mutations with immutable private images, current-user RPCs and no elevated fallback."""
import base64
import hashlib
import json
import logging
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from decimal import Decimal, InvalidOperation
from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError, field_validator

from .errors import DependencyUnavailable, Forbidden, Unauthorized
from .foundation import Data, rpc
from .data_api import UserDataAPI
from .wardrobe import fields_and_image, normalize_image, storage

MAX_IMAGE = 10 * 1024 * 1024
BUCKET = 'catalog-images'
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
    def valid_text(cls, value, info):
        if info.field_name=='price': return value
        if value is None or isinstance(value,str) and '\x00' in value:
            raise ValueError('Use valid text; blank optional text clears the field.')
        return value

    @field_validator('name')
    @classmethod
    def name_not_blank(cls,value):
        if not value.strip(): raise ValueError('Name must not be blank.')
        return value.strip()


    price: float | None = None

    @field_validator('price', mode='before')
    @classmethod
    def valid_price(cls, value):
        if value is None: return None
        if isinstance(value,bool) or not isinstance(value,(float,int)):
            raise ValueError('Use a numeric price.')
        try:
            price=Decimal(str(value))
            if not price.is_finite() or not 0<=price<=1000000 or price.as_tuple().exponent < -2:
                raise ValueError('Use a price with at most two decimal places.')
        except InvalidOperation: raise ValueError('Invalid price.') from None
        return value


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
    price: float | None
    active: bool
    imageUrl: Annotated[StrictStr,Field(pattern=r'^/catalog/[0-9a-f-]{36}/image$')]


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


class CatalogRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        async def safe(request):
            try: return await handler(request)
            except RequestValidationError:
                raise HTTPException(422,'Invalid catalog request.') from None
        return safe


router = APIRouter(route_class=CatalogRoute)


def garment(value) -> GarmentRead:
    try: return GarmentRead.model_validate(value)
    except ValidationError: raise DependencyUnavailable() from None


async def catalog_rpc(data, operation, body):
    return await rpc(data,operation,body,missing_detail='Garment or image not found.')


def object_path(data, value: str):
    try:
        parts=value.split('/')
        if len(parts)!=2 or parts[0]!='catalog' or not parts[1].endswith('.jpg'):
            raise ValueError()
        UUID(parts[1][:-4])
    except (ValueError,AttributeError): raise DependencyUnavailable() from None
    return value


async def clean_images(data):
    # Metadata deletion is atomic; uncertain external deletion remains durably retryable.
    try:
        pending=await catalog_rpc(data,'catalog_image_cleanup',{})
        if not isinstance(pending,list): raise DependencyUnavailable()
        for item in pending[:10]:
            path=object_path(data,item['object'])
            await storage(data,'DELETE','object/'+BUCKET,body={'prefixes':[path]})
            await catalog_rpc(data,'catalog_image_cleanup',{'p_finished':str(UUID(item['id']))})
    except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException,KeyError,ValueError,TypeError):
        logger.warning('Catalog image cleanup remains pending; reconciliation is required.')
        return


async def save(request,data,garment_id=None):
    changes,photo=await fields_and_image(request,garment_id is None,models=(GarmentCreate,GarmentPatch))
    image_id=None
    if garment_id is not None:
        await catalog_rpc(data,'read_catalog',{'p_id':str(garment_id),'p_admin':True})
    try:
        if photo is not None:
            image=await anyio.to_thread.run_sync(normalize_image,photo)
            image_id=uuid4()
            value=await catalog_rpc(data,'reserve_catalog_image',{
                'p_id':str(image_id),'p_sha256':hashlib.sha256(image).hexdigest(),'p_byte_size':len(image)})
            try: info=ImageInfo.model_validate(value)
            except ValidationError: raise DependencyUnavailable() from None
            expected_object=f'catalog/{image_id}.jpg'
            if info.id!=image_id or info.object!=expected_object or info.byteSize!=len(image) or info.sha256!=hashlib.sha256(image).hexdigest():
                raise DependencyUnavailable()
            await storage(data,'POST','object/'+BUCKET+'/'+object_path(data,info.object),content=image)
        result=await catalog_rpc(data,'write_catalog',{'p_changes':changes,'p_id':str(garment_id) if garment_id else None,
                                                       'p_image_id':str(image_id) if image_id else None})
    except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException,ValidationError):
        if image_id:
            try: await catalog_rpc(data,'abandon_catalog_image',{'p_id':str(image_id)})
            except (DependencyUnavailable,Unauthorized,Forbidden,HTTPException): pass
        await clean_images(data)
        raise
    await clean_images(data)
    return garment(result)


async def catalog_access(data):
    value=await rpc(data,'account_access',{})
    if not isinstance(value,dict) or value.get('userId')!=str(data.principal.user_id) or value.get('active') is not True or not isinstance(value.get('isCatalogAdmin'),bool):
        raise DependencyUnavailable()
    return {'userId':value['userId'],'isCatalogAdmin':value['isCatalogAdmin']}


async def administrator(data: Data):
    if not (await catalog_access(data))['isCatalogAdmin']: raise Forbidden()
    return data


Admin = Annotated[UserDataAPI, Depends(administrator)]


@router.get('/admin/catalog/access')
async def access(data: Data):
    return await catalog_access(data)


@router.post('/admin/catalog',response_model=GarmentRead,status_code=201)
async def create_garment(request:Request,data:Admin):
    return await save(request,data)


@router.patch('/admin/catalog/{garment_id}',status_code=204)
async def patch_garment(garment_id:UUID,request:Request,data:Admin):
    await save(request,data,garment_id)
    return Response(status_code=204)


async def get_garment(garment_id:UUID,data:Data,*,admin:bool=False):
    return garment(await catalog_rpc(data,'read_catalog',{'p_id':str(garment_id),'p_admin':admin}))


@router.delete('/admin/catalog/{garment_id}',status_code=204)
async def delete_garment(garment_id:UUID,data:Admin):
    await catalog_rpc(data,'delete_catalog',{'p_id':str(garment_id)})
    return Response(status_code=204)


async def list_garments(data:Data,search:Annotated[str,Query(max_length=200)]='',
    category:Category|Literal['']='',sort:Literal['newest','name']='newest',
    limit:Annotated[int,Query(ge=1,le=100)]=24,cursor:Annotated[str|None,Query(max_length=4000)]=None,*,admin:bool=False):
    filters={'search':search,'category':category,'sort':sort,'admin':admin}
    position=None
    if cursor:
        try:
            decoded=json.loads(base64.b64decode(cursor,altchars=b'-_',validate=True))
            if set(decoded)!={'owner','filters','position'} or decoded['owner']!=str(data.principal.user_id) or decoded['filters']!=filters: raise ValueError()
            position=decoded['position']
            if set(position)!={'id','value'}: raise ValueError()
            if not isinstance(position['id'],str): raise ValueError()
            UUID(position['id'])
            if not isinstance(position['value'],str) or len(position['value'])>200: raise ValueError()
            if sort=='newest' and datetime.fromisoformat(position['value']).tzinfo is None: raise ValueError()
        except (ValueError,KeyError,TypeError): raise HTTPException(422,'Invalid collection cursor.') from None
    result=await catalog_rpc(data,'list_catalog',{'p_search':search,'p_category':category,'p_sort':sort,'p_limit':limit,'p_cursor':position,'p_admin':admin})
    try:
        next_position=result['nextCursor']
        token=base64.urlsafe_b64encode(json.dumps({'owner':str(data.principal.user_id),'filters':filters,'position':next_position}).encode()).decode() if next_position else None
        return GarmentPage(items=[garment(item) for item in result['items']],nextCursor=token)
    except (ValidationError,KeyError,TypeError): raise DependencyUnavailable() from None


async def garment_image(garment_id:UUID,data:Data,*,admin:bool=False):
    try:
        info=ImageInfo.model_validate(await catalog_rpc(data,'catalog_image_info',{'p_garment_id':str(garment_id),'p_admin':admin}))
    except ValidationError: raise DependencyUnavailable() from None
    content=await storage(data,'GET','object/authenticated/'+BUCKET+'/'+object_path(data,info.object))
    if len(content)!=info.byteSize or hashlib.sha256(content).hexdigest()!=info.sha256: raise DependencyUnavailable()
    image=await anyio.to_thread.run_sync(normalize_image,content)
    return Response(image,media_type='image/jpeg',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})


@router.get('/catalog/{garment_id}',response_model=GarmentRead)
async def read_item(garment_id:UUID,data:Data):
    return await get_garment(garment_id,data)


@router.get('/admin/catalog/{garment_id}',response_model=GarmentRead)
async def admin_read_item(garment_id:UUID,data:Admin):
    return await get_garment(garment_id,data,admin=True)


@router.get('/catalog/{garment_id}/image')
async def read_image(garment_id:UUID,data:Data):
    return await garment_image(garment_id,data)


@router.get('/admin/catalog/{garment_id}/image')
async def admin_read_image(garment_id:UUID,data:Admin):
    return await garment_image(garment_id,data,admin=True)


@router.get('/catalog',response_model=GarmentPage)
async def list_items(data:Data,search:Annotated[str,Query(max_length=200)]='',
    category:Category|Literal['']='',sort:Literal['newest','name']='newest',
    limit:Annotated[int,Query(ge=1,le=100)]=24,cursor:Annotated[str|None,Query(max_length=4000)]=None):
    return await list_garments(data,search,category,sort,limit,cursor,admin=False)


@router.get('/admin/catalog',response_model=GarmentPage)
async def admin_list_items(data:Admin,search:Annotated[str,Query(max_length=200)]='',
    category:Category|Literal['']='',sort:Literal['newest','name']='newest',
    limit:Annotated[int,Query(ge=1,le=100)]=24,cursor:Annotated[str|None,Query(max_length=4000)]=None):
    return await list_garments(data,search,category,sort,limit,cursor,admin=True)
