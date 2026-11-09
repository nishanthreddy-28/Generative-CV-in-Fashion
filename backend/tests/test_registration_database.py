"""Proof-first registration against disposable PostgreSQL with a minimal Auth interface."""
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from test_foundation_database import SOCKET, as_user, sql, success

pytestmark = pytest.mark.skipif(
    not SOCKET or os.environ.get('DD_TEST_REGISTRATION_PROTOCOL') != '1',
    reason='Use run_local.py --registration',
)
EMAIL = 'tester@example.invalid'
SESSION = 'b' * 64


def issue(attempt, *, session=SESSION, previous=None, email=EMAIL):
    parent = f"'{previous}'" if previous else 'NULL'
    return f"SELECT api.registration_issue('{attempt}','{email}','{'a'*64}','{session}','{'c'*64}','{'d'*64}',{parent});"


def prove(attempt, kind, valid=True, session=SESSION):
    proof = ('c' if kind == 'link' else 'd') * 64
    return f"SELECT api.registration_prove('{attempt}','{session}','{kind}','{proof}',{str(valid).lower()});"


def auth_insert(user, attempt=None, *, confirmed=True, email=EMAIL):
    marker = f'{{"dd_registration_attempt":"{attempt}"}}' if attempt else '{}'
    return (f"RESET ROLE; INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data)"
            f" VALUES('{user}','{email}',{'clock_timestamp()' if confirmed else 'NULL'},'{marker}');")


def test_abandoned_start_does_not_reserve_address():
    abandoned, legitimate, user = (str(uuid4()) for _ in range(3))
    seed = 'BEGIN;SET LOCAL ROLE service_role;' + issue(abandoned)
    assert success(seed + 'RESET ROLE;SELECT count(*) FROM auth.users;ROLLBACK;').splitlines() == ['t', '0']
    seed += issue(legitimate, session='e'*64)
    seed += prove(legitimate,'link',session='e'*64) + prove(legitimate,'otp',session='e'*64)
    seed += auth_insert(user, legitimate)
    assert success(seed + as_user(user) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 't'


def test_independent_proofs_and_atomic_confirmation():
    attempt, user = str(uuid4()), str(uuid4())
    seed = 'BEGIN;SET LOCAL ROLE service_role;' + issue(attempt)
    assert success(seed + prove(attempt, 'otp') + 'ROLLBACK;').splitlines()[-1] == 'f'
    assert 'Registration proofs unavailable' in sql(seed + prove(attempt,'link') + auth_insert(user, attempt) + 'ROLLBACK;').stderr
    seed += prove(attempt,'link') + prove(attempt,'otp') + auth_insert(user,attempt,confirmed=False)
    seed += f"UPDATE auth.users SET email_confirmed_at=clock_timestamp() WHERE id='{user}';"
    assert success(seed + as_user(user) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 't'
    for state in ('disabled','deleting'):
        tail = f"UPDATE app_private.account_lifecycle SET state='{state}' WHERE user_id='{user}';"
        assert success(seed + tail + as_user(user) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 'f'


def test_direct_confirmed_auth_and_user_metadata_cannot_bypass():
    user, attempt = str(uuid4()), str(uuid4())
    seed = 'BEGIN;' + auth_insert(user)
    seed += f"""UPDATE auth.users SET raw_user_meta_data='{{"dd_registration_attempt":"{attempt}"}}' WHERE id='{user}';"""
    seed += as_user(user)
    assert 'Account access denied' in sql(seed + 'SELECT api.read_profile();ROLLBACK;').stderr
    assert 'row-level security' in sql(seed + f"INSERT INTO storage.objects(id,owner_id) VALUES('{uuid4()}','{user}');ROLLBACK;").stderr
    assert 'permission denied' in sql(seed + issue(attempt) + 'ROLLBACK;').stderr
    assert success(seed + 'SELECT app_private.current_account_active();ROLLBACK;') == 'f'


def test_resend_cooldown_expiry_and_binding():
    attempt, replacement = str(uuid4()), str(uuid4())
    seed = 'BEGIN;SET LOCAL ROLE service_role;' + issue(attempt)
    assert success(seed + issue(replacement,previous=attempt) + 'ROLLBACK;').splitlines()[-1] == 'f'
    age = f"RESET ROLE;UPDATE app_private.registration_challenges SET issued_at=issued_at-interval '11 minutes',expires_at=expires_at-interval '11 minutes' WHERE id='{attempt}';SET LOCAL ROLE service_role;"
    seed += age
    assert success(seed + prove(attempt,'link') + 'ROLLBACK;').splitlines()[-1] == 'f'
    assert success(seed + issue(replacement,previous=attempt,session='e'*64) + 'ROLLBACK;').splitlines()[-1] == 'f'
    assert success(seed + issue(replacement,previous=attempt) + prove(attempt,'link') + prove(replacement,'link') + 'ROLLBACK;').splitlines()[-3:] == ['t','f','t']
    assert success(seed + 'SELECT api.registration_expire();ROLLBACK;').splitlines()[-1] == '1'


def test_wrong_attempts_lock_and_wrong_email_cannot_activate():
    attempt,user = str(uuid4()),str(uuid4())
    seed = 'BEGIN;SET LOCAL ROLE service_role;' + issue(attempt)
    assert success(seed + prove(attempt,'link',False)*5 + prove(attempt,'link') + 'ROLLBACK;').splitlines()[-1] == 'f'
    both = seed + prove(attempt,'link') + prove(attempt,'otp')
    assert 'Registration proofs unavailable' in sql(both+auth_insert(user,attempt,email='other@example.invalid')+'ROLLBACK;').stderr


def test_concurrent_attempts_create_one_user_and_receipt():
    attempts = [str(uuid4()),str(uuid4())]
    users = [str(uuid4()),str(uuid4())]
    email = f'{uuid4().hex}@example.invalid'

    def prepare(attempt):
        return success('BEGIN;SET LOCAL ROLE service_role;'+issue(attempt,email=email)+prove(attempt,'link')+prove(attempt,'otp')+'COMMIT;')

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(prepare,attempts)) == ['t\nt\nt','t\nt\nt']
        results = list(pool.map(lambda pair: sql('BEGIN;'+auth_insert(*pair,email=email)+'COMMIT;'),zip(users,attempts)))
    try:
        assert sorted(result.returncode for result in results) == [0,1]
        assert 'duplicate key' in next(result.stderr for result in results if result.returncode)
        assert success(f"SELECT count(*) FROM app_private.registration_receipts WHERE user_id IN ('{users[0]}','{users[1]}');") == '1'
    finally:
        success(f"BEGIN;DELETE FROM auth.users WHERE email='{email}';DELETE FROM app_private.registration_challenges WHERE email_address='{email}';COMMIT;")


def test_rate_budget_serializes_concurrent_requests():
    key = uuid4().hex*2
    statement = f"BEGIN;SET LOCAL ROLE service_role;SELECT api.registration_rate('network','{key}',3);COMMIT;"
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: success(statement),range(12)))
    assert results.count('t')==3 and results.count('f')==9



def test_finalization_window_cannot_be_replayed_after_expiry():
    attempt,user = str(uuid4()),str(uuid4())
    seed = 'BEGIN;SET LOCAL ROLE service_role;' + issue(attempt) + prove(attempt,'link') + prove(attempt,'otp')
    seed += f"""RESET ROLE;
    UPDATE app_private.registration_challenges SET
      issued_at=issued_at-interval '25 hours',expires_at=expires_at-interval '25 hours',
      link_verified_at=link_verified_at-interval '25 hours',otp_verified_at=otp_verified_at-interval '25 hours',
      finalization_started_at=finalization_started_at-interval '25 hours'
    WHERE id='{attempt}';"""
    assert 'Registration proofs unavailable' in sql(seed + auth_insert(user,attempt) + 'ROLLBACK;').stderr

@pytest.mark.skipif(os.environ.get('DD_TEST_HOSTED_CANDIDATE') != '1', reason='Hosted compatibility candidate only')
def test_existing_preview_is_trusted_expiring_and_preserves_ownership():
    first, second = str(uuid4()), str(uuid4())
    seed = 'BEGIN;' + auth_insert(first, email='first@example.invalid') + auth_insert(second, email='second@example.invalid')
    seed += f"UPDATE app_private.account_lifecycle SET state='active' WHERE user_id IN ('{first}','{second}');"
    grant = f"SET LOCAL ROLE dd_lifecycle_operator; SELECT app_private.approve_development_preview('{first}');RESET ROLE;"
    assert 'permission denied' in sql(seed + as_user(first) + f"SELECT app_private.approve_development_preview('{first}');ROLLBACK;").stderr
    assert 'permission denied' in sql(seed + as_user(first) + 'SELECT * FROM app_private.development_preview_access;ROLLBACK;').stderr
    active = seed + grant
    assert success(active + as_user(first) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 't'
    assert success(active + as_user(second) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 'f'
    assert success(active + as_user(first) + "SET LOCAL ROLE dd_user_executor;SELECT count(*) FROM app_private.user_profiles WHERE user_id='" + second + "';ROLLBACK;").splitlines()[-1] == '0'
    for state in ('disabled','deleting'):
        assert success(active + f"UPDATE app_private.account_lifecycle SET state='{state}' WHERE user_id='{first}';" + as_user(first) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 'f'
    expired = active + f"UPDATE app_private.development_preview_access SET approved_at=statement_timestamp()-interval '2 days',expires_at=statement_timestamp()-interval '1 day' WHERE user_id='{first}';"
    assert success(expired + as_user(first) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 'f'
    banned = active + f"UPDATE auth.users SET banned_until=statement_timestamp()+interval '1 day' WHERE id='{first}';"
    assert success(banned + as_user(first) + 'SELECT app_private.current_account_active();ROLLBACK;').splitlines()[-1] == 'f'
