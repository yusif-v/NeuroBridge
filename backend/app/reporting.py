"""Report rendering: Markdown, self-contained HTML (screenshots embedded), CSV, JSON."""

import base64
import csv
import html
import io

from .config import MEDIA_DIR

CSV_COLUMNS = ["key", "title", "severity", "category", "status", "verification", "regression", "project",
               "build", "test_name", "agent", "confidence", "occurrences", "found_at", "updated_at",
               "expected", "actual"]


def bugs_csv(bugs: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(bugs)
    return buf.getvalue()


def _bug_md(bug: dict) -> list[str]:
    out = [f"### {bug['key']} — {bug['title']}", "",
           f"- **Severity:** {bug['severity']}  **Category:** {bug.get('category') or '-'}"
           f"  **Status:** {bug['status']}  **Verification:** {bug['verification']}"
           + ("  **REGRESSION**" if bug.get("regression") else ""),
           f"- **Project / build:** {bug['project']} / {bug.get('build') or '-'}"
           f"  **Test:** {bug.get('test_name') or '-'}  **Agent:** {bug.get('agent') or '-'}"
           f"  **Seen:** {bug['occurrences']}x", ""]
    if bug.get("description"):
        out += [bug["description"], ""]
    if bug.get("expected") or bug.get("actual"):
        out += [f"**Expected:** {bug.get('expected') or '-'}", "", f"**Actual:** {bug.get('actual') or '-'}", ""]
    if bug.get("steps"):
        out += ["**Steps to reproduce:**", *[f"{i}. {s}" for i, s in enumerate(bug["steps"], 1)], ""]
    for r in bug.get("rechecks", []):
        out.append(f"- Recheck {r['created_at']}: **{r['result']}**" + (f" — {r['notes']}" if r.get("notes") else ""))
    ai = bug.get("ai_report")
    if bug.get("ai_status") == "done" and ai:
        out += ["", "**AI analysis (hypothesis, not verified):**", ai.get("summary", ""), "",
                f"- Likely root cause: {ai.get('likely_root_cause', '-')}",
                f"- Recommended fix: {ai.get('recommended_fix', '-')}",
                f"- Confidence: {ai.get('confidence', '-')}",
                f"- Suggested severity: {ai.get('severity', '-')}",
                f"- Model: {ai.get('model', '-')}"]
        if ai.get('insufficient_evidence'):
            out += ['', '**Insufficient evidence:** this analysis cannot establish the reported behavior.']
        if ai.get('reproduction_steps'):
            out += ['', '**AI reproduction steps:**', *[f'{i}. {step}' for i, step in enumerate(ai['reproduction_steps'], 1)]]
        if ai.get('evidence_refs'):
            out += ['', '**AI evidence references:**', *[f'- {ref}' for ref in ai['evidence_refs']]]
    if bug.get("logs"):
        out += ["", "<details><summary>Logs</summary>", "", "```"]
        out += [f"{l['ts']} [{l['level']}] {l['message']}" for l in bug["logs"]]
        out += ["```", "</details>"]
    return out + [""]


def run_markdown(run: dict, bugs: list[dict]) -> str:
    stats = run.get("stats") or {}
    out = [f"# BugLens Run Report — Run #{run['id']}", "",
           f"| Project | Build | Agent | Status | Started | Finished |",
           "|---|---|---|---|---|---|",
           f"| {run['project']} | {run['build']} | {run.get('agent') or '-'} | {run['status']} "
           f"| {run['started_at']} | {run.get('finished_at') or '-'} |", ""]
    if run.get("summary"):
        out += [run["summary"], ""]
    if stats:
        out += ["**Stats:** " + ", ".join(f"{k}: {v}" for k, v in stats.items()), ""]
    out += [f"## Bugs ({len(bugs)})", ""]
    for bug in bugs:
        out += _bug_md(bug)
    return "\n".join(out)


def bugs_markdown(bugs: list[dict], title: str = "BugLens Bug Report") -> str:
    out = [f"# {title}", "", f"{len(bugs)} bugs", "",
           "| ID | Severity | Status | Verification | Title |", "|---|---|---|---|---|"]
    out += [f"| {b['key']} | {b['severity']} | {b['status']} | {b['verification']} | {b['title']} |" for b in bugs]
    out.append("")
    for bug in bugs:
        out += _bug_md(bug)
    return "\n".join(out)


def _img_data_uri(att: dict) -> str | None:
    path = MEDIA_DIR / att["filename"]
    if not path.exists():
        return None
    return f"data:{att['mime']};base64,{base64.b64encode(path.read_bytes()).decode()}"


SEV_COLOR = {"critical": "#f43f5e", "high": "#fb923c", "medium": "#facc15", "low": "#94a3b8"}


def _bug_html(bug: dict) -> str:
    e = lambda v: html.escape(str(v)) if v not in (None, "") else "—"
    shots = "".join(
        f'<figure><img src="{uri}"/><figcaption>{e(a.get("caption"))}</figcaption></figure>'
        for a in bug.get("attachments", []) if (uri := _img_data_uri(a)))
    steps = "".join(f"<li>{e(s)}</li>" for s in bug.get("steps") or [])
    rechecks = "".join(f"<li><b>{e(r['result'])}</b> · {e(r['created_at'])} {e(r.get('notes') or '')}</li>"
                       for r in bug.get("rechecks", []))
    logs = "\n".join(f"{l['ts']} [{l['level']}] {l['message']}" for l in bug.get("logs", []))
    ai = bug.get("ai_report") or {}
    ai_html = ""
    if bug.get("ai_status") == "done":
        ai_steps = ''.join(f'<li>{e(step)}</li>' for step in ai.get('reproduction_steps') or [])
        ai_refs = ''.join(f'<li>{e(ref)}</li>' for ref in ai.get('evidence_refs') or [])
        insufficient = '<p><b>Insufficient evidence:</b> the reported behavior is not established.</p>' if ai.get('insufficient_evidence') else ''
        ai_html = (f'<div class="ai"><h4>AI analysis <span>hypothesis · not verified</span></h4>'
                   f'<p>{e(ai.get("summary"))}</p><p><b>Likely root cause:</b> {e(ai.get("likely_root_cause"))}</p>'
                   f'<p><b>Recommended fix:</b> {e(ai.get("recommended_fix"))}</p>'
                   f'<p><b>Confidence:</b> {e(ai.get("confidence"))} · <b>Suggested severity:</b> {e(ai.get("severity"))}</p>'
                   f'<p><b>Model:</b> {e(ai.get("model"))}</p>{insufficient}'
                   f'<h4>AI reproduction steps</h4><ol>{ai_steps}</ol>'
                   f'<h4>AI evidence references</h4><ul>{ai_refs}</ul></div>')
    color = SEV_COLOR.get(bug["severity"], "#94a3b8")
    return f"""
<section class="bug">
  <header><span class="key">{e(bug['key'])}</span><h3>{e(bug['title'])}</h3></header>
  <div class="tags"><span style="color:{color};border-color:{color}">{e(bug['severity'])}</span>
    <span>{e(bug.get('category'))}</span><span>{e(bug['status'])}</span><span>{e(bug['verification'])}</span>
    {'<span class="reg">regression</span>' if bug.get('regression') else ''}
    <span>{e(bug['project'])} · {e(bug.get('build'))}</span><span>{e(bug.get('agent'))}</span></div>
  <p>{e(bug.get('description'))}</p>
  <div class="grid"><div><h4>Expected</h4><p>{e(bug.get('expected'))}</p></div>
    <div><h4>Actual</h4><p>{e(bug.get('actual'))}</p></div></div>
  {f'<h4>Steps</h4><ol>{steps}</ol>' if steps else ''}
  {f'<h4>Rechecks</h4><ul>{rechecks}</ul>' if rechecks else ''}
  {ai_html}
  {f'<div class="shots">{shots}</div>' if shots else ''}
  {f'<details><summary>Logs</summary><pre>{html.escape(logs)}</pre></details>' if logs else ''}
</section>"""


HTML_STYLE = """
body{font-family:Inter,system-ui,sans-serif;background:#0b0b12;color:#e4e4ef;margin:0;padding:40px;line-height:1.5}
main{max-width:960px;margin:auto} h1{font-size:28px;margin:0 0 4px} .muted{color:#8b8ba3}
.meta{display:flex;gap:24px;flex-wrap:wrap;margin:20px 0;padding:16px 20px;border:1px solid #23233a;border-radius:12px;background:#12121d}
.meta div b{display:block;font-size:11px;text-transform:uppercase;color:#8b8ba3;letter-spacing:.06em}
.bug{border:1px solid #23233a;border-radius:14px;padding:20px 24px;margin:18px 0;background:#12121d}
.bug header{display:flex;gap:12px;align-items:baseline}.bug h3{margin:0;font-size:18px}
.key{font-family:ui-monospace,monospace;color:#a78bfa}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.tags span{font-size:12px;border:1px solid #2e2e48;border-radius:999px;padding:2px 10px;color:#b4b4c8}
.tags .reg{color:#f43f5e;border-color:#f43f5e}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}h4{margin:14px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8b8ba3}
.ai{border:1px solid #4c1d95;background:#1a1330;border-radius:10px;padding:4px 16px;margin-top:14px}.ai h4 span{color:#a78bfa;text-transform:none;letter-spacing:0;font-weight:400}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:14px}
figure{margin:0}img{width:100%;border-radius:8px;border:1px solid #23233a}figcaption{font-size:12px;color:#8b8ba3}
pre{background:#0b0b12;padding:12px;border-radius:8px;overflow:auto;font-size:12px}
@media print{body{background:#fff;color:#111}.bug,.meta{background:#fff;border-color:#ddd}}
"""


def render_html(title: str, subtitle: str, meta: dict, bugs: list[dict], summary: str | None = None) -> str:
    meta_html = "".join(f"<div><b>{html.escape(k)}</b>{html.escape(str(v))}</div>" for k, v in meta.items())
    body = "".join(_bug_html(b) for b in bugs) or '<p class="muted">No bugs.</p>'
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>{HTML_STYLE}</style></head>
<body><main><h1>{html.escape(title)}</h1><div class="muted">{html.escape(subtitle)}</div>
<div class="meta">{meta_html}</div>{f'<p>{html.escape(summary)}</p>' if summary else ''}
<h2>Bugs ({len(bugs)})</h2>{body}</main></body></html>"""
