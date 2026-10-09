import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bot, Boxes, Bug, Coins, FileText, LayoutDashboard, Play, Plug, Search, Settings, Sparkles, Target } from 'lucide-react'
import { api } from '../api'
import { LIVE_MS, cn } from '../lib'
import { LiveDot } from './ui'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/bugs', label: 'Bug Reports', icon: Bug },
  { to: '/app/runs', label: 'Test Runs', icon: Play },
  { to: '/app/builds', label: 'Builds', icon: Boxes },
  { to: '/app/scorecard', label: 'QA Scorecard', icon: Target },
  { to: '/app/usage', label: 'Usage', icon: Coins },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/integrations', label: 'Integrations', icon: Plug },
]
const SOON = [
  { label: 'Agents', icon: Bot },
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
    navigate(`/app/bugs${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  return (
    <div className="flex h-full">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/[0.07] bg-[#09090f] px-3 py-5 max-lg:w-16 max-lg:px-2">
        <Link to="/" title="BugLens AI — home" className="mb-8 flex items-center gap-3 rounded-sm px-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-violet-500">
            <Search className="size-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="max-lg:hidden">
            <div className="text-[15px] font-semibold tracking-tight text-white">BugLens <span className="text-violet-300">AI</span></div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Game QA platform</div>
          </div>
        </Link>

        <div className="eyebrow mb-2 px-3 max-lg:hidden">Platform</div>
        <nav className="flex flex-col gap-0.5" aria-label="Platform">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}
              className={({ isActive }) => cn(
                'group relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-white/[0.04] text-white' : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100',
              )}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-1 left-0 w-0.5 bg-violet-400" />}
                  <Icon className={cn('size-4 shrink-0', isActive ? 'text-violet-300' : 'text-zinc-500 group-hover:text-zinc-300')} />
                  <span className="max-lg:hidden">{label}</span>
                  {label === 'Bug Reports' && !!openBugs && (
                    <span className="ml-auto rounded-sm border border-white/[0.08] px-1.5 font-mono text-[11px] tabular-nums text-zinc-300 max-lg:hidden">{openBugs}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="eyebrow mb-2 mt-8 px-3 max-lg:hidden">Coming soon</div>
        <div className="flex flex-col gap-0.5 max-lg:mt-6">
          {SOON.map(({ label, icon: Icon }) => (
            <div key={label} title={`${label} — coming soon`} className="flex cursor-not-allowed items-center gap-3 rounded-sm px-3 py-2 text-sm text-zinc-600">
              <Icon className="size-4 shrink-0" />
              <span className="max-lg:hidden">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto max-lg:hidden">
          <div className="border-t border-white/[0.07] px-3 pt-4">
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
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-white/[0.07] bg-[#09090f] px-6 py-3 lg:px-10">
          <form onSubmit={onSearch} role="search" className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bugs…" aria-label="Search bugs" className="input pl-9" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            {live ? <LiveDot label={`${stats.data!.totals.active_runs} run${stats.data!.totals.active_runs > 1 ? 's' : ''} live`} /> : (
              <span className="inline-flex items-center gap-2 rounded-sm border border-white/[0.08] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500 max-sm:hidden">
                <span className="size-2 rounded-full bg-zinc-600" /> Engine idle
              </span>
            )}
            <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] py-1 pl-1 pr-3">
              <div className="grid size-7 place-items-center rounded-sm bg-emerald-500/80 text-xs font-bold text-white">QA</div>
              <span className="text-sm text-zinc-300 max-sm:hidden">QA Team</span>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
