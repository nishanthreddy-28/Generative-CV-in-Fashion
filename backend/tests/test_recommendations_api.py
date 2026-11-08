"""Recommendation API contracts with external HTTP transport intercepted only in tests."""
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


def recommendation():
    one,two=str(uuid4()),str(uuid4())
    return {'id':str(uuid4()),'requestId':str(uuid4()),'name':'Everyday look 1','description':'Pairs pieces.',
        'occasion':'Everyday','garmentIds':[one], 'items':[
         {'source':'wardrobe','garmentId':one,'name':'Shirt','category':'Tops','color':'Blue'},
         {'source':'catalog','garmentId':two,'name':'Trousers','category':'Bottoms','color':'Black'}],
        'score':77,'reasons':['Pairs a top with bottoms (+60).'],'engineVersion':'rules-v1','generatedAt':'2026-11-08T10:00:00Z'}


@pytest.fixture
def client_data():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
    principal=Principal(uuid4(),int(time.time())+300,'recommendation-owner-token')
    app.dependency_overrides[verified_principal]=lambda:principal
    calls=[];history=[];faults={}
    def receive(request):
        calls.append(request)
        assert request.headers['authorization']=='Bearer recommendation-owner-token'
        assert request.headers['apikey']=='sb_publishable_test'
        assert request.headers['content-profile']=='api'
        operation=request.url.path.rsplit('/',1)[-1]
        if operation in faults:return faults[operation]
        if operation=='account_access':return httpx.Response(200,json={'userId':str(principal.user_id),'active':True})
        if operation=='generate_recommendations':history.append(recommendation())
        if operation in ['generate_recommendations','recent_recommendations']:
            return httpx.Response(200,json={'items':history[-1:] if operation=='generate_recommendations' else history,'nextCursor':None})
        raise AssertionError(operation)
    with TestClient(app) as client:
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:yield client,calls,faults,app
        finally:client.portal.call(app.state.transport.aclose)


def test_generation_explanation_history_and_exact_rpc_fields(client_data):
    client,calls,*_=client_data
    assert client.get('/recommendations').json()=={'items':[],'nextCursor':None}
    generated=client.post('/recommendations',json={'occasion':'Everyday','preferences':'Linen','wardrobeOnly':False,'limit':2})
    assert generated.status_code==200,generated.text
    row=generated.json()['items'][0]
    assert row['score']==77 and row['reasons'] and len(row['items'])==2 and row['engineVersion']=='rules-v1'
    assert client.get('/recommendations?limit=3').json()['items'][0]['id']==row['id']
    body=json.loads(next(r.content for r in calls if r.url.path.endswith('generate_recommendations')))
    assert body=={'p_occasion':'Everyday','p_preferences':'Linen','p_wardrobe_only':False,'p_limit':2}
    assert json.loads(calls[-1].content)=={'p_limit':3}


@pytest.mark.parametrize('payload',[{}, {'occasion':'Unknown','wardrobeOnly':True}, {'occasion':'Everyday','wardrobeOnly':'true'},
 {'occasion':'Everyday','wardrobeOnly':1},{'occasion':'Everyday','wardrobeOnly':True,'preferences':None},
 {'occasion':'Everyday','wardrobeOnly':True,'preferences':'x'*2001}, {'occasion':'Everyday','wardrobeOnly':True,'preferences':'bad\x00'},
 {'occasion':'Everyday','wardrobeOnly':True,'limit':0},{'occasion':'Everyday','wardrobeOnly':True,'limit':11},
 {'occasion':'Everyday','wardrobeOnly':True,'limit':True},{'occasion':'Everyday','wardrobeOnly':True,'owner_id':str(uuid4())},
 {'occasion':'Everyday','wardrobeOnly':True,'items':[]}])
def test_invalid_requests_do_not_generate(client_data,payload):
    client,calls,*_=client_data
    assert client.post('/recommendations',json=payload).status_code==422
    assert not any(r.url.path.endswith('generate_recommendations') for r in calls)


@pytest.mark.parametrize('limit',['0','51','not-a-number'])
def test_history_limit_validation(client_data,limit):
    client,calls,*_=client_data
    assert client.get('/recommendations?limit='+limit).status_code==422
    assert not any(r.url.path.endswith('recent_recommendations') for r in calls)


@pytest.mark.parametrize('method',['GET','POST'])
def test_missing_authentication_no_upstream_requests(client_data,method):
    client,calls,_,app=client_data;app.dependency_overrides.clear()
    assert client.request(method,'/recommendations',json={'occasion':'Everyday','wardrobeOnly':True}).status_code==401
    assert calls==[]


@pytest.mark.parametrize('operation',['generate_recommendations','recent_recommendations'])
@pytest.mark.parametrize('status,expected',[(401,401),(403,403),(500,503)])
def test_upstream_errors_do_not_leak_or_elevate(client_data,operation,status,expected):
    client,calls,faults,_=client_data
    faults[operation]=httpx.Response(status,json={'message':'sensitive upstream body'})
    response=client.post('/recommendations',json={'occasion':'Everyday','wardrobeOnly':True}) if operation.startswith('generate') else client.get('/recommendations')
    assert response.status_code==expected and 'sensitive upstream body' not in response.text
    assert all(r.headers['authorization']=='Bearer recommendation-owner-token' for r in calls)


def test_empty_and_malformed_results_are_distinct(client_data):
    client,_,faults,_=client_data
    faults['generate_recommendations']=httpx.Response(200,json={'items':[],'nextCursor':None})
    assert client.post('/recommendations',json={'occasion':'Everyday','wardrobeOnly':True}).json()['items']==[]
    for bad in [{'items':[{'name':'Invented'}],'nextCursor':None},{'items':[],'nextCursor':'not supported'}]:
        faults['generate_recommendations']=httpx.Response(200,json=bad)
        assert client.post('/recommendations',json={'occasion':'Everyday','wardrobeOnly':True}).status_code==503


def test_flag_remains_fail_closed():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+100,'token')
    with TestClient(app) as client:
        assert client.get('/recommendations').status_code==503
        assert client.post('/recommendations',json={'occasion':'Everyday','wardrobeOnly':True}).status_code==503
