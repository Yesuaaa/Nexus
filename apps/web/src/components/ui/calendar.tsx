"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function calendarToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function calendarDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(date.getTime())
    ? date
    : new Date(`${calendarToday()}T12:00:00Z`)
}

export function calendarKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})
const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const buttonClass =
  "grid size-8 place-items-center rounded-lg text-[#52627a] hover:bg-[#eaf0fb] hover:text-[#203f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b] disabled:pointer-events-none disabled:opacity-30"

export function Calendar({
  value,
  min,
  max,
  week = false,
  today: currentDate = calendarToday(),
  markers,
  onSelect,
}: {
  value: string
  min?: string
  max?: string
  week?: boolean
  today?: string
  markers?: Record<string, { label: string; color: string }[]>
  onSelect: (date: string) => void
}) {
  const [view, setView] = useState(() => calendarDate(value))
  const [focused, setFocused] = useState(() => calendarKey(calendarDate(value)))
  const grid = useRef<HTMLDivElement>(null)
  const first = new Date(view)
  first.setUTCDate(1)
  const start = new Date(first)
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7))
  const selected = value.slice(0, 10)
  const monday = calendarDate(selected)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const today = currentDate
  const todayButton = (
    <button
      type="button"
      disabled={disabled(today)}
      onClick={() => {
        setView(calendarDate(today))
        setFocused(today)
        onSelect(today)
      }}
      className="rounded-md px-2 py-1 text-xs font-semibold text-[#203f8c] hover:bg-[#eaf0fb] focus-visible:outline-2 focus-visible:outline-[#294a9b] disabled:opacity-30"
    >
      Today
    </button>
  )
  function disabled(date: string) {
    return (
      date < (min?.slice(0, 10) || "0001-01-01") ||
      date > (max?.slice(0, 10) || "9999-12-31")
    )
  }
  function moveMonth(amount: number) {
    const next = new Date(first)
    next.setUTCMonth(next.getUTCMonth() + amount)
    return next
  }
  function navigate(date: Date) {
    const key = calendarKey(date)
    if (disabled(key)) return
    setView(date)
    setFocused(key)
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)
        ?.focus(),
    )
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className="m-0 text-sm font-semibold text-[#182235]"
          aria-live="polite"
        >
          {monthLabel.format(view)}
        </p>
        <div className="flex gap-1">
          {[-1, 1].map((amount) => {
            const next = moveMonth(amount)
            const last = new Date(next)
            last.setUTCMonth(last.getUTCMonth() + 1)
            last.setUTCDate(0)
            return (
              <button
                key={amount}
                type="button"
                aria-label={amount < 0 ? "Previous month" : "Next month"}
                className={buttonClass}
                disabled={
                  next.getUTCFullYear() < 1 ||
                  next.getUTCFullYear() > 9999 ||
                  (amount < 0
                    ? calendarKey(last) < (min?.slice(0, 10) || "0001-01-01")
                    : calendarKey(next) > (max?.slice(0, 10) || "9999-12-31"))
                }
                onClick={() => {
                  setView(next)
                  setFocused(
                    min && calendarKey(next) < min.slice(0, 10)
                      ? min.slice(0, 10)
                      : calendarKey(next),
                  )
                }}
              >
                {amount < 0 ? (
                  <ChevronLeft size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={monthLabel.format(view)}
        onKeyDown={(event) => {
          const target = event.target
          if (!(target instanceof HTMLButtonElement) || !target.dataset.date)
            return
          const date = calendarDate(target.dataset.date)
          const offsets: Record<string, number> = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -7,
            ArrowDown: 7,
            Home: -((date.getUTCDay() + 6) % 7),
            End: 6 - ((date.getUTCDay() + 6) % 7),
          }
          if (event.key in offsets)
            date.setUTCDate(date.getUTCDate() + offsets[event.key])
          else if (event.key === "PageUp" || event.key === "PageDown") {
            const day = date.getUTCDate()
            date.setUTCDate(1)
            date.setUTCMonth(
              date.getUTCMonth() + (event.key === "PageUp" ? -1 : 1),
            )
            const last = new Date(date)
            last.setUTCMonth(last.getUTCMonth() + 1)
            last.setUTCDate(0)
            date.setUTCDate(Math.min(day, last.getUTCDate()))
          } else return
          event.preventDefault()
          if (date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999)
            navigate(date)
        }}
      >
        <div role="row" className="mb-1 grid grid-cols-7">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <span
              key={day}
              role="columnheader"
              className={cn(
                "py-2 text-center font-medium",
                markers
                  ? "text-xs text-slate-600"
                  : "text-[10px] text-[#738096]",
              )}
            >
              {day}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} role="row" className="grid grid-cols-7">
            {Array.from({ length: 7 }, (_, column) => {
              const date = new Date(start)
              date.setUTCDate(start.getUTCDate() + row * 7 + column)
              const key = calendarKey(date)
              const active = key === selected
              const markedToday = Boolean(markers) && key === today
              const dots = markers?.[key]?.slice(0, 3) ?? []
              const inWeek =
                week && !!selected && date >= monday && date <= sunday
              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-selected={active}
                  className={cn(
                    "my-0.5 flex justify-center",
                    inWeek &&
                      "bg-[#eaf0fb] first:rounded-l-lg last:rounded-r-lg",
                  )}
                >
                  <button
                    type="button"
                    data-date={key}
                    data-calendar-focus={key === focused ? "true" : undefined}
                    aria-label={[
                      dayLabel.format(date),
                      ...dots.map(({ label }) => label),
                    ].join(", ")}
                    aria-current={key === today ? "date" : undefined}
                    disabled={disabled(key)}
                    tabIndex={key === focused ? 0 : -1}
                    className={cn(
                      buttonClass,
                      "text-xs",
                      markers &&
                        "flex h-11 w-full max-w-14 flex-col items-center justify-center gap-1 text-base text-slate-800",
                      date.getUTCMonth() !== view.getUTCMonth() &&
                        (markers ? "text-slate-500" : "text-[#9aa8bb]"),
                      key === today &&
                        !active &&
                        !markedToday &&
                        "ring-1 ring-inset ring-[#a7b9df]",
                      active &&
                        "bg-[#203f8c] font-semibold text-white hover:bg-[#172f70] hover:text-white",
                    )}
                    onFocus={() => setFocused(key)}
                    onClick={() => onSelect(key)}
                  >
                    {date.getUTCDate()}
                    {markers && (
                      <span
                        className={cn(
                          "flex h-2 items-center gap-1",
                          markedToday && "gap-0.5",
                          key < today && "opacity-55",
                        )}
                        aria-hidden="true"
                      >
                        {markedToday && (
                          <span className="text-[8px] leading-none font-medium">
                            Today
                          </span>
                        )}
                        {dots.map(({ color }, index) => (
                          <span
                            key={index}
                            className={cn(
                              "size-2 rounded-full",
                              markedToday && "size-1",
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {!markers && (
        <div className="mt-3 flex items-center justify-between border-t border-[#e8ebef] pt-3">
          <span className="text-[10px] text-[#738096]">
            {week ? "Select a Monday-starting week" : "Select a date"}
          </span>
          {todayButton}
        </div>
      )}
    </div>
  )
}
