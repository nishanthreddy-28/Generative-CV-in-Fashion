"""Catalog HTTP tests with intercepted external transport; real RLS is tested separately."""
import hashlib
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
def catalog_client():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
    admin_state={"allowed":True}
    principal=Principal(uuid4(),int(time.time())+300,'catalog-owner-token')
    app.dependency_overrides[verified_principal]=lambda:principal
    garments={};images={};objects={};calls=[];faults={}
    def receive(request):
        assert request.headers['authorization']=='Bearer catalog-owner-token'
        assert request.headers['apikey']=='sb_publishable_test'
        calls.append(request)
        operation=request.url.path.rsplit('/',1)[-1]
        if operation in faults: return faults[operation]
        if '/rest/v1/' in request.url.path:
            assert request.headers['content-profile']=='api'
            body=json.loads(request.content)
            if operation=='account_access': return httpx.Response(200,json={'userId':str(app.dependency_overrides[verified_principal]().user_id),'active':True,'isCatalogAdmin':admin_state['allowed']})
            if operation=='reserve_catalog_image':
                image_id=body['p_id'];images[image_id]={'id':image_id,'object':f'catalog/{image_id}.jpg','sha256':body['p_sha256'],'byteSize':body['p_byte_size'],'state':'pending'}
                return httpx.Response(200,json={k:v for k,v in images[image_id].items() if k!='state'})
            if operation=='write_catalog':
                row_id=body['p_id'] or str(uuid4())
                if body['p_id'] and row_id not in garments: return httpx.Response(404,json={'code':'P0002'})
                old=garments.get(row_id,{});old_image=old.get('_image')
                row={**dict(id=row_id,name='',category='Tops',color='',brand='',size='',material='',notes='',price=None,active=True,imageUrl=f'/catalog/{row_id}/image'),**old,**body['p_changes']}
                if body['p_image_id']:
                    row['_image']=body['p_image_id'];images[row['_image']]['state']='attached'
                    if old_image:images[old_image]['state']='cleanup_pending'
                garments[row_id]=row
                return httpx.Response(200,json={k:v for k,v in row.items() if k!='_image'})
            if operation=='read_catalog':
                row=garments.get(body['p_id'])
                return httpx.Response(200,json={k:v for k,v in row.items() if k!='_image'}) if row and (row['active'] or body.get('p_admin')) else httpx.Response(404,json={'code':'P0002'})
            if operation=='delete_catalog':
                row=garments.get(body['p_id'])
                if not row:return httpx.Response(404,json={'code':'P0002'})
                row['active']=False;return httpx.Response(204)
            if operation=='abandon_catalog_image':
                image=images.get(body['p_id'])
                if image and image['state']=='pending':image['state']='cleanup_pending'
                return httpx.Response(204)
            if operation=='catalog_image_cleanup':
                if body.get('p_finished'):images[body['p_finished']]['state']='removed'
                return httpx.Response(200,json=[{'id':i['id'],'object':i['object']} for i in images.values() if i['state']=='cleanup_pending'])
            if operation=='catalog_image_info':
                row=garments.get(body['p_garment_id'])
                if not row or not(row['active'] or body.get('p_admin')):return httpx.Response(404,json={'code':'P0002'})
                return httpx.Response(200,json={k:v for k,v in images[row['_image']].items() if k!='state'})
            if operation=='list_catalog':
                return httpx.Response(200,json={'items':[{k:v for k,v in row.items() if k!='_image'} for row in garments.values() if row['active'] or body.get('p_admin')],'nextCursor':None})
            raise AssertionError(operation)
        assert '/storage/v1/object/' in request.url.path
        if request.method=='POST':
            assert request.headers['x-upsert']=='false'
            path=request.url.path.split('/catalog-images/',1)[1]
            objects[path]=request.content;return httpx.Response(200,json={})
        if request.method=='GET':
            path=request.url.path.split('/catalog-images/',1)[1]
            return httpx.Response(200,content=objects[path],headers={'content-type':'image/jpeg'})
        if request.method=='DELETE':
            for path in json.loads(request.content)['prefixes']:objects.pop(path,None)
            return httpx.Response(200,json=[])
        raise AssertionError(request)
    with TestClient(app) as client:
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:yield client,garments,images,objects,calls,faults,app,admin_state
        finally:client.portal.call(app.state.transport.aclose)


def create(client,metadata=None,image=None):
    return client.post('/admin/catalog',data={'metadata':json.dumps(metadata or {'name':'Blue shirt','category':'Tops','brand':'Maker'})},
        files={'image':('photo.png',picture() if image is None else image,'image/png')})



def test_admin_create_read_patch_deactivate_and_shared_reads(catalog_client):
    client,_,_,objects,_,_,_,permission=catalog_client
    assert client.get('/catalog').json()=={'items':[],'nextCursor':None}
    response=create(client);assert response.status_code==201,response.text
    row=response.json();ident=row['id'];path='/admin/catalog/'+ident
    assert client.get(path).json()==row
    assert client.patch(path,json={'price':12.50,'notes':'Updated'}).status_code==204
    updated=client.get(path).json()
    assert updated['brand']=='Maker' and updated['price']==12.5 and updated['notes']=='Updated'
    assert client.patch(path,json={'price':None}).status_code==204
    assert client.get(path).json()['price'] is None
    permission['allowed']=False
    assert client.get('/admin/catalog/access').json()['isCatalogAdmin'] is False
    assert client.get('/catalog/'+ident).status_code==200
    assert client.get(row['imageUrl']).status_code==200
    permission['allowed']=True
    assert client.delete(path).status_code==204
    assert client.get(path).json()['active'] is False
    assert client.get(path+'/image').status_code==200
    assert objects # Deactivation retains the current asset, no destructive cascade.
    assert client.get('/catalog/'+ident).status_code==404
    assert client.get(row['imageUrl']).status_code==404
    assert client.get('/catalog').json()['items']==[]
    assert len(client.get('/admin/catalog').json()['items'])==1


@pytest.mark.parametrize('method,path',[('GET','/admin/catalog'),('POST','/admin/catalog'),
 ('GET','/admin/catalog/'+str(uuid4())),('PATCH','/admin/catalog/'+str(uuid4())),
 ('DELETE','/admin/catalog/'+str(uuid4())),('GET','/admin/catalog/'+str(uuid4())+'/image')])
def test_ordinary_users_cannot_use_admin_routes(catalog_client,method,path):
    client,_,_,_,calls,_,_,permission=catalog_client;permission['allowed']=False
    assert client.request(method,path).status_code==403
    assert all(r.url.path.endswith('account_access') for r in calls)


@pytest.mark.parametrize('method,path',[('GET','/catalog'),('GET','/catalog/'+str(uuid4())),
 ('POST','/admin/catalog'),('PATCH','/admin/catalog/'+str(uuid4())),('DELETE','/admin/catalog/'+str(uuid4())),
 ('GET','/admin/catalog/access'),('GET','/catalog/'+str(uuid4())+'/image')])
def test_unauthenticated_requests(catalog_client,method,path):
    client,_,_,_,calls,_,app,_=catalog_client;app.dependency_overrides.clear()
    assert client.request(method,path).status_code==401 and calls==[]


@pytest.mark.parametrize('payload',[{'price':-1},{'price':1000001},{'price':1.001},{'price':True},{'price':'12'},
 {'name':' '},{'category':'Invalid'},{'brand':None},{'name':'x'*201},{'notes':'x'*2001},
 {'owner_id':str(uuid4())},{'active':True},{'role':'admin'},{'imageUrl':'https://other.invalid'},{'id':str(uuid4())}])
def test_invalid_or_privileged_fields(catalog_client,payload):
    client,_,_,_,calls,*_=catalog_client
    ident=create(client).json()['id'];calls.clear()
    assert client.patch('/admin/catalog/'+ident,json=payload).status_code==422
    assert not any(r.url.path.endswith('write_catalog') for r in calls)


@pytest.mark.parametrize('method',['get','patch','delete'])
def test_missing_items(catalog_client,method):
    client,*_=catalog_client;path='/admin/catalog/'+str(uuid4())
    result=client.patch(path,json={'name':'Changed'}) if method=='patch' else getattr(client,method)(path)
    assert result.status_code==404


@pytest.mark.parametrize('query',['category=Invalid','limit=0','limit=101','sort=price','cursor=bad'])
def test_query_validation(catalog_client,query):
    client,*_=catalog_client
    assert client.get('/catalog?'+query).status_code==422
    assert client.get('/admin/catalog?'+query).status_code==422


def test_filters_pagination_and_no_public_admin_override(catalog_client):
    import base64
    client,_,_,_,calls,faults,*_=catalog_client
    cursor={'id':str(uuid4()),'value':'Alpha'}
    faults['list_catalog']=httpx.Response(200,json={'items':[],'nextCursor':cursor})
    response=client.get('/catalog?search=maker&category=Tops&sort=name&limit=1&admin=true')
    assert response.status_code==200
    token=response.json()['nextCursor']
    assert json.loads(base64.urlsafe_b64decode(token))['position']==cursor
    assert json.loads(calls[-1].content)=={'p_search':'maker','p_category':'Tops','p_sort':'name','p_limit':1,'p_cursor':None,'p_admin':False}
    assert client.get('/catalog?search=maker&category=Tops&sort=name&limit=1&cursor='+token).status_code==200
    assert client.get('/admin/catalog?search=maker&category=Tops&sort=name&cursor='+token).status_code==422


@pytest.mark.parametrize('status,expected',[(401,401),(403,403),(500,503)])
def test_mutation_dependency_errors_are_safe(catalog_client,status,expected):
    client,_,_,_,calls,faults,*_=catalog_client
    ident=create(client).json()['id']
    faults['write_catalog']=httpx.Response(status,json={'message':'private upstream detail'})
    result=client.patch('/admin/catalog/'+ident,json={'name':'New'})
    assert result.status_code==expected and 'private upstream detail' not in result.text
    assert all(r.headers['authorization']=='Bearer catalog-owner-token' for r in calls)


def test_feature_flag_remains_fail_closed():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+100,'token')
    with TestClient(app) as client:
        assert client.get('/catalog').status_code==503
        assert client.post('/admin/catalog').status_code==503


def test_image_required_decoded_and_replacement_cleanup(catalog_client):
    client,_,images,objects,*_=catalog_client
    assert client.post('/admin/catalog',files={'metadata':(None,'{"name":"Piece","category":"Tops"}')}).status_code==422
    assert create(client,image=b'not an image').status_code==415
    ident=create(client).json()['id']
    result=client.patch('/admin/catalog/'+ident,files={'metadata':(None,'{}'),'image':('replacement.png',picture(size=(10,10)),'image/png')})
    assert result.status_code==204,result.text
    assert len(objects)==1 and sorted(i['state'] for i in images.values())==['attached','removed']


def test_untrusted_or_missing_permission_projection_denied(catalog_client):
    client,_,_,_,_,faults,*_=catalog_client
    for body in [{'userId':str(uuid4()),'active':True,'isCatalogAdmin':True},{'active':True},
                 {'isCatalogAdmin':'true'}]:
        faults['account_access']=httpx.Response(200,json=body)
        assert client.post('/admin/catalog').status_code in (403,503)
