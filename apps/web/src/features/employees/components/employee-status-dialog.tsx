import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getEmployeeStatusOptions,
  updateEmployee,
  type Employee,
  type EmployeeStatusOptions,
  type EmploymentStatus,
} from "../api/employees-api"
import { employmentStatusOptions } from "../model/employment"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

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
  const options = useAsyncResource<EmployeeStatusOptions>(
    (signal) => getEmployeeStatusOptions(employee.id, signal),
    [employee.departmentId, employee.id],
    { fallbackError: "Couldn't load department head options." },
  )
  const statusOptions = options.data ?? null
  const { loading: optionsLoading, error: optionsError } = options
  // The recommended replacement is preselected until the user picks one.
  const [replacementChoice, setReplacementHeadEmployeeId] = useState<
    string | null
  >(null)
  const replacementHeadEmployeeId =
    replacementChoice ?? statusOptions?.recommendedReplacementEmployeeId ?? ""
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

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
      setError(errorMessage(reason, "Couldn't change the employee status."))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal size="sm" busy={pending} closeOnOutsideClick onClose={onClose}>
      <ModalHeader
        title="Change employee status"
        description={`Choose the employment status for ${employee.fullName}. This does not change their account access.`}
        closeLabel="Close status dialog"
        closeDisabled={pending}
      />
      <ModalBody className="gap-3">
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
              {employmentStatusOptions.map(({ value, label }) => (
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
          <Alert as="div" className="grid gap-2">
            <p className="m-0">{optionsError}</p>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-0 w-fit border-0 bg-transparent p-0 font-semibold text-[#244993] shadow-none hover:bg-transparent"
              disabled={optionsLoading || pending}
              onClick={options.retry}
            >
              Try again
            </Button>
          </Alert>
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
                <Alert as="span" className="block font-normal">
                  No active Staff member with an EXP account is available.
                  Assign a department head first.
                </Alert>
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
        {error && <Alert>{error}</Alert>}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="brandOutline"
          size="modal"
          type="button"
          className="cursor-pointer shadow-none"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="brand"
          size="modal"
          type="button"
          className="cursor-pointer shadow-none"
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
      </ModalFooter>
    </Modal>
  )
}
