import { ChevronRight } from 'lucide-react'

export default function CandidatesByStage({ byStatus }) {
  const entries = Object.entries(byStatus ?? {})
  if (entries.length === 0) return <p className="text-sm text-steel-400">Sin candidatos registrados</p>
  return (
    <div className="space-y-4">
      {entries.map(([status, cands]) => (
        <div key={status} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-steel-700">{status}</span>
            <span className="text-[11px] font-medium text-steel-500 tabular-nums">{cands.length}</span>
          </div>
          <ul className="space-y-1">
            {cands.map(cand => (
              <li key={cand.id} className="flex items-start gap-2 text-xs text-steel-600">
                <ChevronRight className="w-3 h-3 text-steel-300 shrink-0 mt-0.5" />
                <span className="wrap-break-word min-w-0">{cand.nombre}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
