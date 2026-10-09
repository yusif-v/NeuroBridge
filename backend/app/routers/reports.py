"""Exports: per-run report and filtered bug export."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response

from .. import reporting
from ..db import DB, now
from ..services import bug_detail, run_detail
from .platform import list_bugs

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

FORMAT = Query("html", pattern="^(html|md|json|csv)$")


def download(content, fmt: str, name: str) -> Response:
    headers = {"Content-Disposition": f'attachment; filename="{name}.{fmt}"'}
    if fmt == "json":
        return JSONResponse(content, headers=headers)
    if fmt == "html":
        return HTMLResponse(content, headers=headers)
    media = "text/csv" if fmt == "csv" else "text/markdown"
    return PlainTextResponse(content, media_type=media, headers=headers)


@router.get("/runs/{run_id}")
def run_report(conn: DB, run_id: int, format: str = FORMAT):
    run = run_detail(conn, run_id)
    bugs = [bug_detail(conn, b["id"]) for b in run.pop("bugs")]
    name = f"buglens-run-{run_id}"
    if format == "json":
        return download({**run, "bugs": bugs}, "json", name)
    if format == "csv":
        return download(reporting.bugs_csv(bugs), "csv", name)
    if format == "md":
        return download(reporting.run_markdown(run, bugs), "md", name)
    meta = {"Project": run["project"], "Build": run["build"], "Agent": run.get("agent") or "—",
            "Status": run["status"], "Started": run["started_at"], "Finished": run.get("finished_at") or "—"}
    meta.update({k.replace("_", " ").title(): v for k, v in (run.get("stats") or {}).items()})
    return download(reporting.render_html(f"Run #{run_id} report", f"Generated {now()}", meta, bugs,
                                          run.get("summary")), "html", name)


@router.get("/bugs")
def bugs_report(conn: DB, format: str = FORMAT, project: str | None = None, build: str | None = None,
                run: int | None = None, severity: str | None = None, category: str | None = None,
                status: str | None = None, verification: str | None = None, test: str | None = None,
                agent: str | None = None, q: str | None = None):
    rows = list_bugs(conn, project, build, run, severity, category, status, verification, test, agent, q,
                     "severity")
    name = "buglens-bugs"
    if format == "csv":
        return download(reporting.bugs_csv(rows), "csv", name)
    bugs = [bug_detail(conn, b["id"]) for b in rows]
    if format == "json":
        return download(bugs, "json", name)
    if format == "md":
        return download(reporting.bugs_markdown(bugs), "md", name)
    filters = {k: v for k, v in dict(project=project, build=build, run=run, severity=severity,
                                     category=category, status=status, verification=verification,
                                     test=test, agent=agent, search=q).items() if v}
    meta = {k.title(): v for k, v in filters.items()} or {"Filters": "none"}
    meta["Bugs"] = len(bugs)
    return download(reporting.render_html("Bug report", f"Generated {now()}", meta, bugs), "html", name)
