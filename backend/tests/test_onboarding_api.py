"""HTTP tests for owner-scoped onboarding against intercepted Auth/Data/Storage calls."""
import hashlib
import io
import json
import time
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.dependencies import verified_principal
from app.main import create_app
from app.security import Principal


def png():
    output = io.BytesIO(); Image.new("RGB", (12, 16), "#987654").save(output, "PNG")
    return output.getvalue()


def test_onboarding_upload_retry_private_retrieval_and_profile_confirmation():
    app = create_app(Settings(supabase_url="https://test.supabase.co", supabase_publishable_key="sb_publishable_test", database_foundation_enabled=True))
    principal = Principal(uuid4(), int(time.time()) + 300, "owner-jwt")
    app.dependency_overrides[verified_principal] = lambda: principal
    image_id = str(uuid4()); saved = {}; objects = {}; calls = []

    def respond(request):
        calls.append(request)
        if "/rest/v1/" in request.url.path:
            assert request.headers["authorization"] == "Bearer owner-jwt"
            assert request.headers["content-profile"] == "api"
            operation = request.url.path.rsplit("/", 1)[-1]
            body = json.loads(request.content)
            if operation == "account_access": return httpx.Response(200, json={"userId": str(principal.user_id), "active": True})
            if operation == "onboarding_status": return httpx.Response(200, json=saved.get("status", {"processingAvailable": False, "draft": None, "reviewed": None}))
            if operation == "read_profile": return httpx.Response(200, json={"name": "User", "style": "", "location": "", "bio": ""})
            if operation == "read_body_profile": return httpx.Response(200, json={"units": "", "height": None, "chest": None, "waist": None, "hips": None, "inseam": None, "bodyShape": "", "skinTone": "", "undertone": "", "fit": ""})
            if operation == "onboarding_image":
                if body.get("p_sha256"):
                    saved["sha"] = body["p_sha256"]
                    saved["present"] = saved.get("present", False)
                    return httpx.Response(200, json={"id": image_id, "object": f"{principal.user_id}/{image_id}.jpg", "sha256": body["p_sha256"], "byteSize": body["p_byte_size"], "present": saved["present"]})
                return httpx.Response(200, json={"id": image_id, "object": f"{principal.user_id}/{image_id}.jpg", "present": True})
            if operation == "finish_onboarding_upload":
                saved["present"] = True
                record = {"id": image_id, "state": "ready", "confirmedValues": None}
                saved["status"] = {"processingAvailable": False, "draft": record, "reviewed": None}
                return httpx.Response(200, json=record)
            if operation == "review_onboarding":
                assert body["p_values"]["name"] == "Taylor"
                record = {"id": image_id, "state": "reviewed", "confirmedValues": body["p_values"]}
                saved["status"] = {"processingAvailable": False, "draft": None, "reviewed": record}
                return httpx.Response(200, json=record)
            if operation == "discard_onboarding": return httpx.Response(204)
            raise AssertionError(operation)
        if request.url.path.startswith("/storage/v1/object/"):
            assert request.headers["authorization"] == "Bearer owner-jwt"
            assert request.headers["apikey"] == "sb_publishable_test"
            path = request.url.path.split("/storage/v1/object/onboarding-body-images/", 1)[1]
            if request.method == "POST":
                objects[path] = request.content
                return httpx.Response(200, json={})
            if request.method == "GET": return httpx.Response(200, content=objects[path], headers={"content-type": "image/jpeg"})
        raise AssertionError(request)

    with TestClient(app) as client:
        app.state.transport = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        try:
            assert client.get("/onboarding").json()["processingAvailable"] is False
            content = png()
            upload = client.post(f"/onboarding/body-photo/{image_id}", files={"image": ("body.png", content, "image/png")})
            assert upload.status_code == 200, upload.text
            assert upload.json()["version"]["state"] == "ready"
            assert list(objects) == [f"{principal.user_id}/{image_id}.jpg"]
            image = client.get(upload.json()["imageUrl"])
            assert image.status_code == 200 and image.headers["cache-control"] == "private, no-store"
            assert Image.open(io.BytesIO(image.content)).format == "JPEG"
            # Simulate an upload whose response was lost; same id+hash confirms the existing object.
            before = sum(call.method == "POST" and "/storage/v1/" in call.url.path for call in calls)
            retry = client.post(f"/onboarding/body-photo/{image_id}", files={"image": ("body.png", content, "image/png")})
            assert retry.status_code == 200
            after = sum(call.method == "POST" and "/storage/v1/" in call.url.path for call in calls)
            assert before == after
            status = client.get("/onboarding").json()
            assert status["draft"]["id"] == image_id
            confirmed = client.post(f"/onboarding/body-photo/{image_id}/review", json={"name": "Taylor", "units": "cm", "height": 175.5})
            assert confirmed.status_code == 200 and confirmed.json()["state"] == "reviewed"
            assert client.get("/onboarding").json()["reviewed"]["confirmedValues"]["height"] == 175.5
        finally:
            client.portal.call(app.state.transport.aclose)


def test_onboarding_rejects_invalid_and_unauthenticated_requests():
    app = create_app(Settings(supabase_url="https://test.supabase.co", supabase_publishable_key="sb_publishable_test", database_foundation_enabled=True))
    principal = Principal(uuid4(), int(time.time()) + 300, "owner-jwt")
    app.dependency_overrides[verified_principal] = lambda: principal
    calls = []
    def respond(request):
        calls.append(request)
        if request.url.path.endswith("/account_access"): return httpx.Response(200, json={"userId": str(principal.user_id), "active": True})
        return httpx.Response(404, json={"code": "P0002"})
    with TestClient(app) as client:
        app.state.transport = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        try:
            ident = str(uuid4())
            invalid = client.post(f"/onboarding/body-photo/{ident}/review", json={"name":"Taylor", "units":"cm", "height":True})
            assert invalid.status_code == 422
            assert not any(call.url.path.endswith("/review_onboarding") for call in calls)
            app.dependency_overrides.clear(); calls.clear()
            assert client.get("/onboarding").status_code == 401 and calls == []
        finally:
            client.portal.call(app.state.transport.aclose)


def test_onboarding_photo_id_is_not_enough_to_cross_user_read():
    app = create_app(Settings(supabase_url="https://test.supabase.co", supabase_publishable_key="sb_publishable_test", database_foundation_enabled=True))
    principal = Principal(uuid4(), int(time.time()) + 300, "owner-jwt")
    app.dependency_overrides[verified_principal] = lambda: principal
    calls = []
    def respond(request):
        calls.append(request)
        if request.url.path.endswith("/account_access"): return httpx.Response(200, json={"userId": str(principal.user_id), "active": True})
        if request.url.path.endswith("/onboarding_image"): return httpx.Response(404, json={"code":"P0002"})
        raise AssertionError("Storage must not be reached for an inaccessible image")
    with TestClient(app) as client:
        app.state.transport = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        try:
            result = client.get(f"/onboarding/body-photo/{uuid4()}")
            assert result.status_code == 404
            assert not any("/storage/v1/" in call.url.path for call in calls)
        finally:
            client.portal.call(app.state.transport.aclose)
