"""
SQLite-backed persistent cache for AI commentary.
Keyed by (ticker, timeframe). Stores commentary text, when it was generated,
and a hash of the underlying zone/signal data so we only regenerate when data changes.
"""

import sqlite3
import os
from datetime import datetime, timezone

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "commentary.db")
_DB_PATH = os.path.normpath(_DB_PATH)


def _conn() -> sqlite3.Connection:
    return sqlite3.connect(_DB_PATH)


def init_db() -> None:
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS commentary_cache (
                ticker       TEXT NOT NULL,
                timeframe    TEXT NOT NULL,
                commentary   TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                data_hash    TEXT NOT NULL,
                PRIMARY KEY (ticker, timeframe)
            )
        """)
        con.commit()


def get_cached(ticker: str, timeframe: str) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT commentary, generated_at, data_hash FROM commentary_cache WHERE ticker=? AND timeframe=?",
            (ticker, timeframe),
        ).fetchone()
    if row is None:
        return None
    return {"commentary": row[0], "generated_at": row[1], "data_hash": row[2]}


def set_cached(ticker: str, timeframe: str, commentary: str, data_hash: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as con:
        con.execute(
            """
            INSERT INTO commentary_cache (ticker, timeframe, commentary, generated_at, data_hash)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ticker, timeframe) DO UPDATE SET
                commentary   = excluded.commentary,
                generated_at = excluded.generated_at,
                data_hash    = excluded.data_hash
            """,
            (ticker, timeframe, commentary, now, data_hash),
        )
        con.commit()
