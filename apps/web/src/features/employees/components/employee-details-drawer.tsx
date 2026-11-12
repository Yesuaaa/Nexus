import { useEffect, useState } from "react"
import { ConversationAvatar } from "@/features/request-conversations/components/conversation-avatar"
import { DepartmentPill } from "@/components/ui/department-pill"
import { Pill } from "@/components/ui/pill"
import { SheetClose } from "@/components/ui/sheet"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Skeleton } from "@/components/ui/skeleton"
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
const statusStyles: Record<
  EmploymentStatus,
  { label: string; className: string }
> = {
  ACTIVE: { label: "Active", className: "bg-[#dcf5e5] text-[#19703a]" },
  ON_LEAVE: { label: "On leave", className: "bg-[#fff3df] text-[#805316]" },
  INACTIVE: { label: "Inactive", className: "bg-[#fde4ea] text-[#b4234d]" },
}

function DetailsSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <span role="status" className="sr-only">
        Loading employee details…
      </span>
      {[4, 6].map((rows, section) => (
        <div key={section} className="grid gap-3">
          <Skeleton className="h-3.5 w-36" />
          <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3.5">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex justify-between gap-4 py-3">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
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
  const panel = useSidePanel(onClose)
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

  const status = employee?.status ? statusStyles[employee.status] : null

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(`employee-actions-${employeeId}`) ??
        document.getElementById("employee-directory-heading")
      }
    >
      <SidePanelHeader
        leading={
          employee ? (
            <ConversationAvatar
              name={employee.fullName}
              imageUrl={employee.imageUrl}
              className="size-11"
            />
          ) : (
            <Skeleton className="size-11 flex-none rounded-full" />
          )
        }
        title={
          employee?.fullName || (loading ? "Loading employee…" : "Employee")
        }
        titleClassName={!employee && loading ? "sr-only" : undefined}
        meta={
          !employee && loading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            status && <Pill className={status.className}>{status.label}</Pill>
          )
        }
        description={
          employee
            ? [employee.employeeId || "No employee ID", employee.position]
                .filter(Boolean)
                .join(" · ")
            : "View personal and employment details."
        }
        closeLabel="Close employee details"
      />
      <SidePanelBody>
        {loading ? (
          <DetailsSkeleton />
        ) : loadError ? (
          <SidePanelError
            message={loadError}
            onRetry={() => {
              setLoading(true)
              setRevision((value) => value + 1)
            }}
          />
        ) : (
          employee && (
            <>
              <SidePanelSection title="Personal information">
                <DetailList>
                  <DetailItem label="Employee ID">
                    {employee.employeeId}
                  </DetailItem>
                  <DetailItem label="Full name">{employee.fullName}</DetailItem>
                  <DetailItem label="Email">{employee.email}</DetailItem>
                  <DetailItem label="Contact number">
                    {employee.contactNumber}
                  </DetailItem>
                </DetailList>
              </SidePanelSection>
              <SidePanelSection
                title="Employment information"
                action={
                  employee.departmentId &&
                  onManageDepartment && (
                    <button
                      type="button"
                      className="cursor-pointer rounded border-0 bg-transparent p-0 text-xs font-semibold text-[#294a9b] hover:underline"
                      onClick={() =>
                        panel.close(() =>
                          onManageDepartment(employee.departmentId!),
                        )
                      }
                    >
                      Manage department
                    </button>
                  )
                }
              >
                <DetailList>
                  <DetailItem label="Position">{employee.position}</DetailItem>
                  <DetailItem label="Employment type">
                    {employee.employmentType
                      ? typeNames[employee.employmentType]
                      : null}
                  </DetailItem>
                  <DetailItem label="Status">{status?.label}</DetailItem>
                  <DetailItem label="Start date">
                    {employee.startDate
                      ? new Date(employee.startDate).toLocaleDateString(
                          undefined,
                          { timeZone: "UTC" },
                        )
                      : null}
                  </DetailItem>
                  <DetailItem label="Department">
                    {employee.department && (
                      <DepartmentPill department={employee.department} />
                    )}
                  </DetailItem>
                  <DetailItem label="Team">{employee.team?.name}</DetailItem>
                </DetailList>
              </SidePanelSection>
            </>
          )
        )}
      </SidePanelBody>
      <SidePanelFooter className="justify-between">
        <SidePanelButton
          variant="secondary"
          disabled={!employee || loading}
          onClick={() => employee && panel.close(() => onEdit(employee))}
        >
          Edit employee
        </SidePanelButton>
        <SheetClose asChild>
          <SidePanelButton aria-label="Done viewing employee details">
            Done
          </SidePanelButton>
        </SheetClose>
      </SidePanelFooter>
    </SidePanel>
  )
}
