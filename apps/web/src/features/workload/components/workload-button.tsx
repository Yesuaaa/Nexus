import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function WorkloadButton({
  variant,
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      className={cn(
        "h-[34px] rounded-lg px-[13px] text-xs font-semibold shadow-none",
        variant === undefined || variant === "default"
          ? "bg-[#203f8c] text-white hover:bg-[#172f70]"
          : variant === "outline"
            ? "border-[#d7e0ee] bg-background text-[#24437e] hover:bg-[#f1f5fc]"
            : "",
        className,
      )}
      {...props}
    />
  )
}
