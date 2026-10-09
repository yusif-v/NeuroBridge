import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Coins, Cpu, Info, Play, Sparkles, Timer } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, compact, fmtDate, humanize, usd } from '../lib'
import { Card, Empty, ErrorNote, PageHeader, Pill, Skeleton, StatCell, StatGrid } from '../components/ui'

function Note({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2 rounded-md border border-white/[0.07] px-4 py-3 text-xs leading-relaxed text-zinc-400"><Info className="mt-0.5 size-3.5 shrink-0 text-amber-300" /><div>{children}</div></div>
}

function elapsed(seconds: number | null) {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

const cost = (value: number | null) => value == null ? 'Unknown' : usd(value)

export function UsagePage() {
  const { data: u, error, isLoading } = useQuery({ queryKey: ['usage'], queryFn: () => api.usage(), refetchInterval: LIVE_MS * 2 })
  const chart = u?.per_run.filter(r => r.ai_calls > r.calls_without_tokens).map(r => ({ name: `#${r.run_id}`, build: r.build, input: r.input_tokens, output: r.output_tokens })) ?? []
  const meteredCalls = u ? u.ai.calls - u.ai.calls_without_tokens : 0

  return <div className="mx-auto min-w-0 max-w-[1400px] space-y-8">
    <PageHeader index="06" section="Telemetry" title="Usage & cost" lede="Recorded playtest sessions and report API calls. Updated from your test history." />
    {error && <ErrorNote error={error} />}
    {isLoading && <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28" />)}</div>}
    {u && <>
      <StatGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCell label="Recorded API spend" value={u.engine.runs || u.ai.calls ? cost(u.unit.total_cost_usd) : '—'} icon={<Coins className="size-4" />} accent="bg-violet-500" sub={u.unit.total_cost_usd == null ? `${u.ai.calls_without_cost} unpriced report calls` : 'Hardware costs excluded'} />
        <StatCell label="Report API calls" value={u.ai.calls} icon={<Sparkles className="size-4" />} accent="bg-sky-500" sub={`${u.ai.succeeded} succeeded · ${u.ai.failed} failed`} />
        <StatCell label="Reported API tokens" value={meteredCalls ? (u.ai.input_tokens + u.ai.output_tokens).toLocaleString() : '—'} icon={<Cpu className="size-4" />} accent="bg-rose-500" sub={`${u.ai.input_tokens.toLocaleString()} in · ${u.ai.output_tokens.toLocaleString()} out`} />
        <StatCell label="Avg report latency" value={u.ai.avg_latency_ms != null ? `${(u.ai.avg_latency_ms / 1000).toFixed(1)}s` : '—'} icon={<Timer className="size-4" />} accent="bg-amber-500" sub="Successful API calls only" />
        <StatCell label="Playtest actions" value={compact(u.engine.actions)} icon={<Play className="size-4" />} accent="bg-emerald-500" sub={`${u.engine.runs} runs · ${u.engine.local_runs} local sessions`} />
        <StatCell label="Session elapsed" value={u.engine.runs_with_duration ? `${u.engine.play_minutes.toFixed(2)} min` : '—'} icon={<Timer className="size-4" />} accent="bg-fuchsia-500" sub={`${u.engine.runs_with_duration} sessions with recorded duration`} />
      </StatGrid>

      <div className="space-y-2">
        <Note>Laya controls uploaded builds on the local GPU. The report analyzer makes separate API calls. Local sessions have no play API charge; electricity and GPU hosting are not metered. Session time includes startup and replay and excludes report analysis.</Note>
        {(u.ai.calls_without_cost > 0 || u.engine.runs_without_cost > 0) && <Note>Spend is unknown: {u.ai.calls_without_cost} report calls and {u.engine.runs_without_cost} external engine runs have no recorded price. {u.ai.calls === u.ai.calls_without_cost && u.engine.runs === u.engine.local_runs + u.engine.runs_without_cost ? 'No priced API charge records are available.' : `Known charges total ${usd(u.unit.known_cost_usd)}; this is a partial subtotal, not the full bill.`} Unit costs remain unavailable until cost coverage is complete.</Note>}
        {u.ai.calls_without_tokens > 0 && <Note>{u.ai.calls_without_tokens} API call{u.ai.calls_without_tokens === 1 ? ' has' : 's have'} no complete provider token record. Token totals include only returned counts; failed calls can still incur charges.</Note>}
        {u.engine.runs_without_actions > 0 && <Note>{u.engine.runs_without_actions} external engine runs have no recorded action count. The action total includes available records only.</Note>}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2" title="Report API tokens per run" action={<span className="text-xs text-zinc-500">Provider-reported counts</span>}>
          {!meteredCalls ? <Empty icon={<Cpu className="size-5" />} title="No token records yet" hint="Token counts appear when the API provider returns usage." /> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => compact(v)} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#14121f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12 }} labelFormatter={(l, p) => `Run ${l}${p?.[0] ? ` · build ${p[0].payload.build}` : ''}`} formatter={v => Number(v).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} iconType="circle" iconSize={8} />
            <Bar isAnimationActive={false} maxBarSize={56} dataKey="input" name="Input tokens" stackId="t" fill="#a78bfa" />
            <Bar isAnimationActive={false} maxBarSize={56} dataKey="output" name="Output tokens" stackId="t" fill="#e879f9" />
          </BarChart></ResponsiveContainer></div>}
        </Card>
        <Card className="min-w-0" title="Cost coverage">
          <div className="space-y-4 text-sm">
            <div className="flex justify-between gap-3"><span className="text-zinc-400">Priced report calls</span><span>{u.ai.calls - u.ai.calls_without_cost} / {u.ai.calls}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-400">Report API spend</span><span>{u.ai.calls ? cost(u.ai.cost_usd) : '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-400">API cost per run</span><span>{cost(u.unit.cost_per_run_usd)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-400">API cost per confirmed bug</span><span>{cost(u.unit.cost_per_confirmed_bug_usd)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-400">Confirmed bugs</span><span>{u.unit.confirmed_bugs}</span></div>
          </div>
          <p className="mt-5 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-zinc-500">{u.pricing.input_per_mtok_usd != null && u.pricing.output_per_mtok_usd != null ? `Configured report rates: ${usd(u.pricing.input_per_mtok_usd)} input / ${usd(u.pricing.output_per_mtok_usd)} output per million tokens. Rates apply to new calls.` : 'Report pricing is not configured. Provider token counts are available independently of price.'} No monthly estimate is shown without complete cost records.</p>
        </Card>
      </div>

      <Card className="min-w-0" title="Playtest sessions" action={<span className="text-xs text-zinc-500">All outcomes, including inconclusive tests</span>}>
        {!u.per_run.length ? <Empty icon={<Play className="size-5" />} title="No runs yet" /> : <div className="-mx-5 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="label border-b border-white/[0.06] text-left">{['Run / project', 'Build', 'Player model', 'Outcome', 'Actions', 'Elapsed', 'Report calls'].map(h => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/[0.04] tabular-nums">{[...u.per_run].reverse().map(r => <tr key={r.run_id} className="hover:bg-white/[0.02]">
            <td className="px-5 py-3"><Link className="text-violet-300 hover:text-violet-200" to={`/app/runs/${r.run_id}`}>#{r.run_id} · {r.project}</Link><div className="mt-1 text-xs text-zinc-500">{r.started_at ? fmtDate(r.started_at) : 'Not started'}</div></td>
            <td className="px-5 py-3 text-zinc-400">{r.build}</td>
            <td className="max-w-64 px-5 py-3 text-zinc-400"><span className="block truncate" title={r.model ?? undefined}>{r.model ?? 'Not recorded'}</span><span className="text-xs text-zinc-500">{r.local ? 'Local GPU worker' : 'External engine'}</span></td>
            <td className="px-5 py-3"><Pill className={r.status === 'completed' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/30 bg-amber-500/10 text-amber-300'}>{humanize(r.status)}</Pill></td>
            <td className="px-5 py-3 text-zinc-300">{compact(r.actions)}</td>
            <td className="px-5 py-3 text-zinc-300" title={r.duration_source === 'timestamps' ? 'Elapsed from recorded start and finish timestamps; includes startup and replay' : 'Reported session duration'}>{elapsed(r.duration_s)}</td>
            <td className="px-5 py-3 text-zinc-300">{r.ai_calls}</td>
          </tr>)}</tbody>
        </table></div>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0" title="Report models">
          {!u.by_model.length ? <Empty title="No AI calls yet" /> : <div className="space-y-4">{u.by_model.map(m => <div key={m.model} className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
            <div className="break-all text-sm text-zinc-200">{m.model}</div>
            <div className="mt-2 flex justify-between gap-3 text-xs text-zinc-400"><span>{m.calls} call{m.calls === 1 ? '' : 's'} · {m.calls_without_tokens === m.calls ? 'tokens unavailable' : `${(m.input_tokens + m.output_tokens).toLocaleString()} recorded tokens`}</span><span>{cost(m.cost_usd)}</span></div>
          </div>)}</div>}
        </Card>
        <Card className="min-w-0 xl:col-span-2" title="Recent report API calls">
          {!u.recent_calls.length ? <Empty icon={<Sparkles className="size-5" />} title="No AI calls yet" hint="Calls are logged each time a confirmed bug is analyzed." /> : <div className="-mx-5 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="label border-b border-white/[0.06] text-left">{['Bug / model', 'Tokens in / out', 'Cost', 'Latency', 'Status', 'When'].map(h => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/[0.04] tabular-nums">{u.recent_calls.map(c => <tr key={c.id} className="hover:bg-white/[0.02]">
              <td className="max-w-64 px-5 py-3"><Link to={`/app/bugs?bug=${c.bug_id}`} className="block truncate text-zinc-200 hover:text-violet-200"><span className="mr-2 font-mono text-xs text-violet-300">BUG-{String(c.bug_id).padStart(3, '0')}</span>{c.title}</Link><div className="mt-1 break-all text-xs text-zinc-500">{c.model ?? 'Model not recorded'}</div></td>
              <td className="whitespace-nowrap px-5 py-3 text-zinc-400">{c.input_tokens?.toLocaleString() ?? '—'} / {c.output_tokens?.toLocaleString() ?? '—'}</td>
              <td className="px-5 py-3 text-zinc-200">{cost(c.cost_usd)}</td>
              <td className="px-5 py-3 text-zinc-400">{c.latency_ms != null ? `${(c.latency_ms / 1000).toFixed(1)}s` : '—'}</td>
              <td className="px-5 py-3"><Pill className={c.status === 'done' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'} title={c.error ?? undefined}>{c.status === 'done' ? 'ok' : 'error'}</Pill></td>
              <td className="whitespace-nowrap px-5 py-3 text-xs text-zinc-500">{fmtDate(c.created_at)}</td>
            </tr>)}</tbody>
          </table></div>}
        </Card>
      </div>
    </>}
  </div>
}
