export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

export function fmtDate(iso: string | null | undefined, withTime = true) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, withTime
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric' })
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

// Prefers the engine-reported duration (stats.duration_s) once a run has finished.
export function duration(start: string, end: string | null, reportedSeconds?: unknown) {
  const ms = end && typeof reportedSeconds === 'number'
    ? reportedSeconds * 1000
    : (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export const LIVE_MS = 3000

export function pct(x: number | null | undefined, digits = 0) {
  return x == null ? '—' : `${(x * 100).toFixed(digits)}%`
}

export function usd(x: number | null | undefined) {
  if (x == null) return '—'
  if (x === 0) return '$0'
  if (Math.abs(x) < 0.01) return `$${x.toFixed(4)}`
  if (Math.abs(x) < 100) return `$${x.toFixed(2)}`
  return `$${Math.round(x).toLocaleString()}`
}

export function compact(n: number | null | undefined) {
  if (n == null) return '—'
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function humanize(s: string) {
  const t = s.replace(/_/g, ' ')
  return t[0].toUpperCase() + t.slice(1)
}
