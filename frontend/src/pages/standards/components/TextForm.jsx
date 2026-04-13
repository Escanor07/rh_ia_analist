import { useState } from 'react'
import { createStandard } from '../../../lib/api'
import { FieldLabel, FormCard, SubmitBtn, NativeSelect, INPUT_CLS } from './FormPrimitives'

export default function TextForm({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState('score')
  const [creating, setCreating] = useState(false)
  const ok = name.trim() && content.trim()

  const submit = async () => {
    if (!ok) return
    setCreating(true)
    try { onCreated(await createStandard({ standard_type: 'text', name, content, eval_mode: mode })) }
    catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  return (
    <FormCard title="Nuevo criterio de texto"
      description="Para reflejar características deseadas en cualquier rol."
      accent="blue" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <FieldLabel>Nombre</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className={INPUT_CLS} placeholder="Ej. Adaptabilidad al cambio" />
        </div>
        <div>
          <FieldLabel>Qué debe reflejar el CV</FieldLabel>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
            className={`${INPUT_CLS} resize-none leading-relaxed`}
            placeholder="Describe en lenguaje natural lo que buscas. Ej.: experiencia en logística, almacén o distribución; manejo de inventarios." />
        </div>
        <div>
          <FieldLabel>Modo de evaluación</FieldLabel>
          <NativeSelect value={mode} onChange={e => setMode(e.target.value)}>
            <option value="informational">Informativo — solo muestra el valor</option>
            <option value="score">Puntuación — suma al score final</option>
            <option value="filter">Filtro — excluye si no cumple</option>
          </NativeSelect>
        </div>
        <div className="flex gap-2 pt-1">
          <SubmitBtn pending={creating} disabled={!ok} onClick={submit} accent="blue">
            Crear criterio
          </SubmitBtn>
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-steel-600 hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      </div>
    </FormCard>
  )
}
