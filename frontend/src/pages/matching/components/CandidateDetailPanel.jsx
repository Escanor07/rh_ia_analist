import {
  Mail, Briefcase, GraduationCap, Wrench, Lock,
  FileText, Shield, Check, X,
} from 'lucide-react'
import SectionCard from '../../../components/common/SectionCard'
import ScoreBadge from './ScoreBadge'
import ProgressBar from './ProgressBar'
import { SECTION_CONFIG, scoreColor } from '../../../lib/matching'

const EDUCATION_LABELS = {
  none: 'Sin estudios', secundaria: 'Secundaria', preparatoria: 'Preparatoria',
  tecnico: 'Técnico', licenciatura: 'Licenciatura', maestria: 'Maestría', doctorado: 'Doctorado',
}
const STABILITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja', unknown: '—' }

function MetaChip({ icon: Icon, label, value }) {
  if (!value || value === '—') return null
  return (
    <div className="rounded-xl bg-steel-50 px-3 py-2.5 text-center">
      <div className="flex justify-center mb-1">
        <Icon className="h-4 w-4 text-steel-400" />
      </div>
      <p className="text-xs font-semibold text-steel-800">{value}</p>
      <p className="text-[10px] text-steel-400">{label}</p>
    </div>
  )
}

function nonEmptyLines(text) {
  return (text || '').split('\n').filter(Boolean)
}

export default function CandidateDetailPanel({ candidate }) {
  if (!candidate) return null

  const meta     = candidate.metadata || {}
  const sections = candidate.section_scores || []
  const chunks   = candidate.chunks_summary || {}
  const standards = candidate.standards_evaluation

  const educLabel   = EDUCATION_LABELS[meta.education_level] || meta.education_level || '—'
  const stability   = meta.stability_level || '—'

  const inVacancy   = sections.filter(s => s.in_vacancy)
  const fullScore   = candidate.full_profile_score ?? 0

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-steel-100">
            <span className="text-lg font-bold text-steel-500">
              {(candidate.candidate_name || '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-steel-900 truncate">{candidate.candidate_name || '—'}</h2>
              <ScoreBadge score={candidate.score} large />
              {candidate.applied_to_vacancy && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Aplicó a esta vacante
                </span>
              )}
            </div>
            {candidate.candidate_email && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-steel-400">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {candidate.candidate_email}
              </p>
            )}
            {candidate.candidate_status?.status_label && (
              <p className="mt-0.5 text-xs text-steel-400">
                {candidate.candidate_status.status_label}
                {candidate.candidate_status.status_vacante_id && (
                  <span className="ml-1 text-steel-300">
                    · #{candidate.candidate_status.status_vacante_id} {candidate.candidate_status.vacante_perfil}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-slate-100 pt-4">
          <MetaChip icon={Briefcase}    label="Experiencia" value={meta.experience_years != null ? `${meta.experience_years} años` : '—'} />
          <MetaChip icon={GraduationCap} label="Educación"   value={educLabel} />
          <MetaChip icon={Wrench}       label="Habilidades" value={meta.skills_count > 0 ? `${meta.skills_count} técnicas` : '—'} />
          <MetaChip icon={Lock}         label="Estabilidad"  value={STABILITY_LABELS[stability] || stability} />
        </div>
      </SectionCard>

      {inVacancy.length > 0 && (
        <SectionCard title="Afinidad por sección">
          <div className="space-y-3">
            {inVacancy.map(ss => {
              const cfg = SECTION_CONFIG[ss.section_type] || SECTION_CONFIG.general
              const I   = cfg.icon
              return (
                <div key={ss.section_type} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <I className={`h-3.5 w-3.5 ${cfg.c}`} />
                  </div>
                  <span className="w-24 shrink-0 text-xs text-steel-600 truncate">{ss.label}</span>
                  <div className="flex-1">
                    <ProgressBar value={ss.score_100} matched={ss.matched} label="" />
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-steel-50">
                <FileText className="h-3.5 w-3.5 text-steel-400" />
              </div>
              <span className="w-24 shrink-0 text-xs text-steel-600">Perfil general</span>
              <div className="flex-1">
                <ProgressBar value={fullScore} matched label="" />
              </div>
            </div>
          </div>

          {standards?.results?.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-steel-400">
                <Shield className="h-3.5 w-3.5" /> Estándares globales
                {!standards.all_filters_passed && (
                  <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
                    No pasa filtros
                  </span>
                )}
              </p>
              <div className="space-y-1.5">
                {standards.results.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-steel-600">{s.name}</span>
                    {s.mode === 'filter' ? (
                      s.passed
                        ? <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                        : <X    className="h-3.5 w-3.5 text-red-500" strokeWidth={2.5} />
                    ) : (
                      <span className={`font-bold tabular-nums ${scoreColor(s.score_100)}`}>{s.score_100}</span>
                    )}
                    {s.value && <span className="truncate text-steel-400 max-w-[90px]">{s.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {Object.entries(chunks).map(([type, content]) => {
        if (!content?.trim()) return null
        const cfg   = SECTION_CONFIG[type] || SECTION_CONFIG.general
        const I     = cfg.icon
        const isTags = type === 'skills' || type === 'languages'
        const items  = isTags
          ? content.split(/[,•\n]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 60)
          : null

        return (
          <SectionCard key={type}>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-steel-800">
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${cfg.bg}`}>
                <I className={`h-3.5 w-3.5 ${cfg.c}`} />
              </div>
              {cfg.l}
            </h4>
            {isTags && items ? (
              <div className="flex flex-wrap gap-1.5">
                {items.map((s, i) => (
                  <span key={i} className="rounded-lg border border-slate-100 bg-steel-50 px-2.5 py-1 text-xs font-medium text-steel-700">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {nonEmptyLines(content).map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-steel-600">{line}</p>
                ))}
              </div>
            )}
          </SectionCard>
        )
      })}
    </div>
  )
}
