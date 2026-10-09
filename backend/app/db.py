"""SQLite storage. One connection per request; JSON columns stored as TEXT."""

import json
import sqlite3
from contextlib import contextmanager
from typing import Annotated
from datetime import datetime, timezone

from fastapi import Depends

from .config import DATA_DIR, DB_PATH, MEDIA_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builds (
    id          INTEGER PRIMARY KEY,
    project_id  INTEGER NOT NULL REFERENCES projects(id),
    version     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE (project_id, version)
);

CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY,
    project_id   INTEGER NOT NULL REFERENCES projects(id),
    build_id     INTEGER NOT NULL REFERENCES builds(id),
    agent        TEXT,
    status       TEXT NOT NULL DEFAULT 'running',   -- running | completed | failed
    summary      TEXT,
    stats        TEXT,                              -- JSON
    metadata     TEXT,                              -- JSON
    started_at   TEXT NOT NULL,
    finished_at  TEXT
);

CREATE TABLE IF NOT EXISTS bugs (
    id            INTEGER PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    fingerprint   TEXT NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    category      TEXT,
    severity      TEXT NOT NULL DEFAULT 'medium',   -- critical | high | medium | low
    status        TEXT NOT NULL DEFAULT 'open',     -- open | ticketed | fixed | ignored
    verification  TEXT NOT NULL DEFAULT 'unverified', -- unverified | confirmed | not_reproduced
    regression    INTEGER NOT NULL DEFAULT 0,
    test_name     TEXT,
    agent         TEXT,
    confidence    REAL,
    steps         TEXT,                             -- JSON list
    expected      TEXT,
    actual        TEXT,
    metadata      TEXT,                             -- JSON
    build_id      INTEGER REFERENCES builds(id),    -- build where last seen
    first_run_id  INTEGER REFERENCES runs(id),
    last_run_id   INTEGER REFERENCES runs(id),
    fixed_in_run  INTEGER REFERENCES runs(id),
    occurrences   INTEGER NOT NULL DEFAULT 1,
    ai_status     TEXT NOT NULL DEFAULT 'none',     -- none | pending | done | error | disabled
    ai_report     TEXT,                             -- JSON
    found_at      TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE (project_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS rechecks (
    id          INTEGER PRIMARY KEY,
    bug_id      INTEGER NOT NULL REFERENCES bugs(id),
    run_id      INTEGER REFERENCES runs(id),
    result      TEXT NOT NULL,                      -- reproduced | not_reproduced
    attempts    INTEGER,
    notes       TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
    id          INTEGER PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES runs(id),
    bug_id      INTEGER REFERENCES bugs(id),
    ts          TEXT NOT NULL,
    level       TEXT NOT NULL DEFAULT 'info',
    message     TEXT NOT NULL,
    data        TEXT                                -- JSON
);

CREATE TABLE IF NOT EXISTS attachments (
    id          INTEGER PRIMARY KEY,
    run_id      INTEGER REFERENCES runs(id),
    bug_id      INTEGER REFERENCES bugs(id),
    recheck_id  INTEGER REFERENCES rechecks(id),
    kind        TEXT NOT NULL DEFAULT 'screenshot',
    filename    TEXT NOT NULL,
    mime        TEXT NOT NULL,
    caption     TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_run ON logs(run_id);
CREATE INDEX IF NOT EXISTS idx_logs_bug ON logs(bug_id);
CREATE INDEX IF NOT EXISTS idx_att_bug ON attachments(bug_id);
CREATE INDEX IF NOT EXISTS idx_rechecks_bug ON rechecks(bug_id);
"""

JSON_COLUMNS = {"stats", "metadata", "steps", "ai_report", "data"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def dumps(value):
    return None if value is None else json.dumps(value)


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    out = dict(row)
    for key in JSON_COLUMNS & out.keys():
        if out[key] is not None:
            out[key] = json.loads(out[key])
    return out


def rows_to_dicts(rows) -> list[dict]:
    return [row_to_dict(r) for r in rows]


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db():
    """FastAPI dependency."""
    with connect() as conn:
        yield conn


# scope="function" commits BEFORE the response is sent; the default ("request") commits after,
# so a fast client could see a 201 and then 404 on the row it just created.
DB = Annotated[sqlite3.Connection, Depends(get_db, scope="function")]
