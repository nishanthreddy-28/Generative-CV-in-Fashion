"""Official IDM-VTON ZeroGPU demo, upper-body only, noncommercial experiment."""
import io
import json
import os
import time
import uuid
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps

from app.tryon.common import HostedTryOnError
from app.tryon.common import run_manifest as load_manifest

HOST = "https://yisol-idm-vton.hf.space"


def portrait_reference(image):
    """The upstream worker stretches to 768x1024; pad first to avoid distortion."""
    rgba = ImageOps.exif_transpose(image).convert("RGBA")
    flat = Image.new("RGB", rgba.size, "white")
    flat.paste(rgba, mask=rgba.getchannel("A"))
    fitted = ImageOps.contain(flat, (768, 1024), Image.Resampling.LANCZOS)
    left, top = (768 - fitted.width) // 2, (1024 - fitted.height) // 2
    canvas = Image.new("RGB", (768, 1024), "white")
    canvas.paste(fitted, (left, top))
    return canvas, (left, top, left + fitted.width, top + fitted.height)


def restore_framing(image, box, size):
    crop = tuple(round(value * (image.width / 768 if index % 2 == 0 else image.height / 1024)) for index, value in enumerate(box))
    return image.crop(crop).resize(size, Image.Resampling.LANCZOS)


class IDMTryOn:
    def __init__(self, client):
        self.client = client

    def upload(self, image):
        output = io.BytesIO()
        rgba = image.convert("RGBA")
        flat = Image.new("RGB", rgba.size, "white")
        flat.paste(rgba, mask=rgba.getchannel("A"))
        flat.save(output, format="PNG")
        response = self.client.post(HOST + "/upload", files={"files": ("reference.png", output.getvalue(), "image/png")})
        response.raise_for_status()
        path = response.json()[0]
        if not isinstance(path, str):
            raise HostedTryOnError("IDM-VTON returned an invalid upload response")
        return {"path": path, "meta": {"_type": "gradio.FileData"}}

    def infer(self, person, garments):
        if len(garments) != 1 or garments[0][1] != "tops":
            raise HostedTryOnError("IDM-VTON demo supports one upper-body garment. Choose only a shirt, T-shirt or top.")
        config = self.client.get(HOST + "/config")
        config.raise_for_status()
        index, dependency = next((i, d) for i, d in enumerate(config.json()["dependencies"]) if d.get("api_name") == "tryon")
        if len(dependency["inputs"]) != 7:
            raise HostedTryOnError("IDM-VTON's public API changed; check its input format before retrying")
        person_reference, crop = portrait_reference(person)
        garment_reference, _ = portrait_reference(garments[0][0])
        human, garment = self.upload(person_reference), self.upload(garment_reference)
        # Gradio 4 ImageEditor payload. Auto-mask does not need painted layers.
        data = [{"background": human, "layers": [], "composite": human}, garment,
                "the upper-body garment shown in the reference image", True, False, 30, 42]
        session = uuid.uuid4().hex
        response = self.client.post(HOST + "/queue/join", json={"data": data,
            "fn_index": dependency.get("id") if dependency.get("id") is not None else index, "session_hash": session})
        response.raise_for_status()
        started = time.monotonic()
        with self.client.stream("GET", HOST + "/queue/data", params={"session_hash": session}) as stream:
            stream.raise_for_status()
            for line in stream.iter_lines():
                if time.monotonic() - started > 300:
                    raise HostedTryOnError("IDM-VTON queue exceeded five minutes. Retry later.")
                if not line.startswith("data:"):
                    continue
                event = json.loads(line[5:])
                if event.get("msg") in {"queue_full", "unexpected_error"}:
                    raise HostedTryOnError("IDM-VTON public queue is unavailable. Retry later.")
                if event.get("msg") != "process_completed":
                    continue
                if not event.get("success"):
                    if "quota" in str(event).lower():
                        raise HostedTryOnError("IDM-VTON Hugging Face GPU quota is exhausted. Wait for reset; no fallback was called.")
                    raise HostedTryOnError("IDM-VTON's public GPU worker failed. Try the official demo or retry later.")
                return restore_framing(self.download(event["output"]["data"][0]["url"]), crop, person.size)
        raise HostedTryOnError("IDM-VTON ended without a completed preview")

    def download(self, url):
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != urlparse(HOST).netloc or not parsed.path.startswith("/file="):
            raise HostedTryOnError("IDM-VTON returned an unexpected result location")
        content = bytearray()
        with self.client.stream("GET", url) as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > 15 * 1024 * 1024:
                    raise HostedTryOnError("IDM-VTON result exceeds the image limit")
        with Image.open(io.BytesIO(content)) as image:
            if image.width * image.height > 20_000_000:
                raise HostedTryOnError("IDM-VTON result dimensions exceed the image limit")
            return image.convert("RGB")


def infer(person, garments):
    from huggingface_hub import get_token
    token = os.getenv("HF_TOKEN", "").strip() or get_token()
    headers = {"Authorization": "Bearer " + token} if token else {}
    try:
        with httpx.Client(headers=headers, timeout=httpx.Timeout(60, connect=15), follow_redirects=False) as client:
            return IDMTryOn(client).infer(person, garments)
    except HostedTryOnError:
        raise
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, OSError, StopIteration) as exc:
        raise HostedTryOnError("IDM-VTON demo is unavailable or returned an invalid response. Retry later.") from exc


def run_manifest(plan):
    return load_manifest(plan, generate=infer)
