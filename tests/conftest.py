import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("BUGLENS_DATA_DIR", str(tmp_path))
    # Reload config-dependent modules so they pick up the temp data dir.
    for mod in [m for m in list(sys.modules) if m.startswith("backend")]:
        del sys.modules[mod]
    from fastapi.testclient import TestClient
    from backend.app.main import app
    with TestClient(app) as c:
        c.headers.update({"X-Engine-Key": os.getenv("BUGLENS_ENGINE_KEY", "dev-engine-key")})
        yield c
