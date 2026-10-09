"""AI plug-in point — owned by the AI teammate.

The platform calls `analyze_bug(evidence)` in the background after the engine
confirms a bug (recheck = reproduced), or when someone presses "Analyze" in the UI.

Contract:
  - `is_enabled()` -> False means the platform shows "AI not configured" and never calls analyze_bug.
  - `analyze_bug(evidence)` receives the dict described in EVIDENCE below and must return a dict
    matching ai/schema.py:AI_REPORT_FIELDS. Raise an exception on failure; the platform stores
    ai_status="error" with the message.

EVIDENCE (what you get):
  {
    "key": "BUG-007", "title", "description", "category", "severity", "test_name", "agent",
    "steps": [...], "expected", "actual", "verification", "occurrences",
    "project", "build",
    "logs": [{"ts", "level", "message", "data"}],
    "rechecks": [{"result", "attempts", "notes", "created_at"}],
    "screenshots": ["/abs/path/to/file.png", ...]     # local paths, for multimodal models
  }

USAGE (optional but needed for the Usage / cost page): include in the returned dict
    "usage": {"model": "...", "input_tokens": 1234, "output_tokens": 456, "cost_usd": 0.0012}
  cost_usd may be omitted if AI_PRICE_INPUT_PER_MTOK / AI_PRICE_OUTPUT_PER_MTOK are set in .env.
  The platform measures latency itself and strips "usage" before storing the report.
"""


def is_enabled() -> bool:
    # TODO(AI teammate): return True once analyze_bug is implemented and the API key is set.
    return False


def analyze_bug(evidence: dict) -> dict:
    raise NotImplementedError("AI analyzer not implemented yet")
