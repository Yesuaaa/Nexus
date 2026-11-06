"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar, calendarToday } from "./calendar"
import { HoverTooltip } from "./hover-tooltip"

type DateInputProps = Omit<ComponentProps<"input">, "type"> & {
  type?: "date" | "datetime-local"
  selectionMode?: "date" | "week"
  iconOnly?: boolean
  onDateSelect?: (value: string) => void
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      type = "date",
      selectionMode = "date",
      iconOnly = false,
      onDateSelect,
      onChange,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const input = useRef<HTMLInputElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const field = useRef<HTMLDivElement>(null)
    const popup = useRef<HTMLDivElement>(null)
    const restoreFocus = useRef(true)
    const [open, setOpen] = useState(false)
    const [internalValue, setInternalValue] = useState(
      String(props.defaultValue ?? ""),
    )
    const [position, setPosition] = useState({ left: 8, top: 8 })
    const titleId = useId()
    const selected = String(props.value ?? internalValue)
    useImperativeHandle(ref, () => input.current!, [])
    const place = useCallback(() => {
      const rect = field.current?.getBoundingClientRect()
      if (!rect) return
      const height =
        popup.current?.offsetHeight || (type === "date" ? 370 : 430)
      const top =
        rect.bottom + 6 + height <= window.innerHeight - 8
          ? rect.bottom + 6
          : Math.max(8, rect.top - height - 6)
      setPosition({
        left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288)),
        top,
      })
    }, [type])
    useEffect(() => {
      if (!open) return
      const frame = requestAnimationFrame(place)
      window.addEventListener("resize", place)
      window.addEventListener("scroll", place, true)
      return () => {
        cancelAnimationFrame(frame)
        window.removeEventListener("resize", place)
        window.removeEventListener("scroll", place, true)
      }
    }, [open, place])
    function changeOpen(next: boolean) {
      if (props.disabled || props.readOnly) return
      if (next) {
        restoreFocus.current = true
        place()
      }
      setOpen(next)
    }
    function choose(value: string, close: boolean) {
      const element = input.current
      if (!element) return
      // Use the native setter so React observes the same change as typed input.
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      onDateSelect?.(value)
      if (close) {
        setOpen(false)
        if (!iconOnly) {
          element.focus()
          element.blur()
        }
      }
    }
    return (
      <Dialog.Root open={open} onOpenChange={changeOpen} modal={false}>
        <div
          ref={field}
          className={cn("relative min-w-0", iconOnly && "size-[34px]")}
        >
          <input
            {...props}
            ref={input}
            type={type}
            hidden={iconOnly || props.hidden}
            className={cn(
              "w-full min-w-0 rounded-lg border border-[#dfe5ee] bg-background py-2 pl-3 pr-9 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-[#d64557] [&::-webkit-calendar-picker-indicator]:hidden",
              className,
            )}
            onChange={(event) => {
              setInternalValue(event.currentTarget.value)
              onChange?.(event)
            }}
            onClick={(event) => {
              onClick?.(event)
              if (!event.defaultPrevented) {
                event.preventDefault()
                changeOpen(true)
              }
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event)
              if (
                !event.defaultPrevented &&
                ((event.altKey && event.key === "ArrowDown") ||
                  event.key === " ")
              ) {
                event.preventDefault()
                changeOpen(true)
              }
            }}
          />
          <Dialog.Trigger asChild>
            <button
              ref={trigger}
              type="button"
              aria-label={
                iconOnly
                  ? props["aria-label"] || "Open calendar"
                  : "Open calendar"
              }
              title={iconOnly ? props.title : undefined}
              disabled={props.disabled || props.readOnly}
              className={cn(
                "grid cursor-pointer place-items-center text-[#667b9e] hover:text-[#203f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b] disabled:pointer-events-none disabled:opacity-40",
                iconOnly
                  ? "size-[34px] rounded-lg border border-[#dfe5ee] bg-background hover:bg-[#eaf0fb]"
                  : "absolute inset-y-0 right-0 w-9 rounded-r-lg",
              )}
            >
              <CalendarDays size={iconOnly ? 17 : 15} aria-hidden="true" />
              {iconOnly && (
                <HoverTooltip>
                  {props.title || props["aria-label"] || "Open calendar"}
                </HoverTooltip>
              )}
            </button>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Content
            ref={popup}
            aria-labelledby={titleId}
            aria-describedby={undefined}
            style={position}
            className="fixed z-[150] max-h-[calc(100dvh-16px)] w-[280px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#dfe5ee] bg-white p-4 text-[#182235] shadow-[0_12px_36px_rgb(18_36_73_/_16%)] outline-none"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              popup.current
                ?.querySelector<HTMLButtonElement>("[data-calendar-focus=true]")
                ?.focus()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              if (restoreFocus.current) {
                if (iconOnly) trigger.current?.focus()
                else input.current?.focus()
              }
            }}
            onInteractOutside={(event) => {
              if (
                event.target instanceof Node &&
                !field.current?.contains(event.target)
              )
                restoreFocus.current = false
            }}
          >
            <Dialog.Title id={titleId} className="sr-only">
              Choose a date
            </Dialog.Title>
            <Calendar
              value={selected}
              min={typeof props.min === "string" ? props.min : undefined}
              max={typeof props.max === "string" ? props.max : undefined}
              week={selectionMode === "week"}
              onSelect={(date) =>
                choose(
                  type === "date"
                    ? date
                    : `${date}T${selected.slice(11, 16) || "09:00"}`,
                  type === "date",
                )
              }
            />
            {type === "datetime-local" && (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e8ebef] pt-3">
                <label className="flex items-center gap-2 text-xs text-[#52627a]">
                  Time
                  <input
                    type="time"
                    aria-label="Time"
                    value={selected.slice(11, 16) || "09:00"}
                    className="min-w-0 rounded-lg border border-[#dfe5ee] bg-white px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-[#294a9b]"
                    onChange={(event) => {
                      if (event.target.value)
                        choose(
                          `${selected.slice(0, 10) || calendarToday()}T${event.target.value}`,
                          false,
                        )
                    }}
                  />
                </label>
                <Dialog.Close className="rounded-lg bg-[#203f8c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#172f70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]">
                  Done
                </Dialog.Close>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  },
)
DateInput.displayName = "DateInput"
