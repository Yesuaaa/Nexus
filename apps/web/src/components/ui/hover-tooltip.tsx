import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const sideClasses = {
  top: "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 translate-y-1 group-hover:translate-y-0 group-focus-visible:translate-y-0 group-focus-within:translate-y-0",
  right:
    "top-1/2 left-[calc(100%+10px)] -translate-y-1/2 translate-x-1 group-hover:translate-x-0 group-focus-visible:translate-x-0 group-focus-within:translate-x-0",
} as const

export function HoverTooltip({
  children,
  side = "top",
  className,
}: {
  children: ReactNode
  side?: keyof typeof sideClasses
  className?: string
}) {
  return (
    <span
      className={cn(
        "pointer-events-none invisible absolute z-50 w-max max-w-56 rounded-md border border-[#242d3d] bg-[#070f1f] px-2.5 py-1.5 text-center text-[11px] leading-none font-medium tracking-[0.01em] whitespace-nowrap text-[#fafafa] opacity-0 shadow-[0_6px_18px_rgb(7_15_31_/_18%)] transition-[opacity,transform,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none max-[767px]:hidden",
        sideClasses[side],
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}
