function barColor(v) {
  return v >= 70 ? 'bg-emerald-500' : v >= 45 ? 'bg-amber-400' : 'bg-red-400'
}
function textColor(v) {
  return v >= 70 ? 'text-emerald-600' : v >= 45 ? 'text-amber-500' : 'text-red-500'
}

export default function ProgressBar({ label, value, matched = true }) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  return (
    <div className={matched ? '' : 'opacity-40'}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-steel-700 truncate">{label}</span>
        {matched ? (
          <span className={`text-xs font-bold tabular-nums ${textColor(pct)}`}>{pct}%</span>
        ) : (
          <span className="text-[10px] italic text-steel-300">—</span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {matched && (
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}
