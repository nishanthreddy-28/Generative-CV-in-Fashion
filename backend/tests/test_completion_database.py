"""Completion milestones tested only against disposable PostgreSQL."""
import json,time
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import rows
from test_tryon_database import submit as tryon
from test_outfits_database import garments,CREATE
pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')

def fresh(user,age=0):
 claims=json.dumps({'sub':user,'role':'authenticated','amr':[{'method':'password','timestamp':int(time.time())-age}]})
 return f"SET LOCAL request.jwt.claims='{claims}';SET LOCAL ROLE authenticated;"

def test_deletion_deny_first_retry_status_isolation(users):
 a,b,seed=users
 prefix=seed+fresh(a)+"SELECT api.request_account_deletion('DELETE');"
 value=rows(success(prefix+"SELECT api.account_deletion_status();SELECT api.request_account_deletion('DELETE');"+fresh(b)+"SELECT api.account_deletion_status();ROLLBACK;"))
 assert value[-3]['status']=='deleting' and value[-2]['status']=='deleting' and value[-1]['status']=='not_requested'
 for op in ['api.read_profile()','api.list_wardrobe()','api.list_tryon()','api.recent_recommendations()']:
  result=sql(prefix+'SELECT '+op+';ROLLBACK;');assert result.returncode!=0 and 'Account access denied' in result.stderr

def test_recent_auth_required_and_client_roles_do_not_grant_cleanup(users):
 a,_,seed=users
 for identity in [as_user(a),fresh(a,600)]:
  result=sql(seed+identity+"SELECT api.request_account_deletion('DELETE');ROLLBACK;")
  assert result.returncode!=0 and 'Recent sign-in required' in result.stderr
 for op in ['api.claim_deletion()',"api.deletion_manifest('"+a+"','"+str(uuid4())+"')"]:
  assert 'permission denied' in sql(seed+fresh(a)+'SELECT '+op+';ROLLBACK;').stderr

def test_cleanup_preparation_storage_and_auth_cascade_preserve_tombstone(users):
 a,_,seed=users
 _,job=tryon(a)
 prefix=seed+garments(a)+CREATE+job+fresh(a)+"SELECT api.request_account_deletion('DELETE');SET LOCAL ROLE dd_lifecycle_operator;SELECT set_config('test.lease',api.claim_deletion()->>'lease',true);"
 args=f"'{a}',current_setting('test.lease')::uuid"
 value=rows(success(prefix+f'SELECT api.deletion_manifest({args});ROLLBACK;'))[-1]
 assert value and all(item['bucket'] in ('wardrobe-images','tryon-inputs') and item['object'].startswith(a+'/') for item in value)
 value=success(prefix+f'SELECT api.prepare_auth_deletion({args});ROLLBACK;');assert value.splitlines()[-1]=='f'
 final=prefix+f"RESET ROLE;DELETE FROM storage.objects WHERE owner_id='{a}';SET LOCAL ROLE dd_lifecycle_operator;SELECT api.prepare_auth_deletion({args});RESET ROLE;DELETE FROM auth.users WHERE id='{a}';SET CONSTRAINTS ALL IMMEDIATE;SET LOCAL ROLE dd_lifecycle_operator;SELECT api.finish_deletion({args},true);RESET ROLE;SELECT cleanup_stage FROM app_private.account_deletion_tombstones WHERE former_subject_id='{a}';ROLLBACK;"
 assert success(final).splitlines()[-1]=='complete'

def test_cleanup_lease_and_failure_retry(users):
 a,_,seed=users
 prefix=seed+fresh(a)+"SELECT api.request_account_deletion('DELETE');SET LOCAL ROLE dd_lifecycle_operator;SELECT set_config('test.lease',api.claim_deletion()->>'lease',true);"
 assert 'Invalid cleanup lease' in sql(prefix+f"SELECT api.finish_deletion('{a}','{uuid4()}',true);ROLLBACK;").stderr
 value=rows(success(prefix+f"SELECT api.finish_deletion('{a}',current_setting('test.lease')::uuid,false);"+fresh(a)+"SELECT api.account_deletion_status();ROLLBACK;"))[-1]
 assert value['retryable'] is True and value['status']=='deleting'
