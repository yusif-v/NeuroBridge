import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("BUGLENS_DATA_DIR", ROOT / "data")).resolve()
DB_PATH = DATA_DIR / "buglens.db"
MEDIA_DIR = DATA_DIR / "media"
FRONTEND_DIST = ROOT / "frontend" / "dist"

# Shared secret the engine must send in the X-Engine-Key header.
ENGINE_API_KEY = os.getenv("BUGLENS_ENGINE_KEY", "dev-engine-key")

MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024
