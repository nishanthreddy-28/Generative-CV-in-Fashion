"""Public-example API checks only; no wardrobe/user photos or auth tokens."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import time
import uuid

import httpx

ROOT = Path(__file__).resolve().parent
PROMPT = (
    "Keep the man in image 1, his exact face, hair, body shape, pose, hands, "
    "background and camera framing. Replace his top with only the black and "
    "white star-pattern sleeveless knit top from image 2. Replace his shorts "
    "with the blue jeans from image 3. Dress him in both garments together. "
    "Preserve the garment designs, lettering, patterns and colors. Keep his "
    "own shoes. Do not transfer any person or background from the references."
)
PUBLIC_EXAMPLES = [ROOT / "person.jpg", ROOT / "shirt.jpg", ROOT / "trousers.jpg"]
CANDIDATES = {
    "flux_klein_joint": (
        "https://black-forest-labs-flux-2-klein-9b.hf.space",
        "generate",
    ),
    "firered_11_joint": (
        "https://fireredteam-firered-image-edit-1-1.hf.space",
        "infer",
    ),
}


def check(name, host, endpoint):
    started = time.monotonic()
    report = {
        "candidate": name,
        "host": host,
        "inputs": [path.name for path in PUBLIC_EXAMPLES],
        "input_provenance": "Public BoyuanJiang/FitDiT demo examples, previously downloaded",
        "prompt": PROMPT,
        "authenticated": False,
        "local_inference": False,
    }
    try:
        with httpx.Client(timeout=httpx.Timeout(30, read=95), follow_redirects=True) as client:
            files = []
            for path in PUBLIC_EXAMPLES:
                response = client.post(
                    host + "/gradio_api/upload",
                    files={"files": (path.name, path.read_bytes(), "image/jpeg")},
                )
                response.raise_for_status()
                files.append({
                    "image": {"path": response.json()[0], "meta": {"_type": "gradio.FileData"}},
                    "caption": None,
                })
            if name == "flux_klein_joint":
                data = [PROMPT, files, "Distilled (4 steps)", 42, False, 768, 1024, 4, 1.0, False]
            else:
                data = [files, PROMPT, "None", 42, False, 4.0, 30, 1024, 768, False, 1]
            response = client.post(host + "/gradio_api/call/" + endpoint, json={"data": data})
            response.raise_for_status()
            event_id = response.json()["event_id"]
            report["event_id"] = event_id
            event = None
            with client.stream("GET", host + "/gradio_api/call/" + endpoint + "/" + event_id) as stream:
                stream.raise_for_status()
                for line in stream.iter_lines():
                    if line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:") and event in {"complete", "error"}:
                        payload = json.loads(line[5:].strip())
                        report["status"] = "completed" if event == "complete" else "failed"
                        report["response"] = payload
                        break
            if "status" not in report:
                report["status"] = "no_terminal_event"
            # Some Spaces hide errors in the simplified call API. Use Gradio's
            # documented queue flow to retain diagnostics, with the same inputs.
            if report.get("status") == "failed" and report.get("response") is None:
                config = client.get(host + "/config").json()
                dependency = next(d for d in config["dependencies"] if d.get("api_name") == endpoint)
                session = uuid.uuid4().hex
                response = client.post(host + "/gradio_api/queue/join", json={
                    "data": data,
                    "fn_index": dependency["id"],
                    "session_hash": session,
                })
                response.raise_for_status()
                with client.stream("GET", host + "/gradio_api/queue/data", params={"session_hash": session}) as stream:
                    stream.raise_for_status()
                    for line in stream.iter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = json.loads(line[5:].strip())
                        if payload.get("msg") == "process_completed":
                            report["queue_diagnostic"] = payload
                            report["status"] = "completed" if payload.get("success") else "failed"
                            break
                        if payload.get("msg") in {"queue_full", "unexpected_error"}:
                            report["queue_diagnostic"] = payload
                            break
    except Exception as exc:
        report.update(status="failed", error=f"{type(exc).__name__}: {exc}")
    report["seconds"] = round(time.monotonic() - started, 2)
    (ROOT / (name + "_api_smoke.json")).write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(check, name, *candidate) for name, candidate in CANDIDATES.items()]
        for future in as_completed(futures):
            print(json.dumps(future.result(), ensure_ascii=True), flush=True)
