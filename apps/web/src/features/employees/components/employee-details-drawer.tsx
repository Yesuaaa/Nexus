import { useEffect, useRef, useState } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  panelAssignButton,
  panelIconButton,
  panelSecondaryButton,
} from "@/features/departments/styles/member-panel-styles"
import {
  getEmployee,
  type Employee,
  type EmploymentStatus,
  type EmploymentType,
} from "../api/employees-api"

const typeNames: Record<EmploymentType, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
}
const statusNames: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5 border-b border-[#eceef1] py-3 last:border-b-0">
      <dt className="text-[11px] font-medium text-[#738096]">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-xs font-medium text-foreground">
        {children || (
          <span className="font-normal text-[#94a3b8]">Not provided</span>
        )}
      </dd>
    </div>
  )
}

export function EmployeeDetailsDrawer({
  employeeId,
  onClose,
  onEdit,
  onManageDepartment,
}: {
  employeeId: string
  onClose: () => void
  onEdit: (employee: Employee) => void
  onManageDepartment?: (departmentId: string) => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    getEmployee(employeeId)
      .then((item) => {
        if (active) {
          setEmployee(item)
          setLoadError("")
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load this employee.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [employeeId, revision])

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_40%)]"
        className="inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
          else
            (
              document.getElementById(`employee-actions-${employeeId}`) ??
              document.getElementById("employee-directory-heading")
            )?.focus()
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Employee details
            </SheetTitle>
            <SheetDescription className="sr-only">
              View personal and employment details.
            </SheetDescription>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs">
              <span className="truncate font-medium">
                {employee?.fullName ||
                  (loading ? "Loading employee…" : "Employee")}
              </span>
              {employee && <Pill>{employee.employeeId}</Pill>}
            </div>
          </div>
          <SheetClose asChild>
            <Button
              variant="outline"
              type="button"
              className={panelIconButton}
              aria-label="Close employee details"
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
          {loading ? (
            <div
              className="grid min-h-40 place-content-center text-xs text-[#7183a2]"
              role="status"
            >
              Loading employee details…
            </div>
          ) : loadError ? (
            <div
              className="grid min-h-40 place-content-center gap-3 text-center text-xs text-[#7183a2]"
              role="alert"
            >
              <p className="m-0">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
                onClick={() => {
                  setLoading(true)
                  setRevision((value) => value + 1)
                }}
              >
                Try again
              </Button>
            </div>
          ) : (
            employee && (
              <>
                <section
                  aria-label="Personal information"
                  className="grid gap-3"
                >
                  <h3 className="m-0 text-xs font-semibold">
                    Personal information
                  </h3>
                  <dl className="m-0 divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
                    <DetailRow label="Employee ID">
                      {employee.employeeId}
                    </DetailRow>
                    <DetailRow label="Full name">{employee.fullName}</DetailRow>
                    <DetailRow label="Email">{employee.email}</DetailRow>
                    <DetailRow label="Contact number">
                      {employee.contactNumber}
                    </DetailRow>
                  </dl>
                </section>
                <section
                  aria-label="Employment information"
                  className="mt-6 grid gap-3"
                >
                  <h3 className="m-0 text-xs font-semibold">
                    Employment information
                  </h3>
                  <dl className="m-0 divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
                    <DetailRow label="Position">{employee.position}</DetailRow>
                    <DetailRow label="Employment type">
                      {typeNames[employee.employmentType]}
                    </DetailRow>
                    <DetailRow label="Status">
                      {statusNames[employee.status]}
                    </DetailRow>
                    <DetailRow label="Start date">
                      {employee.startDate
                        ? new Date(employee.startDate).toLocaleDateString(
                            undefined,
                            { timeZone: "UTC" },
                          )
                        : null}
                    </DetailRow>
                    <DetailRow label="Department">
                      {employee.department?.name}
                    </DetailRow>
                    <DetailRow label="Team">{employee.team?.name}</DetailRow>
                  </dl>
                  {employee.departmentId && onManageDepartment && (
                    <Button
                      type="button"
                      variant="outline"
                      className={panelSecondaryButton}
                      onClick={() => onManageDepartment(employee.departmentId!)}
                    >
                      Manage department members &amp; teams
                    </Button>
                  )}
                </section>
              </>
            )
          )}
        </div>
        <footer className="flex flex-none justify-between gap-3 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
          <Button
            variant="outline"
            type="button"
            className={panelSecondaryButton}
            disabled={!employee || loading}
            onClick={() => employee && onEdit(employee)}
          >
            Edit employee
          </Button>
          <SheetClose asChild>
            <Button
              type="button"
              className={panelAssignButton}
              aria-label="Done viewing employee details"
            >
              Done
            </Button>
          </SheetClose>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
