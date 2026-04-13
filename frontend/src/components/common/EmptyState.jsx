export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8">
      <div className="text-center">
        {Icon && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-steel-50">
            <Icon className="h-5 w-5 text-steel-400" />
          </div>
        )}
        <p className="text-sm font-semibold text-steel-700">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-steel-400">{description}</p>}
      </div>
    </div>
  )
}
