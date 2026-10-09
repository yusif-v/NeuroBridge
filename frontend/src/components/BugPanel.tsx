import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, CheckCircle2, CircleSlash, Crosshair, ExternalLink, Eye, Flag, ImageOff, PencilLine, RefreshCw, Repeat, RotateCcw, ShieldCheck, ShieldX, Sparkles, Ticket, Wrench, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../api'
import { LIVE_MS, cn, compact, fmtDate, fmtTime, humanize, usd } from '../lib'
import type { BugDetail, BugEvent, BugStatus, LogRow } from '../types'
import { KV, LEVEL_STYLE, Lightbox, Pill, RegressionBadge, SeverityBadge, Skeleton, StatusBadge, VerificationBadge } from './ui'

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-t border-white/[0.06] px-5 py-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="label">{title}</h3>{right}</div>
      {children}
    </div>
  )
}

const EVENT: Record<string, { label: string; icon: ReactNode; dot: string; text: string }> = {
  found: { label: 'Found by engine', icon: <Eye className="size-3" />, dot: 'bg-violet-400', text: 'text-violet-200' },
  seen_again: { label: 'Seen again', icon: <Repeat className="size-3" />, dot: 'bg-violet-300/60', text: 'text-zinc-300' },
  recheck_reproduced: { label: 'Recheck: reproduced', icon: <RefreshCw className="size-3" />, dot: 'bg-emerald-400', text: 'text-emerald-300' },
  recheck_not_reproduced: { label: 'Recheck: not reproduced', icon: <RefreshCw className="size-3" />, dot: 'bg-zinc-400', text: 'text-zinc-300' },
  confirmed: { label: 'Confirmed', icon: <ShieldCheck className="size-3" />, dot: 'bg-emerald-400', text: 'text-emerald-300' },
  rejected: { label: 'Rejected (not reproducible)', icon: <ShieldX className="size-3" />, dot: 'bg-amber-400', text: 'text-amber-200' },
  fixed: { label: 'Fixed (verified)', icon: <Wrench className="size-3" />, dot: 'bg-sky-400', text: 'text-sky-300' },
  regression: { label: 'Regression', icon: <RotateCcw className="size-3" />, dot: 'bg-rose-400', text: 'text-rose-300' },
  ai_analyzed: { label: 'AI analysis', icon: <Sparkles className="size-3" />, dot: 'bg-fuchsia-400', text: 'text-fuchsia-200' },
  ai_failed: { label: 'AI analysis failed', icon: <AlertTriangle className="size-3" />, dot: 'bg-rose-400', text: 'text-rose-300' },
  status_changed: { label: 'Status changed', icon: <PencilLine className="size-3" />, dot: 'bg-zinc-500', text: 'text-zinc-300' },
  severity_changed: { label: 'Severity changed', icon: <PencilLine className="size-3" />, dot: 'bg-zinc-500', text: 'text-zinc-300' },
}

function EvidenceTrail({ events }: { events: BugEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-zinc-500">No events recorded yet.</p>
  return (
    <ol className="relative space-y-3 border-l border-white/10 pl-4">
      {events.map((e) => {
        const ev = EVENT[e.type] ?? { label: humanize(e.type), icon: <CircleSlash className="size-3" />, dot: 'bg-zinc-500', text: 'text-zinc-300' }
        return (
          <li key={e.id} className="relative">
            <span className={cn('absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-[#100f19]', ev.dot)} />
            <div className="flex items-center gap-2 text-sm">
              <span className={cn('flex items-center gap-1.5 font-medium', ev.text)}>{ev.icon}{ev.label}</span>
              {e.build && <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{e.build}</span>}
              {e.run_id && <Link to={`/runs/${e.run_id}`} className="text-xs text-violet-300 hover:underline">#{e.run_id}</Link>}
              <span className="ml-auto shrink-0 text-xs text-zinc-500">{fmtDate(e.created_at)}</span>
            </div>
            {e.detail && <p className="mt-0.5 text-xs text-zinc-400">{e.detail}</p>}
          </li>
        )
      })}
    </ol>
  )
}

// An AI evidence ref matches a log line if either contains the other (case-insensitive).
function matchesRef(log: LogRow, ref: string) {
  const a = log.message.toLowerCase()
  const b = ref.toLowerCase().trim()
  return !!b && (a.includes(b) || b.includes(a))
}

function AICard({ bug, onRef, activeRef }: { bug: BugDetail; onRef: (ref: string) => void; activeRef: string | null }) {
  const qc = useQueryClient()
  const analyze = useMutation({
    mutationFn: () => api.analyze(bug.id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['bug', bug.id] }),
  })
  const r = bug.ai_report
  const last = bug.ai_usage?.length ? bug.ai_usage[bug.ai_usage.length - 1] : null
  const wrap = (children: ReactNode) => (
    <div className="mx-5 my-4 rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-200"><Sparkles className="size-4" />AI analysis</div>
        <span className="text-[11px] text-violet-300/70">hypothesis · not verified</span>
      </div>
      {children}
    </div>
  )

  if (bug.ai_status === 'pending')
    return wrap(<div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" /><p className="pt-1 text-xs text-violet-300/70">Analyzing evidence…</p></div>)

  if (bug.ai_status === 'error')
    return wrap(
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-rose-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{r?.error ?? 'Analysis failed'}</p>
        <button className="btn" disabled={analyze.isPending} onClick={() => analyze.mutate()}><RefreshCw className="size-3.5" />Retry</button>
      </div>,
    )

  if (bug.ai_status === 'done' && r)
    return wrap(
      <div className="space-y-3 text-sm">
        {r.insufficient_evidence && <Pill className="border-amber-400/30 bg-amber-500/10 text-amber-200">Insufficient evidence</Pill>}
        {r.summary && <p className="leading-relaxed text-zinc-200">{r.summary}</p>}
        {r.likely_root_cause && <div><div className="label mb-1">Likely root cause</div><p className="text-zinc-300">{r.likely_root_cause}</p></div>}
        {r.recommended_fix && <div><div className="label mb-1">Recommended fix</div><p className="text-zinc-300">{r.recommended_fix}</p></div>}
        {!!r.reproduction_steps?.length && (
          <div><div className="label mb-1">Reproduction</div><ol className="list-decimal space-y-0.5 pl-5 text-zinc-300">{r.reproduction_steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
        )}
        {!!r.evidence_refs?.length && (
          <div>
            <div className="label mb-1">Based on evidence</div>
            <div className="flex flex-wrap gap-1.5">
              {r.evidence_refs.map((ref, i) => {
                const hits = bug.logs.filter((l) => matchesRef(l, ref)).length
                return (
                  <button key={i} onClick={() => onRef(ref)} title={hits ? `Show ${hits} matching log line${hits > 1 ? 's' : ''}` : 'No matching log line'}
                    className={cn('max-w-full break-words rounded-md border px-2 py-1 text-left font-mono text-[11px] transition',
                      activeRef === ref ? 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100'
                        : hits ? 'border-white/10 bg-black/30 text-zinc-300 hover:border-violet-400/40 hover:text-white' : 'border-white/[0.06] bg-black/20 text-zinc-500')}>
                    {ref}{hits > 0 && <span className="ml-1.5 text-violet-300">↳{hits}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {r.severity && <span className="text-xs text-zinc-500">Suggested severity</span>}
          {r.severity && <SeverityBadge severity={r.severity} />}
          {r.confidence && <Pill className="border-white/10 bg-white/[0.04] capitalize text-zinc-300">{r.confidence} confidence</Pill>}
          {r.model && !last && <span className="ml-auto text-[11px] text-zinc-500">{r.model}</span>}
        </div>
        {last && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-violet-400/10 pt-2 text-[11px] text-zinc-500">
            <span className="text-zinc-400">{last.model ?? r.model ?? 'model'}</span>
            {last.input_tokens != null && <span className="tabular-nums">{compact(last.input_tokens)} in · {compact(last.output_tokens)} out</span>}
            {last.cost_usd != null && <span className="tabular-nums">{usd(last.cost_usd)}</span>}
            {last.latency_ms != null && <span className="tabular-nums">{(last.latency_ms / 1000).toFixed(1)}s</span>}
          </div>
        )}
      </div>,
    )

  // none | disabled
  return wrap(
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-zinc-400">
        {bug.ai_status === 'disabled' ? 'AI analyzer not configured.' : bug.verification === 'confirmed' ? 'Not analyzed yet.' : 'Runs automatically once the engine confirms the bug.'}
      </p>
      <button className="btn shrink-0" disabled={analyze.isPending} onClick={() => analyze.mutate()} title="Request analysis">
        <Sparkles className="size-3.5" />Analyze
      </button>
    </div>,
  )
}

export function BugPanel({ bugId, onClose }: { bugId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: bug, isLoading } = useQuery({
    queryKey: ['bug', bugId],
    queryFn: () => api.bug(bugId),
    refetchInterval: LIVE_MS,
  })
  const [lightbox, setLightbox] = useState<{ src: string; caption: string | null } | null>(null)
  const [activeRef, setActiveRef] = useState<string | null>(null)
  const logsRef = useRef<HTMLDivElement>(null)
  const showRef = (ref: string) => {
    const next = activeRef === ref ? null : ref
    setActiveRef(next)
    if (next) requestAnimationFrame(() => {
      const el = logsRef.current?.querySelector('[data-hit="true"]')
      ;(el ?? logsRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
  const update = useMutation({
    mutationFn: (status: BugStatus) => api.updateBug(bugId, { status }),
    onSuccess: (data) => {
      qc.setQueryData(['bug', bugId], data)
      qc.invalidateQueries({ queryKey: ['bugs'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  return (
    <aside className="glass animate-slide-in sticky top-[76px] flex max-h-[calc(100vh-100px)] w-[420px] shrink-0 flex-col overflow-hidden max-xl:fixed max-xl:right-4 max-xl:top-20 max-xl:z-40 max-xl:max-h-[calc(100vh-96px)] max-xl:w-[min(420px,calc(100vw-2rem))] max-xl:bg-[#0f0e18]/95">
      {isLoading || !bug ? (
        <div className="space-y-3 p-5"><Skeleton className="h-5 w-24" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-40 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : (
        <>
          <div className="px-5 pb-4 pt-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-violet-300">{bug.key}</span>
              <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"><X className="size-4" /></button>
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-white">{bug.title}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <SeverityBadge severity={bug.severity} />
              <StatusBadge status={bug.status} />
              <VerificationBadge v={bug.verification} />
              {!!bug.regression && <RegressionBadge />}
              {bug.category && <Pill className="border-white/10 bg-white/[0.03] text-zinc-300">{bug.category}</Pill>}
              {!!bug.planted_in?.length && (
                <Pill className="border-sky-400/30 bg-sky-500/10 text-sky-200" title="Deliberately planted bug (ground truth for the QA scorecard)">
                  <Crosshair className="size-3" />Planted in {bug.planted_in.map((p) => p.build).join(', ')}
                </Pill>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {bug.last_run_id && <Link to={`/runs/${bug.last_run_id}`} className="btn"><ExternalLink className="size-3.5" />Open run</Link>}
              {bug.status === 'open' && <button className="btn-primary" disabled={update.isPending} onClick={() => update.mutate('ticketed')}><Ticket className="size-3.5" />Create ticket</button>}
              {bug.status === 'open' && <button className="btn" disabled={update.isPending} onClick={() => update.mutate('ignored')}><Ban className="size-3.5" />Ignore</button>}
              {(bug.status === 'open' || bug.status === 'ticketed') && (
                <button className="btn" disabled={update.isPending} onClick={() => update.mutate('false_positive')} title="Reviewer says this is not a real bug (counts against precision)">
                  <Flag className="size-3.5" />False positive
                </button>
              )}
              {bug.status !== 'open' && <button className="btn" disabled={update.isPending} onClick={() => update.mutate('open')}><RotateCcw className="size-3.5" />Reopen</button>}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Section title={`Screenshots (${bug.attachments.length})`}>
              {bug.attachments.length === 0 ? (
                <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 text-xs text-zinc-500"><ImageOff className="size-4" />No screenshots</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {bug.attachments.map((a, i) => (
                    <button key={a.id} onClick={() => setLightbox({ src: a.url, caption: a.caption })}
                      className={cn('group relative overflow-hidden rounded-xl border border-white/10 bg-black/40', i === 0 && 'col-span-2')}>
                      <img src={a.url} alt={a.caption ?? ''} className={cn('w-full object-cover transition group-hover:scale-[1.02] [image-rendering:pixelated]', i === 0 ? 'h-44' : 'h-24')} />
                      {a.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] text-zinc-300">{a.caption}</span>}
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {bug.description && <Section title="Description"><p className="text-sm leading-relaxed text-zinc-300">{bug.description}</p></Section>}

            <Section title="Expected vs actual">
              <div className="space-y-2 text-sm">
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3"><div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-300"><CheckCircle2 className="size-3.5" />Expected</div><p className="text-zinc-300">{bug.expected ?? '—'}</p></div>
                <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.05] p-3"><div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-rose-300"><XCircle className="size-3.5" />Actual</div><p className="text-zinc-300">{bug.actual ?? '—'}</p></div>
              </div>
            </Section>

            <Section title={`Evidence trail (${bug.timeline?.length ?? 0})`}>
              <EvidenceTrail events={bug.timeline ?? []} />
            </Section>

            {!!bug.steps?.length && (
              <Section title="Steps to reproduce">
                <ol className="space-y-1.5">
                  {bug.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-zinc-300"><span className="grid size-5 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[11px] tabular-nums text-zinc-400">{i + 1}</span>{s}</li>
                  ))}
                </ol>
              </Section>
            )}

            <AICard bug={bug} onRef={showRef} activeRef={activeRef} />

            <Section title={`Recheck history (${bug.rechecks.length})`}>
              {bug.rechecks.length === 0 ? <p className="text-sm text-zinc-500">Waiting for the engine to recheck this finding.</p> : (
                <ol className="relative space-y-3 border-l border-white/10 pl-4">
                  {bug.rechecks.map((r) => (
                    <li key={r.id} className="relative">
                      <span className={cn('absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-[#100f19]', r.result === 'reproduced' ? 'bg-emerald-400' : 'bg-zinc-500')} />
                      <div className="flex items-center gap-2 text-sm">
                        <span className={r.result === 'reproduced' ? 'text-emerald-300' : 'text-zinc-300'}>{r.result === 'reproduced' ? 'Reproduced' : 'Not reproduced'}</span>
                        {r.attempts != null && <span className="text-xs text-zinc-500">{r.attempts} attempt{r.attempts === 1 ? '' : 's'}</span>}
                        {r.run_id && <Link to={`/runs/${r.run_id}`} className="text-xs text-violet-300 hover:underline">run #{r.run_id}</Link>}
                        <span className="ml-auto text-xs text-zinc-500">{fmtDate(r.created_at)}</span>
                      </div>
                      {r.notes && <p className="mt-0.5 text-xs text-zinc-400">{r.notes}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            {bug.logs.length > 0 && (
              <Section title={`Logs (${bug.logs.length})`} right={activeRef && <button onClick={() => setActiveRef(null)} className="text-[11px] text-fuchsia-300 hover:underline">clear highlight</button>}>
                <div ref={logsRef} className="max-h-64 overflow-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-[11px] leading-5">
                  {bug.logs.map((l) => {
                    const hit = !!activeRef && matchesRef(l, activeRef)
                    return (
                    <div key={l.id} data-hit={hit} className={cn('-mx-1.5 flex gap-2 rounded px-1.5 transition-colors', hit && 'bg-fuchsia-500/15 ring-1 ring-inset ring-fuchsia-400/30', activeRef && !hit && 'opacity-50')}>
                      <span className="shrink-0 text-zinc-600">{fmtTime(l.ts)}</span>
                      <span className={cn('w-10 shrink-0 uppercase', LEVEL_STYLE[l.level])}>{l.level.slice(0, 4)}</span>
                      <span className="whitespace-pre-wrap break-words text-zinc-300">{l.message}{l.data && <span className="text-zinc-500"> {JSON.stringify(l.data)}</span>}</span>
                    </div>
                    )
                  })}
                </div>
              </Section>
            )}

            <Section title="Metadata">
              <KV k="Project" v={bug.project} />
              <KV k="Build" v={bug.build} />
              <KV k="Test" v={bug.test_name} />
              <KV k="Agent" v={bug.agent} />
              <KV k="Engine confidence" v={bug.confidence != null ? `${Math.round(bug.confidence * 100)}%` : '—'} />
              <KV k="Seen" v={`${bug.occurrences}× in runs ${bug.runs.map((r) => `#${r.id}`).join(', ') || '—'}`} />
              <KV k="First seen" v={bug.first_run_id ? <Link className="text-violet-300 hover:underline" to={`/runs/${bug.first_run_id}`}>run #{bug.first_run_id} · {fmtDate(bug.found_at)}</Link> : fmtDate(bug.found_at)} />
              <KV k="Last seen" v={bug.last_run_id ? <Link className="text-violet-300 hover:underline" to={`/runs/${bug.last_run_id}`}>run #{bug.last_run_id}</Link> : '—'} />
              {bug.fixed_in_run && <KV k="Fixed in" v={<Link className="text-emerald-300 hover:underline" to={`/runs/${bug.fixed_in_run}`}>run #{bug.fixed_in_run}</Link>} />}
              <KV k="Fingerprint" v={<span className="font-mono text-xs text-zinc-400">{bug.fingerprint}</span>} />
              {bug.metadata && Object.entries(bug.metadata).map(([k, v]) => <KV key={k} k={k} v={typeof v === 'object' ? JSON.stringify(v) : String(v)} />)}
            </Section>
          </div>
        </>
      )}
      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </aside>
  )
}
