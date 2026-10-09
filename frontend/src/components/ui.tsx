import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, CircleSlash, RotateCcw, X } from 'lucide-react'
import type { BugStatus, LogLevel, RunStatus, Severity, Verification } from '../types'
import { cn } from '../lib'

export function Pill({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4', className)}>
      {children}
    </span>
  )
}

const SEVERITY: Record<Severity, string> = {
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  low: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
}
export const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-rose-400', high: 'bg-orange-400', medium: 'bg-amber-300', low: 'bg-zinc-400',
}
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: '#fb7185', high: '#fb923c', medium: '#fcd34d', low: '#a1a1aa',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Pill className={SEVERITY[severity]}>
      <span className={cn('size-1.5 rounded-full', SEVERITY_DOT[severity])} />
      <span className="capitalize">{severity}</span>
    </Pill>
  )
}

const STATUS: Record<BugStatus, string> = {
  open: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
  ticketed: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  fixed: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  ignored: 'border-zinc-600/40 bg-zinc-700/20 text-zinc-400',
  false_positive: 'border-slate-500/40 bg-slate-600/15 text-slate-400 line-through decoration-slate-500/70',
}
export function StatusBadge({ status }: { status: BugStatus }) {
  const label = status === 'false_positive' ? 'False positive' : status[0].toUpperCase() + status.slice(1)
  return <Pill className={STATUS[status]} title={status === 'false_positive' ? 'Marked as false positive by a reviewer' : undefined}>{label}</Pill>
}

export function VerificationBadge({ v }: { v: Verification }) {
  if (v === 'confirmed')
    return <Pill className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300" title="Engine reproduced this bug on recheck"><CheckCircle2 className="size-3" />Confirmed</Pill>
  if (v === 'unverified')
    return <Pill className="border-amber-400/30 bg-amber-500/10 text-amber-200" title="Waiting for engine recheck"><CircleDashed className="size-3" />Unverified</Pill>
  return <Pill className="border-zinc-600/40 bg-zinc-700/20 text-zinc-400" title="Engine could not reproduce on recheck"><CircleSlash className="size-3" />Not reproduced</Pill>
}

export function RegressionBadge() {
  return <Pill className="border-rose-500/40 bg-rose-500/15 text-rose-300" title="Previously fixed, came back"><RotateCcw className="size-3" />Regression</Pill>
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  if (status === 'running')
    return (
      <Pill className="border-violet-400/40 bg-violet-500/15 text-violet-200">
        <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-300 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-violet-300" /></span>
        Running
      </Pill>
    )
  if (status === 'failed') return <Pill className="border-rose-500/30 bg-rose-500/10 text-rose-300"><AlertTriangle className="size-3" />Failed</Pill>
  return <Pill className="border-emerald-400/25 bg-emerald-500/10 text-emerald-300"><CheckCircle2 className="size-3" />Completed</Pill>
}

export const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: 'text-zinc-500',
  info: 'text-sky-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
}

export function LiveDot({ label = 'Live' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
      {label}
    </span>
  )
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('glass p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-zinc-500">{icon}</div>}
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      {hint && <div className="max-w-sm text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {error instanceof Error ? error.message : 'Something went wrong'} — is the backend running on :8000?
    </div>
  )
}

export function Select({ label, value, options, onChange, render }: {
  label: string
  value: string
  options: (string | number)[]
  onChange: (v: string) => void
  render?: (v: string) => string
}) {
  return (
    <label className="relative block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('input appearance-none pr-8', value ? 'text-zinc-100 border-violet-500/30 bg-violet-500/[0.06]' : 'text-zinc-400')}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={String(o)}>{render ? render(String(o)) : String(o)}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
    </label>
  )
}

export function Menu({ button, children }: { button: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{button}</div>
      {open && (
        <div className="animate-fade-in absolute right-0 z-30 mt-2 min-w-48 overflow-hidden rounded-xl border border-white/10 bg-[#14121f]/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white'
  return href
    ? <a className={cls} href={href} target="_blank" rel="noreferrer" onClick={onClick}>{children}</a>
    : <button className={cls} onClick={onClick}>{children}</button>
}

export function Lightbox({ src, caption, onClose }: { src: string; caption?: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={onClose}>
      <button className="btn absolute right-6 top-6" onClick={onClose}><X className="size-4" /></button>
      <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <img src={src} className="max-h-[80vh] rounded-xl border border-white/10 object-contain [image-rendering:pixelated]" />
        {caption && <figcaption className="mt-3 text-center text-sm text-zinc-400">{caption}</figcaption>}
      </figure>
    </div>
  )
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-zinc-500">{k}</span>
      <span className="min-w-0 truncate text-right text-zinc-200">{v ?? '—'}</span>
    </div>
  )
}
