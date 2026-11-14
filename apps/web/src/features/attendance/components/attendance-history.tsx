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
  attendanceStatusLabels,
  attendanceStatusTones,
  duration,
  isOvernight,
} from "../model/attendance"
import { AttendanceTableEmpty } from "./attendance-shared"
import { AttendanceHistoryDetailsPanel } from "./attendance-history-details-panel"

const historyGrid =
  "grid grid-cols-[minmax(160px,1.4fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(120px,.9fr)_minmax(120px,1fr)_56px] items-center gap-3.5"

export function AttendanceHistoryTable({
  days,
  onCorrect,
  asOf,
  loading = false,
  error = "",
  onRetry,
}: {
  days: AttendanceWorkday[]
  asOf: number
  onCorrect?: (session: AttendanceSession, day: AttendanceWorkday) => void
  loading?: boolean
  error?: string
  onRetry?: () => void
}) {
  const [detailsDay, setDetailsDay] = useState<AttendanceWorkday | null>(null)

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
              message="No attendance records. Recorded workdays will appear here. Try another date range."
            />
          ) : (
            days.map((day) => {
              const status = attendanceStatus(day)
              const firstSession = day.sessions[0]
              const lastSession = day.sessions.at(-1)
              const actionId = `attendance-history-actions-${day.id ?? `${day.employeeId}-${day.workDate}`}`
              const overnight = day.sessions.some((session) =>
                isOvernight(
                  session.startedAt,
                  session.endedAt,
                  day.timeZone,
                  asOf,
                ),
              )
              return (
                <ResponsiveDataTableRow
                  key={day.id ?? day.workDate}
                  className={`${historyGrid} min-h-[68px] min-w-0 border-b border-[#eceef1] px-4 py-3 text-xs last:border-0 @max-[820px]:grid-cols-1 @max-[820px]:gap-y-3.5`}
                >
                  <ResponsiveDataTableCell className="min-w-0">
                    {day.employee && (
                      <MemberIdentity
                        member={day.employee}
                        secondaryText={
                          day.employee.department?.name ?? "No department"
                        }
                      />
                    )}
                    {!day.employee && (
                      <span className="text-xs font-medium">My attendance</span>
                    )}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="min-w-0 text-xs leading-5 text-[#65718a]">
                    {firstSession
                      ? attendanceDate(firstSession.startedAt, day.timeZone)
                      : "No clock-in recorded"}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="min-w-0 text-xs leading-5 text-[#65718a]">
                    {lastSession?.endedAt
                      ? attendanceDate(lastSession.endedAt, day.timeZone)
                      : lastSession
                        ? "Still clocked in"
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
                      {attendanceStatusLabels[status]}
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
      {detailsDay && (
        <AttendanceHistoryDetailsPanel
          day={detailsDay}
          asOf={asOf}
          actionId={`attendance-history-actions-${detailsDay.id ?? `${detailsDay.employeeId}-${detailsDay.workDate}`}`}
          onCorrect={onCorrect}
          onClose={() => setDetailsDay(null)}
        />
      )}
    </>
  )
}
