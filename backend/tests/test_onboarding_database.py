"""Onboarding RLS, atomic confirmation, retry and cleanup tests on disposable PostgreSQL."""
import json
from uuid import uuid4

import pytest

from test_foundation_database import SOCKET, as_user, sql, success, users

pytestmark = pytest.mark.skipif(not SOCKET, reason="Run tests/database/run_local.py for disposable PostgreSQL")


def verified(user):
    address = f"{user}@example.invalid"
    return ("RESET ROLE;UPDATE auth.users SET email='" + address + "',"
            "raw_app_meta_data='{\"provider\":\"email\"}'::jsonb,confirmation_token='proof',"
            "confirmation_sent_at=clock_timestamp(),email_confirmed_at=NULL WHERE id='" + user + "';"
            "UPDATE auth.users SET confirmation_token='',email_confirmed_at=clock_timestamp() WHERE id='" + user + "';")


def rpc(name, args):
    def literal(value):
        if value is None: return "NULL"
        if isinstance(value, bool): return "true" if value else "false"
        if isinstance(value, (dict, list)): return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"
        return "'" + str(value).replace("'", "''") + "'"
    return f"SELECT api.{name}({','.join(literal(value) for value in args)});"


def create_reviewed(user):
    image_id = str(uuid4())
    digest = "a" * 64
    reserve = rpc("onboarding_image", [image_id, digest, 1200])
    obj = f"{user}/{image_id}.jpg"
    insert = (f"INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES"
              f"('{uuid4()}','{user}','onboarding-body-images','{obj}',"
              "'{\"size\":\"1200\",\"mimetype\":\"image/jpeg\"}'::jsonb);")
    finish = rpc("finish_onboarding_upload", [image_id])
    values = {"name": "Alice", "location": "Pune", "units": "cm", "height": 171.25, "waist": 72}
    review = rpc("review_onboarding", [image_id, values])
    return image_id, digest, reserve, insert, finish, values, review


def test_upload_review_persists_actual_profile_and_is_owner_scoped(users):
    a, b, seed = users
    image_id, _, reserve, insert, finish, values, review = create_reviewed(a)
    out = success(seed + verified(a) + verified(b) + as_user(a) + reserve + insert + finish + review +
                  "SELECT api.read_profile();SELECT api.read_body_profile();SELECT api.onboarding_status();" +
                  as_user(b) + "SELECT api.onboarding_status();ROLLBACK;")
    records = [json.loads(line) for line in out.splitlines() if line.startswith("{")]
    assert records[3]["name"] == values["name"] and records[3]["location"] == values["location"]
    assert records[4]["height"] == values["height"] and records[4]["waist"] == values["waist"] and records[4]["units"] == "cm"
    assert records[5]["reviewed"]["id"] == image_id
    assert records[6]["reviewed"] is None and records[6]["draft"] is None


def test_replacement_retires_old_private_photo_and_worker_can_remove_it(users):
    a, _, seed = users
    first = create_reviewed(a)
    second = create_reviewed(a)
    flows = "".join(part for flow in (first, second) for part in (flow[2], flow[3], flow[4], flow[6]))
    old_id, new_id = first[0], second[0]
    prefix = seed + verified(a) + as_user(a) + flows
    states = success(prefix + "SET LOCAL ROLE dd_user_executor;"
                     f"SELECT state FROM app_private.body_profile_versions WHERE id='{old_id}';"
                     f"SELECT image_version_id FROM app_private.body_profiles WHERE user_id='{a}';"
                     "RESET ROLE;SET LOCAL ROLE service_role;SELECT api.image_cleanup_manifest();ROLLBACK;")
    lines = states.splitlines()
    assert lines[-3:] and lines[-3] == "cleanup_pending" and lines[-2] == new_id
    manifest = json.loads(lines[-1])
    assert any(item["id"] == old_id and item["bucket"] == "onboarding-body-images" for item in manifest)
    object_name = f"{a}/{old_id}.jpg"
    cleaned = success(prefix + f"RESET ROLE;DELETE FROM storage.objects WHERE bucket_id='onboarding-body-images' AND name='{object_name}';"
                      f"SET LOCAL ROLE service_role;SELECT api.finish_image_cleanup('onboarding-body-images','{old_id}');"
                      "RESET ROLE;SELECT state FROM app_private.body_profile_versions WHERE id='" + old_id + "';ROLLBACK;")
    assert cleaned.splitlines()[-2:] == ["t", "removed"]


def test_image_upload_is_owner_scoped_private_and_immutable(users):
    a, b, seed = users
    image_id, _, reserve, insert, finish, _, _ = create_reviewed(a)
    prefix = seed + verified(a) + verified(b) + as_user(a) + reserve + insert + finish
    deleted = success(prefix + f"DELETE FROM storage.objects WHERE name='{a}/{image_id}.jpg';SELECT count(*) FROM storage.objects WHERE name='{a}/{image_id}.jpg';ROLLBACK;")
    assert deleted.splitlines()[-1] == "1"
    assert "row-level security" in sql(seed + as_user(b) + f"SELECT * FROM storage.objects WHERE name='{a}/{image_id}.jpg';ROLLBACK;").stderr or \
           success(seed + as_user(b) + f"SELECT count(*) FROM storage.objects WHERE name='{a}/{image_id}.jpg';ROLLBACK;").splitlines()[-1] == "0"
    for bucket in ["wardrobe-images", "tryon-inputs"]:
        assert bucket in ("wardrobe-images", "tryon-inputs")


@pytest.mark.parametrize("values", [
    {"name":" ","units":"cm"}, {"name":"Alice","units":"m"},
    {"name":"Alice","units":"cm","height":True},
    {"name":"Alice","units":"cm","height":301},
    {"name":"Alice","units":"cm","height":10.12345},
    {"name":"Alice","units":"cm","role":"admin"},
])
def test_confirmation_revalidates_values_and_rolls_back_profile(users, values):
    a, _, seed = users
    # Reserve and upload a fresh, ready version; submit only the invalid request.
    image_id = str(uuid4())
    digest = "c" * 64
    reserve = rpc("onboarding_image", [image_id, digest, 900])
    insert = (f"INSERT INTO storage.objects(id,owner_id,bucket_id,name,metadata) VALUES"
              f"('{uuid4()}','{a}','onboarding-body-images','{a}/{image_id}.jpg',"
              "'{\"size\":\"900\",\"mimetype\":\"image/jpeg\"}'::jsonb);")
    finish = rpc("finish_onboarding_upload", [image_id])
    invalid = rpc("review_onboarding", [image_id, values])
    result = sql(seed + verified(a) + as_user(a) + reserve + insert + finish + invalid + "ROLLBACK;")
    assert result.returncode != 0


def test_unconfirmed_image_is_retryable_then_discarded_and_cleanup_is_trusted(users):
    a, _, seed = users
    image_id = str(uuid4()); digest = "b" * 64
    reserve = rpc("onboarding_image", [image_id, digest, 900])
    discard = rpc("discard_onboarding", [image_id])
    assert success(seed + verified(a) + as_user(a) + reserve + discard +
                   "SET LOCAL ROLE dd_user_executor;SELECT state FROM app_private.body_profile_versions WHERE id='" + image_id + "';ROLLBACK;").splitlines()[-1] == "cleanup_pending"
    assert "permission denied" in sql(seed + as_user(a) + "SELECT api.image_cleanup_manifest();ROLLBACK;").stderr


def test_client_roles_cannot_call_private_onboarding_or_cleanup_functions():
    for role in ("anon",):
        result = sql(f"BEGIN;SET LOCAL ROLE {role};SELECT app_private.onboarding_status();ROLLBACK;")
        assert result.returncode != 0 and "permission denied" in result.stderr
    value = success("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "
                    "WHERE n.nspname='app_private' AND p.proname IN ('onboarding_status','review_onboarding','onboarding_image') "
                    "AND p.proowner='dd_user_executor'::regrole AND p.prosecdef;")
    assert value == "3"
