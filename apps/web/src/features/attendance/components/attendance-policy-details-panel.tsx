"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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

export function AttendancePolicyDetailsPanel({
  policy,
  onClose,
}: {
  policy: AttendancePolicy
  onClose: () => void
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
                    {day.isWorkingDay
                      ? `${day.requiredMinutes / 60} required hours`
                      : "Rest day"}
                  </DetailItem>
                ))}
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Policy rules">
              <DetailList>
                <DetailItem label="Timezone">{policy.timeZone}</DetailItem>
                <DetailItem label="Required hours">
                  {weeklyMinutes / 60} hrs/week
                </DetailItem>
                <DetailItem label="Unpaid breaks">
                  {policy.unpaidBreaksEnabled ? "Enabled" : "Disabled"}
                </DetailItem>
                <DetailItem label="Overnight review">
                  {policy.overnightRequiresReview ? "Required" : "Not required"}
                </DetailItem>
                <DetailItem label="Assignments">
                  {policy._count?.assignments ?? 0}
                </DetailItem>
              </DetailList>
            </SidePanelSection>
          </TabsContent>
          <TabsContent value="people" className="mt-0 min-w-0">
            <AttendancePolicyAssignments policyId={policy.id} />
          </TabsContent>
        </SidePanelBody>
      </Tabs>
      <SidePanelFooter>
        <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}

export function AttendancePolicyAssignments({
  policyId,
}: {
  policyId: string
}) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AttendancePolicyAssignment | null>(
    null,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const assignments = useAsyncResource(
    (signal) => attendancePolicyAssignments(policyId, page, signal),
    [policyId, page],
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
          <div className="overflow-hidden rounded-lg border border-[#e8ebef]">
            {assignments.data.assignments.length ? (
              <ul className="m-0 min-w-0 list-none divide-y divide-[#eceef1] p-0">
                {assignments.data.assignments.map((assignment) => (
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
                          {assignment.effectiveFrom.slice(0, 10)} —{" "}
                          {assignment.effectiveUntil?.slice(0, 10) ?? "Ongoing"}
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
                        {assignment.status === "CURRENT"
                          ? "Current"
                          : assignment.status === "SCHEDULED"
                            ? "Scheduled"
                            : "Ended"}
                      </Pill>
                      {assignment.status !== "ENDED" && (
                        <Button
                          variant="brandOutline"
                          size="panel"
                          onClick={() => {
                            setError("")
                            setSelected(assignment)
                          }}
                        >
                          Unassign
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
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
          title="Unassign attendance policy?"
          subject={selected.employee.fullName}
          description={
            selected.status === "SCHEDULED"
              ? "Cancel this scheduled assignment. This employee will need another policy assignment to record attendance during that period."
              : "End this assignment tomorrow in the policy timezone. Today's attendance is preserved. The employee will need another policy assignment to record future attendance."
          }
          confirmLabel="Unassign"
          pendingLabel="Unassigning…"
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
              await unassignAttendancePolicy(selected.id)
              sileo.success({ title: "Policy assignment removed" })
              setSelected(null)
              assignments.retry()
            } catch (failure) {
              setError(errorMessage(failure, "Couldn't unassign the policy."))
            } finally {
              setPending(false)
            }
          }}
        />
      )}
    </SidePanelSection>
  )
}
