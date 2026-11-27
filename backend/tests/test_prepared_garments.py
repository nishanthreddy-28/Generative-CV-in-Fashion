from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
import jwt,pytest
from app.config import Settings
from app.ml_sessions import signing_key
from app.prepared_garments import prepared_reference,VERSION

@pytest.mark.asyncio
@pytest.mark.parametrize("change",["source","category","version","owner"])
async def test_stale_or_foreign_preparation_never_loads_storage(monkeypatch,change):
    owner=uuid4();garment=uuid4()
    data=SimpleNamespace(settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64),
        principal=SimpleNamespace(user_id=owner))
    proof={"sub":str(owner),"aud":"saved-prepared-v1","garmentId":str(garment),"sourceHash":"a"*64,"category":"Tops","version":VERSION}
    proof[{"source":"sourceHash","category":"category","version":"version","owner":"sub"}[change]]="changed"
    receipt=jwt.encode(proof,signing_key(data.settings),algorithm="HS256")
    from app import prepared_garments as module
    monkeypatch.setattr(module,"rpc",AsyncMock(return_value={"receipt":receipt}))
    store=AsyncMock();monkeypatch.setattr(module,"storage",store)
    assert await prepared_reference(data,garment,"a"*64,"Tops") is None
    store.assert_not_called()


@pytest.mark.asyncio
async def test_prepare_existing_binds_current_source_and_preserves_metadata(monkeypatch):
    import hashlib
    from app import prepared_garments as module
    owner=uuid4();garment=uuid4()
    data=SimpleNamespace(settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64),principal=SimpleNamespace(user_id=owner))
    repository=AsyncMock(return_value={"category":"Tops"})
    monkeypatch.setattr(module,"rpc",repository)
    monkeypatch.setattr(module,"garment_image",AsyncMock(return_value=SimpleNamespace(body=b"current-source")))
    monkeypatch.setattr(module,"active",AsyncMock())
    infer=AsyncMock(return_value={"cutoutBase64":"cHJldmlldw==","preparedBase64":"cmVmZXJlbmNl","warnings":[],"method":"foreground-only","version":VERSION})
    monkeypatch.setattr(module,"infer",infer)
    response=await module.prepare_existing(garment,SimpleNamespace(),data)
    proof=jwt.decode(response["receipt"],signing_key(data.settings),algorithms=["HS256"],audience="prepared-garment-v1")
    assert proof["sourceHash"]==hashlib.sha256(b"current-source").hexdigest()
    assert proof["sub"]==str(owner)
    assert proof["category"]=="Tops"
    assert infer.call_args.args[2]==b"current-source"
    assert [call.args[1] for call in repository.call_args_list]==["read_wardrobe"]

@pytest.mark.asyncio
async def test_unsupported_saved_category_never_reaches_preparation(monkeypatch):
    from app import prepared_garments as module
    from fastapi import HTTPException
    monkeypatch.setattr(module,"rpc",AsyncMock(return_value={"category":"Accessories"}))
    inference=AsyncMock();monkeypatch.setattr(module,"infer",inference)
    with pytest.raises(HTTPException) as error:
        await module.prepare_existing(uuid4(),SimpleNamespace(),SimpleNamespace())
    assert error.value.status_code==422
    inference.assert_not_called()


@pytest.mark.asyncio
async def test_saved_clean_image_is_returned_for_wardrobe_without_replacing_original(monkeypatch):
    import base64,hashlib,io,time
    from PIL import Image
    from app import prepared_garments as module
    owner=uuid4();garment=uuid4()
    data=SimpleNamespace(settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64),principal=SimpleNamespace(user_id=owner))
    original=io.BytesIO();Image.new("RGB",(256,256),"blue").save(original,"JPEG")
    raw=original.getvalue()
    cutout=Image.new("RGBA",(256,256),(0,0,0,0));cutout.paste((255,0,0,255),(64,64,192,192))
    clean=io.BytesIO();cutout.save(clean,"WEBP",lossless=True)
    reference=io.BytesIO();Image.new("RGB",(256,256),"white").save(reference,"JPEG")
    result={"cutoutBase64":base64.b64encode(clean.getvalue()).decode(),"preparedBase64":base64.b64encode(reference.getvalue()).decode(),"warnings":[],"method":"foreground-only","version":VERSION}
    receipt=jwt.encode({"sub":str(owner),"aud":"prepared-garment-v1","exp":int(time.time())+300,"sourceHash":hashlib.sha256(raw).hexdigest(),"category":"Tops","result":result},signing_key(data.settings),algorithm="HS256")
    state={};objects={};reads=[]
    async def repository(data,operation,body,**kwargs):
        if operation=="read_wardrobe":return {"category":"Tops"}
        if operation=="save_prepared_garment":state["receipt"]=body["p_receipt"]
        if operation=="read_prepared_garment":return state
    async def store(data,method,path,**kwargs):
        if method=="POST":objects[path]=kwargs["content"]
        if method=="GET":
            reads.append(path)
            return objects[path.replace("object/authenticated/","object/")]
    monkeypatch.setattr(module,"rpc",repository);monkeypatch.setattr(module,"storage",store)
    original_read=AsyncMock(return_value=SimpleNamespace(body=raw))
    monkeypatch.setattr(module,"garment_image",original_read)
    assert (await module.confirm_prepared(garment,module.Confirm(receipt=receipt,confirmed=True),data))["saved"]
    response=await module.closet_image(garment,data)
    with Image.open(io.BytesIO(response.body)) as display:
        assert display.mode=="RGBA"
        assert display.getpixel((5,5))[3]==0
        assert display.getpixel((128,128))[0]>240
    assert response.media_type=="image/webp"
    assert len(objects)==2
    assert all(path.startswith("object/wardrobe-derived/"+str(owner)+"/") for path in objects)
    assert original_read.return_value.body==raw
    thumbnail=await module.closet_image(garment,data,size="thumbnail")
    assert thumbnail.headers["cache-control"]=="private, no-store"
    with Image.open(io.BytesIO(thumbnail.body)) as image:
        assert image.size==(256,256)  # Small images are not enlarged.
        assert image.getpixel((5,5))[3]==0
    assert len(reads)==2 and all(path.endswith(".webp") for path in reads)


@pytest.mark.asyncio
async def test_clean_photo_review_includes_only_owned_supported_unprepared_pieces(monkeypatch):
    from app import prepared_garments as module,wardrobe
    clean=SimpleNamespace(id=uuid4(),name="Prepared",category="Tops")
    pending=SimpleNamespace(id=uuid4(),name="Needs review",category="Bottoms")
    ignored=SimpleNamespace(id=uuid4(),name="Accessory",category="Accessories")
    listing=AsyncMock(return_value=SimpleNamespace(items=[clean,pending,ignored],nextCursor=None))
    monkeypatch.setattr(wardrobe,"list_garments",listing)
    async def repository(data,operation,body):
        assert operation=="read_prepared_garment"
        return {"receipt":"saved"} if body["p_id"]==str(clean.id) else None
    monkeypatch.setattr(module,"rpc",repository)
    data=SimpleNamespace()
    result=await module.clean_photo_review(data)
    assert result["items"]==[{"id":str(pending.id),"name":pending.name,"category":"Bottoms"}]
    listing.assert_awaited_once_with(data,limit=100)


@pytest.mark.asyncio
async def test_real_stored_jpeg_hash_attaches_clean_preview_without_conflict(monkeypatch):
    import base64,hashlib,io,time
    from PIL import Image
    from app import prepared_garments as module,wardrobe
    owner=uuid4();garment=uuid4()
    data=SimpleNamespace(settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64),principal=SimpleNamespace(user_id=owner))
    source=io.BytesIO();Image.effect_noise((256,256),70).convert('RGB').save(source,'PNG')
    stored=wardrobe.normalize_image(source.getvalue());assert wardrobe.normalize_image(stored)!=stored
    image_id=uuid4();path=f'{owner}/{image_id}.jpg'
    monkeypatch.setattr(wardrobe,'wardrobe_rpc',AsyncMock(return_value={'id':str(image_id),'object':path,'sha256':hashlib.sha256(stored).hexdigest(),'byteSize':len(stored)}))
    monkeypatch.setattr(wardrobe,'storage',AsyncMock(return_value=stored))
    transparent=io.BytesIO();Image.new('RGBA',(256,256),(0,0,0,0)).save(transparent,'WEBP',lossless=True)
    output={'cutoutBase64':base64.b64encode(transparent.getvalue()).decode(),'preparedBase64':base64.b64encode(stored).decode(),'warnings':[],'method':'foreground-only','version':VERSION}
    receipt=jwt.encode({'sub':str(owner),'aud':'prepared-garment-v1','exp':int(time.time())+300,'sourceHash':hashlib.sha256(stored).hexdigest(),'category':'Tops','result':output},signing_key(data.settings),algorithm='HS256')
    state={};objects={}
    async def repo(data,operation,body,**kwargs):
        if operation=='read_wardrobe':return {'category':'Tops'}
        if operation=='save_prepared_garment':state['receipt']=body['p_receipt'];return {}
        if operation=='read_prepared_garment':return state
        raise AssertionError(operation)
    async def storage(data,method,path,**kwargs):
        if method=='POST':objects[path]=kwargs['content']
        elif method=='GET':return objects[path.replace('object/authenticated/','object/')]
        else:raise AssertionError(method)
    monkeypatch.setattr(module,'rpc',repo);monkeypatch.setattr(module,'storage',storage)
    assert (await module.confirm_prepared(garment,module.Confirm(receipt=receipt,confirmed=True),data))['saved']
    response=await module.closet_image(garment,data)
    assert response.media_type=='image/webp' and response.body==transparent.getvalue()
    assert (await wardrobe.garment_image(garment,data)).body==stored

@pytest.mark.asyncio
async def test_legacy_clean_reference_is_accepted_only_for_same_original(monkeypatch):
    import hashlib,io
    from PIL import Image
    from app import prepared_garments as module,wardrobe
    owner=uuid4();garment=uuid4()
    data=SimpleNamespace(settings=Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64),principal=SimpleNamespace(user_id=owner))
    buffer=io.BytesIO();Image.effect_noise((128,128),60).convert('RGB').save(buffer,'PNG')
    original=wardrobe.normalize_image(buffer.getvalue());legacy=wardrobe.normalize_image(original);reference=b'legacy-reference'
    assert legacy!=original
    proof={'sub':str(owner),'aud':'saved-prepared-v1','garmentId':str(garment),'sourceHash':hashlib.sha256(legacy).hexdigest(),'category':'Tops','version':VERSION,'preparedObject':f'{owner}/reference.jpg','preparedHash':hashlib.sha256(reference).hexdigest()}
    receipt=jwt.encode(proof,signing_key(data.settings),algorithm='HS256')
    monkeypatch.setattr(module,'rpc',AsyncMock(return_value={'receipt':receipt}))
    monkeypatch.setattr(module,'garment_image',AsyncMock(return_value=SimpleNamespace(body=original)))
    storage=AsyncMock(return_value=reference);monkeypatch.setattr(module,'storage',storage)
    assert await module.prepared_reference(data,garment,hashlib.sha256(original).hexdigest(),'Tops')==reference
    storage.reset_mock()
    assert await module.prepared_reference(data,garment,'f'*64,'Tops') is None
    storage.assert_not_called()

@pytest.mark.asyncio
async def test_older_original_gets_a_small_thumbnail_without_changing_full_image(monkeypatch):
    import io
    from fastapi import Response
    from PIL import Image
    from app import prepared_garments as module

    source = io.BytesIO()
    Image.effect_noise((900, 1200), 35).convert("RGB").save(source, "JPEG", quality=90)
    original = Response(source.getvalue(), media_type="image/jpeg")
    monkeypatch.setattr(module, "garment_image", AsyncMock(return_value=original))

    async def repository(data, operation, body, **kwargs):
        return {"category": "Tops"} if operation == "read_wardrobe" else None

    monkeypatch.setattr(module, "rpc", repository)
    data = SimpleNamespace()
    garment_id = uuid4()
    thumbnail = await module.closet_image(garment_id, data, size="thumbnail")
    assert thumbnail.media_type == "image/webp"
    assert len(thumbnail.body) < len(original.body) / 4
    with Image.open(io.BytesIO(thumbnail.body)) as image:
        assert image.size == (336, 448)
    assert await module.closet_image(garment_id, data) is original
