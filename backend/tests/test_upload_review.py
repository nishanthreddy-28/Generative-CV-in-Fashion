"""Pre-save garment review never creates an application garment implicitly."""
import io,time
from unittest.mock import AsyncMock
from types import SimpleNamespace
from uuid import uuid4
import httpx,pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.dependencies import active_user_data
from app import ml_wardrobe

def app_and_data():
    settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test")
    app=create_app(settings);owner=uuid4()
    data=SimpleNamespace(principal=SimpleNamespace(user_id=owner,expires_at=time.time()+300),
        request=AsyncMock(return_value=httpx.Response(200,json={"userId":str(owner),"active":True})))
    app.dependency_overrides[active_user_data]=lambda:data
    return app,data

def image():
    out=io.BytesIO();Image.new("RGB",(256,256),"white").save(out,"PNG");return out.getvalue()

def result():
    return {"category":"Shirt","slot":"top","attributes":{"pattern":"solid","formality":"casual","season":"mild","fit":"regular"},
        "colors":[{"name":"white","hex":"#ffffff","share":1.0}],"confidence":.8,"margin":.2,"alternatives":[],
        "route":"auto","warnings":[],"cutoutUsed":True,"cutoutMime":"image/webp","cutoutBase64":"dGVzdA==","model":"Marqo/marqo-fashionSigLIP"}

def test_analysis_returns_review_only_and_rechecks_current_account(monkeypatch):
    app,data=app_and_data()
    model=AsyncMock(return_value=result());monkeypatch.setattr(ml_wardrobe,"infer",model)
    with TestClient(app) as client:
        response=client.post("/ml/garments/analyse-upload",files={"image":("shirt.png",image(),"image/png")})
        assert response.status_code==200,response.text
        assert response.json()["category"]=="Shirt"
    assert model.call_args.args[1]=="garment-analysis"
    assert model.call_args.args[2].startswith(b"\xff\xd8")
    assert model.call_args.args[3]["owner_scope"]==str(data.principal.user_id)
    assert [call.args[1] for call in data.request.call_args_list]==["rpc/account_access"]

def test_invalid_file_does_not_reach_the_model(monkeypatch):
    app,_=app_and_data();model=AsyncMock();monkeypatch.setattr(ml_wardrobe,"infer",model)
    with TestClient(app) as client:
        assert client.post("/ml/garments/analyse-upload",files={"image":("x.png",b"not an image","image/png")}).status_code==415
    model.assert_not_called()

def test_disabled_account_cannot_receive_an_analysis(monkeypatch):
    app,data=app_and_data();data.request.return_value=httpx.Response(200,json={"userId":str(data.principal.user_id),"active":False})
    monkeypatch.setattr(ml_wardrobe,"infer",AsyncMock(return_value=result()))
    with TestClient(app) as client:
        assert client.post("/ml/garments/analyse-upload",files={"image":("x.png",image(),"image/png")}).status_code==403

def test_analysis_requires_authentication():
    app,_=app_and_data();app.dependency_overrides.clear()
    with TestClient(app) as client:
        assert client.post("/ml/garments/analyse-upload",files={"image":("x.png",image(),"image/png")}).status_code==401


def test_combined_upload_returns_signed_preparation_for_one_save(monkeypatch):
    import jwt,hashlib
    from app.ml_sessions import signing_key
    from app.wardrobe import normalize_image
    app,data=app_and_data()
    data.settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64)
    analysis=result();analysis["preparation"]={"category":"Tops","cutoutBase64":"Y2xlYW4=","preparedBase64":"cmVmZXJlbmNl","warnings":[],"method":"foreground-only","version":"garment-preparation-v1"}
    model=AsyncMock(return_value=analysis);monkeypatch.setattr(ml_wardrobe,"infer",model)
    with TestClient(app) as client:
        response=client.post("/ml/garments/analyse-upload",files={"image":("shirt.png",image(),"image/png")})
    assert response.status_code==200,response.text
    ready=response.json()["preparation"]
    proof=jwt.decode(ready["receipt"],signing_key(data.settings),algorithms=["HS256"],audience="prepared-garment-v1")
    assert proof["sub"]==str(data.principal.user_id)
    assert proof["category"]=="Tops"
    assert proof["sourceHash"]==hashlib.sha256(model.call_args.args[2]).hexdigest()
    assert model.call_args.args[3]["prepare_closet"]=="true"
    assert ready["cutoutBase64"]=="Y2xlYW4="


@pytest.mark.parametrize("route",["/ml/garments/analyse-upload","/ml/garments/prepare-upload?category=Tops"])
def test_detailed_upload_receipt_confirms_against_once_normalized_original(monkeypatch,route):
    import base64,hashlib
    from fastapi import Response
    from app import prepared_garments as prepared
    from app.wardrobe import normalize_image
    app,data=app_and_data()
    data.settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64)
    im=Image.new("RGB",(256,256));im.putdata([((x*7+y*3)%256,(x*2+y*13)%256,(x*11+y*5)%256) for y in range(256) for x in range(256)])
    out=io.BytesIO();im.save(out,"PNG");raw=out.getvalue();stored=normalize_image(raw)
    assert hashlib.sha256(stored).digest()!=hashlib.sha256(normalize_image(stored)).digest()
    clean=io.BytesIO();im.convert("RGBA").save(clean,"WEBP",lossless=True)
    ready={"cutoutBase64":base64.b64encode(clean.getvalue()).decode(),"preparedBase64":base64.b64encode(stored).decode(),"warnings":[],"method":"foreground-only","version":"garment-preparation-v1"}
    async def inference(*args,**kwargs):
        if args[1]=="prepare-garment":return dict(ready)
        return {**result(),"preparation":{"category":"Tops",**ready}}
    monkeypatch.setattr(ml_wardrobe,"infer",inference);monkeypatch.setattr(prepared,"infer",inference)
    monkeypatch.setattr(prepared,"active",AsyncMock())
    monkeypatch.setattr(prepared,"rpc",AsyncMock(return_value={"category":"Tops"}))
    monkeypatch.setattr(prepared,"storage",AsyncMock())
    original=AsyncMock(return_value=Response(stored,media_type="image/jpeg"));monkeypatch.setattr(prepared,"garment_image",original)
    with TestClient(app) as client:
        review=client.post(route,files={"image":("detailed.png",raw,"image/png")})
        assert review.status_code==200,review.text
        body=review.json();receipt=(body.get("preparation") or body)["receipt"]
        garment=uuid4()
        saved=client.post(f"/ml/garments/{garment}/prepared",json={"receipt":receipt,"confirmed":True})
        assert saved.status_code==200,saved.text
        original.return_value=Response(normalize_image(stored),media_type="image/jpeg")
        assert client.post(f"/ml/garments/{garment}/prepared",json={"receipt":receipt,"confirmed":True}).status_code==409
