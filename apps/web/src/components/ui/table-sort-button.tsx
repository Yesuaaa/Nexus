import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"

export function TableSortButton({
  label,
  direction,
  onClick,
}: {
  label: string
  direction: SortDirection | null
  onClick: () => void
}) {
  const Icon =
    direction === null ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown

  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-fit cursor-pointer items-center gap-1 rounded border-0 bg-transparent p-0 font-semibold text-inherit",
        focusRing,
      )}
      onClick={onClick}
      aria-label={`Sort by ${label}`}
    >
      {label} <Icon size={12} aria-hidden="true" />
    </button>
  )
}
