import {
  Briefcase,
  FileText,
  GraduationCap,
  Code,
  Languages,
  BookOpen,
} from 'lucide-react'

export const SECTION_CONFIG = {
  summary: { l: 'Perfil', icon: FileText, c: 'text-steel-500', bg: 'bg-steel-50' },
  experience: { l: 'Experiencia', icon: Briefcase, c: 'text-emerald-600', bg: 'bg-emerald-50' },
  education: { l: 'Formación', icon: GraduationCap, c: 'text-blue-600', bg: 'bg-blue-50' },
  skills: { l: 'Habilidades', icon: Code, c: 'text-violet-600', bg: 'bg-violet-50' },
  languages: { l: 'Idiomas', icon: Languages, c: 'text-amber-600', bg: 'bg-amber-50' },
  certifications: { l: 'Capacitación', icon: BookOpen, c: 'text-pink-600', bg: 'bg-pink-50' },
  general: { l: 'General', icon: FileText, c: 'text-steel-400', bg: 'bg-steel-50' },
}

export function scoreTextClass(s) {
  return s >= 70 ? 'text-emerald-600' : s >= 50 ? 'text-amber-500' : 'text-red-500'
}

export function scoreBarClass(s) {
  return s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-400' : 'bg-red-400'
}

export function normalizeWeights(raw) {
  const entries = Object.entries(raw)
  const sum = entries.reduce((a, [, v]) => a + v, 0)
  if (sum <= 0) return raw
  const normalized = {}
  for (const [k, v] of entries) normalized[k] = Math.round((v / sum) * 1000) / 1000
  return normalized
}
