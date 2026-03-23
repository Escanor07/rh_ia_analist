import { useState, useEffect } from 'react'
import { fetchVacancies, fetchDefaultWeights, runMatching } from '../lib/api'
import {
  SECTION_CONFIG,
  scoreTextClass,
  scoreBarClass,
  normalizeWeights,
} from '../lib/matching'
import PageLoader from '../components/PageLoader'
import {
  Loader2, Play, Briefcase, ChevronDown, Clock, Users, Settings2,
  User, Mail, Award, FileText, ArrowLeft
} from 'lucide-react'

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
  const [mobileDetail, setMobileDetail] = useState(false)

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
    setLd(true); setRes(null); setCand(null); setMobileDetail(false)
    try {
      const d = await runMatching(sel, topN, normalizedForApi)
      setRes(d)
      if (d.matching.candidates.length > 0) setCand(d.matching.candidates[0])
    } catch (e) { console.error(e) }
    finally { setLd(false) }
  }

  const selectCandidate = (c) => {
    setCand(c)
    setMobileDetail(true)
  }

  if (init) return <PageLoader />

  const cands = res?.matching?.candidates || [], vac = res?.vacancy

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm">
        <div className="w-full max-w-[1440px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 2xl:py-4 space-y-2 2xl:space-y-3">
        <div>
          <h2 className="text-base 2xl:text-lg font-bold text-steel-900">Matching Inteligente</h2>
          <p className="text-[11px] 2xl:text-xs text-steel-400 hidden sm:block">Revisión de candidatos sugeridos por inteligencia artificial</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 2xl:gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[440px] 2xl:max-w-[520px]">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300 pointer-events-none" />
            <select value={sel || ''} onChange={e => setSel(e.target.value ? Number(e.target.value) : null)}
              className="w-full pl-9 pr-8 py-2 2xl:py-2.5 border border-slate-200 rounded-lg text-sm 2xl:text-base bg-white focus:ring-2 focus:ring-steel-400 outline-none appearance-none text-steel-800">
              <option value="">Seleccionar vacante...</option>
              {vacs.map(v => <option key={v.source_id} value={v.source_id}>#{v.source_id} — {v.profile_name} ({v.tipo_vacante})</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300 pointer-events-none" />
          </div>
          <select value={topN} onChange={e => setTopN(Number(e.target.value))}
            className="px-2.5 py-2 2xl:px-3 2xl:py-2.5 border border-slate-200 rounded-lg text-sm 2xl:text-base bg-white outline-none text-steel-700 w-20 2xl:w-24">
            {[5, 10, 15, 20].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
          <button onClick={() => setShowW(!showW)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 border rounded-lg text-sm 2xl:text-base font-medium transition-colors ${showW ? 'border-steel-400 bg-steel-50 text-steel-700' : 'border-slate-200 text-steel-500 hover:bg-slate-50'}`}>
            <Settings2 className="w-4 h-4" /><span className="hidden sm:inline">Pesos</span>
          </button>
          <button onClick={go} disabled={!sel || ld}
            className="flex items-center gap-2 px-4 sm:px-5 2xl:px-6 py-2 2xl:py-2.5 bg-steel-600 hover:bg-steel-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-lg transition-colors text-sm 2xl:text-base shadow-sm">
            {ld ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{ld ? 'Procesando...' : 'Ejecutar Matching'}</span>
          </button>
          {cands.length > 0 && (
            <div className="hidden md:flex items-center gap-4 2xl:gap-5 ml-auto text-xs 2xl:text-sm text-steel-400">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{cands.length}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{res.matching.processing_time_seconds}s</span>
            </div>
          )}
        </div>

        {/* Weights panel */}
        {showW && rawWts && (
          <div className="bg-steel-50 rounded-lg p-3 sm:p-4 2xl:p-5 border border-steel-100">
            <div className="flex items-center justify-between mb-2 sm:mb-3 2xl:mb-4">
              <p className="text-[11px] 2xl:text-xs font-semibold text-steel-500 uppercase">Pesos de matching</p>
              <span className={`text-xs font-bold ${totalPct === 100 ? 'text-emerald-600' : 'text-amber-500'}`}>
                Total: {totalPct}% {totalPct !== 100 && '(normaliza a 100%)'}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-6 gap-2 sm:gap-3 2xl:gap-4">
              {Object.entries(rawWts).map(([k, v]) => (
                <div key={k}>
                  <label className="text-[10px] sm:text-[11px] font-medium text-steel-600 block mb-1">
                    {SECTION_CONFIG[k]?.l || k} <span className="font-bold">{v}%</span>
                  </label>
                  <input type="range" min="0" max="50" value={v}
                    onChange={e => setRawWts(prev => ({ ...prev, [k]: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-steel-200 rounded-full accent-steel-600" />
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {cands.length > 0 ? (<>
          <div className={`${mobileDetail ? 'hidden md:block' : ''} w-full md:w-[300px] lg:w-[340px] 2xl:w-[400px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto scroll-thin`}>
            <div className="px-3 sm:px-4 2xl:px-5 py-2.5 2xl:py-3 border-b border-slate-100 bg-steel-50/50">
              <p className="text-[11px] 2xl:text-xs font-semibold text-steel-400 uppercase tracking-wider">Candidatos Rankeados</p>
            </div>
            {cands.map(c => (
              <button key={c.document_id} onClick={() => selectCandidate(c)}
                className={`w-full text-left px-3 sm:px-4 2xl:px-5 py-3 2xl:py-3.5 border-b border-slate-100 flex items-center gap-2.5 sm:gap-3 2xl:gap-4 transition-colors cursor-pointer ${cand?.document_id === c.document_id ? 'bg-steel-50 border-l-[3px] border-l-steel-600' : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'}`}>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-steel-100 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-steel-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs sm:text-sm 2xl:text-[15px] text-steel-900 truncate block">{c.candidate_name}</span>
                  {c.candidate_status?.status_label && <p className="text-[10px] sm:text-[11px] 2xl:text-xs text-steel-400 truncate">{c.candidate_status.status_label}</p>}
                  {c.applied_to_vacancy && <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Aplicó a esta vacante</span>}
                </div>
                <span className={`shrink-0 px-1.5 sm:px-2 py-0.5 sm:py-1 2xl:px-2.5 2xl:py-1.5 rounded-lg text-xs sm:text-sm 2xl:text-base font-bold text-white tabular-nums ${scoreBarClass(c.score)}`}>{c.score}</span>
              </button>
            ))}
          </div>

          <div className={`${!mobileDetail ? 'hidden md:block' : ''} flex-1 min-w-0 overflow-y-auto scroll-thin bg-[#f0f3f8]`}>
            {mobileDetail && (
              <button onClick={() => setMobileDetail(false)} className="md:hidden flex items-center gap-2 px-4 py-3 text-sm text-steel-600 hover:bg-white/50 border-b border-slate-200 w-full">
                <ArrowLeft className="w-4 h-4" /> Volver a lista
              </button>
            )}
            {cand ? <Detail c={cand} vn={vac?.profile_name} /> : <Empty t="Selecciona un candidato" s="Haz clic en la lista" />}
          </div>
        </>) : (
          <div className="flex-1">
            {ld ? (
              <PageLoader label="Ejecutando matching..." />
            ) : (
              <Empty t="Matching Inteligente" s="Selecciona una vacante y ejecuta el matching" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({ c, vn }) {
  return (
    <div className="p-4 sm:p-6 2xl:p-8 max-w-4xl 2xl:max-w-5xl mx-auto space-y-4 sm:space-y-5 2xl:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-steel-100 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 sm:w-7 sm:h-7 text-steel-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h2 className="text-lg sm:text-xl 2xl:text-2xl font-bold text-steel-900 truncate">{c.candidate_name}</h2>
              <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 2xl:px-3.5 2xl:py-1.5 rounded-lg text-base sm:text-lg 2xl:text-xl font-bold text-white tabular-nums ${scoreBarClass(c.score)}`}>{c.score}</span>
              {c.candidate_status?.status_label && (
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-steel-100 text-steel-600 truncate max-w-[200px]">{c.candidate_status.status_label}</span>
              )}
            </div>
            {c.candidate_email && <p className="flex items-center gap-1.5 text-xs sm:text-sm text-steel-400 mt-1 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{c.candidate_email}</p>}
            <p className="text-[11px] sm:text-xs text-steel-300 mt-1">Vacante: <strong className="text-steel-500">{vn}</strong></p>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
        <h3 className="text-sm 2xl:text-base font-bold text-steel-800 mb-3 sm:mb-4 2xl:mb-5 flex items-center gap-2"><Award className="w-4 h-4 2xl:w-5 2xl:h-5 text-steel-500" />Score Breakdown</h3>
        <div className="space-y-2 sm:space-y-2.5 2xl:space-y-3">
          {(c.section_scores || []).map((ss) => {
            const cfg = SECTION_CONFIG[ss.section_type] || SECTION_CONFIG.general
            const I = cfg.icon
            return (
              <div key={ss.section_type} className="flex items-center gap-2 sm:gap-3">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}><I className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${cfg.c}`} /></div>
                <span className="text-xs sm:text-sm text-steel-700 w-20 sm:w-24 shrink-0 truncate">{ss.label}</span>
                <div className="flex-1 h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${scoreBarClass(ss.score_100)}`} style={{ width: `${ss.score_100}%` }} />
                </div>
                <span className={`font-mono font-bold text-xs sm:text-sm w-10 sm:w-12 text-right ${scoreTextClass(ss.score_100)}`}>{ss.score_100}%</span>
              </div>
            )
          })}
          <div className="flex items-center gap-2 sm:gap-3 pt-2 border-t border-slate-100">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-steel-50 flex items-center justify-center shrink-0"><FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-steel-500" /></div>
            <span className="text-xs sm:text-sm text-steel-700 w-20 sm:w-24 shrink-0">Perfil General</span>
            <div className="flex-1 h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreBarClass(c.full_profile_score)}`} style={{ width: `${c.full_profile_score}%` }} />
            </div>
            <span className={`font-mono font-bold text-xs sm:text-sm w-10 sm:w-12 text-right ${scoreTextClass(c.full_profile_score)}`}>{c.full_profile_score}%</span>
          </div>
        </div>
      </div>

      {/* CV sections */}
      {Object.entries(c.chunks_summary || {}).map(([type, content]) => {
        const cfg = SECTION_CONFIG[type] || SECTION_CONFIG.general
        const I = cfg.icon
        if (!content?.trim()) return null
        const isTag = type === 'skills' || type === 'languages'
        const items = isTag ? content.split(/[,•\n]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 60) : null
        return (
          <div key={type} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 2xl:p-6 shadow-sm">
            <h4 className="text-sm 2xl:text-base font-bold text-steel-800 mb-2 sm:mb-3 2xl:mb-4 flex items-center gap-2">
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md ${cfg.bg} flex items-center justify-center`}><I className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${cfg.c}`} /></div>{cfg.l}
            </h4>
            {isTag && items ? (
              <div className="flex flex-wrap gap-1 sm:gap-1.5">{items.map((s, i) => <span key={i} className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-steel-50 text-steel-700 text-[11px] sm:text-xs rounded-md font-medium border border-steel-100">{s}</span>)}</div>
            ) : (
              <div className="space-y-1">{content.split('\n').filter(Boolean).map((p, i) => <p key={i} className="text-xs sm:text-sm text-steel-600 leading-relaxed">{p}</p>)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Empty({ t, s }) {
  return <div className="flex items-center justify-center h-full"><div className="text-center px-4"><h3 className="text-base font-semibold text-steel-700 mb-1">{t}</h3><p className="text-sm text-steel-400">{s}</p></div></div>
}
