import json
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users
from test_onboarding_database import verified,rpc
pytestmark=pytest.mark.skipif(not SOCKET,reason="Requires disposable PostgreSQL")

def test_session_history_is_private_and_supports_bookmarks_feedback(users):
    a,b,seed=users;ident=str(uuid4());conversation=str(uuid4())
    prefix=seed+verified(a)+verified(b)+as_user(a)
    output=success(prefix+rpc("save_ml_session",[ident,conversation,"stylist","opaque-signed-receipt"])+
        rpc("update_ml_session",[ident,True,"like"])+rpc("read_ml_session",[ident])+
        as_user(b)+rpc("read_ml_sessions",[20,None,False])+"ROLLBACK;")
    rows=[json.loads(line) for line in output.splitlines() if line.startswith("{")]
    assert rows[-1]["bookmarked"] is True and rows[-1]["feedback"]=="like"
    assert output.splitlines()[-1]=="[]"
    assert "permission denied" in sql(prefix+"SELECT * FROM app_private.ml_session_results;ROLLBACK;").stderr

def test_foreign_user_cannot_modify_a_session_result(users):
    a,b,seed=users;ident=str(uuid4())
    result=sql(seed+verified(a)+verified(b)+as_user(a)+rpc("save_ml_session",[ident,str(uuid4()),"stylist","opaque"])+
        as_user(b)+rpc("update_ml_session",[ident,True,None])+"ROLLBACK;")
    assert result.returncode!=0 and "Result unavailable" in result.stderr

def test_session_output_bucket_is_private_and_foreign_storage_access_denied(users):
    a,b,seed=users;ident=str(uuid4());obj=f"{a}/{ident}.jpg"
    insert=f"INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES('{ident}','{a}','ml-session-images','{obj}','{{}}'::jsonb);"
    out=success(seed+verified(a)+verified(b)+as_user(a)+insert+as_user(b)+
        "SELECT count(*) FROM storage.objects WHERE bucket_id='ml-session-images';ROLLBACK;")
    assert out.splitlines()[-1]=="0"
    assert success("SELECT public FROM storage.buckets WHERE id='ml-session-images';")=="f"


def test_account_locked_inference_reads_use_postgrest_write_transactions():
    # PostgREST chooses transaction access from the PUBLIC wrapper volatility.
    # These functions call require_active_account(), which takes FOR SHARE.
    out=success("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('api','app_private') AND p.proname IN ('read_pose_analysis','read_ml_sessions','read_ml_session') AND p.provolatile='v';")
    assert out=="6"


def test_all_account_lock_callers_have_writable_postgrest_transactions():
    # Audit the complete call chain, including API wrappers, so new reads cannot
    # silently reintroduce PostgREST read-only failures around lifecycle locks.
    out=success("""WITH RECURSIVE callers AS (
      SELECT n.nspname,p.proname,p.provolatile,p.prosrc
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='app_private' AND p.proname='require_active_account'
      UNION
      SELECT n.nspname,p.proname,p.provolatile,p.prosrc
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN callers c ON position(c.nspname||'.'||c.proname||'(' in p.prosrc)>0
      WHERE n.nspname IN ('api','app_private')
    ) SELECT count(*) FROM callers WHERE provolatile<>'v';""")
    assert out=="0"


def test_deleted_tryon_is_hidden_and_delete_is_retryable(users):
    a,b,seed=users;ident=str(uuid4());stylist=str(uuid4())
    out=success(seed+verified(a)+as_user(a)+rpc("save_ml_session",[ident,str(uuid4()),"tryon","opaque"])+
      rpc("save_ml_session",[stylist,str(uuid4()),"stylist","opaque"])+
      rpc("delete_tryon_session",[ident])+rpc("delete_tryon_session",[ident])+
      rpc("read_tryon_sessions",[100])+rpc("read_ml_sessions",[100,None,False])+"ROLLBACK;")
    arrays=[json.loads(line) for line in out.splitlines() if line.startswith('[')]
    assert arrays[-2]==[]
    assert [row['id'] for row in arrays[-1]]==[stylist]

@pytest.mark.parametrize('foreign,kind',[(True,'tryon'),(False,'stylist')])
def test_delete_refuses_foreign_and_non_tryon_history(users,foreign,kind):
    a,b,seed=users;ident=str(uuid4())
    result=sql(seed+verified(a)+verified(b)+as_user(a)+rpc("save_ml_session",[ident,str(uuid4()),kind,"opaque"])+
        (as_user(b) if foreign else '')+rpc('delete_tryon_session',[ident])+"ROLLBACK;")
    assert result.returncode!=0 and 'Result unavailable' in result.stderr

def test_deleted_preview_cannot_be_read_or_bookmarked(users):
    a,b,seed=users;ident=str(uuid4())
    prefix=seed+verified(a)+as_user(a)+rpc("save_ml_session",[ident,str(uuid4()),"tryon","opaque"])+rpc('delete_tryon_session',[ident])
    for command in [rpc('read_ml_session',[ident]),rpc('update_ml_session',[ident,True,None])]:
        result=sql(prefix+command+'ROLLBACK;')
        assert result.returncode!=0 and 'Result unavailable' in result.stderr
