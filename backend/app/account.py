"""Deletion endpoints: verified identity, deny-first request, restricted progress only."""
from typing import Annotated,Literal
from fastapi import APIRouter,Depends,Request,HTTPException
from pydantic import BaseModel,ConfigDict
from .dependencies import verified_principal
from .security import Principal
from .data_api import UserDataAPI
from .errors import DependencyUnavailable
from .foundation import rpc

router=APIRouter()
class DeletionRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    confirmation:Literal['DELETE']

async def deletion_data(request:Request,principal:Annotated[Principal,Depends(verified_principal)]):
    # Status/retry remain available to this subject after deny-first eligibility changes.
    if not request.app.state.settings.database_foundation_enabled:raise DependencyUnavailable()
    return UserDataAPI(request.app.state.settings,request.app.state.transport,principal)
Data=Annotated[UserDataAPI,Depends(deletion_data)]

@router.delete('/account',status_code=202)
async def delete_account(body:DeletionRequest,data:Data):
    response=await data.request('POST','rpc/request_account_deletion',body={'p_confirmation':body.confirmation})
    if response.status_code not in (200,204):
        try:code=response.json().get('code')
        except (ValueError,AttributeError):code=None
        if code=='DD002':raise HTTPException(403,'Sign in again within five minutes before requesting deletion.')
    # Reuse safe error translation; do not repeat the request or elevate credentials.
    if response.status_code==401:raise HTTPException(401,'Valid authentication required.')
    if response.status_code==403:raise HTTPException(403,'Access denied.')
    if response.status_code!=200:raise DependencyUnavailable()
    try:
        value=response.json()
        if not isinstance(value,dict) or value.get('status')!='deleting':raise ValueError()
        return value
    except ValueError:raise DependencyUnavailable() from None

@router.get('/account/deletion')
async def status(data:Data):
    value=await rpc(data,'account_deletion_status',{})
    if not isinstance(value,dict) or value.get('status') not in ('not_requested','deleting','complete'):raise DependencyUnavailable()
    return value
