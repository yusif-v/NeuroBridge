import { ArrowDown, ArrowRight } from 'lucide-react'

const STAGES = [
  { key: 'found', label: 'Found', note: 'Engine reports a finding with screenshots, logs and steps.', tone: 'text-zinc-300', dot: 'bg-zinc-400' },
  { key: 'recheck', label: 'Rechecked', note: 'Engine replays the steps from a clean state, several times.', tone: 'text-amber-300', dot: 'bg-amber-400' },
  { key: 'confirmed', label: 'Confirmed', note: 'Only a reproduced finding becomes a bug. AI explains it.', tone: 'text-violet-300', dot: 'bg-violet-400' },
  { key: 'fixed', label: 'Fixed on retest', note: 'A newer build is rechecked and the bug no longer reproduces.', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
  { key: 'regression', label: 'Regression', note: 'If a fixed bug comes back, it is reopened and flagged.', tone: 'text-rose-300', dot: 'bg-rose-400' },
]

/** Bug lifecycle: a row of bordered stages (stacked on mobile) plus the side branch for rejected findings. */
export function Lifecycle() {
  return (
    <figure aria-labelledby="lifecycle-caption">
      <ol className="grid grid-cols-1 border border-white/[0.07] md:grid-cols-5">
        {STAGES.map((s, i) => (
          <li key={s.key} className="relative border-b border-white/[0.07] p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-600">{String(i + 1).padStart(2, '0')}</span>
              <span aria-hidden className={`size-2 rounded-full ${s.dot}`} />
            </div>
            <p className={`mt-8 text-lg font-semibold tracking-tight ${s.tone}`}>{s.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{s.note}</p>
            {i < STAGES.length - 1 && (
              <span aria-hidden className="absolute z-10 grid size-6 place-items-center border border-white/[0.12] bg-[#09090f] text-zinc-500 max-md:-bottom-3 max-md:left-5 md:-right-3 md:top-1/2 md:-translate-y-1/2">
                <ArrowRight className="hidden size-3 md:block" />
                <ArrowDown className="size-3 md:hidden" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 border-x border-b border-white/[0.07] md:grid-cols-5">
        <div className="hidden md:block" />
        <div className="p-5 md:col-span-4">
          <p className="text-sm text-zinc-400">
            <span className="font-mono text-xs text-zinc-600">↳ branch</span>
            <span className="ml-3 font-medium text-zinc-300">Not reproduced on recheck</span> — kept for audit, marked as noise,
            never counted as a bug.
          </p>
        </div>
      </div>
      <figcaption id="lifecycle-caption" className="mt-4 font-mono text-xs text-zinc-600">
        Fig. 1 — Bug lifecycle. Every transition is written to the bug's evidence trail.
      </figcaption>
    </figure>
  )
}
