"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { formControlClass } from "./form-control-styles"

const FormInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      data-slot="form-input"
      type={type}
      className={cn(formControlClass, "h-10", className)}
      ref={ref}
      {...props}
    />
  )
})
FormInput.displayName = "FormInput"

const FormTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    data-slot="form-textarea"
    className={cn(formControlClass, "min-h-24 resize-y", className)}
    ref={ref}
    {...props}
  />
))
FormTextarea.displayName = "FormTextarea"

export { FormInput, FormTextarea }
