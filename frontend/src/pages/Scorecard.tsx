import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleDashed, Clock, Crosshair, Filter, Plus, ShieldAlert, ShieldCheck, Sparkles, Target, Trash2, UserRound, XCircle, Zap } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, cn, fmtDate, pct, usd } from '../lib'
import type { BugSummary, PlantedOutcome, Scorecard, Severity } from '../types'
import { Card, Empty, ErrorNote, Pill, Select, SeverityBadge, Skeleton } from '../components/ui'

const OUTCOME: Record<PlantedOutcome, { label: string; cls: string; icon: ReactNode; hint: string }> = {
  detected: { label: 'Detected', cls: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300', icon: <CheckCircle2 className="size-3" />, hint: 'Engine reported it and the recheck reproduced it' },
  missed: { label: 'Missed', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300', icon: <XCircle className="size-3" />, hint: 'Planted in this build but the engine never reported it' },
  rejected_by_recheck: { label: 'Rejected by recheck', cls: 'border-amber-400/30 bg-amber-500/10 text-amber-200', icon: <ShieldAlert className="size-3" />, hint: 'Engine reported it but the recheck could not reproduce it' },
  awaiting_recheck: { label: 'Awaiting recheck', cls: 'border-zinc-600/40 bg-zinc-700/20 text-zinc-400', icon: <CircleDashed className="size-3" />, hint: 'Reported, recheck not done yet' },
}

function OutcomeBadge({ outcome }: { outcome: PlantedOutcome }) {
  const o = OUTCOME[outcome]
  return <Pill className={o.cls} title={o.hint}>{o.icon}{o.label}</Pill>
}

function Hero({ label, value, sub, icon, accent, big }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; accent: string; big?: boolean }) {
  return (
    <div className={cn('glass group relative overflow-hidden p-4', big && 'md:col-span-2 xl:col-span-1')}>
      <div className={cn('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-25 blur-2xl transition group-hover:opacity-40', accent)} />
      <div className="flex items-center justify-between"><span className="label">{label}</span><span className="text-zinc-500">{icon}</span></div>
      <div className={cn('mt-2 font-semibold tabular-nums tracking-tight text-white', big ? 'text-4xl' : 'text-3xl')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

function BugList({ bugs, empty }: { bugs: BugSummary[]; empty: string }) {
  if (bugs.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>
  return (
    <div className="-mx-2 divide-y divide-white/[0.05]">
      {bugs.map((b) => (
        <Link key={b.id} to={`/bugs?bug=${b.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]">
          <span className="w-16 shrink-0 font-mono text-xs text-violet-300">{b.key}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{b.title}</span>
          <SeverityBadge severity={b.severity} />
        </Link>
      ))}
    </div>
  )
}

function CompareRow({ label, engine, manual, better }: { label: string; engine: ReactNode; manual: ReactNode; better?: 'engine' | 'manual' | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/[0.05] py-2.5 text-sm last:border-0">
      <span className="text-zinc-400">{label}</span>
      <span className={cn('w-24 text-right tabular-nums', better === 'engine' ? 'font-semibold text-emerald-300' : 'text-zinc-200')}>{engine}</span>
      <span className={cn('w-24 text-right tabular-nums', better === 'manual' ? 'font-semibold text-emerald-300' : 'text-zinc-400')}>{manual}</span>
    </div>
  )
}

function better(a: number | null | undefined, b: number | null | undefined, lowerIsBetter = false): 'engine' | 'manual' | null {
  if (a == null || b == null || a === b) return null
  return (lowerIsBetter ? a < b : a > b) ? 'engine' : 'manual'
}

function EngineVsManual({ sc, rate, setRate }: { sc: Scorecard; rate: string; setRate: (v: string) => void }) {
  const e = sc.engine
  const m = sc.manual
  return (
    <Card title={<span className="flex items-center gap-2"><Zap className="size-4 text-fuchsia-300" />Engine vs manual testing</span>}
      action={sc.comparison && <Pill className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">{sc.comparison.speedup}× faster</Pill>}>
      {!e ? <Empty title="No runs in scope" /> : (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            <span />
            <span className="w-24 text-right text-violet-300">BugLens</span>
            <span className="w-24 text-right">Manual</span>
          </div>
          <CompareRow label="Time spent" engine={`${e.minutes} min`} manual={m ? `${m.minutes} min` : '—'} better={better(e.minutes, m?.minutes, true)} />
          <CompareRow label="Real bugs found" engine={e.bugs_found} manual={m?.bugs_found ?? '—'} better={better(e.bugs_found, m?.bugs_found)} />
          <CompareRow label="Planted bugs found" engine={`${e.planted_found}${sc.planted ? ` / ${sc.planted}` : ''}`} manual={m?.planted_found ?? '—'} better={better(e.planted_found, m?.planted_found)} />
          <CompareRow label="False positives" engine={e.false_positives} manual={m?.false_positives ?? '—'} better={better(e.false_positives, m?.false_positives, true)} />
          <CompareRow label="Bugs / hour" engine={sc.comparison?.bugs_per_hour_engine ?? (e.minutes > 0 ? (e.bugs_found / (e.minutes / 60)).toFixed(1) : '—')} manual={sc.comparison?.bugs_per_hour_manual ?? '—'} better={better(sc.comparison?.bugs_per_hour_engine, sc.comparison?.bugs_per_hour_manual)} />
          <CompareRow label="Cost" engine={usd(e.cost_usd)} manual={m ? usd(m.cost_usd) : '—'} better={better(e.cost_usd, m?.cost_usd, true)} />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
              <div className="label mb-1.5">BugLens cost breakdown</div>
              <div className="flex justify-between text-zinc-400"><span>Engine LLM</span><span className="tabular-nums text-zinc-200">{usd(e.cost_breakdown.engine_llm_usd)}</span></div>
              <div className="flex justify-between text-zinc-400"><span>AI analysis</span><span className="tabular-nums text-zinc-200">{usd(e.cost_breakdown.ai_analysis_usd)}</span></div>
            </div>
            <label className="rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-3 text-xs">
              <div className="label mb-1.5 text-amber-200/80">Assumption · tester rate</div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">$</span>
                <input type="number" min={1} step={1} value={rate} onChange={(ev) => setRate(ev.target.value)} className="input py-1 tabular-nums" />
                <span className="shrink-0 text-zinc-500">/ hour</span>
              </div>
            </label>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            BugLens time = sum of <code className="text-zinc-400">duration_s</code> the engine reports per run ({e.runs} run{e.runs === 1 ? '' : 's'}).
            {m ? ` Manual = ${m.sessions} logged session${m.sessions === 1 ? '' : 's'}.` : ' Log a manual session below to compare.'}
          </p>
        </>
      )}
    </Card>
  )
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

function AddPlanted({ project, builds, defaultBuild }: { project: string; builds: string[]; defaultBuild: string }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ build: '', fingerprint: '', title: '', category: '', severity: '' })
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const add = useMutation({
    mutationFn: () => api.addKnownIssues({
      project, build: f.build || defaultBuild,
      issues: [{ fingerprint: f.fingerprint.trim(), title: f.title.trim(), category: f.category.trim() || undefined, severity: (f.severity || undefined) as Severity | undefined }],
    }),
    onSuccess: () => {
      setF((s) => ({ ...s, fingerprint: '', title: '', category: '' }))
      qc.invalidateQueries({ queryKey: ['scorecard'] })
    },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.fingerprint.trim() && f.title.trim()) add.mutate() }
  return (
    <Card title={<span className="flex items-center gap-2"><Crosshair className="size-4 text-violet-300" />Add planted bug</span>}>
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select label={`Build (${defaultBuild || '—'})`} value={f.build} options={builds} onChange={set('build')} />
          <Select label="Severity" value={f.severity} options={SEVERITIES} onChange={set('severity')} />
        </div>
        <input className="input font-mono text-xs" placeholder="Fingerprint (same as the engine uses)" value={f.fingerprint} onChange={(e) => set('fingerprint')(e.target.value)} />
        <input className="input" placeholder="Title" value={f.title} onChange={(e) => set('title')(e.target.value)} />
        <input className="input" placeholder="Category (optional)" value={f.category} onChange={(e) => set('category')(e.target.value)} />
        {add.error && <p className="text-xs text-rose-300">{(add.error as Error).message}</p>}
        <button className="btn-primary w-full justify-center" disabled={add.isPending || !f.fingerprint.trim() || !f.title.trim() || !(f.build || defaultBuild)}>
          <Plus className="size-4" />Add planted bug
        </button>
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Engines can send these automatically with <code className="text-zinc-400">client.known_issues(project, build, [...])</code>.</p>
    </Card>
  )
}

function ManualSessions({ sc, project, builds, defaultBuild }: { sc: Scorecard; project: string; builds: string[]; defaultBuild: string }) {
  const qc = useQueryClient()
  const empty = { build: '', tester: '', duration_min: '', bugs_found: '', planted_found: '', false_positives: '', notes: '' }
  const [f, setF] = useState(empty)
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const invalidate = () => qc.invalidateQueries({ queryKey: ['scorecard'] })
  const add = useMutation({
    mutationFn: () => api.addManualSession({
      project,
      build: f.build || defaultBuild || undefined,
      tester: f.tester.trim() || undefined,
      duration_min: Number(f.duration_min),
      bugs_found: Number(f.bugs_found || 0),
      planted_found: f.planted_found === '' ? undefined : Number(f.planted_found),
      false_positives: Number(f.false_positives || 0),
      notes: f.notes.trim() || undefined,
    }),
    onSuccess: () => { setF(empty); invalidate() },
  })
  const del = useMutation({ mutationFn: api.deleteManualSession, onSuccess: invalidate })
  const valid = Number(f.duration_min) > 0
  const num = (k: keyof typeof f, placeholder: string) => (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{placeholder}</span>
      <input type="number" min={0} step="any" className="input tabular-nums" value={f[k]} onChange={(e) => set(k)(e.target.value)} />
    </label>
  )
  const sessions = sc.manual_sessions ?? []
  return (
    <Card title={<span className="flex items-center gap-2"><UserRound className="size-4 text-sky-300" />Manual test sessions</span>}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) add.mutate() }} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select label={`Build (${defaultBuild || 'any'})`} value={f.build} options={builds} onChange={set('build')} />
          <input className="input" placeholder="Tester" value={f.tester} onChange={(e) => set('tester')(e.target.value)} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {num('duration_min', 'Minutes *')}
          {num('bugs_found', 'Bugs found')}
          {num('planted_found', 'Planted found')}
          {num('false_positives', 'False pos.')}
        </div>
        <input className="input" placeholder="Notes (optional)" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
        {add.error && <p className="text-xs text-rose-300">{(add.error as Error).message}</p>}
        <button className="btn w-full justify-center" disabled={add.isPending || !valid}><Plus className="size-4" />Log session</button>
      </form>
      <div className="mt-4">
        {sessions.length === 0 ? (
          <p className="text-xs leading-relaxed text-zinc-500">No manual sessions for this scope. Have a teammate play the same build by hand, then log time and bugs found here.</p>
        ) : (
          <div className="-mx-2 divide-y divide-white/[0.05]">
            {sessions.map((s) => (
              <div key={s.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
                <Clock className="size-3.5 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1 truncate text-zinc-300">{s.tester || 'Tester'} <span className="text-zinc-500">· {s.duration_min} min · {s.bugs_found} bugs{s.planted_found != null ? ` · ${s.planted_found} planted` : ''} · {s.false_positives} FP</span></span>
                <span className="shrink-0 text-xs text-zinc-500">{fmtDate(s.created_at)}</span>
                <button title="Delete session" onClick={() => del.mutate(s.id)} className="rounded-md p-1 text-zinc-600 opacity-0 transition hover:bg-white/[0.06] hover:text-rose-300 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

export function ScorecardPage() {
  const qc = useQueryClient()
  const builds = useQuery({ queryKey: ['builds'], queryFn: api.builds })
  const [project, setProject] = useState('')
  const [build, setBuild] = useState<string | null>(null) // null = default (latest), '' = all builds
  const [rate, setRate] = useState('')

  const projects = [...new Set(builds.data?.map((b) => b.project) ?? [])]
  const activeProject = project || builds.data?.[0]?.project || ''
  const projectBuilds = (builds.data ?? []).filter((b) => b.project === activeProject).map((b) => b.version) // newest first
  const activeBuild = build ?? projectBuilds[0] ?? ''

  const sc = useQuery({
    queryKey: ['scorecard', activeProject, activeBuild, rate],
    queryFn: () => api.scorecard({ project: activeProject || undefined, build: activeBuild || undefined, hourly_rate: Number(rate) > 0 ? Number(rate) : undefined }),
    enabled: builds.isSuccess,
    refetchInterval: LIVE_MS * 2,
    placeholderData: (prev) => prev,
  })
  const deleteKnown = useMutation({ mutationFn: api.deleteKnownIssue, onSuccess: () => qc.invalidateQueries({ queryKey: ['scorecard'] }) })

  const d = sc.data
  const rateValue = rate || String(d?.assumptions?.manual_hourly_rate_usd ?? '')
  const scopeLabel = activeBuild ? `build ${activeBuild}` : 'all builds'
  const ascBuilds = [...projectBuilds].reverse()

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">QA Scorecard</h1>
          <p className="mt-1 text-sm text-zinc-500">How well the engine catches bugs we planted on purpose, how much noise the recheck removes, and how it compares to manual testing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && (
            <div className="w-44"><Select label="Project" value={activeProject} options={projects} onChange={(v) => { setProject(v); setBuild(null) }} /></div>
          )}
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {['', ...ascBuilds].map((v) => (
              <button key={v || 'all'} onClick={() => setBuild(v)}
                className={cn('rounded-lg px-3 py-1.5 text-sm transition', activeBuild === v ? 'bg-violet-500/20 text-white ring-1 ring-inset ring-violet-400/30' : 'text-zinc-400 hover:text-zinc-200', v && 'font-mono')}>
                {v || 'All builds'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(builds.error || sc.error) && <ErrorNote error={builds.error || sc.error} />}

      {builds.isSuccess && builds.data.length === 0 ? (
        <div className="glass"><Empty icon={<Target className="size-5" />} title="No data yet" hint="Once the engine sends runs and planted bugs, detection metrics appear here." /></div>
      ) : !d ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <Hero big label="Detection rate" icon={<Target className="size-4" />} accent="bg-emerald-500"
              value={d.planted ? pct(d.detection_rate) : '—'}
              sub={d.planted ? `${d.detected} of ${d.planted} planted bugs · ${scopeLabel}` : 'No planted bugs declared'} />
            <Hero label="Precision" icon={<ShieldCheck className="size-4" />} accent="bg-violet-500"
              value={pct(d.precision)} sub={`${d.reported_confirmed ?? 0} confirmed, human-reviewed`} />
            <Hero label="False positives" icon={<XCircle className="size-4" />} accent="bg-rose-500"
              value={d.false_positives ?? 0} sub="marked by a reviewer" />
            <Hero label="Noise filtered" icon={<Filter className="size-4" />} accent="bg-amber-500"
              value={d.noise_filtered ?? 0} sub={d.raw_findings ? `${pct(d.noise_filter_rate)} of ${d.raw_findings} raw findings rejected by recheck` : 'rejected by recheck'} />
            <Hero label="Unplanned findings" icon={<Sparkles className="size-4" />} accent="bg-sky-500"
              value={d.unplanned_findings ?? 0} sub="confirmed, not on the planted list" />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3" title={<span className="flex items-center gap-2"><Crosshair className="size-4 text-violet-300" />Planted bugs <span className="font-normal text-zinc-500">· {scopeLabel}</span></span>}>
              {!d.planted_issues?.length ? (
                <Empty icon={<Crosshair className="size-5" />} title="No planted bugs declared"
                  hint={<>Have the engine call <code className="text-zinc-400">known_issues()</code> for each build, or add them on the right. Their fingerprints must match what the engine reports.</>} />
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="label border-b border-white/[0.06] text-left">
                      <th className="px-5 py-2 font-medium">Build</th><th className="px-3 py-2 font-medium">Planted bug</th><th className="px-3 py-2 font-medium">Severity</th><th className="px-3 py-2 font-medium">Outcome</th><th className="px-3 py-2 font-medium">Bug</th><th className="w-8" />
                    </tr></thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {d.planted_issues.map((k) => (
                        <tr key={k.id} className="group hover:bg-white/[0.02]">
                          <td className="px-5 py-2.5 font-mono text-xs text-zinc-400">{k.build}</td>
                          <td className="px-3 py-2.5"><div className="text-zinc-200">{k.title}</div><div className="font-mono text-[11px] text-zinc-500">{k.fingerprint}{k.source === 'manual' && <span className="ml-2 font-sans text-zinc-600">· added manually</span>}</div></td>
                          <td className="px-3 py-2.5">{k.severity ? <SeverityBadge severity={k.severity} /> : <span className="text-zinc-600">—</span>}</td>
                          <td className="px-3 py-2.5"><OutcomeBadge outcome={k.outcome} /></td>
                          <td className="px-3 py-2.5">{k.bug_id ? <Link to={`/bugs?bug=${k.bug_id}`} className="font-mono text-xs text-violet-300 hover:underline">{k.bug_key}</Link> : <span className="text-zinc-600">—</span>}</td>
                          <td className="pr-4"><button title="Remove planted bug" onClick={() => deleteKnown.mutate(k.id)} className="rounded-md p-1 text-zinc-600 opacity-0 transition hover:bg-white/[0.06] hover:text-rose-300 group-hover:opacity-100"><Trash2 className="size-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <div className="xl:col-span-2"><EngineVsManual sc={d} rate={rateValue} setRate={setRate} /></div>
          </div>

          {!activeBuild && (d.per_build?.length ?? 0) > 0 && (
            <Card title="Per build">
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="label border-b border-white/[0.06] text-left">
                    <th className="px-5 py-2 font-medium">Build</th><th className="px-3 py-2 text-right font-medium">Planted</th><th className="px-3 py-2 text-right font-medium">Detected</th><th className="px-3 py-2 text-right font-medium">Detection</th><th className="px-3 py-2 text-right font-medium">Confirmed</th><th className="px-3 py-2 text-right font-medium">False pos.</th><th className="px-3 py-2 text-right font-medium">Noise filtered</th><th className="px-5 py-2 text-right font-medium">Unplanned</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/[0.04] tabular-nums">
                    {d.per_build!.map((b) => (
                      <tr key={b.build} onClick={() => setBuild(b.build)} className="cursor-pointer hover:bg-white/[0.03]">
                        <td className="px-5 py-2.5 font-mono text-zinc-200">{b.build}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-300">{b.planted}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-300">{b.detected}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-200">{b.planted ? pct(b.detection_rate) : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-300">{b.reported_confirmed}</td>
                        <td className="px-3 py-2.5 text-right text-rose-300">{b.false_positives}</td>
                        <td className="px-3 py-2.5 text-right text-amber-200">{b.noise_filtered}</td>
                        <td className="px-5 py-2.5 text-right text-sky-300">{b.unplanned_findings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={<span className="flex items-center gap-2"><XCircle className="size-4 text-rose-300" />False positives</span>}>
              <BugList bugs={d.lists?.false_positives ?? []} empty="None. Reviewers mark these from the bug panel." />
            </Card>
            <Card title={<span className="flex items-center gap-2"><Filter className="size-4 text-amber-300" />Rejected by recheck</span>}>
              <BugList bugs={d.lists?.noise ?? []} empty="Nothing rejected in this scope." />
            </Card>
            <Card title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-sky-300" />Unplanned findings</span>}>
              <BugList bugs={d.lists?.unplanned ?? []} empty="Every confirmed bug was on the planted list." />
            </Card>
          </div>

          {d.project && (
            <div className="grid gap-4 lg:grid-cols-2">
              <AddPlanted project={d.project} builds={ascBuilds} defaultBuild={activeBuild || projectBuilds[0] || ''} />
              <ManualSessions sc={d} project={d.project} builds={ascBuilds} defaultBuild={activeBuild} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

