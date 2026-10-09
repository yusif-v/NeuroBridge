"""Recorded API usage and local playtest telemetry; missing costs stay unknown."""
from datetime import datetime
from math import isfinite
from fastapi import APIRouter
from ..config import AI_PRICE_INPUT_PER_MTOK, AI_PRICE_OUTPUT_PER_MTOK
from ..db import DB, rows_to_dicts

router = APIRouter(prefix="/api/v1", tags=["usage"])


def _number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value) and value >= 0 else None


def _costs(values):
    known = [_number(v) for v in values]
    subtotal = round(sum(v for v in known if v is not None), 6)
    missing = sum(v is None for v in known)
    return {"cost_usd": None if missing else subtotal, "known_cost_usd": subtotal, "without_cost": missing}


def _seconds(run):
    # Historical worker timestamps include startup and replay, not pure gameplay.
    measured = _number((run["stats"] or {}).get("duration_s"))
    if measured is not None:
        return measured, "reported"
    start = run["job_started_at"] if run["job_id"] else run["started_at"]
    end = run["job_finished_at"] if run["job_id"] else run["finished_at"]
    if not start or not end:
        return None, None
    try:
        elapsed = (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds()
        return (elapsed, "timestamps") if elapsed >= 0 else (None, None)
    except (ValueError, TypeError):
        return None, None


@router.get("/usage")
def usage(conn: DB, project: str | None = None):
    pwhere, pparams = ("AND p.name = ?", [project]) if project else ("", [])
    calls = rows_to_dicts(conn.execute(
        f"""SELECT u.*, b.title, p.name AS project FROM ai_usage u
            JOIN bugs b ON b.id = u.bug_id JOIN projects p ON p.id = b.project_id
            WHERE 1=1 {pwhere} ORDER BY u.id DESC""", pparams))
    runs = rows_to_dicts(conn.execute(
        f"""SELECT r.*, p.name AS project, bl.version AS build, j.id AS job_id,
                   j.status AS job_status, j.decision_count, j.started_at AS job_started_at,
                   j.finished_at AS job_finished_at,
                   (SELECT COUNT(*) FROM bugs b WHERE b.first_run_id = r.id) AS new_bugs
            FROM runs r JOIN projects p ON p.id = r.project_id JOIN builds bl ON bl.id = r.build_id
            LEFT JOIN playtest_jobs j ON j.run_id = r.id
            WHERE 1=1 {pwhere} ORDER BY r.id""", pparams))
    confirmed = conn.execute(
        f"""SELECT COUNT(*) FROM bugs b JOIN projects p ON p.id = b.project_id
            WHERE b.verification = 'confirmed' AND b.status != 'false_positive' {pwhere}""", pparams).fetchone()[0]
    ok = [c for c in calls if c["status"] == "done"]
    latencies = [c["latency_ms"] for c in ok if c["latency_ms"] is not None]
    ai_cost = _costs([c["cost_usd"] for c in calls])
    by_model = {}
    for c in calls:
        model = c["model"] or "Not recorded"
        by_model.setdefault(model, []).append(c)

    per_run = []
    for r in runs:
        stats = r["stats"] or {}
        rcalls = [c for c in calls if c["run_id"] == r["id"]]
        duration, source = _seconds(r)
        # Local Laya uses no play API. Electricity/GPU hosting costs are unmetered.
        engine_cost = 0.0 if r["job_id"] else _number(stats.get("llm_cost_usd"))
        per_run.append({"run_id": r["id"], "project": r["project"], "build": r["build"],
                        "started_at": r["job_started_at"] if r["job_id"] else r["started_at"],
                        "status": r["job_status"] or r["status"], "local": bool(r["job_id"]),
                        "model": stats.get("model") or r["agent"],
                        "duration_s": duration, "duration_source": source,
                        "actions": r["decision_count"] if r["job_id"] else _number(stats.get("actions")),
                        "engine_cost_usd": engine_cost, "ai_cost_usd": _costs([c["cost_usd"] for c in rcalls])["cost_usd"],
                        "ai_calls": len(rcalls), "calls_without_tokens": sum(c["input_tokens"] is None or c["output_tokens"] is None for c in rcalls),
                        "input_tokens": sum(c["input_tokens"] or 0 for c in rcalls),
                        "output_tokens": sum(c["output_tokens"] or 0 for c in rcalls), "new_bugs": r["new_bugs"]})
    engine_cost = _costs([r["engine_cost_usd"] for r in per_run])
    total = _costs([c["cost_usd"] for c in calls] + [r["engine_cost_usd"] for r in per_run])
    durations = [r["duration_s"] for r in per_run if r["duration_s"] is not None]
    return {
        "ai": {"calls": len(calls), "succeeded": len(ok), "failed": len(calls) - len(ok),
               "bugs_analyzed": len({c["bug_id"] for c in ok}),
               "input_tokens": sum(c["input_tokens"] or 0 for c in calls),
               "output_tokens": sum(c["output_tokens"] or 0 for c in calls),
               "calls_without_tokens": sum(c["input_tokens"] is None or c["output_tokens"] is None for c in calls),
               "cost_usd": ai_cost["cost_usd"], "known_cost_usd": ai_cost["known_cost_usd"],
               "calls_without_cost": ai_cost["without_cost"],
               "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else None,
               "cost_per_analysis_usd": round(ai_cost["cost_usd"] / len(calls), 6) if calls and ai_cost["cost_usd"] is not None else None},
        "engine": {"runs": len(runs), "local_runs": sum(r["local"] for r in per_run),
                   "llm_cost_usd": engine_cost["cost_usd"], "runs_without_cost": engine_cost["without_cost"],
                   "known_cost_usd": engine_cost["known_cost_usd"],
                   "llm_input_tokens": int(sum(_number((r["stats"] or {}).get("llm_input_tokens")) or 0 for r in runs)),
                   "llm_output_tokens": int(sum(_number((r["stats"] or {}).get("llm_output_tokens")) or 0 for r in runs)),
                   "play_minutes": round(sum(durations) / 60, 2), "runs_with_duration": len(durations),
                   "actions": int(sum(r["actions"] or 0 for r in per_run)),
                   "runs_without_actions": sum(r["actions"] is None for r in per_run)},
        "unit": {"total_cost_usd": total["cost_usd"], "known_cost_usd": total["known_cost_usd"],
                 "cost_per_run_usd": round(total["cost_usd"] / len(runs), 6) if runs and total["cost_usd"] is not None else None,
                 "cost_per_confirmed_bug_usd": round(total["cost_usd"] / confirmed, 6) if confirmed and total["cost_usd"] is not None else None,
                 "confirmed_bugs": confirmed},
        "per_run": per_run,
        "by_model": [{"model": model, "calls": len(cs), "input_tokens": sum(c["input_tokens"] or 0 for c in cs),
                      "output_tokens": sum(c["output_tokens"] or 0 for c in cs),
                      "calls_without_tokens": sum(c["input_tokens"] is None or c["output_tokens"] is None for c in cs),
                      **_costs([c["cost_usd"] for c in cs])} for model, cs in sorted(by_model.items(), key=lambda item: -len(item[1]))],
        "recent_calls": calls[:20],
        "pricing": {"input_per_mtok_usd": AI_PRICE_INPUT_PER_MTOK, "output_per_mtok_usd": AI_PRICE_OUTPUT_PER_MTOK},
    }
