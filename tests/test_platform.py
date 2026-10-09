import base64

PNG_1PX = base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de"
    "0000000c4944415408d763f8cfc000000301010018dd8db00000000049454e44ae426082")).decode()

BUG = {"title": "Player walks through wall", "category": "collision", "severity": "high",
       "fingerprint": "wall", "steps": ["move right"], "expected": "blocked", "actual": "inside wall",
       "logs": [{"message": "collision passable=True", "level": "error"}],
       "screenshots": [{"data": PNG_1PX, "caption": "frame"}]}


def start(client, build="1.0.0"):
    return client.post("/api/v1/ingest/runs", json={"project": "Dungeon", "build": build}).json()["run_id"]


def recheck(client, bug_id, result, run_id):
    return client.post(f"/api/v1/ingest/bugs/{bug_id}/rechecks", json={"result": result, "run_id": run_id}).json()


def test_engine_key_required(client):
    r = client.post("/api/v1/ingest/runs", json={"project": "x", "build": "1"}, headers={"X-Engine-Key": "nope"})
    assert r.status_code == 401


def test_bug_stored_with_evidence(client):
    run = start(client)
    bug = client.post(f"/api/v1/ingest/runs/{run}/bugs", json=BUG).json()
    assert bug["is_new"] and bug["key"] == "BUG-001"
    detail = client.get(f"/api/v1/bugs/{bug['bug_id']}").json()
    assert detail["verification"] == "unverified"
    assert detail["logs"][0]["message"] == "collision passable=True"
    assert client.get(detail["attachments"][0]["url"]).status_code == 200


def test_same_fingerprint_is_deduplicated(client):
    run1, run2 = start(client), start(client, "1.0.1")
    a = client.post(f"/api/v1/ingest/runs/{run1}/bugs", json=BUG).json()
    b = client.post(f"/api/v1/ingest/runs/{run2}/bugs", json=BUG).json()
    assert a["bug_id"] == b["bug_id"] and not b["is_new"]
    assert client.get(f"/api/v1/bugs/{a['bug_id']}").json()["occurrences"] == 2


def test_lifecycle_confirm_fix_regression(client):
    run1 = start(client)
    bug_id = client.post(f"/api/v1/ingest/runs/{run1}/bugs", json=BUG).json()["bug_id"]

    assert recheck(client, bug_id, "reproduced", run1)["verification"] == "confirmed"

    run2 = start(client, "1.0.1")
    assert recheck(client, bug_id, "not_reproduced", run2)["status"] == "fixed"

    run3 = start(client, "1.0.2")
    r = recheck(client, bug_id, "reproduced", run3)
    assert r["status"] == "open" and r["regression"] is True


def test_unconfirmed_finding_is_not_counted_open(client):
    run = start(client)
    bug_id = client.post(f"/api/v1/ingest/runs/{run}/bugs", json=BUG).json()["bug_id"]
    assert recheck(client, bug_id, "not_reproduced", run)["verification"] == "not_reproduced"
    assert client.get("/api/v1/stats").json()["totals"]["open"] == 0


def test_filters_and_status_update(client):
    run = start(client)
    bug_id = client.post(f"/api/v1/ingest/runs/{run}/bugs", json=BUG).json()["bug_id"]
    assert len(client.get("/api/v1/bugs", params={"severity": "high", "q": "wall"}).json()) == 1
    assert client.get("/api/v1/bugs", params={"severity": "low"}).json() == []
    assert client.patch(f"/api/v1/bugs/{bug_id}", json={"status": "ticketed"}).json()["status"] == "ticketed"


def test_ai_disabled_by_default(client):
    run = start(client)
    bug_id = client.post(f"/api/v1/ingest/runs/{run}/bugs", json=BUG).json()["bug_id"]
    recheck(client, bug_id, "reproduced", run)
    assert client.get(f"/api/v1/bugs/{bug_id}").json()["ai_status"] == "disabled"
    assert client.post(f"/api/v1/bugs/{bug_id}/analyze").status_code == 503


def test_reports_render(client):
    run = start(client)
    client.post(f"/api/v1/ingest/runs/{run}/bugs", json=BUG)
    client.post(f"/api/v1/ingest/runs/{run}/finish", json={"stats": {"tests_total": 5}})
    for fmt in ("html", "md", "json", "csv"):
        assert client.get(f"/api/v1/reports/runs/{run}", params={"format": fmt}).status_code == 200
        assert client.get("/api/v1/reports/bugs", params={"format": fmt}).status_code == 200
    assert "data:image/png;base64" in client.get(f"/api/v1/reports/runs/{run}").text
