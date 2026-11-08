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


EMPTY = dict(units='', height=None, chest=None, waist=None, hips=None, inseam=None,
             bodyShape='', skinTone='', undertone='', fit='')


@pytest.fixture
def body_client():
    app = create_app(Settings(supabase_url='https://test.supabase.co',
        supabase_publishable_key='sb_publishable_test', database_foundation_enabled=True))
    principal = Principal(uuid4(), int(time.time())+60, 'body-owner-token')
    app.dependency_overrides[verified_principal] = lambda: principal
    calls = []
    state = {'read': httpx.Response(200, json=EMPTY), 'write': httpx.Response(204)}
    def receive(request):
        assert request.headers['authorization'] == 'Bearer body-owner-token'
        assert request.headers['apikey'] == 'sb_publishable_test'
        assert request.headers['content-profile'] == 'api'
        operation = request.url.path.rsplit('/', 1)[-1]
        payload = json.loads(request.content)
        calls.append((operation, payload))
        if operation == 'account_access':
            return httpx.Response(200, json={'userId': str(principal.user_id), 'active': True})
        return state['read' if operation == 'read_body_profile' else 'write']
    with TestClient(app) as client:
        app.state.transport = httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:
            yield client, calls, state, app
        finally:
            client.portal.call(app.state.transport.aclose)


def test_empty_bootstrapped_and_populated_reads(body_client):
    client, calls, state, _ = body_client
    assert client.get('/profile/body').json() == EMPTY
    record = {**EMPTY, 'units':'cm', 'height':175.1234, 'waist':80, 'bodyShape':'Description',
              'skinTone':'Description', 'undertone':'Neutral', 'fit':'Relaxed'}
    state['read'] = httpx.Response(200, json=record)
    response = client.get('/profile/body')
    assert response.status_code == 200 and response.json() == record
    assert calls[-1] == ('read_body_profile', {})


@pytest.mark.parametrize('changes', [
    {'fit':'Regular'}, {'units':'cm', 'height':175.1234}, {'chest':None},
    {'bodyShape':'', 'skinTone':None}, {},
    {'units':'in', 'height':70, 'chest':40, 'waist':30, 'hips':40, 'inseam':30,
     'bodyShape':'Description', 'skinTone':'Description', 'undertone':'Warm', 'fit':'Fitted'},
])
def test_patch_forwards_only_explicit_fields_as_numbers(body_client, changes):
    client, calls, _, _ = body_client
    response = client.patch('/profile/body', json=changes)
    assert response.status_code == 204 and response.content == b''
    assert calls[-1] == ('update_body_profile', {'p_changes':changes})


@pytest.mark.parametrize('field', ['height','chest','waist','hips','inseam'])
@pytest.mark.parametrize('value', [0,301,-1,True,'180','NaN',1.00001])
def test_invalid_measurements_never_reach_write_rpc(body_client, field, value):
    client, calls, _, _ = body_client
    assert client.patch('/profile/body', json={field:value}).status_code == 422
    assert not any(name == 'update_body_profile' for name,_ in calls)


@pytest.mark.parametrize('changes', [
    {'units':'meters'}, {'units':''}, {'fit':'other'}, {'undertone':'other'},
    {'bodyShape':'x'*201}, {'skinTone':123}, {'user_id':str(uuid4())},
    {'owner_id':str(uuid4())}, {'role':'admin'}, {'updated_at':'today'},
])
def test_invalid_enums_and_overposting_rejected(body_client, changes):
    client, calls, _, _ = body_client
    assert client.patch('/profile/body', json=changes).status_code == 422
    assert not any(name == 'update_body_profile' for name,_ in calls)


@pytest.mark.parametrize('method', ['get','patch'])
@pytest.mark.parametrize('status,code,expected', [
    (404,'P0002',404), (400,'23514',422), (400,'22023',422),
    (401,'invalid',401), (403,'42501',403), (500,'XX000',503), (404,'PGRST202',503),
])
def test_database_errors_are_safe_and_consistent(body_client, method, status, code, expected):
    client, _, state, _ = body_client
    state['read' if method == 'get' else 'write'] = httpx.Response(status, json={
        'code':code, 'message':'private database internals'})
    response = client.get('/profile/body') if method == 'get' else client.patch('/profile/body',json={'fit':'Regular'})
    assert response.status_code == expected
    assert 'private database internals' not in response.text
    assert 'detail' in response.json()


@pytest.mark.parametrize('payload', [None, {}, {**EMPTY,'height':'180'}, {**EMPTY,'owner_id':str(uuid4())}])
def test_malformed_read_fails_closed(body_client, payload):
    client, _, state, _ = body_client
    state['read'] = httpx.Response(200, json=payload)
    assert client.get('/profile/body').status_code == 503


@pytest.mark.parametrize('method', ['get','patch'])
def test_unauthenticated_body_requests(body_client, method):
    client, calls, _, app = body_client
    app.dependency_overrides.clear()
    response = client.get('/profile/body') if method == 'get' else client.patch('/profile/body',json={'fit':'Regular'})
    assert response.status_code == 401
    assert response.headers['www-authenticate'] == 'Bearer'
    assert calls == []


def test_body_openapi_contracts(body_client):
    _, _, _, app = body_client
    operations = app.openapi()['paths']['/profile/body']
    assert set(operations) == {'get','patch'}
    assert '204' in operations['patch']['responses']


@pytest.mark.parametrize('content', ['{"height":NaN}', '{"height":Infinity}', '{"height":1e999}', '{broken', 'null', '[]'])
def test_malformed_and_nonfinite_json_returns_safe_validation_error(body_client, content):
    client, calls, _, _ = body_client
    response = client.patch('/profile/body', content=content, headers={'Content-Type':'application/json'})
    assert response.status_code == 422
    assert response.json() == {'detail':'Invalid body profile fields.'}
    assert not any(name == 'update_body_profile' for name,_ in calls)
