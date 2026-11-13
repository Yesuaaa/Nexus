import { useId, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { cn } from "@/lib/utils"

/**
 * Building blocks for module overview pages: a titled panel, a ranked
 * single-hue bar list (value always visible beside each bar, so the list
 * doubles as its own table view), a plain item list, and a row of
 * at-a-glance figures.
 */

/** A titled card for an overview page's secondary stats. */
export function OverviewPanel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 rounded-xl border border-[#eceef1] p-5 max-[560px]:p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="m-0 text-sm font-semibold text-[#101d35]"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 mb-0 text-xs leading-5 text-[#8a94a6]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function RowsSkeleton({ meters = true }: { meters?: boolean }) {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid gap-2">
          <Skeleton className="h-3 w-2/5" />
          {meters && <Skeleton className="h-1.5 w-full" />}
        </div>
      ))}
    </div>
  )
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="m-0 text-xs leading-5 text-[#8a94a6]">{children}</p>
}

export type BreakdownRow = { id: string; label: string; value: number }

/**
 * Ranked rows with a proportional meter. Without `total` bars are relative
 * to the largest row; with it, each bar is a share of the total and the
 * percentage is shown beside the value.
 */
export function BreakdownList({
  rows,
  loading,
  unit,
  empty,
  total,
  colorClass = "bg-[#284f9e]",
}: {
  rows: BreakdownRow[]
  loading: boolean
  /** Plural noun read after each value, e.g. "employees". */
  unit: string
  empty: ReactNode
  total?: number
  colorClass?: string
}) {
  if (loading) return <RowsSkeleton />
  if (rows.length === 0) return <EmptyText>{empty}</EmptyText>
  const max = total ?? Math.max(...rows.map((row) => row.value))
  return (
    <ul className="m-0 grid list-none gap-3.5 p-0">
      {rows.map((row) => {
        const share =
          total && total > 0 ? Math.round((row.value / total) * 100) : null
        return (
          <li key={row.id} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-medium text-[#182235]">
                {row.label}
              </span>
              <span className="shrink-0 text-[#738096] tabular-nums">
                {row.value.toLocaleString("en-US")}
                <span className="sr-only"> {unit}</span>
                {share !== null && (
                  <span className="ml-1.5 text-[#a3acba]">{share}%</span>
                )}
              </span>
            </div>
            <ProgressMeter
              value={row.value}
              max={max}
              label={`${row.label}: ${row.value} ${unit}`}
              colorClass={colorClass}
            />
          </li>
        )
      })}
    </ul>
  )
}

export type ItemRow = {
  id: string
  label: string
  note: string
  tone?: "warning" | "danger" | "muted"
}

const noteTones = {
  warning: "text-[#a45b12]",
  danger: "text-[#b4234d]",
  muted: "text-[#738096]",
}

/** Named items with a short status note, e.g. departments needing a head. */
export function ItemList({
  rows,
  loading,
  empty,
  emptyTone = "muted",
  limit = 8,
}: {
  rows: ItemRow[]
  loading: boolean
  empty: ReactNode
  emptyTone?: "success" | "muted"
  limit?: number
}) {
  if (loading) return <RowsSkeleton meters={false} />
  if (rows.length === 0)
    return (
      <p
        className={cn(
          "m-0 text-xs leading-5",
          emptyTone === "success" ? "text-[#25745b]" : "text-[#8a94a6]",
        )}
      >
        {empty}
      </p>
    )
  const shown = rows.slice(0, limit)
  return (
    <>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {shown.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="min-w-0 truncate font-medium text-[#182235]">
              {row.label}
            </span>
            <span className={cn("shrink-0", noteTones[row.tone ?? "muted"])}>
              {row.note}
            </span>
          </li>
        ))}
      </ul>
      {rows.length > shown.length && (
        <p className="mt-3 mb-0 text-[11px] text-[#8a94a6]">
          +{rows.length - shown.length} more
        </p>
      )}
    </>
  )
}

export type MiniStat = { label: string; value: string; hint?: string }

/** A quiet row of secondary figures under the KPI strip. */
export function MiniStats({
  items,
  loading,
  label,
}: {
  items: MiniStat[]
  loading: boolean
  label: string
}) {
  return (
    <dl
      aria-label={label}
      aria-busy={loading}
      className="m-0 grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-[#eceef1] bg-[#eceef1] max-[1050px]:grid-cols-2 max-[480px]:grid-cols-1"
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-background px-4 py-3">
          <dt className="truncate text-[11px] text-[#8a94a6]">{item.label}</dt>
          <dd className="m-0 mt-1 truncate text-base font-semibold text-[#101d35] tabular-nums">
            {loading ? <Skeleton className="mt-1 h-4 w-12" /> : item.value}
          </dd>
          {item.hint && !loading && (
            <dd className="m-0 mt-0.5 truncate text-[11px] text-[#738096]">
              {item.hint}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}
