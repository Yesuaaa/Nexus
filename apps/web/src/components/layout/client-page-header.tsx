import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ClientPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: string
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-4 max-[560px]:flex-col",
        className,
      )}
    >
      <div>
        <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-[#2456b6] uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 mb-0 text-[clamp(23px,2.2vw,31px)] leading-tight font-bold tracking-[-0.035em] text-[#101d35]">
          {title}
        </h1>
        <p className="mt-1.5 mb-0 max-w-[760px] text-sm leading-relaxed text-[#587095]">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
