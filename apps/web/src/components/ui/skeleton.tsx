import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded bg-[#e8eef2] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  )
}
