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
import { TimeInput } from "./time-input"
import { Button } from "./button"

type DateInputProps = Omit<ComponentProps<"input">, "type"> & {
  type?: "date" | "datetime-local"
  selectionMode?: "date" | "week"
  iconOnly?: boolean
  triggerLabel?: string
  onDateSelect?: (value: string) => void
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      type = "date",
      selectionMode = "date",
      iconOnly = false,
      triggerLabel,
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
    const [draft, setDraft] = useState("")
    const [internalValue, setInternalValue] = useState(
      String(props.defaultValue ?? ""),
    )
    const [position, setPosition] = useState({ left: 8, top: 8 })
    const titleId = useId()
    const selected = String(props.value ?? internalValue)
    const buttonTrigger = iconOnly || triggerLabel !== undefined
    const dateTime = type === "datetime-local"
    const pickerValue = dateTime ? draft : selected
    const validDraft =
      !!draft &&
      Number.isFinite(new Date(draft).getTime()) &&
      (!props.min || draft >= String(props.min)) &&
      (!props.max || draft <= String(props.max))
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
        if (dateTime) {
          const validSaved =
            !!selected &&
            Number.isFinite(new Date(selected).getTime()) &&
            (!props.min || selected >= String(props.min)) &&
            (!props.max || selected <= String(props.max))
          setDraft(
            validSaved
              ? selected
              : String(props.min || `${calendarToday()}T09:00`),
          )
        }
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
      if (buttonTrigger) setInternalValue(value)
      onDateSelect?.(value)
      if (close) {
        setOpen(false)
        if (!buttonTrigger) {
          element.focus()
          element.blur()
        }
      }
    }
    return (
      <Dialog.Root open={open} onOpenChange={changeOpen} modal={false}>
        <div
          ref={field}
          className={cn(
            "relative min-w-0",
            triggerLabel && "w-full",
            iconOnly && !triggerLabel && "size-[34px]",
          )}
        >
          <input
            {...props}
            ref={input}
            type={buttonTrigger ? "hidden" : type}
            hidden={buttonTrigger || props.hidden}
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
                buttonTrigger
                  ? props["aria-label"] || "Open calendar"
                  : "Open calendar"
              }
              title={buttonTrigger ? props.title : undefined}
              disabled={props.disabled || props.readOnly}
              className={cn(
                "grid cursor-pointer place-items-center text-[#667b9e] hover:text-[#203f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b] disabled:pointer-events-none disabled:opacity-40",
                triggerLabel
                  ? "flex h-[38px] w-full min-w-0 items-center gap-2 rounded-lg border border-[#dfe5ee] bg-background px-3 text-left text-xs hover:bg-[#eaf0fb]"
                  : iconOnly
                    ? "size-[34px] rounded-lg border border-[#dfe5ee] bg-background hover:bg-[#eaf0fb]"
                    : "absolute inset-y-0 right-0 w-9 rounded-r-lg",
              )}
            >
              <CalendarDays
                size={buttonTrigger ? 17 : 15}
                className="shrink-0"
                aria-hidden="true"
              />
              {triggerLabel && (
                <span
                  className={cn(
                    "min-w-0 truncate",
                    selected ? "text-foreground" : "text-[#9aa8bb]",
                  )}
                >
                  {triggerLabel}
                </span>
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
                if (buttonTrigger) trigger.current?.focus()
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
              {dateTime ? "Select date and time" : "Choose a date"}
            </Dialog.Title>
            <Calendar
              value={pickerValue}
              min={typeof props.min === "string" ? props.min : undefined}
              max={typeof props.max === "string" ? props.max : undefined}
              week={selectionMode === "week"}
              onSelect={(date) => {
                if (dateTime)
                  setDraft(`${date}T${draft.slice(11, 16) || "09:00"}`)
                else choose(date, true)
              }}
            />
            {dateTime && (
              <>
                <section
                  aria-label="Expiry time"
                  className="mt-3 space-y-3 border-t border-[#e8ebef] pt-3"
                >
                  <h3 className="m-0 text-xs font-semibold text-[#182235]">
                    Time
                  </h3>
                  <TimeInput
                    value={draft.slice(11, 16) || "09:00"}
                    onChange={(time) =>
                      setDraft(
                        `${draft.slice(0, 10) || calendarToday()}T${time}`,
                      )
                    }
                  />
                  <p className="m-0 text-[10px] text-[#8791a2]">
                    Time zone:{" "}
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                  {!validDraft && (
                    <p role="alert" className="m-0 text-xs text-[#bc3649]">
                      Choose a date and time within the allowed range.
                    </p>
                  )}
                </section>
                <div className="mt-3 flex justify-between gap-2 border-t border-[#e8ebef] pt-3">
                  <Dialog.Close asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                    >
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    disabled={!validDraft}
                    onClick={() => choose(draft, true)}
                    className="h-8 bg-[#203f8c] px-3 text-xs text-white hover:bg-[#172f70]"
                  >
                    Apply date &amp; time
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  },
)
DateInput.displayName = "DateInput"
