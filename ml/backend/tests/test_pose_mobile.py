import unittest
from unittest.mock import patch
import numpy as np
from fastapi import HTTPException
from pydantic import ValidationError
from app.pose.measurements import estimate
from app.pose.models import BodyAnalysis
from app.cloud.service import CloudEngine
from test_photo_validation import standing
from test_cloud_engine import SupabaseDouble


class MobilePoseTests(unittest.TestCase):
    def test_long_requests_keep_all_constraints_and_body_context(self):
        from app.profiles.service import Profile
        from app.profiles.service import contextual_intent
        from app.contracts.styling import Intent
        points,mask=self.fixture()
        value=estimate(points,mask,600,1000,180)
        saved=Profile(body_analysis=BodyAnalysis.model_validate({**value,'confirmed':True}),styles=['minimal'],waist_cm=80)
        request=Intent(preferences=[f'explicit requirement {i}' for i in range(12)])
        result=contextual_intent(request,saved)
        text=' '.join(result.preferences)
        for constraint in request.preferences: self.assertIn(constraint,text)
        self.assertIn('FRONT width',text)
        self.assertIn('minimal',text)
        self.assertIn('waist_cm',text)
        self.assertEqual(len(result.preferences),12)
        self.assertEqual(request.preferences[-1],'explicit requirement 11')

    def fixture(self):
        mask = np.zeros((1000,600), dtype=np.float32)
        mask[50:950,240:360] = 1
        return standing(), mask

    def test_band_median_survives_one_corrupt_scanline_and_scales_with_height(self):
        points, mask = self.fixture()
        original = estimate(points,mask,600,1000,180)
        self.assertEqual(original, estimate(points,mask[:,:,None],600,1000,180))
        mask[445,200:400] = 1
        value = estimate(points,mask,600,1000,180)
        self.assertEqual(value['clothed_waist_front_width_cm'], original['clothed_waist_front_width_cm'])
        self.assertFalse(value['confirmed'])
        self.assertNotIn('waist_cm', value)
        self.assertAlmostEqual(estimate(points,mask,600,1000,90)['clothed_waist_front_width_cm'] * 2, value['clothed_waist_front_width_cm'])
        with self.assertRaises(ValidationError): BodyAnalysis.model_validate(value)
        self.assertEqual(BodyAnalysis.model_validate({**value,'confirmed':True}).source,'mediapipe_pose_server_v1')

    def test_rejects_merged_arms_crop_and_nonfinite_mask(self):
        for case in ['arms','crop','nan']:
            points, mask = self.fixture()
            if case == 'arms': mask[430:460,100:500] = 1
            elif case == 'crop': mask[0,:] = 1
            else: mask[500,200] = np.nan
            with self.subTest(case=case), self.assertRaises(HTTPException):
                estimate(points,mask,600,1000,180)

    def test_mobile_estimate_does_not_save_and_confirmation_preserves_preferences(self):
        sb = SupabaseDouble()
        points,mask = self.fixture()
        value = estimate(points,mask,600,1000,180)
        engine = CloudEngine(None,None,None,None)
        with patch('app.pose.validation.analyze_person',return_value=value):
            self.assertFalse(engine.body_analysis(sb,sb.user+'/uploads/person.png',180)['confirmed'])
        self.assertEqual(sb.writes,[])
        with self.assertRaises(ValidationError): engine.confirm_body_analysis(sb,value)
        def insert(table,row,**kwargs): sb.writes.append((table,row,kwargs))
        sb.insert = insert
        edited = {**value,'confirmed':True,'clothed_waist_front_width_cm':25}
        result = engine.confirm_body_analysis(sb,edited)
        self.assertEqual(result['styles'],['minimal'])
        self.assertEqual(result['chest_cm'],98)
        self.assertIsNone(result['waist_cm'])
        self.assertEqual(result['body_analysis']['edited_fields'],['clothed_waist_front_width_cm'])
        self.assertEqual(sb.writes[-1][0],'dd_profiles')

    def test_cloud_another_passes_previous_main_items_into_search(self):
        from app.contracts.styling import Interpretation
        from app.contracts.styling import Intent
        from test_recommendations_api import Stylist, Scorer
        sb = SupabaseDouble()
        previous = [row['id'] for row in sb.records]
        rows = sb.rows
        def state(table, **filters):
            if table == 'dd_conversations':
                return [{'state':{'intent':Intent().model_dump(),'last_ids':previous,'seen':[]},'version':0}]
            return rows(table,**filters)
        sb.rows = state
        stylist = Stylist()
        with patch.object(stylist,'interpret',return_value=Interpretation(intent=Intent(another=True),needs_clarification=False)), patch('app.cloud.service.recommend') as recommend:
            from app.contracts.styling import RecommendationResponse
            recommend.return_value = RecommendationResponse(status='unavailable',message='test',intent=Intent())
            CloudEngine(None,Scorer(),stylist,None).chat(sb,{'message':'another','conversation_id':'a'*32})
        self.assertEqual(recommend.call_args.kwargs['last_ids'],previous)

    def test_http_estimation_requires_auth_height_and_confirmation_before_save(self):
        import io
        from PIL import Image
        from fastapi.testclient import TestClient
        from app.api import styling as api
        data=io.BytesIO(); Image.new('RGB',(128,192)).save(data,format='PNG')
        files={'file':('person.png',data.getvalue(),'image/png')}
        api.app.dependency_overrides[api.current_user] = lambda: 'alice'
        self.addCleanup(api.app.dependency_overrides.clear)
        client=TestClient(api.app)
        points,mask=self.fixture(); proposal=estimate(points,mask,600,1000,180)
        with patch('app.pose.validation.analyze_person',return_value=proposal) as analyze, patch('app.profiles.service.save') as save:
            self.assertEqual(client.post('/phase3/body-analysis/estimate',files=files,data={'reference_height_cm':0}).status_code,422)
            analyze.assert_not_called()
            response=client.post('/phase3/body-analysis/estimate',files=files,data={'reference_height_cm':180})
            self.assertEqual(response.status_code,200,response.text)
            self.assertFalse(response.json()['confirmed'])
            save.assert_not_called()
            self.assertEqual(client.put('/phase3/body-analysis',json=response.json()).status_code,422)
        api.app.dependency_overrides[api.current_user] = lambda: (_ for _ in ()).throw(HTTPException(401,'Sign in'))
        self.assertEqual(client.post('/phase3/body-analysis/estimate',files=files,data={'reference_height_cm':180}).status_code,401)
