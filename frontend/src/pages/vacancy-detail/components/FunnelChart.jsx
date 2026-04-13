export default function FunnelChart({ conversion }) {
  const max = conversion[0]?.count || 1
  return (
    <div className="flex flex-col items-center gap-[3px] w-full max-w-xl mx-auto py-0.5">
      {conversion.map((s, i) => {
        const widthPct = Math.round((s.count / max) * 100)
        return (
          <div key={i} className="w-full flex justify-center min-w-0">
            <div style={{ width: `${widthPct}%` }} className="min-w-0">
              <div
                className="w-full py-1.5 px-2 text-center rounded-sm text-white text-[10px] sm:text-[11px] font-semibold leading-tight"
                style={{ background: `rgba(45,62,81,${0.92 - i * 0.07})` }}
              >
                <span className="block truncate">{s.stage}</span>
                <span className="font-bold tabular-nums"> {s.count}</span>
                <span className="font-normal text-white/75"> ({s.pct}%)</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
