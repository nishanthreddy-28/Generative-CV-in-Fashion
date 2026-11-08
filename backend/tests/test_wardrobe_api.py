"""HTTP contract tests; external Supabase calls alone are intercepted in tests."""
import base64
import hashlib
import io
import json
import time
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.dependencies import verified_principal
from app.main import create_app
from app.security import Principal
from app.wardrobe import normalize_image, MAX_IMAGE


def picture(format='PNG', size=(8,8)):
    output=io.BytesIO()
    Image.new('RGB',size,'blue').save(output,format=format)
    return output.getvalue()


@pytest.fixture
def wardrobe_client():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
    principal=Principal(uuid4(),int(time.time())+300,'wardrobe-owner-token')
    app.dependency_overrides[verified_principal]=lambda:principal
    garments={};images={};objects={};calls=[];faults={}
    def receive(request):
        assert request.headers['authorization']=='Bearer wardrobe-owner-token'
        assert request.headers['apikey']=='sb_publishable_test'
        calls.append(request)
        operation=request.url.path.rsplit('/',1)[-1]
        if operation in faults: return faults[operation]
        if '/rest/v1/' in request.url.path:
            assert request.headers['content-profile']=='api'
            body=json.loads(request.content)
            if operation=='account_access': return httpx.Response(200,json={'userId':str(app.dependency_overrides[verified_principal]().user_id),'active':True})
            if operation=='reserve_wardrobe_image':
                image_id=body['p_id'];images[image_id]={'id':image_id,'object':f'{principal.user_id}/{image_id}.jpg','sha256':body['p_sha256'],'byteSize':body['p_byte_size'],'state':'pending'}
                return httpx.Response(200,json={k:v for k,v in images[image_id].items() if k!='state'})
            if operation=='write_wardrobe':
                row_id=body['p_id'] or str(uuid4())
                if body['p_id'] and row_id not in garments: return httpx.Response(404,json={'code':'P0002'})
                old=garments.get(row_id,{});old_image=old.get('_image')
                row={**dict(id=row_id,name='',category='Tops',color='',brand='',size='',material='',notes='',imageUrl=f'/wardrobe/{row_id}/image'),**old,**body['p_changes']}
                if body['p_image_id']:
                    row['_image']=body['p_image_id'];images[row['_image']]['state']='attached'
                    if old_image:images[old_image]['state']='cleanup_pending'
                garments[row_id]=row
                return httpx.Response(200,json={k:v for k,v in row.items() if k!='_image'})
            if operation=='read_wardrobe':
                row=garments.get(body['p_id'])
                return httpx.Response(200,json={k:v for k,v in row.items() if k!='_image'}) if row else httpx.Response(404,json={'code':'P0002'})
            if operation=='delete_wardrobe':
                row=garments.pop(body['p_id'],None)
                if not row:return httpx.Response(404,json={'code':'P0002'})
                images[row['_image']]['state']='cleanup_pending';return httpx.Response(204)
            if operation=='abandon_wardrobe_image':
                image=images.get(body['p_id'])
                if image and image['state']=='pending':image['state']='cleanup_pending'
                return httpx.Response(204)
            if operation=='wardrobe_image_cleanup':
                if body.get('p_finished'):images[body['p_finished']]['state']='removed'
                return httpx.Response(200,json=[{'id':i['id'],'object':i['object']} for i in images.values() if i['state']=='cleanup_pending'])
            if operation=='wardrobe_image_info':
                row=garments.get(body['p_garment_id'])
                if not row:return httpx.Response(404,json={'code':'P0002'})
                return httpx.Response(200,json={k:v for k,v in images[row['_image']].items() if k!='state'})
            if operation=='list_wardrobe':
                return httpx.Response(200,json={'items':[{k:v for k,v in row.items() if k!='_image'} for row in garments.values()],'nextCursor':None})
            raise AssertionError(operation)
        assert '/storage/v1/object/' in request.url.path
        if request.method=='POST':
            assert request.headers['x-upsert']=='false'
            path=request.url.path.split('/wardrobe-images/',1)[1]
            objects[path]=request.content;return httpx.Response(200,json={})
        if request.method=='GET':
            path=request.url.path.split('/wardrobe-images/',1)[1]
            return httpx.Response(200,content=objects[path],headers={'content-type':'image/jpeg'})
        if request.method=='DELETE':
            for path in json.loads(request.content)['prefixes']:objects.pop(path,None)
            return httpx.Response(200,json=[])
        raise AssertionError(request)
    with TestClient(app) as client:
        app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:yield client,garments,images,objects,calls,faults,app
        finally:client.portal.call(app.state.transport.aclose)


def create(client,metadata=None,image=None):
    return client.post('/wardrobe',data={'metadata':json.dumps(metadata or {'name':'Blue shirt','category':'Tops','brand':'Maker'})},
        files={'image':('photo.png',picture() if image is None else image,'image/png')})


def test_real_http_shapes_create_read_partial_update_image_and_delete(wardrobe_client):
    client,_,images,objects,_,_,_=wardrobe_client
    assert client.get('/wardrobe').json()=={'items':[],'nextCursor':None}
    result=create(client);assert result.status_code==201,result.text
    row=result.json();ident=row['id']
    assert row['imageUrl']==f'/wardrobe/{ident}/image'
    assert client.get('/wardrobe/'+ident).json()==row
    assert client.get('/wardrobe').json()['items']==[row]
    response=client.get(row['imageUrl']);assert response.status_code==200
    assert response.headers['cache-control']=='private, no-store'
    assert Image.open(io.BytesIO(response.content)).format=='JPEG'
    assert client.patch('/wardrobe/'+ident,json={'notes':'Updated'}).status_code==204
    updated=client.get('/wardrobe/'+ident).json()
    assert updated['notes']=='Updated' and updated['brand']=='Maker' and updated['name']=='Blue shirt'
    assert client.patch('/wardrobe/'+ident,files={'metadata':(None,json.dumps({'brand':''}))}).status_code==204
    assert client.get('/wardrobe/'+ident).json()['brand']==''
    assert client.delete('/wardrobe/'+ident).status_code==204
    assert client.get('/wardrobe/'+ident).status_code==404
    assert client.get(row['imageUrl']).status_code==404
    assert client.get('/wardrobe').json()['items']==[]
    assert not objects and all(i['state']=='removed' for i in images.values())


def test_replace_image_and_preserve_unsubmitted_metadata(wardrobe_client):
    client,_,images,objects,_,_,_=wardrobe_client
    ident=create(client).json()['id']
    response=client.patch('/wardrobe/'+ident,data={'metadata':json.dumps({'name':'Renamed'})},files={'image':('second.png',picture(size=(10,10)),'image/png')})
    assert response.status_code==204,response.text
    assert client.get('/wardrobe/'+ident).json()['brand']=='Maker'
    assert len(objects)==1 and sorted(i['state'] for i in images.values())==['attached','removed']


@pytest.mark.parametrize('payload',[{'name':' '},{'category':'Invalid'},{'brand':None},{'name':'x'*201},
 {'notes':'x'*2001},{'owner_id':str(uuid4())},{'imageUrl':'https://other.invalid'}, {'id':str(uuid4())},{'price':12},{'category':42},{'name':'bad\x00name'}])
def test_invalid_metadata_rejected_without_database_mutation(wardrobe_client,payload):
    client,_,_,_,calls,_,_=wardrobe_client
    ident=create(client).json()['id'];calls.clear()
    response=client.patch('/wardrobe/'+ident,json=payload)
    assert response.status_code==422
    assert not any(r.url.path.endswith('write_wardrobe') for r in calls)


@pytest.mark.parametrize('method,path',[('GET','/wardrobe'),('GET','/wardrobe/'+str(uuid4())),('POST','/wardrobe'),
 ('PATCH','/wardrobe/'+str(uuid4())),('DELETE','/wardrobe/'+str(uuid4())),('GET','/wardrobe/'+str(uuid4())+'/image')])
def test_unauthenticated_requests_do_not_reach_upstream(wardrobe_client,method,path):
    client,_,_,_,calls,_,app=wardrobe_client
    app.dependency_overrides.clear()
    assert client.request(method,path).status_code==401
    assert calls==[]


@pytest.mark.parametrize('method',['get','patch','delete'])
def test_missing_and_cross_user_ids_return_same_safe_error(wardrobe_client,method):
    client,_,_,_,_,_,_=wardrobe_client
    ident=str(uuid4())
    response=client.patch('/wardrobe/'+ident,json={'name':'No access'}) if method=='patch' else getattr(client,method)('/wardrobe/'+ident)
    assert response.status_code==404
    assert response.json()=={'detail':'Garment or image not found.'}


@pytest.mark.parametrize('query',['limit=0','limit=101','sort=unknown','category=Invalid','search='+'x'*201,'cursor=bad','cursor=W10='])
def test_invalid_list_queries(wardrobe_client,query):
    client,*_=wardrobe_client
    assert client.get('/wardrobe?'+query).status_code==422


def test_filters_and_cursor_are_bound_to_owner_and_query(wardrobe_client):
    client,_,_,_,calls,faults,app=wardrobe_client
    position={'id':str(uuid4()),'value':'Blue shirt'}
    faults['list_wardrobe']=httpx.Response(200,json={'items':[],'nextCursor':position})
    response=client.get('/wardrobe?search=Maker&category=Tops&sort=name&limit=1')
    assert response.status_code==200
    token=response.json()['nextCursor']
    assert token and client.get('/wardrobe',params={'search':'Maker','category':'Tops','sort':'name','limit':1,'cursor':token}).status_code==200
    body=json.loads([r for r in calls if r.url.path.endswith('list_wardrobe')][-1].content)
    assert body['p_cursor']==position and body['p_limit']==1
    assert client.get('/wardrobe',params={'sort':'name','cursor':token}).status_code==422
    other_principal=Principal(uuid4(),int(time.time())+300,'wardrobe-owner-token')
    app.dependency_overrides[verified_principal]=lambda:other_principal
    assert client.get('/wardrobe',params={'search':'Maker','category':'Tops','sort':'name','cursor':token}).status_code==422


@pytest.mark.parametrize('contents,status',[(b'',413),(b'<script>bad</script>',415),(b'x'*(MAX_IMAGE+1),413)])
def test_image_validation_happens_before_reservation(wardrobe_client,contents,status):
    client,_,images,*_=wardrobe_client
    assert create(client,image=contents).status_code==status
    assert not images


def test_create_requires_image_and_valid_required_fields(wardrobe_client):
    client,*_=wardrobe_client
    assert client.post('/wardrobe',data={'metadata':json.dumps({'name':'Shirt','category':'Tops'})}).status_code==415
    assert client.post('/wardrobe',files={'metadata':(None,json.dumps({'name':'Shirt','category':'Tops'}))}).status_code==422
    assert create(client,metadata={'category':'Tops'}).status_code==422


def test_failed_attachment_cleans_unreferenced_uploaded_image(wardrobe_client):
    client,_,images,objects,_,faults,_=wardrobe_client
    faults['write_wardrobe']=httpx.Response(400,json={'code':'23514','message':'private details'})
    response=create(client)
    assert response.status_code==422 and 'private details' not in response.text
    assert not objects and all(i['state']=='removed' for i in images.values())


def test_uncertain_storage_delete_is_durably_retryable(wardrobe_client):
    client,_,images,objects,_,faults,_=wardrobe_client
    ident=create(client).json()['id']
    faults['wardrobe-images']=httpx.Response(503)
    assert client.delete('/wardrobe/'+ident).status_code==204
    assert objects and all(i['state']=='cleanup_pending' for i in images.values())
    del faults['wardrobe-images']
    create(client)
    assert sum(i['state']=='removed' for i in images.values())==1


def test_private_image_checksum_mismatch_is_not_served(wardrobe_client):
    client,_,_,objects,*_=wardrobe_client
    ident=create(client).json()['id']
    path=next(iter(objects));objects[path]=picture('JPEG',size=(9,9))
    assert client.get('/wardrobe/'+ident+'/image').status_code==503


def test_default_feature_flag_keeps_wardrobe_closed():
    app=create_app(Settings(supabase_url='https://test.supabase.co',supabase_publishable_key='sb_publishable_test'))
    app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+100,'token')
    with TestClient(app) as client:
        for method,path in [('GET','/wardrobe'),('POST','/wardrobe'),('PATCH','/wardrobe/'+str(uuid4())),('DELETE','/wardrobe/'+str(uuid4()))]:
            assert client.request(method,path).status_code==503


def test_normalized_images_are_jpeg_without_exif():
    raw=picture('PNG');decoded=normalize_image(raw)
    image=Image.open(io.BytesIO(decoded))
    assert image.format=='JPEG' and not image.getexif()
    assert hashlib.sha256(decoded).hexdigest()


@pytest.mark.parametrize('operation,status,expected',[('read_wardrobe',403,403),('read_wardrobe',500,503),
 ('list_wardrobe',500,503),('write_wardrobe',401,401),('delete_wardrobe',403,403)])
def test_upstream_errors_are_not_elevated_or_exposed(wardrobe_client,operation,status,expected):
    client,_,_,_,calls,faults,_=wardrobe_client
    ident=create(client).json()['id'];calls.clear()
    faults[operation]=httpx.Response(status,json={'message':'secret upstream details'})
    if operation=='list_wardrobe':response=client.get('/wardrobe')
    elif operation=='delete_wardrobe':response=client.delete('/wardrobe/'+ident)
    elif operation=='write_wardrobe':response=client.patch('/wardrobe/'+ident,json={'name':'Changed'})
    else:response=client.get('/wardrobe/'+ident)
    assert response.status_code==expected and 'secret upstream details' not in response.text
    assert all(r.headers['authorization']=='Bearer wardrobe-owner-token' for r in calls)


@pytest.mark.parametrize('metadata',['not json','null','[]','{"name":null}'])
def test_malformed_metadata(wardrobe_client,metadata):
    client,*_=wardrobe_client
    response=client.post('/wardrobe',files={'metadata':(None,metadata),'image':('photo.png',picture(),'image/png')})
    assert response.status_code==422


def test_request_size_limit_covers_actual_received_bytes(wardrobe_client):
    from app.wardrobe import MAX_REQUEST
    client,*_=wardrobe_client
    response=client.post('/wardrobe',content=b'x'*(MAX_REQUEST+1),headers={'Content-Type':'multipart/form-data; boundary=test'})
    assert response.status_code==413


def test_unexpected_upstream_record_is_not_success(wardrobe_client):
    client,_,_,_,_,faults,_=wardrobe_client
    faults['read_wardrobe']=httpx.Response(200,json={'name':'Missing mandatory fields'})
    assert client.get('/wardrobe/'+str(uuid4())).status_code==503


@pytest.mark.parametrize('form',[
 [('metadata',(None,'{}')),('metadata',(None,'{}'))],
 [('metadata',(None,'{}')),('unknown',(None,'value'))],
 [('metadata',(None,'{}')),('image',('one.png',picture(),'image/png')),('image',('two.png',picture(),'image/png'))],
])
def test_duplicate_and_unknown_multipart_fields_are_rejected(wardrobe_client,form):
    client,*_=wardrobe_client
    response=client.post('/wardrobe',files=form)
    assert response.status_code==422
    assert 'detail' in response.json()


@pytest.mark.parametrize('header',['Bearer anything','Basic invalid'])
def test_invalid_authorization_is_denied_without_external_fallback(wardrobe_client,header):
    client,_,_,_,calls,_,app=wardrobe_client
    app.dependency_overrides.clear()
    # No signed token can be verified or used to request data from these malformed credentials.
    response=client.get('/wardrobe',headers={'Authorization':header})
    assert response.status_code==401 and calls==[]


def test_metadata_only_patch_keeps_image_bytes_and_omitted_attributes(wardrobe_client):
    client,_,_,objects,_,_,_=wardrobe_client
    ident=create(client).json()['id'];before=dict(objects)
    assert client.patch('/wardrobe/'+ident,json={}).status_code==204
    assert client.patch('/wardrobe/'+ident,json={'color':'Blue'}).status_code==204
    assert objects==before
    row=client.get('/wardrobe/'+ident).json()
    assert row['brand']=='Maker' and row['color']=='Blue' and row['name']=='Blue shirt'
