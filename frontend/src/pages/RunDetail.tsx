import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bug, Download, FileCode2, FileJson, FileSpreadsheet, FileText, ScrollText } from 'lucide-react'
import { api, reportUrl } from '../api'
import { LIVE_MS, cn, duration, fmtDate, fmtTime } from '../lib'
import type { LogLevel } from '../types'
import { Card, Empty, ErrorNote, KV, LEVEL_STYLE, Menu, MenuItem, RegressionBadge, RunStatusBadge, SeverityBadge, Skeleton, StatusBadge, VerificationBadge } from '../components/ui'

const LEVELS: LogLevel[] = ['debug', 'info', 'warning', 'error']

export function RunDetailPage() {
  const id = Number(useParams().id)
  const run = useQuery({
    queryKey: ['run', id],
    queryFn: () => api.run(id),
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 2000 : LIVE_MS * 3),
  })
  const [minLevel, setMinLevel] = useState<LogLevel>('debug')
  const logs = useMemo(
    () => run.data?.logs.filter((l) => LEVELS.indexOf(l.level) >= LEVELS.indexOf(minLevel)) ?? [],
    [run.data, minLevel],
  )

  if (run.error) return <ErrorNote error={run.error} />
  const r = run.data

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Link to="/runs" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"><ArrowLeft className="size-4" />All runs</Link>

      {!r ? <Skeleton className="h-40" /> : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Run #{r.id}</h1>
                <RunStatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-sm text-zinc-500">{r.project} · build <span className="font-mono text-zinc-400">{r.build}</span>{r.agent && <> · agent {r.agent}</>}</p>
            </div>
            <Menu button={<button className="btn-primary"><Download className="size-4" />Export report</button>}>
              {(close) => (
                <>
                  <MenuItem href={reportUrl.run(r.id, 'html')} onClick={close}><FileCode2 className="size-4 text-violet-300" />HTML report</MenuItem>
                  <MenuItem href={reportUrl.run(r.id, 'md')} onClick={close}><FileText className="size-4 text-sky-300" />Markdown</MenuItem>
                  <MenuItem href={reportUrl.run(r.id, 'json')} onClick={close}><FileJson className="size-4 text-amber-300" />JSON</MenuItem>
                  <MenuItem href={reportUrl.run(r.id, 'csv')} onClick={close}><FileSpreadsheet className="size-4 text-emerald-300" />CSV (bugs)</MenuItem>
                </>
              )}
            </Menu>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Overview">
              <KV k="Started" v={fmtDate(r.started_at)} />
              <KV k="Finished" v={fmtDate(r.finished_at)} />
              <KV k="Duration" v={duration(r.started_at, r.finished_at, r.stats?.duration_s)} />
              <KV k="New bugs" v={<span className="text-fuchsia-300">{r.new_bugs}</span>} />
              <KV k="Bugs seen" v={r.bugs_seen} />
              <KV k="Rechecks" v={r.rechecks.length} />
            </Card>
            <Card title="Engine stats">
              {r.stats && Object.keys(r.stats).length ? Object.entries(r.stats).map(([k, v]) => (
                <KV key={k} k={k.replace(/_/g, ' ')} v={<span className="tabular-nums">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>} />
              )) : <p className="text-sm text-zinc-500">{r.status === 'running' ? 'Available when the run finishes.' : 'No stats reported.'}</p>}
            </Card>
            <Card title="Summary">
              <p className="text-sm leading-relaxed text-zinc-300">{r.summary ?? <span className="text-zinc-500">{r.status === 'running' ? 'Run in progress…' : 'No summary reported.'}</span>}</p>
              {r.metadata && Object.entries(r.metadata).map(([k, v]) => <KV key={k} k={k} v={typeof v === 'object' ? JSON.stringify(v) : String(v)} />)}
            </Card>
          </div>

          <Card title={`Bugs in this run (${r.bugs.length})`}>
            {r.bugs.length === 0 ? <Empty icon={<Bug className="size-5" />} title="No bugs in this run" /> : (
              <div className="-mx-2 divide-y divide-white/[0.05]">
                {r.bugs.map((b) => (
                  <Link key={b.id} to={`/bugs?bug=${b.id}&run=${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.03]">
                    {b.thumbnail ? <img src={b.thumbnail} className="h-9 w-14 shrink-0 rounded-md border border-white/10 object-cover [image-rendering:pixelated]" /> : <div className="h-9 w-14 shrink-0 rounded-md border border-dashed border-white/10" />}
                    <span className="w-16 shrink-0 font-mono text-xs text-violet-300">{b.key}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{b.title}</span>
                    {b.first_run_id === r.id && <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] text-fuchsia-300">new</span>}
                    {!!b.regression && <RegressionBadge />}
                    <VerificationBadge v={b.verification} />
                    <StatusBadge status={b.status} />
                    <SeverityBadge severity={b.severity} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><ScrollText className="size-4 text-zinc-400" />Event log ({logs.length})</span>}
            action={
              <div className="flex gap-1 rounded-lg border border-white/[0.07] p-0.5">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setMinLevel(l)} className={cn('rounded-md px-2 py-1 text-xs capitalize transition', minLevel === l ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>{l === 'debug' ? 'all' : `${l}+`}</button>
                ))}
              </div>
            }
          >
            {logs.length === 0 ? <p className="text-sm text-zinc-500">No log entries.</p> : (
              <div className="max-h-[480px] overflow-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-xs leading-6">
                {logs.map((l) => (
                  <div key={l.id} className="flex gap-3 rounded px-1 hover:bg-white/[0.03]">
                    <span className="shrink-0 text-zinc-600">{fmtTime(l.ts)}</span>
                    <span className={cn('w-14 shrink-0 uppercase', LEVEL_STYLE[l.level])}>{l.level}</span>
                    {l.bug_id ? <Link to={`/bugs?bug=${l.bug_id}`} className="shrink-0 text-violet-300 hover:underline">BUG-{String(l.bug_id).padStart(3, '0')}</Link> : <span className="w-[60px] shrink-0" />}
                    <span className="whitespace-pre-wrap break-words text-zinc-300">{l.message}{l.data && <span className="text-zinc-500"> {JSON.stringify(l.data)}</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
