import { useState } from "react"
import {
  panelField,
  panelInput,
} from "@/features/departments/styles/member-panel-styles"
import { Input } from "@/components/ui/input"

export function CapacityFields({
  scheduledHours,
  timeOffHours,
  assignedHours,
  hasUnrecordedHours,
}: {
  scheduledHours: number | null
  timeOffHours: number
  assignedHours: number
  hasUnrecordedHours: boolean
}) {
  const [scheduled, setScheduled] = useState(scheduledHours?.toString() ?? "")
  const [timeOff, setTimeOff] = useState(timeOffHours.toString())
  const scheduledNumber = Number(scheduled),
    timeOffNumber = Number(timeOff)
  const valid =
    scheduled !== "" &&
    timeOff !== "" &&
    Number.isFinite(scheduledNumber) &&
    Number.isFinite(timeOffNumber) &&
    scheduledNumber >= 0 &&
    scheduledNumber <= 168 &&
    timeOffNumber >= 0 &&
    timeOffNumber <= scheduledNumber
  const capacity = scheduledNumber - timeOffNumber
  const remaining = capacity - assignedHours
  const format = (value: number) =>
    value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  return (
    <>
      <label className={panelField}>
        Scheduled hours
        <Input
          className={panelInput}
          name="scheduledHours"
          type="number"
          min="0"
          max="168"
          step="0.25"
          required
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          aria-describedby="capacity-help"
        />
      </label>
      <label className={panelField}>
        Time off / holiday hours
        <Input
          className={panelInput}
          name="timeOffHours"
          type="number"
          min="0"
          max={scheduled !== "" ? Math.max(0, scheduledNumber) : 168}
          step="0.25"
          required
          value={timeOff}
          onChange={(e) => setTimeOff(e.target.value)}
          aria-describedby="capacity-help"
        />
      </label>
      <div className="sm:col-span-2">
        <p
          id="capacity-help"
          className="m-0 text-[11px] leading-5 text-[#738096]"
        >
          Enter hours for one week. For example, 8 hours × 5 workdays = 40
          scheduled hours.
        </p>
        <section
          aria-label="Capacity calculation"
          className="mt-3 overflow-hidden rounded-lg border border-[#e8ebef] text-xs"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="border-b border-[#eceef1] bg-[#e8eef2] px-4 py-3">
            <h3 className="m-0 font-semibold">Weekly capacity calculation</h3>
          </div>
          {valid ? (
            <div className="p-4">
              <p className="m-0 text-[#65718a]">
                Scheduled hours − time off = available capacity
              </p>
              <p className="mt-2 mb-4 text-sm font-semibold text-foreground tabular-nums">
                {format(scheduledNumber)} hrs − {format(timeOffNumber)} hrs ={" "}
                {format(capacity)} hrs
              </p>
              <dl className="m-0 grid gap-3 border-t border-[#eceef1] pt-3">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#738096]">Assigned to projects</dt>
                  <dd className="m-0 font-medium tabular-nums">
                    {format(assignedHours)} hrs
                    {hasUnrecordedHours ? " recorded" : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#738096]">
                    {remaining < 0 ? "Over capacity" : "Remaining capacity"}
                  </dt>
                  <dd
                    className={
                      remaining < 0
                        ? "m-0 font-semibold text-[#bc3649] tabular-nums"
                        : "m-0 font-semibold tabular-nums"
                    }
                  >
                    {hasUnrecordedHours
                      ? "Needs assignment hours"
                      : `${format(Math.abs(remaining))} hrs`}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#738096]">Utilization</dt>
                  <dd className="m-0 font-medium tabular-nums">
                    {hasUnrecordedHours
                      ? "Not available"
                      : capacity > 0
                        ? `${format(assignedHours)} ÷ ${format(capacity)} × 100 = ${Math.round((assignedHours / capacity) * 100)}%`
                        : assignedHours > 0
                          ? "Over capacity — no available hours"
                          : "— No available hours"}
                  </dd>
                </div>
              </dl>
              {hasUnrecordedHours && (
                <p className="mt-3 mb-0 text-[11px] text-[#738096]">
                  Some assignments have no recorded hours. Add their hours to
                  calculate remaining capacity and utilization.
                </p>
              )}
            </div>
          ) : (
            <p className="m-0 px-4 py-4 text-[#738096]">
              {scheduled === "" || timeOff === ""
                ? "Enter scheduled hours and time off to see the calculation."
                : timeOffNumber > scheduledNumber
                  ? "Time off cannot exceed scheduled hours."
                  : "Enter valid weekly hours between 0 and 168."}
            </p>
          )}
        </section>
      </div>
    </>
  )
}
