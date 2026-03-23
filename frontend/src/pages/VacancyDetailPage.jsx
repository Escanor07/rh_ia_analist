import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchVacancyDetail } from '../lib/api'
import PageLoader from '../components/PageLoader'
import MetricCard from '../components/MetricCard'
import {
  ArrowLeft, Briefcase, Users, Clock, FileText,
  ChevronRight, Play, Calendar
} from 'lucide-react'

export default function VacancyDetailPage() {
  const { sourceId } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchVacancyDetail(sourceId).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return <PageLoader />
  if (!data?.vacancy) return <div className="flex items-center justify-center h-full"><p className="text-steel-400">Vacante no encontrada</p></div>

  const { vacancy: v, candidates: c, characteristics: chars, history: hist, matching_runs: runs } = data

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin">
      <div className="w-full max-w-[1200px] xl:max-w-[1320px] 2xl:max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-4 sm:py-6 2xl:py-8 space-y-4 sm:space-y-5 2xl:space-y-6">

        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4 2xl:gap-6">
          <button type="button" onClick={() => nav('/')} className="mt-0.5 p-1.5 sm:p-2 2xl:p-2.5 rounded-lg hover:bg-steel-100 text-steel-400 transition-colors shrink-0" aria-label="Volver al dashboard">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 2xl:gap-4 flex-wrap">
              <h1 className="text-lg sm:text-xl 2xl:text-2xl font-bold text-steel-900 tracking-tight truncate">{v.perfil || `Vacante #${sourceId}`}</h1>
              <span className="px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded-full text-[10px] sm:text-xs 2xl:text-sm font-semibold bg-steel-100 text-steel-600">{v.status}</span>
              <span className="text-xs 2xl:text-sm text-steel-400 bg-steel-50 px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded">{v.tipo}</span>
            </div>
            {v.objetivo && <p className="text-xs sm:text-sm 2xl:text-base text-steel-500 mt-1 2xl:mt-2 line-clamp-2 max-w-4xl">{v.objetivo}</p>}
            <div className="flex flex-wrap gap-3 sm:gap-4 2xl:gap-6 mt-2 2xl:mt-3 text-[11px] sm:text-xs 2xl:text-sm text-steel-400">
              {v.fecha_solicitud && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Solicitud: {v.fecha_solicitud}</span>}
              {v.dias_sol_aut != null && <span>Sol→Aut: {v.dias_sol_aut}d</span>}
              {v.dias_aut_rh != null && <span>Aut→RH: {v.dias_aut_rh}d</span>}
            </div>
          </div>
          <button type="button" onClick={() => nav('/matching')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 2xl:px-5 2xl:py-2.5 bg-steel-600 hover:bg-steel-700 text-white text-sm 2xl:text-base font-semibold rounded-lg transition-colors shadow-sm shrink-0">
            <Play className="w-4 h-4 2xl:w-5 2xl:h-5" />Ir a Matching
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 2xl:gap-6">
          <MetricCard size="compact" label="Candidatos" value={c.total} icon={Users} />
          <MetricCard size="compact" label="Descartados" value={c.descartados_count ?? 0} icon={Users} variant="warn" />
          <MetricCard size="compact" label="Matching Runs" value={runs.length} icon={Briefcase} />
          <MetricCard size="compact" label="Top Score" value={runs.length > 0 ? `${runs[0].top_score}%` : '—'} icon={FileText} variant="accent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 2xl:gap-6">
          {/* Candidates by status */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
            <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 sm:mb-4 2xl:mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Candidatos por Etapa
            </h3>
            {Object.entries(c.by_status).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(c.by_status).map(([status, cands]) => (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-steel-600">{status}</span>
                      <span className="text-xs font-bold text-steel-800">{cands.length}</span>
                    </div>
                    <div className="space-y-1">
                      {cands.slice(0, 5).map(cand => (
                        <div key={cand.id} className="flex items-center gap-2 text-xs text-steel-500 pl-2">
                          <ChevronRight className="w-3 h-3 text-steel-300 shrink-0" />
                          <span className="truncate">{cand.nombre}</span>
                        </div>
                      ))}
                      {cands.length > 5 && <p className="text-[10px] text-steel-400 pl-5">+{cands.length - 5} más</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-steel-400">Sin candidatos registrados</p>}
          </div>

          {/* Requirements + History */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5 2xl:space-y-6">
            {chars.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
                <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 2xl:mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Requisitos de la Vacante
                </h3>
                <div className="space-y-2">
                  {chars.map((ch, i) => (
                    <div key={i} className="flex gap-2 sm:gap-3">
                      <span className="text-[9px] sm:text-[10px] font-semibold text-steel-400 uppercase w-16 sm:w-24 shrink-0 pt-0.5">{ch.tipo}</span>
                      <p className="text-xs sm:text-sm 2xl:text-[15px] text-steel-600 leading-relaxed">{ch.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hist.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
                <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 2xl:mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Historial Reciente
                </h3>
                <div className="space-y-2 2xl:space-y-2.5 overflow-x-auto">
                  {hist.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 sm:gap-3 2xl:gap-4 text-[11px] sm:text-xs 2xl:text-sm min-w-0">
                      <span className="text-steel-400 w-24 sm:w-28 shrink-0">{h.fecha || ''}</span>
                      <span className="font-semibold text-steel-600 w-24 sm:w-32 shrink-0">{h.accion}</span>
                      <span className="text-steel-500 truncate min-w-0">{h.descripcion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runs.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
                <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 2xl:mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Ejecuciones de Matching
                </h3>
                <div className="space-y-2 2xl:space-y-2.5">
                  {runs.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-[11px] sm:text-xs 2xl:text-sm text-steel-600 py-1.5 2xl:py-2 border-b border-slate-100 last:border-0 gap-2 2xl:gap-3">
                      <span className="shrink-0">{r.executed_at?.slice(0, 16).replace('T', ' ')}</span>
                      <span className="hidden sm:inline">{r.candidates_evaluated} candidatos</span>
                      <span className="font-bold text-steel-800">Top: {r.top_score}%</span>
                      <span className="text-steel-400">{r.processing_time_seconds}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
