import { NavLink } from 'react-router-dom'
import { BarChart3, BrainCircuit, ShieldCheck, Cpu } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/matching', label: 'Matching', icon: BrainCircuit },
  { to: '/standards', label: 'Estándares', icon: ShieldCheck },
]

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          isActive
            ? 'bg-white/12 text-white shadow-sm'
            : 'text-steel-400 hover:bg-white/6 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              isActive ? 'bg-white/15 text-white' : 'text-steel-500 group-hover:text-steel-300'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="border-b border-white/8 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/12">
            <Cpu className="h-5 w-5 text-steel-200" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">Hiring Intelligence</p>
            <p className="truncate text-xs text-steel-500">Lubtrac · Reclutamiento</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scroll-thin px-3 py-4">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 px-5 py-4">
        <p className="text-[11px] text-steel-600">v1.0 · Golabs</p>
      </div>
    </div>
  )
}

export default function Sidebar({ mobileOpen, onClose }) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col border-r border-white/6 bg-linear-to-b from-steel-950 via-steel-900 to-steel-900">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(27,39,55,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={onClose}
        >
          <div
            className="h-full w-72 max-w-[85vw] bg-linear-to-b from-steel-950 via-steel-900 to-steel-900"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent onNavigate={onClose} />
          </div>
        </div>
      )}
    </>
  )
}
