"""WeShopAI's public Gradio demo. No commercial API or paid fallback."""
import json
import os
import time
import uuid
import math

import httpx
from PIL import Image

from app.tryon.common import HostedTryOnError
from app.tryon.common import run_manifest as load_manifest
from app.tryon.common import HostedImageClient

HOST = "https://weshopai-weshopai-virtual-try-on.hf.space"


class WeShopTryOn(HostedImageClient):
    def __init__(self, client):
        super().__init__(client, HOST)

    def upload(self, image):
        # Upstream accepts aspect ratios from 0.5 to 2; preserve all pixels.
        width, height = image.size
        size = (max(width, math.ceil(height / 2)), max(height, math.ceil(width / 2)))
        if size != image.size:
            rgba = image.convert("RGBA")
            padded = Image.new("RGB", size, "white")
            padded.paste(rgba, ((size[0] - width) // 2, (size[1] - height) // 2), rgba.getchannel("A"))
            image = padded
        return super().upload(image)

    def infer(self, person, garments):
        if len(garments) != 1:
            raise HostedTryOnError("WeShopAI demo supports one garment per preview. Select only a top or bottom.")
        config = self.client.get(self.host + "/config")
        config.raise_for_status()
        dependency = next(d for d in config.json()["dependencies"] if d.get("api_name") == "generate_image")
        # Input order follows the official Space: garment, person, session state.
        data = [self.upload(garments[0][0]), self.upload(person), None]
        session = uuid.uuid4().hex
        response = self.client.post(self.host + "/gradio_api/queue/join", json={
            "data": data, "fn_index": dependency["id"], "session_hash": session})
        response.raise_for_status()
        started = time.monotonic()
        notice = None
        with self.client.stream("GET", self.host + "/gradio_api/queue/data", params={"session_hash": session}) as stream:
            stream.raise_for_status()
            for line in stream.iter_lines():
                if time.monotonic() - started > 300:
                    raise HostedTryOnError("WeShopAI demo exceeded five minutes. Try again later.")
                if not line.startswith("data:"):
                    continue
                event = json.loads(line[5:])
                if event.get("msg") == "log" and event.get("level") in {"warning", "error"}:
                    value = event.get("log")
                    if isinstance(value, str):
                        notice = " ".join(value.split())[:300]
                if event.get("msg") in {"queue_full", "unexpected_error"}:
                    raise HostedTryOnError("WeShopAI demo queue is unavailable. Try again later.")
                if event.get("msg") != "process_completed":
                    continue
                output = event.get("output", {}).get("data", [])
                if not event.get("success") or not output or not isinstance(output[0], dict) or not output[0].get("url"):
                    detail = " Upstream message: " + notice if notice else " The service did not provide a reason."
                    raise HostedTryOnError("WeShopAI demo returned no image." + detail)
                return self.download(output[0]["url"])
        raise HostedTryOnError("WeShopAI demo ended without a preview")


def infer(person, garments):
    from huggingface_hub import get_token
    token = os.getenv("HF_TOKEN", "").strip() or get_token()
    headers = {"Authorization": "Bearer " + token} if token else {}
    try:
        with httpx.Client(headers=headers, timeout=httpx.Timeout(60, connect=15), follow_redirects=False) as client:
            return WeShopTryOn(client).infer(person, garments)
    except HostedTryOnError:
        raise
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, OSError, StopIteration) as exc:
        raise HostedTryOnError("WeShopAI demo is unavailable or returned an invalid response. Try later.") from exc


def run_manifest(plan):
    return load_manifest(plan, generate=infer)
