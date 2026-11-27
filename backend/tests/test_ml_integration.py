"""Inference boundary tests; no provider calls or hosted database mutations."""
import time
import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.config import Settings
from app.dependencies import active_user_data
from app.main import create_app
from app import ml

def settings(**extra):
    return Settings(_env_file=None, supabase_url="https://test.supabase.co",
        supabase_publishable_key="sb_publishable_test", **extra)

def test_worker_configuration_rejects_credentials_and_remote_plaintext():
    for url in ["http://remote.example", "https://user:password@remote.example", "https://remote.example/path"]:
        with pytest.raises(ValueError): settings(ml_worker_url=url)
    with pytest.raises(ValueError): settings(ml_worker_token="short")
    assert settings(ml_worker_url="http://127.0.0.1:8090").ml_worker_url.endswith("8090")

def test_missing_authentication_is_denied():
    with TestClient(create_app(settings())) as client:
        assert client.post("/ml/body-analysis", json={"imageId":str(uuid4()),"referenceHeightCm":170}).status_code == 401

def test_invalid_height_never_invokes_worker(monkeypatch):
    app=create_app(settings())
    app.dependency_overrides[active_user_data]=lambda: object()
    called=AsyncMock()
    monkeypatch.setattr(ml,"infer",called)
    with TestClient(app) as client:
        for height in [True, 79, 251, "170"]:
            assert client.post("/ml/body-analysis", json={"imageId":str(uuid4()),"referenceHeightCm":height}).status_code == 422
    called.assert_not_called()

@pytest.mark.asyncio
async def test_missing_worker_is_unavailable():
    with pytest.raises(HTTPException) as error:
        await ml.infer(SimpleNamespace(settings=settings()),"body-analysis",b"")
    assert error.value.status_code == 503

@pytest.mark.asyncio
async def test_foreign_photo_never_reaches_inference(monkeypatch):
    async def absent(*args,**kwargs): raise HTTPException(404,"Unavailable")
    monkeypatch.setattr(ml,"onboarding_rpc",absent)
    called=AsyncMock()
    monkeypatch.setattr(ml,"infer",called)
    with pytest.raises(HTTPException) as error:
        await ml.analyse_body(ml.BodyRequest(imageId=uuid4(),referenceHeightCm=170.0),object())
    assert error.value.status_code == 404
    called.assert_not_called()

@pytest.mark.asyncio
async def test_account_deleted_during_inference_discards_result(monkeypatch):
    owner=uuid4(); image=uuid4()
    principal=SimpleNamespace(user_id=owner,expires_at=time.time()+300)
    data=SimpleNamespace(principal=principal,request=AsyncMock(return_value=httpx.Response(200,json={"userId":str(owner),"active":False})))
    monkeypatch.setattr(ml,"onboarding_rpc",AsyncMock(return_value={"id":str(image),"present":True,"object":f"{owner}/{image}.jpg","sha256":hashlib.sha256(b"image").hexdigest(),"byteSize":5}))
    monkeypatch.setattr(ml,"storage",AsyncMock(return_value=b"image"))
    monkeypatch.setattr(ml,"infer",AsyncMock(return_value={}))
    from app.errors import Forbidden
    with pytest.raises(Forbidden):
        await ml.analyse_body(ml.BodyRequest(imageId=image,referenceHeightCm=170.0),data)


@pytest.mark.asyncio
@pytest.mark.parametrize("worker_detail,expected",[
 ("Face the camera squarely with level shoulders and hips. private-worker-secret", "Face the camera squarely with level shoulders and hips."),
 ("unrecognized private-worker-secret", "The photo could not be analysed."),
 (None, "The photo could not be analysed."),
])
async def test_pose_rejections_expose_only_known_actionable_guidance(monkeypatch,worker_detail,expected):
    caller=SimpleNamespace(settings=settings(ml_worker_url="http://127.0.0.1:8090",ml_worker_token="x"*64))
    client=httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(422,json={"detail":worker_detail})))
    monkeypatch.setattr(ml.httpx,"AsyncClient",lambda **kwargs:client)
    with pytest.raises(HTTPException) as error:
        await ml.infer(caller,"body-analysis",b"fixture")
    assert error.value.status_code==422
    assert error.value.detail.startswith(expected)
    assert "private-worker-secret" not in error.value.detail


@pytest.mark.asyncio
@pytest.mark.parametrize("detail,expected",[
 ("Background removal was uncertain. Choose a clearer garment photo.","Background removal was uncertain."),
 ("This doesn't look like a piece of clothing. Try a photo of a single garment on a plain background.","The clothing check was uncertain."),
 ("private-worker-secret","The photo could not be analysed."),
])
async def test_garment_upload_rejections_expose_only_known_guidance(monkeypatch,detail,expected):
    caller=SimpleNamespace(settings=settings(ml_worker_url="http://127.0.0.1:8090",ml_worker_token="x"*64))
    client=httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(422,json={"detail":detail})))
    monkeypatch.setattr(ml.httpx,"AsyncClient",lambda **kwargs:client)
    with pytest.raises(HTTPException) as error:await ml.infer(caller,"garment-analysis",b"fixture")
    assert error.value.status_code==422 and error.value.detail.startswith(expected)
    assert "private-worker-secret" not in error.value.detail
