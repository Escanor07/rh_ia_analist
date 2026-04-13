function scoreClass(s) {
  return s >= 70 ? 'bg-emerald-500' : s >= 45 ? 'bg-amber-400' : 'bg-red-400'
}

export default function ScoreBadge({ score, large = false }) {
  const s = score ?? 0
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-bold tabular-nums text-white ${scoreClass(s)} ${
        large ? 'h-12 w-12 text-xl' : 'h-9 w-9 text-sm'
      }`}
    >
      {s}
    </span>
  )
}
