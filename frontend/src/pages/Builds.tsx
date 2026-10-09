import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Boxes, Bug, CheckCircle2, Play } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, timeAgo } from '../lib'
import { Empty, ErrorNote, PageHeader, Skeleton } from '../components/ui'

export function BuildsPage() {
  const builds = useQuery({ queryKey: ['builds'], queryFn: api.builds, refetchInterval: LIVE_MS * 2 })
  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <PageHeader index="04" section="Versions" title="Builds"
        lede="Game builds the engine has tested. Builds are created automatically on first run." />
      {builds.error && <ErrorNote error={builds.error} />}
      {builds.isLoading && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {builds.data?.length === 0 && <div className="glass"><Empty icon={<Boxes className="size-5" />} title="No builds yet" /></div>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {builds.data?.map((b) => (
          <div key={b.id} className="glass group p-5 transition hover:border-violet-400/20">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-zinc-500">{b.project}</div>
                <div className="mt-0.5 font-mono text-xl font-semibold text-white">{b.version}</div>
              </div>
              <div className="grid size-10 place-items-center rounded-sm border border-violet-400/30 text-violet-300"><Boxes className="size-5" /></div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Link to={`/app/runs`} className="rounded-md bg-white/[0.03] p-3 hover:bg-white/[0.05]"><div className="flex items-center gap-1.5 text-xs text-zinc-500"><Play className="size-3" />Runs</div><div className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{b.runs}</div></Link>
              <Link to={`/app/bugs?build=${encodeURIComponent(b.version)}&status=open`} className="rounded-md bg-white/[0.03] p-3 hover:bg-white/[0.05]"><div className="flex items-center gap-1.5 text-xs text-zinc-500"><Bug className="size-3" />Open</div><div className="mt-1 text-lg font-semibold tabular-nums text-violet-200">{b.open_bugs}</div></Link>
              <Link to={`/app/bugs?build=${encodeURIComponent(b.version)}&status=fixed`} className="rounded-md bg-white/[0.03] p-3 hover:bg-white/[0.05]"><div className="flex items-center gap-1.5 text-xs text-zinc-500"><CheckCircle2 className="size-3" />Fixed</div><div className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">{b.fixed_bugs}</div></Link>
            </div>
            <div className="mt-4 text-xs text-zinc-500">Last run {timeAgo(b.last_run_at)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
