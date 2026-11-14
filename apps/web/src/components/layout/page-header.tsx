import type { ComponentProps, ReactNode } from "react"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const descriptionTones = {
  /** Staff and admin pages. */
  admin: "text-[#738096]",
  /** Client-portal pages. */
  client: "text-[#52627a]",
} as const

/**
 * Classes that turn a header action into a round icon button on phones when
 * its PageHeader is in `mobileActions="icon"` mode. The label text stays in
 * the DOM (font-size 0), so the accessible name is still the full label.
 */
export const compactHeaderActionClass =
  "group-data-[compact]/header:max-[560px]:size-9 group-data-[compact]/header:max-[560px]:min-h-0 group-data-[compact]/header:max-[560px]:gap-0 group-data-[compact]/header:max-[560px]:rounded-full group-data-[compact]/header:max-[560px]:p-0 group-data-[compact]/header:max-[560px]:text-[0px]"

/**
 * Standard page header: an `<h1>` and description on the left, optional
 * actions on the right, separated from the content by a full-bleed rule.
 * Pass `headingId` when other code focuses the heading (it also makes the
 * heading programmatically focusable).
 *
 * On phones, `mobileActions="icon"` (default) keeps the title and actions on
 * one row (PageHeaderButton/PageHeaderLink shrink to icons) with the
 * description below; `"stack"` puts the actions under the text instead, for
 * actions that can't become icons (text-only buttons, date pickers).
 */
export function PageHeader({
  title,
  description,
  actions,
  headingId,
  tone = "admin",
  mobileActions = "icon",
  className,
}: {
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
  headingId?: string
  tone?: keyof typeof descriptionTones
  mobileActions?: "icon" | "stack"
  className?: string
}) {
  const compact = Boolean(actions) && mobileActions === "icon"
  return (
    <header
      data-compact={compact || undefined}
      className={cn(
        "group/header -mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:pb-[18px]",
        compact
          ? "max-[560px]:grid max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:items-center max-[560px]:gap-x-3 max-[560px]:gap-y-1.5"
          : "max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4",
        className,
      )}
    >
      <div className={cn("min-w-0", compact && "max-[560px]:contents")}>
        <h1
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className={cn(
            "m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground",
            compact && "max-[560px]:col-start-1 max-[560px]:row-start-1",
          )}
        >
          {title}
        </h1>
        <p
          className={cn(
            "mt-[5px] mb-0 text-xs leading-[1.45]",
            descriptionTones[tone],
            compact &&
              "max-[560px]:col-span-2 max-[560px]:row-start-2 max-[560px]:mt-0",
          )}
        >
          {description}
        </p>
      </div>
      {actions && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            compact &&
              "max-[560px]:col-start-2 max-[560px]:row-start-1 max-[560px]:flex-nowrap",
          )}
        >
          {actions}
        </div>
      )}
    </header>
  )
}

/** Primary navy action for a page header, e.g. "Create Employee". */
export function PageHeaderButton({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      variant="brand"
      size="header"
      className={cn(
        "flex-none cursor-pointer",
        focusRing,
        compactHeaderActionClass,
        className,
      )}
      {...props}
    />
  )
}
