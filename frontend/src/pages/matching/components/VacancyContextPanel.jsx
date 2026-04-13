import { Briefcase, Clock, Users, MapPin } from 'lucide-react'
import SectionCard from '../../../components/common/SectionCard'
import { SECTION_LABELS } from '../../../lib/matching'

function nonEmptyLines(text) {
  return (text || '').split('\n').filter(Boolean)
}

export default function VacancyContextPanel({ vacancy, matching }) {
  if (!vacancy) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <Briefcase className="mx-auto mb-2 h-8 w-8 text-steel-200" />
        <p className="text-sm text-steel-400">Ejecuta un matching para ver el contexto de la vacante.</p>
      </div>
    )
  }

  const sections = vacancy.sections || []

  return (
    <div className="space-y-4">
      <SectionCard>
        <h3 className="text-sm font-bold text-steel-800">{vacancy.profile_name}</h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {vacancy.tipo_vacante && (
            <span className="rounded-full bg-steel-100 px-2.5 py-0.5 text-xs font-medium text-steel-600">
              {vacancy.tipo_vacante}
            </span>
          )}
          {vacancy.sucursal_id != null && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-steel-500">
              <MapPin className="h-3 w-3 shrink-0" />
              {vacancy.sucursal_nombre
                ? `${vacancy.sucursal_nombre} (#${vacancy.sucursal_id})`
                : `Sucursal #${vacancy.sucursal_id}`}
            </span>
          )}
        </div>

        {(matching?.candidates?.length > 0 || matching?.processing_time_seconds != null) && (
          <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-steel-400">
            {matching.candidates?.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {matching.candidates.length} candidatos
              </span>
            )}
            {matching.processing_time_seconds != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {matching.processing_time_seconds}s
              </span>
            )}
          </div>
        )}
      </SectionCard>

      {sections.length > 0 && (
        <SectionCard title="Requisitos">
          <div className="space-y-4">
            {sections.map((s, i) => (
              <div key={i}>
                <p className="mb-1 text-xs font-semibold text-steel-600">
                  {SECTION_LABELS[s.section_type] || s.section_type}
                </p>
                <div className="space-y-0.5 text-[11px] leading-relaxed text-steel-500">
                  {nonEmptyLines(s.content).map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
