import asyncio
import json
import time
from uuid import uuid4

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.data_api import UserDataAPI
from app.dependencies import active_user_data, verified_principal
from app.errors import DependencyUnavailable, Unauthorized
from app.main import create_app
from app.security import JWTVerifier, Principal


@pytest.fixture
def settings():
    return Settings(supabase_url='https://test.supabase.co', supabase_publishable_key='sb_publishable_test', jwt_leeway_seconds=0)


@pytest.fixture
def signing():
    key = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
    public.update(kid='key-one', alg='ES256', use='sig')
    return key, public


def token(settings, key, **overrides):
    claims = dict(sub=str(uuid4()), iss=settings.issuer, aud='authenticated', role='authenticated', iat=int(time.time()), exp=int(time.time()) + 300)
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm='ES256', headers={'kid': 'key-one'})


async def verifier_for(settings, public):
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={'keys': [public]})))
    return JWTVerifier(settings, client), client


async def test_valid_token_and_secret_repr(settings, signing):
    key, public = signing
    verifier, client = await verifier_for(settings, public)
    async with client:
        value = token(settings, key)
        principal = await verifier.verify(value)
        assert principal.access_token == value
        assert value not in repr(principal)


@pytest.mark.parametrize('change', [
    {'exp': 1}, {'iss': 'https://attacker.invalid/auth/v1'}, {'aud': 'other'},
    {'role': 'service_role'}, {'role': 'anon'}, {'is_anonymous': True},
    {'sub': 'not-a-uuid'}, {'iat': int(time.time()) + 3600}, {'nbf': int(time.time()) + 3600},
])
async def test_rejects_invalid_claims(settings, signing, change):
    key, public = signing
    verifier, client = await verifier_for(settings, public)
    async with client:
        with pytest.raises(Unauthorized):
            await verifier.verify(token(settings, key, **change))


async def test_rejects_tampering_missing_claim_and_symmetric_algorithm(settings, signing):
    key, public = signing
    verifier, client = await verifier_for(settings, public)
    async with client:
        other = ec.generate_private_key(ec.SECP256R1())
        for value in [token(settings, other), jwt.encode({'sub': str(uuid4())}, key, algorithm='ES256', headers={'kid': 'key-one'}), jwt.encode({'sub': str(uuid4())}, 'test-only-secret-long-enough-for-hs256', algorithm='HS256', headers={'kid': 'key-one'})]:
            with pytest.raises(Unauthorized):
                await verifier.verify(value)


async def test_jwks_failure_is_unavailable_not_authenticated(settings, signing):
    key, _ = signing
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as client:
        verifier = JWTVerifier(settings, client)
        with pytest.raises(DependencyUnavailable):
            await verifier.verify(token(settings, key))


async def test_unknown_kid_refresh_is_bounded(settings, signing):
    key, public = signing
    calls = []
    async def handler(request):
        calls.append(request)
        return httpx.Response(200, json={'keys': [public]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        verifier = JWTVerifier(settings, client)
        await verifier.verify(token(settings, key))
        unknown = jwt.encode({'sub':str(uuid4())}, key, algorithm='ES256', headers={'kid':'unknown'})
        for _ in range(3):
            with pytest.raises(Unauthorized): await verifier.verify(unknown)
        assert len(calls) == 1


@pytest.mark.parametrize('method,resource', [('GET','profiles'),('POST','wardrobe'),('PATCH','outfits'),('DELETE','outfits'),('POST','rpc/save_outfit')])
async def test_exact_token_isolation_and_no_elevation(settings, method, resource):
    observed = []
    async def handler(request):
        await asyncio.sleep(0)
        observed.append((request.headers['authorization'], request.headers['apikey'], request.url.path))
        return httpx.Response(403)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), headers={'authorization':'must-not-inherit'}) as client:
        a = UserDataAPI(settings, client, Principal(uuid4(), int(time.time())+60, 'token-a'))
        b = UserDataAPI(settings, client, Principal(uuid4(), int(time.time())+60, 'token-b'))
        results = await asyncio.gather(a.request(method, resource), b.request(method, resource))
        assert all(r.status_code == 403 for r in results)
        assert sorted(x[0] for x in observed) == ['Bearer token-a','Bearer token-b']
        assert all(x[1] == 'sb_publishable_test' for x in observed)
        assert client.headers['authorization'] == 'must-not-inherit'
        assert len(observed) == 2  # No forbidden-result retry.


async def test_refreshed_token_and_expiry(settings):
    seen=[]
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: (seen.append(r.headers['authorization']) or httpx.Response(200, json=[])))) as client:
        uid=uuid4()
        for value in ['old-token','new-token']:
            await UserDataAPI(settings,client,Principal(uid,int(time.time())+60,value)).request('GET','profiles')
        with pytest.raises(Unauthorized):
            await UserDataAPI(settings,client,Principal(uid,1,'expired')).request('GET','profiles')
    assert seen == ['Bearer old-token','Bearer new-token']


def test_configuration_rejects_privileged_keys_and_untrusted_url():
    for key in ['sb_secret_test','legacy.jwt.key']:
        with pytest.raises(ValidationError): Settings(supabase_url='https://test.supabase.co',supabase_publishable_key=key)
    with pytest.raises(ValidationError): Settings(supabase_url='http://attacker.invalid',supabase_publishable_key='sb_publishable_test')


def test_dependency_missing_token_and_unconfigured_lifecycle_fail_closed(settings):
    app=create_app(settings)
    # Test-only routes; the production app has no business endpoints yet.
    @app.get('/test-protected')
    async def protected(data=Depends(active_user_data)): return {'unexpected':'access'}
    with TestClient(app) as client:
        assert client.get('/test-protected').status_code == 401
        app.dependency_overrides[verified_principal]=lambda: Principal(uuid4(),int(time.time())+60,'test-token')
        assert client.get('/test-protected').status_code == 503
        assert client.get('/profile').status_code == 404


async def test_rotated_key_refresh(settings, signing):
    key, public = signing
    next_key = ec.generate_private_key(ec.SECP256R1())
    next_public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(next_key.public_key()))
    next_public.update(kid='key-two', alg='ES256', use='sig')
    documents = [{'keys':[public]}, {'keys':[next_public]}]
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200,json=documents.pop(0)))) as client:
        verifier=JWTVerifier(settings,client)
        await verifier.verify(token(settings,key))
        verifier._next_refresh=0  # Simulate expiry of the bounded refresh cooldown.
        claims=jwt.decode(token(settings,next_key),options={'verify_signature':False})
        rotated=jwt.encode(claims,next_key,algorithm='ES256',headers={'kid':'key-two'})
        assert (await verifier.verify(rotated)).access_token == rotated


async def test_network_failure_and_cancellation_do_not_leak_context(settings):
    observed=[]
    async def handler(request):
        value=request.headers['authorization']
        observed.append(value)
        if value=='Bearer cancel': raise asyncio.CancelledError()
        if value=='Bearer failure': raise httpx.ConnectError('Test dependency outage',request=request)
        return httpx.Response(200,json=[])
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        def data(value): return UserDataAPI(settings,client,Principal(uuid4(),int(time.time())+60,value))
        with pytest.raises(asyncio.CancelledError): await data('cancel').request('GET','profiles')
        with pytest.raises(DependencyUnavailable): await data('failure').request('GET','profiles')
        assert (await data('next-user').request('GET','profiles')).status_code==200
    assert observed==['Bearer cancel','Bearer failure','Bearer next-user']


def test_valid_jwt_still_denied_without_lifecycle_enforcement(settings, signing):
    key,public=signing
    app=create_app(settings)
    @app.get('/test-protected')
    async def protected(data=Depends(active_user_data)): return {'unexpected':'access'}
    with TestClient(app) as client:
        async def jwks(request): return httpx.Response(200,json={'keys':[public]})
        # Inject a test-only key provider; no real or fabricated application records.
        app.state.verifier.transport=httpx.AsyncClient(transport=httpx.MockTransport(jwks))
        response=client.get('/test-protected',headers={'authorization':f'Bearer {token(settings,key)}'})
        assert response.status_code==503


@pytest.mark.parametrize('path', ['https://other.invalid/profiles','//other.invalid','profiles/../users','profiles?select=*'])
async def test_adapter_rejects_arbitrary_urls(settings,path):
    async with httpx.AsyncClient() as client:
        data=UserDataAPI(settings,client,Principal(uuid4(),int(time.time())+60,'token'))
        with pytest.raises(ValueError): await data.request('GET',path)
