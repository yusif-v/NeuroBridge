import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Bug, CheckCircle2, Filter, Play, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Target, Wrench, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../api'
import { LIVE_MS, cn, duration, pct, timeAgo } from '../lib'
import type { Severity, Stats } from '../types'
import { Card, Empty, ErrorNote, Pill, RegressionBadge, RunStatusBadge, SEVERITY_DOT, SEVERITY_HEX, SeverityBadge, Skeleton, VerificationBadge } from '../components/ui'

function Kpi({ label, value, icon, accent, hint }: { label: string; value: number | undefined; icon: ReactNode; accent: string; hint?: string }) {
  return (
    <div className="glass group relative overflow-hidden p-4">
      <div className={cn('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-25 blur-2xl transition group-hover:opacity-40', accent)} />
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="text-zinc-500">{icon}</span>
      </div>
      {value === undefined ? <Skeleton className="mt-3 h-8 w-16" /> : (
        <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">{value}</div>
      )}
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

function SeverityBreakdown({ stats }: { stats: Stats }) {
  const total = SEVERITIES.reduce((s, k) => s + (stats.by_severity[k] ?? 0), 0)
  return (
    <Card title="Open bugs by severity">
      {total === 0 ? <Empty title="No open bugs" hint="Nice. Or the engine hasn't reported yet." /> : (
        <>
          <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
            {SEVERITIES.map((s) => {
              const n = stats.by_severity[s] ?? 0
              return n ? <div key={s} style={{ width: `${(n / total) * 100}%`, background: SEVERITY_HEX[s] }} className="h-full first:rounded-l-full last:rounded-r-full" /> : null
            })}
          </div>
          <div className="space-y-2.5">
            {SEVERITIES.map((s) => (
              <Link key={s} to={`/bugs?severity=${s}&status=open`} className="flex items-center justify-between rounded-lg px-1 text-sm hover:bg-white/[0.03]">
                <span className="flex items-center gap-2 capitalize text-zinc-300"><span className={cn('size-2 rounded-full', SEVERITY_DOT[s])} />{s}</span>
                <span className="tabular-nums text-zinc-400">{stats.by_severity[s] ?? 0}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function VerificationBreakdown({ stats }: { stats: Stats }) {
  const rows = [
    { k: 'confirmed', label: 'Confirmed by recheck', color: 'bg-emerald-400' },
    { k: 'unverified', label: 'Awaiting recheck', color: 'bg-amber-300' },
    { k: 'not_reproduced', label: 'Not reproduced', color: 'bg-zinc-500' },
  ] as const
  const total = stats.totals.bugs || 1
  return (
    <Card title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" />Verification</span>}>
      <div className="space-y-4">
        {rows.map(({ k, label, color }) => {
          const n = stats.by_verification[k] ?? 0
          return (
            <div key={k}>
              <div className="mb-1.5 flex justify-between text-sm"><span className="text-zinc-300">{label}</span><span className="tabular-nums text-zinc-400">{n}</span></div>
              <div className="h-1.5 rounded-full bg-white/[0.05]"><div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${(n / total) * 100}%` }} /></div>
            </div>
          )
        })}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-zinc-500">Every finding is re-run by the engine. Only reproduced bugs count as confirmed; a confirmed bug that no longer reproduces is marked fixed.</p>
    </Card>
  )
}

function Timeline({ stats }: { stats: Stats }) {
  const data = stats.timeline.map((r) => ({ name: `#${r.id}`, build: r.build, new: r.new_bugs, seen: r.bugs_seen }))
  return (
    <Card title="Bugs per run" className="col-span-2" action={<span className="text-xs text-zinc-500">last {data.length} runs</span>}>
      {data.length === 0 ? <Empty icon={<Play className="size-5" />} title="No runs yet" hint="Start the engine — runs stream in here live." /> : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gSeen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.45} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
                <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e879f9" stopOpacity={0.5} /><stop offset="100%" stopColor="#e879f9" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(20,18,31,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#e4e4e7' }}
                labelFormatter={(l, p) => `Run ${l} · build ${p?.[0]?.payload?.build ?? ''}`}
              />
              <Area isAnimationActive={false} type="monotone" dataKey="seen" name="Bugs seen" stroke="#a78bfa" strokeWidth={2} fill="url(#gSeen)" />
              <Area isAnimationActive={false} type="monotone" dataKey="new" name="New bugs" stroke="#e879f9" strokeWidth={2} fill="url(#gNew)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function QaStrip() {
  const { data: sc } = useQuery({ queryKey: ['scorecard', 'dashboard'], queryFn: () => api.scorecard(), refetchInterval: LIVE_MS * 2 })
  if (!sc?.project) return null
  const item = (icon: ReactNode, label: string, value: ReactNode, sub: string) => (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-zinc-400">{icon}</span>
      <div><div className="text-[11px] text-zinc-500">{label}</div><div className="text-sm text-zinc-200"><span className="font-semibold tabular-nums text-white">{value}</span> <span className="text-zinc-500">{sub}</span></div></div>
    </div>
  )
  return (
    <Link to="/scorecard" className="glass group flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5 transition hover:border-violet-400/20">
      <span className="label flex items-center gap-2 text-zinc-400"><Target className="size-4 text-violet-300" />QA score <span className="normal-case tracking-normal text-zinc-600">· all builds</span></span>
      {item(<Target className="size-4 text-emerald-300" />, 'Planted bugs detected', sc.planted ? pct(sc.detection_rate) : '—', sc.planted ? `${sc.detected}/${sc.planted}` : 'none declared')}
      {item(<Filter className="size-4 text-amber-300" />, 'Noise filtered by recheck', sc.noise_filtered ?? 0, sc.raw_findings ? `of ${sc.raw_findings} raw findings` : '')}
      {item(<XCircle className="size-4 text-rose-300" />, 'False positives', sc.false_positives ?? 0, `precision ${pct(sc.precision)}`)}
      <span className="ml-auto flex items-center gap-1 text-xs text-violet-300 group-hover:text-violet-200">Open scorecard <ArrowRight className="size-3" /></span>
    </Link>
  )
}

export function DashboardPage() {
  const { data: stats, error } = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: LIVE_MS })
  const runs = stats?.timeline.slice().reverse().slice(0, 6) ?? []
  const t = stats?.totals

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">The engine plays your game, rechecks every finding, and reports here.</p>
        </div>
        {stats && (
          <Pill className={stats.ai_enabled ? 'border-violet-400/30 bg-violet-500/10 text-violet-200' : 'border-white/10 bg-white/[0.03] text-zinc-400'}>
            <Sparkles className="size-3" /> AI analyzer {stats.ai_enabled ? 'online' : 'not configured'}
          </Pill>
        )}
      </div>

      {error && <ErrorNote error={error} />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open bugs" value={t?.open} icon={<Bug className="size-4" />} accent="bg-violet-500" hint={t ? `${t.critical_open} critical` : undefined} />
        <Kpi label="Confirmed" value={t?.confirmed} icon={<CheckCircle2 className="size-4" />} accent="bg-emerald-500" hint="reproduced on recheck" />
        <Kpi label="Fixed" value={t?.fixed} icon={<Wrench className="size-4" />} accent="bg-sky-500" hint="verified by retest" />
        <Kpi label="Regressions" value={t?.regressions} icon={<RotateCcw className="size-4" />} accent="bg-rose-500" hint="fixed, then came back" />
        <Kpi label="Active runs" value={t?.active_runs} icon={<Play className="size-4" />} accent="bg-fuchsia-500" hint={t ? `${t.runs} total` : undefined} />
        <Kpi label="Rechecks" value={t?.rechecks} icon={<RefreshCw className="size-4" />} accent="bg-amber-500" hint={t ? `${t.screenshots} screenshots` : undefined} />
      </div>

      <QaStrip />

      {stats ? (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <Timeline stats={stats} />
            <SeverityBreakdown stats={stats} />
            <VerificationBreakdown stats={stats} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Latest bugs" action={<Link to="/bugs" className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">All bugs <ArrowRight className="size-3" /></Link>}>
              {stats.recent_bugs.length === 0 ? <Empty icon={<Bug className="size-5" />} title="No bugs reported yet" /> : (
                <div className="-mx-2 divide-y divide-white/[0.05]">
                  {stats.recent_bugs.map((b) => (
                    <Link key={b.id} to={`/bugs?bug=${b.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.03]">
                      <span className="w-16 shrink-0 font-mono text-xs text-violet-300">{b.key}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{b.title}</span>
                      {!!b.regression && <RegressionBadge />}
                      <VerificationBadge v={b.verification} />
                      <SeverityBadge severity={b.severity} />
                      <span className="w-16 shrink-0 text-right text-xs text-zinc-500">{timeAgo(b.updated_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Recent runs" action={<Link to="/runs" className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">All runs <ArrowRight className="size-3" /></Link>}>
              {runs.length === 0 ? <Empty icon={<Play className="size-5" />} title="No runs yet" /> : (
                <div className="-mx-2 divide-y divide-white/[0.05]">
                  {runs.map((r) => (
                    <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.03]">
                      <span className="w-12 shrink-0 font-mono text-xs text-zinc-400">#{r.id}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{r.project} <span className="text-zinc-500">· {r.build}</span></span>
                      <span className="text-xs text-zinc-500">{r.agent}</span>
                      <RunStatusBadge status={r.status} />
                      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-zinc-500">{duration(r.started_at, r.finished_at, r.stats?.duration_s)}</span>
                      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fuchsia-300">+{r.new_bugs}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : !error && (
        <div className="grid gap-4 xl:grid-cols-4"><Skeleton className="col-span-2 h-80" /><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      )}
    </div>
  )
}
