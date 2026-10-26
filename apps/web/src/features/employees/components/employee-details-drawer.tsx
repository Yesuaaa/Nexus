import { useEffect, useRef, useState } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  panelAssignButton,
  panelField,
  panelIconButton,
  panelInput,
  panelMuted,
  panelSecondaryButton,
} from "@/features/departments/styles/member-panel-styles"
import {
  getEmployee,
  listEmployeeAccountOptions,
  updateEmployee,
  type Employee,
  type EmployeeAccountOption,
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
  onChanged,
  onManageDepartment,
}: {
  employeeId: string
  onClose: () => void
  onEdit: (employee: Employee) => void
  onChanged: () => void
  onManageDepartment?: (departmentId: string) => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [accountSearch, setAccountSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [accountPage, setAccountPage] = useState(1)
  const [options, setOptions] = useState<EmployeeAccountOption[]>([])
  const [optionsTotal, setOptionsTotal] = useState(0)
  const [optionsPageSize, setOptionsPageSize] = useState(20)
  const [optionsResolvedKey, setOptionsResolvedKey] = useState("")
  const [optionsError, setOptionsError] = useState("")
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState("")
  const [confirmTarget, setConfirmTarget] = useState<{
    user: EmployeeAccountOption | null
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const optionsRequestKey = `${employeeId}:${debouncedSearch}:${accountPage}:${revision}`
  const optionsBusy =
    optionsResolvedKey !== optionsRequestKey ||
    accountSearch.trim() !== debouncedSearch

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(accountSearch.trim())
      setAccountPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [accountSearch])

  useEffect(() => {
    let active = true
    listEmployeeAccountOptions(debouncedSearch, accountPage, employeeId)
      .then((result) => {
        if (active) {
          setOptions(result.users)
          setOptionsTotal(result.total)
          setOptionsPageSize(result.pageSize)
          setOptionsError("")
          setOptionsResolvedKey(optionsRequestKey)
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setOptionsError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load available accounts.",
          )
          setOptionsResolvedKey(optionsRequestKey)
        }
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, accountPage, employeeId, revision, optionsRequestKey])

  async function confirmAccountChange() {
    if (!confirmTarget || pending) return
    setPending(true)
    setLoading(true)
    setActionError("")
    try {
      await updateEmployee(employeeId, {
        userId: confirmTarget.user?.id ?? null,
      })
      setConfirmTarget(null)
      setRevision((value) => value + 1)
      onChanged()
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Couldn't update the linked account.",
      )
      setLoading(false)
      setConfirmTarget(null)
    } finally {
      setPending(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(optionsTotal / optionsPageSize))
  const rangeStart =
    optionsTotal === 0 ? 0 : (accountPage - 1) * optionsPageSize + 1
  const rangeEnd = Math.min(accountPage * optionsPageSize, optionsTotal)

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
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
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Employee details
            </SheetTitle>
            <SheetDescription className="sr-only">
              View employment details and manage the linked account.
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
              disabled={pending}
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </SheetClose>
        </header>
        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <TabsList
            className="flex h-auto flex-none justify-start gap-5 rounded-none border-b border-[#eceef1] bg-transparent px-6 py-0 max-[560px]:px-5"
            aria-label="Employee details sections"
          >
            {(["overview", "account"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "flex min-h-[46px] cursor-pointer items-center rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium text-[#738096] shadow-none hover:text-foreground data-[state=active]:border-b-[#0b0b0c] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  focusRing,
                )}
              >
                {tab === "overview" ? "Overview" : "Account"}
              </TabsTrigger>
            ))}
          </TabsList>
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
                  <TabsContent
                    value="overview"
                    className="mt-0 focus-visible:outline-none"
                  >
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
                        <DetailRow label="Full name">
                          {employee.fullName}
                        </DetailRow>
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
                        <DetailRow label="Position">
                          {employee.position}
                        </DetailRow>
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
                        <DetailRow label="Team">
                          {employee.team?.name}
                        </DetailRow>
                      </dl>
                      {employee.departmentId && onManageDepartment && (
                        <Button
                          type="button"
                          variant="outline"
                          className={panelSecondaryButton}
                          onClick={() =>
                            onManageDepartment(employee.departmentId!)
                          }
                        >
                          Manage department members &amp; teams
                        </Button>
                      )}
                    </section>
                  </TabsContent>
                  <TabsContent
                    value="account"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <section className="grid gap-4" aria-label="Linked account">
                      <div>
                        <h3 className="m-0 text-xs font-semibold">
                          Linked account
                        </h3>
                        <p className={`${panelMuted} mt-1 mb-0`}>
                          Link an existing account to this employee record.
                          Employee status does not change account access.
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#e8ebef] p-3">
                        {employee.user ? (
                          <>
                            <p
                              className="m-0 truncate text-xs font-semibold"
                              title={
                                employee.user.fullName || employee.user.email
                              }
                            >
                              {employee.user.fullName || employee.user.email}
                            </p>
                            <p
                              className="mt-1 mb-2 truncate text-[11px] text-[#738096]"
                              title={employee.user.email}
                            >
                              {employee.user.email}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill className="capitalize">
                                {employee.user.role.toLowerCase()}
                              </Pill>
                              <Pill
                                className={
                                  employee.user.isActive
                                    ? "bg-[#e8f5ed] text-[#246342]"
                                    : "bg-[#edf0f4] text-[#667085]"
                                }
                              >
                                {employee.user.isActive
                                  ? "Account active"
                                  : "Account inactive"}
                              </Pill>
                            </div>
                          </>
                        ) : (
                          <p className="m-0 text-xs text-[#738096]">
                            No account is linked to this employee.
                          </p>
                        )}
                      </div>
                      {actionError && (
                        <p
                          role="alert"
                          className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
                        >
                          {actionError}
                        </p>
                      )}
                      <div className="grid gap-2">
                        <label
                          className={panelField}
                          htmlFor="employee-account-search"
                        >
                          {employee.user
                            ? "Change linked account"
                            : "Find an account"}
                          <Input
                            id="employee-account-search"
                            className={panelInput}
                            value={accountSearch}
                            placeholder="Search by name or email"
                            disabled={pending}
                            onChange={(event) => {
                              setAccountSearch(event.target.value)
                            }}
                          />
                        </label>
                        <div className="overflow-hidden rounded-lg border border-[#e8ebef]">
                          {optionsBusy ? (
                            <p
                              className="m-0 p-4 text-center text-xs text-[#738096]"
                              role="status"
                            >
                              Loading accounts…
                            </p>
                          ) : optionsError ? (
                            <div
                              className="grid gap-2 p-4 text-center text-xs text-[#738096]"
                              role="alert"
                            >
                              <p className="m-0">{optionsError}</p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto min-h-0 border-0 bg-transparent p-0 font-bold text-[#244993] shadow-none hover:bg-transparent"
                                onClick={() => {
                                  setRevision((value) => value + 1)
                                }}
                              >
                                Try again
                              </Button>
                            </div>
                          ) : options.length ? (
                            <ul className="m-0 list-none divide-y divide-[#eceef1] p-0">
                              {options.map((user) => (
                                <li
                                  key={user.id}
                                  className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5"
                                >
                                  <div className="min-w-0">
                                    <p
                                      className="m-0 truncate text-xs font-medium"
                                      title={user.fullName || user.email}
                                    >
                                      {user.fullName || user.email}
                                    </p>
                                    <p className="mt-0.5 mb-0 truncate text-[11px] text-[#738096]">
                                      {user.email} · {user.role.toLowerCase()}
                                    </p>
                                  </div>
                                  {employee.userId === user.id ? (
                                    <span className="text-[11px] font-medium text-[#65718a]">
                                      Linked
                                    </span>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      type="button"
                                      className={cn(
                                        panelAssignButton,
                                        "h-8 px-3 text-[11px]",
                                      )}
                                      disabled={pending}
                                      onClick={() => {
                                        setActionError("")
                                        setConfirmTarget({ user })
                                      }}
                                    >
                                      {employee.user ? "Change" : "Link"}
                                    </Button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="m-0 p-4 text-center text-xs text-[#738096]">
                              {debouncedSearch
                                ? "No available accounts match this search."
                                : "No unlinked accounts are available."}
                            </p>
                          )}
                        </div>
                        {!optionsBusy && !optionsError && optionsTotal > 0 && (
                          <div className="flex items-center justify-between gap-3 text-[11px] text-[#65718a] max-[420px]:flex-wrap">
                            <span>
                              Showing {rangeStart}–{rangeEnd} of {optionsTotal}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  panelSecondaryButton,
                                  "min-h-[30px] px-3",
                                )}
                                disabled={accountPage <= 1 || pending}
                                onClick={() => {
                                  setAccountPage((page) => page - 1)
                                }}
                              >
                                Back
                              </Button>
                              <span aria-current="page">
                                {accountPage} / {totalPages}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  panelSecondaryButton,
                                  "min-h-[30px] px-3",
                                )}
                                disabled={accountPage >= totalPages || pending}
                                onClick={() => {
                                  setAccountPage((page) => page + 1)
                                }}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                        {employee.user && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-auto min-h-0 justify-self-start rounded-md border-0 bg-transparent px-0 py-1 text-xs font-semibold text-[#bc3649] shadow-none underline-offset-2 hover:bg-transparent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"
                            disabled={pending}
                            onClick={() => {
                              setActionError("")
                              setConfirmTarget({ user: null })
                            }}
                          >
                            Unlink account
                          </Button>
                        )}
                      </div>
                    </section>
                  </TabsContent>
                </>
              )
            )}
          </div>
        </Tabs>
        <footer className="flex flex-none justify-between gap-3 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
          <Button
            variant="outline"
            type="button"
            className={cn(panelSecondaryButton, "min-h-[34px]")}
            disabled={!employee || loading || pending}
            onClick={() => employee && onEdit(employee)}
          >
            Edit employee
          </Button>
          <SheetClose asChild>
            <Button type="button" className={panelAssignButton}>
              Done
            </Button>
          </SheetClose>
        </footer>
        {confirmTarget && (
          <ConfirmationDialog
            title={
              confirmTarget.user
                ? employee?.user
                  ? "Change linked account?"
                  : "Link account?"
                : "Unlink account?"
            }
            subject={
              confirmTarget.user
                ? `${confirmTarget.user.fullName || confirmTarget.user.email} · ${confirmTarget.user.email}`
                : (employee?.user?.email ?? "Current account")
            }
            description={
              confirmTarget.user
                ? "This account will be linked to the employee record. Account access and employee status remain separate."
                : "This removes the association only. The account and employee record will remain active as they are now."
            }
            confirmLabel={
              confirmTarget.user
                ? employee?.user
                  ? "Change account"
                  : "Link account"
                : "Unlink account"
            }
            pendingLabel="Saving…"
            pending={pending}
            destructive={!confirmTarget.user}
            error={actionError}
            onClose={() => {
              if (!pending) setConfirmTarget(null)
            }}
            onConfirm={() => void confirmAccountChange()}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
