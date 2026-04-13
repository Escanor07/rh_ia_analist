export default function SecondaryPanel({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 sm:p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-steel-500 mb-3 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-steel-400 shrink-0" />
        {title}
      </h3>
      <div className="text-steel-600">{children}</div>
    </div>
  )
}
