"""Domain logic: dedup, verification lifecycle, evidence storage."""

import base64
import binascii
import hashlib
import re
import sqlite3
import uuid

from fastapi import HTTPException

from .config import MAX_SCREENSHOT_BYTES, MEDIA_DIR
from .db import dumps, now, row_to_dict, rows_to_dicts
from .schemas import BugReport, LogEntry, RecheckReport, Screenshot

MIME_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}


def bug_key(bug_id: int) -> str:
    return f"BUG-{bug_id:03d}"


def get_or_create_project(conn: sqlite3.Connection, name: str) -> int:
    conn.execute("INSERT OR IGNORE INTO projects (name, created_at) VALUES (?, ?)", (name, now()))
    return conn.execute("SELECT id FROM projects WHERE name = ?", (name,)).fetchone()["id"]


def get_or_create_build(conn: sqlite3.Connection, project_id: int, version: str) -> int:
    conn.execute(
        "INSERT OR IGNORE INTO builds (project_id, version, created_at) VALUES (?, ?, ?)",
        (project_id, version, now()),
    )
    return conn.execute(
        "SELECT id FROM builds WHERE project_id = ? AND version = ?", (project_id, version)
    ).fetchone()["id"]


def require(conn: sqlite3.Connection, table: str, row_id: int) -> dict:
    row = row_to_dict(conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone())
    if row is None:
        raise HTTPException(404, f"{table[:-1]} {row_id} not found")
    return row


def add_event(conn, bug_id: int, type_: str, detail: str | None = None, run_id: int | None = None) -> None:
    conn.execute("INSERT INTO bug_events (bug_id, run_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)",
                 (bug_id, run_id, type_, detail, now()))


def add_logs(conn, run_id: int, entries: list[LogEntry], bug_id: int | None = None) -> None:
    conn.executemany(
        "INSERT INTO logs (run_id, bug_id, ts, level, message, data) VALUES (?, ?, ?, ?, ?, ?)",
        [(run_id, bug_id, e.ts or now(), e.level, e.message, dumps(e.data)) for e in entries],
    )


def store_image(raw: bytes, mime: str) -> str:
    if len(raw) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(413, "Screenshot too large")
    ext = MIME_EXT.get(mime)
    if ext is None:
        raise HTTPException(415, f"Unsupported image type {mime}")
    filename = f"{uuid.uuid4().hex}.{ext}"
    (MEDIA_DIR / filename).write_bytes(raw)
    return filename


def add_attachment(conn, filename: str, mime: str, caption: str | None, *,
                   run_id=None, bug_id=None, recheck_id=None) -> int:
    cur = conn.execute(
        "INSERT INTO attachments (run_id, bug_id, recheck_id, kind, filename, mime, caption, created_at)"
        " VALUES (?, ?, ?, 'screenshot', ?, ?, ?, ?)",
        (run_id, bug_id, recheck_id, filename, mime, caption, now()),
    )
    return cur.lastrowid


def add_screenshots(conn, shots: list[Screenshot], **links) -> None:
    for shot in shots:
        data = shot.data
        mime = shot.mime
        if m := re.match(r"data:([\w/+.-]+);base64,", data):
            mime, data = m.group(1), data[m.end():]
        try:
            raw = base64.b64decode(data, validate=True)
        except binascii.Error:
            raise HTTPException(422, "Screenshot data is not valid base64")
        add_attachment(conn, store_image(raw, mime), mime, shot.caption, **links)


def fingerprint_for(report: BugReport) -> str:
    if report.fingerprint:
        return report.fingerprint
    basis = f"{(report.category or '').lower()}|{report.title.strip().lower()}"
    return hashlib.sha1(basis.encode()).hexdigest()[:16]


def upsert_bug(conn, run: dict, report: BugReport) -> tuple[int, bool]:
    """Create a bug, or attach this occurrence to the existing bug with the same fingerprint."""
    fp = fingerprint_for(report)
    existing = conn.execute(
        "SELECT * FROM bugs WHERE project_id = ? AND fingerprint = ?", (run["project_id"], fp)
    ).fetchone()
    ts = now()

    if existing is None:
        cur = conn.execute(
            """INSERT INTO bugs (project_id, fingerprint, title, description, category, severity,
                   test_name, agent, confidence, steps, expected, actual, metadata, build_id,
                   first_run_id, last_run_id, found_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run["project_id"], fp, report.title, report.description, report.category,
             report.severity, report.test_name, report.agent or run["agent"], report.confidence,
             dumps(report.steps), report.expected, report.actual, dumps(report.metadata),
             run["build_id"], run["id"], run["id"], ts, ts),
        )
        bug_id, is_new = cur.lastrowid, True
        add_event(conn, bug_id, "found", f"Reported by {report.agent or run['agent'] or 'engine'}", run["id"])
    else:
        bug_id, is_new = existing["id"], False
        # A previously fixed bug that shows up again is a regression: reopen and re-verify.
        reopened = existing["status"] == "fixed"
        conn.execute(
            """UPDATE bugs SET occurrences = occurrences + 1, last_run_id = ?, build_id = ?,
                   actual = COALESCE(?, actual), updated_at = ?,
                   status = CASE WHEN ? THEN 'open' ELSE status END,
                   verification = CASE WHEN ? THEN 'unverified' ELSE verification END,
                   regression = CASE WHEN ? THEN 1 ELSE regression END,
                   fixed_in_run = CASE WHEN ? THEN NULL ELSE fixed_in_run END
               WHERE id = ?""",
            (run["id"], run["build_id"], report.actual, ts, reopened, reopened, reopened, reopened,
             bug_id),
        )
        if reopened:
            add_event(conn, bug_id, "regression", "Previously fixed bug reported again", run["id"])
        else:
            add_event(conn, bug_id, "seen_again", f"Occurrence #{existing['occurrences'] + 1}", run["id"])

    add_logs(conn, run["id"], report.logs, bug_id=bug_id)
    add_screenshots(conn, report.screenshots, run_id=run["id"], bug_id=bug_id)
    return bug_id, is_new


def apply_recheck(conn, bug: dict, report: RecheckReport) -> dict:
    """Verification lifecycle.

    reproduced     -> verification=confirmed (a fixed bug coming back is reopened as regression)
    not_reproduced -> if the bug was already confirmed, the fix is verified: status=fixed
                      otherwise the original finding could not be reproduced (flaky / false positive)
    """
    if report.run_id is not None:
        require(conn, "runs", report.run_id)
    ts = now()
    cur = conn.execute(
        "INSERT INTO rechecks (bug_id, run_id, result, attempts, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (bug["id"], report.run_id, report.result, report.attempts, report.notes, ts),
    )
    recheck_id = cur.lastrowid
    attempts = f" ({report.attempts} attempts)" if report.attempts else ""
    add_event(conn, bug["id"], f"recheck_{report.result}", (report.notes or "") + attempts, report.run_id)

    if report.result == "reproduced":
        if bug["status"] == "fixed":
            conn.execute(
                "UPDATE bugs SET verification='confirmed', status='open', regression=1, fixed_in_run=NULL,"
                " updated_at=? WHERE id=?", (ts, bug["id"]))
            add_event(conn, bug["id"], "regression", "Fixed bug reproduced again", report.run_id)
        else:
            conn.execute("UPDATE bugs SET verification='confirmed', updated_at=? WHERE id=?", (ts, bug["id"]))
            if bug["verification"] != "confirmed":
                add_event(conn, bug["id"], "confirmed", "Reproduced by recheck", report.run_id)
    elif bug["verification"] == "confirmed":
        conn.execute(
            "UPDATE bugs SET status='fixed', fixed_in_run=?, updated_at=? WHERE id=?",
            (report.run_id, ts, bug["id"]))
        add_event(conn, bug["id"], "fixed", "Confirmed bug no longer reproduces", report.run_id)
    else:
        conn.execute("UPDATE bugs SET verification='not_reproduced', updated_at=? WHERE id=?", (ts, bug["id"]))
        add_event(conn, bug["id"], "rejected", "Finding could not be reproduced; not counted as a bug",
                  report.run_id)

    log_run = report.run_id or bug["last_run_id"]
    add_logs(conn, log_run, report.logs, bug_id=bug["id"])
    add_screenshots(conn, report.screenshots, run_id=log_run, bug_id=bug["id"], recheck_id=recheck_id)
    return require(conn, "bugs", bug["id"])


# ---------- read models ----------

BUG_LIST_SQL = """
SELECT b.*, p.name AS project, bl.version AS build,
       (SELECT filename FROM attachments a WHERE a.bug_id = b.id ORDER BY a.id LIMIT 1) AS thumbnail
FROM bugs b
JOIN projects p ON p.id = b.project_id
LEFT JOIN builds bl ON bl.id = b.build_id
"""


def decorate_bug(bug: dict) -> dict:
    bug["key"] = bug_key(bug["id"])
    if bug.get("thumbnail"):
        bug["thumbnail"] = f"/media/{bug['thumbnail']}"
    return bug


def attachment_url(att: dict) -> dict:
    att["url"] = f"/media/{att['filename']}"
    return att


def bug_detail(conn, bug_id: int) -> dict:
    bug = row_to_dict(conn.execute(BUG_LIST_SQL + " WHERE b.id = ?", (bug_id,)).fetchone())
    if bug is None:
        raise HTTPException(404, f"bug {bug_id} not found")
    decorate_bug(bug)
    bug["attachments"] = [attachment_url(a) for a in rows_to_dicts(conn.execute(
        "SELECT * FROM attachments WHERE bug_id = ? ORDER BY id", (bug_id,)))]
    bug["logs"] = rows_to_dicts(conn.execute(
        "SELECT * FROM logs WHERE bug_id = ? ORDER BY ts, id", (bug_id,)))
    bug["rechecks"] = rows_to_dicts(conn.execute(
        "SELECT * FROM rechecks WHERE bug_id = ? ORDER BY id", (bug_id,)))
    bug["timeline"] = rows_to_dicts(conn.execute(
        """SELECT e.*, bl.version AS build FROM bug_events e
           LEFT JOIN runs r ON r.id = e.run_id LEFT JOIN builds bl ON bl.id = r.build_id
           WHERE e.bug_id = ? ORDER BY e.id""", (bug_id,)))
    bug["ai_usage"] = rows_to_dicts(conn.execute(
        "SELECT * FROM ai_usage WHERE bug_id = ? ORDER BY id", (bug_id,)))
    planted = conn.execute(
        """SELECT k.id, k.title, bl.version AS build FROM known_issues k JOIN builds bl ON bl.id = k.build_id
           WHERE k.project_id = ? AND k.fingerprint = ? ORDER BY k.id""",
        (bug["project_id"], bug["fingerprint"])).fetchall()
    bug["planted_in"] = [dict(r) for r in planted]
    bug["runs"] = rows_to_dicts(conn.execute(
        """SELECT DISTINCT r.id, r.status, r.started_at, bl.version AS build FROM runs r
           JOIN builds bl ON bl.id = r.build_id
           WHERE r.id IN (SELECT run_id FROM logs WHERE bug_id = ?
                          UNION SELECT run_id FROM attachments WHERE bug_id = ?
                          UNION SELECT run_id FROM rechecks WHERE bug_id = ?
                          UNION SELECT ?)
           ORDER BY r.id""", (bug_id, bug_id, bug_id, bug["first_run_id"])))
    return bug


RUN_LIST_SQL = """
SELECT r.*, p.name AS project, bl.version AS build,
       (SELECT COUNT(*) FROM bugs b WHERE b.first_run_id = r.id) AS new_bugs,
       (SELECT COUNT(*) FROM (SELECT bug_id FROM logs WHERE run_id = r.id AND bug_id IS NOT NULL
                              UNION SELECT bug_id FROM attachments WHERE run_id = r.id AND bug_id IS NOT NULL
                              UNION SELECT bug_id FROM rechecks WHERE run_id = r.id
                              UNION SELECT id FROM bugs WHERE first_run_id = r.id)) AS bugs_seen
FROM runs r
JOIN projects p ON p.id = r.project_id
JOIN builds bl ON bl.id = r.build_id
"""


def run_detail(conn, run_id: int) -> dict:
    run = row_to_dict(conn.execute(RUN_LIST_SQL + " WHERE r.id = ?", (run_id,)).fetchone())
    if run is None:
        raise HTTPException(404, f"run {run_id} not found")
    run["bugs"] = [decorate_bug(b) for b in rows_to_dicts(conn.execute(
        BUG_LIST_SQL + """ WHERE b.id IN (SELECT bug_id FROM logs WHERE run_id = ?
                                     UNION SELECT bug_id FROM attachments WHERE run_id = ?
                                     UNION SELECT bug_id FROM rechecks WHERE run_id = ?)
                              OR b.first_run_id = ? OR b.last_run_id = ?
                        ORDER BY b.id""", (run_id,) * 5))]
    run["logs"] = rows_to_dicts(conn.execute(
        "SELECT * FROM logs WHERE run_id = ? ORDER BY ts, id", (run_id,)))
    run["rechecks"] = rows_to_dicts(conn.execute(
        "SELECT * FROM rechecks WHERE run_id = ? ORDER BY id", (run_id,)))
    return run


def bug_run_ids_sql(bug_col: str = "b.id") -> str:
    """Subquery: every run in which a bug was reported, logged, screenshotted or rechecked."""
    return f"""(SELECT run_id FROM logs WHERE bug_id = {bug_col}
              UNION SELECT run_id FROM attachments WHERE bug_id = {bug_col}
              UNION SELECT run_id FROM rechecks WHERE bug_id = {bug_col} AND run_id IS NOT NULL
              UNION SELECT first_run_id FROM bugs WHERE id = {bug_col}
              UNION SELECT last_run_id FROM bugs WHERE id = {bug_col})"""
