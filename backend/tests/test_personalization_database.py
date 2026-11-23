"""Real PostgreSQL preference and feedback isolation tests, disposable cluster only."""
import json

import pytest

from test_foundation_database import SOCKET, as_user, sql, success, users  # noqa: F401
from test_recommendations_database import CALL
from test_wardrobe_database import create as wardrobe, rows
from test_catalog_database import create as catalog, grant

pytestmark = pytest.mark.skipif(not SOCKET, reason="Use tests/database/run_local.py --registration")


def j(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


def verified(user):
    email = f"{user}@example.invalid"
    return ("RESET ROLE;"
            f"UPDATE auth.users SET email='{email}',raw_app_meta_data='{{\"provider\":\"email\"}}'::jsonb,"
            f"confirmation_token='proof',confirmation_sent_at=clock_timestamp(),email_confirmed_at=NULL WHERE id='{user}';"
            f"UPDATE auth.users SET confirmation_token='',email_confirmed_at=clock_timestamp() WHERE id='{user}';")


def update(changes):
    return f"SELECT api.update_personalization_preferences({j(changes)});"


def feedback_id(user):
    return ("SELECT api.generate_recommendations('Work','',true,1);"
            "SELECT (api.recent_recommendations()->'items'->0->>'id');")


def test_structured_preferences_persist_reuse_fit_and_isolate(users):
    a, b, seed = users
    payload = {"styleTags": ["minimal", "linen"], "colorTags": ["navy"],
               "preferredFit": "Relaxed", "preferredOccasions": ["Work", "Weekend"],
               "budgetMin": 500, "budgetMax": 2500}
    output = rows(success(seed + verified(a) + verified(b) + as_user(a) + update(payload)
        + "SELECT api.read_personalization_preferences();SELECT api.read_body_profile();SELECT api.generate_recommendations('Work','',true,1);"
        + "SET LOCAL ROLE dd_user_executor;SELECT personalization_snapshot FROM app_private.recommendation_requests ORDER BY created_at DESC LIMIT 1;RESET ROLE;"
        + as_user(b)
        + "SELECT api.read_personalization_preferences();ROLLBACK;"))
    assert output[0]["styleTags"] == ["minimal", "linen"]
    assert output[0]["colorTags"] == ["navy"] and output[0]["preferredFit"] == "Relaxed"
    assert output[0]["preferredOccasions"] == ["Work", "Weekend"]
    assert output[0]["budgetMin"] == 500 and output[0]["budgetMax"] == 2500 and output[0]["currency"] == "INR"
    assert output[2]["fit"] == "Relaxed"
    assert output[4]["styleTags"] == ["minimal", "linen"] and output[4]["preferredFit"] == "Relaxed"
    assert output[4]["budgetMin"] == 500 and output[4]["budgetMax"] == 2500
    assert output[5]["styleTags"] == [] and output[5]["preferredFit"] is None
    assert output[5]["budgetMin"] is None and output[5]["budgetMax"] is None


def test_saved_style_and_occasion_personalization_affect_real_recommendations(users):
    a, _, seed = users
    _, top = wardrobe(a, "Linen shirt", "Tops")
    _, bottom = wardrobe(a, "Trousers", "Bottoms")
    prefix = seed + verified(a) + as_user(a) + top + bottom
    output = rows(success(prefix + "SELECT api.generate_recommendations('Work','',true,1);"
        + update({"styleTags": ["linen"], "preferredOccasions": ["Work"]})
        + "SELECT api.generate_recommendations('Work','',true,1);ROLLBACK;"))
    baseline, personalized = output[-3]["items"][0], output[-1]["items"][0]
    assert personalized["score"] == baseline["score"] + 10
    assert any("style or request preferences" in reason for reason in personalized["reasons"])
    assert any("preferred or supported occasion" in reason for reason in personalized["reasons"])


def test_catalog_budget_filters_unpriced_or_out_of_range_catalog_pieces(users):
    a, _, seed = users
    _, top = catalog(a, "Catalog shirt", "Tops")
    _, bottom = catalog(a, "Catalog trousers", "Bottoms")
    prefix = seed + verified(a) + grant(a) + top + bottom
    prefix += "RESET ROLE;UPDATE app_private.catalog_garments SET price=500 WHERE name='Catalog shirt';"
    prefix += "UPDATE app_private.catalog_garments SET price=5000 WHERE name='Catalog trousers';"
    prefix += as_user(a) + update({"budgetMax": 1000})
    value = rows(success(prefix + "SELECT api.generate_recommendations('Work','',false,5);ROLLBACK;"))[-1]
    assert value["items"] == []
    # Clearing the bound restores real catalog candidates; this is not a fake fallback.
    value = rows(success(prefix + update({"budgetMax": None})
        + "SELECT api.generate_recommendations('Work','',false,5);ROLLBACK;"))[-1]
    assert len(value["items"]) == 1 and all(item["source"] == "catalog" for item in value["items"][0]["items"])


def test_feedback_is_idempotent_owner_scoped_and_removable(users):
    a, b, seed = users
    _, top = wardrobe(a, "Top", "Tops")
    _, bottom = wardrobe(a, "Bottom", "Bottoms")
    prefix = seed + verified(a) + verified(b) + as_user(a) + top + bottom + CALL
    result = rows(success(prefix + "SELECT set_config('test.recommendation',api.recent_recommendations()->'items'->0->>'id',true);"
        "SELECT api.upsert_recommendation_feedback(current_setting('test.recommendation')::uuid,'like','matches_style','');"
        "SELECT api.upsert_recommendation_feedback(current_setting('test.recommendation')::uuid,'dislike','not_my_style','Too formal');"
        "SELECT api.list_recommendation_feedback();" + as_user(b)
        + "SELECT api.list_recommendation_feedback();ROLLBACK;"))
    first, second, from_a, from_b = result[-4], result[-3], result[-2], result[-1]
    assert first["id"] == second["id"] and first["createdAt"] == second["createdAt"]
    assert second["sentiment"] == "dislike" and second["note"] == "Too formal"
    assert from_a["items"][0]["recommendationId"] == second["recommendationId"]
    assert from_b["items"] == []
    missing = sql(seed + verified(a) + verified(b) + as_user(a) + top + bottom + CALL
        + "SELECT set_config('test.recommendation',api.recent_recommendations()->'items'->0->>'id',true);"
        + as_user(b) + "SELECT api.upsert_recommendation_feedback(current_setting('test.recommendation')::uuid,'like','other','');ROLLBACK;")
    assert missing.returncode != 0
    deleted = rows(success(seed + verified(a) + as_user(a) + top + bottom + CALL
        + "SELECT set_config('test.recommendation',api.recent_recommendations()->'items'->0->>'id',true);"
        + "SELECT api.upsert_recommendation_feedback(current_setting('test.recommendation')::uuid,'like','other','');"
        + "SELECT api.delete_recommendation_feedback(current_setting('test.recommendation')::uuid);"
        + "SELECT api.list_recommendation_feedback();ROLLBACK;"))[-1]
    assert deleted["items"] == []


@pytest.mark.parametrize("changes", [
    {"styleTags": ["", "minimal"]}, {"styleTags": ["minimal", " Minimal "]},
    {"colorTags": ["x" * 41]}, {"preferredFit": "Any"},
    {"preferredOccasions": ["Work", "Work"]}, {"preferredOccasions": ["Holiday"]},
    {"budgetMin": 1000, "budgetMax": 500}, {"budgetMin": 100.123}, {"owner_id": "other"},
])
def test_database_revalidates_preference_payload(users, changes):
    a, _, seed = users
    result = sql(seed + verified(a) + as_user(a) + update(changes) + "ROLLBACK;")
    assert result.returncode != 0 and ("Invalid" in result.stderr or "Minimum budget" in result.stderr or "Unknown personalization" in result.stderr)


def test_feedback_table_security_constraints_and_inactive_denial(users):
    a, _, seed = users
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        "WHERE n.nspname='app_private' AND c.relname='recommendation_feedback' AND c.relrowsecurity AND c.relforcerowsecurity;") == "1"
    assert success("SELECT has_table_privilege('authenticated','app_private.recommendation_feedback','SELECT') OR "
        "has_table_privilege('service_role','app_private.recommendation_feedback','SELECT');") == "f"
    transition = f"SET LOCAL ROLE dd_lifecycle_operator;SELECT app_private.set_account_state('{a}','disabled');"
    result = sql(seed + verified(a) + as_user(a) + "SELECT api.read_personalization_preferences();"
        + transition + as_user(a) + "SELECT api.read_personalization_preferences();ROLLBACK;")
    assert result.returncode != 0 and "Account access denied" in result.stderr
