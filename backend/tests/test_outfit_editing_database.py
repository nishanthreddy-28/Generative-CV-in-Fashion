"""Real PostgreSQL editing aggregate transactions and ownership boundaries."""
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import j,rows,create as wardrobe
from test_catalog_database import create as catalog
from test_outfits_database import garments,CREATE,CAPTURE,TARGET,MIXED,OWN

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def test_metadata_patch_preserves_items_and_omitted_fields(users):
    a,_,seed=users
    value=rows(success(seed+garments(a)+CREATE+CAPTURE+
      f"SELECT api.update_outfit({TARGET},{j({'name':'New name','description':''})});SELECT api.read_outfit({TARGET});ROLLBACK;"))
    before=value[-2];after=value[-1]
    assert after['name']=='New name' and after['description']=='' and after['occasion']=='Weekend'
    assert before['items']==after['items']


def test_replace_add_remove_stable_id_and_position(users):
    a,_,seed=users
    _,extra=wardrobe(a,'Extra')
    prefix=seed+garments(a)+CREATE+CAPTURE
    added="jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.second')))"
    value=rows(success(prefix+f"SELECT api.manage_outfit_items({TARGET},'add',{added});SELECT api.read_outfit({TARGET});ROLLBACK;"))
    assert len(value[-1]['items'])==3
    assert value[-1]['items'][:2]==value[-3]['items']
    remove="(api.read_outfit("+TARGET+")->'items'->2->>'id')::uuid"
    value=rows(success(prefix+f"SELECT api.manage_outfit_items({TARGET},'add',{added});SELECT api.manage_outfit_items({TARGET},'remove',NULL,{remove});ROLLBACK;"))
    assert value[-1]['items']==value[-3]['items']
    value=rows(success(prefix+f"SELECT api.manage_outfit_items({TARGET},'replace',{OWN});ROLLBACK;"))
    assert [i['source'] for i in value[-1]['items']]==['wardrobe','wardrobe']
    assert value[-1]['items'][0]['id']==value[-2]['items'][0]['id']
    assert len({i['id'] for i in value[-1]['items']})==2


@pytest.mark.parametrize('operation',["update_outfit({target},'{{\"name\":\"Stolen\"}}')",
 "manage_outfit_items({target},'replace',{refs})","manage_outfit_items({target},'add',{refs})",
 "manage_outfit_items({target},'remove',NULL,'00000000-0000-0000-0000-000000000001')"])
def test_other_user_cannot_modify_outfit(users,operation):
    a,b,seed=users
    result=sql(seed+garments(a)+CREATE+CAPTURE+as_user(b)+'SELECT api.'+operation.format(target=TARGET,refs=MIXED)+';ROLLBACK;')
    assert result.returncode!=0 and 'Outfit not found' in result.stderr


def test_cross_user_reference_and_invalid_replacement_roll_back_whole_aggregate(users):
    a,b,seed=users
    _,foreign=wardrobe(b,'Foreign')
    prefix=seed+garments(a)+CREATE+CAPTURE+as_user(b)+foreign+"SELECT set_config('test.foreign',api.list_wardrobe()->'items'->0->>'id',true);"+as_user(a)
    for refs in ["jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.foreign')),jsonb_build_object('source','catalog','garmentId',current_setting('test.catalog')))",
                 f"jsonb_build_array(jsonb_build_object('source','wardrobe','garmentId',current_setting('test.wardrobe')),jsonb_build_object('source','catalog','garmentId','{uuid4()}'))"]:
        values=rows(success(prefix+f"DO $$BEGIN PERFORM api.manage_outfit_items({TARGET},'replace',{refs});RAISE EXCEPTION 'unexpected success';EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;END;$$;SELECT api.read_outfit({TARGET});ROLLBACK;"))
        before=next(v for v in values if v.get('name')=='My look')
        assert values[-1]['items']==before['items']


@pytest.mark.parametrize('refs',[[],None,[{'source':'invalid','garmentId':str(uuid4())}]*2,
 [{'source':'catalog','garmentId':str(uuid4()),'owner_id':str(uuid4())}]*2,
 [{'source':'wardrobe','garmentId':'bad'}]*2,[{'source':'catalog','garmentId':str(uuid4())}]*101])
def test_invalid_replacements(users,refs):
    a,_,seed=users
    result=sql(seed+garments(a)+CREATE+CAPTURE+f"SELECT api.manage_outfit_items({TARGET},'replace',{j(refs)});ROLLBACK;")
    assert result.returncode!=0 and ('Invalid' in result.stderr or 'Select 2 to 100' in result.stderr)


def test_minimum_duplicate_missing_item_and_inactive_retention(users):
    a,_,seed=users
    prefix=seed+garments(a)+CREATE+CAPTURE
    for call,message in [(f"api.manage_outfit_items({TARGET},'remove',NULL,(api.read_outfit({TARGET})->'items'->0->>'id')::uuid)",'Select 2 to 100'),
      (f"api.manage_outfit_items({TARGET},'remove',NULL,'{uuid4()}')",'Outfit item not found'),
      (f"api.manage_outfit_items({TARGET},'add',jsonb_build_array({MIXED}->0))",'Duplicate outfit item')]:
        result=sql(prefix+'SELECT '+call+';ROLLBACK;')
        assert result.returncode!=0 and message in result.stderr
    value=rows(success(prefix+"SELECT api.delete_catalog(current_setting('test.catalog')::uuid);"+
      f"SELECT api.manage_outfit_items({TARGET},'replace',{MIXED});ROLLBACK;"))
    assert value[-1]['items']==value[-2]['items'] # Retained inactive references do not break unrelated edits.


@pytest.mark.parametrize('changes',[{'name':' '},{'name':'x'*201},{'description':None},{'occasion':'x'*201},
 {'owner_id':str(uuid4())},{'items':[]},{'role':'admin'}])
def test_direct_rpc_metadata_validation(users,changes):
    a,_,seed=users
    result=sql(seed+garments(a)+CREATE+CAPTURE+f"SELECT api.update_outfit({TARGET},{j(changes)});ROLLBACK;")
    assert result.returncode!=0 and 'Invalid outfit fields' in result.stderr


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_inactive_users_cannot_edit(users,state):
    a,_,seed=users
    transition=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    prefix=seed+garments(a)+CREATE+CAPTURE+'SET LOCAL ROLE dd_lifecycle_operator;'+transition+as_user(a)
    for call in [f"api.update_outfit({TARGET},'{{}}')",f"api.manage_outfit_items({TARGET},'replace',{MIXED})"]:
        result=sql(prefix+'SELECT '+call+';ROLLBACK;')
        assert result.returncode!=0 and 'Account access denied' in result.stderr


def test_rls_and_protected_columns_remain_enforced(users):
    a,b,seed=users
    prefix=seed+garments(a)+CREATE+CAPTURE
    for statement in ["WITH changed AS (UPDATE app_private.saved_outfits SET name='Stolen' RETURNING id) SELECT count(*) FROM changed;",
                      'WITH removed AS (DELETE FROM app_private.outfit_items RETURNING id) SELECT count(*) FROM removed;']:
        value=success(prefix+as_user(b)+'SET LOCAL ROLE dd_user_executor;'+statement+'ROLLBACK;')
        assert value.splitlines()[-1]=='0'
    result=sql(prefix+'SET LOCAL ROLE dd_user_executor;'+f"UPDATE app_private.saved_outfits SET owner_id='{b}';ROLLBACK;")
    assert result.returncode!=0 and 'permission denied' in result.stderr
    result=sql(prefix+f'DELETE FROM app_private.outfit_items WHERE outfit_id={TARGET};ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


@pytest.mark.parametrize('operation',["update_outfit('00000000-0000-0000-0000-000000000001','{}')", "manage_outfit_items('00000000-0000-0000-0000-000000000001','replace','[]')"])
def test_anonymous_cannot_call_editing_rpcs(operation):
    result=sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_concurrent_adds_serialize_without_losing_existing_or_new_items(users):
    import subprocess
    import time
    a,b,seed=users
    _,extra=wardrobe(a,'Extra')
    records=rows(success(seed+garments(a)+CREATE+CAPTURE+extra+f'SELECT api.read_outfit({TARGET});COMMIT;'))
    outfit=records[-1];ident=outfit['id'];shared_id=outfit['items'][1]['garmentId']
    candidates=[r['id'] for r in records if isinstance(r,dict) and r.get('imageUrl','').startswith('/wardrobe/') and r['id']!=outfit['items'][0]['garmentId']]
    assert len(candidates)==2
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    process=None
    try:
        first='BEGIN;'+as_user(a)+f"SELECT api.manage_outfit_items('{ident}','add',{j([dict(source='wardrobe',garmentId=candidates[0])])});SELECT pg_sleep(1);COMMIT;"
        process=subprocess.Popen(command+['-c',first],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while success(f"SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%{ident}%' AND wait_event='PgSleep';")!='1':
            assert process.poll() is None and time.monotonic()<deadline
            time.sleep(0.02)
        success('BEGIN;'+as_user(a)+f"SELECT api.manage_outfit_items('{ident}','add',{j([dict(source='wardrobe',garmentId=candidates[1])])});COMMIT;")
        _,error=process.communicate(timeout=5);assert process.returncode==0,error
        after=rows(success('BEGIN;'+as_user(a)+f"SELECT api.read_outfit('{ident}');ROLLBACK;"))[-1]
        assert len(after['items'])==4 and after['items'][:2]==outfit['items']
        assert {i['garmentId'] for i in after['items']}=={i['garmentId'] for i in outfit['items']}|set(candidates)
    finally:
        if process and process.poll() is None:process.kill();process.communicate()
        success(f"BEGIN;SET CONSTRAINTS app_private.outfit_items_wardrobe_garment_id_owner_id_fkey DEFERRED;DELETE FROM auth.users WHERE id IN ('{a}','{b}');DELETE FROM storage.objects WHERE owner_id IN ('{a}','{b}');WITH removed AS (DELETE FROM app_private.catalog_garments WHERE id='{shared_id}' RETURNING image_id) DELETE FROM app_private.catalog_images WHERE id IN (SELECT image_id FROM removed);COMMIT;")
