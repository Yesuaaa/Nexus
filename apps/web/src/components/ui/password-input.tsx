"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { focusRing } from "@/components/layout/styles"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /**
   * What the toggle reveals, used in its accessible name:
   * "password" → "Show password" / "Hide password".
   */
  toggleLabel?: string
  /** Classes for the positioning wrapper around the input and toggle. */
  containerClassName?: string
}

/**
 * Input with a trailing show/hide toggle. All input props are forwarded to the
 * underlying Input; `disabled` also disables the toggle.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      toggleLabel = "password",
      containerClassName,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className={cn("relative", containerClassName)}>
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(className, "pr-10")}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${toggleLabel}`}
          aria-pressed={visible}
          className={cn(
            "absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-[#65718a]",
            focusRing,
          )}
          disabled={disabled}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
