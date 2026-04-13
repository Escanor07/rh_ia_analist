import SectionCard from '../../../components/common/SectionCard'
import { Clock } from 'lucide-react'

function SlaBox({ label, data }) {
  const val = data?.promedio
  const n   = data?.medidos
  return (
    <div className="rounded-xl bg-steel-50 px-3 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-steel-400 truncate">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-steel-900">
        {val ?? '—'}
        {val != null && <span className="ml-0.5 text-sm font-normal text-steel-400">d</span>}
      </p>
      {n != null && <p className="text-[10px] text-steel-400">{n} muestras</p>}
    </div>
  )
}

export default function DashboardSlaPanel({ vacancySla = {}, candidateSla = {} }) {
  const cslStages = (candidateSla.stages || []).slice(0, 6)
  const hasSla    = vacancySla.solicitud_autorizacion || vacancySla.autorizacion_rh
  const hasCsl    = cslStages.length > 0

  return (
    <div className="flex flex-col gap-5">
      {hasSla && (
        <SectionCard title="SLA de vacantes" description="Días promedio entre etapas clave.">
          <div className="grid grid-cols-3 gap-2">
            <SlaBox label="Sol → Aut"     data={vacancySla.solicitud_autorizacion} />
            <SlaBox label="Aut → RRHH"    data={vacancySla.autorizacion_rh} />
            <SlaBox label="Total proceso" data={vacancySla.total_proceso} />
          </div>
        </SectionCard>
      )}

      {hasCsl && (
        <SectionCard title="SLA de candidatos" description="Tiempo promedio entre etapas del proceso.">
          <div className="space-y-2">
            {cslStages.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 min-w-0 truncate text-steel-600">
                  <Clock className="h-3 w-3 shrink-0 text-steel-300" />
                  {s.transition}
                </span>
                <span className="shrink-0 tabular-nums font-bold text-steel-800">
                  {s.avg_days}d
                  <span className="ml-1 font-normal text-steel-400">({s.count})</span>
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
