"""Authenticated deterministic rules-v1 recommendations, with no external AI service."""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictStr, ValidationError, field_validator, model_validator

from .errors import DependencyUnavailable
from .foundation import Data, rpc
from .wardrobe import Short

Occasion=Literal['Everyday','Work','Evening','Weekend','Special occasion']


class RecommendationRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    occasion: Occasion
    preferences: Annotated[StrictStr,Field(max_length=2000)]=''
    wardrobeOnly: StrictBool
    limit: Annotated[int,Field(ge=1,le=10,strict=True)]=5

    @field_validator('preferences')
    @classmethod
    def safe_text(cls,value):
        if '\x00' in value: raise ValueError('Invalid preferences.')
        return value


class RecommendationItem(BaseModel):
    model_config=ConfigDict(extra='forbid')
    source: Literal['wardrobe','catalog']
    garmentId: UUID
    name: Annotated[StrictStr,Field(min_length=1,max_length=200)]
    category: Literal['Tops','Bottoms','Dresses','Shoes']
    color: Short


class Recommendation(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: UUID
    requestId: UUID
    savedId: UUID | None = None
    name: Annotated[StrictStr,Field(min_length=1,max_length=250)]
    description: StrictStr
    occasion: Occasion
    garmentIds: list[UUID]
    items: Annotated[list[RecommendationItem],Field(min_length=2,max_length=2)]
    score: Annotated[int,Field(ge=0,le=100,strict=True)]
    reasons: Annotated[list[Annotated[StrictStr,Field(min_length=1,max_length=300)]],Field(min_length=1,max_length=6)]
    engineVersion: Literal['rules-v1']
    generatedAt: datetime

    @model_validator(mode='after')
    def consistent(self):
        if self.garmentIds!=[i.garmentId for i in self.items if i.source=='wardrobe'] or self.generatedAt.tzinfo is None:
            raise ValueError('Invalid recommendation projection.')
        if (self.items[0].category,self.items[1].category) not in [('Tops','Bottoms'),('Dresses','Shoes')]:
            raise ValueError('Invalid recommendation composition.')
        return self


class RecommendationPage(BaseModel):
    model_config=ConfigDict(extra='forbid')
    items: list[Recommendation]
    nextCursor: None


class RecommendationRoute(APIRoute):
    def get_route_handler(self):
        handler=super().get_route_handler()
        async def safe(request):
            try:return await handler(request)
            except RequestValidationError:raise HTTPException(422,'Invalid recommendation request.') from None
        return safe


router=APIRouter(route_class=RecommendationRoute)


def page(value,limit):
    try:
        result=RecommendationPage.model_validate(value)
        if len(result.items)>limit:raise ValueError()
        return result
    except (ValidationError,ValueError):raise DependencyUnavailable() from None


@router.post('/recommendations',response_model=RecommendationPage)
async def generate(body:RecommendationRequest,data:Data):
    return page(await rpc(data,'generate_recommendations',{'p_occasion':body.occasion,'p_preferences':body.preferences,
        'p_wardrobe_only':body.wardrobeOnly,'p_limit':body.limit}),body.limit)


@router.get('/recommendations',response_model=RecommendationPage)
async def recent(data:Data,limit:Annotated[int,Query(ge=1,le=50)]=10):
    return page(await rpc(data,'recent_recommendations',{'p_limit':limit}),limit)
