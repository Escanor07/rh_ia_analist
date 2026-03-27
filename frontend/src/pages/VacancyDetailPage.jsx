import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchVacancyDetail } from '../lib/api'
import PageLoader from '../components/PageLoader'
import {
  ArrowLeft, Briefcase, Users, Clock, FileText,
  ChevronRight, Play, Calendar, TrendingUp, UserCheck, UserX
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

  const { vacancy: v, candidates: c, characteristics: chars, history: hist, matching_runs: runs, candidate_pipeline: pipeline } = data

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin">
      <div className="w-full max-w-[1320px] 2xl:max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3 sm:gap-4">
            <button type="button" onClick={() => nav('/')} className="mt-1 p-1.5 rounded-lg hover:bg-steel-100 text-steel-400 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-steel-900 truncate">{v.perfil || `Vacante #${sourceId}`}</h1>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-steel-100 text-steel-600">{v.status}</span>
                <span className="text-xs text-steel-400">{v.tipo}</span>
              </div>
              {v.objetivo && <p className="text-xs sm:text-sm text-steel-500 mt-1.5 line-clamp-2">{v.objetivo}</p>}
              <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-steel-400">
                {v.fecha_solicitud && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Solicitud: {v.fecha_solicitud}</span>}
                {v.dias_sol_aut != null && <span>Sol→Aut: <strong className="text-steel-600">{v.dias_sol_aut}d</strong></span>}
                {v.dias_aut_rh != null && <span>Aut→RH: <strong className="text-steel-600">{v.dias_aut_rh}d</strong></span>}
              </div>
            </div>
            <button type="button" onClick={() => nav('/matching')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-steel-600 hover:bg-steel-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shrink-0">
              <Play className="w-4 h-4" />Ir a Matching
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Users} label="Candidatos" value={c.total} />
          <StatCard icon={UserX} label="Descartados" value={c.descartados_count ?? 0} variant="warn" />
          <StatCard icon={Briefcase} label="Matching Runs" value={runs.length} />
          <StatCard icon={UserCheck} label="Top Score" value={runs.length > 0 ? `${runs[0].top_score}%` : '—'} variant="accent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          <div className="lg:col-span-12">
            {pipeline?.conversion?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-steel-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />Embudo de Candidatos (Tasa de Avance)
                </h3>
                <div className="flex flex-col items-center gap-[2px] py-1">
                  {pipeline.conversion.map((s, i) => {
                    const max = pipeline.conversion[0]?.count || 1
                    const widthPct = Math.max(20, Math.round((s.count / max) * 100))
                    return (
                      <div key={i} style={{ width: `${widthPct}%` }}>
                        <div className="w-full py-2 text-center text-white font-semibold text-[10px] sm:text-[11px] rounded-[3px] truncate px-2"
                          style={{ background: `rgba(59, 95, 145, ${0.95 - i * 0.07})` }}>
                          {s.stage} — <span className="font-bold">{s.count}</span> <span className="text-white/60">({s.pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-bold text-steel-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-steel-500" />Candidatos por Etapa
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

          <div className="lg:col-span-7 space-y-4">
            {chars.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-steel-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-steel-500" />Requisitos de la Vacante
                </h3>
                <div className="space-y-2">
                  {chars.map((ch, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-[9px] sm:text-[10px] font-semibold text-steel-400 uppercase w-24 shrink-0 pt-0.5">{ch.tipo}</span>
                      <p className="text-xs sm:text-sm text-steel-600 leading-relaxed">{ch.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hist.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-steel-800 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-steel-500" />Historial Reciente
                </h3>
                <div className="space-y-2 overflow-x-auto">
                  {hist.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs min-w-0">
                      <span className="text-steel-400 w-28 shrink-0">{h.fecha || ''}</span>
                      <span className="font-semibold text-steel-600 w-32 shrink-0">{h.accion}</span>
                      <span className="text-steel-500 truncate min-w-0">{h.descripcion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runs.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-steel-800 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-steel-500" />Ejecuciones de Matching
                </h3>
                <div className="space-y-2">
                  {runs.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-steel-600 py-1.5 border-b border-slate-100 last:border-0 gap-3">
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


function StatCard({ icon: Icon, label, value, variant }) {
  const colors = {
    warn: 'text-red-500',
    accent: 'text-emerald-600',
  }
  const iconColors = {
    warn: 'text-red-400 bg-red-50',
    accent: 'text-emerald-500 bg-emerald-50',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-[11px] font-semibold text-steel-400 uppercase">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColors[variant] || 'text-steel-400 bg-steel-50'}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${colors[variant] || 'text-steel-900'}`}>{value}</p>
    </div>
  )
}
