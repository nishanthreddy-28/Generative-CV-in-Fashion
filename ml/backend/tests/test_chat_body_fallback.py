import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from app.api import styling as api
from app.persistence import conversations as store
from app.profiles import service as profile
from app.tryon import jobs as tryon
from app.tryon import hosted as hosted_tryon
from app.tryon import weshop as weshop_tryon
from app.tryon import idm as idm_tryon
from app.pose.models import BodyAnalysis
from app.tryon.common import HostedTryOnError
from app.contracts.styling import ChatRequest
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent


class ChatAndBodyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patcher = patch.object(store, 'PATH', self.root/'state.db'); self.patcher.start(); self.addCleanup(self.patcher.stop)
        store.init()
        api.app.dependency_overrides[api.current_user] = lambda: 'alice'
        self.addCleanup(api.app.dependency_overrides.clear)
        self.client = TestClient(api.app)

    def test_greetings_never_fetch_wardrobe_or_recommend_and_keep_context(self):
        conversation = store.save(None, 'alice', None, {'intent': Intent(occasion='office', required_ids=['shirt']).model_dump(), 'last_ids':['shirt'], 'seen':['outfit']})
        before = store.read(conversation, 'alice')
        with patch.object(api, 'wardrobe', side_effect=AssertionError('wardrobe fetched')), patch.object(api, 'recommend', side_effect=AssertionError('recommended')):
            for message in ['hi','hii','hello!','hey there','thanks','how are you?']:
                response = self.client.post('/phase3/chat', json={'message':message, 'conversation_id':conversation})
                self.assertEqual(response.status_code,200,response.text)
                self.assertEqual(response.json()['status'],'chat')
                self.assertEqual(response.json()['outfits'],[])
        self.assertEqual(store.read(conversation,'alice'),before)
        self.assertEqual(self.client.post('/phase3/chat',json={'message':'   '}).status_code,422)

    def test_model_routed_smalltalk_does_not_recommend(self):
        with patch.object(api,'wardrobe',return_value=[]), patch.object(api.stylist,'interpret',return_value=Interpretation(intent=Intent(),needs_clarification=False,action='chat',reply='I can help with your wardrobe.')), patch.object(api,'recommend',side_effect=AssertionError('recommended')):
            result=self.client.post('/phase3/chat',json={'message':'Explain your capabilities please'}).json()
            from app.chat.routing import FALLBACK
            self.assertEqual(result['status'],'chat')
            self.assertEqual(result['message'],FALLBACK)

    def test_confirmed_pose_is_private_preserved_and_is_not_circumference(self):
        value={'confirmed':True,'image_width':600,'image_height':1000,'landmark_visibility':.9,'reference_height_cm':170,
               'shoulder_hip_ratio':1.5,'shoulder_landmark_span_cm':40,'clothed_waist_front_width_cm':30,'torso_landmark_length_cm':45}
        response=self.client.put('/phase3/body-analysis',json=value)
        self.assertEqual(response.status_code,200,response.text)
        saved=profile.read('alice')
        self.assertIsNone(saved.waist_cm)
        self.assertIsNone(profile.read('bob').body_analysis)
        text=' '.join(profile.contextual_intent(Intent(),saved).preferences)
        self.assertIn('not waist/chest/hip circumferences',text)
        self.client.put('/phase3/profile',json={'height_cm':170,'styles':['casual']})
        self.assertIsNotNone(profile.read('alice').body_analysis)
        self.client.put('/phase3/profile',json={'height_cm':180})
        self.assertIsNone(profile.read('alice').body_analysis)
        value['confirmed']=False
        self.assertEqual(self.client.put('/phase3/body-analysis',json=value).status_code,422)

    def test_reviewed_attributes_keep_originals_and_reach_recommendation_context(self):
        original={'shoulder_hip_ratio':1.5,'shoulder_landmark_span_cm':40,'clothed_waist_front_width_cm':30,'torso_landmark_length_cm':45}
        value={**original,'confirmed':True,'image_width':600,'image_height':1000,'landmark_visibility':.9,'reference_height_cm':170,
               'original_estimates':original,'clothed_waist_front_width_cm':32,'edited_fields':['fake']}
        response=self.client.put('/phase3/body-analysis',json=value)
        self.assertEqual(response.status_code,200,response.text)
        analysis=response.json()['body_analysis']
        self.assertEqual(analysis['clothed_waist_front_width_cm'],32)
        self.assertEqual(analysis['original_estimates']['clothed_waist_front_width_cm'],30)
        self.assertEqual(analysis['edited_fields'],['clothed_waist_front_width_cm'])
        context=' '.join(profile.contextual_intent(Intent(),profile.read('alice')).preferences)
        self.assertIn('32 cm',context); self.assertIn('User corrected',context)
        self.assertIsNone(profile.read('alice').waist_cm)
        value['clothed_waist_front_width_cm']=-1
        self.assertEqual(self.client.put('/phase3/body-analysis',json=value).status_code,422)

    def test_photo_validation_endpoint_uses_real_upload_and_rejects_invalid_image(self):
        from app.pose import validation as photo_validation
        data=io.BytesIO();Image.new('RGB',(128,192)).save(data,format='PNG')
        with patch.object(photo_validation,'validate_person',return_value={'validated':True,'policy':'standing_front_v1'}) as gate:
            response=self.client.post('/phase3/person-photo/validate',files={'file':('person.png',data.getvalue(),'image/png')})
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(gate.call_args.args[0].size,(128,192))
            gate.reset_mock()
            self.assertEqual(self.client.post('/phase3/person-photo/validate',files={'file':('bad.png',b'bad','image/png')}).status_code,422)
            gate.assert_not_called()


class HostedFallbackTests(unittest.TestCase):
    def setUp(self):
        gate=patch('app.pose.validation.validate_person'); gate.start(); self.addCleanup(gate.stop)

    def test_cloud_adapter_copies_image_and_audit_before_temporary_cleanup(self):
        def generate(plan):
            Image.new('RGB',(128,192),'blue').save(plan['output'])
        with patch.object(weshop_tryon,'run_manifest',side_effect=generate):
            result=hosted_tryon.infer(Image.new('RGB',(128,192)),[(Image.new('RGB',(128,128)),'tops')])
        self.assertEqual(result.size,(128,192))
        self.assertEqual(result.getpixel((0,0)),(0,0,255))
        self.assertEqual(result.info['tryon_provider'],'weshop')
        self.assertEqual(result.info['tryon_attempts'],[{'provider':'weshop','status':'completed'}])

    def test_primary_success_does_not_call_backup_and_both_fail_is_not_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); plan={'person':str(root/'person.png'),'output':str(root/'result.png'),'provider':'weshop',
                'garments':[{'path':str(root/'garment.png'),'category':'tops'}]}
            def generate(value): Image.new('RGB',(128,128)).save(value['output'])
            with patch.object(weshop_tryon,'run_manifest',side_effect=generate), patch.object(idm_tryon,'run_manifest') as fallback:
                self.assertEqual(hosted_tryon.run_manifest(plan),'weshop'); fallback.assert_not_called()
            Path(plan['output']).unlink()
            with patch.object(weshop_tryon,'run_manifest',side_effect=HostedTryOnError('primary quota')), patch.object(idm_tryon,'run_manifest',side_effect=HostedTryOnError('backup quota')):
                with self.assertRaisesRegex(HostedTryOnError,'backup quota'): hosted_tryon.run_manifest(plan)
                self.assertTrue(all(a['status']=='failed' for a in json.loads((root/'manifest.json').read_text())['attempts']))

    def test_hosted_generation_survives_local_preparation_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with patch.object(store,'PATH',root/'state.db'), patch.object(tryon,'ROOT',root/'jobs'), patch.object(tryon,'STORAGE_DIR',root):
                store.init(); tryon.init()
                image=io.BytesIO(); Image.new('RGB',(128,128)).save(image,format='PNG')
                job=tryon.create(image.getvalue(),'alice'); directory=tryon.ROOT/job
                plan={'provider':'weshop','person':str(directory/'person.png'),'output':str(directory/'result.png'),'item_ids':[],
                      'warnings':[],'garments':[{'path':str(directory/'garment.png'),'category':'tops'}]}
                (directory/'manifest.json').write_text(json.dumps(plan))
                def hosted(value, progress):
                    self.assertTrue(any('isolation failed' in w for w in value['warnings']))
                    Image.new('RGB',(128,128)).save(value['output'])
                with patch.object(tryon.subprocess,'run',side_effect=subprocess.TimeoutExpired('prepare',180)), patch.object(hosted_tryon,'run_manifest',side_effect=hosted) as generated:
                    tryon.run(job)
                generated.assert_called_once()
                self.assertEqual(tryon.read(job,'alice')['status'],'completed')

    def test_fallback_only_for_one_top_and_records_actual_provider(self):
        for category in ['tops','bottoms']:
            with self.subTest(category=category), tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp); plan={'person':str(root/'person.png'),'output':str(root/'result.png'),'provider':'weshop','warnings':[],'item_ids':[],
                    'garments':[{'path':str(root/'garment.png'),'category':category}]}
                (root/'manifest.json').write_text(json.dumps(plan))
                def generate(value): Image.new('RGB',(128,128),'blue').save(value['output'])
                with patch.object(weshop_tryon,'run_manifest',side_effect=HostedTryOnError('quota')), patch.object(idm_tryon,'run_manifest',side_effect=generate) as fallback:
                    if category=='tops':
                        self.assertEqual(hosted_tryon.run_manifest(plan),'idm')
                        saved=json.loads((root/'manifest.json').read_text())
                        self.assertEqual(saved['actual_provider'],'idm')
                        self.assertEqual([r['status'] for r in saved['attempts']],['failed','completed'])
                    else:
                        with self.assertRaisesRegex(HostedTryOnError,'supports one top only'): hosted_tryon.run_manifest(plan)
                        fallback.assert_not_called()


if __name__=='__main__': unittest.main()
