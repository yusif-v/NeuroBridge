"""AI + engine LLM usage and cost (feasibility numbers)."""

from fastapi import APIRouter

from ..config import AI_PRICE_INPUT_PER_MTOK, AI_PRICE_OUTPUT_PER_MTOK
from ..db import DB, rows_to_dicts

router = APIRouter(prefix="/api/v1", tags=["usage"])


def _num(stats: dict | None, key: str) -> float:
    value = (stats or {}).get(key)
    return float(value) if isinstance(value, (int, float)) else 0.0


@router.get("/usage")
def usage(conn: DB, project: str | None = None):
    pwhere, pparams = ("AND p.name = ?", [project]) if project else ("", [])

    calls = rows_to_dicts(conn.execute(
        f"""SELECT u.*, b.title, p.name AS project FROM ai_usage u
            JOIN bugs b ON b.id = u.bug_id JOIN projects p ON p.id = b.project_id
            WHERE 1=1 {pwhere} ORDER BY u.id DESC""", pparams))
    runs = rows_to_dicts(conn.execute(
        f"""SELECT r.id, r.stats, r.started_at, bl.version AS build,
                   (SELECT COUNT(*) FROM bugs b WHERE b.first_run_id = r.id) AS new_bugs
            FROM runs r JOIN projects p ON p.id = r.project_id JOIN builds bl ON bl.id = r.build_id
            WHERE 1=1 {pwhere} ORDER BY r.id""", pparams))
    confirmed = conn.execute(
        f"""SELECT COUNT(*) FROM bugs b JOIN projects p ON p.id = b.project_id
            WHERE b.verification = 'confirmed' AND b.status != 'false_positive' {pwhere}""", pparams).fetchone()[0]

    ok = [c for c in calls if c["status"] == "done"]
    ai_cost = sum(c["cost_usd"] or 0 for c in calls)
    latencies = [c["latency_ms"] for c in ok if c["latency_ms"] is not None]
    engine_cost = sum(_num(r["stats"], "llm_cost_usd") for r in runs)
    total_cost = ai_cost + engine_cost

    ai_by_run: dict[int, dict] = {}
    for c in calls:
        slot = ai_by_run.setdefault(c["run_id"], {"cost": 0.0, "calls": 0})
        slot["cost"] += c["cost_usd"] or 0
        slot["calls"] += 1

    by_model: dict[str, dict] = {}
    for c in calls:
        m = by_model.setdefault(c["model"] or "unknown", {"model": c["model"] or "unknown", "calls": 0,
                                                           "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
        m["calls"] += 1
        m["input_tokens"] += c["input_tokens"] or 0
        m["output_tokens"] += c["output_tokens"] or 0
        m["cost_usd"] += c["cost_usd"] or 0

    return {
        "ai": {
            "calls": len(calls),
            "succeeded": len(ok),
            "failed": len(calls) - len(ok),
            "bugs_analyzed": len({c["bug_id"] for c in ok}),
            "input_tokens": sum(c["input_tokens"] or 0 for c in calls),
            "output_tokens": sum(c["output_tokens"] or 0 for c in calls),
            "cost_usd": round(ai_cost, 6),
            "calls_without_cost": sum(c["cost_usd"] is None for c in calls),
            "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else None,
            "cost_per_analysis_usd": round(ai_cost / len(ok), 6) if ok else None,
        },
        "engine": {
            "runs": len(runs),
            "llm_cost_usd": round(engine_cost, 6),
            "llm_input_tokens": int(sum(_num(r["stats"], "llm_input_tokens") for r in runs)),
            "llm_output_tokens": int(sum(_num(r["stats"], "llm_output_tokens") for r in runs)),
            "play_minutes": round(sum(_num(r["stats"], "duration_s") for r in runs) / 60, 2),
            "actions": int(sum(_num(r["stats"], "actions") for r in runs)),
        },
        "unit": {
            "total_cost_usd": round(total_cost, 6),
            "cost_per_run_usd": round(total_cost / len(runs), 6) if runs else None,
            "cost_per_confirmed_bug_usd": round(total_cost / confirmed, 6) if confirmed else None,
            "confirmed_bugs": confirmed,
        },
        "per_run": [{"run_id": r["id"], "build": r["build"], "started_at": r["started_at"],
                     "engine_cost_usd": round(_num(r["stats"], "llm_cost_usd"), 6),
                     "ai_cost_usd": round(ai_by_run.get(r["id"], {}).get("cost", 0), 6),
                     "ai_calls": ai_by_run.get(r["id"], {}).get("calls", 0),
                     "new_bugs": r["new_bugs"]} for r in runs],
        "by_model": sorted(by_model.values(), key=lambda m: -m["calls"]),
        "recent_calls": calls[:20],
        "pricing": {"input_per_mtok_usd": AI_PRICE_INPUT_PER_MTOK, "output_per_mtok_usd": AI_PRICE_OUTPUT_PER_MTOK},
    }
