import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  getEmployeeStatusOptions,
  updateEmployee,
  type Employee,
  type EmployeeStatusOptions,
  type EmploymentStatus,
} from "../api/employees-api"

const statusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
}

export function EmployeeStatusDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<EmploymentStatus>(
    employee.status ?? "ACTIVE",
  )
  const [replacementHeadEmployeeId, setReplacementHeadEmployeeId] = useState("")
  const [statusOptions, setStatusOptions] =
    useState<EmployeeStatusOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState("")
  const [optionsRevision, setOptionsRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    getEmployeeStatusOptions(employee.id)
      .then((options) => {
        if (!active) return
        setStatusOptions(options)
        setReplacementHeadEmployeeId(
          options.recommendedReplacementEmployeeId ?? "",
        )
        setOptionsError("")
      })
      .catch((reason: unknown) => {
        if (active) {
          setOptionsError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load department head options.",
          )
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [employee.departmentId, employee.id, optionsRevision])

  const changingHeadStatus = Boolean(
    status !== "ACTIVE" &&
    status !== employee.status &&
    statusOptions?.isDepartmentHead,
  )

  async function submit() {
    if (
      pending ||
      status === employee.status ||
      !statusOptions ||
      (changingHeadStatus && !replacementHeadEmployeeId)
    )
      return
    setPending(true)
    setError("")
    try {
      await updateEmployee(employee.id, {
        status,
        ...(changingHeadStatus ? { replacementHeadEmployeeId } : {}),
      })
      onSaved()
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't change the employee status.",
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
        className="w-[min(440px,calc(100vw-28px))] gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <header className="p-5">
          <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
            Change employee status
          </DialogTitle>
          <DialogDescription className="mt-2 mb-0 text-xs leading-relaxed text-[#738096]">
            Choose the employment status for {employee.fullName}. This does not
            change their account access.
          </DialogDescription>
        </header>
        <div className="grid gap-3 px-5 pb-5">
          <label
            className="grid gap-1.5 text-xs font-semibold"
            htmlFor="employee-status-select"
          >
            Status
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as EmploymentStatus)
                setError("")
              }}
              disabled={pending}
            >
              <SelectTrigger
                id="employee-status-select"
                className="h-10 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {optionsLoading && (
            <p className="m-0 text-xs text-[#738096]" role="status">
              Checking department head assignment…
            </p>
          )}
          {optionsError && (
            <div
              className="grid gap-2 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
              role="alert"
            >
              <p className="m-0">{optionsError}</p>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-0 w-fit border-0 bg-transparent p-0 font-semibold text-[#244993] shadow-none hover:bg-transparent"
                disabled={optionsLoading || pending}
                onClick={() => {
                  setOptionsLoading(true)
                  setOptionsError("")
                  setOptionsRevision((value) => value + 1)
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {changingHeadStatus && statusOptions && (
            <div className="grid gap-2">
              <label
                className="grid gap-1.5 text-xs font-semibold"
                htmlFor="temporary-department-head"
              >
                Temporary department head
                {statusOptions.replacementCandidates.length > 0 ? (
                  <Select
                    value={replacementHeadEmployeeId}
                    onValueChange={(value) => {
                      setReplacementHeadEmployeeId(value)
                      setError("")
                    }}
                    disabled={pending}
                  >
                    <SelectTrigger
                      id="temporary-department-head"
                      className="h-10 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm"
                    >
                      <SelectValue placeholder="Choose a department member" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.replacementCandidates.map(
                        (candidate, index) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.fullName}
                            {candidate.email ? ` — ${candidate.email}` : ""}
                            {index === 0 ? " · Most senior" : ""}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="rounded-lg bg-[#fff0f1] p-3 font-normal text-[#bc3649]">
                    No active Staff member with an EXP account is available.
                    Assign a department head first.
                  </span>
                )}
              </label>
              {statusOptions.replacementCandidates.length > 0 && (
                <p className="m-0 text-[11px] font-normal text-[#738096]">
                  The longest-serving active member is selected by default. You
                  can choose someone else before confirming.
                </p>
              )}
            </div>
          )}
          {status === "ACTIVE" &&
            status !== employee.status &&
            statusOptions?.willRestoreOriginalHead && (
              <p className="m-0 rounded-lg bg-[#eef4ff] p-3 text-xs text-[#24437e]">
                Returning to Active will restore {employee.fullName} as the
                department head and remove the temporary assignment.
              </p>
            )}
          {error && (
            <p
              className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
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
            type="button"
            className={cn(
              "h-auto min-h-[38px] cursor-pointer rounded-[9px] border border-transparent bg-[#203f8c] px-[15px] text-xs font-semibold text-white shadow-none transition-colors hover:enabled:bg-[#172f70]",
            )}
            disabled={
              pending ||
              status === employee.status ||
              optionsLoading ||
              !statusOptions ||
              (changingHeadStatus && !replacementHeadEmployeeId)
            }
            onClick={() => void submit()}
          >
            {pending ? "Saving…" : "Confirm status"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
