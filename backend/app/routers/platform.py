"""Read/write API used by the web UI."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from ..ai_bridge import ai_enabled, mark_pending, run_analysis
from ..db import DB, now, rows_to_dicts
from ..schemas import BugUpdate
from ..services import (BUG_LIST_SQL, add_event, RUN_LIST_SQL, bug_detail, decorate_bug, require,
                        run_detail)

router = APIRouter(prefix="/api/v1", tags=["platform"])

SEVERITY_ORDER = "CASE b.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"


def bug_filters(project=None, build=None, run=None, severity=None, category=None, status=None,
                verification=None, test=None, agent=None, q=None):
    where, params = [], []
    simple = {"p.name": project, "bl.version": build, "b.severity": severity, "b.category": category,
              "b.status": status, "b.verification": verification, "b.test_name": test, "b.agent": agent}
    for col, val in simple.items():
        if val:
            where.append(f"{col} = ?")
            params.append(val)
    if run:
        where.append("""(b.first_run_id = ? OR b.last_run_id = ?
                         OR b.id IN (SELECT bug_id FROM logs WHERE run_id = ?)
                         OR b.id IN (SELECT bug_id FROM rechecks WHERE run_id = ?))""")
        params += [run] * 4
    if q:
        where.append("(b.title LIKE ? OR b.description LIKE ? OR b.actual LIKE ?)")
        params += [f"%{q}%"] * 3
    return (" WHERE " + " AND ".join(where)) if where else "", params


@router.get("/bugs")
def list_bugs(conn: DB, project: str | None = None, build: str | None = None, run: int | None = None,
              severity: str | None = None, category: str | None = None, status: str | None = None,
              verification: str | None = None, test: str | None = None, agent: str | None = None,
              q: str | None = None, sort: str = Query("recent", pattern="^(recent|severity)$")):
    where, params = bug_filters(project, build, run, severity, category, status, verification, test, agent, q)
    order = f"{SEVERITY_ORDER}, b.updated_at DESC" if sort == "severity" else "b.updated_at DESC, b.id DESC"
    rows = rows_to_dicts(conn.execute(f"{BUG_LIST_SQL}{where} ORDER BY {order}", params))
    return [decorate_bug(b) for b in rows]


@router.get("/bugs/{bug_id}")
def get_bug(conn: DB, bug_id: int):
    return bug_detail(conn, bug_id)


@router.patch("/bugs/{bug_id}")
def update_bug(conn: DB, bug_id: int, body: BugUpdate):
    bug = require(conn, "bugs", bug_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(422, "Nothing to update")
    sets = ", ".join(f"{k} = ?" for k in changes)
    conn.execute(f"UPDATE bugs SET {sets}, updated_at = ? WHERE id = ?", [*changes.values(), now(), bug_id])
    for field, value in changes.items():
        if bug[field] != value:
            add_event(conn, bug_id, f"{field}_changed", f"{bug[field]} → {value} (by user)")
    return bug_detail(conn, bug_id)


@router.post("/bugs/{bug_id}/analyze", status_code=202)
def analyze(conn: DB, bug_id: int, tasks: BackgroundTasks):
    require(conn, "bugs", bug_id)
    if not mark_pending(conn, bug_id):
        raise HTTPException(503, "AI analyzer is not configured")
    conn.commit()
    tasks.add_task(run_analysis, bug_id)
    return {"bug_id": bug_id, "ai_status": "pending"}


@router.get("/runs")
def list_runs(conn: DB, project: str | None = None, limit: int = Query(50, le=500)):
    where, params = ("WHERE p.name = ?", [project]) if project else ("", [])
    return rows_to_dicts(conn.execute(f"{RUN_LIST_SQL} {where} ORDER BY r.id DESC LIMIT ?", [*params, limit]))


@router.get("/runs/{run_id}")
def get_run(conn: DB, run_id: int):
    return run_detail(conn, run_id)


@router.get("/projects")
def list_projects(conn: DB):
    return rows_to_dicts(conn.execute(
        """SELECT p.*, (SELECT COUNT(*) FROM runs WHERE project_id = p.id) AS runs,
                  (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'open') AS open_bugs
           FROM projects p ORDER BY p.name"""))


@router.get("/builds")
def list_builds(conn: DB, project: str | None = None):
    where, params = ("WHERE p.name = ?", [project]) if project else ("", [])
    return rows_to_dicts(conn.execute(
        f"""SELECT bl.*, p.name AS project,
                   (SELECT COUNT(*) FROM runs r WHERE r.build_id = bl.id) AS runs,
                   (SELECT COUNT(*) FROM bugs b WHERE b.build_id = bl.id AND b.status = 'open') AS open_bugs,
                   (SELECT COUNT(*) FROM bugs b WHERE b.build_id = bl.id AND b.status = 'fixed') AS fixed_bugs,
                   (SELECT MAX(started_at) FROM runs r WHERE r.build_id = bl.id) AS last_run_at
            FROM builds bl JOIN projects p ON p.id = bl.project_id {where}
            ORDER BY bl.id DESC""", params))


@router.get("/facets")
def facets(conn: DB):
    """Distinct values for the filter dropdowns."""
    def distinct(sql):
        return [r[0] for r in conn.execute(sql) if r[0] is not None]
    return {
        "project": distinct("SELECT name FROM projects ORDER BY name"),
        "build": distinct("SELECT DISTINCT version FROM builds ORDER BY id DESC"),
        "run": distinct("SELECT id FROM runs ORDER BY id DESC"),
        "severity": ["critical", "high", "medium", "low"],
        "category": distinct("SELECT DISTINCT category FROM bugs ORDER BY category"),
        "status": ["open", "ticketed", "fixed", "ignored", "false_positive"],
        "verification": ["unverified", "confirmed", "not_reproduced"],
        "test": distinct("SELECT DISTINCT test_name FROM bugs ORDER BY test_name"),
        "agent": distinct("SELECT DISTINCT agent FROM bugs ORDER BY agent"),
    }


@router.get("/stats")
def stats(conn: DB):
    one = lambda sql, *p: conn.execute(sql, p).fetchone()[0]
    group = lambda col, where="": {r[0]: r[1] for r in conn.execute(
        f"SELECT {col}, COUNT(*) FROM bugs {where} GROUP BY {col}") if r[0] is not None}

    timeline = rows_to_dicts(conn.execute(
        f"SELECT * FROM ({RUN_LIST_SQL} ORDER BY r.id DESC LIMIT 14) ORDER BY id"))
    recent_bugs = [decorate_bug(b) for b in rows_to_dicts(conn.execute(
        f"{BUG_LIST_SQL} ORDER BY b.updated_at DESC, b.id DESC LIMIT 6"))]
    return {
        "totals": {
            "runs": one("SELECT COUNT(*) FROM runs"),
            "active_runs": one("SELECT COUNT(*) FROM runs WHERE status = 'running'"),
            "bugs": one("SELECT COUNT(*) FROM bugs"),
            # Open KPI counts only confirmed bugs: unconfirmed findings are not reported as bugs yet.
            "open": one("SELECT COUNT(*) FROM bugs WHERE status = 'open' AND verification = 'confirmed'"),
            "confirmed": one("SELECT COUNT(*) FROM bugs WHERE verification = 'confirmed'"),
            "unverified": one("SELECT COUNT(*) FROM bugs WHERE verification = 'unverified'"),
            "not_reproduced": one("SELECT COUNT(*) FROM bugs WHERE verification = 'not_reproduced'"),
            "fixed": one("SELECT COUNT(*) FROM bugs WHERE status = 'fixed'"),
            "false_positives": one("SELECT COUNT(*) FROM bugs WHERE status = 'false_positive'"),
            "regressions": one("SELECT COUNT(*) FROM bugs WHERE regression = 1"),
            "critical_open": one("SELECT COUNT(*) FROM bugs WHERE status = 'open' AND verification = 'confirmed'"
                                 " AND severity = 'critical'"),
            "rechecks": one("SELECT COUNT(*) FROM rechecks"),
            "screenshots": one("SELECT COUNT(*) FROM attachments"),
        },
        "by_severity": group("severity", "WHERE status = 'open' AND verification = 'confirmed'"),
        "by_category": group("category"),
        "by_status": group("status"),
        "by_verification": group("verification"),
        "timeline": timeline,
        "recent_bugs": recent_bugs,
        "ai_enabled": ai_enabled(),
    }
