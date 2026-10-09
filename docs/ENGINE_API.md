# Engine → Platform API

The game engine plays the game, finds bugs, rechecks them, and **pushes** everything to the platform.
The platform never calls the engine.

- Base URL: `http://localhost:8000/api/v1/ingest`
- Auth: header `X-Engine-Key: <BUGLENS_ENGINE_KEY>` (default `dev-engine-key`)
- Interactive docs: http://localhost:8000/docs
- Python engines: use `sdk/buglens_client.py` (stdlib only). `scripts/simulate_engine.py` is a full example.

## Flow

```
POST /runs                      -> {run_id}             start a play session on a build
POST /runs/{run_id}/logs        (any number of times)   gameplay log lines
POST /runs/{run_id}/bugs        -> {bug_id, key, is_new} a finding + steps + screenshots + logs
POST /bugs/{bug_id}/rechecks    reproduced | not_reproduced
POST /runs/{run_id}/finish      status, summary, stats
```

Rechecking bugs from earlier runs on a new build: `GET /api/v1/bugs?project=<name>&status=open`
(no key needed) → for each, `POST /bugs/{id}/rechecks` with the new `run_id`.

## Payloads

**Start run**
```json
{"project": "Dungeon Escape", "build": "1.0.0", "agent": "Explorer-LLM", "metadata": {"seed": 42}}
```

**Logs**
```json
{"entries": [{"message": "move RIGHT (3,1)->(4,1)", "level": "info", "ts": "2026-10-09T10:00:00Z", "data": {"tile": "WALL"}}]}
```
`level`: `debug | info | warning | error`. `ts` optional (server time).

**Bug**
```json
{
  "title": "Player can walk through wall tiles",
  "description": "Free text from the engine / agent",
  "category": "collision",
  "severity": "high",
  "fingerprint": "collision-wall-clip",
  "test_name": "TEST-03 Wall collision",
  "agent": "Explorer-LLM",
  "confidence": 0.93,
  "steps": ["Start new game", "Move to (3,1)", "Press RIGHT"],
  "expected": "Movement blocked",
  "actual": "Player at (4,1) inside WALL",
  "metadata": {"any": "extra"},
  "logs": [{"message": "collision passable=True", "level": "error"}],
  "screenshots": [{"data": "<base64 png/jpg/webp>", "mime": "image/png", "caption": "Player inside wall"}]
}
```
Only `title` is required. `severity`: `critical | high | medium | low`. `confidence`: 0–1.
Screenshots can also be uploaded as multipart: `POST /bugs/{bug_id}/screenshots` (`file`, `caption`, `run_id`). Max 10 MB each.

**Recheck**
```json
{"result": "reproduced", "run_id": 1, "attempts": 3, "notes": "3/3", "logs": [], "screenshots": []}
```

**Finish**
```json
{"status": "completed", "summary": "…", "stats": {"tests_total": 5, "tests_passed": 3, "tests_failed": 2, "duration_s": 31.2}}
```
`stats` is free-form; the UI shows whatever keys you send.

## Rules the platform applies

| Situation | Result |
|---|---|
| New bug | `status=open`, `verification=unverified` (not counted as an open bug yet) |
| Same `fingerprint` reported again | Same bug, `occurrences + 1`, last seen build/run updated |
| No `fingerprint` | Derived from `category + title` — send a stable one if titles vary |
| Recheck `reproduced` | `verification=confirmed` → AI analysis is triggered (if enabled) |
| Recheck `not_reproduced`, bug never confirmed | `verification=not_reproduced` (flaky / false positive) |
| Recheck `not_reproduced`, bug was confirmed | `status=fixed` (fix verified by retest) |
| Fixed bug reported or reproduced again | Reopened, `regression=true` |
