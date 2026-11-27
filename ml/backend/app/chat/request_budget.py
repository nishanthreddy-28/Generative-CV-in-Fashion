"""Bounded, process-local validated-response cache and Gemini daily-quota guard."""
from collections import OrderedDict
from datetime import datetime, time as day_time, timedelta
import hashlib
import json
import threading
import time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def scope(model, api_key):
    return hashlib.sha256((model + "\0" + api_key).encode()).hexdigest()


def signature(namespace, schema, prompt, payload, images):
    digest = hashlib.sha256(namespace.encode())
    digest.update(json.dumps([schema.model_json_schema(), prompt, payload, images or []], sort_keys=True, separators=(",", ":")).encode())
    return digest.hexdigest()


def next_daily_reset():
    try:
        pacific = ZoneInfo("America/Los_Angeles")
        now = datetime.now(pacific)
        return datetime.combine(now.date() + timedelta(days=1), day_time(), pacific).timestamp()
    except ZoneInfoNotFoundError:
        # Minimal Windows installs may lack IANA timezone data. Recheck in an
        # hour rather than invent a daily reset time or block indefinitely.
        return time.time() + 3600


class GeminiBudget:
    def __init__(self, capacity=256):
        self.capacity = capacity
        self.entries = OrderedDict()
        self.blocks = OrderedDict()
        self.lock = threading.Lock()
        # Bound lock memory while coalescing simultaneous identical requests.
        self.requests = [threading.Lock() for _ in range(32)]

    def request_lock(self, identifier):
        return self.requests[int(identifier[:8], 16) % len(self.requests)]

    def get(self, identifier):
        with self.lock:
            value = self.entries.get(identifier)
            if value is None:
                return None
            expires, result = value
            if expires <= time.time():
                self.entries.pop(identifier, None)
                return None
            self.entries.move_to_end(identifier)
            return result

    def put(self, identifier, result, ttl):
        with self.lock:
            self.entries[identifier] = (time.time() + ttl, result)
            self.entries.move_to_end(identifier)
            while len(self.entries) > self.capacity:
                self.entries.popitem(last=False)

    def blocked(self, namespace):
        with self.lock:
            value = self.blocks.get(namespace)
            if value is None:
                return None
            expires, message = value
            if expires <= time.time():
                self.blocks.pop(namespace, None)
                return None
            return message

    def block_daily(self, namespace, message):
        with self.lock:
            self.blocks[namespace] = (next_daily_reset(), message)
            self.blocks.move_to_end(namespace)
            while len(self.blocks) > 32:
                self.blocks.popitem(last=False)
