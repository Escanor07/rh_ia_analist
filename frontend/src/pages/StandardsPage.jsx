import { useState, useEffect } from 'react'
import { fetchStandards, fetchAttributeCatalog, createStandard, updateStandard, deleteStandard } from '../lib/api'
import PageLoader from '../components/PageLoader'
import {
  Shield, Plus, Trash2, Loader2, CheckCircle2, XCircle, X,
  FileText, Settings2, ChevronDown, Sparkles,
} from 'lucide-react'

const MODE_LABELS = { score: 'Puntuación', filter: 'Filtro', informational: 'Informativo' }
const MODE_ENTRIES = Object.entries(MODE_LABELS)
const MODE_HELP =
  'Puntuación suma al match; Filtro excluye candidatos; Informativo solo muestra el resultado.'

const MODE_COLORS = {
  score: 'bg-blue-50 text-blue-600 border-blue-200',
  filter: 'bg-amber-50 text-amber-600 border-amber-200',
  informational: 'bg-steel-50 text-steel-500 border-steel-200',
}

const FIELD = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none'
const SELECT_FIELD = `${FIELD} appearance-none pr-9`
const CHEVRON = 'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300 pointer-events-none'
const RING_BLUE = 'focus:ring-2 focus:ring-blue-300'
const RING_AMBER = 'focus:ring-2 focus:ring-amber-300'
const FORM_FOOTER = 'flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between pt-1 border-t border-slate-100'

const defaultConfigFromSchema = (schema) =>
  Object.fromEntries(Object.entries(schema || {}).map(([k, v]) => [k, v.default]))

const ATTR_SUMMARY = {
  stability: (c) => `Estabilidad mínima: ${c?.min_level || 'media'}`,
  min_experience: (c) => `Experiencia mínima: ${c?.min_years || 2} años`,
  min_education: (c) => `Educación mínima: ${c?.min_level || 'preparatoria'}`,
  cv_completeness: (c) => `Secciones mínimas: ${c?.min_sections || 4}/6`,
}
const formatAttributeConfig = (slug, config) => ATTR_SUMMARY[slug]?.(config) ?? JSON.stringify(config)

function NativeSelect({ id, value, onChange, className = '', children }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={onChange} className={`${SELECT_FIELD} ${className}`.trim()}>
        {children}
      </select>
      <ChevronDown className={CHEVRON} />
    </div>
  )
}

function EvalModeField({ id, mode, onChange, label, accentClass, ringClass }) {
  return (
    <div className="flex-1 min-w-0 max-w-md">
      <label htmlFor={id} className="text-xs font-medium text-steel-600 flex items-center gap-1.5 mb-1.5">
        <Sparkles className={`w-3.5 h-3.5 shrink-0 ${accentClass}`} />
        {label}
      </label>
      <NativeSelect id={id} value={mode} onChange={e => onChange(e.target.value)} className={`focus:ring-2 ${ringClass}`}>
        {MODE_ENTRIES.map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </NativeSelect>
      <p className="text-[11px] text-steel-400 mt-1.5">{MODE_HELP}</p>
    </div>
  )
}

function FormHeader({ Icon, iconClass, title, onClose }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
        {title}
      </h3>
      <button type="button" onClick={onClose} aria-label="Cerrar"
        className="text-steel-300 hover:text-steel-600 p-1 rounded-lg hover:bg-steel-50 transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function SubmitButton({ pending, disabled, onClick, className, children }) {
  return (
    <button type="button" onClick={onClick} disabled={pending || disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors shrink-0 sm:self-end disabled:bg-slate-200 disabled:text-steel-400 ${className}`}>
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      {children}
    </button>
  )
}

export default function StandardsPage() {
  const [standards, setStandards] = useState([])
  const [catalog, setCatalog] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [showNew, setShowNew] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStandards(), fetchAttributeCatalog()])
      .then(([s, c]) => {
        setStandards(s.standards || [])
        setCatalog(c.catalog || {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const patchStandard = async (id, payload) => {
    setSaving(id)
    try {
      const updated = await updateStandard(id, payload)
      setStandards(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este estándar?')) return
    setSaving(id)
    try {
      await deleteStandard(id)
      setStandards(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  const handleCreated = (newStd) => {
    setStandards(prev => [newStd, ...prev])
    setShowNew(null)
  }

  if (loading) return <PageLoader />

  const active = standards.filter(s => s.is_active)
  const textCount = active.filter(s => s.standard_type === 'text').length
  const attrCount = active.filter(s => s.standard_type === 'attribute').length
  const toggleBtn = (kind) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      showNew === kind ? 'bg-steel-700 text-white' : 'bg-white border border-slate-200 text-steel-600 hover:bg-steel-50 shadow-sm'
    }`

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin">
      <div className="w-full max-w-[900px] 2xl:max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 2xl:py-8 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-steel-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-steel-500" />
              Estándares Globales
            </h2>
            <p className="text-xs sm:text-sm text-steel-400 mt-1">
              Criterios aplicados a todos los candidatos. Usa texto libre para requisitos de dominio o reglas de atributo para filtros medibles.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => setShowNew(showNew === 'text' ? null : 'text')} className={toggleBtn('text')}>
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Texto</span>
            </button>
            <button type="button" onClick={() => setShowNew(showNew === 'attribute' ? null : 'attribute')} className={toggleBtn('attribute')}>
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Regla</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-4 sm:gap-8 text-sm">
          <span className="text-steel-400">Activos: <strong className="text-steel-800">{active.length}</strong></span>
          {textCount > 0 && <span className="text-steel-400">Texto: <strong className="text-blue-600">{textCount}</strong></span>}
          {attrCount > 0 && <span className="text-steel-400">Reglas: <strong className="text-amber-600">{attrCount}</strong></span>}
          <span className="text-steel-400">
            Peso en score: <strong className="text-steel-800">{active.length > 0 ? '15%' : '0% (redistribuido)'}</strong>
          </span>
        </div>

        {showNew === 'text' && <TextForm onCreated={handleCreated} onCancel={() => setShowNew(null)} />}
        {showNew === 'attribute' && <AttributeForm catalog={catalog} onCreated={handleCreated} onCancel={() => setShowNew(null)} />}

        <div className="space-y-3">
          {standards.length === 0 && !showNew && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Shield className="w-10 h-10 text-steel-200 mx-auto mb-3" />
              <p className="text-steel-500">No hay estándares definidos</p>
              <p className="text-xs text-steel-400 mt-1">Agrega criterios de texto o reglas de atributo</p>
            </div>
          )}
          {standards.map(s => (
            <div key={s.id}
              className={`bg-white rounded-xl border shadow-sm transition-all ${s.is_active ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
              <div className="flex items-start gap-3 px-4 sm:px-5 py-4">
                <button type="button" onClick={() => patchStandard(s.id, { is_active: !s.is_active })} disabled={saving === s.id}
                  className={`mt-0.5 shrink-0 ${s.is_active ? 'text-emerald-500' : 'text-steel-300'}`}>
                  {saving === s.id ? <Loader2 className="w-5 h-5 animate-spin" />
                    : s.is_active ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-steel-900">{s.name}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      s.standard_type === 'text' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {s.standard_type === 'text' ? 'Texto' : 'Regla'}
                    </span>
                    <select value={s.eval_mode} onChange={e => patchStandard(s.id, { eval_mode: e.target.value })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border outline-none cursor-pointer ${MODE_COLORS[s.eval_mode]}`}>
                      {MODE_ENTRIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {s.standard_type === 'text' ? (
                    <p className="text-xs sm:text-sm text-steel-500 mt-1 leading-relaxed">{s.content}</p>
                  ) : (
                    <p className="text-xs text-steel-500 mt-1">{formatAttributeConfig(s.attribute_slug, s.attribute_config)}</p>
                  )}
                </div>
                <button type="button" onClick={() => handleDelete(s.id)} disabled={saving === s.id}
                  className="text-steel-300 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TextForm({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState('score')
  const [creating, setCreating] = useState(false)
  const canSubmit = Boolean(name.trim() && content.trim())

  const submit = async () => {
    if (!canSubmit) return
    setCreating(true)
    try {
      onCreated(await createStandard({ standard_type: 'text', name, content, eval_mode: mode }))
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 p-5 shadow-md space-y-4">
      <FormHeader Icon={FileText} iconClass="text-blue-500" title="Nuevo criterio de texto" onClose={onCancel} />
      <div className="space-y-1">
        <label htmlFor="text-standard-name" className="text-xs font-medium text-steel-600 block">Nombre</label>
        <input id="text-standard-name" type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej. Experiencia en cadena de suministro" className={`${FIELD} ${RING_BLUE}`} />
      </div>
      <div className="space-y-1">
        <label htmlFor="text-standard-content" className="text-xs font-medium text-steel-600 block">Qué debe reflejar el CV</label>
        <textarea id="text-standard-content" value={content} onChange={e => setContent(e.target.value)} rows={4}
          placeholder="Describe en tus palabras qué buscas. Ej.: experiencia en logística, almacén o distribución; manejo de inventarios y control de mercancía."
          className={`${FIELD} text-steel-800 ${RING_BLUE} resize-none leading-relaxed`} />
      </div>
      <div className={FORM_FOOTER}>
        <EvalModeField id="text-standard-mode" mode={mode} onChange={setMode} label="Cómo usar este criterio"
          accentClass="text-blue-500" ringClass="focus:ring-blue-300" />
        <SubmitButton pending={creating} disabled={!canSubmit} onClick={submit} className="bg-blue-600 hover:bg-blue-700">
          Crear criterio
        </SubmitButton>
      </div>
    </div>
  )
}

function AttributeForm({ catalog, onCreated, onCancel }) {
  const slugs = Object.keys(catalog)
  const first = slugs[0] || ''
  const [slug, setSlug] = useState(first)
  const [mode, setMode] = useState('filter')
  const [config, setConfig] = useState(() => defaultConfigFromSchema(catalog[first]?.config_schema))
  const [creating, setCreating] = useState(false)
  const info = catalog[slug]
  const schemaEntries = Object.entries(info?.config_schema || {})

  const updateSlug = (newSlug) => {
    setSlug(newSlug)
    setConfig(defaultConfigFromSchema(catalog[newSlug]?.config_schema))
  }

  const submit = async () => {
    if (!slug || !info) return
    setCreating(true)
    try {
      onCreated(await createStandard({
        standard_type: 'attribute',
        name: info.name,
        attribute_slug: slug,
        attribute_config: config,
        eval_mode: mode,
      }))
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  if (!slugs.length) return <p className="text-sm text-steel-400 p-4">No hay reglas de atributo disponibles</p>

  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 p-5 shadow-md space-y-4">
      <FormHeader Icon={Settings2} iconClass="text-amber-500" title="Nueva regla de atributo" onClose={onCancel} />
      <NativeSelect value={slug} onChange={e => updateSlug(e.target.value)} className={RING_AMBER}>
        {slugs.map(s => <option key={s} value={s}>{catalog[s].name}</option>)}
      </NativeSelect>
      {info?.description && <p className="text-xs text-steel-400">{info.description}</p>}
      {schemaEntries.length > 0 && (
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <p className="text-[11px] font-medium text-steel-400">Parámetros</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {schemaEntries.map(([key, schema]) => {
              const fieldId = `attr-config-${slug}-${key}`
              const rangeHint =
                schema.min != null && schema.max != null ? `Entre ${schema.min} y ${schema.max}`
                  : schema.min != null ? `Mínimo ${schema.min}`
                    : schema.max != null ? `Máximo ${schema.max}` : null
              return (
                <div key={key} className="space-y-1">
                  <label htmlFor={fieldId} className="text-xs font-medium text-steel-600 block">{schema.label}</label>
                  {schema.type === 'select' ? (
                    <NativeSelect id={fieldId} value={config[key] ?? schema.default}
                      onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))} className={RING_AMBER}>
                      {schema.options.map(o => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <div className="space-y-0.5">
                      <input id={fieldId} type="number" min={schema.min} max={schema.max} value={config[key] ?? schema.default}
                        onChange={e => setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        className={`${FIELD} max-w-32 ${RING_AMBER} tabular-nums`} />
                      {rangeHint && <p className="text-[11px] text-steel-400">{rangeHint}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className={FORM_FOOTER}>
        <EvalModeField id="attr-standard-mode" mode={mode} onChange={setMode} label="Cómo usar esta regla"
          accentClass="text-amber-500" ringClass="focus:ring-amber-300" />
        <SubmitButton pending={creating} onClick={submit} className="bg-amber-600 hover:bg-amber-700">Crear regla</SubmitButton>
      </div>
    </div>
  )
}
