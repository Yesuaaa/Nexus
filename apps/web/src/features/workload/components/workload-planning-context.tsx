import {
  DetailItem,
  DetailList,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { Pill } from "@/components/ui/pill"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import type { WorkloadStaff } from "../model/workload"
import { getWorkloadMetrics } from "../model/workload"

const hours = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 })

export function WorkloadPlanningContext({ staff }: { staff: WorkloadStaff }) {
  const planning = staff.planning
  const metrics = getWorkloadMetrics(staff)
  return (
    <SidePanelSection title="Availability planning">
      <p className="m-0 text-xs leading-5 text-[#738096]">
        Weekly capacity is a planning estimate. Confirmed available time slots
        are unknown: assigned time windows and approved leave are not available
        here. Time off is entered manually. Clock-in status and attendance hours
        do not establish task availability or productivity.
      </p>
      {metrics.capacity !== null && metrics.assigned > metrics.capacity && (
        <p className="m-0 text-xs font-medium text-[#bc3649]">
          Over capacity by {hours(metrics.assigned - metrics.capacity)} hrs
          {metrics.unknown
            ? " or more; some allocation hours are missing."
            : "."}
        </p>
      )}
      {staff.status !== "ACTIVE" && (
        <p className="m-0 text-xs font-medium text-[#bc3649]">
          Current HR status: {humanizeEnum(staff.status)}. This status has no
          dated leave period; confirm future availability.
        </p>
      )}
      <DetailList>
        <DetailItem label="Policy required hours">
          {planning?.requirement.totalHours != null
            ? `${hours(planning.requirement.totalHours)} hrs/week`
            : "Incomplete policy coverage"}
        </DetailItem>
        <DetailItem label="Confirmed free time slots">Unknown</DetailItem>
      </DetailList>
      <p className="m-0 text-[11px] leading-5 text-[#738096]">
        Policy requirements are duration targets, not scheduled availability.
        Policies and attendance records are managed in Attendance &amp;
        Monitoring.
      </p>
      {planning && (
        <>
          <DetailList aria-label="Daily policy requirements">
            {planning.requirement.days.map((day) => (
              <DetailItem key={day.workDate} label={day.workDate}>
                <span className="block">
                  {day.requiredMinutes === null
                    ? "No assigned policy"
                    : day.isWorkingDay
                      ? `${hours(day.requiredMinutes / 60)} hrs required`
                      : "Rest day (no required hours)"}
                </span>
                {day.policyName && (
                  <p className="mt-1 mb-0 text-[11px] break-words text-[#738096]">
                    {day.policyName} · {day.timeZone}
                  </p>
                )}
              </DetailItem>
            ))}
          </DetailList>
          <h4 className="m-0 text-xs font-semibold">
            Known timed commitments (UTC week)
          </h4>
          <p className="m-0 text-[11px] leading-5 text-[#738096]">
            Service meetings and consultations belong to the current department
            head in the shared calendar. Confirm other employees&apos;
            commitments separately. These times are not subtracted again from
            weekly capacity.
          </p>
          {planning.overlaps.length > 0 && (
            <Pill tone="danger">
              Overlapping commitments: {planning.overlaps.length}
            </Pill>
          )}
          {planning.commitments.length > 0 && (
            <DetailList layout="stacked" aria-label="Known timed commitments">
              {planning.commitments.map((item) => (
                <DetailItem key={item.id} label={item.title}>
                  {formatDateTime(item.startsAt, "UTC")} –{" "}
                  {formatDateTime(item.endsAt, "UTC")} UTC
                </DetailItem>
              ))}
            </DetailList>
          )}
          {!planning.commitments.length && (
            <EmptyState
              size="sm"
              description="No known timed commitments from supported sources. Free time is unconfirmed."
            />
          )}
        </>
      )}
    </SidePanelSection>
  )
}
