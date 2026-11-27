import unittest
from unittest.mock import patch
from fastapi import HTTPException
from app.tryon import jobs as tryon

class ProviderSelectionTests(unittest.TestCase):
    def test_only_retained_providers_are_accepted(self):
        for name in ['weshop','idm']:
            self.assertEqual(tryon.choose_provider(name),name)
        for name in ['qwen','fitdit','workers_ai','fashn_local','unknown']:
            with self.subTest(provider=name), self.assertRaises(HTTPException) as caught:
                tryon.choose_provider(name)
            self.assertEqual(caught.exception.status_code,422)

    def test_stale_environment_cannot_enable_a_removed_provider(self):
        with patch.dict('os.environ',{'PHASE3_TRYON_PROVIDER':'fashn_local'}):
            with self.assertRaises(HTTPException): tryon.choose_provider()
