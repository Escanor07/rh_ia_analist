import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import PipelineStatusBar from './PipelineStatusBar'
import { usePipeline } from '../context/PipelineContext'

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { status } = usePipeline()
  const showBar = Boolean(status?.running || status?.task)

  return (
    <div className="flex h-full overflow-hidden bg-steel-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {showBar ? (
          <PipelineStatusBar onMenuClick={() => setMobileOpen(true)} />
        ) : (
          <div className="lg:hidden flex h-10 shrink-0 items-center border-b border-slate-200 bg-white px-4">
            <button type="button" onClick={() => setMobileOpen(true)}
              className="text-steel-400 hover:text-steel-700 p-1 rounded-md" aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto scroll-thin">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
