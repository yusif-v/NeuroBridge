import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bot, Boxes, Bug, FileText, LayoutDashboard, Play, Plug, Search, Settings, Sparkles } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, cn } from '../lib'
import { LiveDot } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bugs', label: 'Bug Reports', icon: Bug },
  { to: '/runs', label: 'Test Runs', icon: Play },
  { to: '/builds', label: 'Builds', icon: Boxes },
  { to: '/reports', label: 'Reports', icon: FileText },
]
const SOON = [
  { label: 'Agents', icon: Bot },
  { label: 'Integrations', icon: Plug },
  { label: 'Settings', icon: Settings },
]

export function Layout() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: LIVE_MS })
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const live = (stats.data?.totals.active_runs ?? 0) > 0
  const openBugs = stats.data?.totals.open

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    navigate(`/bugs${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  return (
    <div className="flex h-full">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/[0.06] bg-black/20 px-3 py-5 backdrop-blur-xl max-lg:w-16 max-lg:px-2">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-900/50">
            <Search className="size-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="max-lg:hidden">
            <div className="text-[15px] font-semibold tracking-tight text-white">BugLens <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">AI</span></div>
            <div className="text-[11px] text-zinc-500">LLM-powered game QA</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}
              className={({ isActive }) => cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/5 text-white ring-1 ring-inset ring-violet-400/20' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200',
              )}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-violet-400 to-fuchsia-400 max-lg:-left-2" />}
                  <Icon className={cn('size-4 shrink-0', isActive && 'text-violet-300')} />
                  <span className="max-lg:hidden">{label}</span>
                  {label === 'Bug Reports' && !!openBugs && (
                    <span className="ml-auto rounded-full bg-white/[0.06] px-2 text-[11px] tabular-nums text-zinc-300 max-lg:hidden">{openBugs}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="label mb-2 mt-8 px-3 max-lg:hidden">Coming soon</div>
        <div className="flex flex-col gap-1 max-lg:mt-6">
          {SOON.map(({ label, icon: Icon }) => (
            <div key={label} title={`${label} — coming soon`} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-600">
              <Icon className="size-4 shrink-0" />
              <span className="max-lg:hidden">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto max-lg:hidden">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <Sparkles className="size-3.5 text-violet-300" /> AI analyzer
            </div>
            <div className={cn('mt-1 text-[11px]', stats.data?.ai_enabled ? 'text-emerald-300' : 'text-zinc-500')}>
              {stats.data ? (stats.data.ai_enabled ? 'Connected' : 'Not configured') : '…'}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-white/[0.06] bg-[#09090f]/70 px-6 py-3 backdrop-blur-xl">
          <form onSubmit={onSearch} className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bugs…" className="input pl-9" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            {live ? <LiveDot label={`${stats.data!.totals.active_runs} run${stats.data!.totals.active_runs > 1 ? 's' : ''} live`} /> : (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] px-2.5 py-1 text-xs text-zinc-500">
                <span className="size-2 rounded-full bg-zinc-600" /> Engine idle
              </span>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-3">
              <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-400/80 to-teal-500/80 text-xs font-bold text-white">QA</div>
              <span className="text-sm text-zinc-300">QA Team</span>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
