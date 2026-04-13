import { Menu, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { usePipeline } from '../context/PipelineContext'

const TASK_LABEL = {
  ingest: 'Indexando CVs',
  sync_vacancies: 'Sincronizando vacantes',
}

export default function PipelineStatusBar({ onMenuClick }) {
  const { status, progress } = usePipeline()
  const running = status?.running

  return (
    <div
      className={`flex h-10 shrink-0 items-center gap-3 border-b px-4 transition-colors ${
        running
          ? 'border-blue-200 bg-blue-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden text-steel-400 hover:text-steel-700 p-1 rounded-md"
        aria-label="Abrir menú"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        {running ? (
          <>
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />
            <span className="text-xs font-medium text-blue-700 truncate">
              {TASK_LABEL[status?.task] || 'Procesando'}
              {progress >= 0 && ` — ${progress}%`}
            </span>
            {progress >= 0 && (
              <div className="hidden sm:flex flex-1 max-w-32 h-1 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </>
        ) : status?.task ? (
          <>
            {status.failed > 0 ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            )}
            <span className="text-xs text-steel-500 truncate">
              {TASK_LABEL[status.task] || 'Proceso'} completado
              {status.processed > 0 && ` · ${status.processed} procesados`}
              {status.failed > 0 && ` · ${status.failed} errores`}
            </span>
          </>
        ) : (
          <span className="text-xs text-steel-400">Sistema listo</span>
        )}
      </div>
    </div>
  )
}
