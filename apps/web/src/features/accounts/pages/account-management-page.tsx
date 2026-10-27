"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { sileo } from "sileo"
import { cn } from "@/lib/utils"
import { contentClass } from "@/components/layout/styles"
import { Pill } from "@/components/ui/pill"
import { TableSortButton } from "@/components/ui/table-sort-button"
import { ApiError, clearToken } from "@/features/auth/api/auth-api"
import type { Account } from "@/features/auth/model/types"
import {
  canAssignRole,
  canChangeAccountStatus,
  canCreateRole,
} from "@/features/auth/model/permissions"
import {
  changeAccountRole,
  changeAccountStatus,
  deleteAccount,
  listAccounts,
  type AccountList,
  type AccountRole,
  type AccountSortDirection,
  type AccountSortKey,
} from "../api/accounts-api"
import { AccountDropdown } from "../components/account-dropdown"
import { AccountStatusDialog } from "../components/account-status-dialog"
import { AccountRowActions } from "../components/account-row-actions"
import { CreateAccountDialog } from "../components/create-account-dialog"
import { DeleteAccountDialog } from "../components/delete-account-dialog"
import {
  accountButton,
  accountButtonPrimary,
  accountFocusRing,
  accountGrid,
} from "../styles/account-styles"

const roleNames: Record<AccountRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "User",
}

const allRoles: AccountRole[] = ["USER", "STAFF", "ADMIN", "SUPERADMIN"]
const roleOptions = allRoles.map((role) => ({
  value: role,
  label: roleNames[role],
}))

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function AccountManagementPage() {
  const actor = usePortalAccount()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [sortKey, setSortKey] = useState<AccountSortKey>("createdAt")
  const [sortDirection, setSortDirection] =
    useState<AccountSortDirection>("desc")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<AccountList | null>(null)
  const [resolvedKey, setResolvedKey] = useState("")
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [draftRoles, setDraftRoles] = useState<
    Record<string, { role: AccountRole; email: string }>
  >({})
  const [savingAccess, setSavingAccess] = useState(false)
  const [accessError, setAccessError] = useState("")
  const [statusTarget, setStatusTarget] = useState<Account | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const requestKey = JSON.stringify([
    debouncedSearch,
    roleFilter,
    sortKey,
    sortDirection,
    page,
    revision,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    listAccounts(debouncedSearch, roleFilter, page, sortKey, sortDirection)
      .then((data) => {
        if (active) {
          setResult(data)
          setError("")
          setResolvedKey(requestKey)
        }
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          clearToken()
          router.replace("/login")
        } else if (caught instanceof ApiError && caught.status === 403) {
          window.location.replace("/dashboard")
        } else {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Couldn't load accounts. Please try again.",
          )
          setResolvedKey(requestKey)
        }
      })
    return () => {
      active = false
    }
  }, [
    debouncedSearch,
    roleFilter,
    page,
    revision,
    router,
    requestKey,
    sortDirection,
    sortKey,
  ])

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateRoleFilter(value: string) {
    setRoleFilter(value)
    setPage(1)
  }

  function sortBy(key: AccountSortKey) {
    if (sortKey === key) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection(key === "createdAt" ? "desc" : "asc")
    }
    setPage(1)
  }

  async function saveAccessChanges() {
    const changes = Object.entries(draftRoles)
    if (
      changes.length === 0 ||
      savingAccess ||
      statusSaving ||
      deleting ||
      busy
    )
      return
    setSavingAccess(true)
    setAccessError("")
    const savedIds: string[] = []
    const failures: string[] = []
    try {
      for (const [id, change] of changes) {
        try {
          await changeAccountRole(id, change.role)
          savedIds.push(id)
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 401) {
            clearToken()
            router.replace("/login")
            return
          }
          failures.push(
            `${change.email}: ${caught instanceof ApiError ? caught.message : "Please try again."}`,
          )
        }
      }
      if (failures.length > 0) {
        setAccessError(
          `${savedIds.length > 0 ? `Saved ${savedIds.length} access ${savedIds.length === 1 ? "change" : "changes"}. ` : ""}Couldn't save ${failures.length} ${failures.length === 1 ? "change" : "changes"}. ${failures.join(" ")}`,
        )
      } else {
        sileo.success({
          title: "Access updated",
          description: `Saved ${savedIds.length} access ${savedIds.length === 1 ? "change" : "changes"}.`,
        })
      }
    } finally {
      if (savedIds.length > 0) {
        setDraftRoles((current) => {
          const next = { ...current }
          for (const id of savedIds) delete next[id]
          return next
        })
        setRevision((current) => current + 1)
      }
      setSavingAccess(false)
    }
  }

  async function saveStatus() {
    if (!statusTarget || statusSaving) return
    setStatusSaving(true)
    setStatusError("")
    try {
      const isActive = !statusTarget.isActive
      await changeAccountStatus(statusTarget.id, isActive)
      sileo.success({
        title: isActive ? "Account reactivated" : "Account deactivated",
        description: isActive
          ? `${statusTarget.email} can sign in again.`
          : `${statusTarget.email} can no longer sign in.`,
      })
      setStatusTarget(null)
      setRevision((current) => current + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken()
        router.replace("/login")
        return
      }
      setStatusError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't update account status. Please try again.",
      )
    } finally {
      setStatusSaving(false)
    }
  }

  async function removeAccount() {
    if (!deleteTarget || deleteTarget.isActive || deleting) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteAccount(deleteTarget.id)
      const deletedEmail = deleteTarget.email
      setDraftRoles((current) => {
        const next = { ...current }
        delete next[deleteTarget.id]
        return next
      })
      setDeleteTarget(null)
      sileo.success({
        title: "Account deleted",
        description: `${deletedEmail} was permanently deleted.`,
      })
      if ((result?.users.length ?? 0) === 1 && page > 1) {
        setPage((current) => current - 1)
      } else {
        setRevision((current) => current + 1)
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken()
        router.replace("/login")
        return
      }
      setDeleteError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't delete the account. Please try again.",
      )
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1
  const creatableRoles = allRoles.filter((role) => canCreateRole(actor, role))
  const busy = resolvedKey !== requestKey || search !== debouncedSearch

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Account Management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Account Management
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            View portal accounts and manage their access.
          </p>
        </div>
        <button
          type="button"
          className={cn(
            accountButton,
            accountButtonPrimary,
            "min-h-[34px] flex-none rounded-lg px-[13px] text-xs",
          )}
          onClick={() => setCreateOpen(true)}
          disabled={savingAccess || statusSaving || deleting}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M7 2.5v9M2.5 7h9" />
          </svg>
          Create account
        </button>
      </header>

      <section
        className="mt-[18px] min-w-0 max-[560px]:mt-[14px]"
        aria-label="Accounts"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pb-4 max-[560px]:pb-3">
          <div className="flex min-w-0 gap-[10px] max-[560px]:flex-col">
            <label className="flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[1050px]:w-[min(350px,100%)] max-[1050px]:flex-1 max-[560px]:w-full max-[560px]:flex-none">
              <span className="sr-only">Search accounts</span>
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                className="w-full min-w-0 border-0 bg-transparent text-foreground outline-none placeholder:text-[#8a9ab1]"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search name or email"
                maxLength={100}
                disabled={savingAccess || statusSaving || deleting}
              />
            </label>
            <AccountDropdown
              className="max-[560px]:w-full"
              triggerClassName="h-[34px] min-w-[132px] border-[#e1e4ea] max-[560px]:min-w-0"
              label="Filter by role"
              value={roleFilter}
              options={[{ value: "", label: "All roles" }, ...roleOptions]}
              onChange={updateRoleFilter}
              disabled={savingAccess || statusSaving || deleting}
            />
          </div>
          <button
            type="button"
            className={cn(
              accountButton,
              accountButtonPrimary,
              "min-h-[34px] rounded-lg px-[13px] text-xs",
            )}
            disabled={
              Object.keys(draftRoles).length === 0 ||
              savingAccess ||
              statusSaving ||
              deleting ||
              busy
            }
            aria-busy={savingAccess}
            onClick={() => void saveAccessChanges()}
          >
            {savingAccess && (
              <LoaderCircle
                size={14}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            Save changes
          </button>
        </div>
        {accessError && (
          <p
            className="mt-0 mb-3 rounded-lg bg-[#fff0f1] p-3 text-xs break-words text-[#bc3649]"
            role="alert"
          >
            {accessError}
          </p>
        )}

        <div className="@container min-w-0 rounded-lg border border-[#e8ebef] bg-background">
          <div
            className={cn(
              accountGrid,
              "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold text-foreground @max-[900px]:hidden",
            )}
          >
            <span>
              <TableSortButton
                label="Member"
                direction={sortKey === "member" ? sortDirection : null}
                onClick={() => sortBy("member")}
              />
            </span>
            <span>
              <TableSortButton
                label="Role"
                direction={sortKey === "role" ? sortDirection : null}
                onClick={() => sortBy("role")}
              />
            </span>
            <span>
              <TableSortButton
                label="Status"
                direction={sortKey === "status" ? sortDirection : null}
                onClick={() => sortBy("status")}
              />
            </span>
            <span>
              <TableSortButton
                label="Department"
                direction={sortKey === "department" ? sortDirection : null}
                onClick={() => sortBy("department")}
              />
            </span>
            <span>
              <TableSortButton
                label="Created"
                direction={sortKey === "createdAt" ? sortDirection : null}
                onClick={() => sortBy("createdAt")}
              />
            </span>
            <span>Access</span>
            <span>Actions</span>
          </div>
          <div aria-live="polite">
            {busy && (
              <div
                className="grid min-h-[150px] place-content-center gap-2 p-6 text-center text-[#7183a2]"
                role="status"
              >
                Loading accounts…
              </div>
            )}
            {!busy && error && (
              <div
                className="grid min-h-[150px] place-content-center gap-2 p-6 text-center text-[#7183a2]"
                role="alert"
              >
                <p className="m-0">{error}</p>
                <button
                  type="button"
                  className={cn(
                    "cursor-pointer border-0 bg-transparent font-bold text-[#244993]",
                    accountFocusRing,
                  )}
                  onClick={() => setRevision((current) => current + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {!busy && !error && result?.users.length === 0 && (
              <div className="grid min-h-[150px] place-content-center gap-2 p-6 text-center text-[#7183a2]">
                No accounts match your search.
              </div>
            )}
            {!busy &&
              !error &&
              result?.users.map((user) => {
                const assignableRoles = allRoles.filter((role) =>
                  canAssignRole(actor, user.role, role),
                )
                const editable =
                  user.id !== actor.id && assignableRoles.length > 0
                const selectedRole = draftRoles[user.id]?.role ?? user.role
                return (
                  <div
                    className={cn(
                      accountGrid,
                      "min-h-[58px] border-b border-[#eceef1] px-4 py-[7px] text-xs text-foreground last:rounded-b-[7px] last:border-b-0 hover:bg-[#e8eef2] @max-[900px]:gap-x-4 @max-[900px]:gap-y-[10px] @max-[900px]:py-[14px] @max-[530px]:gap-[9px]",
                    )}
                    key={user.id}
                  >
                    <div className="min-w-0 @max-[900px]:col-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      <div className="grid min-w-0 gap-0.5">
                        <strong className="min-w-0 truncate font-medium text-foreground">
                          {user.fullName || user.email.split("@")[0]}
                        </strong>
                        <span className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-[#738096]">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <div className="@max-[900px]:col-start-2 @max-[900px]:row-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      <span className="mr-1.5 hidden text-[#738096] @max-[530px]:inline">
                        Role
                      </span>
                      <span className="text-xs text-foreground">
                        {roleNames[user.role]}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 @max-[900px]:col-start-2 @max-[900px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      <span className="hidden text-[#738096] @max-[900px]:inline">
                        Status
                      </span>
                      <Pill
                        className={
                          user.isActive
                            ? "bg-[#dcf5e5] text-[#19703a]"
                            : "bg-[#fde4ea] text-[#b4234d]"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Pill>
                    </div>
                    <div className="min-w-0 @max-[900px]:col-start-1 @max-[900px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      {user.department ? (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span
                            className="truncate text-xs text-foreground"
                            title={user.department.name}
                          >
                            {user.department.name}
                          </span>
                          {user.team && (
                            <span className="truncate text-[11px] text-[#738096]">
                              {user.team.name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94a3b8]">—</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#738096] @max-[900px]:col-start-1 @max-[900px]:row-start-3 @max-[530px]:row-auto">
                      <span className="mr-1.5 hidden @max-[900px]:inline">
                        Created
                      </span>
                      {formatDate(user.createdAt)}
                    </div>
                    <div className="flex min-w-0 items-center @max-[900px]:col-start-2 @max-[900px]:row-start-3 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      {editable ? (
                        <AccountDropdown
                          className="w-full max-w-[112px]"
                          triggerClassName="h-8 border-[#e1e4ea] text-xs"
                          menuClassName="right-0 left-auto"
                          label={`Role for ${user.email}`}
                          value={selectedRole}
                          disabled={savingAccess || statusSaving || deleting}
                          options={assignableRoles.map((role) => ({
                            value: role,
                            label: roleNames[role],
                          }))}
                          onChange={(role) => {
                            setAccessError("")
                            setDraftRoles((current) => {
                              const next = { ...current }
                              if (role === user.role) delete next[user.id]
                              else next[user.id] = { role, email: user.email }
                              return next
                            })
                          }}
                        />
                      ) : (
                        <span className="text-[11px] text-[#738096]">
                          {user.id === actor.id ? "Your account" : "View only"}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 @max-[900px]:col-start-2 @max-[900px]:row-start-4 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      <span className="hidden text-[#738096] @max-[530px]:inline">
                        Actions
                      </span>
                      {canChangeAccountStatus(actor, user) ? (
                        <AccountRowActions
                          account={user}
                          disabled={savingAccess || statusSaving || deleting}
                          onChangeStatus={() => {
                            setStatusError("")
                            setStatusTarget(user)
                          }}
                          onDelete={() => {
                            if (user.isActive) return
                            setDeleteError("")
                            setDeleteTarget(user)
                          }}
                        />
                      ) : (
                        <span className="text-[11px] text-[#94a3b8]">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
        {!busy && !error && result && result.total > 0 && (
          <div className="flex items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:flex-wrap max-[560px]:pt-[14px]">
            <span>
              Showing {(page - 1) * result.pageSize + 1}–
              {Math.min(page * result.pageSize, result.total)} of {result.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  accountButton,
                  accountButtonPrimary,
                  "min-h-[30px] rounded-lg px-3 text-[11px] font-medium",
                )}
                disabled={page <= 1 || savingAccess || statusSaving || deleting}
                onClick={() => setPage((current) => current - 1)}
              >
                ← Back
              </button>
              <span className="px-[3px] whitespace-nowrap text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={cn(
                  accountButton,
                  accountButtonPrimary,
                  "min-h-[30px] rounded-lg px-3 text-[11px] font-medium",
                )}
                disabled={
                  page >= totalPages || savingAccess || statusSaving || deleting
                }
                onClick={() => setPage((current) => current + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      {statusTarget && (
        <AccountStatusDialog
          account={statusTarget}
          saving={statusSaving}
          error={statusError}
          onClose={() => setStatusTarget(null)}
          onConfirm={() => void saveStatus()}
        />
      )}
      {deleteTarget && (
        <DeleteAccountDialog
          account={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) setDeleteTarget(null)
          }}
          onConfirm={() => void removeAccount()}
        />
      )}
      <CreateAccountDialog
        open={createOpen}
        roles={creatableRoles}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          sileo.success({
            title: "Account created",
            description: "The new account is ready to use.",
          })
          setSearch("")
          setDebouncedSearch("")
          setRoleFilter("")
          setPage(1)
          setRevision((current) => current + 1)
        }}
      />
    </main>
  )
}
