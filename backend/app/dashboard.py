from fastapi import APIRouter
from pydantic import BaseModel,ConfigDict,Field,ValidationError
from typing import Annotated
from .foundation import Data,rpc
from .errors import DependencyUnavailable
Count=Annotated[int,Field(ge=0,strict=True)]
class Dashboard(BaseModel):
 model_config=ConfigDict(extra='forbid')
 wardrobeCount:Count
 savedOutfitCount:Count
 recommendationCount:Count
 savedRecommendationCount:Count
 tryOnJobCount:Count
router=APIRouter()
@router.get('/dashboard',response_model=Dashboard)
async def dashboard(data:Data):
 try:return Dashboard.model_validate(await rpc(data,'dashboard',{}))
 except ValidationError:raise DependencyUnavailable() from None
