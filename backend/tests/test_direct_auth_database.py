"""Direct Auth enrollment against a disposable PostgreSQL Auth interface."""
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from test_foundation_database import SOCKET, as_user as authenticate, sql, success

pytestmark = pytest.mark.skipif(
    not SOCKET or os.environ.get("DD_TEST_REGISTRATION_PROTOCOL") != "1",
    reason="Use run_local.py --registration",
)


def seed(subject, *, provider="email", sent=True, email=None):
    address = email or f"{subject}@example.invalid"
    proof = "'local-proof'" if sent else "NULL"
    timestamp = "clock_timestamp()" if sent else "NULL"
    return (
        "INSERT INTO auth.users(id,email,raw_app_meta_data,confirmation_token,confirmation_sent_at) "
        f"""VALUES('{subject}','{address}','{{"provider":"{provider}"}}',{proof},{timestamp});"""
    )


def confirm(subject):
    return (
        "UPDATE auth.users SET confirmation_token='',email_confirmed_at=clock_timestamp() "
        f"WHERE id='{subject}';"
    )


def as_user(subject):
    return authenticate(str(subject))


def access(subject):
    return as_user(subject) + "SELECT (api.account_access()->>'active')::boolean;RESET ROLE;"


def test_email_proof_admits_once_and_never_grants_catalog_admin():
    subject = uuid4()
    checks = (
        f"SELECT method, challenge_id IS NULL, verified_email FROM app_private.registration_receipts WHERE user_id='{subject}';"
        + as_user(subject) + "SELECT api.account_access()->>'isCatalogAdmin';ROLLBACK;"
    )
    assert success("BEGIN;" + seed(subject) + access(subject) + confirm(subject)
                   + confirm(subject) + access(subject) + checks).splitlines() == [
        "f", "t", f"supabase_email|t|{subject}@example.invalid", "false"
    ]


def test_email_autoconfirm_and_user_metadata_do_not_grant_access():
    subject = uuid4()
    command = "BEGIN;" + seed(subject, sent=False) + (
        f"""UPDATE auth.users SET raw_user_meta_data='{{"email_verified":true,"role":"admin"}}'
        WHERE id='{subject}';"""
    ) + confirm(subject)
    assert success(command + access(subject) + "ROLLBACK;") == "f"
    assert "Account access denied" in sql(command + as_user(subject) + "SELECT api.read_profile();").stderr
    assert "row-level security" in sql(command + as_user(subject)
        + f"INSERT INTO storage.objects(id,owner_id) VALUES('{uuid4()}','{subject}');").stderr


@pytest.mark.parametrize("provider", ["google", "apple"])
@pytest.mark.parametrize("verified", [True, False])
def test_oauth_requires_provider_verified_identity_for_the_same_email(provider, verified):
    subject = uuid4()
    provider_row = (
        "INSERT INTO auth.identities(user_id,provider,identity_data) "
        f"""VALUES('{subject}','{provider}','{{"email":"{subject}@example.invalid","email_verified":{str(verified).lower()}}}');"""
    )
    command = "BEGIN;" + seed(subject,provider=provider,sent=False) + provider_row
    assert success(command + confirm(subject) + access(subject) + "ROLLBACK;") == ("t" if verified else "f")


def test_linking_other_identity_does_not_reissue_receipt_or_change_owner():
    subject = uuid4()
    command = "BEGIN;" + seed(subject) + confirm(subject) + (
        "INSERT INTO auth.identities(user_id,provider,identity_data) "
        f"""VALUES('{subject}','google','{{"email":"{subject}@example.invalid","email_verified":true}}');"""
        f"""UPDATE auth.users SET raw_app_meta_data='{{"provider":"google"}}' WHERE id='{subject}';"""
    )
    assert success(command + access(subject) +
                   f"SELECT method FROM app_private.registration_receipts WHERE user_id='{subject}';ROLLBACK;"
                   ).splitlines() == ["t","supabase_email"]


@pytest.mark.parametrize("state", ["disabled", "deleting"])
def test_confirmation_cannot_reactivate_an_inactive_account(state):
    subject = uuid4()
    command = "BEGIN;" + seed(subject) + (
        f"UPDATE app_private.account_lifecycle SET state='{state}' WHERE user_id='{subject}';"
    )
    assert success(command + confirm(subject) + access(subject) +
                   f"SELECT state FROM app_private.account_lifecycle WHERE user_id='{subject}';ROLLBACK;"
                   ).splitlines() == ["f",state]


def test_authenticated_client_cannot_create_its_own_receipt():
    subject = uuid4()
    result = sql("BEGIN;" + seed(subject) + as_user(subject) +
        "INSERT INTO app_private.registration_receipts(user_id,method,verified_email,verified_at)"
        f" VALUES('{subject}','supabase_email','{subject}@example.invalid',clock_timestamp());")
    assert "permission denied" in result.stderr


def test_receipt_remains_bound_to_the_verified_address_and_tombstones_still_deny():
    subject = uuid4()
    command = "BEGIN;" + seed(subject) + confirm(subject)
    changed = f"UPDATE auth.users SET email='changed@example.invalid' WHERE id='{subject}';"
    tombstone = (
        "INSERT INTO app_private.account_deletion_tombstones(former_subject_id,cleanup_stage)"
        f" VALUES('{subject}','denying');"
    )
    assert success(command + changed + access(subject) + "ROLLBACK;") == "f"
    assert success(command + tombstone + access(subject) + "ROLLBACK;") == "f"


def test_newly_admitted_users_keep_profile_and_catalog_boundaries():
    owner, other = uuid4(), uuid4()
    command = "BEGIN;" + seed(owner) + confirm(owner) + seed(other) + confirm(other)
    command += f"UPDATE app_private.user_profiles SET name='Original' WHERE user_id='{owner}';"
    command += as_user(other)
    assert success(command + "SELECT api.read_profile()->>'name';ROLLBACK;") == ""
    assert "permission denied" in sql(command + f"SELECT name FROM app_private.user_profiles WHERE user_id='{owner}';").stderr
    assert success(command + "SELECT api.account_access()->>'isCatalogAdmin';ROLLBACK;") == "false"


def test_concurrent_duplicate_email_creates_only_one_identity_and_receipt():
    subjects = [uuid4(),uuid4()]
    email = f"{uuid4()}@example.invalid"
    def attempt(subject):
        return sql("BEGIN;" + seed(subject,email=email) + confirm(subject) + "COMMIT;")
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt,subjects))
        assert sum(r.returncode == 0 for r in results) == 1
        assert "duplicate key" in next(r.stderr for r in results if r.returncode)
        assert success(f"SELECT count(*) FROM app_private.registration_receipts WHERE verified_email='{email}';") == "1"
    finally:
        success(f"DELETE FROM auth.users WHERE email='{email}';")
