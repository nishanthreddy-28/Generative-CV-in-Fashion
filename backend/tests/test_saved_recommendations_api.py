"""Saved HTTP contracts; only the external transport is intercepted in these tests."""
import base64
import json
import time
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.dependencies import verified_principal
from app.main import create_app
from app.security import Principal
from test_recommendations_api import recommendation


@pytest.fixture
def saved_client():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
    principal=Principal(uuid4(),int(time.time())+300,'saved-owner-token')
    app.dependency_overrides[verified_principal]=lambda:principal
    rec=recommendation();entries={};calls=[];faults={}
    def receive(request):
        calls.append(request)
        assert request.headers['authorization']=='Bearer saved-owner-token'
        assert request.headers['apikey']=='sb_publishable_test'
        assert request.headers['content-profile']=='api'
        operation=request.url.path.rsplit('/',1)[-1];body=json.loads(request.content)
        if operation in faults:return faults[operation]
        if operation=='account_access':return httpx.Response(200,json={'userId':str(principal.user_id),'active':True})
        if operation=='save_recommendation':
            if body['p_id']!=rec['id']:return httpx.Response(404,json={'code':'P0002'})
            created=not entries
            if not entries:
                ident=str(uuid4());row={**rec,'savedId':ident}
                entries[ident]={'id':ident,'recommendationId':rec['id'],'savedAt':'2026-11-09T00:00:00Z','available':True,'recommendation':row}
            return httpx.Response(200,json={**next(iter(entries.values())),'created':created})
        if operation=='list_saved_recommendations':return httpx.Response(200,json={'items':list(entries.values()),'nextCursor':None})
        if operation=='remove_saved_recommendation':
            if not entries.pop(body['p_id'],None):return httpx.Response(404,json={'code':'P0002'})
            return httpx.Response(204)
        raise AssertionError(operation)
    with TestClient(app) as client:
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:yield client,rec,entries,calls,faults,app,principal
        finally:client.portal.call(app.state.transport.aclose)


def test_save_idempotent_read_and_remove(saved_client):
    client,rec,_,calls,*_=saved_client
    assert client.get('/recommendations/saved').json()=={'items':[],'nextCursor':None}
    first=client.post('/recommendations/'+rec['id']+'/save');assert first.status_code==201,first.text
    second=client.post('/recommendations/'+rec['id']+'/save');assert second.status_code==200
    assert first.json()==second.json() and first.json()['recommendationId']==rec['id']
    ident=first.json()['id']
    assert client.get('/recommendations/saved').json()['items'][0]['id']==ident
    assert client.delete('/recommendations/saved/'+ident).status_code==204
    assert client.get('/recommendations/saved').json()['items']==[]
    assert all(r.headers['authorization']=='Bearer saved-owner-token' for r in calls)


@pytest.mark.parametrize('method,path',[('POST','/recommendations/'+str(uuid4())+'/save'),('GET','/recommendations/saved'),('DELETE','/recommendations/saved/'+str(uuid4()))])
def test_unauthenticated_no_upstream(saved_client,method,path):
    client,_,_,calls,_,app,_=saved_client;app.dependency_overrides.clear()
    assert client.request(method,path).status_code==401 and calls==[]


def test_missing_or_hidden_recommendation_and_saved_id(saved_client):
    client,*_=saved_client
    assert client.post('/recommendations/'+str(uuid4())+'/save').status_code==404
    assert client.delete('/recommendations/saved/'+str(uuid4())).status_code==404


def test_source_conflict_is_safe_and_does_not_retry_privileged(saved_client):
    client,rec,_,calls,faults,*_=saved_client
    faults['save_recommendation']=httpx.Response(400,json={'code':'DD001','message':'private source details'})
    response=client.post('/recommendations/'+rec['id']+'/save')
    assert response.status_code==409 and 'private source details' not in response.text
    assert sum(r.url.path.endswith('save_recommendation') for r in calls)==1


@pytest.mark.parametrize('body',[{'owner_id':str(uuid4())},{'items':[]},{'recommendationId':str(uuid4())},[]])
def test_client_override_payload_rejected(saved_client,body):
    client,rec,_,calls,*_=saved_client
    assert client.post('/recommendations/'+rec['id']+'/save',json=body).status_code==422
    assert not any(r.url.path.endswith('save_recommendation') for r in calls)


@pytest.mark.parametrize('query',['limit=0','limit=101','limit=wrong','cursor=bad'])
def test_invalid_list_query(saved_client,query):
    client,*_=saved_client
    assert client.get('/recommendations/saved?'+query).status_code==422


def test_opaque_cursor_owner_binding_and_availability(saved_client):
    client,_,_,calls,faults,_,principal=saved_client
    position={'id':str(uuid4()),'savedAt':'2026-11-09T00:00:00Z'}
    unavailable={'id':str(uuid4()),'recommendationId':str(uuid4()),'savedAt':'2026-11-09T00:00:00Z','available':False,'recommendation':None}
    faults['list_saved_recommendations']=httpx.Response(200,json={'items':[unavailable],'nextCursor':position})
    response=client.get('/recommendations/saved?limit=1');assert response.status_code==200
    cursor=response.json()['nextCursor'];assert response.json()['items'][0]['recommendation'] is None
    assert client.get('/recommendations/saved',params={'cursor':cursor}).status_code==200
    assert json.loads(calls[-1].content)['p_cursor']==position
    for owner,pos in [(str(uuid4()),position),(str(principal.user_id),{'id':42,'savedAt':'invalid'})]:
        token=base64.urlsafe_b64encode(json.dumps({'version':1,'owner':owner,'position':pos}).encode()).decode()
        assert client.get('/recommendations/saved',params={'cursor':token}).status_code==422


@pytest.mark.parametrize('operation,method,path',[('save_recommendation','POST','/recommendations/{id}/save'),('remove_saved_recommendation','DELETE','/recommendations/saved/{id}'),('list_saved_recommendations','GET','/recommendations/saved')])
@pytest.mark.parametrize('status,expected',[(401,401),(403,403),(500,503)])
def test_dependency_errors_not_exposed(saved_client,operation,method,path,status,expected):
    client,rec,_,_,faults,*_=saved_client
    faults[operation]=httpx.Response(status,json={'message':'secret upstream data'})
    response=client.request(method,path.format(id=rec['id']))
    assert response.status_code==expected and 'secret upstream data' not in response.text


def test_malformed_dependency_not_fabricated_success(saved_client):
    client,rec,_,_,faults,*_=saved_client
    faults['save_recommendation']=httpx.Response(200,json={'created':True,'id':str(uuid4())})
    assert client.post('/recommendations/'+rec['id']+'/save').status_code==503
    faults['list_saved_recommendations']=httpx.Response(200,json={'items':[{'id':str(uuid4())}],'nextCursor':None})
    assert client.get('/recommendations/saved').status_code==503


def test_disabled_feature_flag_fails_closed():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+100,'token')
    with TestClient(app) as client:
        assert client.get('/recommendations/saved').status_code==503
        assert client.post('/recommendations/'+str(uuid4())+'/save').status_code==503
        assert client.delete('/recommendations/saved/'+str(uuid4())).status_code==503
