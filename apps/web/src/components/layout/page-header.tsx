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
 * Standard page header: an `<h1>` and description on the left, optional
 * actions on the right, separated from the content by a full-bleed rule.
 * Pass `headingId` when other code focuses the heading (it also makes the
 * heading programmatically focusable).
 */
export function PageHeader({
  title,
  description,
  actions,
  headingId,
  tone = "admin",
  className,
}: {
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
  headingId?: string
  tone?: keyof typeof descriptionTones
  className?: string
}) {
  return (
    <header
      className={cn(
        "-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]",
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground"
        >
          {title}
        </h1>
        <p
          className={cn(
            "mt-[5px] mb-0 text-xs leading-[1.45]",
            descriptionTones[tone],
          )}
        >
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
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
      className={cn("flex-none cursor-pointer", focusRing, className)}
      {...props}
    />
  )
}
