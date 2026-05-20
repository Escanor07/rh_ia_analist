import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchVacancyDetail } from '../../lib/api'
import PageLoader from '../../components/common/PageLoader'
import {
  ArrowLeft, Briefcase, Users, Clock, FileText,
  Play, Calendar, TrendingUp, UserCheck, UserX,
} from 'lucide-react'
import FunnelChart from './components/FunnelChart'
import CandidatesByStage from './components/CandidatesByStage'
import SecondaryPanel from './components/SecondaryPanel'
import StatCard from './components/StatCard'

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
  if (!data?.vacancy) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-steel-400">Vacante no encontrada</p>
      </div>
    )
  }

  const { vacancy: v, candidates: c, characteristics: chars, history: hist, matching_runs: runs, candidate_pipeline: pipeline } = data
  const conversion = pipeline?.conversion
  const hasFunnel  = Boolean(conversion?.length)
  const hasReq     = chars.length > 0
  const hasHist    = hist.length > 0

  const funnelMeta = hasFunnel
    ? {
        first: conversion[0],
        last:  conversion[conversion.length - 1],
        retention: conversion[0].count > 0
          ? Math.round((conversion[conversion.length - 1].count / conversion[0].count) * 1000) / 10
          : 0,
      }
    : null

  const topRun = runs[0]

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin">
      <div className="w-full max-w-[1320px] 2xl:max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3 sm:gap-4">
            <button type="button" onClick={() => nav('/')}
              className="mt-1 p-1.5 rounded-lg hover:bg-steel-100 text-steel-400 transition-colors shrink-0">
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
                {v.fecha_solicitud && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Solicitud: {v.fecha_solicitud}
                  </span>
                )}
                {v.dias_sol_aut != null && <span>Sol→Aut: <strong className="text-steel-600">{v.dias_sol_aut}d</strong></span>}
                {v.dias_aut_rh  != null && <span>Aut→RH: <strong className="text-steel-600">{v.dias_aut_rh}d</strong></span>}
              </div>
            </div>
            <button type="button" onClick={() => nav('/matching')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-steel-800 hover:bg-steel-900 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shrink-0">
              <Play className="w-4 h-4" /> Ir a Matching
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users}     label="Candidatos"    value={c.total} />
          <StatCard icon={UserX}     label="Descartados"   value={c.descartados_count ?? 0} variant="warn" />
          <StatCard icon={Briefcase} label="Matching Runs" value={runs.length} />
          <StatCard icon={UserCheck} label="Top Score"     value={topRun ? `${topRun.top_score}%` : '—'} variant="accent" />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-steel-400">Pipeline de candidatos</p>
              <p className="text-xs text-steel-500 mt-0.5">
                {hasFunnel ? 'Avance por etapa y listado actual' : 'Listado actual por etapa'}
              </p>
            </div>
            {funnelMeta && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-steel-600">
                <span>Entrada <strong className="text-steel-800">{funnelMeta.first.count}</strong></span>
                <span className="text-steel-300">·</span>
                <span>Salida <strong className="text-steel-800">{funnelMeta.last.count}</strong></span>
                <span className="text-steel-400">({funnelMeta.retention}% ret.)</span>
              </div>
            )}
          </div>

          <div className={hasFunnel
            ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)] lg:divide-x divide-slate-100'
            : 'grid grid-cols-1'
          }>
            {hasFunnel && (
              <div className="p-4 sm:p-5 min-w-0 flex flex-col">
                <h3 className="text-sm font-semibold text-steel-800 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  Embudo (tasa de avance)
                </h3>
                <div className="w-full flex justify-center">
                  <FunnelChart conversion={conversion} />
                </div>
              </div>
            )}
            <div className={`p-4 sm:p-5 min-w-0 ${hasFunnel ? 'bg-slate-50/50' : ''}`}>
              <h3 className="text-sm font-semibold text-steel-800 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-steel-500 shrink-0" />
                Candidatos por etapa
              </h3>
              <CandidatesByStage byStatus={c.by_status} />
            </div>
          </div>
        </section>

        {(hasReq || hasHist) && (
          <div className={hasReq && hasHist ? 'flex flex-col xl:flex-row xl:items-start gap-5 xl:gap-8' : 'flex flex-col gap-5'}>
            {hasReq && (
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                  <h2 className="text-base font-bold text-steel-900 mb-1 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-steel-500 shrink-0" />
                    Requisitos de la vacante
                  </h2>
                  <p className="text-xs text-steel-500 mb-4">Criterios y características definidas para el perfil.</p>
                  <div className="space-y-3">
                    {chars.map((ch, i) => (
                      <div key={i} className="flex gap-3 sm:gap-4 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                        <span className="text-[10px] font-bold text-steel-400 uppercase tracking-wide w-20 sm:w-24 shrink-0 pt-0.5">{ch.tipo}</span>
                        <p className="text-sm text-steel-700 leading-relaxed">{ch.descripcion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {hasHist && (
              <div className={hasReq ? 'w-full xl:w-[min(100%,380px)] xl:shrink-0' : 'max-w-2xl'}>
                <SecondaryPanel icon={Clock} title="Historial reciente">
                  <ul className="space-y-2.5">
                    {hist.map((h, i) => (
                      <li key={i} className="text-xs text-steel-600 leading-snug">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
                          <span className="text-[10px] text-steel-400 tabular-nums shrink-0">{h.fecha || '—'}</span>
                          <span className="font-semibold text-steel-700">{h.accion}</span>
                        </div>
                        {h.descripcion && <p className="text-steel-500 mt-1">{h.descripcion}</p>}
                      </li>
                    ))}
                  </ul>
                </SecondaryPanel>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
