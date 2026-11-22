import { DetailItem } from "@/components/ui/side-panel"
import { Pill } from "@/components/ui/pill"
import type { AttendanceWorkday } from "../api/attendance-api"
import { attendanceDate } from "../model/attendance"

export function AttendanceScheduleDetails({ day }: { day: AttendanceWorkday }) {
  const { schedule, timeZone } = day
  if (!schedule) return null
  return (
    <>
      <DetailItem label="Scheduled start">
        {attendanceDate(schedule.startsAt, timeZone)}
      </DetailItem>
      <DetailItem label="Scheduled end">
        {attendanceDate(schedule.endsAt, timeZone)}
      </DetailItem>
      {schedule.unpaidBreakMinutes > 0 && (
        <DetailItem label="Scheduled unpaid break">
          {schedule.unpaidBreakMinutes} min
        </DetailItem>
      )}
      {schedule.lateArrivalMinutes > 0 && (
        <DetailItem label="Late arrival">
          <Pill tone="warning">{schedule.lateArrivalMinutes} min</Pill>
        </DetailItem>
      )}
      {schedule.earlyDepartureMinutes > 0 && (
        <DetailItem label="Early departure">
          <Pill tone="warning">{schedule.earlyDepartureMinutes} min</Pill>
        </DetailItem>
      )}
    </>
  )
}
