import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, duration, fmtDate } from '../lib'
import { Empty, ErrorNote, RunStatusBadge, Skeleton } from '../components/ui'
import { StatsChips } from '../components/StatsChips'

export function RunsPage() {
  const navigate = useNavigate()
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api.runs(), refetchInterval: LIVE_MS })

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Test Runs</h1>
        <p className="mt-1 text-sm text-zinc-500">Each session where the engine played a build and reported what it found.</p>
      </div>
      {runs.error && <ErrorNote error={runs.error} />}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                {['Run', 'Project', 'Build', 'Agent', 'Status', 'Started', 'Duration', 'New bugs', 'Bugs seen', 'Stats'].map((h) => (
                  <th key={h} className="label whitespace-nowrap px-3 py-3 font-medium first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {runs.isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={10} className="px-5 py-3"><Skeleton className="h-6" /></td></tr>)}
              {runs.data?.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/runs/${r.id}`)} className="cursor-pointer transition hover:bg-white/[0.025]">
                  <td className="py-3 pl-5 pr-3 font-mono text-xs text-violet-300">#{r.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-200">{r.project}</td>
                  <td className="px-3 py-3 font-mono text-xs text-zinc-400">{r.build}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{r.agent ?? '—'}</td>
                  <td className="px-3 py-3"><RunStatusBadge status={r.status} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{fmtDate(r.started_at)}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-zinc-400">{duration(r.started_at, r.finished_at, r.stats?.duration_s)}</td>
                  <td className="px-3 py-3 tabular-nums text-fuchsia-300">{r.new_bugs ? `+${r.new_bugs}` : '0'}</td>
                  <td className="px-3 py-3 tabular-nums text-zinc-300">{r.bugs_seen}</td>
                  <td className="py-3 pl-3 pr-5"><StatsChips stats={r.stats} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.data?.length === 0 && <Empty icon={<Play className="size-5" />} title="No runs yet" hint="Runs appear here as soon as the engine calls POST /api/v1/ingest/runs." />}
        </div>
      </div>
    </div>
  )
}
