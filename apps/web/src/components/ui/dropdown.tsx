"use client"

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import { CheckIcon } from "@/components/ui/check-icon"
import { dropdownItemClass, dropdownMenuClass } from "./dropdown-styles"
import { cn } from "@/lib/utils"
import { focusRing } from "@/components/layout/styles"

const OPEN_EVENT = "exclusive-menu-open"

/** Closes this menu whenever any other menu using the hook opens. */
export function useExclusiveMenu(open: boolean, close: () => void) {
  const id = useId()
  const closeRef = useRef(close)

  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (!open) return

    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))

    function onOtherOpened(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) closeRef.current()
    }

    window.addEventListener(OPEN_EVENT, onOtherOpened)
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpened)
  }, [open, id])
}

export type DropdownOption<T extends string> = {
  value: T
  label: string
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  align = "left",
  className = "",
  triggerClassName = "",
  menuClassName = "",
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  align?: "left" | "right"
  className?: string
  triggerClassName?: string
  menuClassName?: string
}) {
  const [open, setOpen] = useState(false)
  useExclusiveMenu(open, () => setOpen(false))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)

  // Position the portaled menu relative to the trigger.
  useLayoutEffect(() => {
    if (!open) return

    function update() {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      // The menu lives in <body>, so it no longer inherits the row's text
      // styles. Copy them from the trigger so size/font match.
      const cs = window.getComputedStyle(trigger)
      menu.style.fontFamily = cs.fontFamily
      menu.style.fontSize = cs.fontSize
      menu.style.lineHeight = cs.lineHeight
      menu.style.letterSpacing = cs.letterSpacing
      menu.style.color = cs.color
      menu.style.minWidth = `${trigger.offsetWidth}px`

      const t = trigger.getBoundingClientRect()
      const menuWidth = menu.offsetWidth
      const menuHeight = menu.offsetHeight
      const gap = 6
      const margin = 8

      let left = align === "right" ? t.right - menuWidth : t.left
      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - menuWidth - margin),
      )

      let top = t.bottom + gap
      const fitsBelow = top + menuHeight <= window.innerHeight - margin
      const fitsAbove = t.top - gap - menuHeight >= margin
      if (!fitsBelow && fitsAbove) top = t.top - gap - menuHeight

      menu.style.top = `${top}px`
      menu.style.left = `${left}px`
      menu.style.visibility = "visible"
    }

    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, align, options.length])

  useEffect(() => {
    if (!open) return
    optionRefs.current[Math.max(0, selectedIndex)]?.focus({
      preventScroll: true,
    })

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
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
    <div className={cn("relative min-w-0", className)} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "flex h-[38px] w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-[#dce3ed] bg-background pr-3 pl-[11px] text-left text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-55",
          focusRing,
          triggerClassName,
        )}
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
        <svg
          className="flex-none fill-none stroke-[#526686] stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          aria-hidden="true"
        >
          <path d="m2 4 4 4 4-4" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={cn(
              "fixed z-[1000] w-max max-w-[min(280px,calc(100vw-40px))]",
              dropdownMenuClass,
              menuClassName,
            )}
            style={{ top: 0, left: 0, visibility: "hidden" }}
            role="menu"
            aria-label={label}
            onKeyDown={handleMenuKeyDown}
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null
              if (
                !rootRef.current?.contains(next) &&
                !menuRef.current?.contains(next)
              ) {
                setOpen(false)
              }
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
                className={dropdownItemClass}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value && <CheckIcon />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
