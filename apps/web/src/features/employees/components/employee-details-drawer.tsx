import { Avatar } from "@/components/ui/avatar"
import { focusRing } from "@/components/layout/styles"
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
import { cn } from "@/lib/utils"
import { getEmployee, type Employee } from "../api/employees-api"
import {
  employmentStatusLabels,
  employmentStatusTones,
  employmentTypeLabels,
} from "../model/employment"
import { useAsyncResource } from "@/lib/use-async-resource"

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
  const resource = useAsyncResource(
    (signal) => getEmployee(employeeId, signal),
    [employeeId],
    { fallbackError: "Couldn't load this employee." },
  )
  const employee = resource.data ?? null
  const { loading, error: loadError } = resource

  const status = employee?.status ?? null

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
            <Avatar
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
            status && (
              <Pill tone={employmentStatusTones[status]}>
                {employmentStatusLabels[status]}
              </Pill>
            )
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
          <SidePanelError message={loadError} onRetry={resource.retry} />
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
                      className={cn(
                        "cursor-pointer rounded border-0 bg-transparent p-0 text-xs font-semibold text-[#294a9b] hover:underline",
                        focusRing,
                      )}
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
                      ? employmentTypeLabels[employee.employmentType]
                      : null}
                  </DetailItem>
                  <DetailItem label="Status">
                    {status && employmentStatusLabels[status]}
                  </DetailItem>
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
