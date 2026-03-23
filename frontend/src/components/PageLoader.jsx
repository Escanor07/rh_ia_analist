import { Loader2 } from 'lucide-react'

export default function PageLoader({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 gap-3 2xl:gap-4">
      <Loader2 className="w-8 h-8 2xl:w-10 2xl:h-10 animate-spin text-steel-400" aria-hidden />
      {label && <p className="text-sm 2xl:text-base text-steel-500">{label}</p>}
    </div>
  )
}
