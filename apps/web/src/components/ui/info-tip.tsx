import { useId, type ReactNode } from "react"
import { Info } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

/**
 * Small "i" button that reveals `children` in a tooltip on hover or
 * keyboard focus. The tooltip is linked via aria-describedby.
 */
export function InfoTip({
  label,
  children,
}: {
  /** Accessible name for the icon button, e.g. "About QA Team". */
  label: string
  children: ReactNode
}) {
  const id = useId()

  return (
    <span className="group/info relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className={cn(
          "grid size-5 cursor-help place-items-center rounded-full text-[#738096] transition-colors hover:text-foreground motion-reduce:transition-none",
          focusRing,
        )}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-1/2 z-30 mt-1.5 w-max max-w-64 -translate-x-1/2 translate-y-0.5 rounded-md bg-[#0f1a2e] px-2.5 py-1.5 text-[11px] leading-snug font-normal tracking-normal text-white opacity-0 shadow-[0_6px_18px_rgb(7_15_31_/_18%)] transition-[opacity,transform,visibility] duration-150 group-focus-within/info:visible group-focus-within/info:translate-y-0 group-focus-within/info:opacity-100 group-hover/info:visible group-hover/info:translate-y-0 group-hover/info:opacity-100 motion-reduce:transition-none"
      >
        {children}
      </span>
    </span>
  )
}
