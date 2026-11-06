import asyncio
import json
import time
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.data_api import UserDataAPI
from app.dependencies import DatabaseEligibility, verified_principal
from app.errors import DependencyUnavailable, Forbidden, Unauthorized
from app.main import create_app
from app.security import Principal


def settings():
    return Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True)


@pytest.mark.parametrize('payload,error', [
    ({'active':False}, Forbidden), ({'active':'true'},DependencyUnavailable),
    ({},DependencyUnavailable), ([],DependencyUnavailable),
])
async def test_eligibility_fails_closed(payload,error):
    principal = Principal(uuid4(),int(time.time())+60,'unit-token')
    if isinstance(payload,dict): payload={**payload,'userId':str(principal.user_id)}
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(200,json=payload))) as transport:
        with pytest.raises(error):
            await DatabaseEligibility().require_active(principal,UserDataAPI(settings(),transport,principal))


async def test_eligibility_rejects_different_database_identity():
    principal=Principal(uuid4(),int(time.time())+60,'unit-token')
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'userId':str(uuid4()),'active':True}))) as transport:
        with pytest.raises(DependencyUnavailable):
            await DatabaseEligibility().require_active(principal,UserDataAPI(settings(),transport,principal))


@pytest.mark.parametrize('status,error',[(401,Unauthorized),(403,Forbidden),(404,DependencyUnavailable),(500,DependencyUnavailable)])
async def test_eligibility_dependency_status(status,error):
    principal=Principal(uuid4(),int(time.time())+60,'unit-token')
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(status))) as transport:
        with pytest.raises(error): await DatabaseEligibility().require_active(principal,UserDataAPI(settings(),transport,principal))


async def test_api_schema_and_current_tokens_are_isolated():
    observed=[]
    async def receive(request):
        await asyncio.sleep(0)
        observed.append((request.headers['authorization'],request.headers.get('content-profile'),request.headers.get('accept-profile')))
        return httpx.Response(200,json={})
    async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as transport:
        a=UserDataAPI(settings(),transport,Principal(uuid4(),int(time.time())+60,'A'))
        b=UserDataAPI(settings(),transport,Principal(uuid4(),int(time.time())+60,'B'))
        await asyncio.gather(a.request('POST','rpc/read_profile',body={}),b.request('GET','rpc/read_profile'))
    assert sorted(observed)==[('Bearer A','api',None),('Bearer B',None,'api')]


@pytest.fixture
def client():
    principal=Principal(uuid4(),int(time.time())+60,'unit-token')
    app=create_app(settings())
    app.dependency_overrides[verified_principal]=lambda:principal
    calls=[]
    def receive(request):
        assert request.headers['authorization']=='Bearer unit-token'
        assert request.headers['apikey']=='sb_publishable_test'
        assert request.headers['content-profile']=='api'
        operation=request.url.path.rsplit('/',1)[-1]
        calls.append((operation,json.loads(request.content)))
        if operation=='account_access': return httpx.Response(200,json={'userId':str(principal.user_id),'active':True,'isCatalogAdmin':False})
        if operation=='read_profile': return httpx.Response(200,json={'name':'','style':'','location':'','bio':''})
        if operation=='read_preferences': return httpx.Response(200,json={'units':'','emailNotifications':''})
        return httpx.Response(204)
    with TestClient(app) as browser:
        # Substitute only the external transport for contract tests, never application data.
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:
            yield browser,calls,app
        finally:
            browser.portal.call(app.state.transport.aclose)


def test_existing_profile_settings_contracts(client):
    browser,calls,_=client
    assert browser.get('/profile').json()=={'name':'','style':'','location':'','bio':''}
    assert browser.get('/settings').json()=={'units':'','emailNotifications':''}
    response=browser.patch('/profile',json={'name':'Name','style':'','location':'','bio':''})
    assert response.status_code==204 and response.content==b''
    assert browser.patch('/settings',json={'units':'in','emailNotifications':'Disabled'}).status_code==204
    assert ('update_preferences',{'p_units':'in','p_email_notifications':'Disabled'}) in calls


@pytest.mark.parametrize('path,body',[
    ('/profile',{'name':'Bad','user_id':str(uuid4())}),
    ('/profile',{'name':'  '}),('/profile',{'name':123}),
    ('/settings',{'units':'meters'}),('/settings',{'role':'admin'}),
    ('/settings',{'emailNotifications':True}),
])
def test_overposting_and_invalid_fields_are_rejected(client,path,body):
    browser,calls,_=client
    assert browser.patch(path,json=body).status_code==422
    assert not any(operation.startswith('update_') for operation,_ in calls)


def test_lifecycle_change_between_dependency_and_mutation_is_denied(client):
    browser,_,app=client
    principal=app.dependency_overrides[verified_principal]()
    def receive(request):
        if request.url.path.endswith('account_access'):
            return httpx.Response(200,json={'userId':str(principal.user_id),'active':True})
        return httpx.Response(403,json={'code':'42501'})
    browser.portal.call(app.state.transport.aclose)
    app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
    assert browser.patch('/profile',json={'name':'Allowed before deletion'}).status_code==403


def test_routes_are_closed_without_configuration():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+60,'test')
    with TestClient(app) as browser:
        assert browser.get('/profile').status_code==503
        assert browser.get('/settings').status_code==503
        assert browser.get('/profile/body').status_code==404
        assert browser.request('DELETE','/account',json={'confirmation':'DELETE'}).status_code==404
