import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDashboard } from '../lib/api'
import { usePipeline } from '../context/PipelineContext'
import PageLoader from '../components/PageLoader'
import MetricCard from '../components/MetricCard'
import {
  FileCheck, BarChart3, Users, Play, RefreshCw,
  ArrowRight, TrendingDown, TrendingUp, Timer, AlertTriangle, Clock, Settings, X, Search
} from 'lucide-react'

const DC = {
  "Expectativa salarial": "bg-steel-500", "Otra oferta": "bg-steel-400",
  "Inconsistencia documental": "bg-steel-300", "Abandono": "bg-amber-400",
  "Perfil no apto": "bg-red-400", "Otro": "bg-slate-300",
}

const PER_PAGE = 15

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPl, setShowPl] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
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

  if (loading) return <PageLoader />

  const { pipeline: pip = {}, matching: mt = {}, analytics: an = {} } = data || {}
  const { totals = {}, vacancy_sla: sla = {}, turnover = {}, candidate_sla: cSla = {} } = an
  const dr = an.discard_reasons || {}
  const dropoffByCategory = dr.by_category || {}
  const dropoffTotal = Object.values(dropoffByCategory).reduce((a, b) => a + b, 0)
  const funnel = an.candidate_funnel || {}
  const funnelStages = funnel.stages || []
  const plRunning = plStatus?.running

  const allVacs = an.all_vacancies || []
  const q = search.toLowerCase()
  const filtered = q ? allVacs.filter(v => (v.perfil || '').toLowerCase().includes(q) || (v.status || '').toLowerCase().includes(q) || String(v.vacante_id).includes(q)) : allVacs
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageVacs = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin">
      <div className="w-full max-w-[1440px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-4 sm:py-6 2xl:py-8 space-y-4 sm:space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl 2xl:text-2xl font-bold text-steel-900">Dashboard</h2>
            <p className="text-xs sm:text-[13px] text-steel-400">Métricas del proceso de reclutamiento y matching</p>
          </div>
          <button type="button" onClick={() => setShowPl(!showPl)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${showPl ? 'bg-steel-700 text-white' : 'bg-white border border-slate-200 text-steel-600 hover:bg-steel-50 shadow-sm'}`}>
            <Settings className="w-3.5 h-3.5" /><span className="hidden sm:inline">Pipeline</span>
          </button>
        </div>

        {showPl && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-md relative">
            <button onClick={() => setShowPl(false)} className="absolute top-3 right-3 text-steel-300 hover:text-steel-600"><X className="w-4 h-4" /></button>
            <h3 className="text-sm font-bold text-steel-800 mb-3">Operaciones del Pipeline</h3>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-steel-500 mb-4">
              <span>CVs: <strong className="text-steel-800">{pip.cvs_procesados}/{pip.cvs_total_source}</strong> ({pip.cvs_indexados_percent}%)</span>
              <span>Tiempo: <strong className="text-steel-800">{pip.tiempo_promedio_seconds}s</strong></span>
              <span>Vacantes: <strong className="text-steel-800">{pip.vacantes_sincronizadas || 0}</strong></span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={doIngest} disabled={plRunning} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-steel-600 hover:bg-steel-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-lg"><Play className="w-3.5 h-3.5" />Indexar CVs</button>
              <button onClick={doSync} disabled={plRunning} className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-steel-700 text-sm font-medium rounded-lg"><RefreshCw className="w-3.5 h-3.5" />Sincronizar Vacantes</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard icon={FileCheck} label="CVs Indexados" value={`${pip.cvs_indexados_percent || 0}%`} sub={`${pip.cvs_procesados || 0} de ${pip.cvs_total_source || 0}${pip.cvs_pendientes > 0 ? ` · ${pip.cvs_pendientes} pendientes` : ''}`} />
          <MetricCard icon={BarChart3} label="Comparaciones" value={mt.total_comparaciones || 0} sub="ejecuciones de matching" />
          <MetricCard icon={TrendingUp} label="Tasa de Conversión" value={`${totals.conversion_rate || 0}%`} sub={`${totals.contratados || 0} contratados de ${totals.candidatos || 0}`} variant="accent" />
          <MetricCard icon={TrendingDown} label="Tasa de Drop-Off" value={`${totals.drop_off_rate || 0}%`} sub={`${totals.descartados || 0} descartados`} variant="warn" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
          <div className="xl:col-span-3 bg-linear-to-br from-steel-700 to-steel-900 rounded-xl p-4 sm:p-5 text-white cursor-pointer hover:from-steel-600 transition-all shadow-lg" onClick={() => nav('/matching')}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Top Candidatos Sugeridos</h3>
              <ArrowRight className="w-4 h-4 text-steel-300" />
            </div>
            {mt.recent?.length > 0 ? mt.recent.slice(0, 3).map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-t border-white/10">
                <span className="text-lg font-bold text-steel-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.vacancy_name}</p>
                  <p className="text-[11px] text-steel-300">{m.candidates_evaluated} cand</p>
                </div>
                <span className="text-lg font-bold bg-white/15 px-2.5 py-0.5 rounded-lg">{m.top_score}</span>
              </div>
            )) : <p className="text-sm text-steel-300 py-4">Sin ejecuciones aún</p>}
            <div className="mt-3 pt-3 border-t border-white/10 text-center">
              <span className="text-xs font-semibold text-steel-200">Ir a Matching →</span>
            </div>
          </div>

          <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2"><Users className="w-4 h-4 text-steel-500" />Embudo de Contratación</h3>
              <span className="text-xs text-steel-400">{funnel.total || 0} candidatos</span>
            </div>
            {funnelStages.length > 0 ? (
              <FunnelChart stages={funnelStages} />
            ) : (
              <p className="text-sm text-steel-400 text-center py-8">Sin datos</p>
            )}
            <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 text-[11px] text-steel-400">
              <span>Conversión: <strong className="text-steel-700">{totals.conversion_rate || 0}%</strong></span>
              <span>Drop-offs: <strong className="text-red-500">{totals.descartados || 0}</strong></span>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-red-400" />Drop-off por Razón</h3>
              {Object.entries(dropoffByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, n]) => {
                const pct = dropoffTotal > 0 ? Math.round((n / dropoffTotal) * 100) : 0
                return (
                  <div key={cat} className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-steel-600 w-32 truncate shrink-0">{cat}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden"><div className={`h-full rounded ${DC[cat] || 'bg-slate-300'}`} style={{ width: `${pct}%` }} /></div>
                    <span className="text-[11px] font-bold text-steel-700 w-8 text-right tabular-nums">{pct}%</span>
                  </div>
                )
              })}
            </div>
            {(turnover.total || 0) > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-amber-500" />Rotación de Personal</h3>
                <div className="flex gap-2 mb-3">
                  {Object.entries(turnover.by_type || {}).map(([type, count]) => (
                    <div key={type} className="bg-steel-50 rounded-lg px-3 py-2 text-center flex-1">
                      <p className="text-lg font-bold text-steel-800 tabular-nums">{count}</p>
                      <p className="text-[9px] text-steel-400">{type}</p>
                    </div>
                  ))}
                </div>
                {(turnover.reasons || []).slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-steel-600 truncate flex-1">{r.reason}</span>
                    <span className="font-bold text-steel-700 ml-2 tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[3fr_7fr] gap-4 sm:gap-5 items-stretch">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex-1 min-h-0">
              <h3 className="text-sm font-bold text-steel-800 mb-2.5 flex items-center gap-2"><Timer className="w-4 h-4 text-emerald-500" />SLA de Candidatos</h3>
              {(cSla.stages || []).length > 0 ? (cSla.stages || []).slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-steel-500 flex-1 truncate">{s.transition}</span>
                  <span className="text-[10px] text-steel-300 shrink-0">n={s.count}</span>
                  <span className="text-base font-bold text-steel-900 tabular-nums w-14 text-right">{s.avg_days}<span className="text-[10px] font-normal text-steel-400 ml-0.5">d</span></span>
                </div>
              )) : <p className="text-xs text-steel-400">Sin datos</p>}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex-1 min-h-0">
              <h3 className="text-sm font-bold text-steel-800 mb-2.5 flex items-center gap-2"><Timer className="w-4 h-4 text-steel-500" />SLA de Vacantes</h3>
              {[{ l: "Solicitud → Autorización", d: sla.solicitud_autorizacion }, { l: "Autorización → RH", d: sla.autorizacion_rh }, { l: "Proceso Total", d: sla.total_proceso }].map(({ l, d }) => (
                <div key={l} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                  <Clock className="w-3.5 h-3.5 text-steel-300 shrink-0" />
                  <span className="text-xs text-steel-500 flex-1">{l}</span>
                  <span className="text-[10px] text-steel-300 shrink-0">{d?.medidos || 0} vacantes</span>
                  <span className="text-base font-bold text-steel-900 tabular-nums w-14 text-right">{d?.promedio || 0}<span className="text-[10px] font-normal text-steel-400 ml-0.5">d</span></span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-steel-800">Vacantes</h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-steel-400">{filtered.length} de {allVacs.length}</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel-300 pointer-events-none" />
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Buscar perfil, estado, ID..."
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-steel-300 w-48 sm:w-56" />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] sm:text-xs">
              <thead><tr className="bg-steel-50/50 text-left">
                <th className="px-4 py-2 font-semibold text-steel-500 w-14">ID</th>
                <th className="px-4 py-2 font-semibold text-steel-500">Perfil</th>
                <th className="px-4 py-2 font-semibold text-steel-500 text-center">Estado</th>
                <th className="px-4 py-2 font-semibold text-steel-500 text-center">Candidatos</th>
                <th className="px-4 py-2 font-semibold text-steel-500 text-center">Descartados</th>
                <th className="px-4 py-2 font-semibold text-steel-500 hidden sm:table-cell">Fecha</th>
              </tr></thead>
              <tbody>{pageVacs.map((v, i) => (
                <tr key={v.vacante_id} className={`cursor-pointer hover:bg-steel-50 transition-colors ${i % 2 ? 'bg-steel-50/30' : ''}`}
                  onClick={() => nav(`/vacancy/${v.vacante_id}`)}>
                  <td className="px-4 py-2.5 text-steel-400 tabular-nums text-xs">#{v.vacante_id}</td>
                  <td className="px-4 py-2.5 font-medium text-steel-800 max-w-[220px] truncate">{v.perfil || '—'}</td>
                  <td className="px-4 py-2.5 text-center"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-steel-100 text-steel-600">{v.status}</span></td>
                  <td className="px-4 py-2.5 text-center font-semibold text-steel-700 tabular-nums">{v.candidatos}</td>
                  <td className="px-4 py-2.5 text-center text-red-400 font-medium tabular-nums">{v.descartados || 0}</td>
                  <td className="px-4 py-2.5 text-steel-400 hidden sm:table-cell">{v.fecha || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-steel-400">
              <span>Mostrando {(page - 1) * PER_PAGE + 1}-{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length}</span>
              <div className="flex gap-1">
                {page > 1 && <button onClick={() => setPage(page - 1)} className="px-2 py-1 rounded hover:bg-steel-50 text-steel-600">← Ant</button>}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1
                  return <button key={p} onClick={() => setPage(p)} className={`px-2 py-1 rounded ${page === p ? 'bg-steel-600 text-white' : 'hover:bg-steel-50 text-steel-600'}`}>{p}</button>
                })}
                {totalPages > 5 && <span className="px-1">...</span>}
                {page < totalPages && <button onClick={() => setPage(page + 1)} className="px-2 py-1 rounded hover:bg-steel-50 text-steel-600">Sig →</button>}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}


function FunnelChart({ stages }) {
  if (!stages.length) return null
  const max = stages[0].count || 1
  return (
    <div className="flex flex-col items-center gap-[2px] py-2">
      {stages.map((s, i) => {
        const widthPct = Math.max(28, Math.round((s.count / max) * 100))
        return (
          <div key={i} className="flex flex-col items-center" style={{ width: `${widthPct}%` }}>
            <div
              className="w-full py-2 sm:py-2.5 text-center text-white font-semibold text-[10px] sm:text-[11px] rounded-[3px] truncate px-2"
              style={{ background: `rgba(59, 95, 145, ${0.95 - i * 0.07})` }}
            >
              {s.label} — <span className="font-bold">{s.count}</span> <span className="text-white/60">({s.pct}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
