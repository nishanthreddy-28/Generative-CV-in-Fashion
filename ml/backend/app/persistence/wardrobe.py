"""SQLite access. WAL mode, soft deletes, embeddings as BLOB."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

import numpy as np

from app.core.config import DB_PATH
from app.core.config import EMBED_DIM

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  image_path    TEXT NOT NULL,
  thumb_path    TEXT NOT NULL,
  category      TEXT NOT NULL,
  slot          TEXT NOT NULL,
  pattern       TEXT,
  formality     TEXT,
  season        TEXT,
  fit           TEXT,
  colors        TEXT NOT NULL,
  embedding     BLOB NOT NULL,
  confidence    REAL,
  margin        REAL,
  source        TEXT NOT NULL DEFAULT 'model',
  is_archived   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_user_slot
  ON items(user_id, slot, is_archived);
CREATE INDEX IF NOT EXISTS idx_items_user
  ON items(user_id, is_archived);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        if "upload_sha256" not in {row[1] for row in conn.execute("PRAGMA table_info(items)")}:
            conn.execute("ALTER TABLE items ADD COLUMN upload_sha256 TEXT")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS items_exact_upload ON items(user_id,upload_sha256) WHERE is_archived=0 AND upload_sha256 IS NOT NULL")
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# writes
# ---------------------------------------------------------------------------

def insert_item(conn: sqlite3.Connection, result, user_id: str, upload_sha256: str | None = None) -> dict:
    """result: pipeline.TagResult"""
    a = result.attributes
    row = {
        "id":         result.item_id,
        "user_id":    user_id,
        "created_at": _now(),
        "image_path": result.image_path,
        "thumb_path": result.thumb_path,
        "category":   result.category,
        "slot":       result.slot,
        "pattern":    a["pattern"]["value"],
        "formality":  a["formality"]["value"],
        "season":     a["season"]["value"],
        "fit":        a["fit"]["value"],
        "colors":     json.dumps(result.colors),
        "embedding":  result.embedding.astype(np.float32).tobytes(),
        "confidence": result.confidence,
        "margin":     result.margin,
        "source":     "model",
        "upload_sha256": upload_sha256,
    }
    conn.execute(
        """INSERT INTO items
           (id, user_id, created_at, image_path, thumb_path, category, slot,
            pattern, formality, season, fit, colors, embedding,
            confidence, margin, source, upload_sha256)
           VALUES
           (:id, :user_id, :created_at, :image_path, :thumb_path, :category,
            :slot, :pattern, :formality, :season, :fit, :colors, :embedding,
            :confidence, :margin, :source, :upload_sha256)""",
        row)
    conn.commit()
    return row


def update_item(conn: sqlite3.Connection, item_id: str, user_id: str,
                fields: dict) -> bool:
    """User correction. Never re-runs the model; embedding is untouched."""
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        return False

    fields["source"] = "user_corrected"
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    fields.update({"_id": item_id, "_user": user_id})

    cur = conn.execute(
        f"UPDATE items SET {sets} WHERE id = :_id AND user_id = :_user",
        fields)
    conn.commit()
    return cur.rowcount > 0


def archive_item(conn: sqlite3.Connection, item_id: str, user_id: str) -> bool:
    """Soft delete - saved outfits must never point at a missing item."""
    cur = conn.execute(
        "UPDATE items SET is_archived = 1 WHERE id = ? AND user_id = ?",
        (item_id, user_id))
    conn.commit()
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# reads
# ---------------------------------------------------------------------------

def get_item(conn: sqlite3.Connection, item_id: str, user_id: str):
    return conn.execute(
        "SELECT * FROM items WHERE id = ? AND user_id = ? AND is_archived = 0",
        (item_id, user_id)).fetchone()


def list_items(conn: sqlite3.Connection, user_id: str,
               slot: str | None = None) -> list[sqlite3.Row]:
    if slot:
        return conn.execute(
            """SELECT * FROM items
               WHERE user_id = ? AND slot = ? AND is_archived = 0
               ORDER BY created_at DESC""", (user_id, slot)).fetchall()
    return conn.execute(
        """SELECT * FROM items
           WHERE user_id = ? AND is_archived = 0
           ORDER BY created_at DESC""", (user_id,)).fetchall()


def list_embeddings(conn: sqlite3.Connection,
                    user_id: str) -> list[tuple[str, np.ndarray]]:
    """For G5 duplicate detection and, later, Phase 3."""
    rows = conn.execute(
        "SELECT id, embedding FROM items WHERE user_id = ? AND is_archived = 0",
        (user_id,)).fetchall()
    return [(r["id"], np.frombuffer(r["embedding"], dtype=np.float32))
            for r in rows]


def row_to_item(row: sqlite3.Row) -> dict:
    """sqlite3.Row -> dict matching schemas.Item."""
    return {
        "id":         row["id"],
        "user_id":    row["user_id"],
        "created_at": row["created_at"],
        "image_url":  f"/media/{row['image_path']}",
        "thumb_url":  f"/media/{row['thumb_path']}",
        "category":   row["category"],
        "slot":       row["slot"],
        "attributes": {
            "pattern":   row["pattern"],
            "formality": row["formality"],
            "season":    row["season"],
            "fit":       row["fit"],
        },
        "colors":     json.loads(row["colors"]),
        "confidence": row["confidence"],
        "margin":     row["margin"],
        "source":     row["source"],
    }
