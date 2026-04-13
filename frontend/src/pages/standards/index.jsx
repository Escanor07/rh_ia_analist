import { useEffect, useState } from 'react'
import {
  fetchStandards, fetchAttributeCatalog,
  createStandard, updateStandard, deleteStandard,
} from '../../lib/api'
import PageLoader from '../../components/common/PageLoader'
import MetricCard from '../../components/common/MetricCard'
import {
  Shield, FileText, SlidersHorizontal,
} from 'lucide-react'
import TextForm from './components/TextForm'
import AttributeForm from './components/AttributeForm'
import StandardsList from './components/StandardsList'
import { FILTER_TABS } from './constants'

export default function StandardsPage() {
  const [standards, setStandards] = useState([])
  const [catalog, setCatalog] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [tab, setTab] = useState('all')
  const [showForm, setShowForm] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([fetchStandards(), fetchAttributeCatalog()])
      setStandards(s.standards || [])
      setCatalog(c.catalog || {})
    }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = standards.filter(s => {
    if (tab === 'active')    return s.is_active
    if (tab === 'text')      return s.standard_type === 'text'
    if (tab === 'attribute') return s.standard_type === 'attribute'
    return true
  })

  const patch = async (id, payload) => {
    setSaving(id)
    try {
      const updated = await updateStandard(id, payload)
      setStandards(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s))
    }
    catch (e) { console.error(e) }
    finally { setSaving(null) }
  }

  const handleCreated = newStd => {
    setStandards(prev => [newStd, ...prev])
    setShowForm(null)
  }

  const handleDelete = async id => {
    if (!confirm('¿Eliminar este estándar?')) return
    setSaving(id)
    try { await deleteStandard(id); setStandards(prev => prev.filter(s => s.id !== id)) }
    catch (e) { console.error(e) }
    finally { setSaving(null) }
  }

  if (loading) return <PageLoader label="Cargando estándares…" />

  const active = standards.filter(s => s.is_active)
  const textC  = active.filter(s => s.standard_type === 'text').length
  const attrC  = active.filter(s => s.standard_type === 'attribute').length

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 xl:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-steel-900">Estándares Globales</h1>
          <p className="mt-1 text-sm text-steel-400">
            Administra los criterios que informan, aumentan puntaje o filtran candidatos en el matching.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button"
            onClick={() => setShowForm(showForm === 'text' ? null : 'text')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              showForm === 'text'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 bg-white text-steel-600 shadow-sm hover:bg-steel-50'
            }`}>
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo criterio</span>
          </button>
          <button type="button"
            onClick={() => setShowForm(showForm === 'attribute' ? null : 'attribute')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              showForm === 'attribute'
                ? 'bg-amber-600 text-white'
                : 'border border-slate-200 bg-white text-steel-600 shadow-sm hover:bg-steel-50'
            }`}>
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva regla</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard icon={Shield} label="Estándares activos"
          value={active.length} sub="Aplicando en matching" />
        <MetricCard icon={FileText} label="Criterios de texto"
          value={textC} sub="Informan o aumentan puntaje" tone="accent" />
        <MetricCard icon={SlidersHorizontal} label="Reglas por atributo"
          value={attrC} sub="Filtros o puntaje global" />
      </div>

      {showForm === 'text' && (
        <TextForm onCreated={handleCreated} onCancel={() => setShowForm(null)} />
      )}
      {showForm === 'attribute' && (
        <AttributeForm catalog={catalog} onCreated={handleCreated} onCancel={() => setShowForm(null)} />
      )}

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit shadow-sm">
        {FILTER_TABS.map(t => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-steel-800 text-white shadow-sm'
                : 'text-steel-500 hover:text-steel-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <StandardsList
        standards={filtered}
        saving={saving}
        onToggle={s => patch(s.id, { is_active: !s.is_active })}
        onModeChange={(id, mode) => patch(id, { eval_mode: mode })}
        onDelete={handleDelete}
      />
    </div>
  )
}
