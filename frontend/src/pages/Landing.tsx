import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react'
import { api } from '../api'
import { Nav, Logo } from '../components/landing/Nav'
import { Hero } from '../components/landing/Hero'
import { Lifecycle } from '../components/landing/Lifecycle'
import { ButtonLink, CodeBlock, Figure, LiveTag, Section, container, focusRing } from '../components/landing/primitives'

const REPO = 'https://github.com/yusif-v/NeuroBridge'
const ENGINE_DOCS = `${REPO}/blob/main/docs/ENGINE_API.md`

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const usd = (v: number | null | undefined) =>
  v == null ? '—' : v < 0.01 ? `$${v.toFixed(4)}` : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`

const SDK_SNIPPET = `from sdk.buglens_client import BugLens

bl = BugLens("http://localhost:8000", key="dev-engine-key")

# Ground truth for the QA scorecard (optional)
bl.known_issues("Dungeon Escape", "1.0.0", [
    {"fingerprint": "collision-wall-clip", "title": "Player walks through walls"},
])

with bl.run("Dungeon Escape", "1.0.0", agent="Explorer-LLM") as run:
    run.log("Spawned at (1,1)")
    bug = run.bug(
        "Player can walk through wall tiles",
        fingerprint="collision-wall-clip",
        severity="high",
        steps=["Start new game", "Move to (3,1)", "Press RIGHT"],
        expected="Movement is blocked by the wall",
        actual="Player position is inside a WALL tile",
        screenshots=["frame_0142.png"],
    )
    bug.recheck(reproduced=True, attempts=3)
    run.stats(duration_s=212, llm_cost_usd=0.034)`

const PIPELINE = [
  {
    n: '01', title: 'Play',
    body: 'An agent plays the build like a tester would — moving, colliding, dying, winning — and captures screenshots, logs and exact steps for anything that looks wrong.',
  },
  {
    n: '02', title: 'Recheck',
    body: 'Before anything is reported, the engine replays the steps from a clean state. A finding that does not reproduce is kept for audit but never becomes a bug.',
  },
  {
    n: '03', title: 'Explain',
    body: 'An LLM reads only the verified evidence and writes a summary, likely root cause and suggested fix — labelled as a hypothesis and linked to the log lines it relies on.',
  },
  {
    n: '04', title: 'Prove',
    body: 'The platform tracks every bug across builds: fixed only when a retest stops reproducing it, reopened as a regression when it comes back.',
  },
]

const PROBLEMS = [
  { k: 'Slow', v: 'Manual QA replays the same paths every build. Hours per pass, and the coverage still depends on who is testing.' },
  { k: 'Noisy', v: 'Automated bots and AI report everything they see. Teams waste time triaging flaky or hallucinated "bugs".' },
  { k: 'Unprovable', v: 'A report without reproduction steps, frames and logs is a claim, not a bug. Nobody can verify the fix either.' },
]

const PRINCIPLES = [
  ['Nothing counts until it reproduces.', 'A finding becomes a bug only after the engine replays it successfully.'],
  ['Fixed means a retest says so.', 'Status changes to fixed only when a newer build no longer reproduces the bug — never by an AI claim.'],
  ['AI is a hypothesis, not a verdict.', 'Root cause and fix are shown separately from evidence, each linked to the exact log lines used.'],
  ['Every step is on the record.', 'Found, rechecked, confirmed, analysed, fixed, regressed — written to an evidence trail per bug.'],
]

const METRICS = [
  ['Detection rate', 'Share of bugs planted on purpose in a build that the engine found and confirmed.'],
  ['Misses', 'Planted bugs the engine never found, or found but could not reproduce.'],
  ['Precision', 'Confirmed bugs that a reviewer did not mark as false positives.'],
  ['False positives', 'Bugs a human reviewer rejected after confirmation.'],
  ['Noise filtered', 'Raw findings the recheck stopped before they reached anyone.'],
  ['Engine vs manual', 'Time, bugs found and cost against a logged manual test session on the same build.'],
]

const DATA_FIELDS: [string, string, string][] = [
  ['title', 'Required', 'What went wrong, in one line'],
  ['build', 'Required', 'Which version was played (per run)'],
  ['steps', 'Recommended', 'How to reproduce; used by the recheck'],
  ['expected / actual', 'Recommended', 'The rule that was broken'],
  ['screenshots', 'Recommended', 'Frames at the moment of failure'],
  ['logs', 'Recommended', 'Raw engine events backing the claim'],
  ['fingerprint', 'Recommended', 'Stable ID for dedup across runs and the scorecard'],
]

const ROADMAP = [
  ['Engine plugins', 'Native Unity and Unreal adapters on top of the HTTP API.'],
  ['Tracker sync', 'Two-way Jira and Linear tickets for confirmed bugs.'],
  ['Visual bugs', 'Vision models to flag rendering and UI glitches from frames.'],
  ['CI gating', 'Fail a build pipeline when a regression or critical bug is confirmed.'],
  ['Teams', 'Multiple projects, authentication and role-based access.'],
]

const FAQ = [
  ['Does the AI find the bugs?',
    'No. The engine finds problems by playing the game and rechecks each one. The AI only explains bugs that were already reproduced, and its output is labelled as a hypothesis.'],
  ['What counts as a false positive?',
    'A bug that was confirmed by recheck but rejected by a human reviewer. Findings that never reproduce are tracked separately as noise and never counted as bugs.'],
  ['How is cost measured?',
    'Every AI analysis records its tokens, cost and latency. The engine reports its own LLM tokens and cost per run. The Usage page shows totals, cost per run and cost per confirmed bug.'],
  ['Which game engines are supported?',
    'Anything that can send HTTP. A dependency-free Python SDK is included, and the repository contains a playable Godot demo wired to the platform.'],
  ['Where is the data stored?',
    'In a self-hosted SQLite database, with screenshots on local disk. Nothing leaves your machine except the AI calls you configure.'],
]

function Problem() {
  return (
    <Section
      id="problem" num="01" label="Problem"
      title="Testing games is slow. AI bug reports are noisy."
      intro="Studios need bugs they can trust: reproducible, documented and verifiable after the fix. Speed without evidence just moves the work to triage."
    >
      <div className="grid grid-cols-1 border-t border-white/[0.07] md:grid-cols-3">
        {PROBLEMS.map((p, i) => (
          <div key={p.k} className="border-b border-white/[0.07] py-8 md:border-b-0 md:py-10 md:pr-10 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:pl-10">
            <p className="font-mono text-xs text-zinc-600">{String(i + 1).padStart(2, '0')}</p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">{p.k}</h3>
            <p className="mt-3 leading-relaxed text-zinc-400">{p.v}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function HowItWorks() {
  return (
    <Section
      id="how" num="02" label="How it works"
      title="Play. Recheck. Explain. Prove."
      intro="Four stages, each with a single job. The engine and the AI never grade their own work — the evidence does."
    >
      <ol className="grid grid-cols-1 gap-px border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE.map((s) => (
          <li key={s.n} className="flex flex-col bg-[#09090f] p-6 md:p-8">
            <span className="font-mono text-sm text-violet-400">{s.n}</span>
            <h3 className="mt-12 text-3xl font-semibold tracking-[-0.03em] text-white">{s.title}</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Evidence() {
  return (
    <Section
      id="evidence" num="03" label="Evidence over claims"
      title="A bug is a record, not a sentence."
      intro="Most AI QA tools stop at writing a report. BugLens treats every bug as a lifecycle with proof attached at each step."
    >
      <Lifecycle />
      <dl className="mt-16 grid grid-cols-1 gap-x-10 md:grid-cols-2">
        {PRINCIPLES.map(([k, v]) => (
          <div key={k} className="border-t border-white/[0.07] py-6">
            <dt className="text-lg font-semibold tracking-tight text-white">{k}</dt>
            <dd className="mt-2 leading-relaxed text-zinc-400">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function Quality() {
  const sc = useQuery({ queryKey: ['landing', 'scorecard'], queryFn: () => api.scorecard(), retry: false })
  const d = sc.data
  const hasData = !!d?.project && (d.planted ?? 0) > 0
  return (
    <Section
      id="quality" num="04" label="Measured quality"
      title="We plant bugs on purpose, then keep score."
      intro="Each build ships with a list of deliberately planted bugs. The QA Scorecard compares what the engine found against that ground truth — and against a manual test session."
    >
      {hasData && d && (
        <div className="mb-16">
          <LiveTag>Live, from the current dataset · {d.project}</LiveTag>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            <Figure label="Detection rate" value={pct(d.detection_rate)} note={`${d.detected} of ${d.planted} planted bugs`} />
            <Figure label="Noise filtered" value={d.noise_filtered ?? 0} note={`${pct(d.noise_filter_rate)} of raw findings`} />
            <Figure label="False positives" value={d.false_positives ?? 0} note="marked by a reviewer" />
            {d.comparison
              ? <Figure label="Vs manual" value={`${d.comparison.speedup}×`} note="faster on logged sessions" />
              : <Figure label="Engine time" value={`${d.engine?.minutes ?? 0}m`} note={`${d.engine?.runs ?? 0} runs played`} />}
          </dl>
        </div>
      )}
      <div className="grid grid-cols-12 gap-x-6 gap-y-10">
        <dl className="col-span-12 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:col-span-9">
          {METRICS.map(([k, v]) => (
            <div key={k} className="border-t border-white/[0.07] py-5">
              <dt className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-300">{k}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-zinc-400">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="col-span-12 lg:col-span-3 lg:pl-6">
          <ButtonLink href="/app/scorecard" variant="secondary">Open the scorecard <ArrowRight className="size-4" aria-hidden /></ButtonLink>
        </div>
      </div>
    </Section>
  )
}

function Cost() {
  const u = useQuery({ queryKey: ['landing', 'usage'], queryFn: () => api.usage(), retry: false })
  const unit = u.data?.unit
  const hasData = !!u.data && u.data.engine.runs > 0
  return (
    <Section
      id="cost" num="05" label="Cost & feasibility"
      title="Priced per run. Measured, not estimated."
      intro="Every AI call and every engine run reports its tokens and cost, so the price of a confirmed bug is a number on a dashboard rather than a guess on a slide."
    >
      <div className="grid grid-cols-12 gap-x-6 gap-y-14">
        <div className="col-span-12 lg:col-span-5">
          {hasData && unit ? (
            <>
              <LiveTag>Measured on this instance</LiveTag>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-8">
                <Figure label="Per run" value={usd(unit.cost_per_run_usd)} />
                <Figure label="Per confirmed bug" value={usd(unit.cost_per_confirmed_bug_usd)} />
              </dl>
            </>
          ) : (
            <p className="text-zinc-500">Cost figures appear here once runs have been reported.</p>
          )}
          <h3 className="mt-14 text-xl font-semibold tracking-tight text-white">How a studio uses it</h3>
          <ol className="mt-5 space-y-0">
            {[
              ['SDK', 'Drop the client into the engine, or call the HTTP API.'],
              ['CI', 'Run the bug hunter on every build, alongside the game build.'],
              ['Report', 'Triage confirmed bugs, export HTML or CSV, verify fixes on the next build.'],
            ].map(([k, v], i) => (
              <li key={k} className="flex gap-5 border-t border-white/[0.07] py-4">
                <span className="w-6 shrink-0 font-mono text-xs leading-6 text-violet-400">{String(i + 1).padStart(2, '0')}</span>
                <p className="leading-6 text-zinc-400"><span className="font-medium text-zinc-200">{k}.</span> {v}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <h3 className="text-xl font-semibold tracking-tight text-white">What the engine sends</h3>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Data the engine sends for each bug</caption>
              <thead>
                <tr className="border-b border-white/15">
                  <th scope="col" className="py-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-zinc-500">Field</th>
                  <th scope="col" className="py-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-zinc-500">Need</th>
                  <th scope="col" className="py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-zinc-500">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {DATA_FIELDS.map(([f, need, purpose]) => (
                  <tr key={f} className="border-b border-white/[0.07]">
                    <th scope="row" className="py-3 pr-4 font-mono text-[13px] font-normal text-zinc-200">{f}</th>
                    <td className={`py-3 pr-4 ${need === 'Required' ? 'text-violet-300' : 'text-zinc-500'}`}>{need}</td>
                    <td className="py-3 text-zinc-400">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/app/usage" variant="secondary">Usage & cost</ButtonLink>
            <ButtonLink href="/app/integrations" variant="secondary">Integration guide</ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  )
}

function Integrate() {
  return (
    <Section
      id="integrate" num="06" label="Integrate"
      title="Connect an engine in minutes."
      intro="A single dependency-free Python file. Start a run, report what you find, recheck it, finish. Any other language can call the same HTTP endpoints."
    >
      <div className="grid grid-cols-12 gap-x-6 gap-y-10">
        <div className="col-span-12 lg:col-span-8">
          <CodeBlock label="engine.py" code={SDK_SNIPPET} />
        </div>
        <ul className="col-span-12 lg:col-span-4">
          {[
            ['Runs & logs', 'One run per play session, with timestamped events.'],
            ['Bugs & screenshots', 'Base64 or multipart uploads, deduplicated by fingerprint.'],
            ['Rechecks', 'Reproduced or not — the platform applies the lifecycle.'],
            ['Planted bugs', 'Optional ground truth for the scorecard.'],
          ].map(([k, v]) => (
            <li key={k} className="border-t border-white/[0.07] py-4">
              <p className="font-medium text-zinc-200">{k}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{v}</p>
            </li>
          ))}
          <li className="border-t border-white/[0.07] pt-6">
            <a href={ENGINE_DOCS} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-violet-300 hover:text-violet-200 ${focusRing}`}>
              Engine API reference <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </li>
        </ul>
      </div>
    </Section>
  )
}

function Roadmap() {
  return (
    <Section
      id="roadmap" num="07" label="Next"
      title="What comes after the hackathon."
      intro="The core loop works end to end today. These are the next steps — none of them are built yet."
    >
      <ol className="border-t border-white/[0.07]">
        {ROADMAP.map(([k, v], i) => (
          <li key={k} className="grid grid-cols-12 items-baseline gap-x-6 border-b border-white/[0.07] py-6">
            <span className="col-span-2 font-mono text-xs text-zinc-600 md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="col-span-10 text-xl font-semibold tracking-tight text-white md:col-span-4 md:text-2xl">{k}</h3>
            <p className="col-span-10 col-start-3 mt-1 text-zinc-400 md:col-span-6 md:col-start-auto md:mt-0">{v}</p>
            <span className="col-span-12 mt-3 hidden font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 md:col-span-1 md:mt-0 md:block md:text-right">Next</span>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Faq() {
  return (
    <Section id="faq" num="08" label="FAQ" title="Questions, answered plainly.">
      <div className="border-t border-white/[0.07]">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border-b border-white/[0.07]">
            <summary className={`flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-medium text-zinc-100 marker:hidden hover:text-white md:text-xl [&::-webkit-details-marker]:hidden ${focusRing}`}>
              {q}
              <Plus className="size-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden />
            </summary>
            <p className="max-w-3xl pb-6 leading-relaxed text-zinc-400">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

function Cta() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-white/[0.07] bg-[#11111a]">
      <div className={`${container} grid grid-cols-12 gap-6 py-20 md:py-28`}>
        <h2 id="cta-title" className="col-span-12 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl lg:col-span-8 lg:text-6xl">
          See the evidence for yourself.
        </h2>
        <div className="col-span-12 flex flex-wrap items-end gap-3 lg:col-span-4 lg:justify-end">
          <ButtonLink href="/app">Open the platform <ArrowRight className="size-4" aria-hidden /></ButtonLink>
          <ButtonLink href={ENGINE_DOCS} variant="secondary" external>Read the engine API <ArrowUpRight className="size-4" aria-hidden /></ButtonLink>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className={`${container} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
        <Logo />
        <p className="text-sm text-zinc-500">NeuroBridge hackathon project</p>
        <a href={REPO} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-sm text-sm text-zinc-400 hover:text-white ${focusRing}`}>
          GitHub <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </div>
    </footer>
  )
}

export function LandingPage() {
  useEffect(() => {
    document.title = 'BugLens AI — Game QA that shows its evidence'
    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce) root.style.scrollBehavior = 'smooth'
    return () => { root.style.scrollBehavior = '' }
  }, [])

  return (
    // Solid background: the landing page intentionally avoids the app's decorative glow.
    <div id="top" className="min-h-full bg-[#09090f] text-[#e4e4ef]">
      <a href="#main" className="sr-only z-50 rounded-sm bg-violet-500 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Problem />
        <HowItWorks />
        <Evidence />
        <Quality />
        <Cost />
        <Integrate />
        <Roadmap />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
