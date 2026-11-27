import { useId, type ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { focusRing } from "@/components/layout/styles"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { cn } from "@/lib/utils"

/**
 * Shared building blocks for overview pages: titled panels and lists used
 * by Attendance, plus figures, unboxed sections, and inline table bars.
 */

/** A titled card for an overview page's secondary stats. */
export function OverviewPanel({
  title,
  description,
  action,
  titleClassName,
  variant = "default",
  className,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  titleClassName?: string
  variant?: "default" | "table" | "compact" | "highlight"
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 border",
        variant === "table" ? "rounded-lg" : "rounded-xl",
        variant === "table"
          ? "overflow-hidden border-[#e8ebef] bg-background"
          : "border-[#eceef1] p-5 max-[560px]:p-4",
        variant === "compact" &&
          "bg-background p-4 shadow-[0_1px_3px_rgb(30_55_80_/_4%)]",
        variant === "highlight" &&
          "border-[#cfdbed] bg-[#f2f6fc] p-4 shadow-[0_2px_8px_rgb(30_55_80_/_5%)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex justify-between gap-3",
          variant === "table"
            ? "min-h-[39px] items-center border-b border-[#dfe6eb] bg-[#e8eef2] px-4"
            : "items-start",
        )}
      >
        <div className="min-w-0">
          <h2
            id={headingId}
            className={cn(
              "m-0 font-semibold",
              variant === "table"
                ? "text-xs text-foreground"
                : "text-sm text-[#101d35]",
              titleClassName,
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 mb-0 text-xs leading-5 text-[#65718a]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div
        className={
          variant === "table" ? "p-4" : variant === "default" ? "mt-4" : "mt-3"
        }
      >
        {children}
      </div>
    </section>
  )
}

function ListRowsSkeleton({ meters = true }: { meters?: boolean }) {
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
  return <p className="m-0 text-xs leading-5 text-[#65718a]">{children}</p>
}

export type BreakdownRow = {
  id: string
  label: string
  value: number
  colorClass?: string
}

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
  if (loading) return <ListRowsSkeleton />
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
              <span className="shrink-0 text-[#65718a] tabular-nums">
                {row.value.toLocaleString("en-US")}
                <span className="sr-only"> {unit}</span>
                {share !== null && (
                  <span className="ml-1.5 text-[#65718a]">{share}%</span>
                )}
              </span>
            </div>
            <ProgressMeter
              value={row.value}
              max={max}
              label={`${row.label}: ${row.value} ${unit}`}
              colorClass={row.colorClass ?? colorClass}
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
  note?: string
  href?: string
  tone?: "warning" | "danger" | "muted"
}

const noteTones = {
  warning: "text-[#a45b12]",
  danger: "text-[#b4234d]",
  muted: "text-[#65718a]",
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
  if (loading) return <ListRowsSkeleton meters={false} />
  if (rows.length === 0)
    return (
      <p
        className={cn(
          "m-0 text-xs leading-5",
          emptyTone === "success" ? "text-[#25745b]" : "text-[#65718a]",
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
            className="flex min-w-0 items-center justify-between gap-3 text-xs"
          >
            {row.href ? (
              <Link
                href={row.href}
                className={cn(
                  "flex min-h-8 min-w-0 flex-1 items-center justify-between gap-3 rounded-md font-medium text-[#203f8c] underline-offset-2 hover:underline",
                  focusRing,
                )}
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {row.label}
                </span>
                <ArrowRight size={14} className="shrink-0" aria-hidden="true" />
              </Link>
            ) : (
              <span className="min-w-0 truncate font-medium text-[#182235]">
                {row.label}
              </span>
            )}
            {row.note && (
              <span className={cn("shrink-0", noteTones[row.tone ?? "muted"])}>
                {row.note}
              </span>
            )}
          </li>
        ))}
      </ul>
      {rows.length > shown.length && (
        <p className="mt-3 mb-0 text-[11px] text-[#65718a]">
          +{rows.length - shown.length} more
        </p>
      )}
    </>
  )
}

export type MiniStat = {
  label: string
  value: string
  hint?: string
  emphasis?: "attention"
}

/** A quiet row of secondary figures under the KPI strip. */
export function MiniStats({
  items,
  loading,
  label,
  columns = 4,
  variant = "boxed",
  wrapValues = false,
}: {
  items: MiniStat[]
  loading: boolean
  label: string
  columns?: 2 | 4
  variant?: "boxed" | "plain"
  wrapValues?: boolean
}) {
  const boxed = variant === "boxed"
  return (
    <dl
      aria-label={label}
      aria-busy={loading}
      className={cn(
        "m-0 grid",
        boxed &&
          "gap-px overflow-hidden rounded-xl border border-[#eceef1] bg-[#eceef1]",
        !boxed && "gap-x-6 gap-y-3",
        columns === 2
          ? "grid-cols-2 max-[480px]:grid-cols-1"
          : "grid-cols-4 max-[1050px]:grid-cols-2 max-[480px]:grid-cols-1",
      )}
    >
      {items.map((item) => {
        const attention = item.emphasis === "attention"
        return (
          <div
            key={item.label}
            className={cn(
              boxed ? "min-w-0 px-4 py-3" : "min-w-0",
              boxed && (attention ? "bg-[#fffaf0]" : "bg-background"),
            )}
          >
            <dt
              className={cn(
                "truncate text-[11px]",
                attention ? "text-[#805316]" : "text-[#65718a]",
              )}
            >
              {item.label}
            </dt>
            <dd
              className={cn(
                "m-0 mt-1 text-base font-semibold tabular-nums",
                wrapValues ? "[overflow-wrap:anywhere]" : "truncate",
                attention ? "text-[#805316]" : "text-[#101d35]",
              )}
            >
              {loading ? <Skeleton className="mt-1 h-4 w-12" /> : item.value}
            </dd>
            {item.hint && !loading && (
              <dd className="m-0 mt-0.5 truncate text-[11px] text-[#65718a]">
                {item.hint}
              </dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}

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
  /** Designed for a compact three- or four-figure summary. */
  items: [Figure, Figure, Figure] | [Figure, Figure, Figure, Figure]
  loading: boolean
  label: string
}) {
  return (
    <dl
      aria-label={label}
      aria-busy={loading}
      className={cn(
        "m-0 mt-5 grid divide-x divide-[#eceef1] overflow-hidden rounded-xl border border-[#eceef1] max-[560px]:mt-4",
        items.length === 3
          ? "grid-cols-3 max-[560px]:grid-cols-1 max-[560px]:divide-x-0 max-[560px]:divide-y"
          : "grid-cols-4",
      )}
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
  description,
  className,
  children,
}: {
  title: string
  aside?: ReactNode
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="m-0 text-sm font-semibold text-[#101d35]">
          {title}
        </h2>
        {aside && <span className="text-xs text-[#8a94a6]">{aside}</span>}
      </div>
      {description && (
        <p className="mt-0.5 mb-0 text-xs leading-5 text-[#65718a]">
          {description}
        </p>
      )}
      {description ? <div className="mt-4">{children}</div> : children}
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
