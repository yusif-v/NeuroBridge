import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { Link } from 'react-router-dom'

export const container = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10'

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f]'

export function Section({ id, num, label, title, intro, children }: {
  id: string
  num: string
  label: string
  title: ReactNode
  intro?: ReactNode
  children?: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-t border-white/[0.07]">
      <div className={`${container} py-20 md:py-28 lg:py-32`}>
        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
          <div className="col-span-12 lg:col-span-3">
            <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
              <span className="text-violet-400">{num}</span>
              <span aria-hidden className="h-px w-8 bg-white/15" />
              <span>{label}</span>
            </p>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <h2 id={`${id}-title`} className="max-w-4xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
              {title}
            </h2>
            {intro && <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-400">{intro}</p>}
          </div>
        </div>
        {children && <div className="mt-14 md:mt-20">{children}</div>}
      </div>
    </section>
  )
}

export function ButtonLink({ href, children, variant = 'primary', external }: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
  external?: boolean
}) {
  const cls = variant === 'primary'
    ? 'bg-violet-500 text-white hover:bg-violet-400'
    : 'border border-white/15 text-zinc-200 hover:border-white/30 hover:bg-white/[0.04]'
  const className = `inline-flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-medium transition-colors ${cls} ${focusRing}`
  if (href.startsWith('/')) return <Link to={href} className={className}>{children}</Link>
  return (
    <a href={href} className={className} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {children}
    </a>
  )
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <figure className="overflow-hidden rounded-sm border border-white/[0.07] bg-[#11111a]">
      <figcaption className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <span className="font-mono text-xs text-zinc-500">{label}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
          className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-xs text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 ${focusRing}`}
        >
          {copied ? <Check className="size-3.5 text-emerald-400" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6 text-zinc-300"><code>{code}</code></pre>
    </figure>
  )
}

/** A big number with a small mono label; `live` adds a tiny dot. */
export function Figure({ value, label, note }: { value: ReactNode; label: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className="text-4xl font-semibold tabular-nums tracking-[-0.03em] text-white md:text-5xl">{value}</dd>
      {note && <dd className="text-sm leading-snug text-zinc-500">{note}</dd>}
    </div>
  )
}

export function LiveTag({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
      {children}
    </p>
  )
}
