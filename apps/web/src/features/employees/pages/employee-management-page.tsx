"use client"

import { Archive, UsersRound, X } from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"
import { SidePanelLoading } from "@/components/ui/panel-loading"
import { PlusIcon } from "@/components/layout/icons"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass, focusRing } from "@/components/layout/styles"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
import { cn } from "@/lib/utils"
import { useDepartments } from "@/features/departments/hooks/use-departments"
import { sileo } from "@/lib/toast"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import {
  EmployeeKpiCards,
  type EmployeeKpiSummary,
} from "../components/employee-kpi-cards"
import {
  EmployeeLoginActionDialog,
  type EmployeeLoginAction,
} from "../components/employee-login-action-dialog"
import { EmployeeTable } from "../components/employee-table"
import {
  listEmployees,
  type Employee,
  type EmploymentStatus,
  type EmploymentType,
} from "../api/employees-api"
import {
  employmentStatusOptions,
  employmentTypeOptions,
} from "../model/employment"
import { useAsyncResource } from "@/lib/use-async-resource"

const ManageMembersDrawer = dynamic(
  () =>
    import("@/features/departments/components/manage-members-drawer").then(
      (module) => module.ManageMembersDrawer,
    ),
  { loading: () => <SidePanelLoading /> },
)
const EmployeeDetailsDrawer = dynamic(
  () =>
    import("../components/employee-details-drawer").then(
      (module) => module.EmployeeDetailsDrawer,
    ),
  { loading: () => <SidePanelLoading /> },
)
const EmployeeLoginPanel = dynamic(
  () =>
    import("../components/employee-login-panel").then(
      (module) => module.EmployeeLoginPanel,
    ),
  { loading: () => <SidePanelLoading /> },
)
const EmployeeFormPanel = dynamic(
  () =>
    import("../components/employee-form-panel").then(
      (module) => module.EmployeeFormPanel,
    ),
  { loading: () => <SidePanelLoading /> },
)
const employmentTypes: { value: EmploymentType | ""; label: string }[] = [
  { value: "", label: "All Types" },
  ...employmentTypeOptions,
]
const statuses: { value: EmploymentStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  ...employmentStatusOptions,
]

function matchesTableSearch(item: Employee, query: string) {
  return [item.fullName, item.employeeId, item.email].some((value) =>
    value?.toLowerCase().includes(query),
  )
}

export function EmployeeManagementPage() {
  const actor = usePortalAccount()
  const canManageDepartment = hasPermission(
    actor,
    Permissions.DEPARTMENTS_MANAGE,
  )
  const [archiveView, setArchiveView] = useState(false)
  const [animateRows, setAnimateRows] = useState(true)
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [departmentId, setDepartmentId] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("")
  const [status, setStatus] = useState<EmploymentStatus | "">("")
  const [formState, setFormState] = useState<{
    employee: Employee | null
  } | null>(null)
  const [drawerEmployeeId, setDrawerEmployeeId] = useState<string | null>(null)
  const [membersDepartmentId, setMembersDepartmentId] = useState<string | null>(
    null,
  )
  const [returnEmployeeId, setReturnEmployeeId] = useState<string | null>(null)
  const [createLoginTarget, setCreateLoginTarget] = useState<Employee | null>(
    null,
  )
  const [loginAction, setLoginAction] =
    useState<EmployeeLoginAction>("deactivate")
  const [loginTarget, setLoginTarget] = useState<Employee | null>(null)
  const [loginActionPending, setLoginActionPending] = useState(false)

  const list = usePaginatedList({
    params: {
      search: query,
      departmentId,
      employmentType,
      status,
      archiveView,
    },
    load: ({ page, signal }) =>
      listEmployees({
        search: query,
        departmentId,
        employmentType,
        status,
        page,
        archived: archiveView,
        signal,
      }),
    rows: (result) => result.employees,
    matches: matchesTableSearch,
    initial: { employees: [], total: 0, page: 1, pageSize: 10 },
    fallbackError: "Couldn't load employees.",
  })
  const { setPage } = list

  // Overview counts: one lightweight list request per status (totals only).
  const summary = useAsyncResource<EmployeeKpiSummary>(
    async (signal) => {
      const count = (status: EmploymentStatus | "") =>
        listEmployees({ status, page: 1, signal }).then(
          (result) => result.total,
        )
      const [total, active, onLeave, inactive] = await Promise.all([
        count(""),
        count("ACTIVE"),
        count("ON_LEAVE"),
        count("INACTIVE"),
      ])
      return { total, active, onLeave, inactive }
    },
    [list.revision],
  )

  const departmentList = useDepartments()
  const departmentOptions = [
    { value: "", label: "All Departments" },
    ...departmentList.departments.map((department) => ({
      value: department.id,
      label: department.name,
    })),
  ]

  function updateFilters(update: () => void) {
    update()
    setAnimateRows(true)
    setPage(1)
  }

  function switchView(nextArchiveView: boolean) {
    if (nextArchiveView === archiveView) return
    setArchiveView(nextArchiveView)
    setAnimateRows(true)
    setPage(1)
    setSearch("")
    setDepartmentId("")
    setEmploymentType("")
    setStatus("")
  }

  function clearFilters() {
    updateFilters(() => {
      setSearch("")
      setDepartmentId("")
      setEmploymentType("")
      setStatus("")
    })
  }

  const hasFilters = Boolean(query || departmentId || employmentType || status)
  const shownRows = list.data?.employees.length ?? 0

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Employee management"
    >
      <PageHeader
        headingId="employee-directory-heading"
        title="Employee Management"
        description="Maintain employee records, team placement, and employment details."
        actions={
          <PageHeaderButton
            type="button"
            onClick={() => setFormState({ employee: null })}
          >
            <PlusIcon width="14" height="14" /> Create Employee
          </PageHeaderButton>
        }
      />

      {!archiveView && (
        <div className="mt-[18px] max-[560px]:mt-[14px]">
          <EmployeeKpiCards
            summary={
              summary.data ?? { total: 0, active: 0, onLeave: 0, inactive: 0 }
            }
            pending={!summary.data && !summary.error}
            unavailable={Boolean(summary.error) && !summary.data}
          />
        </div>
      )}

      <section
        className="mt-[18px] min-w-0 max-[767px]:mt-[14px]"
        aria-label="Employee directory"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 max-[560px]:flex-col max-[560px]:items-stretch max-[560px]:pb-3">
          <ManagementViewToggle
            active={archiveView}
            ariaLabel="Employee view"
            views={[
              { value: false, label: "Employees", icon: UsersRound },
              { value: true, label: "Archive", icon: Archive },
            ]}
            disabled={loginActionPending}
            className="order-last max-[560px]:order-first max-[560px]:w-full"
            onChange={switchView}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-[10px] max-[560px]:w-full max-[560px]:flex-col max-[560px]:items-stretch">
            <SearchField
              label="Search employees"
              placeholder="Search name, ID, email…"
              value={search}
              maxLength={100}
              onChange={(event) => {
                setAnimateRows(true)
                setSearch(event.target.value)
                setPage(1)
              }}
            />
            <FilterSelect
              label="Filter by department"
              value={departmentId}
              options={departmentOptions}
              triggerClassName="w-[170px]"
              disabled={departmentList.loading || Boolean(departmentList.error)}
              onChange={(value) => updateFilters(() => setDepartmentId(value))}
            />
            <FilterSelect
              label="Filter by employment type"
              value={employmentType}
              options={employmentTypes}
              triggerClassName="w-[140px]"
              onChange={(value) =>
                updateFilters(() => setEmploymentType(value))
              }
            />
            <FilterSelect
              label="Filter by employee status"
              value={status}
              options={statuses}
              triggerClassName="w-[135px]"
              onChange={(value) => updateFilters(() => setStatus(value))}
            />
            {hasFilters && (
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-[34px] flex-none cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-xs font-semibold text-[#294a9b] hover:bg-[#eef2fa]",
                  focusRing,
                )}
                onClick={clearFilters}
              >
                <X size={13} aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>
          {departmentList.error && (
            <Alert
              as="div"
              variant="text"
              className="flex flex-none items-center gap-2 text-[11px] max-[560px]:w-full"
            >
              <span>{departmentList.error}</span>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-0 border-0 bg-transparent p-0 font-semibold text-[#244993] shadow-none hover:bg-transparent"
                onClick={departmentList.retry}
              >
                Retry
              </Button>
            </Alert>
          )}
        </div>
        <EmployeeTable
          archiveView={archiveView}
          employees={list.rows}
          viewKey={list.tableViewKey}
          quickKey={query}
          onRowsSettled={list.onRowsSettled}
          animateRows={animateRows}
          loading={list.loading}
          error={list.error}
          emptyMessage={
            query ? (
              <SearchEmptyState query={query} />
            ) : hasFilters ? (
              "No employees match these filters. Try clearing a filter or search term."
            ) : archiveView ? (
              "No archived accounts."
            ) : (
              "No employee records yet. Add an employee to get started."
            )
          }
          onRetry={list.retry}
          onView={(employee) => setDrawerEmployeeId(employee.id)}
          onEdit={(employee) => setFormState({ employee })}
          onManageLogin={(employee, action) => {
            if (action === "create") {
              setCreateLoginTarget(employee)
              return
            }
            setLoginAction(action)
            setLoginTarget(employee)
          }}
          onManageDepartment={
            canManageDepartment ? setMembersDepartmentId : undefined
          }
        />
        <TableSearchStatus
          active={list.loading && list.previewing}
          label="employees"
        />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label="Employee pages"
            onPageChange={(nextPage) => {
              setAnimateRows(true)
              setPage(nextPage)
            }}
          />
        )}
        {list.settled && !list.error && list.footer && (
          <p className="sr-only" aria-live="polite">
            {shownRows} employees shown on page {list.page}.
          </p>
        )}
      </section>

      {formState && (
        <EmployeeFormPanel
          employee={formState.employee}
          onClose={() => setFormState(null)}
          onSaved={(saved) => {
            setFormState(null)
            setPage(1)
            sileo.success({
              title: formState.employee ? "Employee updated" : "Employee added",
              description: saved.fullName,
            })
            list.retry()
          }}
        />
      )}
      {drawerEmployeeId && (
        <EmployeeDetailsDrawer
          employeeId={drawerEmployeeId}
          onClose={() => setDrawerEmployeeId(null)}
          onEdit={(employee) => {
            setDrawerEmployeeId(null)
            setFormState({ employee })
          }}
          onManageDepartment={
            canManageDepartment
              ? (id) => {
                  setReturnEmployeeId(drawerEmployeeId)
                  setDrawerEmployeeId(null)
                  setMembersDepartmentId(id)
                }
              : undefined
          }
        />
      )}
      {membersDepartmentId && (
        <ManageMembersDrawer
          departmentId={membersDepartmentId}
          canManage={canManageDepartment}
          onClose={() => {
            setMembersDepartmentId(null)
            if (returnEmployeeId) setDrawerEmployeeId(returnEmployeeId)
            setReturnEmployeeId(null)
          }}
          onChanged={() => list.retry()}
        />
      )}
      {createLoginTarget && (
        <EmployeeLoginPanel
          employee={createLoginTarget}
          onClose={() => setCreateLoginTarget(null)}
          onSaved={() => {
            setCreateLoginTarget(null)
            list.retry()
            sileo.success({ title: "Login account created" })
          }}
        />
      )}
      {loginTarget && (
        <EmployeeLoginActionDialog
          key={`${loginAction}-${loginTarget.id}`}
          action={loginAction}
          employee={loginTarget}
          pending={loginActionPending}
          onPendingChange={setLoginActionPending}
          onClose={() => setLoginTarget(null)}
          onCompleted={() => {
            setLoginTarget(null)
            list.retry()
          }}
        />
      )}
    </main>
  )
}
