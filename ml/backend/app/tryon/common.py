"""Shared transport/image helpers for retained hosted try-on providers."""
import io
from urllib.parse import urlparse
from PIL import Image

class HostedTryOnError(RuntimeError):
    pass

class HostedImageClient:
    def __init__(self, client, host):
        self.client, self.host = client, host

    def upload(self, image):
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        response = self.client.post(self.host + "/gradio_api/upload", files={"files": ("reference.png", buffer.getvalue(), "image/png")})
        response.raise_for_status()
        path = response.json()[0]
        if not isinstance(path, str):
            raise HostedTryOnError("Invalid hosted upload response")
        return {"path": path, "meta": {"_type": "gradio.FileData"}}

    def download(self, url):
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != urlparse(self.host).netloc or not parsed.path.startswith("/gradio_api/file="):
            raise HostedTryOnError("Unexpected hosted result location")
        data = bytearray()
        with self.client.stream("GET", url) as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > 15 * 1024 * 1024:
                    raise HostedTryOnError("Hosted result exceeds the image limit")
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 20_000_000:
                raise HostedTryOnError("Hosted result dimensions exceed the image limit")
            return image.convert("RGB")


def run_manifest(plan, generate):
    with Image.open(plan["person"]) as source:
        person = source.convert("RGB")
    garments = []
    for garment in plan["garments"]:
        with Image.open(garment["path"]) as source:
            rgba = source.convert("RGBA").rotate(-garment.get("rotation", 0), expand=True)
            rgb = Image.new("RGB", rgba.size, "white")
            rgb.paste(rgba, mask=rgba.getchannel("A"))
            garments.append((rgb, garment["category"]))
    generate(person, garments).save(plan["output"])
