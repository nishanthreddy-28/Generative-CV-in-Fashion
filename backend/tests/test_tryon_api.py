"""Try-on HTTP boundary tests; external Storage/Data API transport is test-intercepted."""
import hashlib
import io
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
from test_wardrobe_api import picture


@pytest.fixture
def tryon_client():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
    principal=Principal(uuid4(),int(time.time())+300,'tryon-owner-token');garment=str(uuid4())
    app.dependency_overrides[verified_principal]=lambda:principal
    jobs={};images={};objects={};calls=[];faults={}
    def receive(request):
        calls.append(request)
        assert request.headers['authorization']=='Bearer tryon-owner-token'
        assert request.headers['apikey']=='sb_publishable_test'
        op=request.url.path.rsplit('/',1)[-1]
        if op in faults:return faults[op]
        if '/rest/v1/' in request.url.path:
            assert request.headers['content-profile']=='api';body=json.loads(request.content)
            if op=='account_access':return httpx.Response(200,json={'userId':str(principal.user_id),'active':True})
            if op in ['read_wardrobe','read_catalog']:
                return httpx.Response(200,json={'id':garment}) if body['p_id']==garment else httpx.Response(404,json={'code':'P0002'})
            if op=='reserve_tryon_image':
                ident=body['p_id'];images[ident]={'id':ident,'object':f'{principal.user_id}/{ident}.jpg','sha256':body['p_sha256'],'byteSize':body['p_byte_size'],'state':'pending'}
                return httpx.Response(200,json={k:v for k,v in images[ident].items() if k!='state'})
            if op=='submit_tryon':
                ident=str(uuid4());image=body['p_image_id'];images[image]['state']='attached'
                row=dict(id=ident,status='queued',garmentId=garment,source=body['p_source'],createdAt='2026-11-09T00:00:00Z',updatedAt='2026-11-09T00:00:00Z',finishedAt=None,
                  consentVersion='photo-consent-v1',consentAt='2026-11-09T00:00:00Z',failureCode=None,error=None,workerAvailable=False,
                  workerMessage='No inference worker is configured. Queued jobs will not produce an image.',canCancel=True,inputAvailable=True,inputUrl=f'/try-on/jobs/{ident}/input',_image=image)
                jobs[ident]=row;return httpx.Response(200,json={k:v for k,v in row.items() if k!='_image'})
            if op in ['read_tryon','cancel_tryon','tryon_input_info']:
                row=jobs.get(body['p_id'])
                if not row:return httpx.Response(404,json={'code':'P0002'})
                if op=='cancel_tryon':
                    if row['status'] not in ['queued','failed']:return httpx.Response(400,json={'code':'DD001'})
                    row.update(status='failed',failureCode='CANCELLED',error='Cancelled by you.',finishedAt='2026-11-09T00:01:00Z',canCancel=False,inputAvailable=False)
                    images[row['_image']]['state']='cleanup_pending'
                if op=='tryon_input_info':
                    if not row['inputAvailable']:return httpx.Response(404,json={'code':'P0002'})
                    return httpx.Response(200,json={k:v for k,v in images[row['_image']].items() if k!='state'})
                return httpx.Response(200,json={k:v for k,v in row.items() if k!='_image'})
            if op=='list_tryon':return httpx.Response(200,json={'items':[{k:v for k,v in row.items() if k!='_image'} for row in jobs.values()],'nextCursor':None})
            if op=='abandon_tryon_image':
                if images[body['p_id']]['state']=='pending':images[body['p_id']]['state']='cleanup_pending'
                return httpx.Response(204)
            if op=='tryon_image_cleanup':
                if body.get('p_finished'):images[body['p_finished']]['state']='removed'
                return httpx.Response(200,json=[{'id':i['id'],'object':i['object']} for i in images.values() if i['state']=='cleanup_pending'])
            raise AssertionError(op)
        if request.method=='POST':objects[request.url.path.split('/tryon-inputs/')[1]]=request.content;return httpx.Response(200,json={})
        if request.method=='GET':return httpx.Response(200,content=objects[request.url.path.split('/tryon-inputs/')[1]])
        if request.method=='DELETE':
            for path in json.loads(request.content)['prefixes']:objects.pop(path,None)
            return httpx.Response(200,json=[])
        raise AssertionError(request)
    with TestClient(app) as client:
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:yield client,garment,jobs,images,objects,calls,faults,app,principal
        finally:client.portal.call(app.state.transport.aclose)


def submit(client,garment,**overrides):
    data={'garmentId':garment,'source':'wardrobe','photoConsent':'true',**overrides}
    return client.post('/try-on/jobs',data=data,files={'person':('person.png',picture(),'image/png')})


def test_submit_read_private_image_history_cancel_without_fake_output(tryon_client):
    client,g,jobs,images,objects,*_=tryon_client
    assert client.get('/try-on/jobs').json()['items']==[]
    response=submit(client,g);assert response.status_code==202,response.text
    row=response.json();path='/try-on/jobs/'+row['id']
    assert row['workerAvailable'] is False and row['status']=='queued' and 'imageUrl' not in row
    assert client.get(path).json()==row and client.get('/try-on/jobs').json()['items']==[row]
    photo=client.get(path+'/input');assert photo.status_code==200
    assert photo.headers['cache-control']=='private, no-store' and photo.content[:2]==b'\xff\xd8'
    cancelled=client.post(path+'/cancel');assert cancelled.status_code==200,cancelled.text
    assert cancelled.json()['failureCode']=='CANCELLED' and not objects
    assert client.get(path+'/input').status_code==404
    assert client.post(path+'/cancel').status_code==200


@pytest.mark.parametrize('fields',[{'photoConsent':'false'},{'photoConsent':''},{'source':'other'},{'garmentId':'bad'}, {'owner_id':str(uuid4())}])
def test_invalid_form_no_reservation(tryon_client,fields):
    client,g,_,_,_,calls,*_=tryon_client
    assert submit(client,g,**fields).status_code==422
    assert not any(r.url.path.endswith('reserve_tryon_image') for r in calls)


def test_missing_consent_photo_duplicate_fields_and_invalid_bytes(tryon_client):
    client,g,*_=tryon_client
    for fields in [{'garmentId':g,'source':'wardrobe'},{'garmentId':g,'source':'wardrobe','photoConsent':'true'}]:
        response=client.post('/try-on/jobs',files=[(k,(None,v)) for k,v in fields.items()])
        assert response.status_code==422
    response=client.post('/try-on/jobs',files=[('garmentId',(None,g)),('source',(None,'wardrobe')),('photoConsent',(None,'true')),('photoConsent',(None,'true')),('person',('image.png',picture(),'image/png'))])
    assert response.status_code==422
    response=client.post('/try-on/jobs',data={'garmentId':g,'source':'wardrobe','photoConsent':'true'},files={'person':('x.jpg',b'not an image','image/jpeg')})
    assert response.status_code==415


@pytest.mark.parametrize('method,path',[('GET','/try-on/jobs'),('POST','/try-on/jobs'),('GET','/try-on/jobs/'+str(uuid4())),
 ('POST','/try-on/jobs/'+str(uuid4())+'/cancel'),('GET','/try-on/jobs/'+str(uuid4())+'/input')])
def test_unauthenticated_no_upstream(tryon_client,method,path):
    client,_,_,_,_,calls,_,app,_=tryon_client;app.dependency_overrides.clear()
    assert client.request(method,path).status_code==401 and calls==[]


def test_missing_cross_user_ids_and_processing_cancel(tryon_client):
    client,g,jobs,*_=tryon_client
    assert submit(client,str(uuid4())).status_code==404
    assert client.get('/try-on/jobs/'+str(uuid4())).status_code==404
    assert client.post('/try-on/jobs/'+str(uuid4())+'/cancel').status_code==404
    row=submit(client,g).json();jobs[row['id']]['status']='processing';jobs[row['id']]['canCancel']=False
    assert client.post('/try-on/jobs/'+row['id']+'/cancel').status_code==409


@pytest.mark.parametrize('operation,status,expected',[('submit_tryon',403,403),('submit_tryon',500,503),('read_tryon',401,401),('list_tryon',500,503)])
def test_dependency_failures_safe_and_upload_failure_retired(tryon_client,operation,status,expected):
    client,g,_,images,objects,calls,faults,*_=tryon_client
    faults[operation]=httpx.Response(status,json={'message':'private upstream error'})
    response=submit(client,g) if operation=='submit_tryon' else client.get('/try-on/jobs' if operation=='list_tryon' else '/try-on/jobs/'+str(uuid4()))
    assert response.status_code==expected and 'private upstream error' not in response.text
    if operation=='submit_tryon':assert not objects and all(i['state']=='removed' for i in images.values())
    assert all(r.headers['authorization']=='Bearer tryon-owner-token' for r in calls)


@pytest.mark.parametrize('query',['limit=0','limit=101','cursor=bad'])
def test_history_query_validation(tryon_client,query):
    client,*_=tryon_client
    assert client.get('/try-on/jobs?'+query).status_code==422


def test_history_cursor_binding_and_next_page(tryon_client):
    import base64
    client,_,_,_,_,calls,faults,_,principal=tryon_client
    pos={'id':str(uuid4()),'createdAt':'2026-11-09T00:00:00Z'}
    faults['list_tryon']=httpx.Response(200,json={'items':[],'nextCursor':pos})
    token=client.get('/try-on/jobs?limit=1').json()['nextCursor']
    assert client.get('/try-on/jobs',params={'cursor':token}).status_code==200
    assert json.loads(calls[-1].content)['p_cursor']==pos
    forged=base64.urlsafe_b64encode(json.dumps({'owner':str(uuid4()),'position':pos}).encode()).decode()
    assert client.get('/try-on/jobs',params={'cursor':forged}).status_code==422


def test_flag_false_no_privileged_fallback():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+100,'token')
    with TestClient(app) as client:
        assert client.get('/try-on/jobs').status_code==503
        assert client.post('/try-on/jobs').status_code==503


def test_oversized_actual_request_bytes_and_unsupported_payload(tryon_client):
    from app.wardrobe import MAX_REQUEST
    client,g,_,_,_,calls,*_=tryon_client
    assert client.post('/try-on/jobs',json={'garmentId':g}).status_code==415
    response=client.post('/try-on/jobs',content=b'x'*(MAX_REQUEST+1),headers={'Content-Type':'multipart/form-data; boundary=test'})
    assert response.status_code==413
    assert not any(r.url.path.endswith('reserve_tryon_image') for r in calls)


def test_private_input_integrity_and_malformed_job_response(tryon_client):
    client,g,_,_,objects,_,faults,*_=tryon_client
    row=submit(client,g).json();key=next(iter(objects));objects[key]=b'corrupted'
    assert client.get(row['inputUrl']).status_code==503
    faults['read_tryon']=httpx.Response(200,json={'status':'completed','imageUrl':'https://fake.invalid'})
    assert client.get('/try-on/jobs/'+row['id']).status_code==503
