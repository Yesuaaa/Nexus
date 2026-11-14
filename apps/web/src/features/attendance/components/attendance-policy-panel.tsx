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
import {
  createAttendancePolicy,
  updateAttendancePolicy,
  assignAttendancePolicy,
  type AttendancePolicy,
} from "../api/attendance-api"

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
  template,
  onClose,
  onSaved,
}: {
  mode: "create" | "assign"
  policies: AttendancePolicy[]
  template?: AttendancePolicy
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
  const [name, setName] = useState(template?.name ?? "")
  const [zone, setZone] = useState(template?.timeZone ?? "Asia/Manila")
  const [breaks, setBreaks] = useState(template?.unpaidBreaksEnabled ?? true)
  const [overnight, setOvernight] = useState(
    template?.overnightRequiresReview ?? false,
  )
  const [days, setDays] = useState(() =>
    template
      ? template.days.map((day) => ({ ...day }))
      : attendanceWeekNames.map((_, weekday) => ({
          weekday,
          isWorkingDay: false,
          requiredMinutes: 0,
        })),
  )
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [policyId, setPolicyId] = useState(template?.id ?? "")
  const [effectiveFrom, setEffectiveFrom] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [confirm, setConfirm] = useState(false)
  const create = mode === "create"
  const editing = create && Boolean(template)
  async function save() {
    if (pending) return
    if (!create && (!employeeIds.length || !policyId || !effectiveFrom)) return
    setPending(true)
    setError("")
    const assignedIds: string[] = []
    try {
      if (create) {
        const input = {
          name,
          timeZone: zone,
          days: days.map(({ weekday, isWorkingDay, requiredMinutes }) => ({
            weekday,
            isWorkingDay,
            requiredMinutes,
          })),
          unpaidBreaksEnabled: breaks,
          overnightRequiresReview: overnight,
        }
        if (template) await updateAttendancePolicy(template.id, input)
        else await createAttendancePolicy(input)
      } else {
        for (const employeeId of employeeIds) {
          await assignAttendancePolicy({ employeeId, policyId, effectiveFrom })
          assignedIds.push(employeeId)
        }
      }
      sileo.success({
        title: editing
          ? "Attendance policy updated"
          : create
            ? "Attendance policy created"
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
                : "Couldn't assign the policy.",
          ),
      )
    } finally {
      setPending(false)
    }
  }
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
              : "Assign policy to employee"
        }
        description={
          editing
            ? "Update this policy for new workdays. Recorded workdays retain their original rules."
            : create
              ? "Configure working days and required hours with flexible starting times."
              : "Choose employees, a policy version, and an effective date. Recorded workdays retain their original requirements."
        }
        closeDisabled={pending || confirm}
      />
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          if (create) void save()
          else setConfirm(true)
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
              </SidePanelSection>
              <SidePanelSection title="Working days and daily required hours">
                <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3.5">
                  {days.map((day, index) => (
                    <div
                      key={day.weekday}
                      className="flex min-w-0 items-center justify-between gap-3 py-2.5"
                    >
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          className="mt-0.5"
                          checked={day.isWorkingDay}
                          onChange={(event) =>
                            setDays((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      isWorkingDay: event.target.checked,
                                      requiredMinutes: event.target.checked
                                        ? item.requiredMinutes
                                        : 0,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        {attendanceWeekNames[day.weekday]}
                      </label>
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
                          setDays((current) =>
                            current.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    requiredMinutes: Math.round(
                                      Number(event.target.value) * 60,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </SidePanelSection>
              <SidePanelSection title="Breaks and overnight work">
                <label className="flex items-start gap-2 text-xs leading-5">
                  <Checkbox
                    className="mt-1"
                    checked={breaks}
                    onChange={(event) => setBreaks(event.target.checked)}
                  />
                  Allow unpaid breaks. Only recorded break time is deducted.
                </label>
                <label className="flex items-start gap-2 text-xs leading-5">
                  <Checkbox
                    className="mt-1"
                    checked={overnight}
                    onChange={(event) => setOvernight(event.target.checked)}
                  />
                  Flag overnight sessions for review. Sessions stay open across
                  midnight and retain their starting workday.
                </label>
              </SidePanelSection>
            </>
          ) : (
            <AttendanceEmployeeSelection
              selectedIds={employeeIds}
              onChange={setEmployeeIds}
              disabled={pending || confirm}
              searchAction={
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
              }
              beforeList={
                <SidePanelSection title="Policy assignment" className="my-1">
                  <FilterSelect
                    label="Attendance policy"
                    placeholder="Choose a policy"
                    value={policyId}
                    options={policies.map((policy) => ({
                      value: policy.id,
                      label: `${policy.name} · ${policy.timeZone}`,
                    }))}
                    onChange={setPolicyId}
                    disabled={pending || confirm}
                    triggerClassName="w-full"
                  />
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
            disabled={
              pending ||
              (!create && (!employeeIds.length || !policyId || !effectiveFrom))
            }
          >
            {pending
              ? "Saving…"
              : editing
                ? "Save policy"
                : create
                  ? "Create policy"
                  : "Assign policy"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
      {confirm && (
        <ConfirmationDialog
          title="Assign attendance policy?"
          subject={`${employeeIds.length} ${employeeIds.length === 1 ? "employee" : "employees"} selected`}
          description="Recorded workdays retain their original requirements. Previous policy versions will not be overwritten."
          confirmLabel="Confirm assignment"
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
