import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type StatStripItem = {
  label: string
  value: string
  caption: string
  /** Text color class for the caption (defaults to muted). */
  captionTone?: string
  icon: LucideIcon
  /** Background + text color classes for the icon chip. */
  tone: string
  /** Optional bar under the value, e.g. <ProgressMeter /> or <SegmentMeter />. */
  meter?: ReactNode
  /** Optional destination for a supported KPI drill-down. */
  href?: string
  /** Optional accessible name for a drill-down link. */
  ariaLabel?: string
  /** Marks only this item unavailable when sibling metrics are loaded. */
  unavailable?: boolean
}

/**
 * Headline metrics in a continuous strip. A 1px grid gap draws dividers at
 * every responsive column count.
 */
export function StatStrip({
  items,
  label,
  pending,
  unavailable,
  columns = 4,
  compact = false,
  wrapCaption = false,
  hoverEffects = true,
  className,
}: {
  items: StatStripItem[]
  label: string
  pending: boolean
  unavailable: boolean
  columns?: 2 | 4
  compact?: boolean
  wrapCaption?: boolean
  hoverEffects?: boolean
  className?: string
}) {
  return (
    <section
      aria-label={label}
      aria-busy={pending}
      className={cn(
        "grid min-w-0 gap-px overflow-hidden rounded-xl border border-[#dfe6eb] bg-[#eceef1] shadow-[0_1px_2px_rgb(30_55_80_/_4%)]",
        columns === 2
          ? "grid-cols-2 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1"
          : "grid-cols-4 max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const itemUnavailable = unavailable || item.unavailable === true
        const href = !pending && !itemUnavailable ? item.href : undefined
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "grid size-7 flex-none place-items-center rounded-lg",
                  item.tone,
                )}
                aria-hidden="true"
              >
                <Icon size={15} strokeWidth={1.9} />
              </span>
              <h2
                className={cn(
                  "m-0 truncate text-xs font-medium text-[#65718a]",
                  href && hoverEffects && "group-hover:text-[#203f8c]",
                )}
              >
                {item.label}
              </h2>
            </div>
            {pending ? (
              <div className="grid gap-2">
                <Skeleton className="h-7 w-14 rounded-md" />
                <Skeleton className="h-2.5 w-28" />
                <span className="sr-only">Loading {item.label}</span>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <p
                  className={cn(
                    "m-0 leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums",
                    compact ? "text-xl" : "text-[26px]",
                  )}
                >
                  {itemUnavailable ? "—" : item.value}
                </p>
                {!itemUnavailable && item.meter}
                <p
                  className={cn(
                    "m-0 text-[11px]",
                    compact || wrapCaption
                      ? "whitespace-normal leading-4"
                      : "truncate",
                    itemUnavailable
                      ? "text-[#65718a]"
                      : (item.captionTone ?? "text-[#65718a]"),
                  )}
                >
                  {itemUnavailable ? "Data unavailable" : item.caption}
                </p>
              </div>
            )}
          </>
        )
        const surfaceClass = cn(
          "flex min-h-full min-w-0 flex-col bg-background",
          compact ? "gap-2.5 px-4 py-3.5" : "gap-3 px-5 py-4",
        )
        return (
          <article key={item.label}>
            {href ? (
              <Link
                href={href}
                aria-label={
                  item.ariaLabel ??
                  `View ${item.label.toLowerCase()} projects in Project Workspace Management`
                }
                className={cn(
                  surfaceClass,
                  "group no-underline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#203f8c]",
                  hoverEffects && "hover:bg-[#f8fafb]",
                )}
              >
                {content}
              </Link>
            ) : (
              <div className={surfaceClass}>{content}</div>
            )}
          </article>
        )
      })}
    </section>
  )
}

/** Single-value progress bar for a StatStrip item. */
export function ProgressMeter({
  value,
  max,
  label,
  colorClass,
}: {
  value: number
  max: number
  label: string
  colorClass: string
}) {
  const percent = max <= 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div
      className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef1f4]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
          colorClass,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Stacked proportional bar (e.g. a status breakdown) for a StatStrip item. */
export function SegmentMeter({
  segments,
  label,
}: {
  segments: { label: string; value: number; colorClass: string }[]
  label: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return (
    <div
      className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[#eef1f4]"
      role="img"
      aria-label={`${label}: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`}
    >
      {total > 0 &&
        segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className={cn(
                "h-full transition-[flex-grow] duration-500 motion-reduce:transition-none",
                segment.colorClass,
              )}
              style={{ flexGrow: segment.value }}
            />
          ))}
    </div>
  )
}
