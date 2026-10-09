export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type BugStatus = 'open' | 'ticketed' | 'fixed' | 'ignored'
export type Verification = 'unverified' | 'confirmed' | 'not_reproduced'
export type AIStatus = 'none' | 'pending' | 'done' | 'error' | 'disabled'
export type RunStatus = 'running' | 'completed' | 'failed'
export type LogLevel = 'debug' | 'info' | 'warning' | 'error'
export type ReportFormat = 'html' | 'md' | 'json' | 'csv'

export interface AIReport {
  summary?: string
  severity?: Severity
  likely_root_cause?: string
  recommended_fix?: string
  reproduction_steps?: string[]
  confidence?: 'low' | 'medium' | 'high'
  evidence_refs?: string[]
  insufficient_evidence?: boolean
  model?: string
  error?: string
}

export interface Bug {
  id: number
  key: string
  project_id: number
  project: string
  build: string | null
  fingerprint: string
  title: string
  description: string | null
  category: string | null
  severity: Severity
  status: BugStatus
  verification: Verification
  regression: number
  test_name: string | null
  agent: string | null
  confidence: number | null
  steps: string[] | null
  expected: string | null
  actual: string | null
  metadata: Record<string, unknown> | null
  build_id: number | null
  first_run_id: number | null
  last_run_id: number | null
  fixed_in_run: number | null
  occurrences: number
  ai_status: AIStatus
  ai_report: AIReport | null
  found_at: string
  updated_at: string
  thumbnail: string | null
}

export interface LogRow {
  id: number
  run_id: number
  bug_id: number | null
  ts: string
  level: LogLevel
  message: string
  data: Record<string, unknown> | null
}

export interface Recheck {
  id: number
  bug_id: number
  run_id: number | null
  result: 'reproduced' | 'not_reproduced'
  attempts: number | null
  notes: string | null
  created_at: string
}

export interface Attachment {
  id: number
  run_id: number | null
  bug_id: number | null
  recheck_id: number | null
  kind: string
  filename: string
  mime: string
  caption: string | null
  created_at: string
  url: string
}

export interface BugDetail extends Bug {
  attachments: Attachment[]
  logs: LogRow[]
  rechecks: Recheck[]
  runs: { id: number; status: RunStatus; started_at: string; build: string }[]
}

export interface Run {
  id: number
  project_id: number
  build_id: number
  project: string
  build: string
  agent: string | null
  status: RunStatus
  summary: string | null
  stats: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  started_at: string
  finished_at: string | null
  new_bugs: number
  bugs_seen: number
}

export interface RunDetail extends Run {
  bugs: Bug[]
  logs: LogRow[]
  rechecks: Recheck[]
}

export interface Build {
  id: number
  project_id: number
  project: string
  version: string
  created_at: string
  runs: number
  open_bugs: number
  fixed_bugs: number
  last_run_at: string | null
}

export interface Facets {
  project: string[]
  build: string[]
  run: number[]
  severity: Severity[]
  category: string[]
  status: BugStatus[]
  verification: Verification[]
  test: string[]
  agent: string[]
}

export interface Stats {
  totals: {
    runs: number
    active_runs: number
    bugs: number
    open: number
    confirmed: number
    unverified: number
    not_reproduced: number
    fixed: number
    regressions: number
    critical_open: number
    rechecks: number
    screenshots: number
  }
  by_severity: Partial<Record<Severity, number>>
  by_category: Record<string, number>
  by_status: Partial<Record<BugStatus, number>>
  by_verification: Partial<Record<Verification, number>>
  timeline: Run[]
  recent_bugs: Bug[]
  ai_enabled: boolean
}

export type BugFilters = Partial<Record<keyof Facets | 'q', string>>
