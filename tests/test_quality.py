from test_platform import BUG, recheck, start

PROJECT = "Dungeon"


def plant(client, build, *fps):
    issues = [{"fingerprint": fp, "title": fp} for fp in fps]
    r = client.post("/api/v1/ingest/known-issues", json={"project": PROJECT, "build": build, "issues": issues})
    assert r.status_code == 201


def report(client, run, fingerprint, title=None):
    body = {**BUG, "fingerprint": fingerprint, "title": title or fingerprint}
    return client.post(f"/api/v1/ingest/runs/{run}/bugs", json=body).json()["bug_id"]


def test_scorecard_detected_missed_and_noise(client):
    plant(client, "1.0.0", "wall", "hp", "key")
    run = start(client)
    wall, hp, flaky = report(client, run, "wall"), report(client, run, "hp"), report(client, run, "flaky")
    recheck(client, wall, "reproduced", run)
    recheck(client, hp, "not_reproduced", run)      # planted but rejected by recheck -> not detected
    recheck(client, flaky, "not_reproduced", run)   # unplanned noise

    sc = client.get("/api/v1/scorecard", params={"build": "1.0.0"}).json()
    outcomes = {p["fingerprint"]: p["outcome"] for p in sc["planted_issues"]}
    assert outcomes == {"wall": "detected", "hp": "rejected_by_recheck", "key": "missed"}
    assert sc["detected"] == 1 and sc["planted"] == 3
    assert sc["noise_filtered"] == 2 and sc["precision"] == 1.0


def test_false_positive_lowers_precision(client):
    run = start(client)
    a, b = report(client, run, "a"), report(client, run, "b")
    recheck(client, a, "reproduced", run)
    recheck(client, b, "reproduced", run)
    client.patch(f"/api/v1/bugs/{b}", json={"status": "false_positive"})
    sc = client.get("/api/v1/scorecard").json()
    assert sc["false_positives"] == 1 and sc["precision"] == 0.5 and sc["unplanned_findings"] == 1


def test_fixed_bug_rechecked_on_new_build_is_not_counted_there(client):
    run1 = start(client)
    bug = report(client, run1, "wall")
    recheck(client, bug, "reproduced", run1)
    run2 = start(client, "1.0.1")
    recheck(client, bug, "not_reproduced", run2)
    sc = client.get("/api/v1/scorecard", params={"build": "1.0.1"}).json()
    assert sc["reported_confirmed"] == 0 and sc["unplanned_findings"] == 0


def test_manual_comparison(client):
    run = start(client)
    client.post(f"/api/v1/ingest/runs/{run}/finish", json={"stats": {"duration_s": 300, "llm_cost_usd": 0.05}})
    client.post("/api/v1/manual-sessions", json={"project": PROJECT, "build": "1.0.0", "duration_min": 60,
                                                 "bugs_found": 2})
    sc = client.get("/api/v1/scorecard", params={"build": "1.0.0", "hourly_rate": 30}).json()
    assert sc["engine"]["minutes"] == 5 and sc["manual"]["cost_usd"] == 30
    assert sc["comparison"]["speedup"] == 12


def test_timeline_records_lifecycle(client):
    run = start(client)
    bug = report(client, run, "wall")
    recheck(client, bug, "reproduced", run)
    client.patch(f"/api/v1/bugs/{bug}", json={"status": "ticketed"})
    types = [e["type"] for e in client.get(f"/api/v1/bugs/{bug}").json()["timeline"]]
    assert types == ["found", "recheck_reproduced", "confirmed", "status_changed"]


def test_ai_usage_recorded(client, monkeypatch):
    from ai import analyzer
    monkeypatch.setattr(analyzer, "is_enabled", lambda: True)
    monkeypatch.setattr(analyzer, "analyze_bug", lambda ev: {
        "summary": "s", "usage": {"model": "m", "input_tokens": 1000, "output_tokens": 200, "cost_usd": 0.002}})
    run = start(client)
    bug = report(client, run, "wall")
    recheck(client, bug, "reproduced", run)   # triggers background analysis
    detail = client.get(f"/api/v1/bugs/{bug}").json()
    assert detail["ai_status"] == "done" and "usage" not in detail["ai_report"]
    usage = client.get("/api/v1/usage").json()
    assert usage["ai"]["calls"] == 1 and usage["ai"]["cost_usd"] == 0.002
    assert usage["unit"]["known_cost_usd"] == 0.002
    assert usage["unit"]["cost_per_confirmed_bug_usd"] is None  # external engine cost was never supplied
