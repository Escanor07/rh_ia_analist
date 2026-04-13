import SectionCard from '../../../components/common/SectionCard'

export default function DashboardFunnelPanel({ funnel = {} }) {
  const stages = funnel.stages || []
  const max    = stages[0]?.count || 1

  return (
    <SectionCard title="Embudo de candidatos" description="Volumen y conversión por etapa del proceso.">
      {stages.length === 0 ? (
        <p className="py-6 text-center text-sm text-steel-400">Sin datos de funnel disponibles.</p>
      ) : (
        <div className="flex flex-col items-center gap-[3px] py-2">
          {stages.map((stage, i) => {
            const widthPct = Math.round((stage.count / max) * 100)
            const alpha = (0.88 - (i / Math.max(stages.length - 1, 1)) * 0.42).toFixed(2)
            return (
              <div key={`${stage.label ?? stage.stage}-${i}`}
                className="w-full flex justify-center">
                <div style={{ width: `${widthPct}%` }} className="min-w-0 w-full">
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 shadow-sm"
                    style={{ background: `rgba(45,62,81,${alpha})` }}
                  >
                    <span className="text-xs font-semibold text-white truncate">
                      {stage.label ?? stage.stage}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular-nums text-sm font-bold text-white">{stage.count}</span>
                      <span className="ml-1.5 text-[10px] text-white/60">({stage.pct ?? 0}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
