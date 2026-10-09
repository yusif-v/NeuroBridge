# AI integration (for the AI teammate)

Everything AI lives in `ai/`. The platform only depends on two functions in `ai/analyzer.py`:

```python
def is_enabled() -> bool: ...
def analyze_bug(evidence: dict) -> dict: ...
```

- **When it's called:** in the background after the engine confirms a bug (first `reproduced` recheck),
  and when a user presses **Analyze / Retry** in the UI (`POST /api/v1/bugs/{id}/analyze`).
- **Input:** the `evidence` dict documented at the top of `ai/analyzer.py` — bug fields, logs, rechecks,
  and local screenshot paths (for multimodal models).
- **Output:** a dict with the keys in `ai/schema.py` (`AI_REPORT_JSON_SCHEMA` can be passed straight to a
  structured-output API). The UI labels it "AI analysis · hypothesis".
- **Usage / cost (needed for the Usage page and the feasibility pitch):** add
  `"usage": {"model": "...", "input_tokens": N, "output_tokens": N, "cost_usd": X}` to the returned dict.
  If you can't compute `cost_usd`, set `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK` in `.env`
  and the platform computes it. Latency is measured by the platform.
- **Evidence links:** put exact log lines or screenshot captions in `evidence_refs`; the UI highlights
  the matching log lines when a judge clicks them.
- **Errors:** just raise. The platform stores `ai_status="error"` and the message; the UI shows Retry.
- **Status values** on a bug: `none → pending → done | error`, or `disabled` when `is_enabled()` is False.

Keys go in `.env` (gitignored), e.g. `GEMINI_API_KEY`, `GEMINI_MODEL`. Add your SDK to `requirements.txt`.

Test it without the engine: start the backend, run `python scripts/simulate_engine.py`, then open a
confirmed bug and press Analyze.

Rules (from the original plan): analyze only the supplied evidence, separate observations from
hypotheses, set `insufficient_evidence` when needed, never claim a fix is verified.
