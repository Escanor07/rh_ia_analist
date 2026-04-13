import { BarChart3, FileCheck, TrendingDown, TrendingUp } from 'lucide-react'
import MetricCard from '../../../components/common/MetricCard'

export default function DashboardHeroStats({ pipeline = {}, matching = {}, totals = {} }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <MetricCard
        icon={FileCheck}
        label="CVs indexados"
        value={`${pipeline.cvs_indexados_percent ?? 0}%`}
        sub={`${pipeline.cvs_procesados ?? 0} de ${pipeline.cvs_total_source ?? 0} procesados`}
      />
      <MetricCard
        icon={BarChart3}
        label="Comparaciones"
        value={matching.total_comparaciones ?? 0}
        sub="Ejecuciones de matching"
      />
      <MetricCard
        icon={TrendingUp}
        label="Conversión"
        value={`${totals.conversion_rate ?? 0}%`}
        sub={`${totals.contratados ?? 0} contratados`}
        tone="accent"
      />
      <MetricCard
        icon={TrendingDown}
        label="Drop-off"
        value={`${totals.drop_off_rate ?? 0}%`}
        sub={`${totals.descartados ?? 0} descartados`}
        tone="danger"
      />
    </div>
  )
}
