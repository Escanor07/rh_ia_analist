import { useCallback, useEffect, useState } from 'react'
import { Play, RefreshCw } from 'lucide-react'
import { fetchDashboard } from '../../lib/api'
import { usePipeline } from '../../context/PipelineContext'
import PageLoader from '../../components/common/PageLoader'
import PageHeader from '../../components/common/PageHeader'
import DashboardHeroStats from './components/HeroStats'
import DashboardFunnelPanel from './components/FunnelPanel'
import DashboardSlaPanel from './components/SlaPanel'
import DashboardInsightsRow from './components/InsightsRow'
import VacanciesTable from './components/VacanciesTable'

function ActionBtn({ icon: Icon, onClick, children, secondary, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        disabled
          ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
          : secondary
          ? 'border border-slate-200 bg-white text-steel-700 hover:bg-steel-50'
          : 'bg-steel-800 text-white hover:bg-steel-900'
      }`}>
      <Icon className="h-4 w-4" />{children}
    </button>
  )
}

export default function DashboardPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const { status, startIngest, startSync } = usePipeline()
  const pipelineRunning = Boolean(status?.running)

  const load = useCallback(() => {
    setLoading(true)
    fetchDashboard().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <PageLoader label="Cargando dashboard…" />

  const pipeline  = data?.pipeline  || {}
  const matching  = data?.matching  || {}
  const analytics = data?.analytics || {}
  const totals    = analytics.totals || {}
  const discardByCategory = analytics.discard_reasons?.by_category || {}

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 xl:px-8">
      <PageHeader
        title="Resumen general"
        description="Métricas del pipeline, embudo de candidatos y vacantes activas."
        actions={
          <>
            <ActionBtn icon={Play} onClick={() => startIngest(load)} disabled={pipelineRunning}>Indexar CVs</ActionBtn>
            <ActionBtn icon={RefreshCw} secondary onClick={() => startSync(load)} disabled={pipelineRunning}>Sincronizar</ActionBtn>
          </>
        }
      />

      <DashboardHeroStats pipeline={pipeline} matching={matching} totals={totals} />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <DashboardFunnelPanel funnel={analytics.candidate_funnel || {}} />
        <DashboardSlaPanel
          vacancySla={analytics.vacancy_sla || {}}
          candidateSla={analytics.candidate_sla || {}}
        />
      </div>

      <DashboardInsightsRow
        discardReasons={discardByCategory}
        turnover={analytics.turnover || {}}
      />

      <VacanciesTable vacancies={analytics.all_vacancies || []} />
    </div>
  )
}
