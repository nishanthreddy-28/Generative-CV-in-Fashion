---
title: Drape Drop Prototype
emoji: 👕
colorFrom: purple
colorTo: gray
sdk: gradio
app_file: deployment/cloud/space.py
python_version: '3.12'
pinned: false
---

Supabase-authenticated CPU prototype; no local generation GPU required.
Secrets: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CLOUDFLARE_ACCOUNT_ID,
CLOUDFLARE_API_TOKEN. Optional HF_TOKEN for the hosted try-on demos.
Variables: PHASE3_LLM_PROVIDER=workers and
PHASE3_WORKERS_MODEL=@cf/google/gemma-4-26b-a4b-it.
Apply deployment/supabase/001_prototype.sql to your project first.

The Space downloads several GB of public pretrained assets at startup.
The photo pipeline and human-parser licensing must be reviewed before commercial use.
This adapter has local contract tests. A real hosted CPU/session/storage smoke
test is still required; local tests do not establish deployment readiness.
