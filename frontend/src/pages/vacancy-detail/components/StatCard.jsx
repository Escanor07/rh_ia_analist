const STAT_VARIANT = {
  warn:    { value: 'text-red-500',    iconWrap: 'text-red-400 bg-red-50' },
  accent:  { value: 'text-emerald-600', iconWrap: 'text-emerald-500 bg-emerald-50' },
  default: { value: 'text-steel-900',  iconWrap: 'text-steel-400 bg-steel-50' },
}

export default function StatCard({ icon: Icon, label, value, variant }) {
  const { value: valueClass, iconWrap } = STAT_VARIANT[variant] ?? STAT_VARIANT.default
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-[11px] font-semibold text-steel-400 uppercase">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconWrap}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}
