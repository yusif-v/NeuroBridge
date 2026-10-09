export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type BugStatus = 'open' | 'ticketed' | 'fixed' | 'ignored' | 'false_positive'
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

export interface BugEvent {
  id: number
  bug_id: number
  run_id: number | null
  type: string
  detail: string | null
  created_at: string
  build: string | null
}

export interface AIUsageRow {
  id: number
  bug_id: number | null
  run_id: number | null
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  latency_ms: number | null
  status: 'done' | 'error'
  error: string | null
  created_at: string
}

export interface BugDetail extends Bug {
  attachments: Attachment[]
  logs: LogRow[]
  rechecks: Recheck[]
  timeline: BugEvent[]
  ai_usage: AIUsageRow[]
  planted_in: { id: number; title: string; build: string }[]
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
    false_positives: number
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

// ---------- QA scorecard ----------

export type PlantedOutcome = 'detected' | 'missed' | 'rejected_by_recheck' | 'awaiting_recheck'

export interface KnownIssue {
  id: number
  project_id: number
  build_id: number
  fingerprint: string
  title: string
  category: string | null
  severity: Severity | null
  notes: string | null
  source: 'engine' | 'manual'
  created_at: string
  build: string
}

export interface PlantedIssue extends KnownIssue {
  outcome: PlantedOutcome
  bug_id: number | null
  bug_key: string | null
}

export interface BugSummary {
  id: number
  key: string
  title: string
  severity: Severity
  category: string | null
  status: BugStatus
  verification: Verification
}

export interface QualityMetrics {
  planted: number
  detected: number
  missed: number
  detection_rate: number | null
  reported_confirmed: number
  false_positives: number
  precision: number | null
  unplanned_findings: number
  noise_filtered: number
  awaiting_recheck: number
  raw_findings: number
  noise_filter_rate: number | null
}

export interface ManualSessionRow {
  id: number
  project_id: number
  build_id: number | null
  tester: string | null
  duration_min: number
  bugs_found: number
  planted_found: number | null
  false_positives: number
  notes: string | null
  created_at: string
  project?: string
  build?: string | null
}

export interface Scorecard extends Partial<QualityMetrics> {
  project: string | null
  build?: string | null
  builds: string[]
  planted_issues?: PlantedIssue[]
  lists?: { false_positives: BugSummary[]; unplanned: BugSummary[]; noise: BugSummary[] }
  per_build?: (QualityMetrics & { build: string })[]
  engine?: {
    runs: number
    minutes: number
    bugs_found: number
    planted_found: number
    false_positives: number
    cost_usd: number
    cost_breakdown: { engine_llm_usd: number; ai_analysis_usd: number }
  }
  manual?: {
    sessions: number
    minutes: number
    bugs_found: number
    planted_found: number | null
    false_positives: number
    cost_usd: number
  } | null
  manual_sessions?: ManualSessionRow[]
  comparison?: { speedup: number; bugs_per_hour_engine: number; bugs_per_hour_manual: number | null } | null
  assumptions?: { manual_hourly_rate_usd: number; engine_minutes_source: string }
}

export interface NewKnownIssue {
  fingerprint: string
  title: string
  category?: string
  severity?: Severity
  notes?: string
}

export interface NewManualSession {
  project: string
  build?: string
  tester?: string
  duration_min: number
  bugs_found: number
  planted_found?: number
  false_positives: number
  notes?: string
}

// ---------- usage ----------

export interface Usage {
  ai: {
    calls: number
    succeeded: number
    failed: number
    bugs_analyzed: number
    input_tokens: number
    output_tokens: number
    cost_usd: number
    calls_without_cost: number
    avg_latency_ms: number | null
    cost_per_analysis_usd: number | null
  }
  engine: {
    runs: number
    llm_cost_usd: number
    llm_input_tokens: number
    llm_output_tokens: number
    play_minutes: number
    actions: number
  }
  unit: {
    total_cost_usd: number
    cost_per_run_usd: number | null
    cost_per_confirmed_bug_usd: number | null
    confirmed_bugs: number
  }
  per_run: { run_id: number; build: string; started_at: string; engine_cost_usd: number; ai_cost_usd: number; ai_calls: number; new_bugs: number }[]
  by_model: { model: string; calls: number; input_tokens: number; output_tokens: number; cost_usd: number }[]
  recent_calls: (AIUsageRow & { title: string; project: string })[]
  pricing: { input_per_mtok_usd: number | null; output_per_mtok_usd: number | null }
}
