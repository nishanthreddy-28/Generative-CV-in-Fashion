"""Real PostgreSQL deterministic engine/history/ownership tests in disposable clusters."""
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import create as wardrobe,rows
from test_catalog_database import create as catalog,grant
from test_outfits_database import garments,CREATE

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')
CALL="SELECT api.generate_recommendations('Everyday','',true,5);"


def test_empty_sources_history_and_empty_runs_persist(users):
    a,_,seed=users
    out=rows(success(seed+as_user(a)+CALL+'SELECT api.recent_recommendations();ROLLBACK;'))
    assert out[-2]==out[-1]=={'items':[],'nextCursor':None}
    value=success(seed+as_user(a)+CALL+'SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.recommendation_requests;ROLLBACK;')
    assert value.splitlines()[-1]=='1'


def test_real_wardrobe_generation_and_deterministic_order_content(users):
    a,_,seed=users
    _,top=wardrobe(a,'Top','Tops');_,bottom=wardrobe(a,'Bottom','Bottoms')
    values=rows(success(seed+as_user(a)+top+bottom+CALL+CALL+'SELECT api.recent_recommendations();ROLLBACK;'))
    first,second=values[-3]['items'][0],values[-2]['items'][0]
    assert first['id']!=second['id'] and first['requestId']!=second['requestId']
    for key in ['items','score','reasons','name','occasion','engineVersion']:
        assert first[key]==second[key]
    assert first['score']==69 and len(first['reasons'])>=2
    assert len(first['garmentIds'])==2 and len(values[-1]['items'])==2


def test_preferences_from_profile_and_request_change_score(users):
    a,_,seed=users
    _,top=wardrobe(a,'Linen top','Tops');_,bottom=wardrobe(a,'Denim trousers','Bottoms')
    prefix=seed+as_user(a)+top+bottom
    values=rows(success(prefix+CALL+"SELECT api.update_profile('Alice','Linen','','');SELECT api.generate_recommendations('Everyday','Denim',true,5);ROLLBACK;"))
    assert values[-1]['items'][0]['score']==values[-2]['items'][0]['score']+10
    assert any('preferences' in text for text in values[-1]['items'][0]['reasons'])


def test_saved_occasion_category_pair_contributes_without_copying_outfits(users):
    a,_,seed=users
    prefix=seed+garments(a)
    values=rows(success(prefix+"SELECT api.generate_recommendations('Weekend','',true,5);"+
       "SELECT api.create_outfit('Existing',jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.wardrobe')),jsonb_build_object('source','wardrobe','garmentId',current_setting('test.second'))),'','Weekend');"+
       "SELECT api.generate_recommendations('Weekend','',true,5);ROLLBACK;"))
    assert values[-1]['items'][0]['score']==values[-3]['items'][0]['score']+5
    assert any('saved this category pair' in r for r in values[-1]['items'][0]['reasons'])


def test_catalog_only_mixed_scope_and_inactive_exclusion(users):
    a,_,seed=users
    _,top=catalog(a,'Top','Tops');_,bottom=catalog(a,'Bottom','Bottoms')
    prefix=seed+grant(a)+top+bottom
    values=rows(success(prefix+CALL+"SELECT api.generate_recommendations('Everyday','',false,5);ROLLBACK;"))
    assert values[-2]['items']==[] and len(values[-1]['items'])==1
    assert all(item['source']=='catalog' for item in values[-1]['items'][0]['items'])
    value=rows(success(prefix+"SELECT api.delete_catalog((api.list_catalog()->'items'->0->>'id')::uuid);SELECT api.generate_recommendations('Everyday','',false,5);ROLLBACK;"))[-1]
    assert value['items']==[]


def test_history_revalidates_deleted_wardrobe_and_deactivated_catalog(users):
    a,_,seed=users
    _,top=wardrobe(a,'Top','Tops');_,bottom=catalog(a,'Bottom','Bottoms')
    prefix=seed+grant(a)+top+bottom+"SELECT api.generate_recommendations('Everyday','',false,5);"
    value=rows(success(prefix+"SELECT api.delete_catalog((api.list_catalog()->'items'->0->>'id')::uuid);SELECT api.recent_recommendations();ROLLBACK;"))[-1]
    assert value['items']==[]
    value=rows(success(prefix+"SELECT api.delete_wardrobe((api.list_wardrobe()->'items'->0->>'id')::uuid);SELECT api.recent_recommendations();ROLLBACK;"))[-1]
    assert value['items']==[] # Historical snapshots do not block garment deletion.


def test_other_users_records_and_admin_privileges_do_not_expand_private_scope(users):
    a,b,seed=users
    _,top=wardrobe(a,'Top','Tops');_,bottom=wardrobe(a,'Bottom','Bottoms')
    prefix=seed+as_user(a)+top+bottom+CALL+grant(b)
    values=rows(success(prefix+CALL+'SELECT api.recent_recommendations();SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.recommendation_results;ROLLBACK;'))
    assert values[-2]['items']==values[-1]['items']==[]
    value=success(prefix+'SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.recommendation_results;ROLLBACK;')
    assert value.splitlines()[-1]=='0'


@pytest.mark.parametrize('args',["NULL,'',true,5","'Unknown','',true,5","'Everyday',NULL,true,5","'Everyday','',NULL,5",
 "'Everyday','',true,0","'Everyday','',true,11","'Everyday',repeat('x',2001),true,5"])
def test_direct_request_validation(users,args):
    a,_,seed=users
    result=sql(seed+as_user(a)+f'SELECT api.generate_recommendations({args});ROLLBACK;')
    assert result.returncode!=0 and 'Invalid recommendation request' in result.stderr


@pytest.mark.parametrize('table',['recommendation_requests','recommendation_results'])
@pytest.mark.parametrize('operation',['SELECT * FROM','DELETE FROM'])
def test_base_table_access_denied(users,table,operation):
    a,_,seed=users
    result=sql(seed+as_user(a)+f'{operation} app_private.{table};ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_disabled_deleting_both_routes_denied(users,state):
    a,_,seed=users
    transition=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    for call in [CALL,'SELECT api.recent_recommendations();']:
        result=sql(seed+'SET LOCAL ROLE dd_lifecycle_operator;'+transition+as_user(a)+call+'ROLLBACK;')
        assert result.returncode!=0 and 'Account access denied' in result.stderr


def test_database_constraints_rls_indexes_and_owner_consistency(users):
    a,b,seed=users
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname IN ('recommendation_requests','recommendation_results') AND c.relrowsecurity AND c.relforcerowsecurity;")=='2'
    assert success("SELECT count(*) FROM pg_indexes WHERE schemaname='app_private' AND indexname IN ('recommendation_owner_recent','recommendation_result_owner');")=='2'
    result=sql(seed+as_user(a)+f"SET LOCAL ROLE dd_user_executor;INSERT INTO app_private.recommendation_requests(owner_id,occasion,wardrobe_only,result_limit) VALUES('{b}','Everyday',true,5);ROLLBACK;")
    assert result.returncode!=0 and 'row-level security' in result.stderr
    result=sql(seed+as_user(a)+"SET LOCAL ROLE dd_user_executor;INSERT INTO app_private.recommendation_requests(owner_id,occasion,wardrobe_only,result_limit) VALUES(auth.uid(),'Bad',true,5);ROLLBACK;")
    assert result.returncode!=0 and 'check constraint' in result.stderr


@pytest.mark.parametrize('call',[CALL,'SELECT api.recent_recommendations();'])
def test_anonymous_denied(call):
    result=sql('BEGIN;SET LOCAL ROLE anon;'+call+'ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_dress_shoes_palette_and_occasion_rules(users):
    a,_,seed=users
    _,dress=wardrobe(a,'Dress','Dresses');_,shoes=wardrobe(a,'Shoes','Shoes')
    prefix=seed+as_user(a)+dress+shoes+"SELECT api.write_wardrobe('{\"color\":\"Red\"}',(api.list_wardrobe('Dress')->'items'->0->>'id')::uuid);SELECT api.write_wardrobe('{\"color\":\"Black\"}',(api.list_wardrobe('Shoes')->'items'->0->>'id')::uuid);"
    value=rows(success(prefix+"SELECT api.generate_recommendations('Evening','',true,5);ROLLBACK;"))[-1]['items'][0]
    assert [i['category'] for i in value['items']]==['Dresses','Shoes']
    assert value['score']==79 and any('palette bonus' in text for text in value['reasons'])


def test_result_limit_and_candidate_bound_are_enforced(users):
    a,_,seed=users
    _,top=wardrobe(a,'Top','Tops');_,top2=wardrobe(a,'Second','Tops');_,bottom=wardrobe(a,'Bottom','Bottoms')
    value=rows(success(seed+as_user(a)+top+top2+bottom+"SELECT api.generate_recommendations('Everyday','',true,1);ROLLBACK;"))[-1]
    assert len(value['items'])==1
    many=''.join(wardrobe(a,'Top '+str(n),'Tops')[1] for n in range(41))
    prefix=seed+as_user(a)+many+bottom+"RESET ROLE;UPDATE app_private.wardrobe_garments SET created_at='2020-01-01Z' WHERE category='Bottoms';"+as_user(a)
    assert rows(success(prefix+CALL+'ROLLBACK;'))[-1]['items']==[] # Bottom is outside the newest-40 relevant candidate window.


def test_result_owner_fk_snapshot_shape_and_rank_constraints(users):
    a,b,seed=users
    _,top=wardrobe(a,'Top','Tops');_,bottom=wardrobe(a,'Bottom','Bottoms')
    prefix=seed+as_user(a)+top+bottom+CALL+"SELECT set_config('test.request',(api.recent_recommendations()->'items'->0->>'requestId'),true);"
    for statement,message in [
      (f"INSERT INTO app_private.recommendation_results(request_id,owner_id,rank,items,score,reasons) VALUES(current_setting('test.request')::uuid,'{b}',2,'[]',60,ARRAY['Reason']);",'row-level security'),
      ("INSERT INTO app_private.recommendation_results(request_id,owner_id,rank,items,score,reasons) VALUES(current_setting('test.request')::uuid,auth.uid(),2,'[]',60,ARRAY['Reason']);",'check constraint')]:
        result=sql(prefix+'SET LOCAL ROLE dd_user_executor;'+statement+'ROLLBACK;')
        assert result.returncode!=0 and (message in result.stderr or 'check constraint' in result.stderr)
    result=sql(prefix+as_user(b)+"SET LOCAL ROLE dd_user_executor;INSERT INTO app_private.recommendation_results(request_id,owner_id,rank,items,score,reasons) SELECT current_setting('test.request')::uuid,auth.uid(),2,items,score,reasons FROM app_private.recommendation_results;ROLLBACK;")
    assert result.returncode==0 # No rows from A are selectable through B's execution context.
    for limit in [0,51]:
        result=sql(prefix+f'SELECT api.recent_recommendations({limit});ROLLBACK;')
        assert result.returncode!=0 and 'Invalid history limit' in result.stderr


def test_child_owner_fk_and_explanation_score_integrity(users):
    import re
    a,b,seed=users
    _,top=wardrobe(a,'Linen top','Tops');_,bottom=wardrobe(a,'Bottom','Bottoms')
    prefix=seed+as_user(a)+top+bottom+"SELECT api.generate_recommendations('Everyday','Linen',true,5);"
    row=rows(success(prefix+'ROLLBACK;'))[-1]['items'][0]
    assert sum(int(number) for reason in row['reasons'] for number in re.findall(r'\(\+(\d+)\)',reason))==row['score']
    snapshot="SELECT set_config('test.request',(api.recent_recommendations()->'items'->0->>'requestId'),true);SELECT set_config('test.snapshot',(api.recent_recommendations()->'items'->0->'items')::text,true);"
    insert="INSERT INTO app_private.recommendation_results(request_id,owner_id,rank,items,score,reasons) VALUES(current_setting('test.request')::uuid,auth.uid(),2,current_setting('test.snapshot')::jsonb,60,ARRAY['Reason']);"
    result=sql(prefix+snapshot+as_user(b)+'SET LOCAL ROLE dd_user_executor;'+insert+'ROLLBACK;')
    assert result.returncode!=0 and 'foreign key constraint' in result.stderr
    for rank,score,reasons in [(11,60,"ARRAY['Reason']"),(2,101,"ARRAY['Reason']"),(2,60,"ARRAY[]::text[]")]:
        statement=f"INSERT INTO app_private.recommendation_results(request_id,owner_id,rank,items,score,reasons) VALUES(current_setting('test.request')::uuid,auth.uid(),{rank},current_setting('test.snapshot')::jsonb,{score},{reasons});"
        result=sql(prefix+snapshot+'SET LOCAL ROLE dd_user_executor;'+statement+'ROLLBACK;')
        assert result.returncode!=0 and 'check constraint' in result.stderr
