"use client"

import { useState } from "react"
import { ArrowLeftRight, CalendarMinus, CalendarX } from "lucide-react"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { cn } from "@/lib/utils"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { focusRing } from "@/components/layout/styles"
import { Pill } from "@/components/ui/pill"
import { MemberIdentity } from "@/components/ui/member-identity"
import { panelEmpty } from "@/components/ui/panel-styles"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendancePagination, ResourceStatus } from "./attendance-shared"
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
import {
  attendancePolicyAssignments,
  unassignAttendancePolicy,
  type AttendancePolicyAssignment,
  type AttendancePolicy,
} from "../api/attendance-api"
import { attendanceWeekNames } from "./attendance-policy-panel"
import { scheduledClockTime } from "../model/attendance"

const assignmentStatusLabels = {
  CURRENT: "Current",
  SCHEDULED: "Scheduled",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
} satisfies Record<AttendancePolicyAssignment["status"], string>

export function AttendancePolicyDetailsPanel({
  policy,
  onClose,
  onReplace,
}: {
  policy: AttendancePolicy
  onClose: () => void
  onReplace: (assignment: AttendancePolicyAssignment) => void
}) {
  const panel = useSidePanel(onClose)
  const weeklyMinutes = policy.days.reduce(
    (sum, day) => sum + day.requiredMinutes,
    0,
  )

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(`attendance-policy-actions-${policy.id}`)
      }
    >
      <SidePanelHeader
        title={policy.name}
        description="Attendance policy details"
        closeLabel="Close policy details"
      />
      <Tabs
        defaultValue="overview"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex-none">
          <TabsList
            aria-label="Policy detail sections"
            className="flex h-auto w-full flex-none justify-start gap-5 rounded-none border-b border-[#eceef1] bg-transparent px-6 py-0 max-[560px]:px-5"
          >
            <TabsTrigger
              value="overview"
              className={`flex min-h-[46px] cursor-pointer items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium text-[#738096] shadow-none hover:text-foreground data-[state=active]:border-b-[#0b0b0c] data-[state=active]:bg-transparent data-[state=active]:shadow-none ${focusRing}`}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="people"
              className={`flex min-h-[46px] cursor-pointer items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium text-[#738096] shadow-none hover:text-foreground data-[state=active]:border-b-[#0b0b0c] data-[state=active]:bg-transparent data-[state=active]:shadow-none ${focusRing}`}
            >
              Assigned people
            </TabsTrigger>
          </TabsList>
        </div>
        <SidePanelBody className="min-w-0 grid-cols-1">
          <TabsContent value="overview" className="mt-0 grid gap-5">
            <SidePanelSection title="Working days">
              <DetailList>
                {policy.days.map((day) => (
                  <DetailItem
                    key={day.weekday}
                    label={attendanceWeekNames[day.weekday]}
                  >
                    {!day.isWorkingDay ? (
                      "Rest day"
                    ) : day.scheduledStartMinute != null &&
                      day.scheduledEndMinute != null ? (
                      <>
                        {scheduledClockTime(day.scheduledStartMinute)}–
                        {scheduledClockTime(day.scheduledEndMinute)}
                        {day.scheduledEndMinute < day.scheduledStartMinute &&
                          " (next day)"}
                        <span className="block">
                          {day.requiredMinutes / 60} required hours
                          {!!day.scheduledUnpaidBreakMinutes &&
                            ` · ${day.scheduledUnpaidBreakMinutes} min unpaid break`}
                        </span>
                      </>
                    ) : (
                      `${day.requiredMinutes / 60} required hours`
                    )}
                  </DetailItem>
                ))}
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Policy rules">
              <DetailList>
                <DetailItem label="Schedule type">
                  {policy.scheduleMode === "FIXED"
                    ? "Fixed schedule"
                    : "Flexible"}
                </DetailItem>
                <DetailItem label="Timezone">{policy.timeZone}</DetailItem>
                <DetailItem label="Required hours">
                  {weeklyMinutes / 60} hrs/week
                </DetailItem>
                <DetailItem label="Unpaid breaks">
                  {policy.unpaidBreaksEnabled ? "Enabled" : "Disabled"}
                </DetailItem>
                <DetailItem label="Overnight review">
                  {policy.overnightRequiresReview
                    ? policy.scheduleMode === "FIXED"
                      ? "Unexpected overnight work"
                      : "All overnight work"
                    : "Disabled"}
                </DetailItem>
                <DetailItem label="Assignments">
                  {policy._count?.assignments ?? 0}
                </DetailItem>
              </DetailList>
            </SidePanelSection>
          </TabsContent>
          <TabsContent value="people" className="mt-0 min-w-0">
            <AttendancePolicyAssignments
              policy={policy}
              onReplace={(assignment) =>
                panel.close(() => onReplace(assignment))
              }
            />
          </TabsContent>
        </SidePanelBody>
      </Tabs>
      <SidePanelFooter>
        <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}

function AttendancePolicyAssignments({
  policy,
  onReplace,
}: {
  policy: AttendancePolicy
  onReplace: (assignment: AttendancePolicyAssignment) => void
}) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<{
    assignment: AttendancePolicyAssignment
    status: "CURRENT" | "SCHEDULED"
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const assignments = useAsyncResource(
    (signal) => attendancePolicyAssignments(policy.id, page, signal),
    [policy.id, page],
    { fallbackError: "Couldn't load assigned people." },
  )
  return (
    <SidePanelSection title="Assigned people" className="min-w-0 grid-cols-1">
      <p className="m-0 text-xs text-[#738096]">
        Current, scheduled, and previous assignments to this policy. End dates
        are exclusive.
      </p>
      <ResourceStatus
        loading={assignments.loading}
        error={assignments.error}
        retry={assignments.retry}
      />
      {!assignments.loading && !assignments.error && assignments.data && (
        <>
          <div className="rounded-lg border border-[#e8ebef]">
            {assignments.data.assignments.length ? (
              <ul className="m-0 min-w-0 list-none divide-y divide-[#eceef1] p-0">
                {assignments.data.assignments.map((assignment) => {
                  const { status } = assignment
                  return (
                    <li key={assignment.id} className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#fafbfc]">
                        <div className="min-w-0 flex-1 basis-[180px]">
                          <MemberIdentity
                            member={assignment.employee}
                            secondaryText={[
                              assignment.employee.employeeId,
                              assignment.employee.department?.name,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          />
                          <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                            {assignment.status === "CANCELLED"
                              ? `Was scheduled for ${assignment.effectiveFrom.slice(0, 10)}`
                              : `${assignment.effectiveFrom.slice(0, 10)} — ${assignment.effectiveUntil?.slice(0, 10) ?? "Ongoing"}`}
                          </p>
                        </div>
                        <Pill
                          tone={
                            assignment.status === "CURRENT"
                              ? "success"
                              : assignment.status === "SCHEDULED"
                                ? "info"
                                : "neutral"
                          }
                          className="shrink-0"
                        >
                          {assignmentStatusLabels[assignment.status]}
                        </Pill>
                        {(status === "CURRENT" || status === "SCHEDULED") && (
                          <div className="flex shrink-0 items-center gap-2">
                            {status === "CURRENT" && (
                              <span className="group relative inline-flex">
                                <button
                                  type="button"
                                  className={cn(
                                    rowActionButton,
                                    "max-[560px]:size-11",
                                  )}
                                  aria-label="Replace policy"
                                  onClick={() => onReplace(assignment)}
                                >
                                  <ArrowLeftRight
                                    size={16}
                                    aria-hidden="true"
                                  />
                                </button>
                                <HoverTooltip>Replace policy</HoverTooltip>
                              </span>
                            )}
                            <span className="group relative inline-flex">
                              <button
                                type="button"
                                className={cn(
                                  rowActionButton,
                                  "max-[560px]:size-11",
                                )}
                                aria-label={
                                  status === "SCHEDULED"
                                    ? "Cancel scheduled assignment"
                                    : "End assignment"
                                }
                                onClick={() => {
                                  setError("")
                                  setSelected({ assignment, status })
                                }}
                              >
                                {status === "SCHEDULED" ? (
                                  <CalendarX size={16} aria-hidden="true" />
                                ) : (
                                  <CalendarMinus size={16} aria-hidden="true" />
                                )}
                              </button>
                              <HoverTooltip className="right-0 left-auto translate-x-0">
                                {status === "SCHEDULED"
                                  ? "Cancel scheduled assignment"
                                  : "End assignment"}
                              </HoverTooltip>
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className={`${panelEmpty} m-0`}>
                No people assigned to this policy yet.
              </p>
            )}
          </div>
          <AttendancePagination
            data={assignments.data}
            onChange={setPage}
            disabled={assignments.loading}
          />
        </>
      )}
      {selected && (
        <ConfirmationDialog
          title={
            selected.status === "SCHEDULED"
              ? "Cancel scheduled assignment?"
              : "End attendance assignment?"
          }
          subject={selected.assignment.employee.fullName}
          description={
            selected.status === "SCHEDULED"
              ? `The change scheduled for ${selected.assignment.effectiveFrom.slice(0, 10)} will be cancelled. Any previous coverage shortened by this change resumes until its original end or the next scheduled policy.`
              : `Coverage ends at the start of tomorrow in ${policy.timeZone}. Recorded attendance is preserved. The employee will need another policy to clock in after the cutoff.`
          }
          confirmLabel={
            selected.status === "SCHEDULED"
              ? "Cancel scheduled assignment"
              : "End assignment"
          }
          pendingLabel="Saving…"
          pending={pending}
          error={error}
          onClose={() => {
            if (!pending) setSelected(null)
          }}
          onConfirm={async () => {
            if (pending) return
            setPending(true)
            setError("")
            try {
              await unassignAttendancePolicy(
                selected.assignment.id,
                selected.status,
              )
              sileo.success({
                title:
                  selected.status === "SCHEDULED"
                    ? "Scheduled policy assignment cancelled"
                    : "Policy assignment ending",
              })
              setSelected(null)
              assignments.retry()
            } catch (failure) {
              setError(errorMessage(failure, "Couldn't update the assignment."))
            } finally {
              setPending(false)
            }
          }}
        />
      )}
    </SidePanelSection>
  )
}
