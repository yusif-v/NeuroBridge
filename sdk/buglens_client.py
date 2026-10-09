"""BugLens engine client — stdlib only, drop into the game engine.

    from sdk.buglens_client import BugLens

    bl = BugLens("http://localhost:8000", key="dev-engine-key")
    with bl.run(project="Dungeon Escape", build="1.0.0", agent="Explorer") as run:
        run.log("Spawned at (1,1)")
        bug = run.bug(title="Player walks through wall", category="collision", severity="high",
                      steps=["Spawn", "Move east x2"], expected="Blocked by wall",
                      actual="Player at (3,1) inside wall", screenshots=["frame.png"])
        bug.recheck(reproduced=True, attempts=3)
        run.stats(tests_total=5, tests_passed=3, tests_failed=2)
"""

import base64
import json
import mimetypes
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


class BugLensError(RuntimeError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _screenshot(item) -> dict:
    """Accepts a file path, raw PNG bytes, or a ready dict {data, mime, caption}."""
    if isinstance(item, dict):
        return item
    if isinstance(item, bytes):
        return {"data": base64.b64encode(item).decode(), "mime": "image/png"}
    path = Path(item)
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return {"data": base64.b64encode(path.read_bytes()).decode(), "mime": mime, "caption": path.name}


class BugLens:
    def __init__(self, base_url: str = "http://localhost:8000", key: str = "dev-engine-key", timeout: float = 15):
        self.base = base_url.rstrip("/") + "/api/v1/ingest"
        self.key = key
        self.timeout = timeout

    def _post(self, path: str, body: dict) -> dict:
        req = urllib.request.Request(
            self.base + path, data=json.dumps(body).encode(), method="POST",
            headers={"Content-Type": "application/json", "X-Engine-Key": self.key})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            raise BugLensError(f"{e.code} {path}: {e.read().decode(errors='replace')}") from None

    def open_bugs(self, project: str) -> list[dict]:
        """Known open bugs for a project, so a new run can recheck them on the new build."""
        url = self.base.replace("/ingest", "/bugs") + "?" + urllib.parse.urlencode(
            {"project": project, "status": "open"})
        with urllib.request.urlopen(url, timeout=self.timeout) as resp:
            return json.loads(resp.read())

    def run(self, project: str, build: str, agent: str | None = None, **metadata) -> "Run":
        data = self._post("/runs", {"project": project, "build": build, "agent": agent,
                                    "metadata": metadata or None})
        return Run(self, data["run_id"])


class Run:
    def __init__(self, client: BugLens, run_id: int):
        self.client, self.id = client, run_id
        self._stats: dict = {}
        self.summary: str | None = None

    def log(self, message: str, level: str = "info", **data) -> None:
        self.logs([{"message": message, "level": level, "ts": _now(), "data": data or None}])

    def logs(self, entries: list[dict]) -> None:
        self.client._post(f"/runs/{self.id}/logs", {"entries": entries})

    def bug(self, title: str, *, screenshots=(), logs=(), **fields) -> "Bug":
        """fields: description, category, severity, fingerprint, test_name, agent, confidence,
        steps, expected, actual, metadata. logs: list of str or {message, level, data}."""
        entries = [{"message": l, "ts": _now()} if isinstance(l, str) else l for l in logs]
        body = {"title": title, **fields, "logs": entries, "screenshots": [_screenshot(s) for s in screenshots]}
        data = self.client._post(f"/runs/{self.id}/bugs", body)
        return Bug(self, data["bug_id"], data["key"], data["is_new"])

    def recheck(self, bug_id: int, reproduced: bool, **kwargs) -> dict:
        """Recheck a bug found in an earlier run (e.g. from client.open_bugs) during this run."""
        return Bug(self, bug_id, f"BUG-{bug_id:03d}", False).recheck(reproduced, **kwargs)

    def stats(self, **stats) -> None:
        self._stats.update(stats)

    def finish(self, status: str = "completed", summary: str | None = None) -> None:
        self.client._post(f"/runs/{self.id}/finish", {"status": status, "summary": summary or self.summary,
                                                      "stats": self._stats or None})

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.finish("completed")
        else:
            self.finish("failed", summary=f"Engine error: {exc}")
        return False


class Bug:
    def __init__(self, run: Run, bug_id: int, key: str, is_new: bool):
        self.run, self.id, self.key, self.is_new = run, bug_id, key, is_new

    def recheck(self, reproduced: bool, attempts: int | None = None, notes: str | None = None,
                screenshots=(), logs=(), run: Run | None = None) -> dict:
        entries = [{"message": l, "ts": _now()} if isinstance(l, str) else l for l in logs]
        return self.run.client._post(f"/bugs/{self.id}/rechecks", {
            "result": "reproduced" if reproduced else "not_reproduced",
            "run_id": (run or self.run).id, "attempts": attempts, "notes": notes,
            "logs": entries, "screenshots": [_screenshot(s) for s in screenshots]})
