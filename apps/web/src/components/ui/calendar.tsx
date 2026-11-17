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
  variant = "compact",
  today: currentDate = calendarToday(),
  markers,
  onSelect,
}: {
  value: string
  min?: string
  max?: string
  week?: boolean
  variant?: "compact" | "month"
  today?: string
  markers?: Record<string, { label: string; color: string; title?: string }[]>
  onSelect: (date: string) => void
}) {
  const [view, setView] = useState(() => calendarDate(value))
  const monthGrid = variant === "month"
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
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold text-[#203f8c] hover:bg-[#eaf0fb] focus-visible:outline-2 focus-visible:outline-[#294a9b] disabled:opacity-30",
        monthGrid &&
          "mr-1 h-8 rounded-lg border border-[#e3e7ed] px-3 py-0 font-medium text-[#182235] hover:bg-[#f5f7fa]",
      )}
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
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          monthGrid ? "mb-4" : "mb-3",
        )}
      >
        <p
          className={cn(
            "m-0 font-semibold",
            monthGrid
              ? "text-lg tracking-[-0.02em] text-[#101d35]"
              : "text-sm text-[#182235]",
          )}
          aria-live="polite"
        >
          {monthLabel.format(view)}
        </p>
        <div className="flex items-center gap-1">
          {monthGrid && todayButton}
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
        className={cn(
          monthGrid && "overflow-hidden rounded-xl border border-[#eceef2]",
        )}
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
        <div
          role="row"
          className={cn("grid grid-cols-7", !monthGrid && "mb-1")}
        >
          {(monthGrid
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
          ).map((day) => (
            <span
              key={day}
              role="columnheader"
              className={cn(
                "py-2 text-center font-medium",
                monthGrid
                  ? "py-2.5 text-[11px] text-[#8a94a6]"
                  : markers
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
              const dayMarkers = markers?.[key] ?? []
              const dots = dayMarkers.slice(0, 3)
              const outside = date.getUTCMonth() !== view.getUTCMonth()
              const inWeek =
                week && !!selected && date >= monday && date <= sunday
              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-selected={active}
                  className={cn(
                    monthGrid
                      ? "min-w-0 border-t border-r border-[#f0f1f4] last:border-r-0"
                      : "my-0.5 flex justify-center",
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
                      ...(monthGrid
                        ? dayMarkers.map(({ title }) => title).filter(Boolean)
                        : []),
                    ].join(", ")}
                    aria-current={key === today ? "date" : undefined}
                    disabled={disabled(key)}
                    tabIndex={key === focused ? 0 : -1}
                    className={cn(
                      buttonClass,
                      "text-xs",
                      markers &&
                        !monthGrid &&
                        "flex h-11 w-full max-w-14 flex-col items-center justify-center gap-1 text-base text-slate-800",
                      outside &&
                        !monthGrid &&
                        (markers ? "text-slate-500" : "text-[#9aa8bb]"),
                      key === today &&
                        !monthGrid &&
                        !active &&
                        !markedToday &&
                        "ring-1 ring-inset ring-[#a7b9df]",
                      active &&
                        !monthGrid &&
                        "bg-[#203f8c] font-semibold text-white hover:bg-[#172f70] hover:text-white",
                      monthGrid &&
                        "flex h-28 w-full min-w-0 flex-col items-stretch justify-start gap-1 rounded-none p-1.5 text-left text-xs text-[#182235] transition-colors hover:bg-[#f8f9fb] hover:text-[#182235] focus-visible:-outline-offset-2 motion-reduce:transition-none max-[560px]:h-14 max-[560px]:items-center max-[560px]:p-1",
                      monthGrid && active && "bg-[#f4f7fd] hover:bg-[#eef2fb]",
                    )}
                    onFocus={() => setFocused(key)}
                    onClick={() => onSelect(key)}
                  >
                    {monthGrid ? (
                      <>
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums",
                            outside && "text-[#b6bdca]",
                            key === today &&
                              "bg-[#203f8c] font-semibold text-white",
                            active &&
                              key !== today &&
                              "bg-[#e3eaf8] font-semibold text-[#203f8c]",
                          )}
                        >
                          {date.getUTCDate()}
                        </span>
                        {dayMarkers.length > 0 && (
                          <>
                            <span
                              className={cn(
                                "flex min-w-0 flex-col gap-0.5 max-[560px]:hidden",
                                outside && "opacity-50",
                              )}
                              aria-hidden="true"
                            >
                              {dayMarkers
                                .slice(0, dayMarkers.length > 3 ? 2 : 3)
                                .map(({ label, title, color }, index) => (
                                  <span
                                    key={index}
                                    title={title ?? label}
                                    className="flex min-w-0 items-center gap-1.5 px-1 text-[11px] leading-[18px] text-[#3b4658]"
                                  >
                                    <span
                                      className="size-1.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="truncate">
                                      {title ?? label}
                                    </span>
                                  </span>
                                ))}
                              {dayMarkers.length > 3 && (
                                <span className="px-1 text-[10px] font-medium text-[#8a94a6]">
                                  +{dayMarkers.length - 2} more
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                "hidden items-center gap-0.5 max-[560px]:flex",
                                outside && "opacity-50",
                              )}
                              aria-hidden="true"
                            >
                              {dots.map(({ color }, index) => (
                                <span
                                  key={index}
                                  className="size-1.5 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      date.getUTCDate()
                    )}
                    {markers && !monthGrid && (
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
