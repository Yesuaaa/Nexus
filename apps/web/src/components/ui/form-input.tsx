"use client"

import * as React from "react"

import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

const formInputClass =
  "h-10 w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm text-foreground placeholder:text-[#9aa8bb]"

const FormInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(formInputClass, focusRing, className)}
      ref={ref}
      {...props}
    />
  )
})
FormInput.displayName = "FormInput"

export { FormInput }
