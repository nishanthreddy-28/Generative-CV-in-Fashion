"""Wardrobe tests against real disposable PostgreSQL RLS/constraints, not hosted Storage."""
import json
from uuid import uuid4

import pytest

from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def j(value):return "'"+json.dumps(value).replace("'","''")+"'::jsonb"

def rows(value):return [json.loads(line) for line in value.splitlines() if line.startswith('{') or line.startswith('[')]


def upload(user,image=None):
    image=image or str(uuid4())
    return image, (f"SELECT api.reserve_wardrobe_image('{image}','"+'a'*64+"',100);"+
      f"INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES('{uuid4()}','{user}','wardrobe-images','{user}/{image}.jpg','{{\"mimetype\":\"image/jpeg\",\"size\":100}}');")


def create(user,name='Shirt',category='Tops',brand='Maker'):
    image,statement=upload(user)
    return image,statement+f"SELECT api.write_wardrobe({j(dict(name=name,category=category,brand=brand))},NULL,'{image}');"


def test_crud_partial_updates_clear_and_cleanup(users):
    a,_,seed=users
    image,statement=create(a)
    result=rows(success(seed+as_user(a)+statement+f"SELECT api.list_wardrobe();ROLLBACK;"))[-1]
    garment=result['items'][0]
    assert garment['name']=='Shirt' and garment['brand']=='Maker' and result['nextCursor'] is None
    ident=garment['id']
    # Rebuild with an explicit garment id obtained inside the same transaction.
    value=rows(success(seed+as_user(a)+statement+"DO $$DECLARE g uuid;BEGIN SELECT (api.list_wardrobe()->'items'->0->>'id')::uuid INTO g;"+
       f"PERFORM api.write_wardrobe({j({'notes':'Changed'})},g);END;$$;SELECT api.list_wardrobe();ROLLBACK;"))[-1]['items'][0]
    assert value['name']=='Shirt' and value['brand']=='Maker' and value['notes']=='Changed'
    output=rows(success(seed+as_user(a)+statement+"DO $$DECLARE g uuid;BEGIN SELECT (api.list_wardrobe()->'items'->0->>'id')::uuid INTO g;"+
       "PERFORM api.delete_wardrobe(g);END;$$;SELECT api.list_wardrobe();SELECT api.wardrobe_image_cleanup();ROLLBACK;"))
    assert output[-2]['items']==[] and output[-1][0]['id']==image


@pytest.mark.parametrize('operation',['read','patch','delete','image'])
def test_cross_user_id_is_inaccessible(users,operation):
    a,b,seed=users
    _,statement=create(a)
    # Capture A's id using transaction-local setting; no client owner input used in RPC.
    capture="SELECT set_config('test.garment',api.list_wardrobe()->'items'->0->>'id',true);"
    target="current_setting('test.garment')::uuid"
    call={'read':f'SELECT api.read_wardrobe({target});','patch':f"SELECT api.write_wardrobe({j({'name':'Stolen'})},{target});",
          'delete':f'SELECT api.delete_wardrobe({target});','image':f'SELECT api.wardrobe_image_info({target});'}[operation]
    result=sql(seed+as_user(a)+statement+capture+as_user(b)+call+'ROLLBACK;')
    assert result.returncode!=0 and 'Garment not found' in result.stderr


def test_list_and_nonowner_executor_rls_isolate_users(users):
    a,b,seed=users
    _,statement=create(a)
    value=rows(success(seed+as_user(a)+statement+as_user(b)+'SELECT api.list_wardrobe();ROLLBACK;'))[-1]
    assert value=={'items':[],'nextCursor':None}
    value=success(seed+as_user(a)+statement+as_user(b)+'SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.wardrobe_garments;ROLLBACK;')
    assert value.splitlines()[-1]=='0'


@pytest.mark.parametrize('changes',[{'name':' '},{'category':'Invalid'},{'color':None},{'brand':42},
 {'notes':'x'*2001},{'name':'x'*201},{'owner_id':'someone'},{'image_id':str(uuid4())},{'price':15}])
def test_direct_api_write_revalidates_metadata(users,changes):
    a,_,seed=users
    image,statement=upload(a)
    result=sql(seed+as_user(a)+statement+f'SELECT api.write_wardrobe({j(changes)},NULL,\'{image}\');ROLLBACK;')
    assert result.returncode!=0 and ('Invalid' in result.stderr or 'required' in result.stderr)


def test_required_image_cannot_be_missing_or_cross_owned(users):
    a,b,seed=users
    image,statement=upload(a)
    fields=j({'name':'Shirt','category':'Tops'})
    result=sql(seed+as_user(a)+statement+as_user(b)+f"SELECT api.write_wardrobe({fields},NULL,'{image}');ROLLBACK;")
    assert result.returncode!=0 and 'Image not found' in result.stderr
    image=str(uuid4())
    result=sql(seed+as_user(a)+f"SELECT api.reserve_wardrobe_image('{image}','"+'a'*64+f"',100);SELECT api.write_wardrobe({fields},NULL,'{image}');ROLLBACK;")
    assert result.returncode!=0 and 'Image upload incomplete' in result.stderr


@pytest.mark.parametrize('sort',['newest','name'])
def test_stable_pagination_and_search_filters(users,sort):
    a,_,seed=users
    _,one=create(a,'Alpha','Tops','Maker')
    _,two=create(a,'Beta','Bottoms','Other')
    _,three=create(a,'Gamma','Tops','Maker')
    prefix=seed+as_user(a)+one+two+three
    first=rows(success(prefix+f"SELECT api.list_wardrobe('','','{sort}',1);ROLLBACK;"))[-1]
    assert len(first['items'])==1 and first['nextCursor']
    output=rows(success(prefix+f"DO $$DECLARE p jsonb;BEGIN p:=api.list_wardrobe('','','{sort}',1);PERFORM set_config('test.cursor',(p->'nextCursor')::text,true);PERFORM set_config('test.first',p->'items'->0->>'id',true);END;$$;"+
        f"SELECT api.list_wardrobe('','','{sort}',1,current_setting('test.cursor')::jsonb);SELECT current_setting('test.first');ROLLBACK;"))[-1]
    assert len(output['items'])==1
    result=rows(success(prefix+"SELECT api.list_wardrobe('maker','Tops','name',24);ROLLBACK;"))[-1]
    assert [v['name'] for v in result['items']]==['Alpha','Gamma']


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_all_wardrobe_operations_deny_inactive_users(users,state):
    a,_,seed=users
    change=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    prefix=seed+'SET LOCAL ROLE dd_lifecycle_operator;'+change+as_user(a)
    for call in ['SELECT api.list_wardrobe();',f"SELECT api.read_wardrobe('{uuid4()}');",f"SELECT api.delete_wardrobe('{uuid4()}');",f"SELECT api.write_wardrobe({j({'name':'Shirt','category':'Tops'})});"]:
        result=sql(prefix+call+'ROLLBACK;')
        assert result.returncode!=0 and 'Account access denied' in result.stderr


@pytest.mark.parametrize('table',['wardrobe_garments','wardrobe_images'])
@pytest.mark.parametrize('operation',['SELECT * FROM','DELETE FROM'])
def test_direct_base_access_denied(users,table,operation):
    a,_,seed=users
    result=sql(seed+as_user(a)+f'{operation} app_private.{table};ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_storage_policies_owner_pending_immutable_and_retired(users):
    a,b,seed=users
    image,statement=upload(a)
    path=f'{a}/{image}.jpg'
    prefix=seed+as_user(a)+statement
    value=success(prefix+as_user(b)+f"SELECT count(*) FROM storage.objects WHERE name='{path}';ROLLBACK;")
    assert value.splitlines()[-1]=='0'
    value=success(prefix+f"WITH changed AS (UPDATE storage.objects SET name=name WHERE name='{path}' RETURNING id) SELECT count(*) FROM changed;ROLLBACK;")
    assert value.splitlines()[-1]=='0' 
    value=success(prefix+f"DELETE FROM storage.objects WHERE name='{path}';SELECT count(*) FROM storage.objects WHERE name='{path}';ROLLBACK;")
    assert value.splitlines()[-1]=='1'
    value=success(prefix+f"SELECT api.abandon_wardrobe_image('{image}');DELETE FROM storage.objects WHERE name='{path}';SELECT api.wardrobe_image_cleanup('{image}');ROLLBACK;")
    assert rows(value)[-1]==[]


def test_schema_constraints_indexes_rls_and_function_permissions(users):
    a,b,seed=users
    result=success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname IN ('wardrobe_images','wardrobe_garments') AND c.relrowsecurity AND c.relforcerowsecurity;")
    assert result=='2'
    value=success("SELECT count(*) FROM pg_indexes WHERE schemaname='app_private' AND indexname IN ('wardrobe_owner_newest','wardrobe_owner_name','wardrobe_image_cleanup');")
    assert value=='3'
    value=success("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api' AND p.prosecdef;")
    assert value=='0'
    image,statement=create(a)
    result=sql(seed+as_user(a)+statement+f"SET LOCAL ROLE dd_user_executor;UPDATE app_private.wardrobe_garments SET owner_id='{b}';ROLLBACK;")
    assert result.returncode!=0 and 'permission denied' in result.stderr


@pytest.mark.parametrize('operation',['list_wardrobe()',f"read_wardrobe('{uuid4()}')",f"delete_wardrobe('{uuid4()}')"])
def test_anonymous_rpc_denied(operation):
    result=sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


@pytest.mark.parametrize('changes',[{'name':''},{'category':'Fake'},{'image_id':str(uuid4())}])
def test_database_constraints_defend_even_executor_writes(users,changes):
    a,_,seed=users
    _,statement=create(a)
    key,value=next(iter(changes.items()))
    result=sql(seed+as_user(a)+statement+f"SET LOCAL ROLE dd_user_executor;UPDATE app_private.wardrobe_garments SET {key}='{value}';ROLLBACK;")
    assert result.returncode!=0
    assert 'check constraint' in result.stderr or 'foreign key constraint' in result.stderr


def test_owner_consistent_image_fk_and_replacement_cleanup(users):
    a,b,seed=users
    old_image,statement=create(a)
    new_image,new_upload=upload(a)
    capture="SELECT set_config('test.garment',api.list_wardrobe()->'items'->0->>'id',true);"
    value=rows(success(seed+as_user(a)+statement+capture+new_upload+
        f"SELECT api.write_wardrobe({j({'notes':'Replacement'})},current_setting('test.garment')::uuid,'{new_image}');SELECT api.wardrobe_image_cleanup();ROLLBACK;"))[-1]
    assert [i['id'] for i in value]==[old_image]
    foreign_image,foreign_upload=upload(a)
    result=sql(seed+as_user(a)+foreign_upload+as_user(b)+"SET LOCAL ROLE dd_user_executor;"+
        f"INSERT INTO app_private.wardrobe_garments(owner_id,name,category,image_id) VALUES('{b}','Invalid','Tops','{foreign_image}');ROLLBACK;")
    assert result.returncode!=0 and 'foreign key constraint' in result.stderr


@pytest.mark.parametrize('method',['read','insert','delete'])
def test_cross_user_storage_paths_denied(users,method):
    a,b,seed=users
    image,statement=upload(a)
    path=f'{a}/{image}.jpg'
    if method=='insert':
        result=sql(seed+as_user(a)+statement+as_user(b)+f"INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES('{uuid4()}','{b}','wardrobe-images','{path}','{{}}');ROLLBACK;")
        assert result.returncode!=0 and 'row-level security' in result.stderr
    else:
        operation=f"SELECT count(*) FROM storage.objects WHERE name='{path}';" if method=='read' else f"WITH removed AS (DELETE FROM storage.objects WHERE name='{path}' RETURNING id) SELECT count(*) FROM removed;"
        value=success(seed+as_user(a)+statement+as_user(b)+operation+'ROLLBACK;')
        assert value.splitlines()[-1]=='0'


def test_attached_image_cannot_be_deleted_or_reused(users):
    a,_,seed=users
    image,statement=create(a)
    prefix=seed+as_user(a)+statement
    value=success(prefix+f"WITH removed AS (DELETE FROM storage.objects WHERE name='{a}/{image}.jpg' RETURNING id) SELECT count(*) FROM removed;ROLLBACK;")
    assert value.splitlines()[-1]=='0'
    result=sql(prefix+f"SELECT api.write_wardrobe({j({'name':'Duplicate','category':'Tops'})},NULL,'{image}');ROLLBACK;")
    assert result.returncode!=0 and 'Image not found' in result.stderr


def test_concurrent_patches_preserve_disjoint_fields(users):
    import subprocess
    import time
    a,b,seed=users
    _,statement=create(a)
    ident=rows(success(seed+as_user(a)+statement+'SELECT api.list_wardrobe();COMMIT;'))[-1]['items'][0]['id']
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    process=None
    try:
        first='BEGIN;'+as_user(a)+f"SELECT api.write_wardrobe({j({'notes':'First'})},'{ident}');SELECT pg_sleep(1);COMMIT;"
        process=subprocess.Popen(command+['-c',first],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while success(f"SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%{a}%' AND wait_event='PgSleep';")!='1':
            assert process.poll() is None
            assert time.monotonic()<deadline
            time.sleep(0.02)
        success('BEGIN;'+as_user(a)+f"SELECT api.write_wardrobe({j({'brand':'Second'})},'{ident}');COMMIT;")
        _,error=process.communicate(timeout=5);assert process.returncode==0,error
        value=rows(success('BEGIN;'+as_user(a)+f"SELECT api.read_wardrobe('{ident}');ROLLBACK;"))[0]
        assert value['notes']=='First' and value['brand']=='Second'
    finally:
        if process and process.poll() is None:process.kill();process.communicate()
        # Test interface has no Auth->Storage FK; only remove this test's fixtures.
        success(f"DELETE FROM auth.users WHERE id IN ('{a}','{b}');DELETE FROM storage.objects WHERE owner_id IN ('{a}','{b}');")
