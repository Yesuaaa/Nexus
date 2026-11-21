"use client"

import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import type {
  AttendanceSession,
  AttendanceWorkday,
} from "../api/attendance-api"
import {
  attendanceDate,
  attendanceStatus,
  attendanceStatusLabel,
  attendanceStatusTones,
  duration,
  isOvernight,
  isSuspendedSession,
} from "../model/attendance"

export function AttendanceHistoryDetailsPanel({
  day,
  asOf,
  actionId,
  onCorrect,
  onReconcile,
  onClose,
}: {
  day: AttendanceWorkday
  asOf: number
  actionId: string
  onCorrect?: (session: AttendanceSession, day: AttendanceWorkday) => void
  onReconcile?: (session: AttendanceSession, day: AttendanceWorkday) => void
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const employee = day.employee
  const status = attendanceStatus(day)
  const leaveMinutes = day.approvedLeaveMinutes ?? 0

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() => document.getElementById(actionId)}
    >
      <SidePanelHeader
        title={employee?.fullName ?? "Attendance workday"}
        description={`Attendance details for ${day.workDate}`}
        closeLabel="Close attendance details"
      />
      <SidePanelBody>
        <SidePanelSection title="Workday summary">
          <DetailList>
            <DetailItem label="Work date">{day.workDate}</DetailItem>
            {employee && (
              <DetailItem label="Employee">{employee.fullName}</DetailItem>
            )}
            {employee?.department?.name && (
              <DetailItem label="Department">
                {employee.department.name}
              </DetailItem>
            )}
            <DetailItem label="Timezone">{day.timeZone}</DetailItem>
            <DetailItem label="Policy">{day.policy.name}</DetailItem>
            <DetailItem label="Worked / required">
              {duration(day.workedMilliseconds)} / {day.requiredMinutes / 60}h
            </DetailItem>
            {leaveMinutes > 0 && (
              <DetailItem label="Approved leave">
                {leaveMinutes / 60}h
              </DetailItem>
            )}
            <DetailItem label="Status">
              <Pill tone={attendanceStatusTones[status]}>
                {attendanceStatusLabel(day)}
              </Pill>
            </DetailItem>
            {day.pendingCorrections > 0 && (
              <DetailItem label="Corrections">
                <Pill tone="info">{day.pendingCorrections} pending</Pill>
              </DetailItem>
            )}
          </DetailList>
          {(day.excessRequiresReview || day.overnightRequiresReview) && (
            <div className="grid gap-1 text-xs text-[#805316]">
              {day.excessRequiresReview && (
                <p className="m-0">
                  {Math.round(day.excessMinutes)}m excess requires review.
                </p>
              )}
              {day.overnightRequiresReview && (
                <p className="m-0">Overnight work requires review.</p>
              )}
            </div>
          )}
        </SidePanelSection>

        <SidePanelSection
          title={`Sessions and unpaid breaks (${day.sessions.length})`}
        >
          {day.sessions.length ? (
            <div className="grid gap-3">
              {day.sessions.map((session, index) => {
                const suspended = isSuspendedSession(session)
                const overnight = isOvernight(
                  session.startedAt,
                  session.endedAt ?? session.suspendedAt ?? null,
                  day.timeZone,
                  asOf,
                )
                return (
                  <article
                    key={session.id}
                    className="grid min-w-0 gap-3 rounded-lg border border-[#e8ebef] p-3"
                  >
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <p className="m-0 text-xs font-semibold">
                        Session {index + 1}
                      </p>
                      {overnight && <Pill tone="info">Overnight</Pill>}
                    </div>
                    <DetailList>
                      <DetailItem label="Clock in">
                        {attendanceDate(session.startedAt, day.timeZone)}
                      </DetailItem>
                      <DetailItem label="Clock out">
                        {session.endedAt
                          ? attendanceDate(session.endedAt, day.timeZone)
                          : suspended
                            ? "Shift suspended"
                            : "Still clocked in"}
                      </DetailItem>
                      {suspended && session.suspendedAt && (
                        <DetailItem label="Suspended at">
                          {attendanceDate(session.suspendedAt, day.timeZone)}
                        </DetailItem>
                      )}
                      <DetailItem label="Breaks">
                        {session.breaks.length
                          ? `${session.breaks.length} recorded`
                          : "None recorded"}
                      </DetailItem>
                    </DetailList>
                    {session.breaks.length > 0 && (
                      <div className="grid gap-2 text-xs text-[#738096]">
                        {session.breaks.map((pause) => (
                          <p
                            key={pause.id}
                            className="m-0 leading-5 break-words"
                          >
                            {pause.isPaid ? "Paid" : "Unpaid"} break:{" "}
                            {attendanceDate(pause.startedAt, day.timeZone)} to{" "}
                            {pause.endedAt
                              ? attendanceDate(pause.endedAt, day.timeZone)
                              : suspended
                                ? "Pending reconciliation"
                                : "On break"}
                          </p>
                        ))}
                      </div>
                    )}
                    {onCorrect && (
                      <Button
                        variant="brandOutline"
                        size="sm"
                        className="justify-self-start"
                        onClick={() =>
                          panel.close(() => onCorrect(session, day))
                        }
                      >
                        Request correction
                      </Button>
                    )}
                    {suspended && day.canReconcile && onReconcile && (
                      <Button
                        variant="brandOutline"
                        size="sm"
                        className="justify-self-start"
                        onClick={() =>
                          panel.close(() => onReconcile(session, day))
                        }
                      >
                        Reconcile shift
                      </Button>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="m-0 text-xs text-[#738096]">No sessions recorded.</p>
          )}
        </SidePanelSection>
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}
