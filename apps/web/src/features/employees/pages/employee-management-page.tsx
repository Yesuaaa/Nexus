"use client"

import { Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { PlusIcon } from "@/components/layout/icons"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
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
import { sileo } from "sileo"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { ManageMembersDrawer } from "@/features/departments/components/manage-members-drawer"
import { EmployeeDetailsDrawer } from "../components/employee-details-drawer"
import { EmployeeLoginDialog } from "../components/employee-login-dialog"
import { EmployeeFormDialog } from "../components/employee-form-dialog"
import { EmployeeStatusDialog } from "../components/employee-status-dialog"
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
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("")
  const [status, setStatus] = useState<EmploymentStatus | "">("")
  const [error, setError] = useState("")
  const [resolvedListKey, setResolvedListKey] = useState("")
  const [resolvedViewKey, setResolvedViewKey] = useState("")
  const [resolvedSearch, setResolvedSearch] = useState("")
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
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null)
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
    search: debouncedSearch,
    departmentId,
    employmentType,
    status,
    page,
    revision,
    archiveView,
  })
  const viewKey = JSON.stringify({
    search: debouncedSearch,
    departmentId,
    employmentType,
    status,
    page,
    archiveView,
  })
  const isLoading =
    resolvedListKey !== listRequestKey || search.trim() !== debouncedSearch

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 150)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    listEmployees({
      search: debouncedSearch,
      departmentId,
      employmentType,
      status,
      page,
      archived: archiveView,
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
          pendingResult.current = result
          setEmployees(result.employees)
          setError("")
          setResolvedListKey(listRequestKey)
          setResolvedViewKey(viewKey)
          setResolvedSearch(debouncedSearch)
        }
      })
      .catch((reason: unknown) => {
        if (active) {
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
    }
  }, [
    debouncedSearch,
    departmentId,
    employmentType,
    status,
    page,
    revision,
    listRequestKey,
    archiveView,
    viewKey,
  ])

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = Boolean(
    debouncedSearch || departmentId || employmentType || status,
  )
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

      <section
        className="mt-[18px] min-w-0 max-[767px]:mt-[14px]"
        aria-label="Employee directory"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 max-[560px]:flex-col max-[560px]:pb-3">
          <div className="flex min-w-0 flex-wrap gap-[10px] max-[560px]:w-full max-[560px]:flex-col">
            <SearchField
              label="Search employees"
              placeholder="Search name, ID, email…"
              value={search}
              maxLength={100}
              onChange={(event) => {
                setAnimateRows(true)
                setSearch(event.target.value)
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
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-[34px] flex-none cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-red-500 bg-background px-[12px] text-xs leading-[1.2] font-semibold whitespace-nowrap text-red-600 transition-[background-color,border-color,color] duration-150 hover:enabled:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
              focusRing,
            )}
            disabled={loginActionPending}
            aria-pressed={archiveView}
            onClick={() => {
              setArchiveView((current) => !current)
              setPage(1)
              setSearch("")
              setDebouncedSearch("")
              setDepartmentId("")
              setEmploymentType("")
              setStatus("")
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            {archiveView ? "Back to Employees" : "Archive"}
          </button>
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
          employees={employees}
          viewKey={resolvedViewKey}
          quickKey={resolvedSearch}
          onRowsSettled={settleRows}
          animateRows={animateRows}
          loading={isLoading}
          error={error}
          emptyMessage={
            debouncedSearch ? (
              <SearchEmptyState query={debouncedSearch} />
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
          onChangeStatus={setStatusTarget}
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
        {!error && total > 0 && (
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
        <EmployeeFormDialog
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
      {statusTarget && (
        <EmployeeStatusDialog
          employee={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={() => {
            setStatusTarget(null)
            setPage(1)
            sileo.success({ title: "Employee status updated" })
            setRevision((value) => value + 1)
          }}
        />
      )}
      {createLoginTarget && (
        <EmployeeLoginDialog
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
