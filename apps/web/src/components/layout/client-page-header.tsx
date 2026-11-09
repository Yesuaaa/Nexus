import type { ReactNode } from "react"

export const clientPageHeaderActionClass =
  "h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70] max-[560px]:h-11"

export function ClientPageHeader({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4">
      <div>
        <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
  )
}
