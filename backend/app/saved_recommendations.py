"""Owner-scoped saved links with source availability checks and cursor pagination."""
import base64
import json
from datetime import datetime
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Query, Response, HTTPException
from pydantic import BaseModel, ConfigDict, StrictBool, ValidationError, model_validator
from .foundation import Data, rpc
from .errors import DependencyUnavailable
from .recommendations import RecommendationRoute, Recommendation

router=APIRouter(route_class=RecommendationRoute)


class SaveBody(BaseModel):
    model_config=ConfigDict(extra='forbid')


class SavedRecommendation(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: UUID
    recommendationId: UUID
    savedAt: datetime
    available: StrictBool
    recommendation: Recommendation | None

    @model_validator(mode='after')
    def consistent(self):
        if self.savedAt.tzinfo is None or self.available!=(self.recommendation is not None):raise ValueError()
        if self.recommendation and self.recommendation.id!=self.recommendationId:raise ValueError()
        return self


class SavedPage(BaseModel):
    items: list[SavedRecommendation]
    nextCursor: str | None


def position(value):
    if not isinstance(value,dict) or set(value)!={'id','savedAt'} or not all(isinstance(v,str) for v in value.values()):raise ValueError()
    UUID(value['id'])
    if datetime.fromisoformat(value['savedAt']).tzinfo is None:raise ValueError()
    return value


@router.post('/recommendations/{recommendation_id}/save',response_model=SavedRecommendation)
async def save(recommendation_id:UUID,data:Data,response:Response,body:SaveBody|None=None):
    value=await rpc(data,'save_recommendation',{'p_id':str(recommendation_id)},missing_detail='Recommendation not found.',
        conflict_detail='A referenced garment is unavailable, or the saved entry changed. Refresh and retry.')
    try:
        if not isinstance(value,dict) or not isinstance(value.get('created'),bool):raise ValueError()
        response.status_code=201 if value['created'] else 200
        return SavedRecommendation.model_validate({k:v for k,v in value.items() if k!='created'})
    except (ValueError,ValidationError):raise DependencyUnavailable() from None


@router.get('/recommendations/saved',response_model=SavedPage)
async def saved(data:Data,limit:Annotated[int,Query(ge=1,le=100)]=24,cursor:Annotated[str|None,Query(max_length=4000)]=None):
    cursor_value=None
    if cursor:
        try:
            value=json.loads(base64.b64decode(cursor,altchars=b'-_',validate=True))
            if not isinstance(value,dict) or set(value)!={'version','owner','position'} or value['version']!=1 or value['owner']!=str(data.principal.user_id):raise ValueError()
            cursor_value=position(value['position'])
        except (ValueError,TypeError,KeyError,OverflowError,RecursionError):raise HTTPException(422,'Invalid saved recommendation cursor.') from None
    value=await rpc(data,'list_saved_recommendations',{'p_limit':limit,'p_cursor':cursor_value})
    try:
        if not isinstance(value,dict) or set(value)!={'items','nextCursor'} or not isinstance(value['items'],list) or len(value['items'])>limit:raise ValueError()
        next_position=position(value['nextCursor']) if value['nextCursor'] is not None else None
        token=base64.urlsafe_b64encode(json.dumps({'version':1,'owner':str(data.principal.user_id),'position':next_position}).encode()).decode() if next_position else None
        return SavedPage(items=[SavedRecommendation.model_validate(item) for item in value['items']],nextCursor=token)
    except (ValueError,TypeError,KeyError,OverflowError):raise DependencyUnavailable() from None


@router.delete('/recommendations/saved/{saved_id}',status_code=204)
async def remove(saved_id:UUID,data:Data):
    await rpc(data,'remove_saved_recommendation',{'p_id':str(saved_id)},missing_detail='Saved recommendation not found.')
    return Response(status_code=204)
