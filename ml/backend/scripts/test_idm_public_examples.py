"""One live smoke test using only the official demo's publicly supplied images."""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import httpx
from app.tryon.idm import HOST
from app.tryon.idm import IDMTryOn
from app.tryon.idm import infer
from app.tryon.common import HostedTryOnError


def main():
    output = ROOT / "storage" / "provider-evaluation" / datetime.now(timezone.utc).strftime("idm-public-%Y%m%d-%H%M%S")
    output.mkdir(parents=True)
    started = time.monotonic()
    report = {"engine": "idm", "input_source": "official public IDM-VTON example datasets"}
    print("Testing IDM-VTON with its own public example person and garment; no wardrobe photos are read.", flush=True)
    try:
        with httpx.Client(timeout=60, follow_redirects=False) as client:
            response = client.get(HOST + "/config")
            response.raise_for_status()
            datasets = [component for component in response.json()["components"] if component["type"] == "dataset"]
            person_url = datasets[0]["props"]["samples"][0][0]["background"]["url"]
            garment_url = datasets[1]["props"]["samples"][0][0]["url"]
            adapter = IDMTryOn(client)
            person, garment = adapter.download(person_url), adapter.download(garment_url)
        person.save(output / "person.png")
        garment.save(output / "garment.png")
        infer(person, [(garment, "tops")]).save(output / "result.png")
        report.update(status="completed", output=str(output / "result.png"))
    except HostedTryOnError as exc:
        report.update(status="failed", message=str(exc))
    except (httpx.HTTPError, KeyError, ValueError, IndexError, OSError):
        report.update(status="failed", message="Could not read the official demo's public examples.")
    report["seconds"] = round(time.monotonic() - started, 2)
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report), flush=True)
    return 0 if report["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
