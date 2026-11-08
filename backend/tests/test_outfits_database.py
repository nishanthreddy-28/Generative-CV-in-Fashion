"""Outfit aggregate integrity against real disposable PostgreSQL; no hosted access."""
import json
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import create as wardrobe, j, rows
from test_catalog_database import create as catalog, grant

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def garments(a):
    _,one=wardrobe(a,'Shirt');_,two=wardrobe(a,'Trousers','Bottoms')
    _,shared=catalog(a,'Jacket','Outerwear')
    return grant(a)+one+two+shared+"SELECT set_config('test.wardrobe',(api.list_wardrobe()->'items'->0->>'id'),true);SELECT set_config('test.second',(api.list_wardrobe()->'items'->1->>'id'),true);SELECT set_config('test.catalog',(api.list_catalog()->'items'->0->>'id'),true);"


MIXED="jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.wardrobe')),jsonb_build_object('source','catalog','garmentId',current_setting('test.catalog')))"
OWN="jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.wardrobe')),jsonb_build_object('source','wardrobe','garmentId',current_setting('test.second')))"
CREATE=f"SELECT api.create_outfit('My look',{MIXED},'Notes','Weekend');"
CAPTURE="SELECT set_config('test.outfit',api.list_outfits()->'items'->0->>'id',true);"
TARGET="current_setting('test.outfit')::uuid"


def test_empty_collection_mixed_creation_and_ordered_detail(users):
    a,b,seed=users
    assert rows(success(seed+as_user(a)+'SELECT api.list_outfits();ROLLBACK;'))[-1]=={'items':[],'nextCursor':None}
    prefix=seed+garments(a)+CREATE+CAPTURE
    output=rows(success(prefix+f'SELECT api.read_outfit({TARGET});SELECT api.list_outfits();ROLLBACK;'))
    outfit=output[-2]
    assert outfit['name']=='My look' and outfit['description']=='Notes' and outfit['occasion']=='Weekend'
    assert [i['source'] for i in outfit['items']]==['wardrobe','catalog']
    assert outfit['garmentIds']==[outfit['items'][0]['garmentId']]
    assert output[-1]['items']==[outfit]
    value=rows(success(seed+garments(a)+f"SELECT api.create_outfit('Own look',{OWN});ROLLBACK;"))[-1]
    assert len(value['garmentIds'])==len(value['items'])==2
    assert rows(success(prefix+as_user(b)+'SELECT api.list_outfits();ROLLBACK;'))[-1]['items']==[]
    result=sql(prefix+as_user(b)+f'SELECT api.read_outfit({TARGET});ROLLBACK;')
    assert result.returncode!=0 and 'Outfit not found' in result.stderr


def test_nonadmin_can_reference_catalog_but_not_other_users_wardrobe(users):
    a,b,seed=users
    prefix=seed+garments(a)
    shared="jsonb_build_array(jsonb_build_object('source','catalog','garmentId',current_setting('test.catalog')),jsonb_build_object('source','wardrobe','garmentId',api.list_wardrobe()->'items'->0->>'id'))"
    _,own=wardrobe(b,'B piece')
    value=rows(success(prefix+as_user(b)+own+f"SELECT api.create_outfit('B look',{shared});ROLLBACK;"))[-1]
    assert len(value['items'])==2
    result=sql(prefix+as_user(b)+CREATE+'ROLLBACK;')
    assert result.returncode!=0 and 'Garment unavailable' in result.stderr


@pytest.mark.parametrize('items',[None,[],[{'source':'wardrobe','garmentId':str(uuid4())}],{},
 [{'source':'other','garmentId':str(uuid4())}]*2,[{'source':'wardrobe','garmentId':'invalid'}]*2,
 [{'source':'wardrobe','garmentId':None}]*2,[{'source':'catalog','garmentId':str(uuid4()),'owner_id':str(uuid4())}]*2,
 [{'source':'wardrobe','garmentId':str(uuid4())}]*101])
def test_rpc_rejects_invalid_items(users,items):
    a,_,seed=users
    result=sql(seed+as_user(a)+f"SELECT api.create_outfit('Look',{j(items)});ROLLBACK;")
    assert result.returncode!=0 and ('Invalid' in result.stderr or 'Select 2 to 100' in result.stderr)


def test_duplicates_and_unavailable_targets_are_atomic(users):
    a,_,seed=users
    prefix=seed+garments(a)
    duplicate="jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.wardrobe')),jsonb_build_object('source','wardrobe','garmentId',upper(current_setting('test.wardrobe'))))"
    for items,message in [(duplicate,'Duplicate outfit item'),
         (f"jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.wardrobe')),jsonb_build_object('source','catalog','garmentId','{uuid4()}'))",'Garment unavailable')]:
        # Catch subtransaction failure and inspect aggregate state after rollback of the failed call.
        value=rows(success(prefix+f"DO $$BEGIN PERFORM api.create_outfit('Bad',{items});RAISE EXCEPTION 'unexpected success';EXCEPTION WHEN SQLSTATE '22023' OR SQLSTATE 'P0002' THEN IF SQLERRM<>'{message}' THEN RAISE;END IF;END;$$;SELECT api.list_outfits();ROLLBACK;"))[-1]
        assert value['items']==[]
    result=sql(prefix+"SELECT api.delete_catalog(current_setting('test.catalog')::uuid);"+CREATE+'ROLLBACK;')
    assert result.returncode!=0 and 'Garment unavailable' in result.stderr


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_disabled_deleting_accounts_denied(users,state):
    a,_,seed=users
    action=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    prefix=seed+'SET LOCAL ROLE dd_lifecycle_operator;'+action+as_user(a)
    for operation in ['list_outfits()',f"read_outfit('{uuid4()}')", "create_outfit('Look','[]')"]:
        result=sql(prefix+'SELECT api.'+operation+';ROLLBACK;')
        assert result.returncode!=0 and 'Account access denied' in result.stderr


@pytest.mark.parametrize('table',['saved_outfits','outfit_items'])
@pytest.mark.parametrize('operation',['SELECT * FROM','DELETE FROM','UPDATE'])
def test_direct_base_access_denied(users,table,operation):
    a,_,seed=users
    suffix=' SET owner_id=owner_id' if operation=='UPDATE' else ''
    result=sql(seed+as_user(a)+f'{operation} app_private.{table}{suffix};ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_executor_rls_parent_owner_source_fk_xor_and_uniqueness(users):
    a,b,seed=users
    prefix=seed+garments(a)+CREATE+CAPTURE
    assert success(prefix+as_user(b)+'SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.outfit_items;ROLLBACK;').splitlines()[-1]=='0'
    attempts=[
      (as_user(b)+"SET LOCAL ROLE dd_user_executor;",f"INSERT INTO app_private.outfit_items(outfit_id,owner_id,position,catalog_garment_id) VALUES({TARGET},'{b}',2,'{uuid4()}');",'foreign key constraint'),
      (as_user(b)+"SET LOCAL ROLE dd_user_executor;",f"INSERT INTO app_private.saved_outfits(owner_id,name) VALUES('{a}','Stolen');",'row-level security'),
      (as_user(a)+"SET LOCAL ROLE dd_user_executor;",f"INSERT INTO app_private.outfit_items(outfit_id,owner_id,position) VALUES({TARGET},'{a}',2);",'check constraint'),
      (as_user(a)+"SET LOCAL ROLE dd_user_executor;",f"INSERT INTO app_private.outfit_items(outfit_id,owner_id,position,wardrobe_garment_id,catalog_garment_id) VALUES({TARGET},'{a}',2,current_setting('test.wardrobe')::uuid,current_setting('test.catalog')::uuid);",'check constraint'),
      (as_user(a)+"SET LOCAL ROLE dd_user_executor;",f"INSERT INTO app_private.outfit_items(outfit_id,owner_id,position,wardrobe_garment_id) VALUES({TARGET},'{a}',2,current_setting('test.wardrobe')::uuid);",'unique constraint')]
    for role,statement,message in attempts:
        result=sql(prefix+role+statement+'ROLLBACK;')
        assert result.returncode!=0 and message in result.stderr
    # B's own parent cannot attach A's wardrobe even when executor-role RLS is exercised directly.
    result=sql(prefix+as_user(b)+"SET LOCAL ROLE dd_user_executor;"+f"INSERT INTO app_private.saved_outfits(owner_id,name) VALUES('{b}','B');INSERT INTO app_private.outfit_items(outfit_id,owner_id,position,wardrobe_garment_id) VALUES((SELECT id FROM app_private.saved_outfits LIMIT 1),'{b}',0,current_setting('test.wardrobe')::uuid);ROLLBACK;")
    assert result.returncode!=0 and 'foreign key constraint' in result.stderr


def test_referenced_wardrobe_delete_restricted_catalog_deactivation_preserves_outfit(users):
    a,_,seed=users
    prefix=seed+garments(a)+CREATE+CAPTURE
    result=sql(prefix+"SELECT api.delete_wardrobe(current_setting('test.wardrobe')::uuid);ROLLBACK;")
    assert result.returncode!=0 and 'foreign key constraint' in result.stderr
    value=rows(success(prefix+f"SELECT api.delete_catalog(current_setting('test.catalog')::uuid);SELECT api.read_outfit({TARGET});ROLLBACK;"))[-1]
    assert len(value['items'])==2
    # Trusted deletion must defer the source FK while both aggregates cascade.
    # This verifies database ordering, not a completed account-deletion workflow.
    value=success(prefix+f"RESET ROLE;SET CONSTRAINTS app_private.outfit_items_wardrobe_garment_id_owner_id_fkey DEFERRED;DELETE FROM auth.users WHERE id='{a}';SET CONSTRAINTS ALL IMMEDIATE;SELECT count(*) FROM app_private.saved_outfits WHERE owner_id='{a}';SELECT count(*) FROM app_private.catalog_garments;ROLLBACK;")
    assert value.splitlines()[-2:]==['0','1']


def test_schema_security_and_pagination(users):
    a,_,seed=users
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname IN ('saved_outfits','outfit_items') AND c.relrowsecurity AND c.relforcerowsecurity;")=='2'
    assert success("SELECT count(*) FROM pg_indexes WHERE schemaname='app_private' AND indexname IN ('outfit_owner_newest','outfit_item_owner','outfit_item_wardrobe','outfit_item_catalog');")=='4'
    prefix=seed+garments(a)+CREATE+CREATE+CREATE
    value=rows(success(prefix+"SELECT api.list_outfits(1);SELECT api.list_outfits(1,api.list_outfits(1)->'nextCursor');ROLLBACK;"))
    assert value[-2]['nextCursor'] and value[-1]['nextCursor']
    assert value[-2]['items'][0]['id']!=value[-1]['items'][0]['id']


@pytest.mark.parametrize('operation',['list_outfits()',f"read_outfit('{uuid4()}')","create_outfit('Look','[]')"])
def test_anonymous_rpc_denied(operation):
    result=sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_catalog_reference_lock_role_is_read_only_and_private(users):
    a,b,seed=users
    prefix=seed+garments(a)
    result=sql(prefix+as_user(b)+"SELECT app_private.lock_outfit_catalog_item(current_setting('test.catalog')::uuid);ROLLBACK;")
    assert result.returncode!=0 and 'permission denied' in result.stderr
    result=sql(prefix+as_user(b)+"SET LOCAL ROLE dd_control_reader;UPDATE app_private.catalog_garments SET id=id WHERE active;ROLLBACK;")
    assert result.returncode!=0 and 'row-level security' in result.stderr
    result=sql(prefix+as_user(b)+"SET LOCAL ROLE dd_control_reader;UPDATE app_private.catalog_garments SET name='Changed';ROLLBACK;")
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_same_uuid_across_sources_is_not_conflated(users):
    a,_,seed=users
    prefix=seed+garments(a)+"RESET ROLE;UPDATE app_private.catalog_garments SET id=current_setting('test.wardrobe')::uuid WHERE id=current_setting('test.catalog')::uuid;SELECT set_config('test.catalog',current_setting('test.wardrobe'),true);"+as_user(a)
    value=rows(success(prefix+CREATE+'ROLLBACK;'))[-1]
    assert value['items'][0]['garmentId']==value['items'][1]['garmentId']
    assert value['items'][0]['source']!=value['items'][1]['source']


def test_catalog_deactivation_race_rejects_later_outfit_and_leaves_no_partial_record(users):
    import subprocess
    import time
    a,b,seed=users
    output=rows(success(seed+garments(a)+'SELECT api.list_wardrobe();SELECT api.list_catalog();COMMIT;'))
    wardrobe_ids=[item['id'] for item in output[-2]['items']]
    catalog_id=output[-1]['items'][0]['id']
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    process=None
    try:
        first='BEGIN;'+as_user(a)+f"SELECT api.delete_catalog('{catalog_id}');SELECT pg_sleep(1);COMMIT;"
        process=subprocess.Popen(command+['-c',first],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while success(f"SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%{catalog_id}%' AND wait_event='PgSleep';")!='1':
            assert process.poll() is None and time.monotonic()<deadline
            time.sleep(0.02)
        refs=[{'source':'wardrobe','garmentId':wardrobe_ids[0]},{'source':'catalog','garmentId':catalog_id}]
        result=sql('BEGIN;'+as_user(a)+f"SELECT api.create_outfit('Racing look',{j(refs)});COMMIT;")
        assert result.returncode!=0 and 'Garment unavailable' in result.stderr
        _,error=process.communicate(timeout=5);assert process.returncode==0,error
        value=rows(success('BEGIN;'+as_user(a)+'SELECT api.list_outfits();ROLLBACK;'))[-1]
        assert value['items']==[]
    finally:
        if process and process.poll() is None:process.kill();process.communicate()
        # Remove only this test's fixtures in the disposable cluster, not hosted data.
        success(f"BEGIN;SET CONSTRAINTS app_private.outfit_items_wardrobe_garment_id_owner_id_fkey DEFERRED;DELETE FROM auth.users WHERE id IN ('{a}','{b}');DELETE FROM storage.objects WHERE owner_id IN ('{a}','{b}');WITH removed AS (DELETE FROM app_private.catalog_garments WHERE id='{catalog_id}' RETURNING image_id) DELETE FROM app_private.catalog_images WHERE id IN (SELECT image_id FROM removed);COMMIT;")
