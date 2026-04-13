import { useState, useEffect } from 'react'
import { BrainCircuit } from 'lucide-react'
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
          <>
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

            <div className="hidden xl:block xl:w-72 2xl:w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto scroll-thin">
              <div className="p-4">
                <VacancyContextPanel vacancy={vacancy} matching={result?.matching} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}