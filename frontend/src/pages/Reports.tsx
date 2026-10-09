import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, FileCode2, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import { api, reportUrl } from '../api'
import { cn } from '../lib'
import type { BugFilters, ReportFormat } from '../types'
import { Card, PageHeader, Select } from '../components/ui'

const FORMATS: { f: ReportFormat; label: string; hint: string; icon: typeof FileText; color: string }[] = [
  { f: 'html', label: 'HTML', hint: 'Self-contained, screenshots embedded, print to PDF', icon: FileCode2, color: 'text-violet-300' },
  { f: 'md', label: 'Markdown', hint: 'Paste into GitHub / Jira / Notion', icon: FileText, color: 'text-sky-300' },
  { f: 'json', label: 'JSON', hint: 'Full data incl. logs & rechecks', icon: FileJson, color: 'text-amber-300' },
  { f: 'csv', label: 'CSV', hint: 'Spreadsheet-friendly bug list', icon: FileSpreadsheet, color: 'text-emerald-300' },
]

function FormatPicker({ value, onChange }: { value: ReportFormat; onChange: (f: ReportFormat) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FORMATS.map(({ f, label, hint, icon: Icon, color }) => (
        <button key={f} onClick={() => onChange(f)} className={cn('rounded-md border p-3 text-left transition', value === f ? 'border-violet-400/40 bg-violet-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]')}>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100"><Icon className={cn('size-4', color)} />{label}</div>
          <div className="mt-1 text-[11px] leading-4 text-zinc-500">{hint}</div>
        </button>
      ))}
    </div>
  )
}

export function ReportsPage() {
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api.runs() })
  const facets = useQuery({ queryKey: ['facets'], queryFn: api.facets })
  const [runId, setRunId] = useState('')
  const [runFormat, setRunFormat] = useState<ReportFormat>('html')
  const [bugFormat, setBugFormat] = useState<ReportFormat>('html')
  const [filters, setFilters] = useState<BugFilters>({})

  const set = (k: keyof BugFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }))

  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <PageHeader index="07" section="Exports" title="Reports"
        lede="Export verified evidence for developers, producers, or the judges." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Run report">
          <div className="space-y-4">
            <Select label="Choose a run…" value={runId} onChange={setRunId}
              options={runs.data?.map((r) => r.id) ?? []}
              render={(v) => { const r = runs.data?.find((x) => String(x.id) === v); return r ? `Run #${r.id} · ${r.project} ${r.build} · ${r.status}` : v }} />
            <FormatPicker value={runFormat} onChange={setRunFormat} />
            <a href={runId ? reportUrl.run(Number(runId), runFormat) : undefined} target="_blank" rel="noreferrer"
              className={cn('btn-primary w-full justify-center', !runId && 'pointer-events-none opacity-40')}>
              <ExternalLink className="size-4" />Generate run report
            </a>
          </div>
        </Card>
        <Card title="Bug report">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Select label="Any project" value={filters.project ?? ''} options={facets.data?.project ?? []} onChange={(v) => set('project', v)} />
              <Select label="Any build" value={filters.build ?? ''} options={facets.data?.build ?? []} onChange={(v) => set('build', v)} />
              <Select label="Any severity" value={filters.severity ?? ''} options={facets.data?.severity ?? []} onChange={(v) => set('severity', v)} />
              <Select label="Any status" value={filters.status ?? ''} options={facets.data?.status ?? []} onChange={(v) => set('status', v)} />
              <Select label="Any verification" value={filters.verification ?? ''} options={facets.data?.verification ?? []} onChange={(v) => set('verification', v)} />
              <Select label="Any category" value={filters.category ?? ''} options={facets.data?.category ?? []} onChange={(v) => set('category', v)} />
            </div>
            <FormatPicker value={bugFormat} onChange={setBugFormat} />
            <a href={reportUrl.bugs(bugFormat, filters)} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
              <ExternalLink className="size-4" />Generate bug report
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}
