"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Trash2 } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { sileo } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { contentClass } from "@/components/layout/styles"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { Alert } from "@/components/ui/alert"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import { Dropdown as AccessDropdown } from "@/components/ui/dropdown"
import { FilterSelect } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TableSortButton } from "@/components/ui/table-sort-button"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { ApiError, clearToken } from "@/features/auth/api/auth-api"
import { roleLabels } from "@/features/auth/model/roles"
import type { Account } from "@/features/auth/model/types"
import {
  canAssignRole,
  canChangeAccountStatus,
  canChangeAccountPassword,
  canCreateRole,
} from "@/features/auth/model/permissions"
import {
  changeAccountRole,
  changeAccountStatus,
  listAccounts,
  moveAccountToTrash,
  permanentlyDeleteAccount,
  restoreAccount,
  type AccountRole,
  type AccountSortDirection,
  type AccountSortKey,
} from "../api/accounts-api"
import { AccountStatusDialog } from "../components/account-status-dialog"
import { AccountRowActions } from "../components/account-row-actions"
import { CreateAccountDialog } from "../components/create-account-dialog"
import { ChangePasswordDialog } from "../components/change-password-dialog"
import { DeleteAccountDialog } from "../components/delete-account-dialog"
import {
  accountButton,
  accountButtonPrimary,
  accountGrid,
} from "../styles/account-styles"
import { errorMessage } from "@/lib/error-message"

const allRoles: AccountRole[] = ["USER", "STAFF", "ADMIN", "SUPERADMIN"]
const roleFilterOptions: { value: string; label: string }[] = [
  { value: "", label: "All roles" },
  ...allRoles.map((role) => ({ value: role, label: roleLabels[role] })),
]

function AccountRowContents({
  user,
  actor,
  selectedRole,
  disabled,
  onRoleChange,
  onChangeStatus,
  onChangePassword,
  onDelete,
  trashView,
}: {
  user: Account
  actor: Account
  selectedRole: AccountRole
  disabled: boolean
  onRoleChange: (user: Account, role: AccountRole) => void
  onChangeStatus: (user: Account) => void
  onChangePassword: (user: Account) => void
  onDelete: (user: Account) => void
  trashView: boolean
}) {
  const assignableRoles = allRoles.filter((role) =>
    canAssignRole(actor, user.role, role),
  )
  const editable =
    !trashView && user.id !== actor.id && assignableRoles.length > 0

  return (
    <>
      <div className="flex min-w-0 items-center gap-2.5 @max-[900px]:col-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto">
        <Avatar
          name={user.fullName || user.email}
          imageUrl={user.imageUrl}
          className="size-8"
        />
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
        <span className="text-xs text-foreground">{roleLabels[user.role]}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 @max-[900px]:col-start-2 @max-[900px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto">
        <span className="hidden text-[#738096] @max-[900px]:inline">
          Status
        </span>
        <Pill
          tone={trashView ? "neutral" : user.isActive ? "success" : "danger"}
        >
          {trashView ? "Deleted" : user.isActive ? "Active" : "Inactive"}
        </Pill>
      </div>
      <div className="min-w-0 @max-[900px]:col-start-1 @max-[900px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto">
        {user.department ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <DepartmentPill
              className="self-start"
              department={user.department}
            />
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
          {trashView ? "Deleted" : "Created"}
        </span>
        {formatDate(
          trashView && user.accountDeletedAt
            ? user.accountDeletedAt
            : user.createdAt,
        )}
      </div>
      <div className="flex min-w-0 items-center @max-[900px]:col-start-2 @max-[900px]:row-start-3 @max-[530px]:col-start-1 @max-[530px]:row-auto">
        {trashView ? (
          <span className="text-[11px] text-[#738096]">Removed</span>
        ) : editable ? (
          <AccessDropdown
            className="w-full max-w-[112px]"
            triggerClassName="h-8 border-[#e1e4ea] text-xs"
            align="right"
            label={`Role for ${user.email}`}
            value={selectedRole}
            disabled={disabled}
            options={assignableRoles.map((role) => ({
              value: role,
              label: roleLabels[role],
            }))}
            onChange={(role) => onRoleChange(user, role)}
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
        {canChangeAccountStatus(actor, user) ||
        (!trashView && canChangeAccountPassword(actor, user)) ? (
          <AccountRowActions
            account={user}
            disabled={disabled}
            onChangeStatus={() => onChangeStatus(user)}
            canChangeStatus={canChangeAccountStatus(actor, user)}
            onChangePassword={
              canChangeAccountPassword(actor, user)
                ? () => onChangePassword(user)
                : undefined
            }
            onDelete={() => onDelete(user)}
            trashView={trashView}
          />
        ) : (
          <span className="text-[11px] text-[#94a3b8]">—</span>
        )}
      </div>
    </>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

const accountKey = (account: Account) => account.id

const accountRowClassName = cn(
  accountGrid,
  "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] @max-[900px]:h-[188px] @max-[900px]:gap-x-4 @max-[900px]:gap-y-[10px] @max-[900px]:py-[14px] @max-[530px]:h-[258px] @max-[530px]:gap-[9px]",
)

function accountRowClass(_account: Account, _index: number, isLast: boolean) {
  return cn(accountRowClassName, isLast && "rounded-b-[7px] border-b-0")
}

function matchesAccountSearch(account: Account, query: string) {
  return (
    account.email.toLowerCase().includes(query) ||
    (account.fullName?.toLowerCase().includes(query) ?? false)
  )
}

export function AccountManagementPage() {
  const actor = usePortalAccount()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [roleFilter, setRoleFilter] = useState("")
  const [sortKey, setSortKey] = useState<AccountSortKey>("createdAt")
  const [sortDirection, setSortDirection] =
    useState<AccountSortDirection>("desc")
  const [trashView, setTrashView] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<Account | null>(null)
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

  const list = usePaginatedList({
    params: {
      search: query,
      role: roleFilter,
      sort: sortKey,
      direction: sortDirection,
      deleted: trashView,
    },
    load: async ({ page, signal }) => {
      try {
        return await listAccounts({
          search: query,
          role: roleFilter,
          page,
          sort: sortKey,
          direction: sortDirection,
          deleted: trashView,
          signal,
        })
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearToken()
          router.replace("/login")
        } else if (caught instanceof ApiError && caught.status === 403) {
          window.location.replace("/dashboard")
        } else throw caught
        // Leaving the page: stay in the loading state instead of flashing an error.
        return new Promise<never>(() => {})
      }
    },
    rows: (result) => result.users,
    matches: matchesAccountSearch,
    initial: { users: [], total: 0, page: 1, pageSize: 10 },
    fallbackError: "Couldn't load accounts. Please try again.",
  })
  const { page, setPage, retry } = list
  const busy = list.loading
  const mutating = savingAccess || statusSaving || deleting

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

  /** After removing a row: step back from an emptied last page, else reload. */
  function reloadAfterRemoval() {
    if ((list.data?.users.length ?? 0) === 1 && page > 1)
      setPage((current) => current - 1)
    else retry()
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
            `${change.email}: ${errorMessage(caught, "Please try again.")}`,
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
        retry()
      }
      setSavingAccess(false)
    }
  }

  async function saveStatus() {
    if (!statusTarget || statusSaving) return
    setStatusSaving(true)
    setStatusError("")
    try {
      if (statusTarget.accountDeletedAt) {
        await restoreAccount(statusTarget.id)
        sileo.success({
          title: "Account restored",
          description: `${statusTarget.email} is back in Account Management as inactive.`,
        })
        setStatusTarget(null)
        reloadAfterRemoval()
        return
      }
      const isActive = !statusTarget.isActive
      await changeAccountStatus(statusTarget.id, isActive)
      sileo.success({
        title: isActive ? "Account reactivated" : "Account deactivated",
        description: isActive
          ? `${statusTarget.email} can sign in again.`
          : `${statusTarget.email} can no longer sign in.`,
      })
      setStatusTarget(null)
      retry()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken()
        router.replace("/login")
        return
      }
      setStatusError(
        errorMessage(
          caught,
          "Couldn't update account status. Please try again.",
        ),
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
      if (trashView) {
        await permanentlyDeleteAccount(deleteTarget.id)
      } else {
        await moveAccountToTrash(deleteTarget.id)
      }
      const deletedEmail = deleteTarget.email
      setDraftRoles((current) => {
        const next = { ...current }
        delete next[deleteTarget.id]
        return next
      })
      setDeleteTarget(null)
      sileo.success({
        title: trashView
          ? "Account permanently deleted"
          : "Account moved to Trash",
        description: trashView
          ? `${deletedEmail} was permanently deleted.`
          : `${deletedEmail} is now in Trash.`,
      })
      reloadAfterRemoval()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken()
        router.replace("/login")
        return
      }
      setDeleteError(
        errorMessage(caught, "Couldn't delete the account. Please try again."),
      )
    } finally {
      setDeleting(false)
    }
  }

  const creatableRoles = allRoles.filter((role) => canCreateRole(actor, role))
  const initialLoading = busy && list.tableViewKey === ""

  function renderAccountRow(user: Account) {
    return (
      <AccountRowContents
        user={user}
        actor={actor}
        selectedRole={draftRoles[user.id]?.role ?? user.role}
        disabled={busy || mutating}
        onRoleChange={(account, role) => {
          setAccessError("")
          setDraftRoles((current) => {
            const next = { ...current }
            if (role === account.role) delete next[account.id]
            else next[account.id] = { role, email: account.email }
            return next
          })
        }}
        onChangeStatus={(account) => {
          setStatusError("")
          setStatusTarget(account)
        }}
        onChangePassword={setPasswordTarget}
        onDelete={(account) => {
          if (!trashView && account.isActive) return
          setDeleteError("")
          setDeleteTarget(account)
        }}
        trashView={trashView}
      />
    )
  }

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Account Management"
    >
      <PageHeader
        title="Account Management"
        description="View portal accounts and manage their access."
        actions={
          <PageHeaderButton
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={mutating}
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
          </PageHeaderButton>
        }
      />

      <section
        className="mt-[18px] min-w-0 max-[560px]:mt-[14px]"
        aria-label="Accounts"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pb-4 max-[560px]:grid-cols-1 max-[560px]:pb-3">
          <div className="flex min-w-0 gap-[10px] max-[560px]:flex-col">
            <SearchField
              label="Search accounts"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search name or email"
              maxLength={100}
              disabled={mutating}
            />
            <FilterSelect
              triggerClassName="min-w-[132px] font-normal max-[560px]:min-w-0"
              label="Filter by role"
              announceValue
              value={roleFilter}
              options={roleFilterOptions}
              onChange={updateRoleFilter}
              disabled={mutating}
            />
          </div>
          <div className="flex items-center justify-end gap-2 max-[560px]:justify-start">
            <button
              type="button"
              className={cn(
                accountButton,
                "min-h-[34px] rounded-lg border-red-500 bg-background px-[12px] text-xs text-red-600 hover:enabled:bg-red-50",
              )}
              disabled={mutating || busy}
              aria-pressed={trashView}
              onClick={() => {
                setTrashView(!trashView)
                setSortKey(trashView ? "createdAt" : "deletedAt")
                setSortDirection("desc")
                setPage(1)
                setDraftRoles({})
                setAccessError("")
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              {trashView ? "Back to Accounts" : "Trash"}
            </button>
            <button
              type="button"
              className={cn(
                accountButton,
                accountButtonPrimary,
                "min-h-[34px] rounded-lg px-[13px] text-xs",
              )}
              disabled={
                trashView ||
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
              Save Changes
            </button>
          </div>
        </div>
        {accessError && (
          <Alert className="mb-3 break-words">{accessError}</Alert>
        )}

        <ResponsiveDataTable label="Accounts" aria-busy={busy}>
          <ResponsiveDataTableHeader
            className="@max-[900px]:hidden"
            rowClassName={accountGrid}
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
                label={trashView ? "Deletion status" : "Status"}
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
                label={trashView ? "Deleted" : "Created"}
                direction={
                  sortKey === (trashView ? "deletedAt" : "createdAt")
                    ? sortDirection
                    : null
                }
                onClick={() => sortBy(trashView ? "deletedAt" : "createdAt")}
              />
            </span>
            <span>Access</span>
            <span>Actions</span>
          </ResponsiveDataTableHeader>
          {initialLoading || list.error ? (
            <ResponsiveDataTableBody className="relative min-w-0">
              {initialLoading ? (
                <DataTableSkeletonRows
                  label="accounts"
                  rowClassName={cn(
                    accountGrid,
                    "h-[58px] px-4 py-[7px] @max-[900px]:h-[188px] @max-[900px]:gap-x-4 @max-[900px]:gap-y-[10px] @max-[900px]:py-[14px] @max-[530px]:h-[258px] @max-[530px]:gap-[9px]",
                  )}
                  cellClassNames={[
                    "@max-[900px]:col-start-1 @max-[900px]:row-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                    "@max-[900px]:col-start-2 @max-[900px]:row-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                    "@max-[900px]:col-start-2 @max-[900px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                    "@max-[900px]:col-start-1 @max-[900px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                    "@max-[900px]:col-start-1 @max-[900px]:row-start-3 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                    "@max-[900px]:col-start-2 @max-[900px]:row-start-3 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                    "@max-[900px]:col-start-2 @max-[900px]:row-start-4 @max-[530px]:col-start-1 @max-[530px]:row-auto",
                  ]}
                  cellSkeletonClassNames={[
                    "h-8 w-4/5",
                    "h-3 w-3/5",
                    "h-5 w-16 rounded",
                    "h-3 w-4/5",
                    "h-3 w-20",
                    "h-3 w-20",
                    "h-8 w-24",
                  ]}
                />
              ) : (
                <DataTableErrorRow
                  message={list.error}
                  colSpan={7}
                  onRetry={retry}
                />
              )}
            </ResponsiveDataTableBody>
          ) : (
            <AnimatedSlotGridBody
              items={list.rows}
              viewKey={list.tableViewKey}
              quickKey={query}
              onRowsSettled={list.onRowsSettled}
              animateRows
              getKey={accountKey}
              rowClassName={accountRowClass}
              emptyContent={
                trashView
                  ? "No soft-deleted accounts match your search."
                  : "No accounts match your search."
              }
              ariaBusy={busy}
              className="relative min-w-0"
              renderRow={renderAccountRow}
            />
          )}
        </ResponsiveDataTable>
        <TableSearchStatus active={busy && list.previewing} label="accounts" />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            disabled={list.footer.disabled || mutating}
            label={trashView ? "Trash pages" : "Account pages"}
            onPageChange={setPage}
          />
        )}
      </section>

      {passwordTarget && (
        <ChangePasswordDialog
          key={passwordTarget.id}
          account={passwordTarget}
          onClose={() => setPasswordTarget(null)}
        />
      )}
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
          permanent={trashView}
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
          setRoleFilter("")
          setPage(1)
          retry()
        }}
      />
    </main>
  )
}
