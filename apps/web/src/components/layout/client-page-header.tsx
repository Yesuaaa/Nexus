import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const clientPageHeaderActionClass =
  "h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70] max-[560px]:h-11"

export function ClientPageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const actionContent = actions ?? children
  const legacyLayout = eyebrow == null

  return (
    <header
      className={cn(
        legacyLayout
          ? "-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4"
          : "flex items-start justify-between gap-4 max-[560px]:flex-col",
        className,
      )}
    >
      <div>
        {eyebrow != null && (
          <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-[#2456b6] uppercase">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            legacyLayout
              ? "m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]"
              : "mt-1 mb-0 text-[clamp(23px,2.2vw,31px)] leading-tight font-bold tracking-[-0.035em] text-[#101d35]",
          )}
        >
          {title}
        </h1>
        <p
          className={cn(
            legacyLayout
              ? "mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]"
              : "mt-1.5 mb-0 max-w-[760px] text-sm leading-relaxed text-[#587095]",
          )}
        >
          {description}
        </p>
      </div>
      {actionContent && (
        <div className="flex flex-wrap items-center gap-2">{actionContent}</div>
      )}
    </header>
  )
}
