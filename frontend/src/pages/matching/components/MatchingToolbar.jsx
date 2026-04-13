import { Briefcase, ChevronDown, Settings2, Play, Loader2 } from 'lucide-react'

const WEIGHT_LABELS = {
  skills: 'Habilidades',
  experience: 'Experiencia',
  education: 'Educación',
  certifications: 'Capacitación',
  languages: 'Idiomas',
  general: 'General',
  summary: 'Perfil',
}

export default function MatchingToolbar({
  vacancies = [],
  selectedId,
  onSelect,
  topN,
  onTopNChange,
  loading,
  onRun,
  showWeights,
  onToggleWeights,
  weights,
  onWeightChange,
  sameSucursal,
  onToggleSameSucursal,
}) {
  const totalPct = weights ? Object.values(weights).reduce((a, b) => a + b, 0) : 100
  const pctOk    = totalPct === 100

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-3">

        <div className="relative flex-1 min-w-[240px] max-w-xl">
          <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-300 pointer-events-none" />
          <select
            value={selectedId || ''}
            onChange={e => onSelect(e.target.value ? Number(e.target.value) : null)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-steel-800 outline-none focus:border-steel-400 focus:ring-1 focus:ring-steel-200"
          >
            <option value="">Seleccionar vacante…</option>
            {vacancies.map(v => (
              <option key={v.source_id} value={v.source_id}>
                #{v.source_id} — {v.profile_name}
                {v.tipo_vacante ? ` (${v.tipo_vacante})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-300 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={topN}
            onChange={e => onTopNChange(Number(e.target.value))}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-7 text-sm text-steel-700 outline-none focus:border-steel-400"
          >
            {[5, 10, 15, 20].map(n => (
              <option key={n} value={n}>Top {n}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-300 pointer-events-none" />
        </div>

        <label
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50 select-none"
          title="Incluir solo candidatos que han aplicado a vacantes de esta misma sucursal"
        >
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ${
              sameSucursal ? 'bg-steel-700' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${
                sameSucursal ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </span>
          <input
            type="checkbox"
            checked={sameSucursal}
            onChange={onToggleSameSucursal}
            className="sr-only"
          />
          <span className="text-sm text-steel-600 hidden sm:inline">Misma sucursal</span>
        </label>

        <button
          type="button"
          onClick={onToggleWeights}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            showWeights
              ? 'border-steel-400 bg-steel-50 text-steel-700'
              : 'border-slate-200 text-steel-500 hover:bg-slate-50'
          }`}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Pesos</span>
        </button>

        <button
          type="button"
          onClick={onRun}
          disabled={!selectedId || loading}
          className="flex items-center gap-2 rounded-xl bg-steel-800 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-steel-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Play className="h-4 w-4" />
          }
          <span className="hidden sm:inline">{loading ? 'Procesando…' : 'Ejecutar'}</span>
        </button>
      </div>

      {/* Weights panel */}
      {showWeights && weights && (
        <div className="border-t border-slate-100 bg-steel-50/50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-steel-500">
              Pesos por sección
            </p>
            <span className={`text-xs font-bold tabular-nums ${pctOk ? 'text-emerald-600' : 'text-amber-500'}`}>
              Total: {totalPct}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {Object.entries(weights).map(([key, val]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2"
              >
                <span className="truncate text-xs text-steel-600">{WEIGHT_LABELS[key] || key}</span>
                <span className="flex items-baseline gap-0.5 shrink-0">
                  <input
                    type="number"
                    min={0} max={50} step={1}
                    value={val}
                    onChange={e => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n)) onWeightChange(key, Math.round(Math.max(0, Math.min(50, n))))
                    }}
                    className="w-9 bg-transparent text-right text-sm font-semibold text-steel-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-steel-400">%</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}