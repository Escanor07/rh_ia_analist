import { ChevronDown, Loader2, Plus, X } from 'lucide-react'

export const INPUT_CLS  = 'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-steel-300 bg-white text-steel-800'
export const SELECT_CLS = `${INPUT_CLS} appearance-none`

export function NativeSelect({ value, onChange, children, className = '' }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} className={`${SELECT_CLS} pr-9 ${className}`}>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-300 pointer-events-none" />
    </div>
  )
}

export function FieldLabel({ children }) {
  return (
    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-steel-400">{children}</p>
  )
}

export function FormCard({ title, description, accent = 'blue', onClose, children }) {
  const border = accent === 'blue' ? 'border-blue-200' : 'border-amber-200'
  return (
    <div className={`rounded-2xl border-2 bg-white p-6 shadow-md ${border}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-steel-800">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-steel-400">{description}</p>}
        </div>
        <button type="button" onClick={onClose}
          className="rounded-xl p-1.5 text-steel-300 hover:bg-steel-50 hover:text-steel-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  )
}

export function SubmitBtn({ pending, disabled, onClick, accent, children }) {
  const bg = accent === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
  return (
    <button type="button" onClick={onClick} disabled={pending || disabled}
      className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-steel-400 ${bg}`}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {children}
    </button>
  )
}
