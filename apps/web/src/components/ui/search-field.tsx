"use client"

import type { ComponentProps } from "react"
import { SearchIcon } from "@/components/layout/icons"
import { cn } from "@/lib/utils"
import { Input } from "./input"

interface SearchFieldProps extends Omit<
  ComponentProps<typeof Input>,
  "type" | "size"
> {
  label: string
  containerClassName?: string
  size?: "default" | "large"
}

export function SearchField({
  label,
  containerClassName,
  className,
  size = "default",
  ...props
}: SearchFieldProps) {
  const large = size === "large"
  return (
    <label
      className={cn(
        "flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[1050px]:w-[min(350px,100%)] max-[1050px]:flex-1 max-[560px]:w-full max-[560px]:flex-none",
        large &&
          "h-12 w-full gap-3 rounded-xl border-[#dce3ee] bg-background px-4 shadow-[0_1px_2px_rgb(31_55_94_/_4%)] max-[1050px]:w-full max-[1050px]:flex-none",
        containerClassName,
      )}
    >
      <SearchIcon
        width={large ? 19 : 17}
        height={large ? 19 : 17}
        className="flex-none"
      />
      <span className="sr-only">{label}</span>
      <Input
        type="search"
        className={cn(
          "h-auto w-full min-w-0 border-0 bg-transparent p-0 text-xs text-foreground shadow-none outline-none placeholder:text-[#8a9ab1] focus-visible:ring-0 md:text-xs",
          large &&
            "text-sm text-[#17233a] placeholder:text-[#8da0bd] md:text-sm",
          className,
        )}
        {...props}
      />
    </label>
  )
}
