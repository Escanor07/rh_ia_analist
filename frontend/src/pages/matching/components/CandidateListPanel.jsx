import { User } from 'lucide-react'
import ScoreBadge from './ScoreBadge'

export default function CandidateListPanel({ candidates = [], selectedId, onSelect }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-steel-400">
          Candidatos rankeados
        </p>
        <p className="mt-0.5 text-xs text-steel-500">
          {candidates.length} resultado{candidates.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {candidates.map((c, idx) => {
          const active    = c.document_id === selectedId
          const meta      = c.metadata || {}
          const cst       = c.candidate_status || {}
          const statusLbl = cst.status_label || ''
          return (
            <button
              key={c.document_id}
              type="button"
              onClick={() => onSelect(c)}
              className={`w-full border-b border-slate-100 last:border-0 px-4 py-3.5 text-left transition-colors ${
                active
                  ? 'bg-steel-50 border-l-[3px] border-l-steel-700'
                  : 'border-l-[3px] border-l-transparent hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    active ? 'bg-steel-100' : 'bg-slate-100'
                  }`}>
                    <User className="h-3.5 w-3.5 text-steel-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-steel-900">
                      <span className="mr-1.5 text-[10px] text-steel-400">#{idx + 1}</span>
                      {c.candidate_name || '—'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {c.applied_to_vacancy && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Aplicó
                        </span>
                      )}
                      {statusLbl && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-steel-600">
                          {statusLbl}
                        </span>
                      )}
                      {meta.experience_years != null && (
                        <span className="text-[10px] text-steel-400">{meta.experience_years}a exp.</span>
                      )}
                    </div>
                  </div>
                </div>
                <ScoreBadge score={c.score} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
