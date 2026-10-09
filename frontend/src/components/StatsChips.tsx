export function StatsChips({ stats }: { stats: Record<string, unknown> | null }) {
  if (!stats || Object.keys(stats).length === 0) return <span className="text-zinc-600">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(stats).slice(0, 4).map(([k, v]) => (
        <span key={k} className="whitespace-nowrap rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-zinc-400">
          {k.replace(/_/g, ' ')} <span className="tabular-nums text-zinc-200">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  )
}
