# AI evidence analysis

Everything AI lives in `ai/`. The platform only depends on two functions in `ai/analyzer.py`:

```python
def is_enabled() -> bool: ...
def analyze_bug(evidence: dict) -> dict: ...
```

- **When it's called:** in the background after the engine or Docker/Laya worker confirms a bug (first `reproduced` recheck),
  and when a user presses **Analyze / Retry** in the UI (`POST /api/v1/bugs/{id}/analyze`).
- **Input:** the `evidence` dict documented at the top of `ai/analyzer.py` — bug fields, logs, rechecks,
  local screenshot paths, screenshot captions/IDs, recent run logs and the declared
  test objective. Up to three real screenshots are encoded as JPEG image inputs;
  local filesystem paths are not sent to the model.
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

## Configuration

The implemented analyzer uses an OpenAI-compatible `/v1/chat/completions` gateway
through `httpx`. Configure the ignored repository `.env`:

```dotenv
AI_API_BASE_URL=https://your-gateway.example/v1
AI_API_KEY=your-private-key
AI_MODEL=cx/gpt-6.1-sol(high)
```

Use the exact model alias listed by your gateway. The dashboard URL is not the
API base URL. API and worker load `.env` without overriding existing shell values;
restart both after changing configuration. Keys stay server-side and never enter
the frontend bundle, Git, report or sandbox. HTTPS is required except for localhost
development. API redirects are not followed with credentials.

The gateway receives the supplied screenshots, gameplay logs and replay results.
The uploaded game itself stays in its offline container; Laya still runs locally
on CUDA. This separate API model writes the report and does not control gameplay.

## Output and failure handling

The request includes the JSON schema in both the prompt and structured-output
settings for compatible gateways. Returned JSON is validated before storing it.
Timeout, authorization, rate limit and malformed-output failures show an error and
Retry; no fabricated report is substituted, and replay verification stays intact.
Already pending analysis is not submitted twice. Root causes and suggested fixes
are labeled hypotheses; source code and a verified fix are not supplied.

The bug panel and Playtest page show the result and exact configured model alias.
HTML, Markdown and JSON exports include the AI report, reproduction steps and
evidence references. Provider token counts and latency are recorded. Cost remains
unknown unless provider pricing is explicitly configured; no rate is assumed.

To test on real evidence, open a confirmed dungeon door-rule finding and press
Analyze. New confirmed upload findings trigger analysis automatically. The API
boundary and lifecycle tests use mocked transport and explicitly disable private
credentials: `python -m pytest -q` never spends live API credits.

Rules (from the original plan): analyze only the supplied evidence, separate observations from
hypotheses, set `insufficient_evidence` when needed, never claim a fix is verified.
