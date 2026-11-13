import { FormInput } from "@/components/ui/form-input"
import { formFieldClass } from "@/components/ui/form-control-styles"
import { Form } from "@/components/ui/form"
import { useRef, useState, type FormEvent } from "react"
import { focusRing } from "@/components/layout/styles"
import {
  SidePanel,
  SidePanelAlert,
  SidePanelBody,
  SidePanelButton,
  SidePanelFieldset,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { PasswordInput } from "@/components/ui/password-input"
import { RequiredMark } from "@/components/ui/required-mark"
import { DateInput } from "@/components/ui/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getDepartment } from "@/features/departments/api/departments-api"
import { useDepartments } from "@/features/departments/hooks/use-departments"
import {
  createEmployee,
  createEmployeeProfile,
  updateEmployee,
  type Employee,
  type EmploymentType,
} from "../api/employees-api"
import {
  validateEmployeeDraft,
  employeeFieldAfterInteraction,
  visibleEmployeeError,
  type EmployeeDraft,
  type EmployeeField,
} from "../model/validation"
import { employmentTypeOptions } from "../model/employment"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

const fieldClass = `${formFieldClass} grid-rows-[16px_40px_16px]`
const inputClass = `h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm placeholder:text-[#9aa8bb] ${focusRing}`
const selectClass = `h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm ${focusRing}`
/** Retry action on its own line inside a SidePanelAlert. */
const retryButtonClass = `mt-2 block cursor-pointer rounded border-0 bg-transparent p-0 font-semibold text-[#244993] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

function RequiredFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-4 min-w-0 items-center gap-1 whitespace-nowrap leading-4">
      {children}
      <RequiredMark />
    </span>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p
      id={id}
      className="m-0 h-4 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-4 text-[#bc3649]"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </p>
  )
}

const fieldIds: Record<EmployeeField, string> = {
  employeeId: "employee-id",
  fullName: "employee-full-name",
  email: "employee-email",
  contactNumber: "employee-contact-number",
  position: "employee-position",
  employmentType: "employee-employment-type",
  departmentId: "employee-department",
  teamId: "employee-team",
  startDate: "employee-start-date",
  password: "employee-password",
  passwordConfirmation: "employee-password-confirmation",
}

function toDraft(employee?: Employee | null): EmployeeDraft {
  return {
    employeeId: employee?.employeeId
      ? `EXP-${employee.employeeId.replace(/^[^-]+-/, "")}`
      : "EXP-",
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    contactNumber: employee?.contactNumber ?? "",
    position: employee?.position ?? "",
    employmentType: employee?.employmentType ?? "",
    startDate: employee?.startDate?.slice(0, 10) ?? "",
    departmentId: employee?.departmentId ?? "",
    teamId: employee ? (employee.teamId ?? "none") : "",
    password: "",
    passwordConfirmation: "",
  }
}

export function EmployeeFormPanel({
  employee,
  onClose,
  onSaved,
}: {
  employee?: Employee | null
  onClose: () => void
  onSaved: (employee: Employee) => void
}) {
  const isEditing = Boolean(employee)
  const needsAccount = !isEditing
  const [draft, setDraft] = useState(() => toDraft(employee))
  const [error, setError] = useState("")
  const [visibleErrorField, setVisibleErrorField] =
    useState<EmployeeField | null>(null)
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const panel = useSidePanel(onClose)
  const {
    departments,
    loading: loadingDepartments,
    error: departmentError,
    retry: retryDepartments,
  } = useDepartments()
  const teamList = useAsyncResource(
    (signal) => getDepartment(draft.departmentId, signal),
    [draft.departmentId],
    {
      enabled: Boolean(draft.departmentId),
      fallbackError: "Couldn't load department teams.",
    },
  )
  const loadingTeams = teamList.loading
  const teamError = teamList.error
  // Only show teams that belong to the selected department.
  const teams =
    !draft.departmentId || loadingTeams || teamError
      ? []
      : (teamList.data?.teams ?? [])

  const errors = validateEmployeeDraft(draft, needsAccount)

  function change<K extends keyof EmployeeDraft>(
    key: K,
    value: EmployeeDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError("")
  }

  function blur(field: EmployeeField) {
    setVisibleErrorField((current) =>
      employeeFieldAfterInteraction(current, {
        type: "blur",
        field,
        invalid: Boolean(errors[field]),
      }),
    )
  }

  function fieldError(field: EmployeeField) {
    return visibleEmployeeError(field, visibleErrorField, errors)
  }

  function validatedInputClass(field: EmployeeField) {
    return cn(
      inputClass,
      fieldError(field) &&
        "border-[#d64557] focus-visible:border-[#d64557] focus-visible:ring-0",
    )
  }

  function validatedSelectClass(field: EmployeeField) {
    return cn(
      selectClass,
      fieldError(field) &&
        "border-[#d64557] focus-visible:border-[#d64557] focus-visible:ring-0",
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      pending ||
      loadingDepartments ||
      departmentError ||
      (draft.departmentId && (loadingTeams || teamError))
    )
      return
    const firstInvalid = (Object.keys(errors) as EmployeeField[]).find(
      (field) => errors[field],
    )
    if (firstInvalid) {
      setVisibleErrorField(firstInvalid)
      formRef.current
        ?.querySelector<HTMLElement>(`#${fieldIds[firstInvalid]}`)
        ?.focus()
      return
    }
    const employeeId = draft.employeeId.trim()
    const fullName = draft.fullName.trim()
    const email = draft.email.trim()
    const contactNumber = draft.contactNumber.trim()
    const position = draft.position.trim()
    setPending(true)
    setError("")
    try {
      const input = {
        employeeId,
        fullName,
        email,
        contactNumber,
        position,
        employmentType: draft.employmentType as EmploymentType,
        startDate: `${draft.startDate}T00:00:00.000Z`,
        departmentId: draft.departmentId,
        teamId: draft.teamId === "none" ? null : draft.teamId,
        ...(needsAccount ? { password: draft.password } : {}),
      }
      const saved =
        employee?.hasEmployeeRecord === false && employee.accountId
          ? await createEmployeeProfile(employee.accountId, input)
          : employee
            ? await updateEmployee(employee.id, input)
            : await createEmployee(input)
      panel.close(() => onSaved(saved))
    } catch (reason: unknown) {
      setError(errorMessage(reason, "Couldn't save this employee."))
    } finally {
      setPending(false)
    }
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      dismissible={false}
      busy={pending}
    >
      <Form
        ref={formRef}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <SidePanelHeader
          title={
            employee?.hasEmployeeRecord === false
              ? "Complete employee details"
              : isEditing
                ? "Edit Employee"
                : "Add Employee"
          }
          description={
            draft.fullName.trim() || "Employment details, placement, and login."
          }
          closeLabel="Close employee form"
          closeDisabled={pending}
        />
        <SidePanelBody>
          {error && <SidePanelAlert>{error}</SidePanelAlert>}
          {departmentError && (
            <SidePanelAlert>
              {departmentError}
              <button
                type="button"
                className={retryButtonClass}
                disabled={loadingDepartments || pending}
                onClick={retryDepartments}
              >
                Retry departments
              </button>
            </SidePanelAlert>
          )}
          {teamError && draft.departmentId && (
            <SidePanelAlert>
              {teamError}
              <button
                type="button"
                className={retryButtonClass}
                disabled={loadingTeams || pending}
                onClick={teamList.retry}
              >
                Retry teams
              </button>
            </SidePanelAlert>
          )}
          <SidePanelFieldset
            title="Basic information"
            description="Identity and contact details."
          >
            <label className={fieldClass}>
              <RequiredFieldLabel>Employee ID</RequiredFieldLabel>
              <div className="flex min-w-0">
                <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-[#d6dfec] bg-[#eef1f8] px-3 text-sm text-[#52627a]">
                  EXP-
                </span>{" "}
                <FormInput
                  id="employee-id"
                  className="rounded-l-none"
                  value={draft.employeeId.replace(/^EXP-/, "")}
                  maxLength={36}
                  autoComplete="off"
                  placeholder="1042"
                  disabled={pending}
                  onChange={(event) =>
                    change(
                      "employeeId",
                      `EXP-${event.target.value.replace(/[^A-Za-z0-9_-]/g, "")}`,
                    )
                  }
                  onBlur={() => blur("employeeId")}
                  aria-invalid={Boolean(fieldError("employeeId"))}
                  aria-describedby={
                    fieldError("employeeId") ? "employee-id-error" : undefined
                  }
                  required
                />
              </div>
              <FieldError
                id="employee-id-error"
                message={fieldError("employeeId")}
              />
            </label>
            <label className={fieldClass}>
              <RequiredFieldLabel>Full Name</RequiredFieldLabel>
              <FormInput
                id="employee-full-name"
                value={draft.fullName}
                maxLength={100}
                autoComplete="name"
                placeholder="Employee Name"
                disabled={pending}
                onChange={(event) => change("fullName", event.target.value)}
                onBlur={() => blur("fullName")}
                aria-invalid={Boolean(fieldError("fullName"))}
                aria-describedby={
                  fieldError("fullName")
                    ? "employee-full-name-error"
                    : undefined
                }
                required
              />
              <FieldError
                id="employee-full-name-error"
                message={fieldError("fullName")}
              />
            </label>
            <label className={fieldClass}>
              <RequiredFieldLabel>Email</RequiredFieldLabel>
              <FormInput
                type="email"
                id="employee-email"
                value={draft.email}
                maxLength={254}
                autoComplete="email"
                placeholder="name@example.com"
                disabled={pending}
                onChange={(event) => change("email", event.target.value)}
                onBlur={() => blur("email")}
                aria-invalid={Boolean(fieldError("email"))}
                aria-describedby={
                  fieldError("email") ? "employee-email-error" : undefined
                }
                required
              />
              <FieldError
                id="employee-email-error"
                message={fieldError("email")}
              />
            </label>
            <label className={fieldClass}>
              <RequiredFieldLabel>Contact Number</RequiredFieldLabel>
              <FormInput
                type="tel"
                id="employee-contact-number"
                value={draft.contactNumber}
                inputMode="numeric"
                maxLength={11}
                autoComplete="tel"
                placeholder="09123456789"
                disabled={pending}
                onChange={(event) =>
                  change("contactNumber", event.target.value.replace(/\D/g, ""))
                }
                onBlur={() => blur("contactNumber")}
                aria-invalid={Boolean(fieldError("contactNumber"))}
                aria-describedby={
                  fieldError("contactNumber")
                    ? "employee-contact-number-error"
                    : undefined
                }
                required
              />
              <FieldError
                id="employee-contact-number-error"
                message={fieldError("contactNumber")}
              />
            </label>
          </SidePanelFieldset>
          <SidePanelFieldset
            title="Employment"
            description="Role, contract type, and start date."
          >
            <label className={cn(fieldClass, "sm:col-span-2")}>
              <RequiredFieldLabel>Position</RequiredFieldLabel>
              <FormInput
                id="employee-position"
                value={draft.position}
                maxLength={100}
                placeholder="Job Title"
                disabled={pending}
                onChange={(event) => change("position", event.target.value)}
                onBlur={() => blur("position")}
                aria-invalid={Boolean(fieldError("position"))}
                aria-describedby={
                  fieldError("position") ? "employee-position-error" : undefined
                }
                required
              />
              <FieldError
                id="employee-position-error"
                message={fieldError("position")}
              />
            </label>
            <div className={fieldClass}>
              <RequiredFieldLabel>Employment Type</RequiredFieldLabel>
              <Select
                value={draft.employmentType}
                onValueChange={(value) =>
                  change("employmentType", value as EmploymentType)
                }
                disabled={pending}
              >
                <SelectTrigger
                  id="employee-employment-type"
                  className={validatedSelectClass("employmentType")}
                  aria-label="Employment type"
                  aria-required="true"
                  aria-invalid={Boolean(fieldError("employmentType"))}
                  aria-describedby={
                    fieldError("employmentType")
                      ? "employee-employment-type-error"
                      : undefined
                  }
                  onBlur={() => blur("employmentType")}
                >
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypeOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                id="employee-employment-type-error"
                message={fieldError("employmentType")}
              />
            </div>
            <label className={fieldClass}>
              <RequiredFieldLabel>Start Date</RequiredFieldLabel>
              <DateInput
                type="date"
                id="employee-start-date"
                className={validatedInputClass("startDate")}
                value={draft.startDate}
                disabled={pending}
                onChange={(event) => change("startDate", event.target.value)}
                onBlur={() => blur("startDate")}
                aria-invalid={Boolean(fieldError("startDate"))}
                aria-describedby={
                  fieldError("startDate")
                    ? "employee-start-date-error"
                    : undefined
                }
                required
              />
              <FieldError
                id="employee-start-date-error"
                message={fieldError("startDate")}
              />
            </label>
          </SidePanelFieldset>
          <SidePanelFieldset
            title="Placement"
            description="Where this employee sits in the organization."
          >
            <div className={fieldClass}>
              <RequiredFieldLabel>Department</RequiredFieldLabel>
              <Select
                value={draft.departmentId}
                onValueChange={(value) => {
                  const nextDepartmentId = value
                  change("departmentId", nextDepartmentId)
                  change("teamId", "")
                  setError("")
                }}
                disabled={pending || loadingDepartments}
              >
                <SelectTrigger
                  id="employee-department"
                  className={validatedSelectClass("departmentId")}
                  aria-label="Department"
                  aria-required="true"
                  aria-invalid={Boolean(fieldError("departmentId"))}
                  aria-describedby={
                    fieldError("departmentId")
                      ? "employee-department-error"
                      : undefined
                  }
                  onBlur={() => blur("departmentId")}
                >
                  <SelectValue
                    placeholder={
                      loadingDepartments
                        ? "Loading departments…"
                        : "Select a department"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                id="employee-department-error"
                message={fieldError("departmentId")}
              />
            </div>
            <div className={fieldClass}>
              <RequiredFieldLabel>Team</RequiredFieldLabel>
              <Select
                value={draft.teamId}
                onValueChange={(value) => change("teamId", value)}
                disabled={
                  pending ||
                  !draft.departmentId ||
                  loadingTeams ||
                  Boolean(teamError)
                }
              >
                <SelectTrigger
                  id="employee-team"
                  className={validatedSelectClass("teamId")}
                  aria-label="Team"
                  aria-required="true"
                  aria-invalid={Boolean(fieldError("teamId"))}
                  aria-describedby={
                    fieldError("teamId") ? "employee-team-error" : undefined
                  }
                  onBlur={() => blur("teamId")}
                >
                  <SelectValue
                    placeholder={
                      !draft.departmentId
                        ? "Choose a department first"
                        : loadingTeams
                          ? "Loading teams…"
                          : "Select a team"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                id="employee-team-error"
                message={fieldError("teamId")}
              />
            </div>
          </SidePanelFieldset>
          {needsAccount && (
            <SidePanelFieldset
              title="Login account"
              description="Saving creates an active Staff account for this employee."
            >
              <label className={fieldClass}>
                <RequiredFieldLabel>Password</RequiredFieldLabel>
                <PasswordInput
                  id="employee-password"
                  toggleLabel="password"
                  value={draft.password}
                  autoComplete="new-password"
                  placeholder="At least 12 characters"
                  disabled={pending}
                  onChange={(event) => change("password", event.target.value)}
                  onBlur={() => blur("password")}
                  aria-invalid={Boolean(fieldError("password"))}
                  aria-describedby={
                    fieldError("password")
                      ? "employee-password-error"
                      : undefined
                  }
                  required
                />
                <FieldError
                  id="employee-password-error"
                  message={fieldError("password")}
                />
              </label>
              <label className={fieldClass}>
                <RequiredFieldLabel>Confirm password</RequiredFieldLabel>
                <PasswordInput
                  id="employee-password-confirmation"
                  toggleLabel="confirm password"
                  value={draft.passwordConfirmation}
                  autoComplete="new-password"
                  placeholder="Enter the password again"
                  disabled={pending}
                  onChange={(event) =>
                    change("passwordConfirmation", event.target.value)
                  }
                  onBlur={() => blur("passwordConfirmation")}
                  aria-invalid={Boolean(fieldError("passwordConfirmation"))}
                  aria-describedby={
                    fieldError("passwordConfirmation")
                      ? "employee-password-confirmation-error"
                      : undefined
                  }
                  required
                />
                <FieldError
                  id="employee-password-confirmation-error"
                  message={fieldError("passwordConfirmation")}
                />
              </label>
            </SidePanelFieldset>
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
              loadingDepartments ||
              Boolean(departmentError) ||
              Boolean(draft.departmentId && (loadingTeams || teamError))
            }
          >
            {pending ? "Saving…" : isEditing ? "Save Employee" : "Add Employee"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
