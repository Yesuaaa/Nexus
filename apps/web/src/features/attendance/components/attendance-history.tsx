"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { MemberIdentity } from "@/components/ui/member-identity"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import {
  RowActionLabel,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu"
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
import { AttendanceTableEmpty } from "./attendance-shared"
import { AttendanceHistoryDetailsPanel } from "./attendance-history-details-panel"

const historyGrid =
  "grid grid-cols-[minmax(160px,1.4fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(120px,.9fr)_minmax(120px,1fr)_56px] items-center gap-3.5"

export function AttendanceHistoryTable({
  days,
  onCorrect,
  onReconcile,
  asOf,
  loading = false,
  error = "",
  onRetry,
}: {
  days: AttendanceWorkday[]
  asOf: number
  onCorrect?: (session: AttendanceSession, day: AttendanceWorkday) => void
  onReconcile?: (session: AttendanceSession, day: AttendanceWorkday) => void
  loading?: boolean
  error?: string
  onRetry?: () => void
}) {
  const [detailsDay, setDetailsDay] = useState<AttendanceWorkday | null>(null)
  const currentDetails = detailsDay?.id
    ? (days.find((day) => day.id === detailsDay.id) ?? detailsDay)
    : detailsDay

  return (
    <>
      <ResponsiveDataTable label="Attendance history" aria-busy={loading}>
        <ResponsiveDataTableHeader
          className="@max-[820px]:sr-only"
          rowClassName={`${historyGrid} @max-[820px]:grid-cols-1`}
        >
          <ResponsiveDataTableColumnHeader>
            Employee
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Time in
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Time out
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Worked / required
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Status
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Actions
          </ResponsiveDataTableColumnHeader>
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {loading ? (
            <DataTableSkeletonRows
              label="attendance records"
              rows={5}
              rowClassName={`${historyGrid} min-h-[68px] px-4 py-4 @max-[820px]:grid-cols-1 @max-[820px]:gap-y-3.5`}
              cellSkeletonClassNames={[
                "h-3 w-28 max-w-full",
                "h-3 w-36 max-w-full",
                "h-3 w-36 max-w-full",
                "h-3 w-24 max-w-full",
                "h-6 w-24 max-w-full rounded-full",
                "size-8 rounded-md",
              ]}
              cellClassNames={[
                "",
                "",
                "",
                "",
                "",
                "@max-[820px]:justify-self-end",
              ]}
            />
          ) : error ? (
            <DataTableErrorRow
              message={error}
              colSpan={6}
              onRetry={() => onRetry?.()}
            />
          ) : !days.length ? (
            <AttendanceTableEmpty
              colSpan={6}
              message="No attendance records or approved leave in this date range."
            />
          ) : (
            days.map((day) => {
              const status = attendanceStatus(day)
              const firstSession = day.sessions[0]
              const lastSession = day.sessions.at(-1)
              const key = day.id ?? `${day.employeeId}-${day.workDate}`
              const actionId = `attendance-history-actions-${key}`
              const hasLeave = (day.approvedLeaveMinutes ?? 0) > 0
              const overnight = day.sessions.some((session) =>
                isOvernight(
                  session.startedAt,
                  session.endedAt ?? session.suspendedAt ?? null,
                  day.timeZone,
                  asOf,
                ),
              )
              return (
                <ResponsiveDataTableRow
                  key={key}
                  className={`${historyGrid} min-h-[68px] min-w-0 border-b border-[#eceef1] px-4 py-3 text-xs last:border-0 @max-[820px]:grid-cols-1 @max-[820px]:gap-y-3.5`}
                >
                  <ResponsiveDataTableCell className="min-w-0">
                    {day.employee && (
                      <MemberIdentity
                        member={day.employee}
                        secondaryText={day.employee.employeeId}
                      />
                    )}
                    {!day.employee && (
                      <span className="text-xs font-medium">My attendance</span>
                    )}
                    <div className="mt-1 text-[#65718a]">
                      Work date{" "}
                      <time dateTime={day.workDate}>{day.workDate}</time>
                    </div>
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="min-w-0 text-xs leading-5 text-[#65718a]">
                    {firstSession
                      ? attendanceDate(firstSession.startedAt, day.timeZone)
                      : hasLeave
                        ? "—"
                        : "No clock-in recorded"}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="min-w-0 text-xs leading-5 text-[#65718a]">
                    {lastSession?.endedAt
                      ? attendanceDate(lastSession.endedAt, day.timeZone)
                      : lastSession
                        ? isSuspendedSession(lastSession)
                          ? "Shift suspended"
                          : "Still clocked in"
                        : hasLeave
                          ? "—"
                          : "No clock-out recorded"}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="text-xs">
                    <span className="font-semibold tabular-nums">
                      {duration(day.workedMilliseconds)}
                    </span>{" "}
                    / {day.requiredMinutes / 60}h
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="min-w-0">
                    <Pill tone={attendanceStatusTones[status]}>
                      {attendanceStatusLabel(day)}
                    </Pill>
                    {day.pendingCorrections > 0 && (
                      <div className="mt-1">
                        <Pill tone="info">Correction pending</Pill>
                      </div>
                    )}
                    {overnight && (
                      <div className="mt-1">
                        <Pill tone="info">Overnight</Pill>
                      </div>
                    )}
                    {!!day.schedule?.lateArrivalMinutes && (
                      <div className="mt-1">
                        <Pill tone="warning">Late arrival</Pill>
                      </div>
                    )}
                    {!!day.schedule?.earlyDepartureMinutes && (
                      <div className="mt-1">
                        <Pill tone="warning">Early departure</Pill>
                      </div>
                    )}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="flex min-w-0 justify-start @max-[820px]:justify-self-end">
                    <RowActionsMenu
                      triggerId={actionId}
                      triggerLabel={`Actions for ${day.workDate}`}
                      menuLabel={`Attendance actions for ${day.workDate}`}
                      items={[
                        {
                          action: "view",
                          label: (
                            <RowActionLabel icon={Eye}>
                              View details
                            </RowActionLabel>
                          ),
                        },
                      ]}
                      onAction={() => setDetailsDay(day)}
                    />
                  </ResponsiveDataTableCell>
                </ResponsiveDataTableRow>
              )
            })
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {currentDetails && (
        <AttendanceHistoryDetailsPanel
          day={currentDetails}
          asOf={asOf}
          actionId={`attendance-history-actions-${currentDetails.id ?? `${currentDetails.employeeId}-${currentDetails.workDate}`}`}
          onCorrect={onCorrect}
          onReconcile={onReconcile}
          onClose={() => setDetailsDay(null)}
        />
      )}
    </>
  )
}
