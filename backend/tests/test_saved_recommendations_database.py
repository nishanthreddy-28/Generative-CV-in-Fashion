"""Real PostgreSQL bookmark provenance, constraints, ownership and pagination."""
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import create as wardrobe,rows
from test_catalog_database import grant,create as catalog

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def generated(a,mixed=False):
    _,top=wardrobe(a,'Top','Tops')
    _,bottom=catalog(a,'Bottom','Bottoms') if mixed else wardrobe(a,'Bottom','Bottoms')
    return (grant(a) if mixed else as_user(a))+top+bottom+"SELECT api.generate_recommendations('Everyday','',"+str(not mixed).lower()+",1);SELECT set_config('test.rec',api.recent_recommendations()->'items'->0->>'id',true);"


REC="current_setting('test.rec')::uuid"
SAVE=f'SELECT api.save_recommendation({REC});'
SAVED="(api.list_saved_recommendations()->'items'->0->>'id')::uuid"


def test_save_duplicate_state_remove_preserves_history(users):
    a,_,seed=users
    result=rows(success(seed+generated(a)+SAVE+SAVE+'SELECT api.list_saved_recommendations();SELECT api.recent_recommendations();ROLLBACK;'))
    first,second=result[-4],result[-3]
    assert first['created'] is True and second['created'] is False and first['id']==second['id']
    assert first['recommendationId']==first['recommendation']['id'] and first['recommendation']['savedId']==first['id']
    assert result[-2]['items'][0]['recommendationId']==first['recommendationId']
    assert result[-1]['items'][0]['savedId']==first['id']
    result=rows(success(seed+generated(a)+SAVE+f'SELECT api.remove_saved_recommendation({SAVED});SELECT api.list_saved_recommendations();SELECT api.recent_recommendations();ROLLBACK;'))
    assert result[-2]['items']==[] and result[-1]['items'][0]['savedId'] is None


@pytest.mark.parametrize('operation',[f'api.save_recommendation({REC})',f'api.remove_saved_recommendation(current_setting(\'test.saved\')::uuid)'])
def test_cross_user_mutations_conceal_existence(users,operation):
    a,b,seed=users
    prefix=seed+generated(a)+SAVE+f"SELECT set_config('test.saved',{SAVED}::text,true);"+as_user(b)
    result=sql(prefix+'SELECT '+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'not found' in result.stderr
    assert rows(success(prefix+'SELECT api.list_saved_recommendations();ROLLBACK;'))[-1]['items']==[]


def test_unavailable_source_rejected_on_save_but_existing_saved_entry_remains_removable(users):
    a,_,seed=users
    for mixed in [False,True]:
        prefix=seed+generated(a,mixed)
        change="SELECT api.delete_catalog((api.list_catalog()->'items'->0->>'id')::uuid);" if mixed else "SELECT api.delete_wardrobe((api.list_wardrobe()->'items'->0->>'id')::uuid);"
        result=sql(prefix+change+SAVE+'ROLLBACK;')
        assert result.returncode!=0 and 'Recommendation garments unavailable' in result.stderr
        value=rows(success(prefix+SAVE+change+'SELECT api.list_saved_recommendations();ROLLBACK;'))[-1]['items'][0]
        assert value['available'] is False and value['recommendation'] is None and value['recommendationId']
        value=rows(success(prefix+SAVE+change+f'SELECT api.remove_saved_recommendation({SAVED});SELECT api.list_saved_recommendations();ROLLBACK;'))[-1]
        assert value['items']==[]


def test_missing_and_trusted_deleted_origin_handled_without_dangling_bookmark(users):
    a,_,seed=users
    result=sql(seed+as_user(a)+f"SELECT api.save_recommendation('{uuid4()}');ROLLBACK;")
    assert result.returncode!=0 and 'Recommendation not found' in result.stderr
    prefix=seed+generated(a)+SAVE+'RESET ROLE;'+f'DELETE FROM app_private.recommendation_results WHERE id={REC};'+as_user(a)
    assert rows(success(prefix+'SELECT api.list_saved_recommendations();ROLLBACK;'))[-1]['items']==[]
    result=sql(prefix+SAVE+'ROLLBACK;')
    assert result.returncode!=0 and 'Recommendation not found' in result.stderr


def test_stable_saved_pagination_with_equal_times_and_removed_anchor(users):
    a,_,seed=users
    prefix=seed+generated(a)+SAVE+"SELECT api.generate_recommendations('Work','',true,1);SELECT set_config('test.rec',api.recent_recommendations()->'items'->0->>'id',true);"
    # Explicitly capture the newly generated result rather than rely on tied request UUID order.
    prefix=seed+generated(a)+SAVE+"DO $$DECLARE p jsonb;BEGIN p:=api.generate_recommendations('Work','',true,1);PERFORM set_config('test.rec',p->'items'->0->>'id',true);END;$$;"+SAVE
    prefix+="RESET ROLE;UPDATE app_private.saved_recommendations SET saved_at='2026-11-09T00:00:00Z';"+as_user(a)
    values=rows(success(prefix+"SELECT api.list_saved_recommendations(1);SELECT api.list_saved_recommendations(1,api.list_saved_recommendations(1)->'nextCursor');ROLLBACK;"))
    assert len(values[-2]['items'])==len(values[-1]['items'])==1
    assert values[-2]['items'][0]['id']!=values[-1]['items'][0]['id'] and values[-1]['nextCursor'] is None
    value=rows(success(prefix+"SELECT set_config('test.cursor',(api.list_saved_recommendations(1)->'nextCursor')::text,true);SELECT api.remove_saved_recommendation((current_setting('test.cursor')::jsonb->>'id')::uuid);SELECT api.list_saved_recommendations(1,current_setting('test.cursor')::jsonb);ROLLBACK;"))[-1]
    assert len(value['items'])==1


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_inactive_users_all_operations_denied(users,state):
    a,_,seed=users
    transition=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    prefix=seed+generated(a)+SAVE+'SET LOCAL ROLE dd_lifecycle_operator;'+transition+as_user(a)
    for operation in [SAVE,'SELECT api.list_saved_recommendations();',f'SELECT api.remove_saved_recommendation({SAVED});']:
        result=sql(prefix+operation+'ROLLBACK;')
        assert result.returncode!=0 and 'Account access denied' in result.stderr


def test_rls_unique_fk_grants_and_immutable_history(users):
    a,b,seed=users
    prefix=seed+generated(a)+SAVE
    result=sql(prefix+'SET LOCAL ROLE dd_user_executor;'+f'INSERT INTO app_private.saved_recommendations(owner_id,recommendation_id) VALUES(auth.uid(),{REC});ROLLBACK;')
    assert result.returncode!=0 and 'unique constraint' in result.stderr
    result=sql(prefix+as_user(b)+'SET LOCAL ROLE dd_user_executor;'+f'INSERT INTO app_private.saved_recommendations(owner_id,recommendation_id) VALUES(auth.uid(),{REC});ROLLBACK;')
    assert result.returncode!=0 and 'foreign key constraint' in result.stderr
    result=sql(prefix+f'SET LOCAL ROLE dd_user_executor;UPDATE app_private.recommendation_results SET id=id WHERE id={REC};ROLLBACK;')
    assert result.returncode!=0 and 'row-level security' in result.stderr
    value=success(prefix+as_user(b)+'SET LOCAL ROLE dd_user_executor;WITH removed AS (DELETE FROM app_private.saved_recommendations RETURNING id) SELECT count(*) FROM removed;ROLLBACK;')
    assert value.splitlines()[-1]=='0'
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname='saved_recommendations' AND c.relrowsecurity AND c.relforcerowsecurity;")=='1'
    assert success("SELECT count(*) FROM pg_indexes WHERE indexname='saved_recommendation_owner_recent';")=='1'


@pytest.mark.parametrize('operation',['SELECT * FROM','DELETE FROM'])
def test_authenticated_base_access_denied(users,operation):
    a,_,seed=users
    result=sql(seed+as_user(a)+operation+' app_private.saved_recommendations;ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


@pytest.mark.parametrize('operation',["save_recommendation('00000000-0000-0000-0000-000000000001')",'list_saved_recommendations()',"remove_saved_recommendation('00000000-0000-0000-0000-000000000001')"])
def test_anonymous_denied(operation):
    assert 'permission denied' in sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;').stderr


@pytest.mark.parametrize('arguments',['0','101',"24,'{}'", "24,'{\"id\":\"bad\",\"savedAt\":\"bad\"}'"])
def test_direct_list_validation(users,arguments):
    a,_,seed=users
    result=sql(seed+as_user(a)+f'SELECT api.list_saved_recommendations({arguments});ROLLBACK;')
    assert result.returncode!=0 and 'Invalid saved' in result.stderr


def test_concurrent_duplicate_saves_create_one_bookmark(users):
    import subprocess
    import time
    a,b,seed=users
    value=rows(success(seed+generated(a)+'SELECT api.recent_recommendations();COMMIT;'))[-1]['items'][0]
    rec=value['id'];request_id=value['requestId'];process=None
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    try:
        process=subprocess.Popen(command+['-c','BEGIN;'+as_user(a)+f"SELECT api.save_recommendation('{rec}');SELECT pg_sleep(1);COMMIT;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while success(f"SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%{rec}%' AND wait_event='PgSleep';")!='1':
            assert process.poll() is None and time.monotonic()<deadline
            time.sleep(0.02)
        second=rows(success('BEGIN;'+as_user(a)+f"SELECT api.save_recommendation('{rec}');COMMIT;"))[-1]
        output,error=process.communicate(timeout=5);assert process.returncode==0,error
        first=rows(output)[0]
        assert first['id']==second['id'] and first['created'] is True and second['created'] is False
        saved=rows(success('BEGIN;'+as_user(a)+'SELECT api.list_saved_recommendations();ROLLBACK;'))[-1]
        assert len(saved['items'])==1
    finally:
        if process and process.poll() is None:process.kill();process.communicate()
        success(f"BEGIN;DELETE FROM auth.users WHERE id IN ('{a}','{b}');DELETE FROM storage.objects WHERE owner_id IN ('{a}','{b}');COMMIT;")
