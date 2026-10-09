"""Runs the AI teammate's analyzer in the background and stores the result."""

import logging

from ai import analyzer

from .config import MEDIA_DIR
from .db import connect, dumps, now
from .services import bug_detail

log = logging.getLogger("buglens.ai")


def ai_enabled() -> bool:
    try:
        return bool(analyzer.is_enabled())
    except Exception:
        log.exception("analyzer.is_enabled failed")
        return False


def build_evidence(bug: dict) -> dict:
    keys = ["key", "title", "description", "category", "severity", "test_name", "agent", "steps",
            "expected", "actual", "verification", "occurrences", "project", "build"]
    ev = {k: bug.get(k) for k in keys}
    ev["logs"] = [{k: l[k] for k in ("ts", "level", "message", "data")} for l in bug["logs"]]
    ev["rechecks"] = [{k: r[k] for k in ("result", "attempts", "notes", "created_at")} for r in bug["rechecks"]]
    ev["screenshots"] = [str(MEDIA_DIR / a["filename"]) for a in bug["attachments"]]
    return ev


def mark_pending(conn, bug_id: int) -> bool:
    """Returns True if analysis should be scheduled."""
    status = "pending" if ai_enabled() else "disabled"
    conn.execute("UPDATE bugs SET ai_status = ?, updated_at = ? WHERE id = ?", (status, now(), bug_id))
    return status == "pending"


def run_analysis(bug_id: int) -> None:
    with connect() as conn:
        evidence = build_evidence(bug_detail(conn, bug_id))
    try:
        report, status = analyzer.analyze_bug(evidence), "done"
    except Exception as exc:  # store the failure; the UI shows it and allows retry
        log.exception("AI analysis failed for bug %s", bug_id)
        report, status = {"error": str(exc)}, "error"
    with connect() as conn:
        conn.execute("UPDATE bugs SET ai_status = ?, ai_report = ?, updated_at = ? WHERE id = ?",
                     (status, dumps(report), now(), bug_id))
