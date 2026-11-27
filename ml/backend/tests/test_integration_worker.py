"""Private inference HTTP boundary, with model calls intercepted."""
import io
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
from integration_worker.main import app

class PrivateWorkerTests(unittest.TestCase):
    def image(self):
        stream=io.BytesIO()
        Image.new("RGB",(256,512),"white").save(stream,"JPEG")
        return stream.getvalue()

    def test_unconfigured_worker_refuses_inference(self):
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":""}):
            with TestClient(app) as client:
                response=client.post("/internal/v1/body-analysis",files={"image":("x.jpg",self.image())},data={"reference_height_cm":"170"})
                self.assertEqual(response.status_code,503)

    def test_wrong_credentials_refuse_inference(self):
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":"x"*32}):
            with TestClient(app) as client:
                response=client.post("/internal/v1/body-analysis",headers={"Authorization":"Bearer wrong"},files={"image":("x.jpg",self.image())},data={"reference_height_cm":"170"})
                self.assertEqual(response.status_code,401)

    def test_invalid_photo_never_reaches_model(self):
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":"x"*32}), patch("app.pose.validation.analyze_person") as model:
            with TestClient(app) as client:
                response=client.post("/internal/v1/body-analysis",headers={"Authorization":"Bearer "+"x"*32},files={"image":("x.jpg",b"not an image")},data={"reference_height_cm":"170"})
                self.assertEqual(response.status_code,422)
                model.assert_not_called()

    def test_original_height_and_image_reach_existing_model(self):
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":"x"*32}), patch("app.pose.validation.analyze_person",return_value={"confirmed":False}) as model:
            with TestClient(app) as client:
                response=client.post("/internal/v1/body-analysis",headers={"Authorization":"Bearer "+"x"*32},files={"image":("x.jpg",self.image())},data={"reference_height_cm":"170"})
                self.assertEqual(response.status_code,200)
                image,height=model.call_args.args
                self.assertEqual(image.size,(256,512))
                self.assertEqual(height,170)

    def test_out_of_range_height_never_reaches_model(self):
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":"x"*32}), patch("app.pose.validation.analyze_person") as model:
            with TestClient(app) as client:
                response=client.post("/internal/v1/body-analysis",headers={"Authorization":"Bearer "+"x"*32},files={"image":("x.jpg",self.image())},data={"reference_height_cm":"300"})
                self.assertEqual(response.status_code,422)
                model.assert_not_called()

class ApplicationFootwearTests(unittest.TestCase):
    def test_application_allows_top_and_bottom_without_shoes(self):
        from app.recommendations.service import generate
        from app.contracts.styling import Intent
        items=[{"id":"top","slot":"top","category":"Shirt"},{"id":"bottom","slot":"bottom","category":"Jeans"}]
        self.assertEqual(generate(items,Intent())[0],[])
        outfits,issue=generate(items,Intent(),allow_without_shoes=True)
        self.assertIsNone(issue)
        self.assertEqual({item["id"] for item in outfits[0]},{"top","bottom"})

    def test_application_never_returns_single_piece_as_saved_outfit(self):
        from app.recommendations.service import generate
        from app.contracts.styling import Intent
        outfits,_=generate([{"id":"dress","slot":"full","category":"Dress"}],Intent(),allow_without_shoes=True)
        self.assertEqual(outfits,[])


class StylistSelectionTests(unittest.TestCase):
    def test_removing_ui_selection_clears_previous_lock(self):
        from types import SimpleNamespace
        from integration_worker.styling import StylistInput,run
        from app.contracts.styling import Intent
        observed=[]
        def interpret(message,previous,catalog,last):
            observed.append(previous)
            return SimpleNamespace(intent=previous,action="chat",reply="Hello",needs_clarification=False)
        model=SimpleNamespace(model="test",interpret=interpret)
        body=StylistInput(ownerScope="alice",message="Hello",garments=[],previous=Intent(required_ids=["old-shirt"]).model_dump(),previousRequiredIds=["old-shirt"])
        with patch("integration_worker.styling.models",return_value=(None,None,model)):
            response=run(body)
        self.assertEqual(observed[0].required_ids,[])
        self.assertEqual(response["state"]["uiRequiredIds"],[])

    def test_unavailable_selected_piece_requests_review_instead_of_ignoring_it(self):
        from types import SimpleNamespace
        from integration_worker.styling import StylistInput,run
        body=StylistInput(ownerScope="alice",message="Use my shirt",garments=[],requiredIds=["missing"])
        with patch("integration_worker.styling.models",return_value=(None,None,SimpleNamespace(model="test"))):
            response=run(body)
        self.assertEqual(response["status"],"needs_clarification")
        self.assertEqual(response["outfits"],[])


class GarmentResponseContractTests(unittest.TestCase):
    image = PrivateWorkerTests.image
    def test_scored_model_attributes_are_exposed_as_application_labels(self):
        from pathlib import Path
        from types import SimpleNamespace
        attributes={"pattern":{"value":"patterned","confidence":0.71},
            "formality":{"value":"casual","confidence":0.9},
            "season":{"value":"mild","confidence":0.6},
            "fit":{"value":"regular","confidence":0.8}}
        def analyse(raw,owner,tagger,root,pipeline):
            Path(root,"garment.webp").write_bytes(b"preview")
            return SimpleNamespace(category="Shirt",slot="top",attributes=attributes,
                colors=[{"name":"blue","hex":"#224466","share":1.0}],confidence=.9,margin=.4,
                alternatives=[],route="auto",warnings=[],cutout_used=True,image_path="garment.webp")
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":"x"*32,"DRAPE_ML_WARM_MODELS":"0"}),              patch("integration_worker.runtime.models",return_value=(object(),None,None)),              patch("integration_worker.garment_cache.cache.analyse",side_effect=analyse):
            with TestClient(app) as client:
                response=client.post("/internal/v1/garment-analysis",
                    headers={"Authorization":"Bearer "+"x"*32},
                    files={"image":("shirt.jpg",self.image(),"image/jpeg")},
                    data={"owner_scope":"test-owner"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()["attributes"],{key:value["value"] for key,value in attributes.items()})
        self.assertEqual(attributes["pattern"]["confidence"],.71)


class FastStylistPreparationTests(unittest.TestCase):
    def test_saved_pieces_skip_upload_pipeline_and_keep_user_colour(self):
        import base64,json,torch
        from types import SimpleNamespace
        from unittest.mock import Mock
        from integration_worker.styling import StylistInput,run
        from app.contracts.styling import Intent
        tagger=Mock()
        tagger.embed.return_value=torch.tensor([1.,0.])
        tagger.classify.return_value={"category":"Shirt","slot":"top","confidence":.9,"margin":.5,
            "attributes":{key:{"value":value,"confidence":.9} for key,value in
            {"pattern":"solid","formality":"casual","season":"mild","fit":"regular"}.items()}}
        captured=[]
        def interpret(message,previous,catalog,last):
            self.assertEqual(previous.required_ids,["shirt"])
            captured.extend(catalog)
            return SimpleNamespace(intent=Intent(),action="chat",reply="Hello",needs_clarification=False)
        stylist=SimpleNamespace(model="fixture",interpret=interpret)
        body=StylistInput(ownerScope="fixture",message="Hello",requiredIds=["shirt"],garments=[{
            "id":"shirt","name":"My shirt","category":"Tops","color":"light blue",
            "imageBase64":base64.b64encode(PrivateWorkerTests().image()).decode()}])
        with patch("integration_worker.styling.models",return_value=(tagger,None,stylist)), \
             patch("integration_worker.styling.process_upload") as upload:
            result=run(body)
        self.assertEqual(result["status"],"chat")
        upload.assert_not_called()
        tagger.embed.assert_called_once()
        self.assertEqual(captured[0]["colors"][0],"light blue")


class RecommendationMetadataContractTests(unittest.TestCase):
    def test_flattened_attributes_match_real_recommendation_contract(self):
        import json
        from app.contracts.wardrobe import Item
        from app.persistence.wardrobe import row_to_item
        from types import SimpleNamespace
        from unittest.mock import Mock
        import base64,torch
        from integration_worker.styling import StylistInput,run
        from app.contracts.styling import Intent
        tagger=Mock()
        tagger.embed.return_value=torch.tensor([1.,0.])
        attrs={key:{"value":value,"confidence":.9} for key,value in {"pattern":"solid","formality":"casual","season":"mild","fit":"regular"}.items()}
        tagger.classify.return_value={"category":"Shirt","slot":"top","attributes":attrs,"confidence":.9,"margin":.5}
        stylist=SimpleNamespace(model="fixture",interpret=lambda *args:SimpleNamespace(intent=Intent(),action="recommend",needs_clarification=False))
        def recommend(rows,*args,**kwargs):
            for row in rows:Item.model_validate(row_to_item(row))
            return SimpleNamespace(model_dump=lambda:{"status":"no_match","message":"Fixture","outfits":[],"warnings":[]})
        body=StylistInput(ownerScope="fixture",message="Recommend a look",garments=[{"id":"shirt","name":"Shirt","category":"Tops","color":"blue","imageBase64":base64.b64encode(PrivateWorkerTests().image()).decode()}])
        with patch("integration_worker.styling.models",return_value=(tagger,None,stylist)),patch("integration_worker.styling.recommend",side_effect=recommend):
            self.assertEqual(run(body)["status"],"no_match")


class StylistQueueTests(unittest.TestCase):
    def test_busy_cpu_waits_and_releases_both_slots(self):
        from integration_worker import main
        from unittest.mock import Mock
        from integration_worker.styling import StylistInput
        cpu=Mock();cpu.acquire.return_value=True
        admission=Mock();admission.acquire.return_value=True
        with patch.object(main,"slot",cpu),patch.object(main,"stylist_admission",admission),patch("integration_worker.styling.run",return_value={"status":"chat"}):
            self.assertEqual(main.session_stylist(StylistInput(ownerScope="test",message="hello",garments=[]))["status"],"chat")
        cpu.acquire.assert_called_once_with(timeout=60)
        cpu.release.assert_called_once();admission.release.assert_called_once()

    def test_full_queue_is_rate_limited_without_starting_inference(self):
        from integration_worker import main
        from unittest.mock import Mock
        from fastapi import HTTPException
        from integration_worker.styling import StylistInput
        admission=Mock();admission.acquire.return_value=False
        with patch.object(main,"stylist_admission",admission),patch("integration_worker.styling.run") as run:
            with self.assertRaises(HTTPException) as error:main.session_stylist(StylistInput(ownerScope="test",message="hello",garments=[]))
        self.assertEqual(error.exception.status_code,429);run.assert_not_called()


class LargeUploadPreparationTests(unittest.TestCase):
    def test_original_2048_photo_uses_the_1024_cutout_coordinate_space(self):
        import base64,numpy as np
        from pathlib import Path
        from types import SimpleNamespace
        from unittest.mock import Mock
        from integration_worker import tryon
        photo=io.BytesIO();Image.new("RGB",(2048,1542),"white").save(photo,"JPEG")
        def cached(raw,owner,tagger,root,pipeline):
            cutout=Image.new("RGBA",(1024,771),(0,0,0,0))
            cutout.paste((220,220,220,255),(150,80,870,700))
            cutout.paste((0,0,0,0),(350,300,450,400))
            cutout.save(Path(root)/"piece.webp","WEBP",lossless=True)
            return SimpleNamespace(category="Shirt",slot="top",attributes={name:{"value":value,"confidence":.9} for name,value in {"pattern":"solid","formality":"casual","season":"mild","fit":"regular"}.items()},colors=[{"name":"white","hex":"#ffffff","share":1.}],confidence=.9,margin=.5,alternatives=[],route="auto",warnings=[],cutout_used=True,image_path="piece.webp")
        parser=Mock();parser.predict.side_effect=lambda pixels:np.zeros(pixels.shape[:2],dtype=np.uint8)
        with patch.dict(os.environ,{"DRAPE_ML_WORKER_TOKEN":"x"*32,"DRAPE_ML_WARM_MODELS":"0"}),patch("integration_worker.runtime.models",return_value=(object(),None,None)),patch("integration_worker.garment_cache.cache.analyse",side_effect=cached),patch.object(tryon,"_parser",parser):
            with TestClient(app) as client:
                response=client.post("/internal/v1/garment-analysis",headers={"Authorization":"Bearer "+"x"*32},files={"image":("large.jpg",photo.getvalue(),"image/jpeg")},data={"owner_scope":"fixture","prepare_closet":"true"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(parser.predict.call_args.args[0].shape[:2],(771,1024))
        ready=response.json()["preparation"]
        self.assertEqual(ready["category"],"Tops")
        with Image.open(io.BytesIO(base64.b64decode(ready["cutoutBase64"]))) as clean:
            self.assertEqual(clean.mode,"RGBA")
            self.assertLessEqual(clean.width,1024)

    def test_preparation_rejects_misaligned_foreground_explicitly(self):
        import numpy as np
        from app.tryon.preparation import prepare_garment
        with self.assertRaisesRegex(ValueError,"dimensions"):
            prepare_garment(Image.new("RGB",(512,512)),Image.new("RGBA",(256,256)),np.zeros((512,512),dtype=np.uint8),"tops")
