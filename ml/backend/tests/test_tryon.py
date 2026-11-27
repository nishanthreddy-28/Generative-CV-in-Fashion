import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from PIL import Image

from app.persistence import conversations as store
from app.tryon import jobs as tryon


class TryonTests(unittest.TestCase):
    def setUp(self):
        gate=patch('app.pose.validation.validate_person'); gate.start(); self.addCleanup(gate.stop)

    def test_private_job_and_validation(self):
        data = io.BytesIO()
        Image.new("RGB", (128, 128), "blue").save(data, format="PNG")
        with tempfile.TemporaryDirectory() as directory, patch.object(store, "PATH", Path(directory) / "state.db"), patch.object(tryon, "ROOT", Path(directory) / "jobs"):
            store.init()
            tryon.init()
            with self.assertRaises(HTTPException):
                tryon.create(b"invalid", "alice")
            job_id = tryon.create(data.getvalue(), "alice")
            try:
                self.assertEqual(tryon.read(job_id, "alice")["status"], "queued")
                with self.assertRaises(HTTPException) as caught:
                    tryon.read(job_id, "bob")
                self.assertEqual(caught.exception.status_code, 404)
                with self.assertRaises(HTTPException) as caught:
                    tryon.create(data.getvalue(), "bob")
                self.assertEqual(caught.exception.status_code, 409)
                tryon.init()
                self.assertEqual(tryon.read(job_id, "alice")["status"], "failed")
            finally:
                tryon.SLOT.release()
