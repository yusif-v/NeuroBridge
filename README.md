# BugLens AI

LLM-powered bug hunter / QA platform for games. An engine plays the game, catches bugs, rechecks every
finding, and pushes screenshots, logs and descriptions here. The platform stores and verifies them,
gets an AI explanation, and produces reports.

See [PLAN.md](PLAN.md) for the hackathon plan.

## Quick start

```bash
# Backend (http://localhost:8000, API docs at /docs)
uv venv && uv pip install -r requirements.txt     # or: python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn backend.app.main:app --reload --env-file .env

# Frontend (http://localhost:5173, proxies /api and /media to :8000)
cd frontend && npm install && npm run dev

# Fill the platform with demo data (no real engine needed)
.venv/bin/python scripts/simulate_engine.py --live --regression
```

Production-style single process: `cd frontend && npm run build`, then run uvicorn — it serves the built UI at `/`.

Reset data: stop the backend and delete `data/buglens.db` and `data/media/`.

## Layout

```
backend/app/      FastAPI: ingest API (engine), platform API (UI), reports, SQLite
ai/               AI plug-in (analyzer.py, schema.py) — AI teammate
sdk/              buglens_client.py — stdlib client for the game engine
scripts/          simulate_engine.py — fake engine for demos/dev
frontend/         React + Vite + Tailwind web platform
docs/             ENGINE_API.md, AI_INTEGRATION.md
tests/            pytest for API + bug lifecycle
data/             runtime DB + screenshots (gitignored)
```

## For teammates

- **Engine:** [docs/ENGINE_API.md](docs/ENGINE_API.md). Python engines can use `sdk/buglens_client.py`.
- **AI:** [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md). Implement `ai/analyzer.py`.

## Tests

```bash
.venv/bin/python -m pytest -q
```
