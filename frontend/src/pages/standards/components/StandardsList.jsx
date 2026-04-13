import { Shield, Loader2, Trash2 } from 'lucide-react'
import SectionCard from '../../../components/common/SectionCard'
import { MODE_LABELS, MODE_TONE, MODE_ENTRIES, formatAttr } from '../constants'

export default function StandardsList({ standards, saving, onToggle, onModeChange, onDelete }) {
  if (standards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
        <Shield className="mx-auto mb-3 h-10 w-10 text-steel-200" />
        <p className="text-sm font-semibold text-steel-500">Sin estándares</p>
        <p className="mt-1 max-w-xs text-xs text-steel-400">
          Agrega criterios de texto o reglas de atributo para enriquecer el matching.
        </p>
      </div>
    )
  }

  return (
    <SectionCard title="Biblioteca de reglas"
      description="Lista de estándares con su tipo, modo de evaluación y estado actual.">
      <div className="space-y-3">
        {standards.map(s => {
          const isText = s.standard_type === 'text'
          return (
            <div key={s.id}
              className={`rounded-2xl border p-4 transition-all ${
                s.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
              }`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => onToggle(s)} disabled={saving === s.id}
                  className="mt-1 shrink-0" title={s.is_active ? 'Desactivar' : 'Activar'}>
                  {saving === s.id
                    ? <Loader2 className="h-4 w-4 animate-spin text-steel-300" />
                    : <div className={`h-4 w-4 rounded-full transition-colors ${
                        s.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className="text-sm font-semibold text-steel-900">{s.name}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-steel-600">
                      {isText ? 'Texto' : 'Atributo'}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${MODE_TONE[s.eval_mode] || MODE_TONE.informational}`}>
                      {MODE_LABELS[s.eval_mode] || s.eval_mode}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-steel-500">
                    {isText ? s.content : formatAttr(s.attribute_slug, s.attribute_config)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MODE_ENTRIES.map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => onModeChange(s.id, mode)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          s.eval_mode === mode
                            ? MODE_TONE[mode]
                            : 'border-slate-200 text-steel-400 hover:bg-slate-50'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="button" onClick={() => onDelete(s.id)}
                  className="rounded-xl p-2 text-steel-200 transition-colors hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
