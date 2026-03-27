import { useState, useEffect, Fragment } from 'react'
import { fetchVacancies, fetchDefaultWeights, runMatching } from '../lib/api'
import { SECTION_CONFIG, SECTION_LABELS, scoreColor, scoreBar, normalizeWeights } from '../lib/matching'
import PageLoader from '../components/PageLoader'
import {
  Loader2, Play, Briefcase, ChevronDown, Clock, Users, Settings2,
  User, Mail, Award, FileText, ArrowLeft, Shield, GraduationCap, Wrench, Lock,
  Check, X,
} from 'lucide-react'

function nonEmptyLines(text) {
  return text.split('\n').filter(Boolean)
}

function AppliedBadge({ compact }) {
  return (
    <span
      className={
        compact
          ? 'mt-0.5 inline-block text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded'
          : 'text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full'
      }
    >
      Aplicó a esta vacante
    </span>
  )
}

export default function MatchingPage() {
  const [vacs, setVacs] = useState([])
  const [sel, setSel] = useState(null)
  const [res, setRes] = useState(null)
  const [cand, setCand] = useState(null)
  const [ld, setLd] = useState(false)
  const [init, setInit] = useState(true)
  const [topN, setTopN] = useState(10)
  const [rawWts, setRawWts] = useState(null)
  const [showW, setShowW] = useState(false)
  const [mobileView, setMobileView] = useState('list')

  useEffect(() => {
    Promise.all([fetchVacancies(), fetchDefaultWeights()])
      .then(([v, w]) => {
        setVacs(v.vacancies || [])
        const pcts = {}
        for (const [k, val] of Object.entries(w.weights || {})) pcts[k] = Math.round(val * 100)
        setRawWts(pcts)
      })
      .finally(() => setInit(false))
  }, [])

  const totalPct = rawWts ? Object.values(rawWts).reduce((a, b) => a + b, 0) : 100
  const normalizedForApi = rawWts ? normalizeWeights(rawWts) : null

  const go = async () => {
    if (!sel) return
    setLd(true)
    setRes(null)
    setCand(null)
    setMobileView('list')
    try {
      const d = await runMatching(sel, topN, normalizedForApi)
      setRes(d)
      if (d.matching.candidates.length > 0) setCand(d.matching.candidates[0])
    } catch (e) { console.error(e) }
    finally { setLd(false) }
  }

  if (init) return <PageLoader />

  const cands = res?.matching?.candidates || []
  const vac = res?.vacancy

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm">
        <div className="w-full max-w-[1440px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 2xl:py-4 space-y-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[440px]">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300 pointer-events-none" />
              <select
                value={sel || ''}
                onChange={e => setSel(e.target.value ? Number(e.target.value) : null)}
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-steel-400 outline-none appearance-none text-steel-800"
              >
                <option value="">Seleccionar vacante...</option>
                {vacs.map(v => (
                  <option key={v.source_id} value={v.source_id}>
                    #{v.source_id} — {v.profile_name} ({v.tipo_vacante})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300 pointer-events-none" />
            </div>
            <select
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none text-steel-700"
            >
              {[5, 10, 15, 20].map(n => (
                <option key={n} value={n}>Top {n}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowW(!showW)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showW ? 'border-steel-400 bg-steel-50 text-steel-700' : 'border-slate-200 text-steel-500 hover:bg-slate-50'}`}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Pesos</span>
            </button>
            <button
              type="button"
              onClick={go}
              disabled={!sel || ld}
              className="flex items-center gap-2 px-5 py-2 bg-steel-600 hover:bg-steel-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-lg transition-colors text-sm shadow-sm"
            >
              {ld ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span className="hidden sm:inline">{ld ? 'Procesando...' : 'Ejecutar'}</span>
            </button>
            {cands.length > 0 && (
              <div className="hidden md:flex items-center gap-4 ml-auto text-xs text-steel-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {cands.length}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {res.matching.processing_time_seconds}s
                </span>
              </div>
            )}
          </div>
          {showW && rawWts && (
            <div className="bg-steel-50 rounded-lg p-3 sm:p-4 border border-steel-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-steel-500 uppercase">Pesos por sección</p>
                <span className={`text-xs font-bold ${totalPct === 100 ? 'text-emerald-600' : 'text-amber-500'}`}>
                  Total: {totalPct}%
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-x-8 gap-y-0">
                {Object.entries(rawWts).map(([k, v]) => {
                  const sectionLabel = SECTION_CONFIG[k]?.l || k
                  return (
                    <label
                      key={k}
                      title={sectionLabel}
                      className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-slate-100 cursor-text"
                    >
                      <span className="text-sm text-steel-600 truncate min-w-0">{sectionLabel}</span>
                      <span className="flex items-baseline gap-0.5 shrink-0 tabular-nums">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={50}
                          step={1}
                          value={v}
                          onChange={e => {
                            const t = e.target.value
                            if (t === '') {
                              setRawWts(prev => ({ ...prev, [k]: 0 }))
                              return
                            }
                            const n = Number(t)
                            if (Number.isFinite(n)) {
                              const x = Math.round(n)
                              setRawWts(prev => ({ ...prev, [k]: Math.max(0, Math.min(50, x)) }))
                            }
                          }}
                          onBlur={e => {
                            const t = e.target.value.trim()
                            if (t === '') {
                              setRawWts(prev => ({ ...prev, [k]: 0 }))
                              return
                            }
                            const n = Number(t)
                            if (Number.isFinite(n)) {
                              const x = Math.round(n)
                              setRawWts(prev => ({ ...prev, [k]: Math.max(0, Math.min(50, x)) }))
                            }
                          }}
                          className="w-10 bg-transparent text-right text-sm font-medium text-steel-900 [appearance:textfield] outline-none border-0 border-b border-transparent pb-px hover:border-slate-200 focus:border-steel-500 focus:ring-0 transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          aria-label={`${sectionLabel}, porcentaje`}
                        />
                        <span className="text-sm text-steel-400 font-medium" aria-hidden>
                          %
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {cands.length > 0 ? (
          <>
            <div className={`${mobileView !== 'list' ? 'hidden lg:block' : ''} w-full lg:w-[280px] xl:w-[310px] 2xl:w-[360px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto scroll-thin`}>
              <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-steel-50/50">
                <p className="text-[11px] font-semibold text-steel-400 uppercase tracking-wider">Candidatos Rankeados</p>
              </div>
              {cands.map(c => {
                const m = c.metadata || {}
                return (
                  <button key={c.document_id} type="button" onClick={() => {
                      setCand(c)
                      setMobileView('detail')
                    }}
                    className={`w-full text-left px-3 sm:px-4 py-3 border-b border-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer ${cand?.document_id === c.document_id ? 'bg-steel-50 border-l-[3px] border-l-steel-600' : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'}`}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-steel-100 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-steel-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-steel-900 truncate block">{c.candidate_name}</span>
                      <CandidateMetaChips m={m} />
                      {c.applied_to_vacancy && <AppliedBadge compact />}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-sm font-bold text-white tabular-nums ${scoreBar(c.score)}`}>{c.score}</span>
                  </button>
                )
              })}
            </div>

            <div className={`${mobileView === 'list' ? 'hidden lg:block' : ''} flex-1 min-w-0 overflow-y-auto scroll-thin bg-[#f0f3f8]`}>
              {mobileView === 'detail' && (
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden flex items-center gap-2 px-4 py-3 text-sm text-steel-600 hover:bg-white/50 border-b border-slate-200 w-full"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
              )}
              {cand ? <Detail c={cand} /> : <Empty t="Selecciona un candidato" s="Haz clic en la lista" />}
            </div>

            <div className="hidden xl:block w-[300px] 2xl:w-[360px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto scroll-thin">
              <VacancyContext vac={vac} cand={cand} />
            </div>
          </>
        ) : (
          <div className="flex-1">
            {ld ? <PageLoader label="Ejecutando matching..." /> : <Empty t="Matching Inteligente" s="Selecciona una vacante y ejecuta el matching" />}
          </div>
        )}
      </div>
    </div>
  )
}

function CandidateMetaChips({ m }) {
  const chips = []
  if (m.experience_years != null) {
    chips.push(
      <span className="inline-flex items-center gap-0.5">
        <Briefcase className="w-3 h-3 shrink-0 text-steel-400" aria-hidden />
        {m.experience_years}a
      </span>,
    )
  }
  if (m.education_level && m.education_level !== '—') {
    chips.push(
      <span className="inline-flex items-center gap-0.5 min-w-0 max-w-full">
        <GraduationCap className="w-3 h-3 shrink-0 text-steel-400" aria-hidden />
        <span className="truncate">{m.education_level}</span>
      </span>,
    )
  }
  if (!chips.length) return null
  const keyList = []
  if (m.experience_years != null) keyList.push('exp')
  if (m.education_level && m.education_level !== '—') keyList.push('edu')
  return (
    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 text-[10px] text-steel-400">
      {chips.map((node, i) => (
        <Fragment key={keyList[i]}>
          {i > 0 && <span className="text-steel-300 select-none" aria-hidden>·</span>}
          {node}
        </Fragment>
      ))}
    </div>
  )
}

function Detail({ c }) {
  const m = c.metadata || {}

  return (
    <div className="p-4 sm:p-6 2xl:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-steel-100 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 sm:w-7 sm:h-7 text-steel-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-steel-900 truncate">{c.candidate_name}</h2>
              <span className={`px-3 py-1 rounded-lg text-lg font-bold text-white tabular-nums ${scoreBar(c.score)}`}>{c.score}</span>
              {c.applied_to_vacancy && <AppliedBadge />}
            </div>
            {c.candidate_email && (
              <p className="flex items-center gap-1.5 text-xs sm:text-sm text-steel-400 mt-1 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {c.candidate_email}
              </p>
            )}
            {c.candidate_status?.status_label && <p className="text-[11px] text-steel-400 mt-1">{c.candidate_status.status_label}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100">
          <MetaCard icon={Briefcase} label="Experiencia" value={m.experience_years != null ? `${m.experience_years} años` : '—'} />
          <MetaCard icon={GraduationCap} label="Educación" value={m.education_level || '—'} />
          <MetaCard icon={Wrench} label="Habilidades" value={m.skills_count > 0 ? `${m.skills_count} técnicas` : '—'} />
          <MetaCard
            icon={Lock}
            label="Estabilidad"
            value={m.stability_level || '—'}
            sub={m.stability_months > 0 ? `~${m.stability_months}m/puesto` : ''}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-bold text-steel-800 mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-steel-500" />
          Afinidad por Sección
        </h3>
        <div className="space-y-2">
          {(c.section_scores || []).filter(s => s.in_vacancy).map(ss => {
            const cfg = SECTION_CONFIG[ss.section_type] || SECTION_CONFIG.general
            const I = cfg.icon
            return (
              <div key={ss.section_type} className={`flex items-center gap-2 sm:gap-3 ${!ss.matched ? 'opacity-40' : ''}`}>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <I className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${cfg.c}`} />
                </div>
                <span className="text-xs sm:text-sm text-steel-700 w-24 shrink-0 truncate">{ss.label}</span>
                <div className="flex-1 h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  {ss.matched && <div className={`h-full rounded-full transition-all duration-700 ${scoreBar(ss.score_100)}`} style={{ width: `${ss.score_100}%` }} />}
                </div>
                {ss.matched ? (
                  <span className={`font-mono font-bold text-xs sm:text-sm w-12 text-right ${scoreColor(ss.score_100)}`}>{ss.score_100}%</span>
                ) : (
                  <span className="text-[10px] text-steel-300 w-12 text-right italic">—</span>
                )}
              </div>
            )
          })}
          <div className="flex items-center gap-2 sm:gap-3 pt-2 border-t border-slate-100">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-steel-50 flex items-center justify-center shrink-0">
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-steel-500" />
            </div>
            <span className="text-xs sm:text-sm text-steel-700 w-24 shrink-0">Perfil General</span>
            <div className="flex-1 h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreBar(c.full_profile_score)}`} style={{ width: `${c.full_profile_score}%` }} />
            </div>
            <span className={`font-mono font-bold text-xs sm:text-sm w-12 text-right ${scoreColor(c.full_profile_score)}`}>{c.full_profile_score}%</span>
          </div>
        </div>

        {c.standards_evaluation?.results?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-steel-400 uppercase mb-2 flex items-center gap-1.5 flex-wrap">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              Estándares Globales
              {!c.standards_evaluation.all_filters_passed && (
                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">No pasa filtros</span>
              )}
            </p>
            <div className="space-y-1.5">
              {c.standards_evaluation.results.map((s, i) => (
                <div key={`${s.name}-${i}`} className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs text-steel-600 flex-1 truncate">{s.name}</span>
                  {s.mode === 'filter' ? (
                    s.passed ? (
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} aria-label="Cumple" />
                    ) : (
                      <X className="w-3.5 h-3.5 shrink-0 text-red-500" strokeWidth={2.5} aria-label="No cumple" />
                    )
                  ) : (
                    <span className={`text-xs font-bold tabular-nums ${scoreColor(s.score_100)}`}>{s.score_100}</span>
                  )}
                  <span className="text-[10px] text-steel-400 truncate max-w-[100px]">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {Object.entries(c.chunks_summary || {}).map(([type, content]) => {
        const cfg = SECTION_CONFIG[type] || SECTION_CONFIG.general
        const I = cfg.icon
        if (!content?.trim()) return null
        const isTag = type === 'skills' || type === 'languages'
        const items = isTag ? content.split(/[,•\n]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 60) : null
        return (
          <div key={type} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
            <h4 className="text-sm font-bold text-steel-800 mb-2 sm:mb-3 flex items-center gap-2">
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md ${cfg.bg} flex items-center justify-center`}>
                <I className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${cfg.c}`} />
              </div>
              {cfg.l}
            </h4>
            {isTag && items ? (
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {items.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-steel-50 text-steel-700 text-[11px] sm:text-xs rounded-md font-medium border border-steel-100">{s}</span>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {nonEmptyLines(content).map((p, i) => (
                  <p key={i} className="text-xs sm:text-sm text-steel-600 leading-relaxed">{p}</p>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function VacancyContext({ vac, cand }) {
  if (!vac) {
    return (
      <div className="p-5 text-center">
        <Briefcase className="w-8 h-8 text-steel-200 mx-auto mb-2" />
        <p className="text-sm text-steel-400">Ejecuta un matching para ver el contexto de la vacante</p>
      </div>
    )
  }

  const sections = vac.sections || []

  return (
    <div className="p-4 2xl:p-5 space-y-4">
      <div className="pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-steel-800">{vac.profile_name}</h3>
        {vac.tipo_vacante && <p className="text-[11px] text-steel-400 mt-0.5">{vac.tipo_vacante}</p>}
      </div>

      <div>
        <p className="text-[10px] font-semibold text-steel-400 uppercase tracking-wider mb-2">Requisitos de la Vacante</p>
        {sections.length > 0 ? (
          sections.map((s, i) => (
            <div key={i} className="mb-3">
              <p className="text-[11px] font-semibold text-steel-600 mb-1">{SECTION_LABELS[s.section_type] || s.section_type}</p>
              <div className="text-[11px] text-steel-500 leading-relaxed">
                {nonEmptyLines(s.content).map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-steel-400">Sin requisitos definidos</p>
        )}
      </div>

      {cand?.metadata?.skills_preview?.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-steel-400 uppercase tracking-wider mb-2">Skills del Candidato</p>
          <div className="flex flex-wrap gap-1">
            {cand.metadata.skills_preview.map((s, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-steel-50 text-steel-600 text-[10px] rounded border border-steel-100">{s}</span>
            ))}
            {cand.metadata.skills_count > 10 && (
              <span className="text-[10px] text-steel-400 py-0.5">+{cand.metadata.skills_count - 10} más</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetaCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-steel-50/50 rounded-lg px-3 py-2 text-center">
      <div className="flex justify-center mb-0.5">
        <Icon className="w-4 h-4 text-steel-500" aria-hidden />
      </div>
      <p className="text-xs font-semibold text-steel-800 mt-0.5">{value}</p>
      <p className="text-[9px] text-steel-400">{label}</p>
      {sub && <p className="text-[9px] text-steel-400">{sub}</p>}
    </div>
  )
}

function Empty({ t, s }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center px-4">
        <h3 className="text-base font-semibold text-steel-700 mb-1">{t}</h3>
        <p className="text-sm text-steel-400">{s}</p>
      </div>
    </div>
  )
}
