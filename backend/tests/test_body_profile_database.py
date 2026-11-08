"""Real PostgreSQL body RPC/RLS tests; no hosted connection is consumed."""
import json
import subprocess
import time

import pytest

from test_foundation_database import SOCKET, as_user, sql, success, users  # noqa: F401

pytestmark = pytest.mark.skipif(not SOCKET, reason='Use tests/database/run_local.py for disposable PostgreSQL')


def update(changes):
    return "SELECT api.update_body_profile('" + json.dumps(changes).replace("'", "''") + "'::jsonb);"


def records(output):
    return [json.loads(line) for line in output.splitlines() if line.startswith('{')]


def test_body_read_patch_clear_and_cross_user_isolation(users):
    a,b,seed = users
    values = records(success(seed + as_user(a) + update({'units':'cm','height':175.1234,'waist':80,
        'bodyShape':' Description ', 'skinTone':'Tone','undertone':'Neutral','fit':'Relaxed'}) +
        update({'chest':90}) + "SELECT api.read_body_profile();" +
        update({'bodyShape':'','waist':None}) + "SELECT api.read_body_profile();" +
        as_user(b) + "SELECT api.read_body_profile();ROLLBACK;"))
    assert values[0]['height'] == 175.1234 and values[0]['chest'] == 90
    assert values[0]['bodyShape'] == 'Description'
    assert values[1]['height'] == 175.1234 and values[1]['waist'] is None and values[1]['bodyShape'] == ''
    assert values[2]['height'] is None and values[2]['units'] == ''
    out = success(seed + as_user(a) + "SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.body_profiles;ROLLBACK;")
    assert out.splitlines()[-1] == '1'


@pytest.mark.parametrize('changes', [
    {'height':0}, {'chest':301}, {'waist':True}, {'hips':'80'}, {'inseam':1.00001},
    {'units':'m'}, {'fit':'other'}, {'undertone':'other'}, {'skinTone':'x'*201},
    {'bodyShape':{}}, {'owner_id':'other'}, {'user_id':'other'}, {'updated_at':'today'},
])
def test_direct_rpc_revalidates_body_payload(users, changes):
    a,_,seed = users
    result = sql(seed + as_user(a) + update(changes) + 'ROLLBACK;')
    assert result.returncode != 0 and 'Invalid' in result.stderr


@pytest.mark.parametrize('changes', [None, [], 'not an object'])
def test_direct_rpc_requires_an_object(users, changes):
    a,_,seed = users
    result = sql(seed + as_user(a) + update(changes) + 'ROLLBACK;')
    assert result.returncode != 0 and 'Invalid' in result.stderr


def test_measurements_require_units_and_unit_changes_preserve_meaning(users):
    a,_,seed = users
    result = sql(seed + as_user(a) + update({'height':180}) + 'ROLLBACK;')
    assert result.returncode != 0 and 'measurements_have_units' in result.stderr
    result = sql(seed + as_user(a) + update({'units':'cm','height':180,'waist':80}) +
                 update({'units':'in','height':70}) + 'ROLLBACK;')
    assert result.returncode != 0 and 'explicitly replace or clear' in result.stderr
    value = records(success(seed + as_user(a) + update({'units':'cm','height':180}) +
        update({'units':'in','height':70}) + "SELECT api.read_body_profile();" +
        update({'units':None,'height':None}) + "SELECT api.read_body_profile();ROLLBACK;"))
    assert value[0]['units'] == 'in' and value[0]['height'] == 70
    assert value[1]['units'] == '' and value[1]['height'] is None


def test_missing_body_is_not_created_or_replaced_with_fake_defaults(users):
    a,_,seed = users
    prefix = seed + f"DELETE FROM app_private.body_profiles WHERE user_id='{a}';" + as_user(a)
    for operation in ['SELECT api.read_body_profile();', update({'fit':'Regular'}), update({})]:
        result = sql(prefix + operation + 'ROLLBACK;')
        assert result.returncode != 0 and 'Body profile not found' in result.stderr


@pytest.mark.parametrize('state', ['disabled','deleting'])
def test_inactive_body_access_rejected_with_unchanged_claims(users, state):
    a,_,seed = users
    change = f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    for operation in ['SELECT api.read_body_profile();',update({'fit':'Regular'})]:
        result = sql(seed+'SET LOCAL ROLE dd_lifecycle_operator;'+change+as_user(a)+operation+'ROLLBACK;')
        assert result.returncode != 0 and 'Account access denied' in result.stderr


@pytest.mark.parametrize('operation', ['read_body_profile()',"update_body_profile('{}'::jsonb)"])
def test_anonymous_cannot_call_body_rpc(operation):
    result = sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode != 0 and 'permission denied' in result.stderr


def test_body_executor_cannot_modify_owner_and_normal_users_cannot_write_base_table(users):
    a,b,seed = users
    for role,statement in [('dd_user_executor',f"UPDATE app_private.body_profiles SET user_id='{b}' WHERE user_id='{a}';"),
                           ('authenticated',"UPDATE app_private.body_profiles SET fit='Regular';")]:
        result = sql(seed+as_user(a)+f'SET LOCAL ROLE {role};'+statement+'ROLLBACK;')
        assert result.returncode != 0 and 'permission denied' in result.stderr
    value = success("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api' AND p.prosecdef;")
    assert value == '0'


@pytest.mark.parametrize('column,value', [('height','0'),('waist','301'),('units',"'m'"),('fit',"'other'")])
def test_existing_body_table_constraints(users, column, value):
    a,_,seed = users
    result = sql(seed+f"UPDATE app_private.body_profiles SET {column}={value} WHERE user_id='{a}';ROLLBACK;")
    assert result.returncode != 0 and 'check constraint' in result.stderr


def test_concurrent_partial_updates_do_not_overwrite_unsubmitted_fields(users):
    a,b,seed = users
    success(seed+'COMMIT;')
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    process=None
    try:
        first='BEGIN;'+as_user(a)+update({'units':'cm','height':180})+'SELECT pg_sleep(1);COMMIT;'
        process=subprocess.Popen(command+['-c',first],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while success(f"SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND query LIKE '%{a}%' AND wait_event='PgSleep';") != '1':
            assert process.poll() is None
            assert time.monotonic()<deadline
            time.sleep(0.02)
        success('BEGIN;'+as_user(a)+update({'fit':'Relaxed'})+'COMMIT;')
        _,error=process.communicate(timeout=5)
        assert process.returncode == 0,error
        value=records(success('BEGIN;'+as_user(a)+'SELECT api.read_body_profile();ROLLBACK;'))[0]
        assert value['height']==180 and value['fit']=='Relaxed'
    finally:
        if process and process.poll() is None:process.kill();process.communicate()
        success(f"DELETE FROM auth.users WHERE id IN ('{a}','{b}');")


def test_body_function_execution_and_owners_are_least_privilege():
    value = success("""
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname IN ('read_body_profile','update_body_profile')
      AND p.proowner='dd_user_executor'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""'];
    SELECT has_schema_privilege('dd_user_executor','app_private','CREATE');
    SELECT count(*) FROM pg_roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE r.rolname IN ('anon','service_role') AND n.nspname IN ('api','app_private')
      AND p.proname IN ('read_body_profile','update_body_profile')
      AND has_function_privilege(r.oid,p.oid,'EXECUTE');
    """)
    assert value.splitlines() == ['2','f','0']
