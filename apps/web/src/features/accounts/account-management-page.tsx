import { useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router"
import { sileo } from "sileo"
import { cn } from "@/lib/utils"
import { contentClass } from "@/components/layout/styles"
import { ApiError, clearToken } from "@/features/auth/api"
import type { Account } from "@/features/auth/types"
import { canAssignRole, canCreateRole } from "@/features/auth/permissions"
import {
  changeAccountRole,
  listAccounts,
  type AccountList,
  type AccountRole,
} from "./api"
import { AccountDropdown } from "./account-dropdown"
import { CreateAccountDialog } from "./create-account-dialog"
import {
  accountButton,
  accountButtonPrimary,
  accountButtonSecondary,
  accountFocusRing,
  accountGrid,
} from "./styles"

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
  const actor = useOutletContext<Account>()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<AccountList | null>(null)
  const [resolvedKey, setResolvedKey] = useState("")
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [draftRoles, setDraftRoles] = useState<Record<string, AccountRole>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const requestKey = JSON.stringify([
    debouncedSearch,
    roleFilter,
    page,
    revision,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    listAccounts(debouncedSearch, roleFilter, page)
      .then((data) => {
        if (active) {
          setResult(data)
          setDraftRoles({})
          setError("")
          setResolvedKey(requestKey)
        }
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          clearToken()
          navigate("/login", { replace: true })
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
  }, [debouncedSearch, roleFilter, page, revision, navigate, requestKey])

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateRoleFilter(value: string) {
    setRoleFilter(value)
    setPage(1)
  }

  async function saveRole(target: Account) {
    const role = draftRoles[target.id]
    if (!role || role === target.role) return
    setSavingId(target.id)
    try {
      await changeAccountRole(target.id, role)
      sileo.success({
        title: "Role updated",
        description: `${target.email} is now ${roleNames[role]}.`,
      })
      setRevision((current) => current + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken()
        navigate("/login", { replace: true })
        return
      }
      sileo.error({
        title: "Couldn't update role",
        description:
          caught instanceof ApiError ? caught.message : "Please try again.",
      })
    } finally {
      setSavingId(null)
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
      aria-label="Account management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Account management
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            View portal accounts and manage their access.
          </p>
        </div>
        <button
          type="button"
          className={cn(
            accountButton,
            "min-h-[34px] flex-none rounded-lg bg-[#0b0b0c] px-[13px] text-xs text-white hover:bg-[#2a2a2e]",
          )}
          onClick={() => setCreateOpen(true)}
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
        <div className="flex items-center pb-4 max-[560px]:pb-3">
          <div className="flex min-w-0 gap-[10px] max-[1050px]:w-full max-[560px]:flex-col">
            <label className="flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd] max-[1050px]:w-[min(350px,100%)] max-[1050px]:flex-1 max-[560px]:w-full">
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
              />
            </label>
            <AccountDropdown
              className="max-[560px]:w-full"
              triggerClassName="h-[34px] min-w-[132px] border-[#e1e4ea]"
              label="Filter by role"
              value={roleFilter}
              options={[{ value: "", label: "All roles" }, ...roleOptions]}
              onChange={updateRoleFilter}
            />
          </div>
        </div>

        <div className="@container min-w-0 rounded-lg border border-[#e8ebef] bg-background">
          <div
            className={cn(
              accountGrid,
              "min-h-[39px] rounded-t-[7px] border-b border-[#eceef1] bg-[#f7f7f8] px-4 text-xs font-semibold text-foreground @max-[850px]:hidden",
            )}
            aria-hidden="true"
          >
            <span>Member</span>
            <span>Role</span>
            <span>Department</span>
            <span>Created</span>
            <span>Access</span>
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
                const selectedRole = draftRoles[user.id] ?? user.role
                return (
                  <div
                    className={cn(
                      accountGrid,
                      "min-h-[58px] border-b border-[#eceef1] px-4 py-[7px] text-xs text-foreground last:rounded-b-[7px] last:border-b-0 hover:bg-[#fafbfc] @max-[850px]:gap-x-4 @max-[850px]:gap-y-[10px] @max-[850px]:py-[14px] @max-[530px]:gap-[9px]",
                    )}
                    key={user.id}
                  >
                    <div className="min-w-0 @max-[850px]:col-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      <div className="grid min-w-0 gap-0.5">
                        <strong className="overflow-hidden font-medium text-ellipsis whitespace-nowrap text-foreground">
                          {user.fullName || user.email.split("@")[0]}
                        </strong>
                        <span className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-[#738096]">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <div className="@max-[850px]:col-start-2 @max-[850px]:row-start-1 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      <span className="mr-1.5 hidden text-[#738096] @max-[530px]:inline">
                        Role
                      </span>
                      <span className="text-xs text-foreground">
                        {roleNames[user.role]}
                      </span>
                    </div>
                    <div className="min-w-0 @max-[850px]:col-start-1 @max-[850px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      {user.department ? (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="inline-block px-2 py-0.5 bg-[#eff6ff] text-[#1d4ed8] rounded text-xs font-semibold truncate max-w-full">
                            {user.department.name}
                            {user.department.code
                              ? ` (${user.department.code})`
                              : ""}
                          </span>
                          {(user.position || user.team) && (
                            <span className="text-[11px] text-[#738096] truncate">
                              {user.position}
                              {user.position && user.team ? " • " : ""}
                              {user.team ? user.team.name : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94a3b8]">—</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#738096] @max-[850px]:col-start-1 @max-[850px]:row-start-3 @max-[530px]:row-auto">
                      <span className="mr-1.5 hidden @max-[850px]:inline">
                        Created
                      </span>
                      {formatDate(user.createdAt)}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 @max-[850px]:col-start-2 @max-[850px]:row-start-2 @max-[530px]:col-start-1 @max-[530px]:row-auto">
                      {editable ? (
                        <>
                          <AccountDropdown
                            className="max-w-[135px] flex-1"
                            triggerClassName="h-8 border-[#e1e4ea] text-xs"
                            menuClassName="right-0 left-auto"
                            label={`Role for ${user.email}`}
                            value={selectedRole}
                            disabled={savingId === user.id}
                            options={assignableRoles.map((role) => ({
                              value: role,
                              label: roleNames[role],
                            }))}
                            onChange={(role) =>
                              setDraftRoles((current) => ({
                                ...current,
                                [user.id]: role,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={cn(
                              accountButton,
                              accountButtonPrimary,
                              "ml-auto min-h-8 rounded-[7px] px-[11px] text-xs",
                            )}
                            disabled={
                              selectedRole === user.role || savingId === user.id
                            }
                            onClick={() => void saveRole(user)}
                          >
                            {savingId === user.id ? "Saving…" : "Save"}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#738096]">
                          {user.id === actor.id ? "Your account" : "View only"}
                        </span>
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
                  accountButtonSecondary,
                  "min-h-[30px] rounded-lg border-[#e1e4ea] px-3 text-[11px] font-medium text-foreground",
                )}
                disabled={page <= 1}
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
                  accountButtonSecondary,
                  "min-h-[30px] rounded-lg border-[#e1e4ea] px-3 text-[11px] font-medium text-foreground",
                )}
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

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
