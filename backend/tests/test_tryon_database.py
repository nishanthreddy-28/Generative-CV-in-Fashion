"""Disposable PostgreSQL try-on source, consent, state, RLS and private Storage tests."""
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import create as wardrobe,rows
from test_catalog_database import create as catalog,grant
pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def upload(user,ident=None):
    ident=ident or str(uuid4())
    return ident,f"SELECT api.reserve_tryon_image('{ident}','"+'a'*64+f"',100);INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES('{uuid4()}','{user}','tryon-inputs','{user}/{ident}.jpg','{{\"mimetype\":\"image/jpeg\",\"size\":100}}');"


def submit(user,source='wardrobe'):
    _,garment=wardrobe(user) if source=='wardrobe' else catalog(user)
    image,statement=upload(user)
    read='list_wardrobe' if source=='wardrobe' else 'list_catalog'
    return image,(grant(user) if source=='catalog' else as_user(user))+garment+statement+f"SELECT api.submit_tryon((api.{read}()->'items'->0->>'id')::uuid,'{source}','{image}',true);SELECT set_config('test.job',api.list_tryon()->'items'->0->>'id',true);"


TARGET="current_setting('test.job')::uuid"


@pytest.mark.parametrize('source',['wardrobe','catalog'])
def test_submit_read_history_cancel_and_cleanup_evidence(users,source):
    a,_,seed=users;image,statement=submit(a,source)
    value=rows(success(seed+statement+f'SELECT api.read_tryon({TARGET});SELECT api.list_tryon();ROLLBACK;'))
    job=value[-2]
    assert job['status']=='queued' and job['workerAvailable'] is False and job['canCancel']
    assert job['consentVersion']=='photo-consent-v1' and job['inputAvailable'] and 'object' not in job
    assert value[-1]['items']==[job]
    values=rows(success(seed+statement+f'SELECT api.cancel_tryon({TARGET});SELECT api.cancel_tryon({TARGET});SELECT api.tryon_image_cleanup();ROLLBACK;'))
    assert values[-3]['status']=='failed' and values[-3]['failureCode']=='CANCELLED'
    assert values[-3]==values[-2] and not values[-3]['inputAvailable'] and values[-1][0]['id']==image
    # Deleting object bytes does not erase accepted submission evidence.
    value=rows(success(seed+statement+f"SELECT api.cancel_tryon({TARGET});DELETE FROM storage.objects WHERE bucket_id='tryon-inputs' AND name='{a}/{image}.jpg';SELECT api.tryon_image_cleanup('{image}');SELECT api.read_tryon({TARGET});ROLLBACK;"))[-1]
    assert value['consentAt'] and value['failureCode']=='CANCELLED'
    result=sql(seed+statement+f'SELECT api.cancel_tryon({TARGET});SELECT api.tryon_input_info({TARGET});ROLLBACK;')
    assert result.returncode!=0 and 'Input photo unavailable' in result.stderr


@pytest.mark.parametrize('operation',[f'read_tryon({TARGET})',f'cancel_tryon({TARGET})',f'tryon_input_info({TARGET})'])
def test_cross_user_jobs_concealed(users,operation):
    a,b,seed=users;_,statement=submit(a)
    result=sql(seed+statement+as_user(b)+'SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'Job not found' in result.stderr
    value=rows(success(seed+statement+as_user(b)+'SELECT api.list_tryon();ROLLBACK;'))[-1]
    assert value['items']==[]


def test_cross_user_images_and_wardrobe_invalid_source_and_consent(users):
    a,b,seed=users;image,statement=submit(a)
    capture="SELECT set_config('test.garment',api.list_wardrobe()->'items'->0->>'id',true);"
    _,other=wardrobe(b)
    prefix=seed+statement+capture+as_user(b)+other
    own_image,upload_statement=upload(b)
    result=sql(prefix+upload_statement+f"SELECT api.submit_tryon(current_setting('test.garment')::uuid,'wardrobe','{own_image}',true);ROLLBACK;")
    assert result.returncode!=0 and 'Garment not found' in result.stderr
    result=sql(prefix+f"SELECT api.submit_tryon((api.list_wardrobe()->'items'->0->>'id')::uuid,'wardrobe','{image}',true);ROLLBACK;")
    assert result.returncode!=0 and 'Input photo not found' in result.stderr
    for source,consent in [('wardrobe','false'),('wardrobe','NULL'),('other','true')]:
        result=sql(seed+as_user(a)+f"SELECT api.submit_tryon('{uuid4()}','{source}','{uuid4()}',{consent});ROLLBACK;")
        assert result.returncode!=0 and 'Explicit consent' in result.stderr


def test_incomplete_upload_and_inactive_catalog_rejected(users):
    a,_,seed=users;_,garment=wardrobe(a);image=str(uuid4())
    prefix=seed+as_user(a)+garment+f"SELECT api.reserve_tryon_image('{image}','"+'a'*64+"',100);"
    result=sql(prefix+f"SELECT api.submit_tryon((api.list_wardrobe()->'items'->0->>'id')::uuid,'wardrobe','{image}',true);ROLLBACK;")
    assert result.returncode!=0 and 'Input upload incomplete' in result.stderr
    _,cat=catalog(a);image,statement=upload(a)
    prefix=seed+grant(a)+cat+statement+"SELECT set_config('test.cat',api.list_catalog()->'items'->0->>'id',true);SELECT api.delete_catalog(current_setting('test.cat')::uuid);"
    result=sql(prefix+f"SELECT api.submit_tryon(current_setting('test.cat')::uuid,'catalog','{image}',true);ROLLBACK;")
    assert result.returncode!=0 and 'Garment unavailable' in result.stderr


def test_source_delete_preserves_job_and_original_garment_identity(users):
    a,_,seed=users;_,statement=submit(a)
    value=rows(success(seed+statement+f"SELECT api.read_tryon({TARGET});SELECT api.delete_wardrobe((api.list_wardrobe()->'items'->0->>'id')::uuid);SELECT api.read_tryon({TARGET});ROLLBACK;"))
    assert value[-1]['garmentId']==value[-2]['garmentId'] and value[-1]['status']=='queued'


def test_worker_transitions_guarded_and_cancel_processing_rejected(users):
    a,_,seed=users;_,statement=submit(a)
    result=sql(seed+statement+f"SET LOCAL ROLE dd_user_executor;UPDATE app_private.tryon_jobs SET status='processing' WHERE id={TARGET};ROLLBACK;")
    assert result.returncode!=0 and 'Worker authority unavailable' in result.stderr
    prefix=seed+statement+f"RESET ROLE;UPDATE app_private.tryon_jobs SET status='processing' WHERE id={TARGET};"+as_user(a)
    result=sql(prefix+f'SELECT api.cancel_tryon({TARGET});ROLLBACK;')
    assert result.returncode!=0 and 'Job cannot be cancelled' in result.stderr
    result=sql(prefix+f"RESET ROLE;UPDATE app_private.tryon_jobs SET status='queued' WHERE id={TARGET};ROLLBACK;")
    assert result.returncode!=0 and 'Invalid job transition' in result.stderr
    result=sql(prefix+f"RESET ROLE;UPDATE app_private.tryon_jobs SET status='completed',finished_at=clock_timestamp() WHERE id={TARGET};ROLLBACK;")
    assert result.returncode!=0 and 'Validated output required' in result.stderr


def test_private_storage_read_write_cross_user_and_no_overwrite(users):
    a,b,seed=users;image,statement=submit(a);prefix=seed+statement
    assert success(prefix+as_user(b)+f"SELECT count(*) FROM storage.objects WHERE bucket_id='tryon-inputs';ROLLBACK;").splitlines()[-1]=='0'
    for command in ["UPDATE storage.objects SET name=name WHERE bucket_id='tryon-inputs'","DELETE FROM storage.objects WHERE bucket_id='tryon-inputs'"]:
        assert success(prefix+'WITH changed AS ('+command+' RETURNING id) SELECT count(*) FROM changed;ROLLBACK;').splitlines()[-1]=='0'
    result=sql(prefix+as_user(b)+f"INSERT INTO storage.objects(id,owner_id,bucket_id,name) VALUES('{uuid4()}','{b}','tryon-inputs','{a}/{image}.jpg');ROLLBACK;")
    assert result.returncode!=0 and 'row-level security' in result.stderr


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_inactive_all_access_denied(users,state):
    a,_,seed=users;_,statement=submit(a)
    change=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    prefix=seed+statement+'SET LOCAL ROLE dd_lifecycle_operator;'+change+as_user(a)
    for op in ['list_tryon()',f'read_tryon({TARGET})',f'cancel_tryon({TARGET})',f'tryon_input_info({TARGET})']:
        result=sql(prefix+'SELECT api.'+op+';ROLLBACK;')
        assert result.returncode!=0 and 'Account access denied' in result.stderr


def test_history_pagination_constraints_grants_and_rls(users):
    a,b,seed=users;_,one=submit(a);_,two=submit(a)
    values=rows(success(seed+one+two+'SELECT api.list_tryon(1);SELECT api.list_tryon(1,api.list_tryon(1)->\'nextCursor\');ROLLBACK;'))
    assert values[-2]['nextCursor'] and values[-1]['nextCursor'] is None
    assert values[-2]['items'][0]['id']!=values[-1]['items'][0]['id']
    for table in ['tryon_jobs','tryon_images']:
        assert 'permission denied' in sql(seed+as_user(a)+f'SELECT * FROM app_private.{table};ROLLBACK;').stderr
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname IN ('tryon_jobs','tryon_images') AND c.relrowsecurity AND c.relforcerowsecurity;")=='2'
    assert success(seed+one+as_user(b)+'SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.tryon_jobs;ROLLBACK;').splitlines()[-1]=='0'
    for args in ['0','101',"24,'{}'"]:
        assert 'Invalid job' in sql(seed+as_user(a)+f'SELECT api.list_tryon({args});ROLLBACK;').stderr


@pytest.mark.parametrize('operation',['list_tryon()',f"read_tryon('{uuid4()}')",f"cancel_tryon('{uuid4()}')"])
def test_anonymous_denied(operation):
    assert 'permission denied' in sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;').stderr
