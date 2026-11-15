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
