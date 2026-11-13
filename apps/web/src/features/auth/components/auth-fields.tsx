import { useRef, type FocusEvent } from "react"
import Link from "next/link"
import { FormInput } from "@/components/ui/form-input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import type { AuthCopy } from "../content/auth-copy"
import { fieldClass, labelClass } from "../styles/auth-styles"

export function FieldError({
  id,
  message,
  muted = false,
}: {
  id: string
  message?: string
  muted?: boolean
}) {
  return (
    <p
      id={`${id}-error`}
      className={`-mt-0.5 h-[1.4em] overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-[1.4] ${muted ? "text-[#6b7e9f]" : "text-[#a92d43]"}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </p>
  )
}

export function Brand() {
  return (
    <img
      className="mx-auto -mb-1 block h-[69px] w-[134px] object-contain"
      src="/auth/exp-logo.svg"
      alt="EXP"
      width={134}
      height={69}
      fetchPriority="high"
    />
  )
}

export function TextField({
  id,
  label,
  type,
  value,
  onChange,
  onBlur,
  onFocus,
  autoComplete,
  placeholder,
  error,
  minLength,
  maxLength,
}: {
  id: string
  label: string
  type: "text" | "tel" | "email"
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onFocus: () => void
  autoComplete: string
  placeholder: string
  error?: string
  minLength?: number
  maxLength?: number
}) {
  return (
    <div className={fieldClass}>
      <Label className={labelClass} htmlFor={id}>
        {label}
      </Label>
      <FormInput
        className="h-12"
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={id} message={error} />
    </div>
  )
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  onFocus,
  autoComplete,
  minLength,
  error,
  helperText,
  recoveryLink = false,
  copy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onFocus: () => void
  autoComplete: string
  minLength?: number
  error?: string
  helperText?: string
  recoveryLink?: boolean
  copy: AuthCopy
}) {
  const fieldRef = useRef<HTMLDivElement>(null)
  function handleFieldBlur(event: FocusEvent<HTMLDivElement>) {
    if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) {
      onBlur()
    }
  }
  return (
    <div className={fieldClass} ref={fieldRef} onBlur={handleFieldBlur}>
      <div className="flex items-baseline justify-between gap-3">
        <Label className={labelClass} htmlFor={id}>
          {label}
        </Label>
        {recoveryLink && (
          <Link
            className="text-[13px] font-semibold text-[#1452ad] no-underline hover:underline"
            href="/forgot-password"
          >
            {copy.forgotPassword}
          </Link>
        )}
      </div>
      <PasswordInput
        className="h-12"
        id={id}
        showLabel={`${copy.showPassword} ${label.toLowerCase()}`}
        hideLabel={`${copy.hidePassword} ${label.toLowerCase()}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        autoComplete={autoComplete}
        minLength={minLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? `${id}-error` : undefined}
        required
      />
      <FieldError
        id={id}
        message={error ?? helperText}
        muted={!error && Boolean(helperText)}
      />
    </div>
  )
}
