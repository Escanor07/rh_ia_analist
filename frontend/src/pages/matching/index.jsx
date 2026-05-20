import { useState, useEffect } from 'react'
import { BrainCircuit, Briefcase, ChevronLeft } from 'lucide-react'
import { fetchVacancies, fetchDefaultWeights, runMatching } from '../../lib/api'
import { normalizeWeights } from '../../lib/matching'
import PageLoader from '../../components/common/PageLoader'
import EmptyState from '../../components/common/EmptyState'
import MatchingToolbar from './components/MatchingToolbar'
import CandidateListPanel from './components/CandidateListPanel'
import CandidateDetailPanel from './components/CandidateDetailPanel'
import VacancyContextPanel from './components/VacancyContextPanel'

export default function MatchingPage() {
  const [vacancies, setVacancies] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [result, setResult] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [weights, setWeights] = useState(null)
  const [showWeights, setShowWeights] = useState(false)
  const [topN, setTopN] = useState(10)
  const [sameSucursal, setSameSucursal] = useState(false)
  const [init, setInit] = useState(true)
  const [running, setRunning] = useState(false)
  const [mobileView, setMobileView] = useState('list')
  const [vacancyDrawerOpen, setVacancyDrawerOpen] = useState(false)

  useEffect(() => {
    Promise.all([fetchVacancies(), fetchDefaultWeights()])
      .then(([v, w]) => {
        setVacancies(v.vacancies || [])
        const pcts = {}
        for (const [k, val] of Object.entries(w.weights || {})) pcts[k] = Math.round(val * 100)
        setWeights(pcts)
      })
      .catch(console.error)
      .finally(() => setInit(false))
  }, [])

  const handleSelect = (id) => {
    setSelectedId(id)
    if (!id) setSameSucursal(false)
  }

  const handleRun = async () => {
    if (!selectedId) return
    setRunning(true)
    setResult(null)
    setSelectedCandidate(null)
    setMobileView('list')
    setVacancyDrawerOpen(false)
    try {
      const data = await runMatching(
        selectedId,
        topN,
        weights ? normalizeWeights(weights) : null,
        sameSucursal,
      )
      setResult(data)
      const first = data?.matching?.candidates?.[0]
      if (first) setSelectedCandidate(first)
    } catch (e) {
      console.error(e)
    } finally {
      setRunning(false)
    }
  }

  if (init) return <PageLoader label="Preparando matching…" />

  const candidates = result?.matching?.candidates || []
  const vacancy    = result?.vacancy

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 xl:px-8">
        <MatchingToolbar
          vacancies={vacancies}
          selectedId={selectedId}
          onSelect={handleSelect}
          topN={topN}
          onTopNChange={setTopN}
          loading={running}
          onRun={handleRun}
          showWeights={showWeights}
          onToggleWeights={() => setShowWeights(s => !s)}
          weights={weights}
          onWeightChange={(k, v) => setWeights(prev => ({ ...prev, [k]: v }))}
          sameSucursal={sameSucursal}
          onToggleSameSucursal={() => setSameSucursal(s => !s)}
        />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {candidates.length === 0 ? (
          <div className="flex-1 p-4 sm:p-6 xl:p-8">
            {running ? (
              <PageLoader label="Ejecutando matching…" />
            ) : (
              <EmptyState
                icon={BrainCircuit}
                title="Matching Inteligente"
                description="Selecciona una vacante y ejecuta el matching para ver candidatos rankeados."
              />
            )}
          </div>
        ) : (
          <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <div className={`${mobileView !== 'list' ? 'hidden lg:flex' : 'flex'} w-full lg:w-72 xl:w-80 2xl:w-96 shrink-0 flex-col border-r border-slate-200 bg-white overflow-hidden`}>
              <CandidateListPanel
                candidates={candidates}
                selectedId={selectedCandidate?.document_id}
                onSelect={c => { setSelectedCandidate(c); setMobileView('detail') }}
              />
            </div>

            <div className={`${mobileView === 'list' ? 'hidden lg:block' : 'block'} flex-1 min-w-0 overflow-y-auto scroll-thin bg-steel-50`}>
              <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-steel-600"
                >
                  ← Volver
                </button>
              </div>
              <div className="p-4 sm:p-5 xl:p-6">
                <CandidateDetailPanel candidate={selectedCandidate} />
              </div>
            </div>

            {vacancyDrawerOpen && (
              <button
                type="button"
                aria-label="Cerrar panel de vacante"
                className="absolute inset-0 z-20 bg-steel-900/25 transition-opacity lg:bg-steel-900/15"
                onClick={() => setVacancyDrawerOpen(false)}
              />
            )}

            <aside
              id="matching-vacancy-drawer"
              className={`absolute inset-y-0 right-0 z-30 flex w-[min(22rem,calc(100%-0.75rem))] max-w-[min(22rem,100vw-1.5rem)] flex-col border-l border-slate-200 bg-white shadow-[-8px_0_24px_-4px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out ${
                vacancyDrawerOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
              }`}
              aria-hidden={!vacancyDrawerOpen}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2.5">
                <span className="truncate text-sm font-semibold text-steel-800">Contexto de vacante</span>
                <button
                  type="button"
                  onClick={() => setVacancyDrawerOpen(false)}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-steel-600 hover:bg-steel-100"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Cerrar
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-4">
                <VacancyContextPanel vacancy={vacancy} matching={result?.matching} />
              </div>
            </aside>

            {!vacancyDrawerOpen && (
              <button
                type="button"
                onClick={() => setVacancyDrawerOpen(true)}
                aria-expanded={false}
                aria-controls="matching-vacancy-drawer"
                id="matching-vacancy-drawer-trigger"
                className="absolute right-0 top-10 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-slate-200 bg-white px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-steel-600 shadow-md transition-colors hover:bg-steel-50 hover:text-steel-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-400"
              >
                <Briefcase className="h-4 w-4 shrink-0 text-steel-500" aria-hidden />
                <span className="text-center leading-tight">Vacante</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}