"use client"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"
import { ChevronLeft, ChevronRight } from "lucide-react"

type PageItem = number | "ellipsis-left" | "ellipsis-right"

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const visible = new Set<number>([1, totalPages])
  const start =
    currentPage <= 2
      ? 1
      : currentPage >= totalPages - 2
        ? totalPages - 3
        : currentPage - 1
  const end =
    currentPage <= 2
      ? 3
      : currentPage >= totalPages - 2
        ? totalPages
        : currentPage + 1

  for (let page = start; page <= end; page += 1) visible.add(page)

  const numbers = [...visible].sort((left, right) => left - right)
  const items: PageItem[] = []
  let previousPage = 0
  for (const number of numbers) {
    if (number - previousPage > 1) {
      items.push(previousPage === 1 ? "ellipsis-left" : "ellipsis-right")
    }
    items.push(number)
    previousPage = number
  }
  return items
}

const pageControlClass =
  "inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-md border text-[11px] font-medium leading-none whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none max-[560px]:size-9"
const navigationButtonClass =
  "inline-flex min-h-8 flex-none cursor-pointer items-center justify-center gap-1 rounded-md border border-[#d7e0ee] bg-background px-2 text-[11px] font-medium leading-none whitespace-nowrap text-[#24437e] transition-colors hover:enabled:bg-[#edf2fa] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none max-[560px]:min-h-9"

export function NumberedPagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  label = "Pages",
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  label?: string
}) {
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const pageItems = getPageItems(currentPage, totalPages)
  const quietButtonClass = cn(navigationButtonClass, focusRing)

  function goToPage(nextPage: number) {
    if (disabled || nextPage === currentPage) return
    onPageChange(nextPage)
  }

  return (
    <nav
      aria-label={label}
      className="flex w-fit max-w-full flex-wrap items-center justify-end gap-1"
    >
      <button
        type="button"
        className={quietButtonClass}
        aria-label="Previous page"
        disabled={disabled || currentPage <= 1}
        onClick={() => goToPage(currentPage - 1)}
      >
        <ChevronLeft aria-hidden="true" size={15} strokeWidth={1.8} />
        Prev
      </button>
      {pageItems.map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            className={cn(
              pageControlClass,
              item === currentPage
                ? "border-[#203f8c] bg-[#203f8c] text-white"
                : "border-[#d7e0ee] bg-background text-[#24437e] hover:enabled:bg-[#edf2fa]",
              focusRing,
            )}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
            disabled={disabled}
            onClick={() => goToPage(item)}
          >
            {item}
          </button>
        ) : (
          <span
            key={item}
            aria-hidden="true"
            className="grid size-8 flex-none place-items-center text-[12px] text-[#738096] max-[560px]:size-9"
          >
            …
          </span>
        ),
      )}
      <button
        type="button"
        className={quietButtonClass}
        aria-label="Next page"
        disabled={disabled || currentPage >= totalPages}
        onClick={() => goToPage(currentPage + 1)}
      >
        Next
        <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
      </button>
    </nav>
  )
}
