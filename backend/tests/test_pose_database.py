"""Disposable PostgreSQL ownership, validation and invalidation tests."""
import json
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users
from test_onboarding_database import verified,rpc,create_reviewed
pytestmark=pytest.mark.skipif(not SOCKET,reason="Requires disposable PostgreSQL runner")
VALUES={"shoulder_hip_ratio":1.1,"shoulder_landmark_span_cm":40,"clothed_waist_front_width_cm":30,"torso_landmark_length_cm":50}

def setup_photo(users):
    a,b,seed=users
    image,_,reserve,insert,finish,_,review=create_reviewed(a)
    prefix=seed+verified(a)+verified(b)+as_user(a)+reserve+insert+finish+review
    return a,b,image,prefix

def test_pose_save_reload_and_foreign_user_isolation(users):
    a,b,image,prefix=setup_photo(users)
    output=success(prefix+rpc("save_pose_analysis",[image,"opaque-signed-receipt",VALUES])+rpc("read_pose_analysis",[image])+as_user(b)+f"SELECT api.read_pose_analysis('{image}') IS NULL;"+"ROLLBACK;")
    records=[json.loads(line) for line in output.splitlines() if line.startswith("{")]
    assert records[-1]["imageId"]==image and records[-1]["reviewed"]==VALUES
    assert output.splitlines()[-1]=="t"
    assert "permission denied" in sql(prefix+as_user(a)+"SELECT * FROM app_private.pose_analyses;ROLLBACK;").stderr

def test_foreign_user_cannot_confirm_another_users_photo(users):
    a,b,image,prefix=setup_photo(users)
    result=sql(prefix+as_user(b)+rpc("save_pose_analysis",[image,"opaque",VALUES])+"ROLLBACK;")
    assert result.returncode!=0 and "Photo unavailable" in result.stderr

@pytest.mark.parametrize("values",[{},dict(VALUES,waist_cm=70),dict(VALUES,shoulder_hip_ratio=0),dict(VALUES,clothed_waist_front_width_cm="30")])
def test_pose_database_validates_observations(users,values):
    _,_,image,prefix=setup_photo(users)
    assert sql(prefix+rpc("save_pose_analysis",[image,"opaque",values])+"ROLLBACK;").returncode!=0

def test_manual_height_change_invalidates_saved_photo_observations(users):
    _,_,image,prefix=setup_photo(users)
    output=success(prefix+rpc("save_pose_analysis",[image,"opaque",VALUES])+rpc("update_body_profile",[{"height":180}])+
        "SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.pose_analyses;ROLLBACK;")
    assert output.splitlines()[-1]=="0"
