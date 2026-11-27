"""Gradio API entry point. Deploy only with the Supabase migration and secrets.

This CPU deployment adapter requires a real hosted/Supabase smoke test before use.
"""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("PHASE3_LLM_PROVIDER", "workers")
os.environ.pop("PHASE3_DEV_USER_ID", None)
os.environ.setdefault("GRADIO_ANALYTICS_ENABLED", "False")

import gradio as gr
from app.cloud.service import CloudEngine
from app.cloud.service import Supabase
from app.wardrobe.tagger import Tagger
from app.chat.stylist import create_stylist
from app.recommendations.scorer import PretrainedScorer
from app.pose.validation import MODEL as POSE_MODEL

if not POSE_MODEL.is_file():
    from scripts.setup_pose_validation import main as setup_pose
    setup_pose()

if not (ROOT / "storage/phase3_model/manifest.json").exists():
    from scripts.setup_models import main
    main()
# Hosted photo inference: WeShopAI, then IDM-VTON for one top on failure.
from app.tryon.hosted import infer as generate


engine = CloudEngine(Tagger(device="cpu"), PretrainedScorer(), create_stylist(), generate, photo_engine='weshop')


def tag(upload_path, token):
    with Supabase(token) as sb: return engine.tag(sb, upload_path)


def chat(request, token):
    with Supabase(token) as sb: return engine.chat(sb, json.loads(request))


def photo(person_path, item_ids, token):
    with Supabase(token) as sb: return engine.photo(sb, person_path, json.loads(item_ids))


def body_analysis(person_path, height_cm, token):
    with Supabase(token) as sb: return engine.body_analysis(sb, person_path, height_cm)


def confirm_body_analysis(reviewed_json, token):
    with Supabase(token) as sb: return engine.confirm_body_analysis(sb, json.loads(reviewed_json))


with gr.Blocks(analytics_enabled=False) as demo:
    gr.Markdown("# Drape & Drop inference API\nSupabase-authenticated prototype. Upload files to your private Supabase folder before calling these endpoints. No files are returned through Gradio storage.")
    token = gr.Textbox(label="Your Supabase access token", type="password")
    upload = gr.Textbox(label="Private garment object path")
    request = gr.Textbox(label="Chat request JSON", value='{"message":"Recommend three outfits","count":3}')
    person = gr.Textbox(label="Private person-photo object path")
    items = gr.Textbox(label="Garment IDs JSON", value="[]")
    height = gr.Number(label="Known height (cm)", value=170)
    reviewed = gr.Textbox(label="Reviewed body attributes JSON (confirmed=true)")
    output = gr.JSON()
    gr.Button("Categorize").click(tag, [upload, token], output, api_name="tag", concurrency_limit=1, concurrency_id="inference")
    gr.Button("Recommend").click(chat, [request, token], output, api_name="chat", concurrency_limit=1, concurrency_id="inference")
    gr.Button("Photo preview").click(photo, [person, items, token], output, api_name="photo", concurrency_limit=1, concurrency_id="inference")
    gr.Button("Estimate body attributes").click(body_analysis, [person, height, token], output, api_name="body_analysis", concurrency_limit=1, concurrency_id="inference")
    gr.Button("Save reviewed attributes").click(confirm_body_analysis, [reviewed, token], output, api_name="confirm_body_analysis", concurrency_limit=1, concurrency_id="inference")

if __name__ == "__main__":
    demo.queue(max_size=8).launch(show_error=False)
