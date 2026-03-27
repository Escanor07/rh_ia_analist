import { Outlet, NavLink } from 'react-router-dom'
import { BarChart3, Users, Database, Loader2, Menu, X, Shield } from 'lucide-react'
import { usePipeline } from '../context/PipelineContext'
import { useState, useCallback } from 'react'

function HeaderNavLink({ to, label, Icon, onNavigate }) {
  return (
    <NavLink to={to} end={to === '/'} onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2 2xl:px-5 2xl:py-2.5 rounded-lg text-sm 2xl:text-[15px] font-semibold transition-all ${isActive ? 'bg-white/15 text-white shadow-sm' : 'text-steel-300 hover:text-white hover:bg-white/8'}`
      }>
      <Icon className="w-4 h-4" />{label}
    </NavLink>
  )
}

function PipelineIndicator({ status, progress, compact }) {
  if (!status?.running) return null
  const label = status.task === 'ingest' ? 'Indexando' : 'Sincronizando'
  const pct = progress >= 0 ? `${progress}%` : ''

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-steel-300">
        <Loader2 className="w-3 h-3 animate-spin" />{label}... {pct}
      </div>
    )
  }

  return (
    <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 2xl:px-3.5 2xl:py-2 bg-white/10 rounded-lg">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-steel-300" />
      <span className="text-xs 2xl:text-sm font-medium text-steel-200">{label}... {pct}</span>
      <div className="w-16 2xl:w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${progress < 0 ? 'bg-steel-300 animate-pulse w-full' : 'bg-steel-300'}`}
          style={progress >= 0 ? { width: `${progress}%` } : undefined} />
      </div>
    </div>
  )
}

export default function Layout() {
  const { status, progress } = usePipeline()
  const [mobileNav, setMobileNav] = useState(false)
  const closeMobileNav = useCallback(() => setMobileNav(false), [])

  return (
    <div className="h-dvh min-h-0 flex flex-col">
      <header className="bg-linear-to-r from-steel-900 via-steel-800 to-steel-900 text-white shrink-0 shadow-lg z-20">
        <div className="w-full max-w-[1440px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 2xl:py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4 lg:gap-6 2xl:gap-8">
            <div className="flex items-center gap-2.5 2xl:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 2xl:w-10 2xl:h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Database className="w-4 h-4 sm:w-5 sm:h-5 text-steel-200" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm sm:text-[15px] 2xl:text-base font-bold tracking-tight leading-tight">Hiring Intelligence</h1>
                <p className="text-[10px] 2xl:text-[11px] text-steel-400 font-medium">Lubtrac · Módulo de Reclutamiento</p>
              </div>
              <h1 className="sm:hidden text-sm font-bold">HI</h1>
            </div>
            <nav className="hidden md:flex gap-1 2xl:gap-2 ml-2 2xl:ml-4">
              <HeaderNavLink to="/" label="Dashboard" Icon={BarChart3} onNavigate={closeMobileNav} />
              <HeaderNavLink to="/matching" label="Matching" Icon={Users} onNavigate={closeMobileNav} />
              <HeaderNavLink to="/standards" label="Estándares" Icon={Shield} onNavigate={closeMobileNav} />
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <PipelineIndicator status={status} progress={progress} />
            <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10">
              {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileNav && (
          <div className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-1">
            <HeaderNavLink to="/" label="Dashboard" Icon={BarChart3} onNavigate={closeMobileNav} />
            <HeaderNavLink to="/matching" label="Matching" Icon={Users} onNavigate={closeMobileNav} />
            <HeaderNavLink to="/standards" label="Estándares" Icon={Shield} onNavigate={closeMobileNav} />
            <PipelineIndicator status={status} progress={progress} compact />
          </div>
        )}
      </header>
      <main className="flex-1 min-h-0 overflow-hidden bg-[#f0f3f8]"><Outlet /></main>
    </div>
  )
}
