export const MODE_LABELS = { score: 'Puntuación', filter: 'Filtro', informational: 'Informativo' }
export const MODE_ENTRIES = Object.entries(MODE_LABELS)

export const MODE_TONE = {
  score:         'border-blue-200 bg-blue-50 text-blue-700',
  filter:        'border-amber-200 bg-amber-50 text-amber-700',
  informational: 'border-slate-200 bg-slate-50 text-steel-500',
}

export const ATTR_SUMMARY = {
  stability:       c => `Estabilidad mínima: ${c?.min_level || 'media'}`,
  min_experience:  c => `Experiencia mínima: ${c?.min_years || 2} años`,
  min_education:   c => `Educación mínima: ${c?.min_level || 'preparatoria'}`,
  cv_completeness: c => `Secciones mínimas: ${c?.min_sections || 4}/6`,
}

export function formatAttr(slug, cfg) {
  return ATTR_SUMMARY[slug]?.(cfg) ?? JSON.stringify(cfg)
}

export const defaultFromSchema = s => Object.fromEntries(Object.entries(s || {}).map(([k, v]) => [k, v.default]))

export const FILTER_TABS = [
  { label: 'Todos',    value: 'all' },
  { label: 'Activos',  value: 'active' },
  { label: 'Texto',    value: 'text' },
  { label: 'Atributo', value: 'attribute' },
]
