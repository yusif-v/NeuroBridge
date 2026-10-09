import { useState, type ReactNode } from 'react'
import { Check, Copy, ExternalLink, FileCode2, GitBranch, Plug, Terminal } from 'lucide-react'
import { cn } from '../lib'
import { Card, Pill } from '../components/ui'

const API_DOCS = window.location.port === '5173' ? 'http://localhost:8000/docs' : '/docs'
const ORIGIN = window.location.port === '5173' ? 'http://localhost:8000' : window.location.origin

function Code({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200">
          {copied ? <><Check className="size-3 text-emerald-300" />Copied</> : <><Copy className="size-3" />Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-5 text-zinc-300"><code>{code}</code></pre>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="relative pl-10">
      <span className="absolute left-0 top-0 grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-sm font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/30">{n}</span>
      <h3 className="pt-0.5 text-sm font-semibold text-zinc-100">{title}</h3>
      <div className="mt-2 space-y-3 text-sm text-zinc-400">{children}</div>
    </div>
  )
}

const PY_RUN = `from sdk.buglens_client import BugLens

bl = BugLens("${ORIGIN}", key="dev-engine-key")

with bl.run(project="Dungeon Escape", build="1.0.0", agent="Explorer-LLM") as run:
    run.log("Spawned at (1,1)", level="info")

    bug = run.bug(
        "Player can walk through wall tiles",
        fingerprint="collision-wall-clip",       # stable id: dedup + scorecard
        category="collision", severity="high", confidence=0.93,
        steps=["Start new game", "Move to (3,1)", "Press RIGHT"],
        expected="Movement blocked", actual="Player at (4,1) inside WALL",
        logs=["collision check returned passable=True"],
        screenshots=["frames/wall_clip.png"],   # path, bytes, or {data, mime, caption}
    )
    bug.recheck(reproduced=True, attempts=3, notes="3/3 from fresh state")

    run.stats(tests_total=5, tests_passed=3, tests_failed=2,
              duration_s=212.4,                          # QA time for the scorecard
              llm_input_tokens=64000, llm_output_tokens=5200,
              llm_cost_usd=0.032)                        # engine LLM cost for Usage
# leaving the block finishes the run (or marks it failed on exception)`

const PY_PLANTED = `# Declare the bugs planted in this build (ground truth for the QA Scorecard).
# Fingerprints must equal the ones the engine uses when it reports them.
bl.known_issues("Dungeon Escape", "1.0.0", [
    {"fingerprint": "collision-wall-clip", "title": "Player can walk through walls",
     "category": "collision", "severity": "high"},
    {"fingerprint": "state-zero-hp", "title": "Game continues at 0 HP",
     "category": "logic", "severity": "critical"},
])

# On a new build, recheck bugs that are still open:
for b in bl.open_bugs("Dungeon Escape"):
    run.recheck(b["id"], reproduced=still_happens(b), attempts=3)`

const CURL = `curl -X POST ${ORIGIN}/api/v1/ingest/runs \\
  -H "X-Engine-Key: $BUGLENS_ENGINE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"project": "Dungeon Escape", "build": "1.0.0", "agent": "Explorer-LLM"}'
# -> {"run_id": 1}

curl -X POST ${ORIGIN}/api/v1/ingest/runs/1/bugs \\
  -H "X-Engine-Key: $BUGLENS_ENGINE_KEY" -H "Content-Type: application/json" \\
  -d '{"title": "Player can walk through wall tiles", "fingerprint": "collision-wall-clip",
       "severity": "high", "expected": "Blocked", "actual": "Inside wall"}'`

const CI = `# .github/workflows/buglens.yml
name: BugLens QA
on: [push]
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build game
        run: ./scripts/build_game.sh            # your build
      - name: Run BugLens engine
        env:
          BUGLENS_URL: \${{ secrets.BUGLENS_URL }}
          BUGLENS_ENGINE_KEY: \${{ secrets.BUGLENS_ENGINE_KEY }}
        run: |
          python engine/play.py \\
            --build "\${{ github.sha }}" \\
            --buglens "$BUGLENS_URL"            # engine posts runs, bugs, rechecks`

const BUG_FIELDS: [string, boolean, string][] = [
  ['title', true, 'What the bug is; shown everywhere'],
  ['fingerprint', false, 'Stable id. Needed for dedup across runs, fix/regression tracking and the QA scorecard'],
  ['steps', false, 'Reproduction steps for developers'],
  ['expected / actual', false, 'The core evidence: what should happen vs what did'],
  ['screenshots', false, 'Frames at the moment of failure (base64 or multipart, ≤10 MB each)'],
  ['logs', false, 'Exact engine log lines; the AI cites these as evidence'],
  ['severity', false, 'critical | high | medium | low (default medium)'],
  ['category', false, 'collision, logic, ui, perf…; used for filters'],
  ['confidence', false, '0–1, engine confidence in the finding'],
]
const RUN_FIELDS: [string, boolean, string][] = [
  ['project', true, 'Game name; created automatically'],
  ['build', true, 'Version under test; fixed/regression is tracked per build'],
  ['agent', false, 'Which bot/agent played'],
  ['stats.duration_s', false, 'Play time; powers engine-vs-manual comparison'],
  ['stats.llm_input_tokens / llm_output_tokens / llm_cost_usd', false, 'Engine LLM spend; powers the Usage page'],
]

function FieldTable({ title, rows }: { title: string; rows: [string, boolean, string][] }) {
  return (
    <div>
      <div className="label mb-2">{title}</div>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map(([f, req, why]) => (
              <tr key={f} className="align-top">
                <td className="w-2/5 px-4 py-2.5 font-mono text-xs text-violet-200">{f}</td>
                <td className="w-24 px-2 py-2.5">{req ? <Pill className="border-violet-400/30 bg-violet-500/10 text-violet-200">required</Pill> : <span className="text-xs text-zinc-600">optional</span>}</td>
                <td className="px-4 py-2.5 text-zinc-400">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Integrations</h1>
          <p className="mt-1 text-sm text-zinc-500">Any game engine can report to BugLens over HTTP. Python engines can use the SDK, which needs only the standard library.</p>
        </div>
        <a href={API_DOCS} target="_blank" rel="noreferrer" className="btn"><ExternalLink className="size-4" />API reference</a>
      </div>

      <Card title={<span className="flex items-center gap-2"><Plug className="size-4 text-violet-300" />Connect your engine in 3 steps</span>}>
        <div className="space-y-7">
          <Step n={1} title="Add the client">
            <p>Copy <code className="text-zinc-200">sdk/buglens_client.py</code> into your engine. It only uses the standard library, so nothing to install. Set the shared secret <code className="text-zinc-200">BUGLENS_ENGINE_KEY</code> on both sides.</p>
          </Step>
          <Step n={2} title="Report runs, bugs and rechecks">
            <p>Open a run per play session, report each finding with its evidence, recheck it, and attach stats.</p>
            <Code lang="python" code={PY_RUN} />
          </Step>
          <Step n={3} title="Declare planted bugs and recheck open ones">
            <p>Planted bugs give the QA Scorecard its ground truth. On every new build, recheck open bugs: no longer reproducing marks them fixed, and coming back flags a regression.</p>
            <Code lang="python" code={PY_PLANTED} />
          </Step>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Terminal className="size-4 text-sky-300" />Any language: plain HTTP</span>}>
          <Code lang="bash" code={CURL} />
          <p className="mt-3 text-xs text-zinc-500">Flow: <code className="text-zinc-400">runs → logs → bugs → rechecks → finish</code>. Full payloads in <code className="text-zinc-400">docs/ENGINE_API.md</code>.</p>
        </Card>
        <Card title={<span className="flex items-center gap-2"><GitBranch className="size-4 text-emerald-300" />Run on every commit (CI)</span>}>
          <Code lang="yaml" code={CI} />
          <p className="mt-3 text-xs text-zinc-500">Each push builds the game, the engine plays it, and bugs land here tagged with the commit as the build.</p>
        </Card>
      </div>

      <Card title={<span className="flex items-center gap-2"><FileCode2 className="size-4 text-amber-300" />Data requirements</span>}>
        <p className="mb-4 text-sm text-zinc-400">Only <code className="text-zinc-200">title</code>, <code className="text-zinc-200">project</code> and <code className="text-zinc-200">build</code> are required. Each optional field unlocks a feature.</p>
        <div className={cn('grid gap-5')}>
          <FieldTable title="Bug report" rows={BUG_FIELDS} />
          <FieldTable title="Run" rows={RUN_FIELDS} />
        </div>
      </Card>
    </div>
  )
}
