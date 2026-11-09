import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"

export function TableSortButton({
  label,
  direction,
  onClick,
  ariaLabel,
  className,
}: {
  label: string
  direction: SortDirection | null
  onClick: () => void
  ariaLabel?: string
  className?: string
}) {
  const Icon =
    direction === null ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown

  return (
    <button
      type="button"
      style={{ color: "#070f1f" }}
      className={cn(
        "inline-flex w-fit cursor-pointer items-center gap-1 rounded border-0 bg-transparent p-0 font-semibold text-inherit",
        focusRing,
        className,
      )}
      onClick={onClick}
      aria-label={ariaLabel ?? `Sort by ${label}`}
    >
      <span style={{ color: "#070f1f" }}>{label}</span>
      <Icon size={12} aria-hidden="true" style={{ color: "#070f1f" }} />
    </button>
  )
}
