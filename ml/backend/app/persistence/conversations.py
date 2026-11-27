"""Per-operation connections and optimistic concurrency for conversation state."""
import json
import sqlite3
import uuid
from contextlib import contextmanager

from app.core.config import STORAGE_DIR

PATH = STORAGE_DIR / "phase3.db"


@contextmanager
def connection():
    conn = sqlite3.connect(PATH, timeout=10)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        yield conn
        conn.commit()
    finally:
        conn.close()


def init():
    with connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, version INTEGER NOT NULL,
            state TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(user_id);
        CREATE TABLE IF NOT EXISTS profiles (
            user_id TEXT PRIMARY KEY, data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outfit_feedback (
            user_id TEXT NOT NULL, outfit_id TEXT NOT NULL, liked INTEGER NOT NULL,
            PRIMARY KEY(user_id,outfit_id)
        );
        CREATE TABLE IF NOT EXISTS garment_measurements (
            user_id TEXT NOT NULL, item_id TEXT NOT NULL, data TEXT NOT NULL,
            PRIMARY KEY(user_id,item_id)
        );
        """)


def read(conversation_id, user_id):
    with connection() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id=? AND user_id=?", (conversation_id, user_id)).fetchone()
        if row is None:
            return None
        return row["version"], json.loads(row["state"])


def save(conversation_id, user_id, version, state):
    with connection() as conn:
        if conversation_id is None:
            conversation_id = uuid.uuid4().hex
            conn.execute("INSERT INTO conversations(id,user_id,version,state) VALUES(?,?,0,?)",
                         (conversation_id, user_id, json.dumps(state)))
        else:
            cursor = conn.execute("UPDATE conversations SET version=version+1,state=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND version=?",
                                  (json.dumps(state), conversation_id, user_id, version))
            if cursor.rowcount != 1:
                raise RuntimeError("Conversation changed during processing. Retry the message.")
        return conversation_id
