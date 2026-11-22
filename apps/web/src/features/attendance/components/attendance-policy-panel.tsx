"use client"

import { useState } from "react"
import { Form } from "@/components/ui/form"
import { FormInput } from "@/components/ui/form-input"
import { Checkbox } from "@/components/ui/checkbox"
import { DateInput } from "@/components/ui/date-input"
import { FilterSelect } from "@/components/ui/filter-select"
import { Alert } from "@/components/ui/alert"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelFooter,
  SidePanelButton,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { panelField, panelInput } from "@/components/ui/panel-styles"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { AttendanceEmployeeSelection } from "./attendance-employee-selection"
import { ResourceStatus } from "./attendance-shared"
import {
  createAttendancePolicy,
  updateAttendancePolicy,
  assignAttendancePolicy,
  type AttendancePolicy,
  type AttendancePolicyAssignment,
  type AttendancePolicyInput,
  type AttendanceScheduleMode,
  type PolicyDay,
} from "../api/attendance-api"
import { scheduledClockMinute, scheduledClockTime } from "../model/attendance"

export const attendanceWeekNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export function AttendancePolicyPanel({
  mode,
  policies,
  policyChoices,
  template,
  replacement,
  onClose,
  onSaved,
}: {
  mode: "create" | "assign"
  policies: AttendancePolicy[]
  policyChoices: { loading: boolean; error: string; retry: () => void }
  template?: AttendancePolicy
  replacement?: AttendancePolicyAssignment
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
  const [name, setName] = useState(template?.name ?? "")
  const [zone, setZone] = useState(template?.timeZone ?? "Asia/Manila")
  const [scheduleMode, setScheduleMode] = useState<AttendanceScheduleMode>(
    template?.scheduleMode ?? "FLEXIBLE",
  )
  const [breaks, setBreaks] = useState(template?.unpaidBreaksEnabled ?? true)
  const [overnight, setOvernight] = useState(
    template?.overnightRequiresReview ?? false,
  )
  const [days, setDays] = useState<PolicyDay[]>(() =>
    template
      ? template.days.map((day) => ({
          ...day,
          scheduledStartMinute: day.scheduledStartMinute ?? null,
          scheduledEndMinute: day.scheduledEndMinute ?? null,
          scheduledUnpaidBreakMinutes: day.scheduledUnpaidBreakMinutes ?? 0,
        }))
      : attendanceWeekNames.map((_, weekday) => ({
          weekday,
          isWorkingDay: false,
          requiredMinutes: 0,
          scheduledStartMinute: null,
          scheduledEndMinute: null,
          scheduledUnpaidBreakMinutes: 0,
        })),
  )
  const [employeeIds, setEmployeeIds] = useState<string[]>(
    replacement ? [replacement.employee.id] : [],
  )
  const [policyId, setPolicyId] = useState(
    replacement ? "" : (template?.id ?? ""),
  )
  const [effectiveFrom, setEffectiveFrom] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [confirm, setConfirm] = useState(false)
  const create = mode === "create"
  const editing = create && Boolean(template)
  const fixed = scheduleMode === "FIXED"
  const availablePolicies = policies.filter(
    (policy) => !replacement || policy.id !== template?.id,
  )
  const targetPolicy = availablePolicies.find(
    (policy) => policy.id === policyId,
  )
  const canAssign = Boolean(
    employeeIds.length &&
    targetPolicy &&
    effectiveFrom &&
    !policyChoices.loading &&
    !policyChoices.error,
  )
  function updateDay(weekday: number, changes: Partial<PolicyDay>) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...changes } : day,
      ),
    )
  }
  async function save() {
    if (pending) return
    if (!create && !canAssign) return
    setPending(true)
    setError("")
    const assignedIds: string[] = []
    try {
      if (create) {
        const rules = {
          name,
          timeZone: zone,
          unpaidBreaksEnabled: breaks,
          overnightRequiresReview: overnight,
        }
        const input: AttendancePolicyInput = fixed
          ? {
              ...rules,
              scheduleMode,
              days: days.map((day) => ({
                weekday: day.weekday,
                isWorkingDay: day.isWorkingDay,
                ...(day.isWorkingDay && {
                  scheduledStartMinute: day.scheduledStartMinute,
                  scheduledEndMinute: day.scheduledEndMinute,
                  scheduledUnpaidBreakMinutes: breaks
                    ? day.scheduledUnpaidBreakMinutes
                    : 0,
                }),
              })),
            }
          : {
              ...rules,
              scheduleMode,
              days: days.map(({ weekday, isWorkingDay, requiredMinutes }) => ({
                weekday,
                isWorkingDay,
                requiredMinutes: isWorkingDay ? requiredMinutes : 0,
              })),
            }
        if (template) await updateAttendancePolicy(template.id, input)
        else await createAttendancePolicy(input)
      } else {
        for (const employeeId of employeeIds) {
          await assignAttendancePolicy({
            employeeId,
            policyId,
            effectiveFrom,
            replacesAssignmentId: replacement?.id,
          })
          assignedIds.push(employeeId)
        }
      }
      sileo.success({
        title: editing
          ? "Attendance policy updated"
          : create
            ? "Attendance policy created"
            : replacement
              ? "Attendance policy replacement scheduled"
              : `Attendance policy assigned to ${assignedIds.length} ${assignedIds.length === 1 ? "employee" : "employees"}`,
      })
      setConfirm(false)
      panel.close(onSaved)
    } catch (failure) {
      if (!create) {
        setEmployeeIds((current) =>
          current.filter((id) => !assignedIds.includes(id)),
        )
        setConfirm(false)
      }
      setError(
        (assignedIds.length > 0
          ? `Policy assigned to ${assignedIds.length} ${assignedIds.length === 1 ? "employee" : "employees"}. Remaining employees are still selected. `
          : "") +
          errorMessage(
            failure,
            editing
              ? "Couldn't save the policy."
              : create
                ? "Couldn't create the policy."
                : replacement
                  ? "Couldn't replace the policy."
                  : "Couldn't assign the policy.",
          ),
      )
    } finally {
      setPending(false)
    }
  }
  const effectiveDateField = (
    <div className="grid min-w-0 gap-[7px]">
      <span className="text-xs font-medium text-foreground whitespace-nowrap">
        Effective from
      </span>
      <DateInput
        aria-label="Effective from"
        triggerClassName="h-[34px] justify-center gap-1 px-1 [&>span]:text-[11px]"
        title={
          effectiveFrom
            ? `Effective from ${effectiveFrom}`
            : "Choose effective date"
        }
        triggerLabel={
          effectiveFrom
            ? `${effectiveFrom.slice(5, 7)}/${effectiveFrom.slice(8, 10)}`
            : "—"
        }
        required
        value={effectiveFrom}
        onDateSelect={setEffectiveFrom}
        onChange={(event) => setEffectiveFrom(event.target.value)}
        disabled={pending || confirm}
      />
    </div>
  )
  const policyPicker =
    policyChoices.loading || policyChoices.error ? (
      <ResourceStatus {...policyChoices} />
    ) : availablePolicies.length === 0 && replacement ? (
      <p className="text-xs text-[#738096]">
        Create or restore another policy to replace this assignment.
      </p>
    ) : (
      <FilterSelect
        label="Attendance policy"
        placeholder="Choose a policy"
        value={policyId}
        options={availablePolicies.map((policy) => ({
          value: policy.id,
          label: `${policy.name} · ${policy.timeZone}`,
        }))}
        onChange={setPolicyId}
        disabled={pending || confirm}
        triggerClassName="w-full"
      />
    )
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={pending || confirm}
    >
      <SidePanelHeader
        title={
          editing
            ? "Edit attendance policy"
            : create
              ? "Create attendance policy"
              : replacement
                ? "Replace attendance policy"
                : "Assign policy to employee"
        }
        description={
          editing
            ? "Update this policy for new workdays. Recorded workdays retain their original rules."
            : create
              ? "Set working days and choose flexible hours or scheduled shifts."
              : replacement
                ? `Choose the policy that will replace ${template?.name} for ${replacement.employee.fullName}.`
                : "Choose employees, a policy, and an effective date. Recorded workdays retain their original requirements."
        }
        closeDisabled={pending || confirm}
      />
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          if (create) void save()
          else if (canAssign) setConfirm(true)
        }}
      >
        <SidePanelBody>
          {error && !confirm && <Alert>{error}</Alert>}
          {create ? (
            <>
              <SidePanelSection title="Policy information">
                <label className={panelField}>
                  Policy name
                  <FormInput
                    aria-label="Policy name"
                    className={panelInput}
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className={panelField}>
                  Attendance timezone
                  <FormInput
                    aria-label="Attendance timezone"
                    className={panelInput}
                    required
                    maxLength={100}
                    placeholder="Asia/Manila"
                    value={zone}
                    readOnly={editing && Boolean(template?._count?.assignments)}
                    onChange={(event) => setZone(event.target.value)}
                  />
                  {editing && Boolean(template?._count?.assignments) && (
                    <span className="text-[11px] font-normal text-[#738096]">
                      Assigned policies keep their timezone. Create a policy to
                      use a different timezone.
                    </span>
                  )}
                </label>
                <div className={panelField}>
                  Schedule type
                  <FilterSelect
                    label="Schedule type"
                    value={scheduleMode}
                    onChange={setScheduleMode}
                    options={[
                      { value: "FLEXIBLE", label: "Flexible" },
                      { value: "FIXED", label: "Fixed schedule" },
                    ]}
                    triggerClassName={`${panelInput} w-full`}
                  />
                </div>
              </SidePanelSection>
              <SidePanelSection title="Breaks and overnight work">
                <label className="flex items-start gap-2 text-xs leading-5">
                  <Checkbox
                    className="mt-1"
                    checked={breaks}
                    onChange={(event) => setBreaks(event.target.checked)}
                  />
                  Allow employees to record unpaid breaks. Recorded breaks are
                  deducted from worked time.
                </label>
                <label className="flex items-start gap-2 text-xs leading-5">
                  <Checkbox
                    className="mt-1"
                    checked={overnight}
                    onChange={(event) => setOvernight(event.target.checked)}
                  />
                  {fixed
                    ? "Flag unexpected overnight work for review."
                    : "Flag overnight sessions for review."}{" "}
                  Sessions stay open across midnight and keep their workday.
                </label>
              </SidePanelSection>
              <SidePanelSection
                title={
                  fixed
                    ? "Working days and shift times"
                    : "Working days and daily required hours"
                }
              >
                {fixed && (
                  <p className="m-0 text-xs leading-5 text-[#738096]">
                    An end time earlier than the start time falls on the next
                    day. Required hours are calculated from the shift and its
                    scheduled unpaid breaks.
                  </p>
                )}
                <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3.5">
                  {days.map((day) => (
                    <div
                      key={day.weekday}
                      className={
                        fixed
                          ? "grid min-w-0 gap-2 py-2.5"
                          : "flex min-w-0 items-center justify-between gap-3 py-2.5"
                      }
                    >
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          className="mt-0.5"
                          checked={day.isWorkingDay}
                          onChange={(event) =>
                            updateDay(day.weekday, {
                              isWorkingDay: event.target.checked,
                              requiredMinutes: event.target.checked
                                ? day.requiredMinutes
                                : 0,
                            })
                          }
                        />
                        {attendanceWeekNames[day.weekday]}
                      </label>
                      {!fixed && (
                        <FormInput
                          aria-label={`${attendanceWeekNames[day.weekday]} required hours`}
                          className={`${panelInput} w-24`}
                          type="number"
                          min={0}
                          max={24}
                          step={1 / 60}
                          disabled={!day.isWorkingDay}
                          value={day.requiredMinutes / 60}
                          onChange={(event) =>
                            updateDay(day.weekday, {
                              requiredMinutes: Math.round(
                                Number(event.target.value) * 60,
                              ),
                            })
                          }
                        />
                      )}
                      {fixed && day.isWorkingDay && (
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              ["Start time", "scheduledStartMinute"],
                              ["End time", "scheduledEndMinute"],
                            ] as const
                          ).map(([label, field]) => (
                            <label className={panelField} key={field}>
                              {label}
                              <FormInput
                                aria-label={`${attendanceWeekNames[day.weekday]} ${label.toLowerCase()}`}
                                className={panelInput}
                                type="time"
                                required
                                value={scheduledClockTime(day[field])}
                                onChange={(event) =>
                                  updateDay(day.weekday, {
                                    [field]: scheduledClockMinute(
                                      event.target.value,
                                    ),
                                  })
                                }
                              />
                            </label>
                          ))}
                          {breaks && (
                            <label className={`${panelField} col-span-2`}>
                              Scheduled unpaid break (minutes)
                              <FormInput
                                aria-label={`${attendanceWeekNames[day.weekday]} scheduled unpaid break minutes`}
                                className={`${panelInput} w-24`}
                                type="number"
                                min={0}
                                max={1438}
                                step={1}
                                value={day.scheduledUnpaidBreakMinutes ?? 0}
                                onChange={(event) =>
                                  updateDay(day.weekday, {
                                    scheduledUnpaidBreakMinutes: Number(
                                      event.target.value,
                                    ),
                                  })
                                }
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SidePanelSection>
            </>
          ) : replacement ? (
            <SidePanelSection title="Replacement details">
              {policyPicker}
              {effectiveDateField}
            </SidePanelSection>
          ) : (
            <AttendanceEmployeeSelection
              selectedIds={employeeIds}
              onChange={setEmployeeIds}
              disabled={pending || confirm}
              searchAction={effectiveDateField}
              beforeList={
                <SidePanelSection title="Policy assignment" className="my-1">
                  {policyPicker}
                </SidePanelSection>
              }
            />
          )}
        </SidePanelBody>
        <SidePanelFooter>
          <SidePanelButton
            variant="secondary"
            disabled={pending}
            onClick={() => panel.close()}
          >
            Cancel
          </SidePanelButton>
          <SidePanelButton
            type="submit"
            disabled={pending || (!create && !canAssign)}
          >
            {pending
              ? "Saving…"
              : editing
                ? "Save policy"
                : create
                  ? "Create policy"
                  : replacement
                    ? "Replace policy"
                    : "Assign policy"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
      {confirm && (
        <ConfirmationDialog
          title={
            replacement
              ? "Replace attendance policy?"
              : "Assign attendance policy?"
          }
          subject={
            replacement?.employee.fullName ??
            `${employeeIds.length} ${employeeIds.length === 1 ? "employee" : "employees"} selected`
          }
          description={
            replacement
              ? `${targetPolicy?.name} takes over on ${effectiveFrom} at midnight in ${targetPolicy?.timeZone}. Recorded workdays keep their original rules.`
              : "Recorded workdays retain their original requirements."
          }
          confirmLabel={
            replacement ? "Confirm replacement" : "Confirm assignment"
          }
          pendingLabel="Assigning…"
          pending={pending}
          destructive={false}
          error={error}
          onClose={() => setConfirm(false)}
          onConfirm={save}
        />
      )}
    </SidePanel>
  )
}
