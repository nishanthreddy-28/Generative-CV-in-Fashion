"""Real PostgreSQL grants/RLS tests; requires an explicitly supplied disposable socket.

Auth/Storage primitives in this suite are test interfaces, not a Supabase service.
No production connection URL or credentials are consumed.
"""
import json
import os
import subprocess
from uuid import uuid4

import pytest

SOCKET = os.environ.get("DD_TEST_PG_SOCKET")
pytestmark = pytest.mark.skipif(not SOCKET, reason="Run tests/database/run_local.py for isolated PostgreSQL tests")


def sql(statement):
    if os.environ.get('DD_TEST_HOSTED_CANDIDATE') == '1':
        # Some fixtures construct rows while impersonating an executor. Use its
        # supported subject helper, since that role has no managed schema access.
        statement = statement.replace('auth.uid()', 'app_private.request_subject()')
    return subprocess.run(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", SOCKET,
         "-d", "postgres", "-c", statement],
        text=True, capture_output=True, timeout=15,
    )


def success(statement):
    result = sql(statement)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


@pytest.fixture
def users():
    a, b = str(uuid4()), str(uuid4())
    seed = f"""BEGIN;
    INSERT INTO auth.users(id) VALUES('{a}'),('{b}');
    SET LOCAL ROLE dd_lifecycle_operator;
    SELECT app_private.bootstrap_user('{a}','Alice');
    SELECT app_private.bootstrap_user('{b}','Bob');
    RESET ROLE;
    """
    return a, b, seed


def as_user(user):
    claims = json.dumps({"sub": user, "role": "authenticated", "user_metadata": {"role": "admin"}})
    return f"SET LOCAL request.jwt.claims = '{claims}'; SET LOCAL ROLE authenticated;"


@pytest.mark.parametrize("table", ["user_profiles", "body_profiles", "user_preferences", "account_lifecycle", "account_deletion_tombstones", "administrator_memberships"])
@pytest.mark.parametrize("operation", ["SELECT * FROM", "DELETE FROM"])
def test_no_direct_base_access(users, table, operation):
    a, _, seed = users
    result = sql(seed + as_user(a) + f"{operation} app_private.{table}; ROLLBACK;")
    assert result.returncode != 0
    assert "permission denied" in result.stderr


def test_rls_owner_context_applies_to_nonowner_executor(users):
    a, b, seed = users
    result = success(seed + as_user(a) + "SELECT api.read_profile();" +
                     as_user(b) + "SELECT api.read_profile(); ROLLBACK;")
    profiles = [json.loads(x) for x in result.splitlines() if x.startswith('{')]
    assert [x['name'] for x in profiles] == ['Alice', 'Bob']
    # This reaches the real table as the non-owner execution role: RLS must filter B.
    value = success(seed + as_user(a) + "SET LOCAL ROLE dd_user_executor;"
                    "SELECT count(*) FROM app_private.user_profiles; ROLLBACK;")
    assert value.splitlines()[-1] == '1'


def test_update_clearing_and_preferences_are_owner_scoped(users):
    a, b, seed = users
    value = success(seed + as_user(a) + """
    SELECT api.update_profile('Alice changed','', ' Hyderabad ', '');
    SELECT api.update_preferences('cm','Disabled');
    SELECT api.read_profile(); SELECT api.read_preferences();
    """ + as_user(b) + "SELECT api.read_profile(); SELECT api.read_preferences(); ROLLBACK;")
    values = [json.loads(x) for x in value.splitlines() if x.startswith('{')]
    assert values[0] == {'name':'Alice changed','style':'','location':'Hyderabad','bio':''}
    assert values[1] == {'units':'cm','emailNotifications':'Disabled'}
    assert values[2]['name'] == 'Bob'
    assert values[3] == {'units':'','emailNotifications':''}


@pytest.mark.parametrize('call', [
    "api.update_profile('   ','','','')",
    "api.update_profile(repeat('x',201),'','','')",
    "api.update_preferences('meters','Enabled')",
    "api.update_preferences('cm','admin')",
])
def test_direct_rpc_validation_cannot_be_bypassed(users, call):
    a, _, seed = users
    result = sql(seed + as_user(a) + f"SELECT {call}; ROLLBACK;")
    assert result.returncode != 0
    assert 'Invalid' in result.stderr


@pytest.mark.parametrize('function', [
    "bootstrap_user('{b}','Mallory')",
    "set_account_state('{b}','active')",
    "begin_account_deletion('{b}')",
    "set_catalog_membership('{a}',true)",
])
def test_users_cannot_call_trusted_operations(users, function):
    a, b, seed = users
    result = sql(seed + as_user(a) + 'SELECT app_private.' + function.format(a=a,b=b) + '; ROLLBACK;')
    assert result.returncode != 0
    assert 'permission denied' in result.stderr


@pytest.mark.parametrize('state', ['disabled','deleting'])
def test_lifecycle_denies_reads_mutations_and_storage_with_same_claims(users, state):
    a, _, seed = users
    obj = str(uuid4())
    change = (f"SELECT app_private.set_account_state('{a}','disabled');" if state == 'disabled'
              else f"SELECT app_private.begin_account_deletion('{a}');")
    prefix = seed + f"INSERT INTO storage.objects VALUES('{obj}','{a}'); SET LOCAL ROLE dd_lifecycle_operator;" + change
    for operation in ["SELECT api.read_profile();", "SELECT api.read_preferences();", "SELECT api.update_profile('Blocked','','','');"]:
        result = sql(prefix + as_user(a) + operation + 'ROLLBACK;')
        assert result.returncode != 0
        assert 'Account access denied' in result.stderr
    value = success(prefix + as_user(a) + "SELECT api.account_access(); SELECT count(*) FROM storage.objects; ROLLBACK;")
    assert json.loads([x for x in value.splitlines() if x.startswith('{')][0])['active'] is False
    assert value.splitlines()[-1] == '0'
    result = sql(prefix + as_user(a) + f"INSERT INTO storage.objects VALUES('{uuid4()}','{a}'); ROLLBACK;")
    assert result.returncode != 0 and 'row-level security' in result.stderr


def test_active_storage_and_membership_require_real_trusted_grant(users):
    a, b, seed = users
    value = success(seed + as_user(a) + f"""
    INSERT INTO storage.objects VALUES('{uuid4()}','{a}');
    SELECT count(*) FROM storage.objects;
    SELECT api.account_access();
    SET LOCAL ROLE dd_lifecycle_operator;
    SELECT app_private.set_catalog_membership('{a}',true);
    """ + as_user(a) + "SELECT api.account_access();" + as_user(b) + "SELECT api.account_access(); ROLLBACK;")
    values = [json.loads(x) for x in value.splitlines() if x.startswith('{')]
    assert [x['isCatalogAdmin'] for x in values] == [False,True,False]
    assert '1' in value.splitlines()


def test_bootstrap_is_idempotent_and_never_reactivates(users):
    a, _, seed = users
    value = success(seed + as_user(a) + "SELECT api.update_profile('Edited','','','');"
        "SET LOCAL ROLE dd_lifecycle_operator;" + f"""
        SELECT app_private.set_account_state('{a}','disabled');
        SELECT app_private.bootstrap_user('{a}','Overwrite attempt');
        RESET ROLE;
        SELECT name FROM app_private.user_profiles WHERE user_id='{a}';
        SELECT state FROM app_private.account_lifecycle WHERE user_id='{a}';
        SELECT count(*) FROM app_private.body_profiles WHERE user_id='{a}';
        ROLLBACK;""")
    assert value.splitlines()[-3:] == ['Edited','disabled','1']


def test_tombstone_survives_auth_deletion_and_denies_old_identity(users):
    a, _, seed = users
    value = success(seed + f"""
      SET LOCAL ROLE dd_lifecycle_operator;
      SELECT app_private.begin_account_deletion('{a}');
      RESET ROLE;
      DELETE FROM auth.users WHERE id='{a}';
      SELECT count(*) FROM app_private.account_deletion_tombstones WHERE former_subject_id='{a}';
    """ + as_user(a) + "SELECT api.account_access(); ROLLBACK;")
    assert '1' in value.splitlines()
    assert json.loads([x for x in value.splitlines() if x.startswith('{')][0])['active'] is False
    result = sql(seed + f"SET LOCAL ROLE dd_lifecycle_operator; SELECT app_private.begin_account_deletion('{a}'); SELECT app_private.set_account_state('{a}','active'); ROLLBACK;")
    assert result.returncode != 0


def test_unbootstrapped_identity_is_denied():
    user = str(uuid4())
    value = success('BEGIN;' + as_user(user) + 'SELECT api.account_access(); ROLLBACK;')
    assert json.loads(value)['active'] is False


def test_role_and_function_security_catalog():
    value = success("""
    SELECT count(*) FROM pg_roles WHERE rolname IN
    ('dd_owner','dd_user_executor','dd_control_reader','dd_control_executor','dd_lifecycle_operator')
    AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole;
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app_private' AND c.relkind='r' AND c.relname IN ('user_profiles','body_profiles','user_preferences','account_lifecycle','account_deletion_tombstones','administrator_memberships') AND c.relrowsecurity AND c.relforcerowsecurity;
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='api' AND p.prosecdef;
    SELECT count(*) FROM pg_auth_members m JOIN pg_roles member ON m.member=member.oid
    JOIN pg_roles granted ON m.roleid=granted.oid
    WHERE member.rolname IN ('authenticated','anon','service_role') AND granted.rolname LIKE 'dd_%';
    """)
    assert value.splitlines() == ['5','6','0','0']


@pytest.mark.parametrize('disable_first',[False,True])
@pytest.mark.parametrize('mutation_call',[
    "SELECT api.update_profile('Committed before disable','','','');",
    "SELECT api.update_body_profile('{\"fit\":\"Relaxed\"}'::jsonb);",
])
def test_mutation_and_disable_serialize_on_lifecycle_row(users,disable_first,mutation_call):
    import time
    a,b,seed=users
    success(seed+'COMMIT;')
    mutation='BEGIN;'+as_user(a)+mutation_call
    disable=f"BEGIN; SET LOCAL ROLE dd_lifecycle_operator; SELECT app_private.set_account_state('{a}','disabled');"
    first,second=(disable,mutation) if disable_first else (mutation,disable)
    command=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',SOCKET,'-d','postgres']
    process=None
    try:
        process=subprocess.Popen(command+['-c',first+"SELECT pg_sleep(2); COMMIT;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        deadline=time.monotonic()+5
        while True:
            waiting=success(f"SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND query LIKE '%{a}%' AND wait_event='PgSleep';")
            if waiting=='1': break
            assert process.poll() is None,process.communicate()
            assert time.monotonic()<deadline,'First transaction did not reach its locked sleep'
            time.sleep(0.02)
        # The second request must wait for the first transaction's lifecycle row lock.
        start=time.monotonic()
        result=sql(second+'COMMIT;')
        assert time.monotonic()-start>0.5
        _,error=process.communicate(timeout=5)
        assert process.returncode==0,error
        if disable_first:
            assert result.returncode!=0 and 'Account access denied' in result.stderr
        else:
            assert result.returncode==0,result.stderr
        value=success(f"SELECT state FROM app_private.account_lifecycle WHERE user_id='{a}';")
        assert value=='disabled'
    finally:
        if process and process.poll() is None:
            process.kill();process.communicate()
        success(f"DELETE FROM auth.users WHERE id IN ('{a}','{b}');")


def test_owner_columns_and_lock_role_cannot_be_written(users):
    a,b,seed=users
    result=sql(seed+as_user(a)+f"SET LOCAL ROLE dd_user_executor; UPDATE app_private.user_profiles SET user_id='{b}' WHERE user_id='{a}'; ROLLBACK;")
    assert result.returncode!=0 and 'permission denied' in result.stderr
    result=sql(seed+f"SET LOCAL ROLE dd_control_reader; UPDATE app_private.account_lifecycle SET user_id=user_id WHERE user_id='{a}'; ROLLBACK;")
    assert result.returncode!=0 and 'row-level security' in result.stderr


@pytest.mark.parametrize('operation',['account_access()','read_profile()','read_preferences()'])
def test_anonymous_cannot_invoke_api_operations(operation):
    result=sql('BEGIN;SET LOCAL ROLE anon;SELECT api.'+operation+';ROLLBACK;')
    assert result.returncode!=0 and 'permission denied' in result.stderr

@pytest.mark.skipif(os.environ.get('DD_TEST_HOSTED_CANDIDATE') != '1', reason='Hosted compatibility candidate only')
def test_hosted_subject_helper_has_no_managed_auth_grants(users):
    a, _, seed = users
    for role in ('dd_user_executor', 'dd_control_reader', 'dd_control_executor'):
        assert success(f"SELECT has_schema_privilege('{role}','auth','USAGE');") == 'f'
    assert success(seed + as_user(a) + 'SELECT app_private.request_subject();ROLLBACK;') == a
    assert success("BEGIN; SET LOCAL ROLE authenticated; SELECT app_private.request_subject() IS NULL; ROLLBACK;") == 't'
    for role in ('anon', 'service_role'):
        denied = sql(f'BEGIN; SET LOCAL ROLE {role}; SELECT app_private.request_subject(); ROLLBACK;')
        assert denied.returncode != 0
        assert 'permission denied' in denied.stderr
