import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Pill({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-block w-fit max-w-full truncate rounded bg-[#dbeafe] px-1.5 py-0.5 text-[10px] font-medium text-[#24437e]",
        className,
      )}
      {...props}
    />
  )
}
