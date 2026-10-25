import { useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router"
import { sileo } from "sileo"
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
import "./accounts.css"

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
      className="app-content account-content"
      aria-label="Account management"
    >
      <div className="account-hero">
        <div>
          <p className="account-eyebrow">ADMINISTRATION</p>
          <h1>Account management</h1>
          <p>View portal accounts and manage their access.</p>
        </div>
        <button
          type="button"
          className="account-button account-button-light"
          onClick={() => setCreateOpen(true)}
        >
          <span aria-hidden="true">＋</span> Create account
        </button>
      </div>

      <section className="account-panel" aria-label="Accounts">
        <div className="account-panel-header">
          <div>
            <h2>Accounts</h2>
            <p>
              {result
                ? `${result.total} ${result.total === 1 ? "account" : "accounts"}`
                : "Portal accounts"}
            </p>
          </div>
          <div className="account-filters">
            <label className="account-search">
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
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search name or email"
                maxLength={100}
              />
            </label>
            <AccountDropdown
              className="account-filter-role"
              label="Filter by role"
              value={roleFilter}
              options={[{ value: "", label: "All roles" }, ...roleOptions]}
              onChange={updateRoleFilter}
            />
          </div>
        </div>

        <div className="account-table-head" aria-hidden="true">
          <span>ACCOUNT</span>
          <span>ROLE</span>
          <span>CREATED</span>
          <span>ACCESS</span>
        </div>
        <div className="account-rows" aria-live="polite">
          {busy && (
            <div className="account-state" role="status">
              Loading accounts…
            </div>
          )}
          {!busy && error && (
            <div className="account-state" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="account-text-button"
                onClick={() => setRevision((current) => current + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!busy && !error && result?.users.length === 0 && (
            <div className="account-state">No accounts match your search.</div>
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
                <div className="account-row" key={user.id}>
                  <div className="account-identity">
                    <span className="account-avatar" aria-hidden="true">
                      {(user.fullName || user.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="account-person">
                      <strong>
                        {user.fullName || user.email.split("@")[0]}
                      </strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <div className="account-role-cell">
                    <span
                      className={`account-role account-role-${user.role.toLowerCase()}`}
                    >
                      {roleNames[user.role]}
                    </span>
                  </div>
                  <div className="account-date">
                    <span className="account-mobile-label">Created</span>
                    {formatDate(user.createdAt)}
                  </div>
                  <div className="account-access">
                    {editable ? (
                      <>
                        <AccountDropdown
                          className="account-access-role"
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
                          className="account-button account-button-secondary account-save"
                          disabled={
                            selectedRole === user.role || savingId === user.id
                          }
                          onClick={() => void saveRole(user)}
                        >
                          {savingId === user.id ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <span className="account-readonly">
                        {user.id === actor.id ? "Your account" : "View only"}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
        {!busy && !error && result && result.total > 0 && (
          <div className="account-pagination">
            <span>
              Page {page} of {totalPages}
            </span>
            <div>
              <button
                type="button"
                className="account-button account-button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="account-button account-button-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
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
