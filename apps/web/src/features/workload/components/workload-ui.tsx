"use client"

import { cloneElement, useId, type ReactElement } from "react"
import { cn } from "@/lib/utils"
import { Pill } from "@/components/ui/pill"
import type { Metrics } from "../api/workload-api"

export const fieldClass =
  "h-10 w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-[11px] text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
export const labelText = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
export const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
export const displayDate = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date))
export const manilaISO = (value: FormDataEntryValue | null) =>
  `${String(value)}:00+08:00`
export const splitSkills = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactElement<{ id?: string }>
}) {
  const fieldId = useId()
  return (
    <div className="grid min-w-0 gap-[7px] text-xs font-[650] text-foreground">
      <label htmlFor={fieldId}>{label}</label>
      {cloneElement(children, { id: fieldId })}
    </div>
  )
}
export function Status({ value }: { value: string }) {
  return (
    <Pill
      title={labelText(value)}
      className={cn(
        ["OVER_CAPACITY", "UNAVAILABLE", "REJECTED", "CANCELLED"].includes(
          value,
        )
          ? "bg-[#fde4ea] text-[#b4234d]"
          : ["HIGH", "MODERATE", "PARTIALLY_AVAILABLE", "PENDING"].includes(
                value,
              )
            ? "bg-[#fff3df] text-[#805316]"
            : value === "FULLY_ALLOCATED"
              ? "bg-[#eef0f3] text-[#596579]"
              : "bg-[#dcf5e5] text-[#19703a]",
      )}
    >
      {labelText(value)}
    </Pill>
  )
}
export function Utilization({ metrics }: { metrics: Metrics }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex justify-between gap-4 text-xs">
        <span>
          {metrics.allocatedHours} / {metrics.capacityHours}h
        </span>
        <strong>
          {metrics.utilization === null
            ? "No capacity"
            : `${metrics.utilization}%`}
        </strong>
      </div>
      <div
        role="meter"
        aria-label="Workload utilization"
        aria-valuemin={0}
        aria-valuemax={Math.max(100, metrics.utilization ?? 100)}
        aria-valuenow={metrics.utilization ?? undefined}
        aria-valuetext={
          metrics.utilization === null
            ? "Allocated work with no capacity"
            : `${metrics.utilization}%`
        }
        className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={cn(
            "h-full rounded-full",
            metrics.workload === "OVER_CAPACITY"
              ? "bg-red-500"
              : metrics.utilization !== null && metrics.utilization >= 80
                ? "bg-amber-500"
                : "bg-[#203a78]",
          )}
          style={{ width: `${Math.min(100, metrics.utilization ?? 100)}%` }}
        />
      </div>
    </div>
  )
}
