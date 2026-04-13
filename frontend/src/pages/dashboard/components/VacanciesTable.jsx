import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import SectionCard from '../../../components/common/SectionCard'

const PER_PAGE = 12

function statusStyle(value = '') {
  const v = value.toLowerCase()
  if (v.includes('proceso') || v.includes('filtrando') || v.includes('entrevista'))
    return 'text-sky-700 bg-sky-50'
  if (v.includes('final') || v.includes('finalista') || v.includes('propuesta') || v.includes('ingreso'))
    return 'text-indigo-700 bg-indigo-50'
  if (v.includes('contratad') || v.includes('aprobado'))
    return 'text-emerald-700 bg-emerald-50'
  if (v.includes('finaliz') || v.includes('cerrad') || v.includes('cancel'))
    return 'text-steel-500 bg-steel-50'
  if (v.includes('autorizar') || v.includes('publicand'))
    return 'text-amber-700 bg-amber-50'
  return 'text-steel-500 bg-steel-50'
}

function StatusPill({ value }) {
  if (!value) return <span className="text-steel-300 text-xs">—</span>
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${statusStyle(value)}`}>
      {value}
    </span>
  )
}

export default function VacanciesTable({ vacancies = [] }) {
  const nav      = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vacancies
    return vacancies.filter(v =>
      [v.perfil, v.status, String(v.vacante_id ?? '')]
        .some(f => f?.toLowerCase().includes(q))
    )
  }, [vacancies, search])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const rows        = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  return (
    <SectionCard
      title="Vacantes"
      description={`${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`}
      action={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-300 pointer-events-none" />
          <input type="search" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar vacante…"
            className="h-8 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-steel-800 placeholder:text-steel-300 outline-none focus:border-steel-400" />
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-steel-400">
          {search ? `Sin resultados para "${search}"` : 'Sin vacantes disponibles.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    ['Vacante', 'pl-5 pr-4 text-left'],
                    ['Estado', 'pr-4 text-left'],
                    ['Candidatos', 'pr-4 text-right'],
                    ['Descartados', 'pr-4 text-right'],
                    ['Fecha', 'pr-5 text-right'],
                  ].map(([h, cls]) => (
                    <th key={h}
                      className={`pb-2.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-steel-400 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((v, i) => (
                  <tr key={`${v.vacante_id}-${i}`}
                    onClick={() => v.vacante_id && nav(`/vacancy/${v.vacante_id}`)}
                    className="group cursor-pointer transition-colors hover:bg-slate-50/80">
                    <td className="py-3 pl-5 pr-4">
                      <p className="font-medium text-steel-900 group-hover:text-steel-700 truncate max-w-[200px]">
                        {v.perfil || '—'}
                      </p>
                      <p className="text-[11px] text-steel-400">#{v.vacante_id}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill value={v.status} />
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-steel-600 text-xs">
                      {v.candidatos ?? '—'}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-xs">
                      <span className={v.descartados > 0 ? 'text-red-400' : 'text-steel-400'}>
                        {v.descartados ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-5 text-right text-xs text-steel-400 tabular-nums">
                      {v.fecha ? v.fecha.slice(0, 10) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-steel-400">
              <span>Pág. {currentPage} de {totalPages} · {filtered.length} registros</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={currentPage === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={currentPage === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}
