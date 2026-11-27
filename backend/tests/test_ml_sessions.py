"""Session-only inference boundaries; providers and hosted data are intercepted."""
import time
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.ml_sessions import sign_record,decode_record
from app.ml_tryon import generated_image

def settings():
    return Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",
        ml_worker_token="x"*64,ml_receipt_signing_key="y"*64)

def data():
    return SimpleNamespace(settings=settings(),principal=SimpleNamespace(user_id=uuid4(),expires_at=time.time()+300))

def test_new_features_require_authentication():
    with TestClient(create_app(settings())) as client:
        for path,body in [("/ml/stylist",{"message":"hello"}),("/ml/history/"+str(uuid4()),{"feedback":"like"})]:
            response=client.post(path,json=body) if path.endswith("stylist") else client.patch(path,json=body)
            assert response.status_code==401
        assert client.get("/ml/history").status_code==401
        assert client.post("/ml/session-tryon").status_code==401

def test_history_signature_binds_owner_record_and_conversation():
    caller=data();ident=uuid4();conversation=uuid4()
    receipt=sign_record(caller,ident,conversation,"stylist",{"state":{},"outfits":[]})
    row={"id":str(ident),"conversationId":str(conversation),"kind":"stylist","receipt":receipt}
    assert decode_record(caller,row)["outfits"]==[]
    foreign=data()
    with pytest.raises(HTTPException):decode_record(foreign,row)
    row["id"]=str(uuid4())
    with pytest.raises(HTTPException):decode_record(caller,row)

def test_worker_token_rotation_preserves_saved_history():
    caller=data();ident=uuid4();conversation=uuid4()
    receipt=sign_record(caller,ident,conversation,"stylist",{"outfits":[]})
    caller.settings.ml_worker_token="z"*64
    # Revalidation is not needed for this fixture; signing uses the separate API-only key.
    assert decode_record(caller,{"id":str(ident),"conversationId":str(conversation),"kind":"stylist","receipt":receipt})["outfits"]==[]

@pytest.mark.asyncio
async def test_generated_image_rejects_foreign_storage_path(monkeypatch):
    caller=data();ident=uuid4();conversation=uuid4()
    value={"imageObject":f"{uuid4()}/{ident}.jpg","imageHash":"a"*64}
    receipt=sign_record(caller,ident,conversation,"tryon",value)
    from app import ml_tryon
    monkeypatch.setattr(ml_tryon,"rpc",AsyncMock(return_value={"id":str(ident),"conversationId":str(conversation),"kind":"tryon","receipt":receipt}))
    storage=AsyncMock();monkeypatch.setattr(ml_tryon,"storage",storage)
    with pytest.raises(HTTPException) as error:await generated_image(ident,caller)
    assert error.value.status_code==404
    storage.assert_not_called()

@pytest.mark.asyncio
async def test_generated_image_validates_signed_output_hash(monkeypatch):
    caller=data();ident=uuid4();conversation=uuid4()
    value={"imageObject":f"{caller.principal.user_id}/{ident}.jpg","imageHash":"a"*64}
    receipt=sign_record(caller,ident,conversation,"tryon",value)
    from app import ml_tryon
    monkeypatch.setattr(ml_tryon,"rpc",AsyncMock(return_value={"id":str(ident),"conversationId":str(conversation),"kind":"tryon","receipt":receipt}))
    monkeypatch.setattr(ml_tryon,"storage",AsyncMock(return_value=b"modified image"))
    with pytest.raises(HTTPException) as error:await generated_image(ident,caller)
    assert error.value.status_code==503

@pytest.mark.asyncio
async def test_expired_session_cannot_publish_results():
    from app.ml_sessions import active
    from app.errors import Forbidden
    caller=data()
    caller.request=AsyncMock(return_value=httpx.Response(200,json={"userId":str(caller.principal.user_id),"active":False}))
    with pytest.raises(Forbidden):await active(caller)


@pytest.mark.parametrize("provider_status", [200,503])
def test_multipart_session_generation_and_private_image_readback(monkeypatch,provider_status):
    import io,base64
    from PIL import Image
    from fastapi import Response
    from app import ml_tryon,prepared_garments
    from app.dependencies import active_user_data
    caller=data();caller.settings=caller.settings.model_copy(update={"ml_worker_url":"http://127.0.0.1:8090"})
    garment=uuid4();buffer=io.BytesIO();Image.new("RGB",(256,256),"blue").save(buffer,"JPEG");photo=buffer.getvalue()
    rows={};objects={};calls=[]
    async def db(_,name,args,**kwargs):
        if name=="read_ml_sessions":return []
        if name=="read_wardrobe":return {"id":str(garment),"category":"Tops"}
        if name=="save_ml_session":
            rows[args["p_id"]]={"id":args["p_id"],"conversationId":args["p_conversation_id"],"kind":"tryon","receipt":args["p_receipt"]};return {}
        if name=="read_ml_session":return rows[args["p_id"]]
        raise AssertionError(name)
    async def files(_,method,path,**kwargs):
        if method=="POST":objects[path.removeprefix("object/")]=kwargs["content"];return None
        if method=="GET":return objects[path.removeprefix("object/authenticated/")]
        raise AssertionError(method)
    def worker(request):
        calls.append(request)
        assert request.url.path=="/internal/v1/session-tryon"
        assert request.headers["authorization"]=="Bearer "+"x"*64
        return httpx.Response(provider_status,json={"provider":"weshop","mime":"image/jpeg","imageBase64":base64.b64encode(photo).decode(),"warnings":[],"attempts":[]})
    original=httpx.AsyncClient
    monkeypatch.setattr(ml_tryon.httpx,"AsyncClient",lambda **kwargs:original(transport=httpx.MockTransport(worker)))
    monkeypatch.setattr(ml_tryon,"rpc",db);monkeypatch.setattr(ml_tryon,"storage",files)
    monkeypatch.setattr(ml_tryon,"garment_image",AsyncMock(return_value=Response(photo,media_type="image/jpeg")))
    monkeypatch.setattr(prepared_garments,"prepared_reference",AsyncMock(return_value=photo))
    monkeypatch.setattr(ml_tryon,"active",AsyncMock())
    app=create_app(caller.settings);app.dependency_overrides[active_user_data]=lambda:caller
    fields={"garmentId":str(garment),"source":"wardrobe","photoConsent":"true"}
    with TestClient(app) as client:
        r=client.post("/ml/session-tryon?provider=weshop",data=fields,files={"person":("gallery.jpg",photo,"image/jpeg")})
        assert r.status_code==(200 if provider_status==200 else 503)
        if provider_status==200:
            value=r.json();assert "imageObject" not in value
            result=client.get(value["imageUrl"])
            assert result.status_code==200 and result.headers["content-type"]=="image/jpeg"
            assert result.headers["cache-control"]=="private, no-store"
            assert result.content.startswith(b"\xff\xd8") and len(objects)==1
        else:assert not rows and not objects
        fields.pop("photoConsent")
        assert client.post("/ml/session-tryon",data=fields,files={"person":("gallery.jpg",photo,"image/jpeg")}).status_code==422
        assert len(calls)==1


@pytest.mark.asyncio
async def test_tryon_deletion_tombstones_before_owner_scoped_image_cleanup(monkeypatch):
    from app import ml_tryon
    caller=data();ident=uuid4();steps=[]
    async def db(*args,**kwargs):steps.append(("rpc",args[1],args[2]))
    async def files(*args,**kwargs):steps.append(("storage",args[1],args[2],kwargs))
    monkeypatch.setattr(ml_tryon,"rpc",db);monkeypatch.setattr(ml_tryon,"storage",files)
    result=await ml_tryon.delete_preview(ident,caller)
    assert result.status_code==204
    assert steps[0]==("rpc","delete_tryon_session",{"p_id":str(ident)})
    assert steps[1]==("storage","DELETE","object/ml-session-images",{"body":{"prefixes":[f"{caller.principal.user_id}/{ident}.jpg"]}})

@pytest.mark.asyncio
async def test_foreign_or_stylist_result_cannot_trigger_image_cleanup(monkeypatch):
    from app import ml_tryon
    async def absent(*args,**kwargs):raise HTTPException(404,"Preview unavailable.")
    files=AsyncMock();monkeypatch.setattr(ml_tryon,"rpc",absent);monkeypatch.setattr(ml_tryon,"storage",files)
    with pytest.raises(HTTPException):await ml_tryon.delete_preview(uuid4(),data())
    files.assert_not_called()

@pytest.mark.asyncio
async def test_tryon_cleanup_failure_is_reported_and_deletion_can_retry(monkeypatch):
    from app import ml_tryon
    caller=data();ident=uuid4();db=AsyncMock()
    files=AsyncMock(side_effect=[HTTPException(503,"Storage unavailable."),None])
    monkeypatch.setattr(ml_tryon,"rpc",db);monkeypatch.setattr(ml_tryon,"storage",files)
    with pytest.raises(HTTPException):await ml_tryon.delete_preview(ident,caller)
    assert (await ml_tryon.delete_preview(ident,caller)).status_code==204
    assert db.await_count==2

@pytest.mark.asyncio
async def test_tryon_history_filters_in_database_before_limit(monkeypatch):
    from app import ml_sessions
    db=AsyncMock(return_value=[]);monkeypatch.setattr(ml_sessions,"rpc",db)
    caller=data()
    assert await ml_sessions.history(caller,limit=100,kind="tryon",bookmarked=False)=={"items":[],"nextCursor":None}
    db.assert_awaited_once_with(caller,"read_tryon_sessions",{"p_limit":100})

def test_tryon_delete_requires_authentication():
    with TestClient(create_app(settings())) as client:
        assert client.delete('/ml/history/'+str(uuid4())).status_code==401
