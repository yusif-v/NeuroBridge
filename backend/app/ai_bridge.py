"""Runs the evidence analyzer in the background and stores the result."""

import logging
import time

from ai import analyzer

from .config import AI_PRICE_INPUT_PER_MTOK, AI_PRICE_OUTPUT_PER_MTOK, MEDIA_DIR
from .db import connect, dumps, now
from .services import add_event, bug_detail

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
    screenshots = [a for a in bug["attachments"] if a["mime"].startswith('image/')]
    ev["screenshots"] = [str(MEDIA_DIR / a["filename"]) for a in screenshots]
    ev["screenshot_refs"] = [{'ref': f'screenshot:{a["id"]}', 'caption': a['caption'] or 'Captured evidence'} for a in screenshots]
    return ev


def analyze_confirmed(bug_id: int) -> None:
    """Worker entry point; atomically claim analysis only after replay confirmation."""
    with connect() as conn:
        conn.execute('BEGIN IMMEDIATE')
        bug = conn.execute('SELECT verification,ai_status FROM bugs WHERE id=?', (bug_id,)).fetchone()
        if not bug or bug['verification'] != 'confirmed' or bug['ai_status'] in ('pending', 'done'):
            return
        scheduled = mark_pending(conn, bug_id)
    if scheduled:
        run_analysis(bug_id)


def mark_pending(conn, bug_id: int) -> bool:
    """Returns True if analysis should be scheduled."""
    status = "pending" if ai_enabled() else "disabled"
    conn.execute("UPDATE bugs SET ai_status = ?, updated_at = ? WHERE id = ?", (status, now(), bug_id))
    return status == "pending"


def _cost(usage: dict) -> float | None:
    if usage.get("cost_usd") is not None:
        return float(usage["cost_usd"])
    tin, tout = usage.get("input_tokens"), usage.get("output_tokens")
    if AI_PRICE_INPUT_PER_MTOK is not None and AI_PRICE_OUTPUT_PER_MTOK is not None and tin is not None and tout is not None:
        return (tin * AI_PRICE_INPUT_PER_MTOK + tout * AI_PRICE_OUTPUT_PER_MTOK) / 1_000_000
    return None


def run_analysis(bug_id: int) -> None:
    with connect() as conn:
        bug = bug_detail(conn, bug_id)
        run_logs = conn.execute('SELECT ts,level,message,data FROM logs WHERE run_id=? ORDER BY id DESC LIMIT 60',
                                (bug['last_run_id'],)).fetchall()
        job = conn.execute('SELECT filename,objective,rule FROM playtest_jobs WHERE run_id=?',
                           (bug['last_run_id'],)).fetchone()
    evidence = build_evidence(bug)
    evidence['run_logs'] = [dict(row) for row in reversed(run_logs)]
    if job:
        evidence['test_context'] = dict(job)
    started = time.perf_counter()
    try:
        report, status, error = analyzer.analyze_bug(evidence), "done", None
    except Exception as exc:  # store the failure; the UI shows it and allows retry
        log.exception("AI analysis failed for bug %s", bug_id)
        report, status, error = {"error": str(exc), "usage": getattr(exc, "usage", {})}, "error", str(exc)
    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = (report.pop("usage", None) if isinstance(report, dict) else None) or {}

    with connect() as conn:
        conn.execute("UPDATE bugs SET ai_status = ?, ai_report = ?, updated_at = ? WHERE id = ?",
                     (status, dumps(report), now(), bug_id))
        conn.execute(
            """INSERT INTO ai_usage (bug_id, run_id, model, input_tokens, output_tokens, cost_usd,
                   latency_ms, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (bug_id, bug["last_run_id"], usage.get("model") or (report or {}).get("model") or analyzer.settings()[2] or None,
             usage.get("input_tokens"), usage.get("output_tokens"), _cost(usage), latency_ms, status,
             error, now()))
        add_event(conn, bug_id, "ai_analyzed" if status == "done" else "ai_failed",
                  error or f"{usage.get('model') or 'model'} · {latency_ms} ms", bug["last_run_id"])
