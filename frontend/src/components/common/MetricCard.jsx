const TONES = {
  default: { icon: 'bg-steel-50 text-steel-500', sub: 'text-steel-500' },
  accent:  { icon: 'bg-emerald-50 text-emerald-600', sub: 'text-emerald-600' },
  warn:    { icon: 'bg-amber-50 text-amber-600', sub: 'text-amber-600' },
  danger:  { icon: 'bg-red-50 text-red-500', sub: 'text-red-500' },
}

export default function MetricCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  const t = TONES[tone] || TONES.default
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-steel-400">{label}</p>
          <p className="mt-2.5 text-3xl font-bold tracking-tight text-steel-950">{value}</p>
          {sub && <p className={`mt-2 text-xs font-medium ${t.sub}`}>{sub}</p>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
