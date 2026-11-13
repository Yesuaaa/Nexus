"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { FormInput } from "@/components/ui/form-input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /**
   * What the toggle reveals, used in its accessible name:
   * "password" → "Show password" / "Hide password".
   */
  toggleLabel?: string
  showLabel?: string
  hideLabel?: string
  /** Classes for the positioning wrapper around the input and toggle. */
  containerClassName?: string
}

/**
 * Input with a trailing show/hide toggle. All input props are forwarded to the
 * underlying FormInput; `disabled` also disables the toggle.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      toggleLabel = "password",
      showLabel,
      hideLabel,
      containerClassName,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className={cn("group/password relative", containerClassName)}>
        <FormInput
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            className,
            "pr-10 group-focus-within/password:border-[#9aaecb] aria-invalid:group-focus-within/password:border-[#d64557] data-[validation-invalid=true]:group-focus-within/password:border-[#d64557]",
          )}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          aria-label={
            visible
              ? (hideLabel ?? `Hide ${toggleLabel}`)
              : (showLabel ?? `Show ${toggleLabel}`)
          }
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center rounded-r-lg text-[#65718a] outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
