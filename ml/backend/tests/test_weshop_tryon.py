import io
import json
import unittest

import httpx
from PIL import Image

from app.tryon.common import HostedTryOnError
from app.tryon.weshop import HOST
from app.tryon.weshop import WeShopTryOn


class WeShopTests(unittest.TestCase):
    def test_tall_and_wide_inputs_are_padded_without_stretching(self):
        uploads = []
        def transport(request):
            uploads.append(request.content)
            return httpx.Response(200, json=["/tmp/input.png"])
        with httpx.Client(transport=httpx.MockTransport(transport)) as client:
            adapter = WeShopTryOn(client)
            adapter.upload(Image.new("RGB", (468, 1024), "blue"))
            adapter.upload(Image.new("RGB", (1024, 300), "blue"))
        for data, size, offset in zip(uploads, [(512, 1024), (1024, 512)], [(22, 0), (0, 106)]):
            with Image.open(io.BytesIO(data[data.index(b"\x89PNG"):])) as image:
                self.assertEqual(image.size, size)
                self.assertEqual(image.getpixel(offset), (0, 0, 255))
                self.assertEqual(image.getpixel((0, 0)), (255, 255, 255))

    def test_public_queue_sends_garment_then_person_and_downloads_result(self):
        uploads, posted = [], []
        def transport(request):
            path = request.url.path
            if path == "/config":
                return httpx.Response(200, json={"dependencies": [{"api_name": "generate_image", "id": 2}]})
            if path.endswith("/upload"):
                uploads.append(request.content)
                return httpx.Response(200, json=[f"/tmp/{len(uploads)}.png"])
            if path.endswith("/join"):
                posted.append(json.loads(request.content))
                return httpx.Response(200, json={"event_id": "event"})
            if path.endswith("/data"):
                event = {"msg": "process_completed", "success": True, "output": {"data": [{"url": HOST + "/gradio_api/file=/tmp/result.png"}, None]}}
                return httpx.Response(200, text="data:" + json.dumps(event) + "\n\n")
            buffer = io.BytesIO(); Image.new("RGB", (128, 128), "green").save(buffer, format="PNG")
            return httpx.Response(200, content=buffer.getvalue())
        with httpx.Client(transport=httpx.MockTransport(transport)) as client:
            result = WeShopTryOn(client).infer(Image.new("RGB", (128, 128), "red"), [(Image.new("RGB", (128, 128), "blue"), "tops")])
        self.assertEqual(result.getpixel((0, 0)), (0, 128, 0))
        data = posted[0]["data"]
        self.assertEqual([entry["path"] for entry in data[:2]], ["/tmp/1.png", "/tmp/2.png"])
        self.assertIsNone(data[2])
        for payload, expected in zip(uploads, [(0, 0, 255), (255, 0, 0)]):
            png = payload[payload.index(b"\x89PNG"):]
            with Image.open(io.BytesIO(png)) as image:
                self.assertEqual(image.getpixel((0, 0)), expected)

    def test_rejects_multiple_garments_and_external_result_hosts(self):
        with httpx.Client() as client:
            adapter = WeShopTryOn(client)
            with self.assertRaises(HostedTryOnError):
                adapter.infer(None, [(None, "tops"), (None, "bottoms")])
            with self.assertRaises(HostedTryOnError):
                adapter.download("https://example.com/gradio_api/file=/tmp/image.png")
