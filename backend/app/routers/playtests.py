import json
from pathlib import Path
import shutil
import time
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from ..config import DATA_DIR, JOBS_DIR, MAX_BUILD_BYTES
from ..db import DB, dumps, now, row_to_dict, rows_to_dicts
from ..services import get_or_create_build, get_or_create_project
from ..uploads import prepare_build

router = APIRouter(prefix='/api/v1/playtests', tags=['sandbox playtests'])


@router.get('/capabilities')
def capabilities():
    heartbeat = DATA_DIR / 'worker.json'
    data = {}
    try:
        data = json.loads(heartbeat.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        pass
    online = time.time() - data.get('heartbeat', 0) < 60
    return {'worker_online': online, 'sandbox_ready': online and data.get('sandbox_ready', False),
            'gpu': data.get('gpu') if online else None, 'model': 'convaiinnovations/laya multilingual',
            'formats': ['Windows x86_64 EXE', 'Windows build ZIP'], 'max_bytes': MAX_BUILD_BYTES,
            'message': data.get('message', 'Start the Docker sandbox and the Laya worker.') if online else
                       'Worker offline. Uploaded builds stay queued until it starts.'}


@router.post('', status_code=202)
async def upload(conn: DB, file: UploadFile = File(...), project: str = Form(..., min_length=1, max_length=120),
                 version: str = Form('uploaded', min_length=1, max_length=80),
                 objective: str = Form('Explore the game and check for runtime failures.', max_length=3000),
                 entrypoint: str = Form('', max_length=500), budget: int = Form(90, ge=5, le=300),
                 rule: str = Form('none')):
    if rule not in ('none', 'key-gated-exit'):
        raise HTTPException(422, 'Unknown gameplay rule')
    if not project.strip() or not version.strip():
        raise HTTPException(422, 'Project and build names cannot be blank')
    filename = Path((file.filename or 'build').replace('\\', '/')).name
    if not filename.lower().endswith(('.zip', '.exe', '.x86_64', '.bin')):
        raise HTTPException(415, 'Upload a Linux/Windows build ZIP or x86_64 executable')
    job_id = uuid.uuid4().hex
    folder = JOBS_DIR / job_id
    folder.mkdir(parents=True)
    received = 0
    try:
        archive = folder / 'upload.bin'
        with archive.open('wb') as output:
            while chunk := await file.read(1024 * 1024):
                received += len(chunk)
                if received > MAX_BUILD_BYTES:
                    raise HTTPException(413, 'Maximum upload is 200 MB')
                output.write(chunk)
        selected = await run_in_threadpool(prepare_build, archive, folder / 'build', filename, entrypoint)
        archive.unlink(missing_ok=True)
        project_id = get_or_create_project(conn, project.strip())
        build_id = get_or_create_build(conn, project_id, version.strip())
        run_id = conn.execute('INSERT INTO runs (project_id,build_id,agent,metadata,started_at) VALUES (?,?,?,?,?)',
                              (project_id, build_id, 'Laya CUDA / Docker sandbox', dumps({'playtest_job': job_id}), now())).lastrowid
        conn.execute('''INSERT INTO playtest_jobs
                     (id,run_id,filename,entrypoint,objective,rule,budget,created_at) VALUES (?,?,?,?,?,?,?,?)''',
                     (job_id, run_id, filename, selected, objective, rule, budget, now()))
        return job_detail(conn, job_id)
    except Exception:
        if folder.resolve().is_relative_to(JOBS_DIR.resolve()) and folder.resolve() != JOBS_DIR.resolve():
            shutil.rmtree(folder)
        raise
    finally:
        await file.close()


@router.get('')
def list_jobs(conn: DB):
    return rows_to_dicts(conn.execute('''SELECT j.*,p.name AS project,b.version AS build FROM playtest_jobs j
            JOIN runs r ON r.id=j.run_id JOIN projects p ON p.id=r.project_id JOIN builds b ON b.id=r.build_id
            ORDER BY j.created_at DESC LIMIT 50'''))


@router.get('/{job_id}')
def job_detail(conn: DB, job_id: str):
    job = row_to_dict(conn.execute('SELECT * FROM playtest_jobs WHERE id=?', (job_id,)).fetchone())
    if job is None:
        raise HTTPException(404, 'Playtest not found')
    job['events'] = rows_to_dicts(conn.execute('SELECT * FROM logs WHERE run_id=? ORDER BY id DESC LIMIT 50', (job['run_id'],)))
    return job


@router.post('/{job_id}/cancel')
def cancel(conn: DB, job_id: str):
    job_detail(conn, job_id)
    changed = conn.execute("UPDATE playtest_jobs SET status='cancelled',finished_at=? WHERE id=? AND status IN ('queued','starting','playing','verifying')", (now(), job_id)).rowcount
    if changed:
        conn.execute("UPDATE runs SET status='failed',summary='Playtest cancelled',finished_at=? WHERE id=(SELECT run_id FROM playtest_jobs WHERE id=?)", (now(), job_id))
    return job_detail(conn, job_id)


@router.get('/{job_id}/frame')
def frame(conn: DB, job_id: str):
    job_detail(conn, job_id)
    image = JOBS_DIR / job_id / 'latest.png'
    if not image.is_file():
        raise HTTPException(404, 'No captured frame yet')
    return FileResponse(image, media_type='image/png', headers={'Cache-Control': 'no-store'})


@router.get('/{job_id}/runtime-log')
def runtime_log(conn: DB, job_id: str):
    job_detail(conn, job_id)
    path = JOBS_DIR / job_id / 'runtime.log'
    if not path.is_file():
        raise HTTPException(404, 'No runtime output yet')
    return FileResponse(path, media_type='text/plain', filename='runtime.log')
