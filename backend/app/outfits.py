"""Atomic, current-user manual outfit creation and retrieval; no privileged fallback."""
import base64
import json
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError, field_validator, model_validator

from .errors import DependencyUnavailable
from .foundation import Data, rpc
from .wardrobe import Category


class OutfitItem(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source: Literal['wardrobe', 'catalog']
    garmentId: UUID


class OutfitCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: Annotated[StrictStr, Field(min_length=1, max_length=200)]
    description: Annotated[StrictStr, Field(max_length=2000)] = ''
    occasion: Annotated[StrictStr, Field(max_length=200)] = ''
    garmentIds: Annotated[list[UUID], Field(min_length=2, max_length=100)] | None = None
    items: Annotated[list[OutfitItem], Field(min_length=2, max_length=100)] | None = None

    @field_validator('name', 'description', 'occasion')
    @classmethod
    def valid_text(cls, value):
        if '\x00' in value: raise ValueError('Invalid text.')
        return value

    @field_validator('name')
    @classmethod
    def nonblank(cls, value):
        if not value.strip(): raise ValueError('Name is required.')
        return value.strip()

    @model_validator(mode='after')
    def valid_items(self):
        # Explicit null and competing representations are not alternative sources of truth.
        if ('items' in self.model_fields_set) == ('garmentIds' in self.model_fields_set):
            raise ValueError('Provide exactly one item representation.')
        values = self.references()
        if values is None or len(values) < 2:
            raise ValueError('Select at least two items.')
        if len({(item.source, item.garmentId) for item in values}) != len(values):
            raise ValueError('Duplicate outfit item.')
        return self

    def references(self):
        return self.items if 'items' in self.model_fields_set else (
            [OutfitItem(source='wardrobe', garmentId=ident) for ident in self.garmentIds]
            if self.garmentIds is not None else None)


class StoredOutfitItem(OutfitItem):
    id: UUID


class RecommendationSave(BaseModel):
    model_config=ConfigDict(extra='forbid')
    recommendationId:UUID


class OutfitRead(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    name: Annotated[StrictStr, Field(min_length=1, max_length=200)]
    description: Annotated[StrictStr, Field(max_length=2000)]
    occasion: Annotated[StrictStr, Field(max_length=200)]
    garmentIds: list[UUID]
    items: Annotated[list[StoredOutfitItem], Field(min_length=2, max_length=100)]

    @model_validator(mode='after')
    def consistent_projection(self):
        if self.garmentIds != [item.garmentId for item in self.items if item.source == 'wardrobe']:
            raise ValueError('Inconsistent wardrobe projection.')
        if len({(item.source,item.garmentId) for item in self.items}) != len(self.items):
            raise ValueError('Duplicate item projection.')
        return self


class OutfitPage(BaseModel):
    model_config = ConfigDict(extra='forbid')
    items: list[OutfitRead]
    nextCursor: str | None


class OutfitRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        async def safe(request):
            try: return await handler(request)
            except RequestValidationError:
                raise HTTPException(422, 'Invalid outfit request.') from None
        return safe


router = APIRouter(route_class=OutfitRoute)


def record(value):
    try: return OutfitRead.model_validate(value)
    except ValidationError: raise DependencyUnavailable() from None


@router.post('/outfits', response_model=OutfitRead, status_code=201)
async def create_outfit(body: OutfitCreate | RecommendationSave, data: Data):
    if isinstance(body,RecommendationSave):
        return record(await rpc(data,'save_recommendation_outfit',{'p_id':str(body.recommendationId)},missing_detail='Recommendation or garment unavailable.'))
    return record(await rpc(data, 'create_outfit', {
        'p_name':body.name, 'p_description':body.description, 'p_occasion':body.occasion,
        'p_items':[item.model_dump(mode='json') for item in body.references()],
    }, missing_detail='Garment unavailable.'))


@router.get('/outfits/{outfit_id}', response_model=OutfitRead)
async def read_outfit(outfit_id: UUID, data: Data):
    return record(await rpc(data, 'read_outfit', {'p_id':str(outfit_id)}, missing_detail='Outfit not found.'))


def cursor_position(value, sort='newest'):
    keys={'id','createdAt'} | ({'name'} if sort=='name' else set())
    if not isinstance(value,dict) or set(value)!=keys: raise ValueError()
    if not isinstance(value['id'],str) or not isinstance(value['createdAt'],str): raise ValueError()
    UUID(value['id'])
    if datetime.fromisoformat(value['createdAt']).tzinfo is None: raise ValueError()
    if sort=='name' and (not isinstance(value['name'],str) or len(value['name'])>200 or '\x00' in value['name']): raise ValueError()
    return value


def instant(value):
    if value is None: return None
    if value.tzinfo is None or value.utcoffset() is None: raise HTTPException(422,'Creation dates require a timezone.')
    try: return value.astimezone(timezone.utc).isoformat()
    except (ValueError,OverflowError): raise HTTPException(422,'Creation date is outside the supported range.') from None


@router.get('/outfits', response_model=OutfitPage)
async def list_outfits(data: Data, limit: Annotated[int, Query(ge=1, le=100)] = 24,
    cursor: Annotated[str | None, Query(max_length=4000)] = None,
    search: Annotated[str,Query(max_length=200)] = '', category: Category | Literal[''] = '',
    source: Literal['','wardrobe','catalog'] = '', sort: Literal['newest','name'] = 'newest',
    created_from: datetime | None = None, created_before: datetime | None = None):
    if '\x00' in search: raise HTTPException(422,'Invalid outfit search.')
    start,end=instant(created_from),instant(created_before)
    if start is not None and end is not None and created_from>=created_before:
        raise HTTPException(422,'Creation date range must have an increasing end.')
    filters={'search':search.strip(),'category':category,'source':source,'sort':sort,'created_from':start,'created_before':end}
    position=None
    if cursor:
        try:
            value=json.loads(base64.b64decode(cursor,altchars=b'-_',validate=True))
            if not isinstance(value,dict) or set(value)!={'version','owner','filters','position'} or value['version']!=2 or value['owner']!=str(data.principal.user_id) or value['filters']!=filters:
                raise ValueError()
            position=cursor_position(value['position'],sort)
        except (ValueError,TypeError,KeyError,OverflowError,RecursionError):
            raise HTTPException(422,'Invalid outfit cursor or changed filters.') from None
    result=await rpc(data,'query_outfits',{'p_limit':limit,'p_cursor':position,**{'p_'+key:value for key,value in filters.items()}})
    try:
        if not isinstance(result,dict) or set(result)!={'items','nextCursor'} or not isinstance(result['items'],list) or len(result['items'])>limit: raise ValueError()
        next_position=cursor_position(result['nextCursor'],sort) if result['nextCursor'] is not None else None
        token=base64.urlsafe_b64encode(json.dumps({'version':2,'owner':str(data.principal.user_id),'filters':filters,'position':next_position}).encode()).decode() if next_position else None
        return OutfitPage(items=[record(item) for item in result['items']],nextCursor=token)
    except (ValueError,TypeError,KeyError,OverflowError):
        raise DependencyUnavailable() from None


class OutfitPatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: Annotated[StrictStr, Field(min_length=1,max_length=200)] | None = None
    description: Annotated[StrictStr, Field(max_length=2000)] | None = None
    occasion: Annotated[StrictStr, Field(max_length=200)] | None = None

    @field_validator('*',mode='before')
    @classmethod
    def valid_text(cls,value,info):
        if not isinstance(value,str) or '\x00' in value or (info.field_name=='name' and not value.strip()):
            raise ValueError('Invalid outfit fields.')
        return value.strip() if info.field_name=='name' else value


class OutfitReplacement(BaseModel):
    model_config = ConfigDict(extra='forbid')
    items: Annotated[list[OutfitItem],Field(min_length=2,max_length=100)]

    @model_validator(mode='after')
    def unique_items(self):
        if len({(item.source,item.garmentId) for item in self.items})!=len(self.items):
            raise ValueError('Duplicate outfit item.')
        return self


@router.patch('/outfits/{outfit_id}',status_code=204)
async def patch_outfit(outfit_id:UUID,body:OutfitPatch,data:Data):
    await rpc(data,'update_outfit',{'p_id':str(outfit_id),'p_changes':body.model_dump(exclude_unset=True)},missing_detail='Outfit not found.')
    return Response(status_code=204)


async def change_items(data,outfit_id,operation,items=None,item_id=None):
    return record(await rpc(data,'manage_outfit_items',{'p_id':str(outfit_id),'p_operation':operation,
        'p_items':items,'p_item_id':str(item_id) if item_id else None},missing_detail='Outfit, item or garment unavailable.'))


@router.put('/outfits/{outfit_id}/items',response_model=OutfitRead)
async def replace_items(outfit_id:UUID,body:OutfitReplacement,data:Data):
    return await change_items(data,outfit_id,'replace',[item.model_dump(mode='json') for item in body.items])


@router.post('/outfits/{outfit_id}/items',response_model=OutfitRead,status_code=201)
async def add_item(outfit_id:UUID,body:OutfitItem,data:Data):
    return await change_items(data,outfit_id,'add',[body.model_dump(mode='json')])


@router.delete('/outfits/{outfit_id}/items/{item_id}',response_model=OutfitRead)
async def remove_item(outfit_id:UUID,item_id:UUID,data:Data):
    return await change_items(data,outfit_id,'remove',item_id=item_id)


@router.delete('/outfits/{outfit_id}',status_code=204)
async def delete_outfit(outfit_id:UUID,data:Data):
    await rpc(data,'delete_outfit',{'p_id':str(outfit_id)},missing_detail='Outfit not found.')
    return Response(status_code=204)
