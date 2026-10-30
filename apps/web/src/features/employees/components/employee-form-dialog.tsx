import { useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, EyeOff } from "lucide-react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  listDepartments,
  getDepartment,
  type Department,
  type DepartmentTeam,
} from "@/features/departments/api/departments-api"
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

const fieldClass =
  "grid min-w-0 grid-rows-[16px_40px_16px] gap-y-[7px] text-xs font-semibold text-foreground"
const inputClass = `h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm placeholder:text-[#9aa8bb] ${focusRing}`
const selectClass = `h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm ${focusRing}`
const employmentTypes: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
]

function RequiredFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-4 min-w-0 items-center gap-1 whitespace-nowrap leading-4">
      {children}
      <span aria-hidden="true" className="text-[#d04b56]">
        *
      </span>
      <span className="sr-only">required</span>
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
      title={message}
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

export function EmployeeFormDialog({
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [draft, setDraft] = useState(() => toDraft(employee))
  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<DepartmentTeam[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(
    Boolean(employee?.departmentId),
  )
  const [error, setError] = useState("")
  const [visibleErrorField, setVisibleErrorField] =
    useState<EmployeeField | null>(null)
  const [pending, setPending] = useState(false)
  const [departmentError, setDepartmentError] = useState("")
  const [departmentRevision, setDepartmentRevision] = useState(0)
  const [teamError, setTeamError] = useState("")
  const [teamRevision, setTeamRevision] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )

  useEffect(() => {
    let active = true
    listDepartments()
      .then((items) => {
        if (active) {
          setDepartments(items)
          setDepartmentError("")
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setDepartmentError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load departments.",
          )
      })
      .finally(() => {
        if (active) setLoadingDepartments(false)
      })
    return () => {
      active = false
    }
  }, [departmentRevision])

  useEffect(() => {
    if (!draft.departmentId) return
    let active = true
    getDepartment(draft.departmentId)
      .then((detail) => {
        if (active) setTeams(detail.teams)
      })
      .catch((reason: unknown) => {
        if (active) {
          setTeams([])
          setTeamError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load department teams.",
          )
        }
      })
      .finally(() => {
        if (active) setLoadingTeams(false)
      })
    return () => {
      active = false
    }
  }, [draft.departmentId, teamRevision])

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
      onSaved(saved)
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't save this employee.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        className="max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <form ref={formRef} noValidate onSubmit={(event) => void submit(event)}>
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
            <div className="min-w-0">
              <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
                {employee?.hasEmployeeRecord === false
                  ? "Complete employee details"
                  : isEditing
                    ? "Edit employee"
                    : "Add employee"}
              </DialogTitle>
              <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
                Keep employment details and team placement up to date.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              type="button"
              className="grid size-8 flex-none place-items-center rounded-[7px] border border-[#e1e4ea] bg-background p-0 text-[#65718a] shadow-none hover:bg-[#f1f5fc] disabled:opacity-50"
              aria-label="Close employee form"
              disabled={pending}
              onClick={onClose}
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </header>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {error && (
              <p
                className="sm:col-span-2 m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
                role="alert"
              >
                {error}
              </p>
            )}
            {departmentError && (
              <div
                className="sm:col-span-2 m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
                role="alert"
              >
                <p className="m-0">{departmentError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
                  disabled={loadingDepartments || pending}
                  onClick={() => {
                    setLoadingDepartments(true)
                    setDepartmentError("")
                    setDepartmentRevision((value) => value + 1)
                  }}
                >
                  Retry departments
                </Button>
              </div>
            )}
            {teamError && draft.departmentId && (
              <div
                className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649] sm:col-span-2"
                role="alert"
              >
                <p className="m-0">{teamError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
                  disabled={loadingTeams || pending}
                  onClick={() => {
                    setLoadingTeams(true)
                    setTeamError("")
                    setTeamRevision((value) => value + 1)
                  }}
                >
                  Retry teams
                </Button>
              </div>
            )}
            <label className={fieldClass}>
              <RequiredFieldLabel>Employee ID</RequiredFieldLabel>
              <div className="flex min-w-0">
                <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-[#d6dfec] bg-[#eef1f8] px-3 text-sm text-[#52627a]">
                  EXP-
                </span>{" "}
                <Input
                  id="employee-id"
                  className={cn(
                    validatedInputClass("employeeId"),
                    "rounded-l-none",
                  )}
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
              <RequiredFieldLabel>Full name</RequiredFieldLabel>
              <Input
                id="employee-full-name"
                className={validatedInputClass("fullName")}
                value={draft.fullName}
                maxLength={100}
                autoComplete="name"
                placeholder="Employee name"
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
              <Input
                type="email"
                id="employee-email"
                className={validatedInputClass("email")}
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
              <RequiredFieldLabel>Contact number</RequiredFieldLabel>
              <Input
                type="tel"
                id="employee-contact-number"
                className={validatedInputClass("contactNumber")}
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
            <label className={fieldClass}>
              <RequiredFieldLabel>Position</RequiredFieldLabel>
              <Input
                id="employee-position"
                className={validatedInputClass("position")}
                value={draft.position}
                maxLength={100}
                placeholder="Job title"
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
              <RequiredFieldLabel>Employment type</RequiredFieldLabel>
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
                  {employmentTypes.map((item) => (
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
              <RequiredFieldLabel>Start date</RequiredFieldLabel>
              <Input
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
            <div className={fieldClass}>
              <RequiredFieldLabel>Department</RequiredFieldLabel>
              <Select
                value={draft.departmentId}
                onValueChange={(value) => {
                  const nextDepartmentId = value
                  setTeams([])
                  setLoadingTeams(Boolean(nextDepartmentId))
                  setTeamError("")
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
                  <SelectItem value="none">No team</SelectItem>
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
            {needsAccount && (
              <>
                <label className={fieldClass}>
                  <RequiredFieldLabel>Password</RequiredFieldLabel>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      id="employee-password"
                      className={cn(validatedInputClass("password"), "pr-10")}
                      value={draft.password}
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                      disabled={pending}
                      onChange={(event) =>
                        change("password", event.target.value)
                      }
                      onBlur={() => blur("password")}
                      aria-invalid={Boolean(fieldError("password"))}
                      aria-describedby={
                        fieldError("password")
                          ? "employee-password-error"
                          : undefined
                      }
                      required
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      className={cn(
                        "absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-[#65718a]",
                        focusRing,
                      )}
                      disabled={pending}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    id="employee-password-error"
                    message={fieldError("password")}
                  />
                </label>
                <label className={fieldClass}>
                  <RequiredFieldLabel>Confirm password</RequiredFieldLabel>
                  <div className="relative">
                    <Input
                      type={showConfirmation ? "text" : "password"}
                      id="employee-password-confirmation"
                      className={cn(
                        validatedInputClass("passwordConfirmation"),
                        "pr-10",
                      )}
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
                    <button
                      type="button"
                      aria-label={
                        showConfirmation
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      aria-pressed={showConfirmation}
                      className={cn(
                        "absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-[#65718a]",
                        focusRing,
                      )}
                      disabled={pending}
                      onClick={() => setShowConfirmation((value) => !value)}
                    >
                      {showConfirmation ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    id="employee-password-confirmation-error"
                    message={fieldError("passwordConfirmation")}
                  />
                </label>
                <p className="m-0 text-[11px] leading-4 font-normal text-[#738096] sm:col-span-2">
                  Saving creates an active Staff account for this employee.
                </p>
              </>
            )}
          </div>
          <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:px-6">
            <Button
              variant="outline"
              type="button"
              className={cn(
                "h-auto min-h-[38px] cursor-pointer rounded-[9px] border-[#d7e0ee] bg-background px-[15px] text-xs font-semibold text-[#24437e] shadow-none transition-colors hover:enabled:bg-[#f1f5fc]",
              )}
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(
                "h-auto min-h-[38px] cursor-pointer rounded-[9px] border border-transparent bg-[#203f8c] px-[15px] text-xs font-semibold text-white shadow-none transition-colors hover:enabled:bg-[#172f70]",
              )}
              disabled={
                pending ||
                loadingDepartments ||
                Boolean(departmentError) ||
                Boolean(draft.departmentId && (loadingTeams || teamError))
              }
            >
              {pending
                ? "Saving…"
                : isEditing
                  ? "Save employee"
                  : "Add employee"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
