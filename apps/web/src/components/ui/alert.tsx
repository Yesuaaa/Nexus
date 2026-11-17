import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

const alertVariants = {
  /** Tinted, bordered box, e.g. a failed save at the top of a form. */
  banner:
    "m-0 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]",
  /** Plain error text, e.g. under a control or beside an action. */
  text: "m-0 text-xs text-[#bc3649]",
} as const

/**
 * Error message announced to assistive tech (`role="alert"`). Render one per
 * region and only while there's an error. Use `as="div"` for block content
 * (lists, buttons) and `as="span"` inside phrasing content such as a label.
 */
export function Alert({
  variant = "banner",
  as: Element = "p",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  variant?: keyof typeof alertVariants
  as?: "p" | "div" | "span"
}) {
  return (
    <Element
      role="alert"
      className={cn(alertVariants[variant], className)}
      {...props}
    />
  )
}
