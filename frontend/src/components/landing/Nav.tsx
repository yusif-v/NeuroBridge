import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { container, focusRing } from './primitives'

export const NAV = [
  { href: '#problem', label: 'Problem' },
  { href: '#how', label: 'How it works' },
  { href: '#evidence', label: 'Evidence' },
  { href: '#quality', label: 'Quality' },
  { href: '#cost', label: 'Cost' },
  { href: '#integrate', label: 'Integrate' },
  { href: '#faq', label: 'FAQ' },
]

export function Logo() {
  return (
    <a href="#top" className={`flex items-center gap-2.5 rounded-sm ${focusRing}`} aria-label="BugLens AI, back to top">
      <span aria-hidden className="grid size-7 place-items-center rounded-sm bg-violet-500 font-mono text-[13px] font-semibold text-white">B</span>
      <span className="text-[15px] font-semibold tracking-tight text-white">BugLens <span className="text-violet-400">AI</span></span>
    </a>
  )
}

export function Nav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const link = `rounded-sm px-1 py-1 text-sm text-zinc-400 transition-colors hover:text-white ${focusRing}`

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#09090f]/95 supports-[backdrop-filter]:bg-[#09090f]/85 supports-[backdrop-filter]:backdrop-blur-sm">
      <div className={`${container} flex h-16 items-center justify-between gap-6`}>
        <Logo />
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {NAV.map((n) => <li key={n.href}><a href={n.href} className={link}>{n.label}</a></li>)}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/app" className={`hidden h-9 items-center rounded-sm bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-400 sm:inline-flex ${focusRing}`}>
            Open platform
          </Link>
          <button
            type="button"
            className={`grid size-9 place-items-center rounded-sm border border-white/15 text-zinc-300 lg:hidden ${focusRing}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      <nav id="mobile-nav" aria-label="Sections" hidden={!open} className="border-t border-white/[0.07] lg:hidden">
        <ul className={`${container} flex flex-col py-2`}>
          {NAV.map((n, i) => (
            <li key={n.href} className="border-b border-white/[0.05] last:border-0">
              <a href={n.href} onClick={() => setOpen(false)} className={`flex items-baseline gap-4 py-3 text-base text-zinc-300 hover:text-white ${focusRing}`}>
                <span className="font-mono text-xs text-zinc-600">{String(i + 1).padStart(2, '0')}</span>{n.label}
              </a>
            </li>
          ))}
          <li className="py-3 sm:hidden">
            <Link to="/app" className={`flex h-11 items-center justify-center rounded-sm bg-violet-500 text-sm font-medium text-white ${focusRing}`}>Open platform</Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
