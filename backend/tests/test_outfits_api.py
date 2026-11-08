"""HTTP contract tests intercept external transport only; RLS has a separate real-PG suite."""
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


@pytest.fixture
def outfits_client():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
    principal=Principal(uuid4(),int(time.time())+300,'outfits-owner-token')
    app.dependency_overrides[verified_principal]=lambda:principal
    records={};calls=[];faults={};wardrobe=str(uuid4());catalog=str(uuid4())
    def receive(request):
        assert request.headers['authorization']=='Bearer outfits-owner-token'
        assert request.headers['apikey']=='sb_publishable_test'
        assert request.headers['content-profile']=='api'
        calls.append(request)
        operation=request.url.path.rsplit('/',1)[-1];body=json.loads(request.content)
        if operation in faults:return faults[operation]
        if operation=='account_access':return httpx.Response(200,json={'userId':str(principal.user_id),'active':True})
        if operation=='create_outfit':
            if any(item['garmentId'] not in [wardrobe,catalog] for item in body['p_items']):return httpx.Response(404,json={'code':'P0002'})
            ident=str(uuid4())
            row={'id':ident,'name':body['p_name'],'occasion':body['p_occasion'],'description':body['p_description'],
                 'garmentIds':[item['garmentId'] for item in body['p_items'] if item['source']=='wardrobe'],'items':body['p_items']}
            records[ident]=row
            return httpx.Response(200,json=row)
        if operation=='read_outfit':
            row=records.get(body['p_id'])
            return httpx.Response(200,json=row) if row else httpx.Response(404,json={'code':'P0002'})
        if operation=='list_outfits':return httpx.Response(200,json={'items':list(records.values()),'nextCursor':None})
        raise AssertionError(operation)
    with TestClient(app) as client:
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:yield client,wardrobe,catalog,calls,faults,app,principal
        finally:client.portal.call(app.state.transport.aclose)


def mixed(wardrobe,catalog):
    return {'name':' Weekend look ','description':'Notes','occasion':'Weekend','items':[
        {'source':'wardrobe','garmentId':wardrobe},{'source':'catalog','garmentId':catalog}]}


def test_creation_empty_list_populated_list_and_detail(outfits_client):
    client,wardrobe,catalog,calls,*_=outfits_client
    assert client.get('/outfits').json()=={'items':[],'nextCursor':None}
    response=client.post('/outfits',json=mixed(wardrobe,catalog));assert response.status_code==201,response.text
    outfit=response.json()
    assert outfit['name']=='Weekend look' and outfit['garmentIds']==[wardrobe]
    assert [i['source'] for i in outfit['items']]==['wardrobe','catalog']
    assert client.get('/outfits/'+outfit['id']).json()==outfit
    assert client.get('/outfits?search=&category=&sort=newest&limit=24').json()['items']==[outfit]
    create=json.loads(next(r.content for r in calls if r.url.path.endswith('create_outfit')))
    assert set(create)=={'p_name','p_description','p_occasion','p_items'}


def test_existing_wardrobe_only_contract_works_without_typed_input(outfits_client):
    client,wardrobe,catalog,*_=outfits_client
    # The transport fixture only validates available IDs; actual source existence is proven by PG tests.
    response=client.post('/outfits',json={'name':'Own look','garmentIds':[wardrobe,catalog]})
    assert response.status_code==201
    assert response.json()['garmentIds']==[wardrobe,catalog]
    assert all(item['source']=='wardrobe' for item in response.json()['items'])


@pytest.mark.parametrize('payload',[{}, {'name':'Look','items':[]},{'name':'Look','garmentIds':[]},
 {'name':'Look','items':None},{'name':'Look','garmentIds':None}, {'name':'Look','items':[{'source':'wardrobe','garmentId':str(uuid4())}]},
 {'name':'Look','items':[{'source':'other','garmentId':str(uuid4())}]*2},
 {'name':'Look','garmentIds':['bad','bad']},{'name':'Look','garmentIds':[str(uuid4())]*2},
 {'name':'Look','items':[{'source':'catalog','garmentId':str(uuid4()),'owner_id':str(uuid4())}]*2},
 {'recommendationId':str(uuid4())}])
def test_invalid_variants_reject_without_writes(outfits_client,payload):
    client,_,_,calls,*_=outfits_client
    assert client.post('/outfits',json=payload).status_code==422
    assert not any(r.url.path.endswith('create_outfit') for r in calls)


@pytest.mark.parametrize('extra',[{'name':' '},{'name':'x'*201},{'description':'x'*2001},{'occasion':'x'*201},
 {'name':'bad\x00name'},{'owner_id':str(uuid4())},{'ownerId':str(uuid4())},{'id':str(uuid4())},{'role':'admin'},
 {'garmentIds':[str(uuid4()),str(uuid4())]}])
def test_metadata_validation_and_ownership_override_denied(outfits_client,extra):
    client,wardrobe,catalog,calls,*_=outfits_client
    assert client.post('/outfits',json={**mixed(wardrobe,catalog),**extra}).status_code==422
    assert not any(r.url.path.endswith('create_outfit') for r in calls)


@pytest.mark.parametrize('method,path',[('POST','/outfits'),('GET','/outfits'),('GET','/outfits/'+str(uuid4()))])
def test_unauthenticated_never_reaches_data_api(outfits_client,method,path):
    client,_,_,calls,_,app,_=outfits_client;app.dependency_overrides.clear()
    assert client.request(method,path).status_code==401 and calls==[]


def test_missing_and_inaccessible_references_use_safe_errors(outfits_client):
    client,wardrobe,_,_,faults,*_=outfits_client
    response=client.post('/outfits',json=mixed(wardrobe,str(uuid4())))
    assert response.status_code==404 and response.json()=={'detail':'Garment unavailable.'}
    assert client.get('/outfits/'+str(uuid4())).status_code==404
    # An existing UUID that RLS hides is indistinguishable from a missing UUID.
    faults['read_outfit']=httpx.Response(404,json={'code':'P0002','message':'private upstream detail'})
    response=client.get('/outfits/'+str(uuid4()))
    assert response.json()=={'detail':'Outfit not found.'}


@pytest.mark.parametrize('status,code,expected',[(401,'',401),(403,'42501',403),(400,'22023',422),(500,'',503)])
def test_dependency_errors_do_not_leak_or_elevate(outfits_client,status,code,expected):
    client,wardrobe,catalog,calls,faults,*_=outfits_client
    faults['create_outfit']=httpx.Response(status,json={'code':code,'message':'sensitive upstream message'})
    result=client.post('/outfits',json=mixed(wardrobe,catalog))
    assert result.status_code==expected and 'sensitive upstream message' not in result.text
    assert all(r.headers['authorization']=='Bearer outfits-owner-token' for r in calls)


@pytest.mark.parametrize('query',['search=shirt','category=Tops','sort=name','limit=0','limit=101','cursor=bad'])
def test_deferred_filtering_and_invalid_queries_rejected(outfits_client,query):
    client,*_=outfits_client
    assert client.get('/outfits?'+query).status_code==422


def test_opaque_cursor_is_owner_bound_and_position_validated(outfits_client):
    client,_,_,calls,faults,_,principal=outfits_client
    position={'id':str(uuid4()),'createdAt':'2026-11-08T08:00:00+00:00'}
    faults['list_outfits']=httpx.Response(200,json={'items':[],'nextCursor':position})
    response=client.get('/outfits?limit=1');assert response.status_code==200
    cursor=response.json()['nextCursor']
    assert client.get('/outfits?cursor='+cursor).status_code==200
    assert json.loads(calls[-1].content)['p_cursor']==position
    for token in [{'owner':str(uuid4()),'position':position},{'owner':str(principal.user_id),'position':{'id':5,'createdAt':'bad'}},
                  {'owner':str(principal.user_id),'position':{'id':str(uuid4()),'createdAt':'2026-11-08'}}]:
        encoded=base64.urlsafe_b64encode(json.dumps(token).encode()).decode()
        assert client.get('/outfits?cursor='+encoded).status_code==422


def test_malformed_upstream_is_not_a_successful_outfit(outfits_client):
    client,wardrobe,catalog,_,faults,*_=outfits_client
    faults['create_outfit']=httpx.Response(200,json={'id':str(uuid4()),'name':'Missing items'})
    assert client.post('/outfits',json=mixed(wardrobe,catalog)).status_code==503
    faults['list_outfits']=httpx.Response(200,json={'items':[],'nextCursor':{'id':5}})
    assert client.get('/outfits').status_code==503


def test_flag_keeps_outfits_closed_and_edit_delete_not_implemented():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+100,'token')
    with TestClient(app) as client:
        assert client.get('/outfits').status_code==503
        assert client.post('/outfits',json={'name':'Look','garmentIds':[str(uuid4()),str(uuid4())]}).status_code==503
        assert client.patch('/outfits/'+str(uuid4()),json={}).status_code==405
        assert client.delete('/outfits/'+str(uuid4())).status_code==405


def test_referenced_wardrobe_deletion_returns_conflict(outfits_client):
    client,_,_,_,faults,*_=outfits_client
    faults['delete_wardrobe']=httpx.Response(409,json={'code':'23503','message':'sensitive reference details'})
    result=client.delete('/wardrobe/'+str(uuid4()))
    assert result.status_code==409 and 'sensitive reference details' not in result.text
