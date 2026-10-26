import { useEffect, useRef, useState, type FormEvent } from "react"
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
  updateEmployee,
  type Employee,
  type EmploymentType,
} from "../api/employees-api"
import {
  validateEmployeeDraft,
  visibleEmployeeError,
  type EmployeeDraft,
  type EmployeeField,
  type EmployeeTouched,
} from "../model/validation"

const fieldClass =
  "grid min-w-0 gap-[7px] text-xs font-semibold text-foreground"
const inputClass = `h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm placeholder:text-[#9aa8bb] ${focusRing}`
const selectClass = `h-10 min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm ${focusRing}`
const employmentTypes: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
]

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="m-0 text-[11px] font-normal text-[#bc3649]">
      {message}
    </p>
  )
}

function toDraft(employee?: Employee | null): EmployeeDraft {
  return {
    employeeId: employee?.employeeId ?? "",
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    contactNumber: employee?.contactNumber ?? "",
    position: employee?.position ?? "",
    employmentType: employee?.employmentType ?? "FULL_TIME",
    startDate: employee?.startDate?.slice(0, 10) ?? "",
    departmentId: employee?.departmentId ?? "",
    teamId: employee?.teamId ?? "",
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
  const [draft, setDraft] = useState(() => toDraft(employee))
  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<DepartmentTeam[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(
    Boolean(employee?.departmentId),
  )
  const [error, setError] = useState("")
  const [touched, setTouched] = useState<EmployeeTouched>({})
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [departmentError, setDepartmentError] = useState("")
  const [departmentRevision, setDepartmentRevision] = useState(0)
  const [teamError, setTeamError] = useState("")
  const [teamRevision, setTeamRevision] = useState(0)
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

  const errors = validateEmployeeDraft(draft)

  function change<K extends keyof EmployeeDraft>(
    key: K,
    value: EmployeeDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError("")
  }

  function blur(field: EmployeeField) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function fieldError(field: EmployeeField) {
    return visibleEmployeeError(field, draft[field], errors, touched, submitted)
  }

  function validatedInputClass(field: EmployeeField) {
    return cn(
      inputClass,
      fieldError(field) &&
        "border-[#d64557] focus-visible:border-[#d64557] focus-visible:ring-0",
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (
      pending ||
      loadingDepartments ||
      departmentError ||
      (draft.departmentId && (loadingTeams || teamError))
    )
      return
    if (Object.keys(errors).length > 0) return
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
        email: email || null,
        contactNumber: contactNumber || null,
        position: position || null,
        employmentType: draft.employmentType,
        startDate: draft.startDate ? `${draft.startDate}T00:00:00.000Z` : null,
        departmentId: draft.departmentId || null,
        teamId: draft.teamId || null,
      }
      const saved = employee
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
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <form noValidate onSubmit={(event) => void submit(event)}>
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
            <div className="min-w-0">
              <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
                {isEditing ? "Edit employee" : "Add employee"}
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
            <label className={fieldClass}>
              Employee ID <span className="text-[#d04b56]">*</span>
              <Input
                id="employee-id"
                className={validatedInputClass("employeeId")}
                value={draft.employeeId}
                maxLength={40}
                autoComplete="off"
                placeholder="e.g. EMP-1042"
                disabled={pending}
                onChange={(event) => change("employeeId", event.target.value)}
                onBlur={() => blur("employeeId")}
                aria-invalid={Boolean(fieldError("employeeId"))}
                aria-describedby={
                  fieldError("employeeId") ? "employee-id-error" : undefined
                }
                required
              />
              <FieldError
                id="employee-id-error"
                message={fieldError("employeeId")}
              />
            </label>
            <label className={fieldClass}>
              Full name <span className="text-[#d04b56]">*</span>
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
              Email
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
              />
              <FieldError
                id="employee-email-error"
                message={fieldError("email")}
              />
            </label>
            <label className={fieldClass}>
              Contact number
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
              />
              <FieldError
                id="employee-contact-number-error"
                message={fieldError("contactNumber")}
              />
            </label>
            <label className={fieldClass}>
              Position
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
              />
              <FieldError
                id="employee-position-error"
                message={fieldError("position")}
              />
            </label>
            <div className={fieldClass}>
              Employment type
              <Select
                value={draft.employmentType}
                onValueChange={(value) =>
                  change("employmentType", value as EmploymentType)
                }
                disabled={pending}
              >
                <SelectTrigger
                  className={selectClass}
                  aria-label="Employment type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className={fieldClass}>
              Start date
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
              />
              <FieldError
                id="employee-start-date-error"
                message={fieldError("startDate")}
              />
            </label>
            <div className={fieldClass}>
              Department
              <Select
                value={draft.departmentId || "none"}
                onValueChange={(value) => {
                  const nextDepartmentId = value === "none" ? "" : value
                  setTeams([])
                  setLoadingTeams(Boolean(nextDepartmentId))
                  setTeamError("")
                  change("departmentId", nextDepartmentId)
                  change("teamId", "")
                  setError("")
                }}
                disabled={pending || loadingDepartments}
              >
                <SelectTrigger className={selectClass} aria-label="Department">
                  <SelectValue
                    placeholder={
                      loadingDepartments
                        ? "Loading departments…"
                        : "Select a department"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldClass}>
              Team
              <Select
                value={draft.teamId || "none"}
                onValueChange={(value) =>
                  change("teamId", value === "none" ? "" : value)
                }
                disabled={
                  pending ||
                  !draft.departmentId ||
                  loadingTeams ||
                  Boolean(teamError)
                }
              >
                <SelectTrigger className={selectClass} aria-label="Team">
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
              {teamError && draft.departmentId && (
                <div
                  className="rounded-lg bg-[#fff0f1] p-2.5 text-[11px] text-[#bc3649]"
                  role="alert"
                >
                  <p className="m-0">{teamError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1.5 h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
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
            </div>
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
