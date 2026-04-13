import SectionCard from '../../../components/common/SectionCard'

export default function DashboardInsightsRow({ discardReasons = {}, turnover = {} }) {
  const entries = Object.entries(discardReasons)
    .filter(([, v]) => typeof v === 'number')
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
  const total = entries.reduce((s, [, v]) => s + v, 0)

  const hasTurnover = turnover.total > 0
  const byType      = Object.entries(turnover.by_type || {}).sort(([, a], [, b]) => b - a)
  const reasons     = (turnover.reasons || []).slice(0, 5)

  if (entries.length === 0 && !hasTurnover) return null

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {entries.length > 0 && (
        <SectionCard title="Motivos de descarte">
          <div className="space-y-3">
            {entries.map(([reason, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={reason}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-steel-700">{reason}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-steel-800">
                      {count}
                      <span className="ml-1 font-normal text-steel-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-red-300 transition-all duration-700"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {hasTurnover && (
        <SectionCard title="Rotación de personal"
          description={`${turnover.total} registros de baja`}>
          {byType.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {byType.map(([type, count]) => (
                <span key={type}
                  className="rounded-full bg-steel-50 px-2.5 py-1 text-[11px] font-medium text-steel-700">
                  {type}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}
          {reasons.length > 0 && (
            <div className="space-y-2">
              {reasons.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-steel-600">{r.reason || 'Sin motivo'}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-steel-700">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
