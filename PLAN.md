# BugLens AI — Hackathon Plan (v3)

**LLM-powered bug hunter / QA platform for games.**
An engine plays the game, catches bugs, rechecks every finding, and reports everything — screenshots,
logs, descriptions — into the platform. The platform stores, verifies, explains (AI) and reports.

> v3 changes: the platform no longer runs tests itself. The engine **pushes** results through an
> ingestion API. Game + engine and AI are owned by teammates; this repo's core is the platform.

---

## 1. Architecture

```
┌──────────────┐  X-Engine-Key   ┌─────────────────────────────────────────┐
│ Game engine  │ ──────────────▶ │ FastAPI backend                         │
│ (teammate)   │  runs, logs,    │  ingest API ─▶ services (dedup,         │
│ plays game,  │  bugs, shots,   │               verification lifecycle)   │
│ rechecks     │  rechecks       │  SQLite  +  data/media (screenshots)    │
└──────────────┘                 │  ai_bridge ─▶ ai/analyzer.py (teammate) │
                                 │  reports  (HTML / MD / JSON / CSV)      │
                                 └───────────────┬─────────────────────────┘
                                                 │ /api/v1 (polling, ~3s)
                                 ┌───────────────▼─────────────────────────┐
                                 │ React web platform                      │
                                 │ Dashboard · Runs · Bugs · Builds · Reports│
                                 └─────────────────────────────────────────┘
```

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind, react-query, recharts |
| Backend | FastAPI |
| Database | SQLite (`data/buglens.db`), screenshots on disk (`data/media/`) |
| AI | Plug-in module `ai/analyzer.py` (Gemini or any LLM — AI teammate) |
| Engine link | REST ingest API + stdlib Python SDK (`sdk/buglens_client.py`) |

## 2. Ownership

| Area | Owner | Files |
|---|---|---|
| Structure, platform, database, reporting | **Platform (us)** | `backend/`, `frontend/`, `sdk/`, `scripts/`, `tests/`, `docs/` |
| AI analysis | AI teammate | `ai/analyzer.py` (contract: `docs/AI_INTEGRATION.md`) |
| Game + engine | Engine teammate | their repo/folder, integrates via `docs/ENGINE_API.md` |
| Pitch, QA, demo | Pitch teammate | deck, demo script |

**No-waiting rule:** the engine and AI contracts are frozen in `docs/`. Until the real engine is ready,
`scripts/simulate_engine.py` feeds the platform realistic data (runs, bugs, generated screenshots,
rechecks, a verified fix and a regression).

## 3. Core principle (say it in the pitch)

1. The engine finds a problem and **rechecks it** before it counts.
2. Only **confirmed** findings appear as open bugs. Not-reproduced findings are kept but marked flaky.
3. The AI explains confirmed bugs (summary, root cause, fix) — labelled a **hypothesis**, kept separate from evidence.
4. **Fixed** only when a recheck on a newer build fails to reproduce it. A fixed bug that returns = **regression**.

## 4. Data model

| Table | Holds |
|---|---|
| `projects`, `builds` | Game + versions (auto-created on first run) |
| `runs` | Play sessions: agent, status, summary, stats JSON |
| `bugs` | Deduplicated by `fingerprint`; severity, status, verification, regression, steps, expected/actual, occurrences, AI report |
| `rechecks` | Every recheck result per bug |
| `logs` | Run-level and bug-level log lines |
| `attachments` | Screenshots (file on disk + caption), linked to run / bug / recheck |

Bug `status`: open · ticketed · fixed · ignored. `verification`: unverified · confirmed · not_reproduced.

## 5. Web platform pages

| Page | Content |
|---|---|
| Dashboard | KPIs (open, confirmed, fixed, regressions, active runs, rechecks), bugs-per-run chart, severity + verification breakdown, recent bugs/runs, live indicator |
| Runs | Run list → run detail: summary, stats, bugs, log timeline, export |
| Bugs (main) | Mockup layout: search, filters, dense table, side panel with screenshots, expected/actual, steps, recheck history, AI card, logs, metadata, actions |
| Builds | Per-build open / fixed counts |
| Reports | Export run or filtered bugs as HTML (self-contained, screenshots embedded), Markdown, JSON, CSV |
| Agents, Integrations, Settings | Greyed "coming soon" |

## 6. Timeline (6 hours)

| Time | Platform | Others |
|---|---|---|
| 0:00–0:45 | ✅ Structure, DB, ingest API, simulator, docs | Read `docs/`, start engine + analyzer |
| 0:45–2:30 | Frontend pages on simulator data | Engine emits real runs via SDK; AI implements `analyze_bug` |
| 2:30–3:30 | **Integration:** real engine → platform; AI reports appear | |
| 3:30–4:30 | Polish UI, empty/error states, report look | Fix engine edge cases |
| 4:30–5:15 | Seed final demo DB from a **real** engine run | Pitch deck |
| 5:15–6:00 | **Code freeze**, rehearse 2×, record backup video | |

## 7. Demo script (3 min)

1. Dashboard empty → start the engine on build `1.0.0` → bugs appear live.
2. Bugs page → open the wall-clip bug: screenshot, expected vs actual, steps, recheck 3/3 reproduced.
3. AI card: summary, root cause, fix — labelled hypothesis, linked to log lines.
4. Show a flaky finding the recheck rejected → "we don't report noise".
5. Engine runs build `1.0.1` → wall bug turns **Fixed (verified by recheck)**.
6. (Optional) build `1.0.2` → **Regression** badge.
7. Export the HTML report. Close: "Engine finds, recheck confirms, AI explains, platform proves."

## 8. Out of scope (say honestly)

Real Jira integration, auth/multi-user, multi-tenant, Unity/Unreal plugins (SDK is engine-agnostic HTTP).
