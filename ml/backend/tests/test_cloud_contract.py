import json
import os
import unittest
from unittest.mock import patch

import httpx

from app.cloud.service import CloudError
from app.cloud.service import Supabase

OWNER = "00000000-0000-0000-0000-000000000001"


class CloudContractTests(unittest.TestCase):
    def test_identity_is_verified_and_private_paths_reject_foreign_or_traversal(self):
        calls = []
        def handle(request):
            calls.append(request)
            if request.url.path == "/auth/v1/user":
                return httpx.Response(200, json={"id": OWNER})
            if request.url.path.startswith("/rest/v1/dd_profiles"):
                return httpx.Response(200, json=[])
            if request.url.path.startswith("/storage/v1/object/authenticated/"):
                return httpx.Response(200, content=b"private-image")
            return httpx.Response(400)
        with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "public-test"}):
            with Supabase("user-test-token", transport=httpx.MockTransport(handle)) as sb:
                self.assertEqual(sb.user, OWNER)
                self.assertEqual(sb.download(OWNER + "/person.png"), b"private-image")
                for path in ["foreign/photo.png", OWNER + "/../foreign.png", "/" + OWNER + "/photo.png", OWNER + "\\photo.png", OWNER + "//photo.png"]:
                    with self.assertRaises(CloudError): sb.download(path)
                sb.insert("dd_profiles", {"user_id": "foreign", "data": {}})
        self.assertEqual(calls[0].headers["Authorization"], "Bearer user-test-token")
        self.assertEqual(json.loads(calls[-1].content)["user_id"], OWNER)
        self.assertTrue(all("user-test-token" not in str(call.url) for call in calls))

    def test_failed_authentication_never_reaches_storage(self):
        calls = []
        def handle(request):
            calls.append(request.url.path)
            return httpx.Response(401)
        with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "public-test"}):
            with self.assertRaises(CloudError):
                Supabase("expired", transport=httpx.MockTransport(handle))
        self.assertEqual(calls, ["/auth/v1/user"])
