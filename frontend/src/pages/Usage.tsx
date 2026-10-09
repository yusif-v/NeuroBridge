import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bug, Calculator, Coins, Cpu, Info, Play, Sparkles, Timer } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, compact, fmtDate, usd } from '../lib'
import { Card, Empty, ErrorNote, PageHeader, Pill, Skeleton, StatCell, StatGrid } from '../components/ui'

function Kpi({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; accent: string }) {
  return <StatCell label={label} value={value} sub={sub} icon={icon} accent={accent} />
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-white/[0.07] px-4 py-3 text-xs leading-relaxed text-zinc-400">
      <Info className="mt-0.5 size-3.5 shrink-0 text-violet-300" /><div>{children}</div>
    </div>
  )
}

export function UsagePage() {
  const { data: u, error, isLoading } = useQuery({ queryKey: ['usage'], queryFn: () => api.usage(), refetchInterval: LIVE_MS * 2 })
  const [runsPerMonth, setRunsPerMonth] = useState('300')

  const chart = u?.per_run.map((r) => ({ name: `#${r.run_id}`, build: r.build, engine: r.engine_cost_usd, ai: r.ai_cost_usd })) ?? []
  const totalTokens = u ? u.engine.llm_input_tokens + u.engine.llm_output_tokens + u.ai.input_tokens + u.ai.output_tokens : 0
  const runs = Number(runsPerMonth) || 0
  const monthly = u?.unit.cost_per_run_usd != null ? u.unit.cost_per_run_usd * runs : null

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <PageHeader index="06" section="Feasibility" title="Usage & cost"
        lede="Measured LLM spend: the engine playing the game, plus AI analysis of confirmed bugs." />

      {error && <ErrorNote error={error} />}
      {isLoading && <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div>}

      {u && (
        <>
          <StatGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Total cost" value={usd(u.unit.total_cost_usd)} icon={<Coins className="size-4" />} accent="bg-violet-500" sub={`engine ${usd(u.engine.llm_cost_usd)} · AI ${usd(u.ai.cost_usd)}`} />
            <Kpi label="Per confirmed bug" value={usd(u.unit.cost_per_confirmed_bug_usd)} icon={<Bug className="size-4" />} accent="bg-emerald-500" sub={`${u.unit.confirmed_bugs} confirmed bugs`} />
            <Kpi label="Per run" value={usd(u.unit.cost_per_run_usd)} icon={<Play className="size-4" />} accent="bg-fuchsia-500" sub={`${u.engine.runs} runs · ${u.engine.play_minutes} min played`} />
            <Kpi label="AI calls" value={u.ai.calls} icon={<Sparkles className="size-4" />} accent="bg-sky-500" sub={`${u.ai.succeeded} ok · ${u.ai.failed} failed`} />
            <Kpi label="Avg AI latency" value={u.ai.avg_latency_ms != null ? `${(u.ai.avg_latency_ms / 1000).toFixed(1)}s` : '—'} icon={<Timer className="size-4" />} accent="bg-amber-500" sub={u.ai.cost_per_analysis_usd != null ? `${usd(u.ai.cost_per_analysis_usd)} / analysis` : 'per analysis'} />
            <Kpi label="Tokens" value={compact(totalTokens)} icon={<Cpu className="size-4" />} accent="bg-rose-500" sub={`engine ${compact(u.engine.llm_input_tokens + u.engine.llm_output_tokens)} · AI ${compact(u.ai.input_tokens + u.ai.output_tokens)}`} />
          </StatGrid>

          {(u.ai.calls === 0 || (u.pricing.input_per_mtok_usd == null && u.ai.calls_without_cost > 0)) && (
            <div className="space-y-2">
              {u.ai.calls === 0 && <Note>AI analysis usage appears once the analyzer returns <code className="text-zinc-300">usage</code> (see <code className="text-zinc-300">docs/AI_INTEGRATION.md</code>). Engine costs come from <code className="text-zinc-300">llm_*</code> keys in each run's stats.</Note>}
              {u.pricing.input_per_mtok_usd == null && u.ai.calls_without_cost > 0 && (
                <Note>{u.ai.calls_without_cost} AI call{u.ai.calls_without_cost === 1 ? '' : 's'} reported tokens without a cost. Set <code className="text-zinc-300">AI_PRICE_INPUT_PER_MTOK</code> and <code className="text-zinc-300">AI_PRICE_OUTPUT_PER_MTOK</code> in <code className="text-zinc-300">.env</code> to price them.</Note>
              )}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Cost per run" action={<span className="text-xs text-zinc-500">USD</span>}>
              {chart.length === 0 ? <Empty icon={<Coins className="size-5" />} title="No runs yet" /> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(v < 0.1 ? 3 : 2)}`} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        contentStyle={{ background: '#14121f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12 }}
                        labelFormatter={(l, p) => `Run ${l}${p?.[0] ? ` · build ${p[0].payload.build}` : ''}`}
                        formatter={(v) => usd(Number(v))}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} iconType="circle" iconSize={8} />
                      <Bar isAnimationActive={false} maxBarSize={56} dataKey="engine" name="Engine LLM" stackId="c" fill="#a78bfa" />
                      <Bar isAnimationActive={false} maxBarSize={56} dataKey="ai" name="AI analysis" stackId="c" fill="#e879f9" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title={<span className="flex items-center gap-2"><Calculator className="size-4 text-emerald-300" />Monthly projection</span>}>
              <label className="block">
                <span className="label">Runs per month</span>
                <input type="number" min={0} step={10} value={runsPerMonth} onChange={(e) => setRunsPerMonth(e.target.value)} className="input mt-1.5 text-lg tabular-nums" />
              </label>
              <div className="mt-5 space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-zinc-400">Estimated monthly cost</span>
                  <span className="text-3xl font-semibold tabular-nums text-white">{usd(monthly)}</span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Cost per run</span><span className="tabular-nums text-zinc-200">{usd(u.unit.cost_per_run_usd)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Cost per confirmed bug</span><span className="tabular-nums text-zinc-200">{usd(u.unit.cost_per_confirmed_bug_usd)}</span></div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">Estimate from measured averages over {u.engine.runs} run{u.engine.runs === 1 ? '' : 's'}. Real cost scales with game size and run length.</p>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="By model">
              {u.by_model.length === 0 ? <Empty title="No AI calls yet" /> : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="label border-b border-white/[0.06] text-left"><th className="px-5 py-2 font-medium">Model</th><th className="px-3 py-2 text-right font-medium">Calls</th><th className="px-3 py-2 text-right font-medium">Tokens</th><th className="px-5 py-2 text-right font-medium">Cost</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.04] tabular-nums">
                      {u.by_model.map((m) => (
                        <tr key={m.model}><td className="px-5 py-2.5 text-zinc-200">{m.model}</td><td className="px-3 py-2.5 text-right text-zinc-300">{m.calls}</td><td className="px-3 py-2.5 text-right text-zinc-400">{compact(m.input_tokens + m.output_tokens)}</td><td className="px-5 py-2.5 text-right text-zinc-200">{usd(m.cost_usd)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card className="xl:col-span-2" title="Recent AI calls">
              {u.recent_calls.length === 0 ? <Empty icon={<Sparkles className="size-5" />} title="No AI calls yet" hint="Calls are logged each time a confirmed bug is analyzed." /> : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="label border-b border-white/[0.06] text-left"><th className="px-5 py-2 font-medium">Bug</th><th className="px-3 py-2 font-medium">Model</th><th className="px-3 py-2 text-right font-medium">Tokens in / out</th><th className="px-3 py-2 text-right font-medium">Cost</th><th className="px-3 py-2 text-right font-medium">Latency</th><th className="px-3 py-2 font-medium">Status</th><th className="px-5 py-2 text-right font-medium">When</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.04] tabular-nums">
                      {u.recent_calls.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="max-w-64 px-5 py-2.5">{c.bug_id ? <Link to={`/app/bugs?bug=${c.bug_id}`} className="block truncate text-zinc-200 hover:text-violet-200"><span className="mr-2 font-mono text-xs text-violet-300">BUG-{String(c.bug_id).padStart(3, '0')}</span>{c.title}</Link> : '—'}</td>
                          <td className="px-3 py-2.5 text-zinc-400">{c.model ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-400">{c.input_tokens != null ? `${compact(c.input_tokens)} / ${compact(c.output_tokens)}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-200">{usd(c.cost_usd)}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-400">{c.latency_ms != null ? `${(c.latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                          <td className="px-3 py-2.5">{c.status === 'done' ? <Pill className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">ok</Pill> : <Pill className="border-rose-500/30 bg-rose-500/10 text-rose-300" title={c.error ?? undefined}>error</Pill>}</td>
                          <td className="px-5 py-2.5 text-right text-xs text-zinc-500">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
