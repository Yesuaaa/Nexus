"use client"

import { useEffect, useState } from "react"
import { PlusIcon, SearchIcon } from "@/components/layout/icons"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Input } from "@/components/ui/input"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
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
import { EmployeeFormDialog } from "../components/employee-form-dialog"
import { EmployeeStatusDialog } from "../components/employee-status-dialog"
import { EmployeeTable } from "../components/employee-table"
import {
  deactivateEmployeeLogin,
  deleteEmployeeLogin,
  listEmployees,
  type Employee,
  type EmploymentStatus,
  type EmploymentType,
} from "../api/employees-api"

const employmentTypes: { value: EmploymentType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
]
const statuses: { value: EmploymentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "INACTIVE", label: "Inactive" },
]

export function EmployeeManagementPage() {
  const actor = usePortalAccount()
  const canManageDepartment = hasPermission(
    actor,
    Permissions.DEPARTMENTS_MANAGE,
  )
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [resolvedPage, setResolvedPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("")
  const [status, setStatus] = useState<EmploymentStatus | "">("")
  const [error, setError] = useState("")
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
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null)
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
  })
  const viewKey = JSON.stringify({
    search: debouncedSearch,
    departmentId,
    employmentType,
    status,
    page,
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
    })
      .then((result) => {
        if (active) {
          setEmployees(result.employees)
          setTotal(result.total)
          setPageSize(result.pageSize)
          setResolvedPage(result.page)
          setError("")
          setResolvedListKey(listRequestKey)
          setResolvedViewKey(viewKey)
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
        <Button
          type="button"
          className={cn(
            "inline-flex min-h-[34px] flex-none cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#203f8c] px-[13px] text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#172f70]",
            focusRing,
          )}
          onClick={() => setFormState({ employee: null })}
        >
          <PlusIcon width="14" height="14" /> Add employee
        </Button>
      </header>

      <section
        className="mt-[18px] min-w-0 max-[767px]:mt-[14px]"
        aria-label="Employee directory"
      >
        <div className="flex items-start justify-between gap-3 pb-4 max-[560px]:flex-col max-[560px]:pb-3">
          <div className="flex min-w-0 gap-[10px] max-[1050px]:w-full max-[560px]:flex-col">
            <label className="flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[1050px]:w-[min(350px,100%)] max-[1050px]:flex-1 max-[560px]:w-full max-[560px]:flex-none">
              <SearchIcon width="17" height="17" className="flex-none" />
              <span className="sr-only">Search employees</span>
              <Input
                type="search"
                className="h-auto w-full min-w-0 border-0 bg-transparent p-0 text-xs text-foreground shadow-none outline-none placeholder:text-[#8a9ab1] focus-visible:ring-0 md:text-xs"
                placeholder="Search name, ID, email…"
                value={search}
                maxLength={100}
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
              />
            </label>
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
                <SelectItem value="all">All departments</SelectItem>
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
          employees={employees}
          viewKey={resolvedViewKey}
          loading={isLoading}
          error={error}
          emptyMessage={
            hasFilters
              ? "No employees match these filters. Try clearing a filter or search term."
              : "No employee records yet. Add an employee to get started."
          }
          onRetry={() => {
            setRevision((value) => value + 1)
          }}
          onView={(employee) => setDrawerEmployeeId(employee.id)}
          onEdit={(employee) => setFormState({ employee })}
          onChangeStatus={setStatusTarget}
          onManageLogin={(employee) => {
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
              disabled={isLoading}
              label="Employee pages"
              onPageChange={setPage}
            />
          </footer>
        )}
        {!isLoading && !error && total > 0 && (
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
      {loginTarget && (
        <ConfirmationDialog
          title={
            loginTarget.accountIsActive
              ? "Deactivate login account?"
              : "Delete login account?"
          }
          subject={loginTarget.fullName}
          description={
            loginTarget.accountIsActive
              ? "This immediately signs the employee out and prevents login. Their employee record and all assignments remain. Deactivation is required before login deletion."
              : "This removes the employee's portal login from Account Management. Their employee record and all department, team, position, and leadership assignments remain."
          }
          confirmLabel={
            loginTarget.accountIsActive
              ? "Deactivate login"
              : "Delete login account"
          }
          pendingLabel={
            loginTarget.accountIsActive ? "Deactivating…" : "Deleting…"
          }
          pending={loginActionPending}
          error={loginActionError}
          onClose={() => {
            setLoginTarget(null)
            setLoginActionError("")
          }}
          onConfirm={() => {
            if (loginActionPending) return
            const isDeactivation = loginTarget.accountIsActive === true
            setLoginActionPending(true)
            setLoginActionError("")
            const action = isDeactivation
              ? deactivateEmployeeLogin(loginTarget.id)
              : deleteEmployeeLogin(loginTarget.id)
            void action
              .then(() => {
                setLoginTarget(null)
                sileo.success({
                  title: isDeactivation
                    ? "Login account deactivated"
                    : "Login account deleted",
                  description: `${loginTarget.fullName}'s employee record and assignments were kept.`,
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
