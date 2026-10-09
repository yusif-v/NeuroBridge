"""Engine -> platform. The game engine pushes runs, logs, bugs, screenshots and rechecks here."""

import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile

from ..ai_bridge import mark_pending, run_analysis
from ..config import ENGINE_API_KEY
from ..db import dumps, DB, now
from ..schemas import BugReport, KnownIssueBatch, LogBatch, RecheckReport, RunFinish, RunStart
from .quality import save_known_issues
from ..services import (add_attachment, add_logs, apply_recheck, bug_key, get_or_create_build,
                        get_or_create_project, require, store_image, upsert_bug)


def check_engine_key(x_engine_key: str = Header(..., description="Shared engine secret")):
    if not secrets.compare_digest(x_engine_key, ENGINE_API_KEY):
        raise HTTPException(401, "Invalid engine key")


router = APIRouter(prefix="/api/v1/ingest", tags=["engine ingest"], dependencies=[Depends(check_engine_key)])


@router.post("/runs", status_code=201)
def start_run(conn: DB, body: RunStart):
    project_id = get_or_create_project(conn, body.project)
    build_id = get_or_create_build(conn, project_id, body.build)
    cur = conn.execute(
        "INSERT INTO runs (project_id, build_id, agent, metadata, started_at) VALUES (?, ?, ?, ?, ?)",
        (project_id, build_id, body.agent, dumps(body.metadata), now()),
    )
    return {"run_id": cur.lastrowid}


@router.post("/runs/{run_id}/logs", status_code=201)
def push_logs(conn: DB, run_id: int, body: LogBatch):
    require(conn, "runs", run_id)
    add_logs(conn, run_id, body.entries)
    return {"accepted": len(body.entries)}


@router.post("/runs/{run_id}/bugs", status_code=201)
def report_bug(conn: DB, run_id: int, body: BugReport):
    run = require(conn, "runs", run_id)
    bug_id, is_new = upsert_bug(conn, run, body)
    return {"bug_id": bug_id, "key": bug_key(bug_id), "is_new": is_new}


@router.post("/runs/{run_id}/finish")
def finish_run(conn: DB, run_id: int, body: RunFinish):
    require(conn, "runs", run_id)
    conn.execute(
        "UPDATE runs SET status = ?, summary = ?, stats = ?, finished_at = ? WHERE id = ?",
        (body.status, body.summary, dumps(body.stats), now(), run_id),
    )
    return {"run_id": run_id, "status": body.status}


@router.post("/bugs/{bug_id}/rechecks", status_code=201)
def report_recheck(conn: DB, bug_id: int, body: RecheckReport, tasks: BackgroundTasks):
    bug = require(conn, "bugs", bug_id)
    updated = apply_recheck(conn, bug, body)
    # First confirmation -> ask the AI to write the report.
    if updated["verification"] == "confirmed" and updated["ai_status"] in ("none", "disabled", "error"):
        if mark_pending(conn, bug_id):
            conn.commit()
            tasks.add_task(run_analysis, bug_id)
    return {"bug_id": bug_id, "status": updated["status"], "verification": updated["verification"],
            "regression": bool(updated["regression"])}


@router.post("/bugs/{bug_id}/screenshots", status_code=201)
async def upload_screenshot(conn: DB, bug_id: int, file: UploadFile = File(...), caption: str | None = Form(None),
                            run_id: int | None = Form(None)):
    """Multipart alternative to base64 screenshots inside the bug JSON."""
    bug = require(conn, "bugs", bug_id)
    mime = file.content_type or "image/png"
    filename = store_image(await file.read(), mime)
    att_id = add_attachment(conn, filename, mime, caption, run_id=run_id or bug["last_run_id"], bug_id=bug_id)
    return {"attachment_id": att_id, "url": f"/media/{filename}"}


@router.post("/known-issues", status_code=201)
def push_known_issues(conn: DB, body: KnownIssueBatch):
    """Engine declares the bugs deliberately planted in a build (ground truth for the QA scorecard)."""
    return save_known_issues(conn, body, source="engine")
