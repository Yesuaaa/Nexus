/**
 * A thin 100% bar for a part-to-whole split (e.g. employee status), with an
 * inline legend that carries each part's label, count, and share, so the
 * color never stands alone.
 */
export type ChartSegment = {
  id: string
  label: string
  value: number
  color: string
}

function share(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

export function CompositionBar({
  segments,
  label,
}: {
  segments: ChartSegment[]
  label: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const visible = segments.filter((segment) => segment.value > 0)
  return (
    <div>
      <div
        role="img"
        aria-label={`${label}: ${segments
          .map((s) => `${s.label} ${s.value} (${share(s.value, total)}%)`)
          .join(", ")}`}
        className="flex h-2 w-full gap-[2px]"
      >
        {total === 0 ? (
          <span className="h-full w-full rounded-full bg-[#e8ecf1]" />
        ) : (
          visible.map((segment) => (
            <span
              key={segment.id}
              title={`${segment.label}: ${segment.value} (${share(segment.value, total)}%)`}
              className="h-full min-w-[3px] basis-0 first:rounded-l-full last:rounded-r-full"
              style={{
                flexGrow: segment.value,
                backgroundColor: segment.color,
              }}
            />
          ))
        )}
      </div>
      <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-6 gap-y-1.5 p-0 text-xs">
        {segments.map((segment) => (
          <li key={segment.id} className="flex items-center gap-1.5">
            <span
              className="size-2 flex-none rounded-[2px]"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="text-[#3b4658]">{segment.label}</span>
            <span className="font-medium text-[#182235] tabular-nums">
              {segment.value}
            </span>
            <span className="text-[#8a94a6] tabular-nums">
              {share(segment.value, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A compact two-series monthly comparison for operational overview pages. */
export function MonthlyComparison({
  rows,
  series,
}: {
  rows: { label: string; first: number; second: number }[]
  series: [string, string]
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.first, row.second]))
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#65718a]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-sm bg-[#284f9e]" />
          {series[0]}
        </span>
        {series[1] && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-sm bg-[#a7bcdf]"
            />
            {series[1]}
          </span>
        )}
      </div>
      <div
        className="relative flex h-40 gap-2"
        role="img"
        aria-label={rows
          .map(
            (row) =>
              `${row.label}: ${series[0]} ${row.first}, ${series[1]} ${row.second}`,
          )
          .join("; ")}
      >
        <div
          aria-hidden="true"
          className="flex h-[calc(100%-20px)] flex-col justify-between text-[10px] tabular-nums text-[#65718a]"
        >
          <span>
            {new Intl.NumberFormat("en-PH", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(max)}
          </span>
          <span>0</span>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 bottom-5 flex flex-col justify-between"
        >
          <span className="border-t border-[#edf1f6]" />
          <span className="border-t border-dashed border-[#edf1f6]" />
          <span className="border-t border-[#dfe6eb]" />
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="relative flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
          >
            <div className="flex h-full items-end justify-center gap-1">
              <span
                className="w-3 rounded-t bg-[#284f9e]"
                style={{ height: `${(row.first / max) * 100}%` }}
              />
              <span
                className="w-3 rounded-t bg-[#a7bcdf]"
                style={{ height: `${(row.second / max) * 100}%` }}
              />
            </div>
            <span
              title={row.label}
              className="truncate text-center text-[10px] text-[#65718a]"
            >
              {row.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
