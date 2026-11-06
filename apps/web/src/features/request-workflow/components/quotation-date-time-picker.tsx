"use client"

import { useRef, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { workflowInput } from "./workflow-primitives"

export function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

const dateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
const pad = (value: number) => String(value).padStart(2, "0")
const selectClass =
  "h-10 min-w-0 rounded-lg border-[#d6dfec] bg-white text-xs shadow-none focus:ring-[#294a9b]/20"

function TimeSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a]">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className={selectClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[180]">
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export function QuotationDateTimePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [focusedDay, setFocusedDay] = useState("")
  const calendar = useRef<HTMLDivElement>(null)
  const now = new Date()
  const minDate = localDateTime(now).slice(0, 10)
  const maxDate = localDateTime(
    new Date(now.getTime() + 366 * 86_400_000),
  ).slice(0, 10)
  const selected = draft ? new Date(draft) : null
  const saved = value ? new Date(value) : null
  const hour24 = selected?.getHours() ?? 17
  const minute = pad(selected?.getMinutes() ?? 0)
  const period = hour24 >= 12 ? "PM" : "AM"
  const hour12 = pad(hour24 % 12 || 12)
  const valid = Boolean(
    selected &&
    selected.getTime() > now.getTime() &&
    selected.getTime() <= now.getTime() + 366 * 86_400_000,
  )
  const offset = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Math.ceil((offset + days) / 7) * 7
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  function moveMonth(amount: number) {
    const next = new Date(year, month + amount, 1)
    setMonth(next.getMonth())
    setYear(next.getFullYear())
    const first = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`
    setFocusedDay(first < minDate ? minDate : first)
  }
  function changeTime(hour: string, minutes: string, meridiem: string) {
    const date = draft.slice(0, 10) || minDate
    setDraft(
      `${date}T${pad((Number(hour) % 12) + (meridiem === "PM" ? 12 : 0))}:${minutes}`,
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const initial =
            value &&
            new Date(value).getTime() > Date.now() &&
            new Date(value).getTime() <= Date.now() + 366 * 86_400_000
              ? value
              : `${localDateTime(new Date(Date.now() + 7 * 86_400_000)).slice(0, 10)}T17:00`
          const date = new Date(initial)
          setDraft(initial)
          setMonth(date.getMonth())
          setYear(date.getFullYear())
          setFocusedDay(initial.slice(0, 10))
        }
        setOpen(next)
      }}
    >
      <input type="hidden" name="validUntil" value={value} />
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Valid until"
          data-quotation-validity
          className={cn(
            workflowInput,
            "h-[38px] justify-start gap-2 px-2 py-1.5 text-left font-normal shadow-none hover:bg-[#f6f8fc] @[260px]:px-3",
          )}
        >
          <CalendarDays
            size={16}
            className="shrink-0 text-[#738096]"
            aria-hidden="true"
          />
          {saved ? (
            <span className="grid min-w-0 gap-0.5 leading-none">
              <span className="truncate text-[11px] font-medium">
                {dateLabel(saved)}
              </span>
              <span className="text-[10px] text-[#738096]">
                {saved.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </span>
          ) : (
            <span className="min-w-0 truncate text-[11px] text-[#9aa8bb]">
              Select date & time
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[170] bg-[#14213d]/35"
        className="z-[171] flex max-h-[calc(100dvh-24px)] w-[min(390px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-y-auto rounded-[13px] border-[#dedede] bg-white p-0 shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5">
          <div>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Select date and time
            </DialogTitle>
            <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
              Set the deadline for accepting this quotation.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-label="Close date and time picker"
            className="size-8 shrink-0 p-0"
            onClick={() => setOpen(false)}
          >
            <X size={15} />
          </Button>
        </header>
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label="Previous month"
              className="size-9 shrink-0 p-0"
              disabled={year === now.getFullYear() && month <= now.getMonth()}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <p
              aria-live="polite"
              className="m-0 flex-1 text-center text-sm font-semibold text-[#182235]"
            >
              {monthLabel}
            </p>
            <Button
              type="button"
              variant="outline"
              aria-label="Next month"
              className="size-9 shrink-0 p-0"
              disabled={`${year}-${pad(month + 1)}` >= maxDate.slice(0, 7)}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <div>
            <div
              aria-hidden="true"
              className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold text-[#8791a2]"
            >
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div
              ref={calendar}
              role="grid"
              aria-label={monthLabel}
              className="grid gap-1"
            >
              {Array.from({ length: cells / 7 }, (_, row) => (
                <div key={row} role="row" className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, column) => {
                    const day = row * 7 + column - offset + 1
                    if (day < 1 || day > days)
                      return <span key={column} role="gridcell" />
                    const date = `${year}-${pad(month + 1)}-${pad(day)}`
                    const disabled = date < minDate || date > maxDate
                    const isSelected = draft.startsWith(date)
                    return (
                      <button
                        key={column}
                        type="button"
                        role="gridcell"
                        data-day={date}
                        aria-selected={isSelected}
                        aria-current={date === minDate ? "date" : undefined}
                        aria-label={new Date(
                          year,
                          month,
                          day,
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                        disabled={disabled}
                        tabIndex={focusedDay === date ? 0 : -1}
                        onFocus={() => setFocusedDay(date)}
                        onClick={() =>
                          setDraft(`${date}T${pad(hour24)}:${minute}`)
                        }
                        onKeyDown={(event) => {
                          const change = (
                            {
                              ArrowLeft: -1,
                              ArrowRight: 1,
                              ArrowUp: -7,
                              ArrowDown: 7,
                            } as Record<string, number>
                          )[event.key]
                          if (!change) return
                          event.preventDefault()
                          const next = new Date(year, month, day + change)
                          const nextDay = localDateTime(next).slice(0, 10)
                          if (nextDay < minDate || nextDay > maxDate) return
                          setMonth(next.getMonth())
                          setYear(next.getFullYear())
                          setFocusedDay(nextDay)
                          requestAnimationFrame(() =>
                            calendar.current
                              ?.querySelector<HTMLButtonElement>(
                                `[data-day="${nextDay}"]`,
                              )
                              ?.focus(),
                          )
                        }}
                        className={cn(
                          "aspect-square rounded-lg text-xs tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#294a9b] focus-visible:ring-offset-1 disabled:text-[#cbd3df]",
                          isSelected
                            ? "bg-[#203f8c] font-semibold text-white shadow-sm"
                            : "text-[#52627a] hover:bg-[#edf2fb]",
                          date === minDate &&
                            !isSelected &&
                            "font-bold text-[#203f8c] underline underline-offset-4",
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <section
            aria-label="Quotation expiry time"
            className="space-y-3 border-t border-[#eceef1] pt-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#182235]">
              <Clock3 size={15} className="text-[#738096]" />
              Expiry time
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TimeSelect
                label="Hour"
                value={hour12}
                values={Array.from({ length: 12 }, (_, i) => pad(i + 1))}
                onChange={(value) => changeTime(value, minute, period)}
              />
              <TimeSelect
                label="Minute"
                value={minute}
                values={Array.from({ length: 60 }, (_, i) => pad(i))}
                onChange={(value) => changeTime(hour12, value, period)}
              />
              <TimeSelect
                label="Period"
                value={period}
                values={["AM", "PM"]}
                onChange={(value) => changeTime(hour12, minute, value)}
              />
            </div>
            <p className="m-0 text-[11px] text-[#8791a2]">
              Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </section>
          {!valid && (
            <p role="alert" className="m-0 text-xs text-[#b42318]">
              Choose a future date and time within the next year.
            </p>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[#eceef1] bg-[#f8fafd] px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!valid}
            className="h-10 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            Apply date & time
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
