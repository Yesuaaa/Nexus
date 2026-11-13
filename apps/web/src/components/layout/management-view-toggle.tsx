import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { focusRing } from "./styles"

type ManagementView = {
  value: boolean
  label: string
  icon: LucideIcon
}

export function ManagementViewToggle({
  active,
  views,
  ariaLabel,
  disabled = false,
  className,
  onChange,
}: {
  active: boolean
  views: readonly [ManagementView, ManagementView]
  ariaLabel: string
  disabled?: boolean
  className?: string
  onChange: (value: boolean) => void
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-none rounded-lg border border-[#e1e4ea] bg-[#f3f5f8] p-0.5",
        className,
      )}
    >
      {views.map(({ value, label, icon: Icon }) => {
        const selected = active === value
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex min-h-[30px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 px-3 text-xs font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
              selected
                ? "bg-background text-foreground shadow-[0_1px_2px_rgb(20_45_97_/_12%)]"
                : "bg-transparent text-[#65718a] hover:text-foreground",
              focusRing,
            )}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
