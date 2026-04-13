import { Loader2 } from 'lucide-react'

export default function PageLoader({ label = 'Cargando...' }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-steel-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  )
}
