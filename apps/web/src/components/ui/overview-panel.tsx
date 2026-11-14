import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Plain building blocks for module overview pages: a row of key figures,
 * unboxed sections, a thin inline bar for table cells, and table styles.
 * Deliberately undecorated: hairline rules, one accent, warnings as text.
 */

export type Figure = {
  label: string
  value: string
  /** Short qualifier under the value, e.g. "2 without a head". */
  note?: string
  /** Colors the value and note (e.g. something needs action). */
  tone?: "warning" | "danger"
}

const figureTones = {
  warning: "text-[#a45b12]",
  danger: "text-[#b4234d]",
}

/**
 * Four key numbers in one contained grid under the page header: equal
 * columns divided by hairlines, one row at every width. On phones the
 * numbers shrink a step and notes are hidden (the value's tone still flags
 * anything that needs action).
 */
export function FiguresRow({
  items,
  loading,
  label,
}: {
  /** Designed for exactly four figures. */
  items: [Figure, Figure, Figure, Figure]
  loading: boolean
  label: string
}) {
  return (
    <dl
      aria-label={label}
      aria-busy={loading}
      className="m-0 mt-5 grid grid-cols-4 divide-x divide-[#eceef1] overflow-hidden rounded-xl border border-[#eceef1] max-[560px]:mt-4"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 px-4 py-3.5 max-[560px]:px-2.5 max-[560px]:py-3"
        >
          <dt className="truncate text-xs text-[#738096] max-[560px]:text-[11px]">
            {item.label}
          </dt>
          <dd className="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {loading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <>
                <span
                  className={cn(
                    "text-2xl leading-tight font-semibold tracking-[-0.02em] text-[#101d35] tabular-nums max-[560px]:text-xl",
                    item.tone && figureTones[item.tone],
                  )}
                >
                  {item.value}
                </span>
                {item.note && (
                  <span
                    className={cn(
                      "min-w-0 text-[11px] leading-tight text-[#8a94a6] max-[560px]:hidden",
                      item.tone && figureTones[item.tone],
                    )}
                  >
                    {item.note}
                  </span>
                )}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** An unboxed section: a small heading, an optional aside, the content. */
export function Section({
  title,
  aside,
  className,
  children,
}: {
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold text-[#101d35]">{title}</h2>
        {aside && <span className="text-xs text-[#8a94a6]">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/** Thin proportional bar for a table cell; the number sits beside it. */
export function InlineBar({
  value,
  max,
  label,
  className,
}: {
  value: number
  max: number
  label: string
  className?: string
}) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "block h-1 w-full overflow-hidden rounded-full bg-[#e8ecf1]",
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-[#284f9e]"
        style={{ width: `${percent}%` }}
      />
    </span>
  )
}

/** Placeholder rows while a table or list loads. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3 py-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton key={row} className="h-4 w-full" />
      ))}
    </div>
  )
}

export const tableClass = "w-full border-collapse text-xs"
export const headCellClass =
  "border-b border-[#e3e7ed] pb-2 text-left text-[11px] font-medium text-[#738096]"
export const cellClass = "border-b border-[#f0f2f5] py-2.5"
