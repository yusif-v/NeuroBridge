import type { Bug, BugDetail, BugFilters, BugStatus, Build, Facets, ReportFormat, Run, RunDetail, Severity, Stats, Playtest, SandboxCapabilities } from './types'

const BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init?.headers },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch { /* non-JSON error */ }
    throw new Error(`${res.status}: ${detail}`)
  }
  return res.json()
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  stats: () => request<Stats>('/stats'),
  facets: () => request<Facets>('/facets'),
  bugs: (filters: BugFilters = {}, sort: 'recent' | 'severity' = 'recent') =>
    request<Bug[]>(`/bugs${qs({ ...filters, sort })}`),
  bug: (id: number) => request<BugDetail>(`/bugs/${id}`),
  updateBug: (id: number, body: { status?: BugStatus; severity?: Severity }) =>
    request<BugDetail>(`/bugs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  analyze: (id: number) => request<{ ai_status: string }>(`/bugs/${id}/analyze`, { method: 'POST' }),
  runs: (limit = 100) => request<Run[]>(`/runs${qs({ limit })}`),
  run: (id: number) => request<RunDetail>(`/runs/${id}`),
  builds: () => request<Build[]>('/builds'),
  sandbox: () => request<SandboxCapabilities>('/playtests/capabilities'),
  playtests: () => request<Playtest[]>('/playtests'),
  playtest: (id: string) => request<Playtest>(`/playtests/${id}`),
  uploadBuild: (body: FormData) => request<Playtest>('/playtests', { method: 'POST', body }),
  cancelPlaytest: (id: string) => request<Playtest>(`/playtests/${id}/cancel`, { method: 'POST' }),
}

export const reportUrl = {
  run: (id: number, format: ReportFormat) => `${BASE}/reports/runs/${id}${qs({ format })}`,
  bugs: (format: ReportFormat, filters: BugFilters = {}) => `${BASE}/reports/bugs${qs({ ...filters, format })}`,
}
