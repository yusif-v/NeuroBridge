import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { api } from '../../api'
import { GlowyWaves } from './GlowyWaves'
import { container, focusRing } from './primitives'
import './hero.css'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

const TAGS = ['Recheck before report', 'Fixed only on retest', 'Regression tracking', 'AI as hypothesis']

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 sm:px-6">
      <dd className="text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-3xl">{value}</dd>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</dt>
    </div>
  )
}

/** Full-screen landing hero: animated glowing waves behind centred copy. */
export function Hero() {
  const stats = useQuery({ queryKey: ['landing', 'stats'], queryFn: api.stats, retry: false })
  const t = stats.data?.totals

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-[#0B0B10]"
    >
      {/* Background: charcoal lighting, waves, then a centre vignette that keeps text readable. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,#16161f_0%,transparent_70%)]" />
        <div className="hero-fade absolute inset-0">
          <GlowyWaves />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_45%,rgba(11,11,16,0.72)_0%,rgba(11,11,16,0.25)_60%,transparent_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#09090f]" />
      </div>

      <div className={`${container} flex flex-col items-center py-24 text-center md:py-32`}>
        <p
          className="hero-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-300"
          style={delay(0)}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
          LLM-powered game QA
        </p>

        <h1
          id="hero-title"
          className="hero-rise mt-8 max-w-5xl text-balance text-[2.9rem] font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-7xl lg:text-[5.5rem]"
          style={delay(120)}
        >
          Game QA that{' '}
          <span className="bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] bg-clip-text text-transparent">
            shows its evidence.
          </span>
        </h1>

        <p
          className="hero-rise mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-300 md:text-xl"
          style={delay(240)}
        >
          An engine plays your build, rechecks every finding, an LLM explains what it found — and the platform
          proves it with screenshots, logs and retests.
        </p>

        <div className="hero-rise mt-10 flex flex-wrap items-center justify-center gap-3" style={delay(360)}>
          <Link
            to="/app"
            className={`group inline-flex h-12 items-center gap-2 rounded-md bg-violet-500 px-6 text-sm font-medium text-white shadow-[0_0_0_0_rgba(139,92,246,0)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-violet-400 hover:shadow-[0_8px_30px_-6px_rgba(139,92,246,0.6)] ${focusRing}`}
          >
            Open platform
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <a
            href="#how"
            className={`group inline-flex h-12 items-center gap-2 rounded-md border border-white/15 bg-white/[0.02] px-6 text-sm font-medium text-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#00E5FF]/40 hover:text-white ${focusRing}`}
          >
            See how it works
            <ArrowDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden />
          </a>
        </div>

        <ul className="hero-rise mt-10 flex max-w-3xl flex-wrap justify-center gap-2" style={delay(480)} aria-label="Principles">
          {TAGS.map((tag) => (
            <li key={tag} className="rounded-sm border border-white/[0.08] bg-[#0B0B10]/60 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
              {tag}
            </li>
          ))}
        </ul>

        {t && (
          <div className="hero-rise mt-14" style={delay(600)}>
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
              Live from this instance
            </p>
            <dl className="mt-4 flex flex-wrap justify-center divide-x divide-white/[0.08]">
              <Stat label="Runs" value={t.runs} />
              <Stat label="Confirmed bugs" value={t.confirmed} />
              <Stat label="Rechecks" value={t.rechecks} />
              <Stat label="Fixed on retest" value={t.fixed} />
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}
