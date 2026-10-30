"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import { useReducedMotion } from "framer-motion"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { sileo } from "sileo"
import { cn } from "@/lib/utils"
import { contentClass } from "@/components/layout/styles"
import {
  AnimatedSlotRow,
  settledAnimatedRows,
  swapAnimatedRows,
  type AnimatedRowItem,
  type AnimatedRowSlot,
} from "@/components/ui/animated-data-row"
import { DepartmentPill } from "@/components/ui/department-pill.tsx"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
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

type AccountRowItem = AnimatedRowItem<Account>
type AccountRowSlot = AnimatedRowSlot<Account>

function AccountRowContents({
  user,
  actor,
  selectedRole,
  disabled,
  onRoleChange,
  onChangeStatus,
  onDelete,
}: {
  user: Account
  actor: Account
  selectedRole: AccountRole
  disabled: boolean
  onRoleChange: (user: Account, role: AccountRole) => void
  onChangeStatus: (user: Account) => void
  onDelete: (user: Account) => void
}) {
  const assignableRoles = allRoles.filter((role) =>
    canAssignRole(actor, user.role, role),
  )
  const editable = user.id !== actor.id && assignableRoles.length > 0

  return (
    <>
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
        <span className="text-xs text-foreground">{roleNames[user.role]}</span>
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
        <span className="mr-1.5 hidden @max-[900px]:inline">Created</span>
        {formatDate(user.createdAt)}
      </div>
      <div className="flex min-w-0 items-center @max-[900px]:col-start-2 @max-[900px]:row-start-3 @max-[530px]:col-start-1 @max-[530px]:row-auto">
        {editable ? (
          <AccountDropdown
            className="w-full max-w-[112px]"
            triggerClassName="h-8 border-[#e1e4ea] text-xs"
            align="right"
            label={`Role for ${user.email}`}
            value={selectedRole}
            disabled={disabled}
            options={assignableRoles.map((role) => ({
              value: role,
              label: roleNames[role],
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
        {canChangeAccountStatus(actor, user) ? (
          <AccountRowActions
            account={user}
            disabled={disabled}
            onChangeStatus={() => onChangeStatus(user)}
            onDelete={() => onDelete(user)}
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

export function AccountManagementPage() {
  const actor = usePortalAccount()
  const router = useRouter()
  const reduceMotion = useReducedMotion() ?? false
  const [search, setSearch] = useState("")
  const searchRef = useRef(search)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [sortKey, setSortKey] = useState<AccountSortKey>("createdAt")
  const [sortDirection, setSortDirection] =
    useState<AccountSortDirection>("desc")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [rowSlots, setRowSlots] = useState<AccountRowSlot[]>([])
  const rowSlotsRef = useRef<AccountRowSlot[]>([])
  const [footerResult, setFooterResult] = useState<AccountList | null>(null)
  const pendingFooterResultRef = useRef<AccountList | null>(null)
  const [rowHeight, setRowHeight] = useState(58)
  const [isAnimatingRows, setIsAnimatingRows] = useState(false)
  const [animateBodyHeight, setAnimateBodyHeight] = useState(false)
  const rowsBodyRef = useRef<HTMLDivElement>(null)
  const animationTimerRef = useRef<number | null>(null)
  const bodyHeightTimerRef = useRef<number | null>(null)
  const animationGenerationRef = useRef(0)
  const lastResolvedViewKey = useRef<string | null>(null)
  const lastResolvedSearch = useRef<string | null>(null)
  const [result, setResult] = useState<AccountList | null>(null)
  const [resolvedKey, setResolvedKey] = useState("")
  const [errorState, setErrorState] = useState<{
    requestKey: string
    message: string
  } | null>(null)
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
  const viewKey = JSON.stringify([
    debouncedSearch,
    roleFilter,
    sortKey,
    sortDirection,
    page,
  ])
  const error =
    search === debouncedSearch && errorState?.requestKey === requestKey
      ? errorState.message
      : ""

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(
    () => () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current)
      }
      if (bodyHeightTimerRef.current !== null) {
        window.clearTimeout(bodyHeightTimerRef.current)
      }
    },
    [],
  )

  useLayoutEffect(() => {
    const firstRow = rowsBodyRef.current?.querySelector<HTMLElement>(
      "[data-animated-slot-row]",
    )
    if (!firstRow) return

    const updateHeight = () => {
      const nextHeight = Math.round(firstRow.getBoundingClientRect().height)
      if (nextHeight > 0) setRowHeight(nextHeight)
    }
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(firstRow)
    return () => observer.disconnect()
  }, [rowSlots])

  function settleRowSlots(data: AccountList) {
    animationGenerationRef.current += 1
    const nextSlots = settledAnimatedRows(data.users)
    rowSlotsRef.current = nextSlots
    setRowSlots(nextSlots)
    setFooterResult(data)
    pendingFooterResultRef.current = null
    setIsAnimatingRows(false)
  }

  useEffect(() => {
    let active = true
    listAccounts(debouncedSearch, roleFilter, page, sortKey, sortDirection)
      .then((data) => {
        if (active) {
          const previousViewKey = lastResolvedViewKey.current
          const searchChanged =
            lastResolvedSearch.current !== null &&
            lastResolvedSearch.current !== debouncedSearch
          const shouldAnimate =
            previousViewKey !== null &&
            previousViewKey !== viewKey &&
            searchRef.current === debouncedSearch

          setResult(data)
          setErrorState(null)
          setResolvedKey(requestKey)
          lastResolvedViewKey.current = viewKey
          lastResolvedSearch.current = debouncedSearch

          if (shouldAnimate) {
            const runId = animationGenerationRef.current + 1
            const quick = searchChanged
            const { slots: nextSlots, animationDuration } = swapAnimatedRows({
              currentSlots: rowSlotsRef.current,
              items: data.users,
              getKey: (account) => account.id,
              reduceMotion,
              runId,
              quick,
            })
            const hasRowSwap = nextSlots.some(
              (slot) =>
                slot.exiting !== null || slot.entering?.phase === "enter",
            )

            if (hasRowSwap && animationDuration > 0) {
              animationGenerationRef.current = runId
              if (animationTimerRef.current !== null) {
                window.clearTimeout(animationTimerRef.current)
              }
              if (bodyHeightTimerRef.current !== null) {
                window.clearTimeout(bodyHeightTimerRef.current)
                bodyHeightTimerRef.current = null
              }
              rowSlotsRef.current = nextSlots
              pendingFooterResultRef.current = data
              setRowSlots(nextSlots)
              setIsAnimatingRows(true)
              setAnimateBodyHeight(true)
              animationTimerRef.current = window.setTimeout(() => {
                const finalResult = pendingFooterResultRef.current ?? data
                const finalSlots = settledAnimatedRows(finalResult.users)
                rowSlotsRef.current = finalSlots
                setRowSlots(finalSlots)
                setFooterResult(finalResult)
                pendingFooterResultRef.current = null
                setIsAnimatingRows(false)
                animationTimerRef.current = null
                bodyHeightTimerRef.current = window.setTimeout(() => {
                  setAnimateBodyHeight(false)
                  bodyHeightTimerRef.current = null
                }, 250)
              }, animationDuration)
            } else if (pendingFooterResultRef.current !== null) {
              if (animationTimerRef.current !== null) {
                window.clearTimeout(animationTimerRef.current)
                animationTimerRef.current = null
              }
              if (bodyHeightTimerRef.current !== null) {
                window.clearTimeout(bodyHeightTimerRef.current)
                bodyHeightTimerRef.current = null
              }
              settleRowSlots(data)
              setAnimateBodyHeight(true)
              bodyHeightTimerRef.current = window.setTimeout(() => {
                setAnimateBodyHeight(false)
                bodyHeightTimerRef.current = null
              }, 250)
            } else {
              settleRowSlots(data)
            }
          } else if (pendingFooterResultRef.current !== null) {
            pendingFooterResultRef.current = data
          } else {
            settleRowSlots(data)
          }
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
          setErrorState({
            requestKey,
            message:
              caught instanceof ApiError
                ? caught.message
                : "Couldn't load accounts. Please try again.",
          })
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
    viewKey,
    reduceMotion,
    sortDirection,
    sortKey,
  ])

  function updateSearch(value: string) {
    searchRef.current = value
    setSearch(value)
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

  const totalPages = footerResult
    ? Math.max(1, Math.ceil(footerResult.total / footerResult.pageSize))
    : 1
  const bodyHeight = rowSlots.length > 0 ? rowSlots.length * rowHeight : 150
  const creatableRoles = allRoles.filter((role) => canCreateRole(actor, role))
  const busy = resolvedKey !== requestKey || search !== debouncedSearch
  const accountRowClassName = cn(
    accountGrid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] @max-[900px]:h-[188px] @max-[900px]:gap-x-4 @max-[900px]:gap-y-[10px] @max-[900px]:py-[14px] @max-[530px]:h-[258px] @max-[530px]:gap-[9px]",
  )

  function renderAccountRow(
    row: AccountRowItem,
    delayMs: number,
    roundBottom: boolean,
  ) {
    const user = row.item
    return (
      <AnimatedSlotRow
        key={user.id}
        className={cn(
          accountRowClassName,
          roundBottom && "rounded-b-[7px] border-b-0",
        )}
        delayMs={delayMs}
        phase={row.phase}
        reduceMotion={reduceMotion}
        quick={row.quick ?? false}
        onExitComplete={
          row.phase === "exit"
            ? () => {
                if (row.runId !== animationGenerationRef.current) return
                const nextSlots = rowSlotsRef.current.map((slot) =>
                  slot.exiting &&
                  slot.exiting.runId === row.runId &&
                  slot.exiting.item.id === user.id
                    ? { ...slot, exiting: null }
                    : slot,
                )
                rowSlotsRef.current = nextSlots
                setRowSlots(nextSlots)
              }
            : undefined
        }
      >
        <AccountRowContents
          user={user}
          actor={actor}
          selectedRole={draftRoles[user.id]?.role ?? user.role}
          disabled={savingAccess || statusSaving || deleting}
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
          onDelete={(account) => {
            if (account.isActive) return
            setDeleteError("")
            setDeleteTarget(account)
          }}
        />
      </AnimatedSlotRow>
    )
  }

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
            <SearchField
              label="Search accounts"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search name or email"
              maxLength={100}
              disabled={savingAccess || statusSaving || deleting}
            />
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

        <div className="@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background">
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
          <div
            ref={rowsBodyRef}
            className="relative min-w-0"
            aria-live="polite"
            aria-busy={busy || isAnimatingRows}
            style={{
              height: bodyHeight,
              transition: animateBodyHeight ? "height 220ms ease-out" : "none",
            }}
          >
            {busy && !result && (
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
            {!error && result?.users.length === 0 && !isAnimatingRows && (
              <div className="grid min-h-[150px] place-content-center gap-2 p-6 text-center text-[#7183a2]">
                No accounts match your search.
              </div>
            )}
            {result &&
              !error &&
              rowSlots.map((slot) => {
                const quick =
                  slot.entering?.quick ?? slot.exiting?.quick ?? false
                const stagger = reduceMotion
                  ? 0
                  : Math.min(slot.index, quick ? 5 : 9) * (quick ? 20 : 40)
                return (
                  <div
                    key={slot.index}
                    className="relative"
                    style={{ height: rowHeight }}
                  >
                    {slot.exiting &&
                      renderAccountRow(
                        slot.exiting,
                        slot.exiting.delayMs ?? stagger,
                        slot.index === rowSlots.length - 1,
                      )}
                    {slot.entering &&
                      renderAccountRow(
                        slot.entering,
                        slot.entering.delayMs ??
                          stagger +
                            (slot.exiting && !reduceMotion
                              ? quick
                                ? 50
                                : 100
                              : 0),
                        slot.index === rowSlots.length - 1,
                      )}
                  </div>
                )
              })}
          </div>
        </div>
        {!error && footerResult && footerResult.total > 0 && (
          <div className="flex items-center justify-between gap-3 pt-4 text-[11px] text-[#65718a] max-[560px]:flex-wrap max-[560px]:pt-[14px]">
            <span>
              Showing {(footerResult.page - 1) * footerResult.pageSize + 1}–
              {Math.min(
                footerResult.page * footerResult.pageSize,
                footerResult.total,
              )}{" "}
              of {footerResult.total}
            </span>
            <NumberedPagination
              page={footerResult.page}
              totalPages={totalPages}
              disabled={
                busy ||
                isAnimatingRows ||
                savingAccess ||
                statusSaving ||
                deleting
              }
              label="Account pages"
              onPageChange={setPage}
            />
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
