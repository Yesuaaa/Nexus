import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const sizes = {
  /** Inline note inside a card or panel section. */
  sm: "px-4 py-5",
  /** Section-level placeholder. */
  md: "px-5 py-12",
  /** Page-level placeholder (e.g. an empty list or catalog). */
  lg: "min-h-64 px-6 py-14",
} as const

/**
 * Dashed placeholder box for an empty list, search, or section:
 * optional icon, title, description and action, centered.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
  as: Element = "div",
  headingLevel = 3,
  role,
  className,
  children,
}: {
  icon?: LucideIcon
  title?: ReactNode
  description?: ReactNode
  /** Button or link under the text. */
  action?: ReactNode
  size?: keyof typeof sizes
  as?: "div" | "section"
  headingLevel?: 2 | 3
  role?: "status" | "alert"
  className?: string
  /** Extra content under the description (rarely needed). */
  children?: ReactNode
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <Element
      role={role}
      className={cn(
        "grid place-content-center justify-items-center rounded-xl border border-dashed border-[#d8e0eb] text-center",
        sizes[size],
        className,
      )}
    >
      {Icon && (
        <Icon
          size={size === "sm" ? 20 : 26}
          className="mb-3 text-[#8293ad]"
          aria-hidden="true"
        />
      )}
      {title && (
        <Heading
          className={cn(
            "m-0 font-semibold text-foreground",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {title}
        </Heading>
      )}
      {description && (
        <p
          className={cn(
            "mb-0 max-w-md text-xs leading-5 text-[#738096]",
            title ? "mt-1" : "mt-0",
          )}
        >
          {description}
        </p>
      )}
      {children}
      {action && <div className="mt-4">{action}</div>}
    </Element>
  )
}
