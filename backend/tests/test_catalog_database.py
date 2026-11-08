"""Real disposable PostgreSQL catalog constraints, grants, admin membership and RLS."""
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import j,rows

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def grant(user,enabled=True):
    return f"SET LOCAL ROLE dd_lifecycle_operator;SELECT app_private.set_catalog_membership('{user}',{str(enabled).lower()});"+as_user(user)


def upload(user):
    image=str(uuid4())
    return image,f"SELECT api.reserve_catalog_image('{image}','"+'a'*64+f"',100);INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES('{uuid4()}','{user}','catalog-images','catalog/{image}.jpg','{{\"mimetype\":\"image/jpeg\",\"size\":100}}');"


def create(user,name='Shirt',category='Tops',brand='Maker'):
    image,statement=upload(user)
    return image,statement+f"SELECT api.write_catalog({j(dict(name=name,category=category,brand=brand,price=12.5))},NULL,'{image}');"


CAPTURE="SELECT set_config('test.catalog',api.list_catalog()->'items'->0->>'id',true);"
TARGET="current_setting('test.catalog')::uuid"


def test_admin_crud_partial_update_deactivate_retains_data_and_image(users):
    a,b,seed=users
    image,statement=create(a)
    prefix=seed+grant(a)+statement+CAPTURE
    values=rows(success(prefix+f"SELECT api.write_catalog({j({'notes':'Changed','price':None})},{TARGET});SELECT api.read_catalog({TARGET});SELECT api.delete_catalog({TARGET});SELECT api.list_catalog();SELECT api.read_catalog({TARGET},true);SELECT api.catalog_image_info({TARGET},true);ROLLBACK;"))
    assert values[-4]['name']=='Shirt' and values[-4]['notes']=='Changed' and values[-4]['price'] is None
    assert values[-3]=={'items':[],'nextCursor':None}
    assert values[-2]['active'] is False and values[-1]['id']==image
    result=sql(prefix+f'SELECT api.delete_catalog({TARGET});SELECT api.read_catalog({TARGET});ROLLBACK;')
    assert result.returncode!=0 and 'Garment not found' in result.stderr
    value=rows(success(prefix+as_user(b)+'SELECT api.list_catalog();ROLLBACK;'))[-1]
    assert len(value['items'])==1 # Shared authenticated reads across accounts.


@pytest.mark.parametrize('operation',[
 "write_catalog('{}')",f"delete_catalog('{uuid4()}')",f"reserve_catalog_image('{uuid4()}','"+'a'*64+"',100)",
 'list_catalog(p_admin=>true)',f"read_catalog('{uuid4()}',true)",f"catalog_image_info('{uuid4()}',true)",
 f"abandon_catalog_image('{uuid4()}')",'catalog_image_cleanup()'])
def test_user_editable_admin_metadata_never_authorizes(users,operation):
    a,_,seed=users
    result=sql(seed+as_user(a)+'SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'Administrator required' in result.stderr


def test_revoked_disabled_and_deleting_admin_denied(users):
    a,_,seed=users
    for transition in [grant(a,False), f"SET LOCAL ROLE dd_lifecycle_operator;SELECT app_private.set_account_state('{a}','disabled');"+as_user(a),
                       f"SET LOCAL ROLE dd_lifecycle_operator;SELECT app_private.begin_account_deletion('{a}');"+as_user(a)]:
        result=sql(seed+grant(a)+transition+"SELECT api.write_catalog('{}');ROLLBACK;")
        assert result.returncode!=0 and ('Administrator required' in result.stderr or 'Account access denied' in result.stderr)


@pytest.mark.parametrize('changes',[{'name':' '},{'name':'x'*201},{'category':'Invalid'},{'brand':None},
 {'price':-1},{'price':1000001},{'price':1.001},{'price':'12'},{'price':True},{'role':'admin'},
 {'active':True},{'owner_id':str(uuid4())},{'image_id':str(uuid4())}])
def test_direct_rpc_validation(users,changes):
    a,_,seed=users
    image,statement=upload(a)
    result=sql(seed+grant(a)+statement+f"SELECT api.write_catalog({j(changes)},NULL,'{image}');ROLLBACK;")
    assert result.returncode!=0 and ('Invalid' in result.stderr or 'required' in result.stderr)


@pytest.mark.parametrize('operation',[f"read_catalog('{uuid4()}')",f"write_catalog('{{}}','{uuid4()}')",f"delete_catalog('{uuid4()}')"])
def test_missing_item(users,operation):
    a,_,seed=users
    result=sql(seed+grant(a)+'SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'Garment not found' in result.stderr


@pytest.mark.parametrize('sort',['name','newest'])
def test_read_filters_and_pagination(users,sort):
    a,b,seed=users
    _,one=create(a,'Alpha','Tops','Maker');_,two=create(a,'Beta','Bottoms','Other');_,three=create(a,'Gamma','Tops','Maker')
    prefix=seed+grant(a)+one+two+three+as_user(b)
    values=rows(success(prefix+f"SELECT api.list_catalog('maker','Tops','name');SELECT api.list_catalog('','','{sort}',1);"+
       f"SELECT api.list_catalog('','','{sort}',1,api.list_catalog('','','{sort}',1)->'nextCursor');ROLLBACK;"))
    assert [v['name'] for v in values[-3]['items']]==['Alpha','Gamma']
    assert len(values[-2]['items'])==len(values[-1]['items'])==1
    assert values[-2]['items'][0]['id']!=values[-1]['items'][0]['id']


@pytest.mark.parametrize('query',["p_category=>'Invalid'","p_limit=>0","p_limit=>101","p_sort=>'price'","p_search=>NULL"])
def test_direct_query_validation(users,query):
    a,_,seed=users
    result=sql(seed+as_user(a)+'SELECT api.list_catalog('+query+');ROLLBACK;')
    assert result.returncode!=0 and 'Invalid collection query' in result.stderr


@pytest.mark.parametrize('table',['catalog_garments','catalog_images'])
@pytest.mark.parametrize('operation',['SELECT * FROM','DELETE FROM'])
def test_base_tables_not_exposed_even_to_admin(users,table,operation):
    a,_,seed=users
    result=sql(seed+grant(a)+f'{operation} app_private.{table};ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_nonowner_executor_rls_blocks_normal_user_mutation(users):
    a,b,seed=users
    _,statement=create(a)
    prefix=seed+grant(a)+statement+as_user(b)+'SET LOCAL ROLE dd_user_executor;'
    value=success(prefix+"WITH changed AS (UPDATE app_private.catalog_garments SET name='Stolen' RETURNING id) SELECT count(*) FROM changed;ROLLBACK;")
    assert value.splitlines()[-1]=='0'
    result=sql(prefix+f"INSERT INTO app_private.catalog_images(id,sha256,byte_size,state) VALUES('{uuid4()}','"+'a'*64+"',100,'pending');ROLLBACK;")
    assert result.returncode!=0 and 'row-level security' in result.stderr


def test_constraints_indexes_rls_and_no_direct_delete_grant(users):
    a,_,seed=users
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname IN ('catalog_images','catalog_garments') AND c.relrowsecurity AND c.relforcerowsecurity;")=='2'
    assert success("SELECT count(*) FROM pg_indexes WHERE schemaname='app_private' AND indexname IN ('catalog_newest','catalog_name','catalog_category','catalog_image_cleanup');")=='4'
    assert success("SELECT has_table_privilege('dd_user_executor','app_private.catalog_garments','DELETE');")=='f'
    _,statement=create(a)
    for assignment in ["name=''","category='Invalid'","price=-1","price=1.001",f"image_id='{uuid4()}'"]:
        result=sql(seed+grant(a)+statement+f'SET LOCAL ROLE dd_user_executor;UPDATE app_private.catalog_garments SET {assignment};ROLLBACK;')
        assert result.returncode!=0 and ('check constraint' in result.stderr or 'foreign key constraint' in result.stderr)


def test_required_image_upload_and_unique_association(users):
    a,_,seed=users
    fields=j({'name':'Shirt','category':'Tops'})
    result=sql(seed+grant(a)+f'SELECT api.write_catalog({fields});ROLLBACK;')
    assert result.returncode!=0 and 'required' in result.stderr
    image=str(uuid4())
    result=sql(seed+grant(a)+f"SELECT api.reserve_catalog_image('{image}','"+'a'*64+f"',100);SELECT api.write_catalog({fields},NULL,'{image}');ROLLBACK;")
    assert result.returncode!=0 and 'Image upload incomplete' in result.stderr
    image,statement=create(a)
    result=sql(seed+grant(a)+statement+f"SELECT api.write_catalog({fields},NULL,'{image}');ROLLBACK;")
    assert result.returncode!=0 and 'Image not found' in result.stderr


def test_storage_shared_read_admin_only_insert_no_overwrite_or_attached_delete(users):
    a,b,seed=users
    image,statement=create(a);prefix=seed+grant(a)+statement;path=f'catalog/{image}.jpg'
    value=success(prefix+as_user(b)+f"SELECT count(*) FROM storage.objects WHERE name='{path}';ROLLBACK;")
    assert value.splitlines()[-1]=='1'
    for actor in [a,b]:
        for action in [f"UPDATE storage.objects SET name=name WHERE name='{path}'",f"DELETE FROM storage.objects WHERE name='{path}'"]:
            value=success(prefix+as_user(actor)+f'WITH changed AS ({action} RETURNING id) SELECT count(*) FROM changed;ROLLBACK;')
            assert value.splitlines()[-1]=='0'
    image,statement=upload(a)
    value=success(seed+grant(a)+statement+as_user(b)+f"SELECT count(*) FROM storage.objects WHERE name='catalog/{image}.jpg';ROLLBACK;")
    assert value.splitlines()[-1]=='0'
    result=sql(seed+as_user(b)+f"INSERT INTO storage.objects(id,owner_id,bucket_id,name) VALUES('{uuid4()}','{b}','catalog-images','catalog/{uuid4()}.jpg');ROLLBACK;")
    assert result.returncode!=0 and 'row-level security' in result.stderr


@pytest.mark.parametrize('operation',['list_catalog()',"write_catalog('{}')",f"delete_catalog('{uuid4()}')"])
def test_anonymous_denied(operation):
    result=sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr


def test_retired_image_cleanup_and_inactive_catalog_storage_read(users):
    a,b,seed=users
    old,statement=create(a);new,new_upload=upload(a)
    prefix=seed+grant(a)+statement+CAPTURE+new_upload
    value=rows(success(prefix+f"SELECT api.write_catalog({j({'notes':'New image'})},{TARGET},'{new}');SELECT api.catalog_image_cleanup();ROLLBACK;"))[-1]
    assert [v['id'] for v in value]==[old]
    value=rows(success(prefix+f"SELECT api.write_catalog('{{}}',{TARGET},'{new}');DELETE FROM storage.objects WHERE name='catalog/{old}.jpg';SELECT api.catalog_image_cleanup('{old}');ROLLBACK;"))[-1]
    assert value==[]
    value=success(seed+grant(a)+statement+CAPTURE+f'SELECT api.delete_catalog({TARGET});'+as_user(b)+f"SELECT count(*) FROM storage.objects WHERE name='catalog/{old}.jpg';ROLLBACK;")
    assert value.splitlines()[-1]=='0'


def test_admin_revocation_serializes_with_inflight_mutation(users):
    import subprocess
    import time
    a,b,seed=users
    _,statement=create(a)
    ident=rows(success(seed+grant(a)+statement+'SELECT api.list_catalog();COMMIT;'))[-1]['items'][0]['id']
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    process=None
    try:
        mutation='BEGIN;'+as_user(a)+f"SELECT api.write_catalog({j({'notes':'Before revocation'})},'{ident}');SELECT pg_sleep(1);COMMIT;"
        process=subprocess.Popen(command+['-c',mutation],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while success(f"SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%{a}%' AND wait_event='PgSleep';")!='1':
            assert process.poll() is None and time.monotonic()<deadline
            time.sleep(0.02)
        success('BEGIN;'+grant(a,False)+'COMMIT;')
        _,error=process.communicate(timeout=5);assert process.returncode==0,error
        result=sql('BEGIN;'+as_user(a)+f"SELECT api.write_catalog({j({'notes':'After revocation'})},'{ident}');ROLLBACK;")
        assert result.returncode!=0 and 'Administrator required' in result.stderr
        value=rows(success('BEGIN;'+as_user(a)+f"SELECT api.read_catalog('{ident}');ROLLBACK;"))[0]
        assert value['notes']=='Before revocation'
    finally:
        if process and process.poll() is None:process.kill();process.communicate()
        # Only this test's catalog fixtures are removed inside the disposable cluster.
        success(f"BEGIN;DELETE FROM storage.objects WHERE owner_id IN ('{a}','{b}');WITH removed AS (DELETE FROM app_private.catalog_garments WHERE id='{ident}' RETURNING image_id) DELETE FROM app_private.catalog_images WHERE id IN (SELECT image_id FROM removed);DELETE FROM auth.users WHERE id IN ('{a}','{b}');COMMIT;")
