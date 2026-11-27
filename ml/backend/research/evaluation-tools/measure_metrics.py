"""Pilot evaluation of saved data; no hosted API or wardrobe/job edits.

Run from backend: ../.venv/Scripts/python.exe scripts/measure_metrics.py
Visual audit labels are explicitly AI-authored, never independent ground truth.
Local inference may populate the existing feature cache.
"""
import collections
import csv
import html
import io
import json
import os
from pathlib import Path
import sqlite3
import statistics
import sys
import time
import unittest
from datetime import datetime, timezone

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
OUT = BACKEND / "storage/metrics/2026-11-22"
RESEARCH = BACKEND.parents[1] / "hf_tryon_research/local_eval"


def rows(db, query):
    with sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute(query)]


def dump(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2), encoding="utf-8")


def csv_file(name, values):
    if not values:
        return
    with (OUT / name).open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(values[0]))
        writer.writeheader(); writer.writerows(values)


def ratio(successes, total):
    return round(100 * successes / total, 2) if total else None


def failure_reason(job, log):
    text = (job["message"] + " " + log).lower()
    if "no cuda gpus" in text or "no nvidia driver" in text:
        return "local_cuda_unavailable"
    if "aspectratio" in text:
        return "input_aspect_ratio_rejected"
    if any(s in text for s in ["out of memory", "bad allocation", "paging file"]):
        return "local_memory_error"
    if "returned no image" in text:
        return "upstream_no_image_reason_unconfirmed"
    if "quota is exhausted" in job["message"].lower() or "rate-limited" in job["message"].lower():
        return "reported_quota_or_rate_limit"
    if "restarted" in text:
        return "server_restart"
    return "upstream_or_worker_error_unspecified"


def collect():
    from PIL import Image
    items = rows(BACKEND / "storage/drapedrop.db", "SELECT * FROM items WHERE user_id='test_user_3' AND is_archived=0 ORDER BY id")
    item_map = {item["id"]: item for item in items}
    audit = json.loads((OUT / "category_visual_audit.json").read_text())
    categories = []
    for record in audit:
        item = item_map.get(record["item_id"])
        if item is None:
            continue
        proposed = record["proposed_category"]
        categories.append({"item_id": item["id"], "stored_category": item["category"],
            "stored_source": item["source"], "ai_proposed_category": proposed or "uncertain",
            "agreement": item["category"] == proposed if proposed else None,
            "confidence_not_calibrated": item["confidence"], "note": record["note"]})
    assessed = [row for row in categories if row["agreement"] is not None]
    original_model = [row for row in assessed if row["stored_source"] == "model"]
    classification = {"active_items": len(items), "stored_user_corrected_items": sum(i["source"] == "user_corrected" for i in items),
        "taxonomy_categories_present": dict(collections.Counter(i["category"] for i in items)),
        "visual_audit_assessed": len(assessed), "visual_audit_uncertain": len(categories) - len(assessed),
        "visual_audit_matches": sum(row["agreement"] for row in assessed),
        "visual_audit_agreement_percent": ratio(sum(row["agreement"] for row in assessed), len(assessed)),
        "model_source_audit_assessed": len(original_model), "model_source_audit_matches": sum(row["agreement"] for row in original_model),
        "accuracy_macro_f1": None,
        "limitation": "Convenience sample, single AI visual reviewer, duplicate/similar photos, incomplete taxonomy coverage. Agreement with saved labels is NOT held-out classification accuracy. One stored label was user-corrected; original prediction is unavailable."}
    csv_file("categorization_audit.csv", categories)

    conversations = rows(BACKEND / "storage/phase3.db", "SELECT id,user_id,state FROM conversations")
    recommendation_rows, unique, used = [], set(), set()
    for conversation in conversations:
        if conversation["user_id"] != "test_user_3":
            continue
        state = json.loads(conversation["state"])
        ids = state.get("last_ids", [])
        if not ids:
            continue
        owned = all(i in item_map for i in ids)
        slots = [item_map[i]["slot"] for i in ids if i in item_map]
        complete = owned and len(slots) == len(set(slots)) and "shoes" in slots and (
            ("top" in slots and "bottom" in slots and "full" not in slots) or
            ("full" in slots and "top" not in slots and "bottom" not in slots))
        recommendation_rows.append({"conversation_id": conversation["id"], "owned_items_only": owned,
                                    "complete_template": complete, "item_ids": "|".join(ids)})
        unique.add(tuple(sorted(ids))); used.update(i for i in ids if i in item_map)
    feedback = rows(BACKEND / "storage/phase3.db", "SELECT liked FROM outfit_feedback WHERE user_id='test_user_3'")
    recommendations = {"saved_last_outfits": len(recommendation_rows), "distinct_last_outfits": len(unique),
        "complete_templates": sum(r["complete_template"] for r in recommendation_rows),
        "owned_items_only": sum(r["owned_items_only"] for r in recommendation_rows),
        "distinct_items_used": len(used), "wardrobe_coverage_percent": ratio(len(used), len(items)),
        "recorded_feedback": len(feedback), "recorded_likes": sum(f["liked"] == 1 for f in feedback),
        "recorded_dislikes": sum(f["liked"] == 0 for f in feedback),
        "compatibility_auc": None, "precision_at_3": None, "ndcg_at_3": None,
        "limitation": "Historical last-successful outfits, not all displayed recommendations. Mixed development versions/providers; repeats and test requests are not independent users. Last outfit may predate the saved intent, so no request-constraint accuracy is inferred. Selected feedback has no exposure denominator; not an acceptance-rate estimate."}
    csv_file("recommendation_snapshot.csv", recommendation_rows)

    job_rows, groups = [], collections.defaultdict(collections.Counter)
    for job in rows(BACKEND / "storage/phase3.db", "SELECT id,status,message FROM tryon_jobs"):
        directory = BACKEND / "storage/tryon-jobs" / job["id"]
        manifest = directory / "manifest.json"
        plan = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {}
        engine = plan.get("provider", "unknown_legacy")
        valid = False
        if job["status"] == "completed" and (directory / "result.png").exists():
            try:
                with Image.open(directory / "result.png") as image:
                    image.verify(); valid = True
            except (OSError, ValueError):
                pass
        log = directory / "inference.log"
        reason = failure_reason(job, log.read_text(encoding="utf-8", errors="replace") if log.exists() else "") if job["status"] == "failed" else ""
        job_rows.append({"job_id": job["id"], "engine": engine, "status": job["status"],
                         "valid_result_file": valid, "failure_reason": reason, "message": job["message"]})
        groups[engine][job["status"]] += 1
        if valid: groups[engine]["valid_result_files"] += 1
    grouped = []
    for engine, counts in sorted(groups.items()):
        terminal = counts["completed"] + counts["failed"]
        grouped.append({"engine": engine, "completed": counts["completed"], "failed": counts["failed"],
            "pending": counts["queued"] + counts["processing"], "prepared_only": counts["prepared"],
            "terminal_generation_jobs": terminal, "valid_result_files": counts["valid_result_files"],
            "technical_completion_percent": ratio(counts["completed"], terminal)})
    generation = [r for r in job_rows if r["engine"] != "gemini_manual" and r["status"] in {"completed", "failed"}]
    tryon = {"all_saved_jobs": len(job_rows), "terminal_generation_jobs": len(generation),
        "completed_generation_jobs": sum(r["status"] == "completed" for r in generation),
        "valid_completed_images": sum(r["valid_result_file"] for r in generation),
        "technical_completion_percent": ratio(sum(r["status"] == "completed" for r in generation), len(generation)),
        "by_engine": grouped, "failure_reasons": dict(collections.Counter(r["failure_reason"] for r in job_rows if r["status"] == "failed")),
        "limitation": "Historical retained development jobs across different prompts, code, hardware states and inputs. Deleted jobs and direct research calls are absent. Completion measures pipeline reliability, not image quality or provider-only uptime. Unknown legacy providers are not inferred."}
    csv_file("tryon_jobs.csv", job_rows); csv_file("tryon_by_engine.csv", grouped)

    # Only explicitly recorded end-to-end times; never infer latency from mtimes.
    timings = []
    for name, engine, time_key in [("local_api_smoke.json", "fashn_local", "seconds"),
            ("prepared_api_job.json", "fashn_local", "elapsed_seconds"),
            ("qwen_api_smoke.json", "qwen", "seconds"),
            ("weshop_prepared_api_job.json", "weshop", "elapsed_seconds")]:
        p = RESEARCH / name
        if p.exists():
            d = json.loads(p.read_text())
            timings.append({"engine": engine, "seconds": d[time_key], "source": name,
                            "job_id": d.get("id", d.get("job_id", d.get("job", {}).get("id"))),
                            "scope": "single historical end-to-end app run; configurations differ"})
    csv_file("recorded_end_to_end_times.csv", timings)
    visual = json.loads((OUT / "tryon_visual_audit.json").read_text())
    fields = ["garment_shape_colour_pass", "unselected_clothing_identity_pass", "obvious_donor_skin_artifact_absent"]
    visual_summary = {"cases": len(visual), "reviewer": "single AI visual reviewer",
        "counts": {field: sum(c[field] for c in visual) for field in fields},
        "all_three_checks_pass": sum(all(c[field] for field in fields) for c in visual),
        "limitation": "Selected cached examples on one stock person, not blinded or representative. One bottom case is a non-default masking experiment. Coarse garment identity only; exact logos, identity verification, physical fit and pixel preservation are not scored. No human ground truth, paired targets, SSIM/LPIPS/FID or segmentation IoU claimed."}
    csv_file("tryon_visual_audit.csv", visual)
    return {"measurement_date_client": "2026-11-22", "snapshot_utc": datetime.now(timezone.utc).isoformat(),
        "categorization": classification, "recommendations": recommendations, "tryon": tryon,
        "recorded_end_to_end_times": timings, "tryon_visual_pilot": visual_summary,
        "unmeasured": ["Independent categorization accuracy/macro-F1", "Compatibility ROC-AUC/AP/FITB accuracy",
                       "Recommendation Precision@K/NDCG@K", "Chatbot intent/explanation accuracy", "Segmentation IoU/Dice",
                       "Try-on SSIM/LPIPS/FID/KID", "Representative p95 latency", "Cost per usable result"]}


def regression_tests():
    sys.path.insert(0, str(BACKEND / "tests"))
    suite = unittest.defaultTestLoader.discover(str(BACKEND / "tests"))
    stream = io.StringIO(); started = time.perf_counter()
    result = unittest.TextTestRunner(stream=stream, verbosity=1).run(suite)
    (OUT / "regression_tests.log").write_text(stream.getvalue(), encoding="utf-8")
    return {"run": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
            "skipped": len(result.skipped), "passed": result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped),
            "seconds": round(time.perf_counter() - started, 3), "meaning": "software correctness checks, mostly mocked; not model accuracy"}


def rank_diagnostic():
    from app.phase3.scorer import PretrainedScorer
    from app.phase3.service import generate
    from app.phase3.schemas import Intent
    items = rows(BACKEND / "storage/drapedrop.db", "SELECT * FROM items WHERE user_id='test_user_3' AND is_archived=0 ORDER BY id")
    started = time.perf_counter()
    candidates, issue = generate(items, Intent())
    if issue: raise ValueError(issue)
    scorer = PretrainedScorer(); scores = scorer.score(candidates)
    ranking = sorted([{"rank": 0, "score_uncalibrated": score, "item_ids": "|".join(i["id"] for i in outfit)}
                      for outfit, score in zip(candidates, scores)], key=lambda r: r["score_uncalibrated"], reverse=True)
    for index, row in enumerate(ranking, 1): row["rank"] = index
    csv_file("offline_compatibility_ranking.csv", ranking)
    return {"candidate_outfits": len(scores), "score_min": min(scores), "score_max": max(scores),
            "score_mean": statistics.mean(scores), "score_median": statistics.median(scores),
            "seconds_including_model_load_and_feature_cache": round(time.perf_counter() - started, 3),
            "model_version": scorer.version, "meaning": "real local CIR inference; score is NOT compatibility accuracy or probability; no Gemini calls"}


def render(data):
    esc = lambda x: html.escape("Not measured" if x is None else str(x))
    def table(records):
        if not records: return "<p>No records.</p>"
        keys = list(records[0])
        return "<table><thead><tr>" + "".join("<th>" + esc(k.replace('_',' ')) + "</th>" for k in keys) + "</tr></thead><tbody>" + "".join("<tr>" + "".join("<td>" + esc(row.get(k, "")) + "</td>" for k in keys) + "</tr>" for row in records) + "</tbody></table>"
    t, r, c = data["tryon"], data["recommendations"], data["categorization"]
    cards = [("Saved generation completion", str(t["technical_completion_percent"]) + "%", f"{t['completed_generation_jobs']}/{t['terminal_generation_jobs']} retained terminal jobs"),
             ("Saved recommendation coverage", str(r["wardrobe_coverage_percent"]) + "%", f"{r['distinct_items_used']}/{c['active_items']} active garments"),
             ("Feedback recorded", f"{r['recorded_likes']} likes / {r['recorded_dislikes']} dislikes", "selected feedback, not acceptance rate"),
             ("Software regression", f"{data['regression']['passed']}/{data['regression']['run']} passed", "not model-quality accuracy")]
    sections = "".join(f"<article><span>{esc(a)}</span><strong>{esc(b)}</strong><small>{esc(d)}</small></article>" for a,b,d in cards)
    body = f"""<h1>Drape &amp; Drop: measured pilot metrics</h1><p>22 November 2026 · Local read-only evaluation · No paid API requests</p>
    <div class='notice'>Historical development data and small, selected visual audits. These results are not a production benchmark, a model leaderboard or proof of fashion quality.</div><div class='cards'>{sections}</div>
    <h2>Try-on reliability</h2>{table(t['by_engine'])}<p>{esc(t['limitation'])}</p>
    <h3>Recorded failure causes</h3>{table([{'cause':k,'jobs':v} for k,v in t['failure_reasons'].items()])}
    <h2>Recorded end-to-end runtimes</h2>{table(data['recorded_end_to_end_times'])}<p>These four runs have different settings. They cannot establish provider speed rankings, a p95, or the current CPU-preparation latency.</p>
    <h2>Recommendations and compatibility</h2>{table([{'metric':k,'value':v} for k,v in r.items() if k not in ['limitation']])}<p>{esc(r['limitation'])}</p>
    <h3>Offline model ranking diagnostic</h3><pre>{esc(json.dumps(data['offline_ranking'],indent=2))}</pre>
    <h2>Categorization</h2>{table([{'metric':k,'value':v} for k,v in c.items() if k not in ['taxonomy_categories_present','limitation']])}<p>{esc(c['limitation'])}</p>
    <p>{c['visual_audit_matches']}/{c['visual_audit_assessed']} visually assessable saved labels agree with the AI review, but this is not independent human-labelled accuracy. The traditional patterned top is uncertain and excluded. Stored user corrections are not an error-rate denominator.</p><img src='wardrobe_audit.png' alt='Wardrobe images labelled by audit index only'>
    <h2>Illustrative try-on visual audit</h2><img src='tryon_audit.png' alt='Five selected historical try-on results'>
    {table(json.loads((OUT/'tryon_visual_audit.json').read_text()))}<pre>{esc(json.dumps(data['tryon_visual_pilot'],indent=2))}</pre>
    <h2>Not measured</h2><ul>{''.join('<li>'+esc(value)+'</li>' for value in data['unmeasured'])}</ul>
    <p>Ground-truth labels, representative cases, paired target photos and timestamped events are needed before reporting those values. See metrics.json and CSV files alongside this report for denominators and traceability.</p>"""
    css = "body{font:16px/1.6 system-ui;margin:0 auto;padding:40px;max-width:1300px;color:#182236;background:#f5f7fb}h1{font-size:34px}h2{margin-top:42px}.notice{padding:18px;background:#fff0ce;border-left:5px solid #b78120}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:25px 0}article{background:white;padding:20px;border-radius:10px}strong,small,span{display:block}strong{font-size:28px;margin:10px 0}small{color:#526177}table{border-collapse:collapse;width:100%;background:white;font-size:14px;display:block;overflow-x:auto}th,td{padding:10px 12px;border:1px solid #dbe1eb;text-align:left;vertical-align:top}th{background:#e8edf6}img{max-width:100%;background:white}pre{white-space:pre-wrap;background:white;padding:18px;border:1px solid #dbe1eb}"
    (OUT / "report.html").write_text("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Measured pilot metrics</title><style>" + css + "</style><body>" + body + "</body></html>", encoding="utf-8")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("OMP_NUM_THREADS", "2")
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    data = collect(); dump("metrics.json", data)
    print("Saved data snapshot collected", flush=True)
    data["regression"] = regression_tests(); print("Regression:", data["regression"], flush=True)
    try:
        data["offline_ranking"] = rank_diagnostic()
    except Exception as exc:
        data["offline_ranking"] = {"status": "unavailable", "reason": str(exc)}
    dump("metrics.json", data); render(data)
    print("Report:", OUT / "report.html", flush=True)
    print(json.dumps({k:data[k] for k in ['recommendations','tryon','offline_ranking']}, indent=2), flush=True)
