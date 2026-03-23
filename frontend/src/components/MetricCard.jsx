export default function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  variant = 'default',
  size = 'default',
}) {
  const isWarn = variant === 'warn'
  const isAccent = variant === 'accent'
  const tc = isWarn ? 'text-red-500' : isAccent ? 'text-emerald-600' : 'text-steel-800'
  const bg = isWarn ? 'bg-red-50' : isAccent ? 'bg-emerald-50' : 'bg-steel-50'
  const ic = isWarn ? 'text-red-400' : isAccent ? 'text-emerald-500' : 'text-steel-400'
  const pad =
    size === 'compact' ? 'p-3 sm:p-4 2xl:p-5' : 'p-3.5 sm:p-5 2xl:p-6'
  const valueCls =
    size === 'compact'
      ? 'text-xl sm:text-2xl 2xl:text-[1.75rem]'
      : 'text-2xl sm:text-3xl 2xl:text-4xl'
  const iconWrap =
    size === 'compact'
      ? 'w-8 h-8 sm:w-9 sm:h-9 2xl:w-10 2xl:h-10 rounded-lg'
      : 'w-8 h-8 sm:w-10 sm:h-10 2xl:w-11 2xl:h-11 rounded-xl'
  const iconSz =
    size === 'compact'
      ? 'w-3.5 h-3.5 sm:w-4 sm:h-4 2xl:w-[18px] 2xl:h-[18px]'
      : 'w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6'

  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${pad} shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] 2xl:text-xs font-semibold text-steel-400 uppercase tracking-wide truncate">
            {label}
          </p>
          <p className={`${valueCls} font-bold mt-0.5 sm:mt-1 leading-tight ${tc}`}>{value}</p>
          {sub && (
            <p className="text-[10px] sm:text-[11px] 2xl:text-xs text-steel-300 mt-0.5 sm:mt-1 truncate">{sub}</p>
          )}
        </div>
        <div className={`${iconWrap} ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`${iconSz} ${ic}`} />
        </div>
      </div>
    </div>
  )
}
