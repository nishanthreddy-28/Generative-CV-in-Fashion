import time
from uuid import uuid4
import jwt
import pytest
from fastapi import HTTPException
from app.config import Settings
from app.ml_contracts import BodyAnalysis
from app.pose_receipts import issue,verify,key,AUDIENCE

def configuration():
    return Settings(_env_file=None,supabase_url="https://test.supabase.co",supabase_publishable_key="sb_publishable_test",ml_worker_token="x"*64)

def observation():
    values={"shoulder_hip_ratio":1.1,"shoulder_landmark_span_cm":40.0,"clothed_waist_front_width_cm":30.0,"torso_landmark_length_cm":50.0}
    return BodyAnalysis(**values,source="mediapipe_pose_server_v1",confirmed=False,reference_height_cm=170,
        image_width=512,image_height=1024,landmark_visibility=.9,original_estimates=values,edited_fields=[])

def test_receipt_round_trip_preserves_originals_and_calibration():
    settings=configuration();owner=uuid4();image=uuid4()
    receipt=issue(settings,owner,image,"a"*64,observation())
    proof,analysis=verify(settings,receipt,owner,image)
    assert proof["imageHash"]=="a"*64
    assert analysis.original_estimates.clothed_waist_front_width_cm==30
    assert analysis.reference_height_cm==170

@pytest.mark.parametrize("different",["user","image","signature"])
def test_receipt_rejects_foreign_identity_image_and_signature(different):
    settings=configuration();owner=uuid4();image=uuid4()
    receipt=issue(settings,owner,image,"a"*64,observation())
    if different=="user":owner=uuid4()
    if different=="image":image=uuid4()
    if different=="signature":
        pieces=receipt.split(".");pieces[1]=("A" if pieces[1][0]!="A" else "B")+pieces[1][1:];receipt=".".join(pieces)
    with pytest.raises(HTTPException) as error:verify(settings,receipt,owner,image)
    assert error.value.status_code==409

def test_expired_receipt_cannot_confirm_but_saved_originals_remain_readable():
    settings=configuration();owner=uuid4();image=uuid4()
    payload={"sub":str(owner),"aud":AUDIENCE,"iat":int(time.time())-3600,"exp":int(time.time())-1800,
        "jti":str(uuid4()),"imageId":str(image),"imageHash":"a"*64,"analysis":observation().model_dump()}
    receipt=jwt.encode(payload,key(settings),algorithm="HS256")
    with pytest.raises(HTTPException):verify(settings,receipt,owner,image)
    assert verify(settings,receipt,owner,image,saved=True)[1].confirmed is False

def test_confirmation_preserves_originals_and_marks_only_actual_edits():
    from types import SimpleNamespace
    from app.ml import confirmed_projection
    settings=configuration();owner=uuid4();image=uuid4();original=observation()
    receipt=issue(settings,owner,image,"a"*64,original)
    reviewed=original.original_estimates.model_dump();reviewed["clothed_waist_front_width_cm"]=31.0
    result=confirmed_projection(SimpleNamespace(settings=settings,principal=SimpleNamespace(user_id=owner)),image,
        {"receipt":receipt,"reviewed":reviewed,"confirmedAt":"2026-11-24T00:00:00Z"},"a"*64)
    assert result["analysis"]["confirmed"] is True
    assert result["analysis"]["clothed_waist_front_width_cm"]==31
    assert result["analysis"]["original_estimates"]["clothed_waist_front_width_cm"]==30
    assert result["analysis"]["edited_fields"]==["clothed_waist_front_width_cm"]
