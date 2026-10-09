import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDownWideNarrow, Bug, Download, FileCode2, FileJson, FileSpreadsheet, FileText, Search, X } from 'lucide-react'
import { api, reportUrl } from '../api'
import { LIVE_MS, cn, fmtDate } from '../lib'
import type { BugFilters, Facets } from '../types'
import { BugPanel } from '../components/BugPanel'
import { Empty, ErrorNote, Menu, MenuItem, RegressionBadge, SeverityBadge, Skeleton, StatusBadge, VerificationBadge, Select } from '../components/ui'

const FILTERS: { key: keyof Facets; label: string; render?: (v: string) => string }[] = [
  { key: 'project', label: 'Project' },
  { key: 'build', label: 'Build' },
  { key: 'run', label: 'Run', render: (v) => `Run #${v}` },
  { key: 'severity', label: 'Severity', render: (v) => v[0].toUpperCase() + v.slice(1) },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status', render: (v) => (v === 'false_positive' ? 'False positive' : v[0].toUpperCase() + v.slice(1)) },
  { key: 'verification', label: 'Verification', render: (v) => v.replace('_', ' ') },
  { key: 'test', label: 'Test' },
  { key: 'agent', label: 'Agent' },
]

const COLUMNS = ['ID', 'Title', 'Severity', 'Category', 'Status', 'Verification', 'Project', 'Build', 'Test', 'Agent', 'Conf.', 'Seen', 'Found']
// Hidden while the side panel is open so the table doesn't need horizontal scroll.
const WIDE_ONLY = ['Category', 'Project', 'Test', 'Agent', 'Seen', 'Found']

export function BugsPage() {
  const [params, setParams] = useSearchParams()
  const filters: BugFilters = useMemo(() => {
    const f: BugFilters = {}
    for (const { key } of FILTERS) { const v = params.get(key); if (v) f[key] = v }
    const q = params.get('q'); if (q) f.q = q
    return f
  }, [params])
  const sort = params.get('sort') === 'severity' ? 'severity' : 'recent'
  const selected = params.get('bug') ? Number(params.get('bug')) : null

  const [search, setSearch] = useState(filters.q ?? '')
  useEffect(() => setSearch(filters.q ?? ''), [filters.q])

  const setParam = (key: string, value: string | null) => {
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (value) n.set(key, value); else n.delete(key)
      return n
    }, { replace: key === 'q' })
  }
  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => { if ((filters.q ?? '') !== search) setParam('q', search || null) }, 250)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const facets = useQuery({ queryKey: ['facets'], queryFn: api.facets, refetchInterval: LIVE_MS * 3 })
  const bugs = useQuery({
    queryKey: ['bugs', filters, sort],
    queryFn: () => api.bugs(filters, sort),
    refetchInterval: LIVE_MS,
    placeholderData: keepPreviousData,
  })

  const activeFilters = FILTERS.filter(({ key }) => filters[key]).length + (filters.q ? 1 : 0)
  const clearAll = () => setParams(selected ? { bug: String(selected) } : {})

  return (
    <div className="mx-auto flex max-w-[1800px] gap-5">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-white/[0.07] pb-7">
          <div>
            <div className="eyebrow mb-3"><span className="text-violet-300">02</span> <span className="text-zinc-600">—</span> Findings</div><h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl">Bug Reports</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">Findings pushed by the engine, deduplicated and verified by recheck.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className={cn('btn', sort === 'severity' && 'border-violet-400/30 text-violet-200')} onClick={() => setParam('sort', sort === 'severity' ? null : 'severity')}>
              <ArrowDownWideNarrow className="size-4" />{sort === 'severity' ? 'By severity' : 'Most recent'}
            </button>
            <Menu button={<button className="btn-primary"><Download className="size-4" />Export</button>}>
              {(close) => (
                <>
                  <MenuItem href={reportUrl.bugs('html', filters)} onClick={close}><FileCode2 className="size-4 text-violet-300" />HTML report</MenuItem>
                  <MenuItem href={reportUrl.bugs('md', filters)} onClick={close}><FileText className="size-4 text-sky-300" />Markdown</MenuItem>
                  <MenuItem href={reportUrl.bugs('json', filters)} onClick={close}><FileJson className="size-4 text-amber-300" />JSON</MenuItem>
                  <MenuItem href={reportUrl.bugs('csv', filters)} onClick={close}><FileSpreadsheet className="size-4 text-emerald-300" />CSV</MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>

        <div className="glass space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, description, actual result…" className="input pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-5">
            {FILTERS.map(({ key, label, render }) => (
              <Select key={key} label={label} value={filters[key] ?? ''} options={facets.data?.[key] ?? []} render={render} onChange={(v) => setParam(key, v || null)} />
            ))}
            <button className="btn justify-center" disabled={!activeFilters} onClick={clearAll}><X className="size-4" />Clear{activeFilters ? ` (${activeFilters})` : ''}</button>
          </div>
        </div>

        {bugs.error && <ErrorNote error={bugs.error} />}

        <div className="glass overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">All bugs</span>
            <span className="text-xs tabular-nums text-zinc-500">{bugs.data ? `${bugs.data.length} result${bugs.data.length === 1 ? '' : 's'}` : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {COLUMNS.filter((h) => !(selected && WIDE_ONLY.includes(h))).map((h) => (
                    <th key={h} className="label whitespace-nowrap px-3 py-3 font-medium first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {bugs.isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={selected ? 7 : 13} className="px-5 py-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))}
                {bugs.data?.map((b) => (
                  <tr key={b.id} onClick={() => setParam('bug', selected === b.id ? null : String(b.id))}
                    className={cn('cursor-pointer transition', selected === b.id ? 'bg-violet-500/[0.07] shadow-[inset_2px_0_0_0_#a78bfa]' : 'hover:bg-white/[0.025]')}>
                    <td className="whitespace-nowrap py-3 pl-5 pr-3 font-mono text-xs text-violet-300">{b.key}</td>
                    <td className="max-w-[320px] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-zinc-100" title={b.title}>{b.title}</span>
                        {!!b.regression && <RegressionBadge />}
                      </div>
                    </td>
                    <td className="px-3 py-3"><SeverityBadge severity={b.severity} /></td>
                    {!selected && <td className="whitespace-nowrap px-3 py-3 capitalize text-zinc-300">{b.category ?? '—'}</td>}
                    <td className="px-3 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-3"><VerificationBadge v={b.verification} /></td>
                    {!selected && <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{b.project}</td>}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-400">{b.build ?? '—'}</td>
                    {!selected && <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{b.test_name ?? '—'}</td>}
                    {!selected && <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{b.agent ?? '—'}</td>}
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-zinc-300">{b.confidence != null ? `${Math.round(b.confidence * 100)}%` : '—'}</td>
                    {!selected && <td className="px-3 py-3 tabular-nums text-zinc-400">{b.occurrences}×</td>}
                    {!selected && <td className="whitespace-nowrap py-3 pl-3 pr-5 text-xs text-zinc-500">{fmtDate(b.found_at, false)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {bugs.data?.length === 0 && (
              <Empty icon={<Bug className="size-5" />} title={activeFilters ? 'No bugs match these filters' : 'No bugs yet'}
                hint={activeFilters ? 'Try clearing a filter.' : 'When the engine reports findings they appear here in real time.'} />
            )}
          </div>
        </div>
      </div>

      {selected && <BugPanel key={selected} bugId={selected} onClose={() => setParam('bug', null)} />}
    </div>
  )
}
