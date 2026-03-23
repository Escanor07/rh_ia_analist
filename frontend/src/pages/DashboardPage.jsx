import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDashboard } from '../lib/api'
import { usePipeline } from '../context/PipelineContext'
import PageLoader from '../components/PageLoader'
import MetricCard from '../components/MetricCard'
import {
  FileCheck, BarChart3, Users, Briefcase, Play, RefreshCw,
  ArrowRight, TrendingDown, TrendingUp, Timer, AlertTriangle, Clock, Settings, X
} from 'lucide-react'

const DC = {
  "Expectativa salarial": "bg-steel-500", "Otra oferta": "bg-steel-400",
  "Inconsistencia documental": "bg-steel-300", "Abandono": "bg-amber-400",
  "Perfil no apto": "bg-red-400", "Otro": "bg-slate-300",
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPl, setShowPl] = useState(false)
  const nav = useNavigate()
  const { status: plStatus, startIngest, startSync } = usePipeline()

  const load = useCallback(() => {
    setLoading(true)
    fetchDashboard().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (plStatus && !plStatus.running && plStatus.finished) load()
  }, [plStatus?.finished, plStatus?.running, load])

  const doIngest = async () => { try { await startIngest(load) } catch (e) { alert(e.message) } }
  const doSync = async () => { try { await startSync(load) } catch (e) { alert(e.message) } }

  const an = data?.analytics || {}
  const cf = an.candidate_funnel || {}
  const cs = cf.stages || []
  const dr = an.discard_reasons || {}
  const dropoffByCategory = dr.by_category

  const maxStageCount = useMemo(
    () => Math.max(1, ...cs.map((x) => x.count)),
    [cs],
  )
  const dropoffTotal = useMemo(() => {
    const m = dropoffByCategory || {}
    return Object.values(m).reduce((a, b) => a + b, 0)
  }, [dropoffByCategory])

  if (loading) return <PageLoader />

  const { pipeline: pip = {}, matching: mt = {} } = data || {}
  const { totals = {}, vacancy_funnel: vf = {}, vacancy_sla: sla = {} } = an
  const vs = vf.stages || []
  const plRunning = plStatus?.running

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin">
      <div className="w-full max-w-[1440px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-4 sm:py-6 2xl:py-8 space-y-4 sm:space-y-5 2xl:space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl 2xl:text-2xl font-bold text-steel-900">Dashboard</h2>
            <p className="text-xs sm:text-[13px] 2xl:text-sm text-steel-400">Métricas del proceso de reclutamiento y matching</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPl(!showPl)}
            className={`flex items-center gap-1.5 px-3 py-2 2xl:px-4 2xl:py-2.5 rounded-lg text-xs 2xl:text-sm font-semibold transition-all shrink-0 ${showPl ? 'bg-steel-700 text-white' : 'bg-white border border-slate-200 text-steel-600 hover:bg-steel-50 shadow-sm'}`}
          >
            <Settings className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
            <span className="hidden sm:inline">Pipeline</span>
          </button>
        </div>

        {/* Pipeline panel */}
        {showPl && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-md relative">
            <button onClick={() => setShowPl(false)} className="absolute top-3 right-3 2xl:top-4 2xl:right-4 text-steel-300 hover:text-steel-600"><X className="w-4 h-4" /></button>
            <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 2xl:mb-4">Operaciones del Pipeline</h3>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 2xl:gap-8 text-xs 2xl:text-sm text-steel-500 mb-4">
              <span>CVs: <strong className="text-steel-800">{pip.cvs_procesados}/{pip.cvs_total_source}</strong> ({pip.cvs_indexados_percent}%)</span>
              <span>Tiempo: <strong className="text-steel-800">{pip.tiempo_promedio_seconds}s</strong></span>
              <span>Calidad: <strong className="text-steel-800">{pip.quality?.good || 0}</strong> good · <strong>{pip.quality?.weak || 0}</strong> weak</span>
              <span>Vacantes: <strong className="text-steel-800">{pip.vacantes_sincronizadas || 0}</strong></span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 2xl:gap-3">
              <button onClick={doIngest} disabled={plRunning} className="flex items-center justify-center gap-1.5 px-4 py-2.5 2xl:px-5 2xl:py-3 bg-steel-600 hover:bg-steel-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm 2xl:text-base font-medium rounded-lg transition-colors">
                <Play className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />Indexar CVs Nuevos
              </button>
              <button onClick={doSync} disabled={plRunning} className="flex items-center justify-center gap-1.5 px-4 py-2.5 2xl:px-5 2xl:py-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-steel-700 text-sm 2xl:text-base font-medium rounded-lg transition-colors">
                <RefreshCw className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />Sincronizar Vacantes
              </button>
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 2xl:gap-6">
          <MetricCard icon={FileCheck} label="CVs Indexados" value={`${pip.cvs_indexados_percent || 0}%`} sub={`${pip.cvs_procesados || 0} de ${pip.cvs_total_source || 0}${pip.cvs_pendientes > 0 ? ` · ${pip.cvs_pendientes} pendientes` : ''}`} />
          <MetricCard icon={BarChart3} label="Comparaciones" value={mt.total_comparaciones || 0} sub="ejecuciones de matching" />
          <MetricCard icon={TrendingUp} label="Tasa de Conversión" value={`${totals.conversion_rate || 0}%`} sub={`${totals.contratados || 0} contratados de ${totals.candidatos || 0}`} variant="accent" />
          <MetricCard icon={TrendingDown} label="Tasa de Drop-Off" value={`${totals.drop_off_rate || 0}%`} sub={`${totals.descartados || 0} descartados`} variant="warn" />
        </div>

        {/* Main row: Matching + Funnel + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 2xl:gap-6">
          {/* Matching card */}
          <div className="xl:col-span-3 bg-linear-to-br from-steel-700 to-steel-900 rounded-xl p-4 sm:p-5 2xl:p-6 text-white cursor-pointer hover:from-steel-600 transition-all shadow-lg 2xl:shadow-xl" onClick={() => nav('/matching')}>
            <div className="flex items-center justify-between mb-3 2xl:mb-4">
              <h3 className="text-sm 2xl:text-base font-bold">Top Candidatos Sugeridos</h3>
              <ArrowRight className="w-4 h-4 text-steel-300" />
            </div>
            {mt.recent?.length > 0 ? mt.recent.slice(0, 3).map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-t border-white/10">
                <span className="text-lg font-bold text-steel-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm 2xl:text-[15px] font-medium truncate">{m.vacancy_name}</p>
                  <p className="text-[11px] 2xl:text-xs text-steel-300">{m.candidates_evaluated} candidatos</p>
                </div>
                <span className="text-lg 2xl:text-xl font-bold bg-white/15 px-2.5 py-0.5 2xl:px-3 2xl:py-1 rounded-lg">{m.top_score}</span>
              </div>
            )) : <p className="text-sm text-steel-300 py-4">Sin ejecuciones aún</p>}
            <div className="mt-3 pt-3 border-t border-white/10 text-center">
              <span className="text-xs font-semibold text-steel-200">Ir a Matching →</span>
            </div>
          </div>

          {/* Candidate funnel */}
          <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4 2xl:mb-5">
              <h3 className="text-sm 2xl:text-base font-bold text-steel-800 flex items-center gap-2"><Users className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Embudo de Candidatos</h3>
              <span className="text-xs 2xl:text-sm text-steel-400">{totals.candidatos || 0} total</span>
            </div>
            <div className="space-y-1.5 2xl:space-y-2">
              {cs.map((s, i) => {
                const w = Math.max((s.count / maxStageCount) * 100, 5)
                return (
                  <div key={s.status_id} className="flex items-center gap-1.5 sm:gap-2 2xl:gap-3">
                    <span className="text-[10px] sm:text-[11px] 2xl:text-xs text-steel-500 w-24 sm:w-32 2xl:w-40 text-right shrink-0 truncate">{s.label}</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-6 sm:h-7 2xl:h-8 rounded-md flex items-center justify-end px-2 2xl:px-3 transition-all duration-700"
                        style={{ width: `${w}%`, background: `linear-gradient(90deg, rgba(59,95,145,${0.9 - i * 0.08}), rgba(59,95,145,${0.7 - i * 0.06}))` }}>
                        <span className="text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-white">{s.count}</span>
                      </div>
                    </div>
                    <span className="text-[10px] 2xl:text-xs text-steel-400 w-9 2xl:w-11 text-right tabular-nums">{s.pct_of_total}%</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 2xl:gap-6 mt-3 pt-3 2xl:mt-4 2xl:pt-4 border-t border-slate-100 text-[11px] 2xl:text-xs text-steel-400">
              <span>Descartados: <strong className="text-red-500">{cf.descartados || 0}</strong></span>
              <span>Propuestas: <strong className="text-steel-600">{cf.propuestas || 0}</strong></span>
            </div>
          </div>

          {/* Right sidebar: Drop-off + Vacancy counts */}
          <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-5 2xl:gap-6">
            {/* Drop-off */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
              <h3 className="text-sm 2xl:text-base font-bold text-steel-800 flex items-center gap-2 mb-3 2xl:mb-4"><AlertTriangle className="w-4 h-4 2xl:w-5 2xl:h-5 text-red-400" />Drop-off por Razón</h3>
              {Object.entries(dropoffByCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, n]) => {
                const pct = dropoffTotal > 0 ? Math.round((n / dropoffTotal) * 100) : 0
                return (
                  <div key={cat} className="flex items-center gap-2 2xl:gap-3 mb-2 2xl:mb-2.5">
                    <span className="text-[11px] 2xl:text-xs text-steel-600 w-28 sm:w-32 2xl:w-36 truncate shrink-0">{cat}</span>
                    <div className="flex-1 h-4 sm:h-5 2xl:h-6 bg-slate-100 rounded overflow-hidden"><div className={`h-full rounded ${DC[cat] || 'bg-slate-300'}`} style={{ width: `${pct}%` }} /></div>
                    <span className="text-[11px] 2xl:text-xs font-bold text-steel-700 w-8 2xl:w-10 text-right shrink-0 tabular-nums">{pct}%</span>
                  </div>
                )
              })}
            </div>
            {/* Vacancy stages */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
              <h3 className="text-sm 2xl:text-base font-bold text-steel-800 flex items-center gap-2 mb-3 2xl:mb-4"><Briefcase className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Vacantes por Etapa</h3>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 2xl:gap-3">
                {vs.filter(s => s.count > 0).slice(0, 6).map(s => (
                  <div key={s.status_id} className="text-center py-2 px-1 2xl:py-2.5 2xl:px-2 bg-steel-50 rounded-lg">
                    <p className="text-base sm:text-lg 2xl:text-xl font-bold text-steel-800 tabular-nums">{s.count}</p>
                    <p className="text-[9px] sm:text-[10px] 2xl:text-[11px] text-steel-400 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SLA + Active Vacancies */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 2xl:gap-6">
          <div className="xl:col-span-5">
            <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 2xl:mb-4 flex items-center gap-2"><Timer className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Tiempo Promedio por Etapa</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 2xl:gap-4">
              {[{ l: "Solicitud → Autorización", d: sla.solicitud_autorizacion }, { l: "Autorización → RH", d: sla.autorizacion_rh }, { l: "Proceso Total", d: sla.total_proceso }].map(({ l, d }) => (
                <div key={l} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 2xl:p-5 shadow-sm text-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 2xl:w-12 2xl:h-12 rounded-full bg-steel-50 flex items-center justify-center mx-auto mb-1.5 sm:mb-2 2xl:mb-3"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 2xl:w-5 2xl:h-5 text-steel-500" /></div>
                  <p className="text-[9px] sm:text-[10px] 2xl:text-[11px] font-semibold text-steel-400 uppercase leading-tight">{l}</p>
                  <p className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-steel-900 mt-1 tabular-nums">{d?.promedio || 0}<span className="text-xs sm:text-sm 2xl:text-base font-normal text-steel-400 ml-0.5">d</span></p>
                  <p className="text-[9px] sm:text-[10px] 2xl:text-xs text-steel-300 mt-0.5">{d?.medidos || 0} vacantes</p>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-7">
            {(an.active_vacancies || []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 2xl:px-6 py-3 2xl:py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm 2xl:text-base font-bold text-steel-800">Vacantes Activas</h3>
                  <span className="text-[11px] 2xl:text-xs text-steel-400">{(an.active_vacancies || []).length} activas</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-[12px] 2xl:text-sm">
                    <thead><tr className="bg-steel-50/50 text-left">
                      <th className="px-3 sm:px-4 2xl:px-5 py-2 2xl:py-2.5 font-semibold text-steel-500">Perfil</th>
                      <th className="px-3 sm:px-4 2xl:px-5 py-2 2xl:py-2.5 font-semibold text-steel-500 text-center">Estado</th>
                      <th className="px-3 sm:px-4 2xl:px-5 py-2 2xl:py-2.5 font-semibold text-steel-500 text-center">Candidatos</th>
                      <th className="px-3 sm:px-4 2xl:px-5 py-2 2xl:py-2.5 font-semibold text-steel-500 text-center hidden sm:table-cell">Descartados</th>
                    </tr></thead>
                    <tbody>{(an.active_vacancies || []).map((v, i) => (
                      <tr key={v.vacante_id} className={`cursor-pointer hover:bg-steel-50 transition-colors ${i % 2 ? 'bg-steel-50/30' : ''}`}
                        onClick={() => nav(`/vacancy/${v.vacante_id}`)}>
                        <td className="px-3 sm:px-4 2xl:px-5 py-2.5 2xl:py-3 font-medium text-steel-800 max-w-[120px] sm:max-w-[180px] 2xl:max-w-[280px] truncate">{v.perfil || '—'}</td>
                        <td className="px-3 sm:px-4 2xl:px-5 py-2.5 2xl:py-3 text-center"><span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] 2xl:text-xs font-semibold bg-steel-100 text-steel-600">{v.status}</span></td>
                        <td className="px-3 sm:px-4 2xl:px-5 py-2.5 2xl:py-3 text-center font-semibold text-steel-700 tabular-nums">{v.candidatos}</td>
                        <td className="px-3 sm:px-4 2xl:px-5 py-2.5 2xl:py-3 text-center text-red-400 font-medium hidden sm:table-cell tabular-nums">{v.descartados || 0}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
