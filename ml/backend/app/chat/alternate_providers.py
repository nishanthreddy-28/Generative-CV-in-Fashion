"""Explicit hosted text/vision experiments. Fixed hosts; no provider fallback."""
import base64
import json
import logging
import os
import re
import time

import httpx

from app.chat.stylist import LocalStylist
from app.chat.stylist import LLMUnavailable
from app.chat.stylist import groq_contact_sheet
from app.contracts.styling import Assessments
from app.contracts.styling import Interpretation
from app.contracts.styling import Intent
from app.chat.request_budget import GeminiBudget
from app.chat.request_budget import scope
from app.chat.request_budget import signature

WORKERS_MODELS = {"@cf/google/gemma-4-26b-a4b-it", "@cf/qwen/qwen3.8-27b"}
NVIDIA_DEFAULT_MODEL = "google/gemma-4-31b-it"


def compact_schema(value):
    """Drop display-only titles, retaining validation and field/property names."""
    if isinstance(value, list):
        return [compact_schema(item) for item in value]
    if isinstance(value, dict):
        return {key: ({name: compact_schema(child) for name, child in item.items()}
                      if key in {"properties", "$defs"} else compact_schema(item))
                for key, item in value.items() if key != "title"}
    return value


class AlternateStylist(LocalStylist):
    assessment_batch_size = 6

    def __init__(self, provider, model=None):
        self.provider = provider
        self.request_count = 0
        self.request_limit = None
        self.request_timeout = None
        self.last_usage = {}
        self.last_returned_model = None
        if provider == "workers":
            self.assessment_batch_size = 3
            self.assessment_batch_matches_count = True
            self.budget = GeminiBudget()
            self.model = model or os.getenv("PHASE3_WORKERS_MODEL", "@cf/google/gemma-4-26b-a4b-it")
            if self.model not in WORKERS_MODELS:
                raise ValueError("Choose a supported Workers AI vision model")
            self.endpoint_description = "Cloudflare Workers AI"
            self.key_variable = "CLOUDFLARE_API_TOKEN"
        elif provider == "nvidia":
            self.model = model or os.getenv("PHASE3_NVIDIA_MODEL", NVIDIA_DEFAULT_MODEL)
            self.endpoint_description = "NVIDIA hosted API catalogue"
            self.key_variable = "NVIDIA_API_KEY"
        elif provider == "siliconflow":
            self.model = model or os.getenv("PHASE3_SILICONFLOW_MODEL", "Qwen/Qwen3-VL-8B-Instruct")
            self.endpoint_description = "SiliconFlow international API"
            self.key_variable = "SILICONFLOW_API_KEY"
        else:
            raise ValueError("Unsupported experimental stylist provider")
        if not re.fullmatch(r"[@a-zA-Z0-9_./:-]{1,150}", self.model):
            raise ValueError("Invalid model ID")

    def endpoint(self):
        if self.provider == "workers":
            account = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
            if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
                raise LLMUnavailable("Set a valid CLOUDFLARE_ACCOUNT_ID on the backend.")
            return f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1/chat/completions"
        if self.provider == "nvidia":
            return "https://integrate.api.nvidia.com/v1/chat/completions"
        return "https://api.siliconflow.com/v1/chat/completions"

    def call(self, schema, prompt, payload, images=None):
        if self.provider != "workers":
            return self._uncached_call(schema, prompt, payload, images)
        key = os.getenv(self.key_variable, "").strip()
        if not key:
            return self._uncached_call(schema, prompt, payload, images)
        namespace = scope(self.provider + self.endpoint() + self.model, key)
        identifier = signature(namespace, schema, prompt, payload, images)
        lock = self.budget.request_lock(identifier)
        if not lock.acquire(timeout=2):
            raise LLMUnavailable("A matching stylist request is processing. Please wait before resubmitting.")
        try:
            self.last_usage, self.last_returned_model = {}, None
            cached = self.budget.get(identifier)
            if cached is not None:
                logging.getLogger("uvicorn.error").info("Stylist provider=%s model=%s stage=%s cache=hit", self.provider, self.model, "outfit photo assessment" if images else "chat interpretation")
                return schema.model_validate_json(cached)
            result = self._uncached_call(schema, prompt, payload, images)
            cacheable = True
            if schema is Assessments and "candidates" in payload:
                actual = [item.candidate_id for item in result.assessments]
                cacheable = len(actual) == len(set(actual)) and set(actual) == {item["candidate_id"] for item in payload["candidates"]}
            if schema is Interpretation and not result.needs_clarification and all(name in payload for name in ("message", "previous", "catalog", "last_outfit_ids")):
                cacheable = self.selection_evidence_valid(result, payload["message"], Intent.model_validate(payload["previous"]), payload["catalog"], payload["last_outfit_ids"])
            if cacheable:
                self.budget.put(identifier, result.model_dump_json(), 900)
            return result
        finally:
            lock.release()

    def _uncached_call(self, schema, prompt, payload, images=None):
        started = time.monotonic()
        stage = "outfit photo assessment" if images else "chat interpretation"
        self.last_usage, self.last_returned_model = {}, None
        key = os.getenv(self.key_variable, "").strip()
        if not key:
            raise LLMUnavailable(f"Set {self.key_variable} in backend secrets to test {self.endpoint_description}.")
        if self.provider == "siliconflow" and os.getenv("SILICONFLOW_FREE_TEST_CONFIRMED") != "1":
            raise LLMUnavailable("SiliconFlow test is blocked until zero-cost access is confirmed. Verify model pricing/free credits and disable postpaid billing before setting SILICONFLOW_FREE_TEST_CONFIRMED=1.")
        endpoint = self.endpoint()
        if schema is Assessments and images:
            images = [groq_contact_sheet(images)]
            prompt = prompt.replace("one per candidate in matching order", "stacked vertically in one labelled image, one row per candidate in matching order")
        try:
            content = [{"type": "text", "text": json.dumps(payload, separators=(",", ":"))}]
            for encoded in images or []:
                base64.b64decode(encoded, validate=True)
                content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + encoded}})
            # Pydantic and the inherited ownership/evidence guards validate every
            # answer, including models without documented server-side JSON mode.
            rules = prompt
            if schema is Assessments:
                rules += " Keep each reason to one concise sentence of at most 35 words; preserve uncertainty and the reason for any rejection."
            rules += "\nReturn only a JSON object, without Markdown fences or commentary, satisfying this JSON Schema:\n" + json.dumps(compact_schema(schema.model_json_schema()), separators=(",", ":"))
            body = {"model": self.model, "messages": [{"role": "system", "content": rules},
                {"role": "user", "content": content}], "response_format": {"type": "json_object"},
                "temperature": 0, "max_tokens": 2048, "stream": False}
            if self.provider == "workers":
                body["reasoning_effort"] = "none" if "gemma-4" in self.model else "low"
                body.pop("max_tokens")
                body["max_completion_tokens"] = 4096
                if "gemma-4" in self.model:
                    body["chat_template_kwargs"] = {"enable_thinking": False}
            elif self.provider == "nvidia":
                body["chat_template_kwargs"] = {"enable_thinking": False}
                if self.model == "google/gemma-4-31b-it":
                    # NVIDIA's Gemma endpoint does not document response_format.
                    # Request JSON in the prompt and retain strict validation.
                    body.pop("response_format")
            if self.request_limit is not None and self.request_count >= self.request_limit:
                raise LLMUnavailable("Comparison request budget reached; no more requests were sent.")
            self.request_count += 1
            read_timeout = self.request_timeout if self.request_timeout is not None else (120 if images else 60)
            with httpx.Client(timeout=httpx.Timeout(read_timeout, connect=10), follow_redirects=False) as client:
                response = client.post(endpoint, headers={"Authorization": "Bearer " + key}, json=body)
            if response.status_code == 429:
                raise LLMUnavailable(f"{self.endpoint_description} quota/rate limit reached (HTTP 429). No retry or fallback was made.")
            if response.status_code in {401, 403}:
                raise LLMUnavailable(f"{self.endpoint_description} refused access (HTTP {response.status_code}). Check token permissions and model eligibility.")
            if response.status_code == 402:
                raise LLMUnavailable(f"{self.endpoint_description} requires a balance or paid access (HTTP 402). No paid fallback was made.")
            if response.status_code == 410:
                raise LLMUnavailable(f"{self.endpoint_description} reports the selected model is unavailable/gone (HTTP 410). Check its current hosted model catalogue. No retry or fallback was made.")
            if response.status_code >= 400:
                raise LLMUnavailable(f"{self.endpoint_description} returned HTTP {response.status_code}; check model availability and request support.")
            result = response.json()
            choices = result["choices"]
            if len(choices) != 1 or choices[0].get("finish_reason") != "stop":
                logging.getLogger(__name__).warning("Provider incomplete answer: provider=%s finish=%s", self.provider, choices[0].get("finish_reason") if choices else "missing")
                raise LLMUnavailable(f"{self.endpoint_description} returned an incomplete answer.")
            value = schema.model_validate_json(choices[0]["message"]["content"])
            usage = result.get("usage", {})
            if isinstance(usage, dict):
                self.last_usage = {name: usage[name] for name in ("prompt_tokens", "completion_tokens", "total_tokens") if type(usage.get(name)) is int}
            returned = result.get("model")
            if isinstance(returned, str) and re.fullmatch(r"[@a-zA-Z0-9_./:-]{1,150}", returned) and key not in returned:
                self.last_returned_model = returned
            return value
        except LLMUnavailable:
            raise
        except httpx.RequestError as exc:
            raise LLMUnavailable(f"{self.endpoint_description} connection failed or timed out during {stage} ({type(exc).__name__}). No automatic retry was made.") from exc
        except (ValueError, KeyError, TypeError, AttributeError, IndexError) as exc:
            raise LLMUnavailable(f"{self.endpoint_description} returned invalid structured output.") from exc
        finally:
            logging.getLogger("uvicorn.error").info("Stylist provider=%s model=%s stage=%s seconds=%.3f input_tokens=%s output_tokens=%s", self.provider, self.model, stage, time.monotonic() - started, self.last_usage.get("prompt_tokens", "unknown"), self.last_usage.get("completion_tokens", "unknown"))
