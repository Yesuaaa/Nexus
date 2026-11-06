"use client"

import { forwardRef, type ComponentProps } from "react"
import { cn } from "@/lib/utils"

type DateInputProps = Omit<ComponentProps<"input">, "type"> & {
  type?: "date" | "datetime-local"
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, type = "date", ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      type={type}
      className={cn(
        "w-full min-w-0 rounded-lg border border-[#dfe5ee] bg-background px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-[#d64557]",
        className,
      )}
    />
  ),
)
DateInput.displayName = "DateInput"
