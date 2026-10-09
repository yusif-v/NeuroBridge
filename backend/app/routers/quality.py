"""QA scorecard: planted-bug detection, false positives, recheck noise filtering, manual vs automated."""

from fastapi import APIRouter, HTTPException, Query

from ..config import MANUAL_TESTER_HOURLY_USD
from ..db import DB, now, rows_to_dicts
from ..schemas import KnownIssueBatch, ManualSession
from ..services import bug_key, get_or_create_build, get_or_create_project, require

router = APIRouter(prefix="/api/v1", tags=["quality"])

# Event types that mean "the engine observed this bug in that run".
OBSERVED = "('found', 'seen_again', 'regression', 'recheck_reproduced')"


def save_known_issues(conn, body: KnownIssueBatch, source: str = "manual") -> dict:
    project_id = get_or_create_project(conn, body.project)
    build_id = get_or_create_build(conn, project_id, body.build)
    if body.replace:
        conn.execute("DELETE FROM known_issues WHERE build_id = ?", (build_id,))
    for ki in body.issues:
        conn.execute(
            """INSERT INTO known_issues (project_id, build_id, fingerprint, title, category, severity, notes,
                   source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (build_id, fingerprint) DO UPDATE SET title = excluded.title,
                   category = excluded.category, severity = excluded.severity, notes = excluded.notes""",
            (project_id, build_id, ki.fingerprint, ki.title, ki.category, ki.severity, ki.notes,
             source, now()))
    return {"build_id": build_id, "count": len(body.issues)}


@router.get("/known-issues")
def list_known_issues(conn: DB, project: str | None = None, build: str | None = None):
    where, params = ["1=1"], []
    if project:
        where.append("p.name = ?"); params.append(project)
    if build:
        where.append("bl.version = ?"); params.append(build)
    return rows_to_dicts(conn.execute(
        f"""SELECT k.*, p.name AS project, bl.version AS build FROM known_issues k
            JOIN projects p ON p.id = k.project_id JOIN builds bl ON bl.id = k.build_id
            WHERE {' AND '.join(where)} ORDER BY bl.id, k.id""", params))


@router.post("/known-issues", status_code=201)
def add_known_issues(conn: DB, body: KnownIssueBatch):
    return save_known_issues(conn, body)


@router.delete("/known-issues/{issue_id}", status_code=204)
def delete_known_issue(conn: DB, issue_id: int):
    require(conn, "known_issues", issue_id)
    conn.execute("DELETE FROM known_issues WHERE id = ?", (issue_id,))


@router.get("/manual-sessions")
def list_manual_sessions(conn: DB, project: str | None = None):
    where, params = ("WHERE p.name = ?", [project]) if project else ("", [])
    return rows_to_dicts(conn.execute(
        f"""SELECT m.*, p.name AS project, bl.version AS build FROM manual_sessions m
            JOIN projects p ON p.id = m.project_id LEFT JOIN builds bl ON bl.id = m.build_id
            {where} ORDER BY m.id DESC""", params))


@router.post("/manual-sessions", status_code=201)
def add_manual_session(conn: DB, body: ManualSession):
    project_id = get_or_create_project(conn, body.project)
    build_id = get_or_create_build(conn, project_id, body.build) if body.build else None
    cur = conn.execute(
        """INSERT INTO manual_sessions (project_id, build_id, tester, duration_min, bugs_found, planted_found,
               false_positives, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (project_id, build_id, body.tester, body.duration_min, body.bugs_found, body.planted_found,
         body.false_positives, body.notes, now()))
    return {"id": cur.lastrowid}


@router.delete("/manual-sessions/{session_id}", status_code=204)
def delete_manual_session(conn: DB, session_id: int):
    require(conn, "manual_sessions", session_id)
    conn.execute("DELETE FROM manual_sessions WHERE id = ?", (session_id,))


# ---------- scorecard ----------

def _in(ids) -> str:
    return "(" + ",".join("?" * len(ids)) + ")"


def _run_seconds(run: dict) -> float:
    stats = run.get("stats") or {}
    if isinstance(stats.get("duration_s"), (int, float)):
        return float(stats["duration_s"])
    return 0.0


def evaluate(conn, project_id: int, build_ids: list[int]) -> dict:
    if not build_ids:
        return {}
    bin_ = _in(build_ids)

    known = rows_to_dicts(conn.execute(
        f"""SELECT k.*, bl.version AS build FROM known_issues k JOIN builds bl ON bl.id = k.build_id
            WHERE k.build_id IN {bin_} ORDER BY bl.id, k.id""", build_ids))

    # Bugs the engine observed (reported or reproduced) in these builds.
    bugs = rows_to_dicts(conn.execute(
        f"""SELECT b.* FROM bugs b WHERE b.project_id = ? AND EXISTS (
                SELECT 1 FROM bug_events e JOIN runs r ON r.id = e.run_id
                WHERE e.bug_id = b.id AND e.type IN {OBSERVED} AND r.build_id IN {bin_})
            ORDER BY b.id""", [project_id, *build_ids]))
    planted_fps = {k["fingerprint"] for k in known}

    def observed_in_build(bug_id: int, build_id: int) -> bool:
        return conn.execute(
            f"""SELECT 1 FROM bug_events e JOIN runs r ON r.id = e.run_id
                WHERE e.bug_id = ? AND e.type IN {OBSERVED} AND r.build_id = ? LIMIT 1""",
            (bug_id, build_id)).fetchone() is not None

    by_fp = {b["fingerprint"]: b for b in rows_to_dicts(conn.execute(
        "SELECT * FROM bugs WHERE project_id = ?", (project_id,)))}

    planted = []
    for k in known:
        bug = by_fp.get(k["fingerprint"])
        if bug is None or not observed_in_build(bug["id"], k["build_id"]):
            # Found but rejected by recheck in this build counts as a miss, with the reason shown.
            outcome = "rejected_by_recheck" if bug and bug["verification"] == "not_reproduced" else "missed"
        elif bug["verification"] == "confirmed":
            outcome = "detected"
        elif bug["verification"] == "not_reproduced":
            outcome = "rejected_by_recheck"
        else:
            outcome = "awaiting_recheck"
        planted.append({**k, "outcome": outcome, "bug_id": bug["id"] if bug else None,
                        "bug_key": bug_key(bug["id"]) if bug else None})

    def summary(b):
        return {"id": b["id"], "key": bug_key(b["id"]), "title": b["title"], "severity": b["severity"],
                "category": b["category"], "status": b["status"], "verification": b["verification"]}

    confirmed = [b for b in bugs if b["verification"] == "confirmed"]
    false_pos = [b for b in bugs if b["status"] == "false_positive"]
    true_found = [b for b in confirmed if b["status"] != "false_positive"]
    unplanned = [b for b in true_found if b["fingerprint"] not in planted_fps]
    noise = [b for b in bugs if b["verification"] == "not_reproduced"]
    pending = [b for b in bugs if b["verification"] == "unverified"]
    detected = sum(p["outcome"] == "detected" for p in planted)
    raw_findings = len(bugs)

    return {
        "planted": len(planted),
        "detected": detected,
        "missed": len(planted) - detected,
        "detection_rate": detected / len(planted) if planted else None,
        "reported_confirmed": len(confirmed),
        "false_positives": len(false_pos),
        "precision": len(true_found) / len(confirmed) if confirmed else None,
        "unplanned_findings": len(unplanned),
        "noise_filtered": len(noise),
        "awaiting_recheck": len(pending),
        "raw_findings": raw_findings,
        # Share of raw engine findings that the recheck step kept out of the bug list.
        "noise_filter_rate": len(noise) / raw_findings if raw_findings else None,
        "planted_issues": planted,
        "lists": {"false_positives": [summary(b) for b in false_pos],
                  "unplanned": [summary(b) for b in unplanned],
                  "noise": [summary(b) for b in noise]},
    }


@router.get("/scorecard")
def scorecard(conn: DB, project: str | None = None, build: str | None = None,
              hourly_rate: float = Query(MANUAL_TESTER_HOURLY_USD, gt=0)):
    if project:
        row = conn.execute("SELECT id, name FROM projects WHERE name = ?", (project,)).fetchone()
        if row is None:
            raise HTTPException(404, f"project {project} not found")
    else:
        row = conn.execute(
            "SELECT p.id, p.name FROM projects p LEFT JOIN runs r ON r.project_id = p.id "
            "GROUP BY p.id ORDER BY MAX(r.id) DESC LIMIT 1").fetchone()
    if row is None:
        return {"project": None, "builds": []}
    project_id, project_name = row["id"], row["name"]

    builds = rows_to_dicts(conn.execute(
        "SELECT id, version FROM builds WHERE project_id = ? ORDER BY id", (project_id,)))
    if build:
        scope = [b["id"] for b in builds if b["version"] == build]
        if not scope:
            raise HTTPException(404, f"build {build} not found")
    else:
        scope = [b["id"] for b in builds]

    overall = evaluate(conn, project_id, scope)
    per_build = [{"build": b["version"], **{k: v for k, v in evaluate(conn, project_id, [b["id"]]).items()
                                             if k not in ("planted_issues", "lists")}}
                 for b in builds if b["id"] in scope]

    # ---- engine vs manual ----
    runs = rows_to_dicts(conn.execute(
        f"SELECT * FROM runs WHERE project_id = ? AND build_id IN {_in(scope)}", [project_id, *scope])) if scope else []
    engine_seconds = sum(_run_seconds(r) for r in runs)
    engine_llm_cost = sum(float((r.get("stats") or {}).get("llm_cost_usd") or 0) for r in runs)
    ai_cost = conn.execute(
        f"""SELECT COALESCE(SUM(u.cost_usd), 0) FROM ai_usage u JOIN bugs b ON b.id = u.bug_id
            WHERE b.project_id = ? AND (u.run_id IS NULL OR u.run_id IN
                (SELECT id FROM runs WHERE build_id IN {_in(scope)}))""", [project_id, *scope]).fetchone()[0] if scope else 0

    sessions = rows_to_dicts(conn.execute(
        f"""SELECT * FROM manual_sessions WHERE project_id = ?
            AND (build_id IN {_in(scope)} {'OR build_id IS NULL' if not build else ''})""",
        [project_id, *scope])) if scope else []
    manual_min = sum(s["duration_min"] for s in sessions)
    manual_planted = [s["planted_found"] for s in sessions if s["planted_found"] is not None]

    engine = {
        "runs": len(runs),
        "minutes": round(engine_seconds / 60, 2),
        "bugs_found": overall.get("reported_confirmed", 0) - overall.get("false_positives", 0),
        # Distinct planted bugs found (same unit as a manual tester's count).
        "planted_found": len({p["fingerprint"] for p in overall.get("planted_issues", []) if p["outcome"] == "detected"}),
        "false_positives": overall.get("false_positives", 0),
        "cost_usd": round(engine_llm_cost + ai_cost, 4),
        "cost_breakdown": {"engine_llm_usd": round(engine_llm_cost, 4), "ai_analysis_usd": round(ai_cost, 4)},
    }
    manual = {
        "sessions": len(sessions),
        "minutes": round(manual_min, 2),
        "bugs_found": sum(s["bugs_found"] for s in sessions),
        "planted_found": sum(manual_planted) if manual_planted else None,
        "false_positives": sum(s["false_positives"] for s in sessions),
        "cost_usd": round(manual_min / 60 * hourly_rate, 2),
    } if sessions else None

    comparison = None
    if manual and engine["minutes"] > 0:
        comparison = {
            "speedup": round(manual["minutes"] / engine["minutes"], 1),
            "bugs_per_hour_engine": round(engine["bugs_found"] / (engine["minutes"] / 60), 1),
            "bugs_per_hour_manual": round(manual["bugs_found"] / (manual["minutes"] / 60), 1) if manual["minutes"] else None,
        }

    return {
        "project": project_name,
        "build": build,
        "builds": [b["version"] for b in builds],
        **overall,
        "per_build": per_build,
        "engine": engine,
        "manual": manual,
        "manual_sessions": sessions,
        "comparison": comparison,
        "assumptions": {"manual_hourly_rate_usd": hourly_rate,
                        "engine_minutes_source": "sum of runs.stats.duration_s reported by the engine"},
    }
