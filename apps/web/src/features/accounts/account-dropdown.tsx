import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { CheckIcon } from "@/components/ui/check-icon"

export type AccountDropdownOption<T extends string> = {
  value: T
  label: string
}

export function AccountDropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  value: T
  options: AccountDropdownOption<T>[]
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    optionRefs.current[Math.max(0, selectedIndex)]?.focus()

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("pointerdown", closeOnOutsideClick)
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick)
  }, [open, selectedIndex])

  function choose(next: T) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const current = optionRefs.current.findIndex(
        (option) => option === document.activeElement,
      )
      const delta = event.key === "ArrowDown" ? 1 : -1
      const next = (current + delta + options.length) % options.length
      optionRefs.current[next]?.focus()
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      optionRefs.current[event.key === "Home" ? 0 : options.length - 1]?.focus()
    }
  }

  return (
    <div
      className={`account-dropdown ${className}`}
      data-open={open}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="account-dropdown-trigger"
        aria-label={`${label}: ${options[selectedIndex]?.label ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{options[selectedIndex]?.label}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="m2 4 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          className="account-dropdown-menu"
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false)
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className="account-dropdown-option"
              onClick={() => choose(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
