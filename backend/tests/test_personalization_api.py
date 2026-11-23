"""Personalization and recommendation feedback HTTP contracts."""
import json
import time
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.dependencies import verified_principal
from app.main import create_app
from app.security import Principal


@pytest.fixture
def client_data():
    app = create_app(Settings(supabase_url="https://test.supabase.co", supabase_publishable_key="sb_publishable_test", database_foundation_enabled=True))
    principal = Principal(uuid4(), int(time.time()) + 300, "personalization-user-token")
    app.dependency_overrides[verified_principal] = lambda: principal
    calls, faults = [], {}
    preference = {"styleTags": ["minimal"], "colorTags": ["navy"], "preferredFit": "Relaxed",
                  "preferredOccasions": ["Work"], "budgetMin": 1000, "budgetMax": 5000, "currency": "INR"}
    feedback = {"id": str(uuid4()), "recommendationId": str(uuid4()), "sentiment": "like",
                "reasonCode": "matches_style", "note": "", "createdAt": "2026-11-23T10:00:00Z",
                "updatedAt": "2026-11-23T10:00:00Z"}

    def receive(request):
        calls.append(request)
        assert request.headers["authorization"] == "Bearer personalization-user-token"
        assert request.headers["apikey"] == "sb_publishable_test"
        assert request.headers["content-profile"] == "api"
        operation = request.url.path.rsplit("/", 1)[-1]
        if operation in faults:
            return faults[operation]
        if operation == "account_access":
            return httpx.Response(200, json={"userId": str(principal.user_id), "active": True})
        if operation == "read_personalization_preferences":
            return httpx.Response(200, json=preference)
        if operation == "update_personalization_preferences":
            changes = json.loads(request.content)["p_changes"]
            preference.update(changes)
            if "preferredFit" in changes and changes["preferredFit"] is None:
                preference["preferredFit"] = None
            return httpx.Response(200, json=preference)
        if operation == "list_recommendation_feedback":
            return httpx.Response(200, json={"items": [feedback]})
        if operation == "upsert_recommendation_feedback":
            body = json.loads(request.content)
            if body["p_id"] != feedback["recommendationId"]:
                return httpx.Response(404, json={"code": "P0002"})
            feedback.update(sentiment=body["p_sentiment"], reasonCode=body["p_reason_code"], note=body["p_note"])
            return httpx.Response(200, json=feedback)
        if operation == "delete_recommendation_feedback":
            if json.loads(request.content)["p_id"] != feedback["recommendationId"]:
                return httpx.Response(404, json={"code": "P0002"})
            return httpx.Response(204)
        raise AssertionError(operation)

    with TestClient(app) as client:
        app.state.transport = httpx.AsyncClient(transport=httpx.MockTransport(receive))
        try:
            yield client, calls, faults, app, feedback
        finally:
            client.portal.call(app.state.transport.aclose)


def test_preferences_read_and_patch_forward_owner_jwt(client_data):
    client, calls, *_ = client_data
    read = client.get("/personalization/preferences")
    assert read.status_code == 200 and read.json()["styleTags"] == ["minimal"]
    response = client.patch("/personalization/preferences", json={"styleTags": ["linen", "classic"], "preferredFit": None})
    assert response.status_code == 200 and response.json()["preferredFit"] is None
    assert json.loads(calls[-1].content) == {"p_changes": {"styleTags": ["linen", "classic"], "preferredFit": None}}


@pytest.mark.parametrize("payload", [
    {}, {"styleTags": ["minimal", " Minimal "]}, {"styleTags": [""]},
    {"styleTags": ["x" * 41]}, {"preferredFit": "Any"},
    {"preferredOccasions": ["Work", "Work"]}, {"preferredOccasions": ["Holiday"]},
    {"budgetMin": 100.123}, {"budgetMin": 900, "budgetMax": 100},
    {"ownerId": str(uuid4())}, {"currency": "USD"},
])
def test_invalid_preferences_rejected_before_upstream(client_data, payload):
    client, calls, *_ = client_data
    before = len(calls)
    assert client.patch("/personalization/preferences", json=payload).status_code == 422
    assert all(request.url.path.endswith("account_access") for request in calls[before:])


def test_feedback_upsert_list_and_remove(client_data):
    client, calls, _, _, feedback = client_data
    ident = feedback["recommendationId"]
    response = client.put(f"/recommendations/{ident}/feedback", json={"sentiment": "dislike", "reasonCode": "not_my_style", "note": "Too formal"})
    assert response.status_code == 200 and response.json()["sentiment"] == "dislike"
    assert json.loads(calls[-1].content) == {"p_id": ident, "p_sentiment": "dislike", "p_reason_code": "not_my_style", "p_note": "Too formal"}
    assert client.get("/recommendations/feedback").json()["items"][0]["recommendationId"] == ident
    assert client.delete(f"/recommendations/{ident}/feedback").status_code == 204


@pytest.mark.parametrize("payload", [
    {}, {"sentiment": "neutral", "reasonCode": "other"},
    {"sentiment": "like", "reasonCode": "unknown"},
    {"sentiment": "like", "reasonCode": "other", "ownerId": str(uuid4())},
    {"sentiment": "like", "reasonCode": "other", "note": "x" * 1001},
])
def test_invalid_feedback_rejected_before_upstream(client_data, payload):
    client, calls, *_ = client_data
    before = len(calls)
    assert client.put(f"/recommendations/{uuid4()}/feedback", json=payload).status_code == 422
    assert all(request.url.path.endswith("account_access") for request in calls[before:])


@pytest.mark.parametrize("path,method", [
    ("/personalization/preferences", "GET"), ("/personalization/preferences", "PATCH"),
    ("/recommendations/feedback", "GET"), (f"/recommendations/{uuid4()}/feedback", "PUT"),
    (f"/recommendations/{uuid4()}/feedback", "DELETE"),
])
def test_auth_required(path, method, client_data):
    client, calls, _, app, *_ = client_data
    app.dependency_overrides.clear()
    before = len(calls)
    response = client.request(method, path, json={"sentiment": "like", "reasonCode": "other"})
    assert response.status_code == 401 and len(calls) == before


def test_upstream_auth_and_dependency_errors_are_consistent(client_data):
    client, _, faults, *_ = client_data
    faults["read_personalization_preferences"] = httpx.Response(401, json={"detail": "secret"})
    assert client.get("/personalization/preferences").status_code == 401
    faults["read_personalization_preferences"] = httpx.Response(500, json={"detail": "secret"})
    failed = client.get("/personalization/preferences")
    assert failed.status_code == 503 and "secret" not in failed.text
