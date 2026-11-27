import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.profiles import service as profile
from app.persistence import conversations as store
from app.contracts.styling import Intent


class ProfileTests(unittest.TestCase):
    def test_profile_is_private_and_does_not_pollute_conversation_intent(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store, "PATH", Path(directory) / "state.db"):
            store.init()
            preferences = profile.Profile(styles=["minimal"], liked_colors=["teal"], fit="oversized")
            profile.save("alice", preferences)
            self.assertEqual(profile.read("alice"), preferences)
            self.assertEqual(profile.read("bob"), profile.Profile())
            intent = Intent(preferences=["formal tonight"])
            assessment_intent = profile.contextual_intent(intent, preferences)
            self.assertEqual(intent.preferences, ["formal tonight"])
            self.assertIn("minimal", " ".join(assessment_intent.preferences))
            item = {"colors": '[{"name":"teal"}]', "fit": "oversized"}
            other = {"colors": '[{"name":"red"}]', "fit": "slim"}
            self.assertGreater(profile.affinity([item], preferences), profile.affinity([other], preferences))
