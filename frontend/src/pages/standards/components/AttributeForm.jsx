import { useState } from 'react'
import { createStandard } from '../../../lib/api'
import { defaultFromSchema } from '../constants'
import { FieldLabel, FormCard, SubmitBtn, NativeSelect, INPUT_CLS } from './FormPrimitives'

export default function AttributeForm({ catalog, onCreated, onCancel }) {
  const slugs = Object.keys(catalog)
  const first = slugs[0] || ''
  const [slug, setSlug] = useState(first)
  const [mode, setMode] = useState('filter')
  const [config, setConfig] = useState(() => defaultFromSchema(catalog[first]?.config_schema))
  const [creating, setCreating] = useState(false)
  const info          = catalog[slug]
  const schemaEntries = Object.entries(info?.config_schema || {})

  const updateSlug = s => { setSlug(s); setConfig(defaultFromSchema(catalog[s]?.config_schema)) }

  const submit = async () => {
    if (!slug || !info) return
    setCreating(true)
    try {
      onCreated(await createStandard({
        standard_type: 'attribute', name: info.name,
        attribute_slug: slug, attribute_config: config, eval_mode: mode,
      }))
    }
    catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  if (!slugs.length) return null

  return (
    <FormCard title="Nueva regla de atributo"
      description="Configura reglas globales usando el catálogo disponible."
      accent="amber" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <FieldLabel>Atributo</FieldLabel>
          <NativeSelect value={slug} onChange={e => updateSlug(e.target.value)}>
            {slugs.map(s => <option key={s} value={s}>{catalog[s].name}</option>)}
          </NativeSelect>
        </div>
        {info?.description && (
          <p className="rounded-xl bg-amber-50/60 px-3 py-2 text-xs text-amber-700">{info.description}</p>
        )}
        {schemaEntries.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {schemaEntries.map(([key, schema]) => (
              <div key={key}>
                <FieldLabel>{schema.label || key}</FieldLabel>
                {schema.type === 'select' ? (
                  <NativeSelect value={config[key] ?? schema.default}
                    onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}>
                    {schema.options?.map(o => (
                      <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>
                    ))}
                  </NativeSelect>
                ) : (
                  <input type="number" min={schema.min} max={schema.max}
                    value={config[key] ?? schema.default}
                    onChange={e => setConfig(p => ({ ...p, [key]: Number(e.target.value) }))}
                    className={`${INPUT_CLS} max-w-32 tabular-nums`} />
                )}
              </div>
            ))}
          </div>
        )}
        <div>
          <FieldLabel>Modo de evaluación</FieldLabel>
          <NativeSelect value={mode} onChange={e => setMode(e.target.value)}>
            <option value="informational">Informativo — solo muestra el valor</option>
            <option value="score">Puntuación — suma al score final</option>
            <option value="filter">Filtro — excluye si no cumple</option>
          </NativeSelect>
        </div>
        <div className="flex gap-2 pt-1">
          <SubmitBtn pending={creating} onClick={submit} accent="amber">Crear regla</SubmitBtn>
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-steel-600 hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      </div>
    </FormCard>
  )
}
