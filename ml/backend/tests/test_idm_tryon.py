import io
import json
import unittest

import httpx
from PIL import Image

from app.tryon.common import HostedTryOnError
from app.tryon.idm import HOST
from app.tryon.idm import IDMTryOn
from app.tryon.idm import portrait_reference
from app.tryon.idm import restore_framing


class IDMTests(unittest.TestCase):
    def test_portrait_padding_and_restore_do_not_stretch_tall_or_wide_inputs(self):
        for size in [(468, 1024), (1024, 500), (768, 1024)]:
            original = Image.new("RGB", size, "blue")
            padded, box = portrait_reference(original)
            self.assertEqual(padded.size, (768, 1024))
            self.assertAlmostEqual((box[2] - box[0]) / (box[3] - box[1]), size[0] / size[1], places=2)
            restored = restore_framing(padded, box, size)
            self.assertEqual(restored.size, size)
            self.assertEqual(restored.getpixel((0, 0)), (0, 0, 255))

    def test_gradio4_editor_payload_uses_auto_mask_and_reads_generated_image(self):
        calls, uploads = [], []
        def handle(request):
            if request.url.path == "/config":
                return httpx.Response(200, json={"dependencies": [{"api_name": "load_example"}, {"api_name": "tryon", "inputs": list(range(7))}]})
            if request.url.path == "/upload":
                uploads.append(request.content)
                return httpx.Response(200, json=[f"/tmp/{len(uploads)}.png"])
            if request.url.path == "/queue/join":
                calls.append(json.loads(request.content))
                return httpx.Response(200, json={"event_id": "test"})
            if request.url.path == "/queue/data":
                event = {"msg": "process_completed", "success": True, "output": {"data": [{"url": HOST + "/file=/tmp/output.png"}, {"url": "not-the-result"}]}}
                return httpx.Response(200, text="data:" + json.dumps(event) + "\n\n")
            output = io.BytesIO()
            Image.new("RGB", (128, 192), "green").save(output, format="PNG")
            return httpx.Response(200, content=output.getvalue())
        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            image = IDMTryOn(client).infer(Image.new("RGB", (128, 192)), [(Image.new("RGB", (128, 128)), "tops")])
        self.assertEqual(image.size, (128, 192))
        self.assertEqual(calls[0]["fn_index"], 1)
        data = calls[0]["data"]
        self.assertEqual(data[0]["background"]["path"], "/tmp/1.png")
        self.assertEqual(data[0]["layers"], [])
        self.assertEqual(data[1]["path"], "/tmp/2.png")
        self.assertEqual(data[3:], [True, False, 30, 42])

    def test_bottom_two_items_and_foreign_result_are_rejected_without_requests(self):
        with httpx.Client(transport=httpx.MockTransport(lambda _: self.fail("No request expected"))) as client:
            adapter = IDMTryOn(client)
            for categories in [[], ["bottoms"], ["one-pieces"], ["tops", "bottoms"]]:
                with self.assertRaises(HostedTryOnError):
                    adapter.infer(None, [(None, c) for c in categories])
            for url in ["https://example.com/file=/tmp/image.png", HOST + "/redirect?url=evil", HOST.replace("https:", "http:") + "/file=x"]:
                with self.assertRaises(HostedTryOnError):
                    adapter.download(url)

    def test_quota_failure_is_clear(self):
        def handle(request):
            if request.url.path == "/config":
                return httpx.Response(200, json={"dependencies": [{"api_name": "tryon", "inputs": list(range(7))}]})
            if request.url.path == "/upload":
                return httpx.Response(200, json=["/tmp/input.png"])
            if request.url.path == "/queue/join":
                return httpx.Response(200, json={})
            return httpx.Response(200, text='data:{"msg":"process_completed","success":false,"output":{"error":"GPU quota exceeded"}}\n\n')
        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            with self.assertRaisesRegex(HostedTryOnError, "quota"):
                IDMTryOn(client).infer(Image.new("RGB", (128, 128)), [(Image.new("RGB", (128, 128)), "tops")])
