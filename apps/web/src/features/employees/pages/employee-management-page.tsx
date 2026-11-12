"use client"

import { Archive, UsersRound, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { SidePanelLoading } from "@/components/ui/panel-loading"
import { PlusIcon } from "@/components/layout/icons"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { useTableSearch } from "@/components/ui/use-table-search"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
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
  type Department,
} from "@/features/departments/api/departments-api"
import { sileo } from "@/lib/toast"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import {
  EmployeeKpiCards,
  type EmployeeKpiSummary,
} from "../components/employee-kpi-cards"
import { EmployeeTable } from "../components/employee-table"
import {
  setEmployeeLoginStatus,
  deleteEmployeeLogin,
  permanentlyDeleteEmployeeLogin,
  listEmployees,
  type Employee,
  type EmployeeList,
  type EmploymentStatus,
  type EmploymentType,
} from "../api/employees-api"

const ManageMembersDrawer = dynamic(
  () =>
    import("@/features/departments/components/manage-members-drawer").then(
      (module) => module.ManageMembersDrawer,
    ),
  { loading: () => <SidePanelLoading variant="edge" /> },
)
const EmployeeDetailsDrawer = dynamic(
  () =>
    import("../components/employee-details-drawer").then(
      (module) => module.EmployeeDetailsDrawer,
    ),
  { loading: () => <SidePanelLoading variant="edge" /> },
)
const EmployeeLoginPanel = dynamic(
  () =>
    import("../components/employee-login-panel").then(
      (module) => module.EmployeeLoginPanel,
    ),
  { loading: () => <SidePanelLoading variant="edge" /> },
)
const EmployeeFormPanel = dynamic(
  () =>
    import("../components/employee-form-panel").then(
      (module) => module.EmployeeFormPanel,
    ),
  { loading: () => <SidePanelLoading variant="edge" /> },
)
const employmentTypes: { value: EmploymentType | ""; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
]
const statuses: { value: EmploymentStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "INACTIVE", label: "Inactive" },
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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [footerResult, setFooterResult] = useState<EmployeeList | null>(null)
  const pendingResult = useRef<EmployeeList | null>(null)
  const settleRows = useCallback(() => {
    if (pendingResult.current) setFooterResult(pendingResult.current)
  }, [])
  const total = footerResult?.total ?? 0
  const pageSize = footerResult?.pageSize ?? 10
  const resolvedPage = footerResult?.page ?? 1
  const [page, setPage] = useState(1)
  const [animateRows, setAnimateRows] = useState(true)
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [departmentId, setDepartmentId] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("")
  const [status, setStatus] = useState<EmploymentStatus | "">("")
  const [errorMessage, setError] = useState("")
  const [errorRequestKey, setErrorRequestKey] = useState("")
  const [resolvedListKey, setResolvedListKey] = useState("")
  const [resolvedViewKey, setResolvedViewKey] = useState("")
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentsError, setDepartmentsError] = useState("")
  const [departmentsLoading, setDepartmentsLoading] = useState(true)
  const [revision, setRevision] = useState(0)
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
  const [loginAction, setLoginAction] = useState<
    "deactivate" | "reactivate" | "delete" | "permanent"
  >("deactivate")
  const [loginTarget, setLoginTarget] = useState<Employee | null>(null)
  const [loginActionPending, setLoginActionPending] = useState(false)
  const [loginActionError, setLoginActionError] = useState("")
  const listRequestKey = JSON.stringify({
    search: query,
    departmentId,
    employmentType,
    status,
    page,
    revision,
    archiveView,
  })
  const viewKey = JSON.stringify({
    search: query,
    departmentId,
    employmentType,
    status,
    page,
    archiveView,
  })
  const error = errorRequestKey === listRequestKey ? errorMessage : ""
  const isLoading =
    resolvedListKey !== listRequestKey || search.trim() !== query

  const searchScope = JSON.stringify([
    departmentId,
    employmentType,
    status,
    archiveView,
    revision,
  ])
  const { acceptRows, preview, previewing } = useTableSearch<Employee>({
    search: query,
    scope: searchScope,
    page,
    matches: matchesTableSearch,
  })
  const tableViewKey = previewing
    ? JSON.stringify([searchScope, query, 1])
    : resolvedViewKey

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    listEmployees({
      search: query,
      departmentId,
      employmentType,
      status,
      page,
      archived: archiveView,
      signal: controller.signal,
    })
      .then((result) => {
        if (active) {
          const lastPage = Math.max(
            1,
            Math.ceil(result.total / result.pageSize),
          )
          if (page > lastPage) {
            setPage(lastPage)
            return
          }
          acceptRows(result.employees)
          pendingResult.current = result
          setEmployees(result.employees)
          setError("")
          setResolvedListKey(listRequestKey)
          setResolvedViewKey(viewKey)
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setErrorRequestKey(listRequestKey)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load employees.",
          )
          setResolvedListKey(listRequestKey)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [
    query,
    departmentId,
    employmentType,
    status,
    page,
    revision,
    listRequestKey,
    archiveView,
    viewKey,
    acceptRows,
  ])

  // Overview counts: one lightweight list request per status (totals only).
  const [summary, setSummary] = useState<EmployeeKpiSummary | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const count = (status: EmploymentStatus | "") =>
      listEmployees({ status, page: 1, signal: controller.signal }).then(
        (result) => result.total,
      )
    Promise.all([
      count(""),
      count("ACTIVE"),
      count("ON_LEAVE"),
      count("INACTIVE"),
    ])
      .then(([total, active, onLeave, inactive]) => {
        setSummary({ total, active, onLeave, inactive })
        setSummaryError(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSummaryError(true)
      })
    return () => controller.abort()
  }, [revision])

  const [departmentRevision, setDepartmentRevision] = useState(0)
  useEffect(() => {
    let active = true
    listDepartments()
      .then((items) => {
        if (active) {
          setDepartments(items)
          setDepartmentsError("")
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setDepartmentsError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load departments.",
          )
      })
      .finally(() => {
        if (active) setDepartmentsLoading(false)
      })
    return () => {
      active = false
    }
  }, [departmentRevision])

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = Boolean(query || departmentId || employmentType || status)
  const shownFrom = total === 0 ? 0 : (resolvedPage - 1) * pageSize + 1
  const shownTo = Math.min(resolvedPage * pageSize, total)

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Employee management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1
            id="employee-directory-heading"
            tabIndex={-1}
            className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground"
          >
            Employee Management
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Maintain employee records, team placement, and employment details.
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-[34px] flex-none cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#203f8c] px-[13px] text-xs leading-[1.2] font-semibold whitespace-nowrap text-white transition-[background-color,border-color,color] duration-150 hover:bg-[#172f70] motion-reduce:transition-none",
            focusRing,
          )}
          onClick={() => setFormState({ employee: null })}
        >
          <PlusIcon width="14" height="14" /> Create Employee
        </button>
      </header>

      {!archiveView && (
        <div className="mt-[18px] max-[560px]:mt-[14px]">
          <EmployeeKpiCards
            summary={
              summary ?? { total: 0, active: 0, onLeave: 0, inactive: 0 }
            }
            pending={summary === null && !summaryError}
            unavailable={summaryError && summary === null}
          />
        </div>
      )}

      <section
        className="mt-[18px] min-w-0 max-[767px]:mt-[14px]"
        aria-label="Employee directory"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 max-[560px]:flex-col max-[560px]:items-stretch max-[560px]:pb-3">
          <div
            role="group"
            aria-label="Employee view"
            className="order-last inline-flex flex-none rounded-lg border border-[#e1e4ea] bg-[#f3f5f8] p-0.5 max-[560px]:order-first max-[560px]:w-full"
          >
            {(
              [
                { archived: false, label: "Employees", icon: UsersRound },
                { archived: true, label: "Archive", icon: Archive },
              ] as const
            ).map(({ archived, label, icon: Icon }) => {
              const selected = archiveView === archived
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  disabled={loginActionPending}
                  onClick={() => switchView(archived)}
                  className={cn(
                    "inline-flex min-h-[30px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 px-3 text-xs font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                    selected
                      ? "bg-background text-foreground shadow-[0_1px_2px_rgb(20_45_97_/_12%)]"
                      : "bg-transparent text-[#65718a] hover:text-foreground",
                    focusRing,
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
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
            <Select
              value={departmentId || "all"}
              onValueChange={(value) =>
                updateFilters(() =>
                  setDepartmentId(value === "all" ? "" : value),
                )
              }
              disabled={departmentsLoading || Boolean(departmentsError)}
            >
              <SelectTrigger
                aria-label="Filter by department"
                className="h-[34px] w-[170px] flex-none border-[#e1e4ea] text-xs max-[560px]:w-full"
              >
                <SelectValue
                  placeholder={
                    departmentsLoading
                      ? "Loading departments…"
                      : "All departments"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={employmentType || "all"}
              onValueChange={(value) =>
                updateFilters(() =>
                  setEmploymentType(
                    value === "all" ? "" : (value as EmploymentType),
                  ),
                )
              }
            >
              <SelectTrigger
                aria-label="Filter by employment type"
                className="h-[34px] w-[140px] flex-none border-[#e1e4ea] text-xs max-[560px]:w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employmentTypes.map((item) => (
                  <SelectItem
                    key={item.value || "all"}
                    value={item.value || "all"}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || "all"}
              onValueChange={(value) =>
                updateFilters(() =>
                  setStatus(value === "all" ? "" : (value as EmploymentStatus)),
                )
              }
            >
              <SelectTrigger
                aria-label="Filter by employee status"
                className="h-[34px] w-[135px] flex-none border-[#e1e4ea] text-xs max-[560px]:w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((item) => (
                  <SelectItem
                    key={item.value || "all"}
                    value={item.value || "all"}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {departmentsError && (
            <div
              className="flex flex-none items-center gap-2 text-[11px] text-[#bc3649] max-[560px]:w-full"
              role="alert"
            >
              <span>{departmentsError}</span>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-0 border-0 bg-transparent p-0 font-semibold text-[#244993] shadow-none hover:bg-transparent"
                onClick={() => {
                  setDepartmentsLoading(true)
                  setDepartmentRevision((value) => value + 1)
                }}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
        <EmployeeTable
          archiveView={archiveView}
          employees={preview ?? employees}
          viewKey={tableViewKey}
          quickKey={query}
          onRowsSettled={settleRows}
          animateRows={animateRows}
          loading={isLoading}
          error={error}
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
          onRetry={() => {
            setRevision((value) => value + 1)
          }}
          onView={(employee) => setDrawerEmployeeId(employee.id)}
          onEdit={(employee) => setFormState({ employee })}
          onManageLogin={(employee, action) => {
            if (action === "create") {
              setCreateLoginTarget(employee)
              return
            }
            setLoginAction(action)
            setLoginActionError("")
            setLoginTarget(employee)
          }}
          onManageDepartment={
            canManageDepartment ? setMembersDepartmentId : undefined
          }
        />
        <TableSearchStatus active={isLoading && previewing} label="employees" />
        {!error && !previewing && total > 0 && (
          <footer className="flex items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:flex-wrap max-[560px]:pt-[14px]">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {shownFrom}–{shownTo} of {total}
            </span>
            <NumberedPagination
              page={resolvedPage}
              totalPages={totalPages}
              disabled={isLoading || footerResult?.employees !== employees}
              label="Employee pages"
              onPageChange={(nextPage) => {
                setAnimateRows(true)
                setPage(nextPage)
              }}
            />
          </footer>
        )}
        {!isLoading &&
          !error &&
          total > 0 &&
          footerResult?.employees === employees && (
            <p className="sr-only" aria-live="polite">
              {employees.length} employees shown on page {page}.
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
            setRevision((value) => value + 1)
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
          onChanged={() => setRevision((value) => value + 1)}
        />
      )}
      {createLoginTarget && (
        <EmployeeLoginPanel
          employee={createLoginTarget}
          onClose={() => setCreateLoginTarget(null)}
          onSaved={() => {
            setCreateLoginTarget(null)
            setRevision((value) => value + 1)
            sileo.success({ title: "Login account created" })
          }}
        />
      )}
      {loginTarget && (
        <ConfirmationDialog
          title={
            loginAction === "permanent"
              ? "Permanently delete account?"
              : loginAction === "delete"
                ? "Move account to Archive?"
                : loginAction === "reactivate"
                  ? "Reactivate account?"
                  : "Deactivate account?"
          }
          subject={loginTarget.fullName}
          description={
            loginAction === "permanent"
              ? "This permanently deletes the login account and its sessions. The employee's HR record, department, and team placement remain. Account-based leadership assignments are cleared. This cannot be undone."
              : loginAction === "delete"
                ? "This moves the deactivated account to Archive and ends its sessions. Its employee record and assignments are preserved. Permanent deletion is available only from Archive."
                : loginAction === "reactivate"
                  ? "Allow this employee to sign in again using their existing password. Their employment status stays the same."
                  : "This immediately signs the employee out and prevents login. You can reactivate the login later."
          }
          confirmLabel={
            loginAction === "permanent"
              ? "Delete permanently"
              : loginAction === "delete"
                ? "Move to Archive"
                : loginAction === "reactivate"
                  ? "Reactivate account"
                  : "Deactivate account"
          }
          pendingLabel={
            loginAction === "permanent"
              ? "Deleting…"
              : loginAction === "delete"
                ? "Archiving…"
                : loginAction === "reactivate"
                  ? "Reactivating…"
                  : "Deactivating…"
          }
          destructive={loginAction !== "reactivate"}
          pending={loginActionPending}
          error={loginActionError}
          onClose={() => {
            setLoginTarget(null)
            setLoginActionError("")
          }}
          onConfirm={() => {
            if (loginActionPending) return
            const isDeactivation = loginAction === "deactivate"
            setLoginActionPending(true)
            setLoginActionError("")
            const action =
              loginAction === "permanent"
                ? permanentlyDeleteEmployeeLogin(loginTarget.id)
                : loginAction === "delete"
                  ? deleteEmployeeLogin(loginTarget.id)
                  : setEmployeeLoginStatus(
                      loginTarget.id,
                      loginAction === "reactivate",
                    )
            void action
              .then(() => {
                setLoginTarget(null)
                sileo.success({
                  title: isDeactivation
                    ? "Account deactivated"
                    : loginAction === "reactivate"
                      ? "Account reactivated"
                      : loginAction === "delete"
                        ? "Account moved to Archive"
                        : "Account permanently deleted",
                  description: `${loginTarget.fullName}'s employee record was kept.`,
                })
                setRevision((value) => value + 1)
              })
              .catch((reason: unknown) => {
                setLoginActionError(
                  reason instanceof Error
                    ? reason.message
                    : "Couldn't update this login account.",
                )
              })
              .finally(() => setLoginActionPending(false))
          }}
        />
      )}
    </main>
  )
}
