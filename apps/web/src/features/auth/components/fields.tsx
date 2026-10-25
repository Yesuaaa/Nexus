import { useRef, useState, type FocusEvent } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AuthCopy } from "../copy"
import { fieldClass, focusOutline, inputClass, labelClass } from "./styles"

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
      className={`-mt-0.5 min-h-[1lh] text-xs leading-[1.4] ${muted ? "text-[#6b7e9f]" : "text-[#a92d43]"}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </p>
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <img
      className={`mx-auto mb-0.5 block h-[69px] w-[134px] object-contain ${compact ? "[@media(min-width:851px)_and_(max-height:820px)]:h-10 [@media(min-width:851px)_and_(min-height:821px)_and_(max-height:1100px)]:h-[48px]" : ""}`}
      src="/auth/exp-logo.svg"
      alt="EXP"
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
  compact = false,
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
  compact?: boolean
}) {
  return (
    <div
      className={`${fieldClass} ${compact ? "[@media(min-width:851px)_and_(max-height:1100px)]:gap-0.5" : ""}`}
    >
      <Label
        className={`${labelClass} ${compact ? "[@media(min-width:851px)_and_(max-height:1100px)]:text-xs" : ""}`}
        htmlFor={id}
      >
        {label}
      </Label>
      <Input
        className={`${inputClass} ${compact ? "[@media(min-width:851px)_and_(max-height:820px)]:h-[38px] [@media(min-width:851px)_and_(max-height:1100px)]:text-[13px] [@media(min-width:851px)_and_(min-height:821px)_and_(max-height:1100px)]:h-[42px]" : ""}`}
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

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      {visible && (
        <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.7" />
      )}
    </svg>
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
  compact = false,
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
  compact?: boolean
  recoveryLink?: boolean
  copy: AuthCopy
}) {
  const [visible, setVisible] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null)
  function handleFieldBlur(event: FocusEvent<HTMLDivElement>) {
    if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) {
      onBlur()
    }
  }
  return (
    <div
      className={`${fieldClass} ${compact ? "[@media(min-width:851px)_and_(max-height:1100px)]:gap-0.5" : ""}`}
      ref={fieldRef}
      onBlur={handleFieldBlur}
    >
      <div className="flex items-baseline justify-between gap-3">
        <Label
          className={`${labelClass} ${compact ? "[@media(min-width:851px)_and_(max-height:1100px)]:text-xs" : ""}`}
          htmlFor={id}
        >
          {label}
        </Label>
        {recoveryLink && (
          <Link
            className="text-[13px] font-semibold text-[#1452ad] no-underline hover:underline"
            to="/forgot-password"
          >
            {copy.forgotPassword}
          </Link>
        )}
      </div>
      <div className="relative">
        <Input
          className={`${inputClass} pr-12 ${compact ? "[@media(min-width:851px)_and_(max-height:820px)]:h-[38px] [@media(min-width:851px)_and_(max-height:1100px)]:text-[13px] [@media(min-width:851px)_and_(min-height:821px)_and_(max-height:1100px)]:h-[42px]" : ""}`}
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          autoComplete={autoComplete}
          minLength={minLength}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? `${id}-error` : undefined}
          required
        />
        <Button
          className={`absolute top-0 right-0 grid h-[47px] w-11 place-items-center border-0 bg-transparent p-0 text-[#8b9fc0] shadow-none hover:bg-transparent hover:text-[#8b9fc0] [&_svg]:size-[19px] ${compact ? "[@media(min-width:851px)_and_(max-height:820px)]:h-[38px] [@media(min-width:851px)_and_(min-height:821px)_and_(max-height:1100px)]:h-[42px]" : ""} ${focusOutline}`}
          variant="outline"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? copy.hidePassword : copy.showPassword} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          <EyeIcon visible={visible} />
        </Button>
      </div>
      <FieldError
        id={id}
        message={error ?? helperText}
        muted={!error && Boolean(helperText)}
      />
    </div>
  )
}
