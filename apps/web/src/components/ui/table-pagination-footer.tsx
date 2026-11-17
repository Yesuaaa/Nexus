"use client"

import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { cn } from "@/lib/utils"

/**
 * Footer under a paginated table: a live "Showing a–b of n" summary and the
 * page buttons (hidden while there are no results).
 */
export function TablePaginationFooter({
  from,
  to,
  total,
  page,
  totalPages,
  disabled = false,
  label,
  itemLabel,
  onPageChange,
  className,
}: {
  /** 1-based index of the first row shown (0 when there are no rows). */
  from: number
  /** 1-based index of the last row shown. */
  to: number
  total: number
  page: number
  totalPages: number
  disabled?: boolean
  /** Accessible name of the pagination nav, e.g. "Employee pages". */
  label: string
  /** Optional noun after the count, e.g. "services" → "… of 12 services". */
  itemLabel?: string
  onPageChange: (page: number) => void
  className?: string
}) {
  const summary = `Showing ${from}–${to} of ${total}${itemLabel ? ` ${itemLabel}` : ""}`

  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:pt-[14px]",
        className,
      )}
    >
      <span role="status" aria-live="polite" aria-atomic="true">
        {summary}
      </span>
      {total > 0 && (
        <NumberedPagination
          page={page}
          totalPages={Math.max(1, totalPages)}
          disabled={disabled}
          label={label}
          onPageChange={onPageChange}
        />
      )}
    </footer>
  )
}

/** Row range for a page: `{ from, to }` (both 0 when there are no rows). */
export function pageRange(page: number, pageSize: number, total: number) {
  if (total <= 0) return { from: 0, to: 0 }
  const from = Math.min((page - 1) * pageSize + 1, total)
  return { from, to: Math.min(page * pageSize, total) }
}
