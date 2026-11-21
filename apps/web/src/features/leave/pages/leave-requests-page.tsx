"use client"

import { useEffect, useState } from "react"
import { Plus, UserRound, UsersRound } from "lucide-react"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { PageHeaderButton } from "@/components/layout/page-header"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { SearchField } from "@/components/ui/search-field"
import { DateInput } from "@/components/ui/date-input"
import { Alert } from "@/components/ui/alert"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  canAccessPersonalAttendance,
  canManageAttendance,
} from "@/features/auth/model/permissions"
import { AttendanceShell } from "@/features/attendance/components/attendance-shell"
import { AttendancePagination } from "@/features/attendance/components/attendance-shared"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"
import {
  actOnLeave,
  leaveDetail,
  leaveRequests,
  type LeaveAction,
  type LeaveRequest,
} from "../api/leave-api"
import { LeaveRequestDialog } from "../components/leave-request-dialog"
import { LeaveRequestTable } from "../components/leave-request-table"
import { LeaveReviewPanel } from "../components/leave-review-panel"

export function LeaveRequestsPage({linkedId}:{linkedId?:string} = {}) {
 const [linkedOpen,setLinkedOpen]=useState(true)
  const account = usePortalAccount()
  const manager = canManageAttendance(account)
  const selfService = canAccessPersonalAttendance(account)
  const [scope, setScope] = useState<"mine" | "team">(manager ? "team" : "mine")
  const effectiveScope =
    manager && (!selfService || scope === "team") ? "team" : "mine"
  const [search, setSearch] = useState("")
  const [settledSearch, setSettledSearch] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [requestOpen, setRequestOpen] = useState(false)
  const [selection, setSelection] = useState<{
    request: LeaveRequest
    action: LeaveAction | null
    actionId: string
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState("")
  const searchPending = search !== settledSearch

  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => setSettledSearch(search), 200)
    return () => window.clearTimeout(timer)
  }, [search, searchPending])

  const list = useAsyncResource(
    (signal) =>
      linkedId ? leaveDetail(linkedId,signal).then(({request})=>({requests:[request],total:1,page:1,pageSize:1,capabilities:{submit:false}})) : leaveRequests(
        effectiveScope,
        page,
        settledSearch,
        type,
        status,
        signal,
        from,
        to,
      ),
    [linkedId,effectiveScope, page, settledSearch, type, status, from, to],
    {
      enabled: !searchPending,
      fallbackError: "Couldn't load leave requests.",
    },
  )
  const data = list.error && !searchPending ? undefined : list.data
  const current = list.loading
    ? undefined
    : data?.requests.find((request) => request.id === selection?.request.id)
  const selectedRequest = current ?? selection?.request ?? (linkedOpen && linkedId && !list.error && !list.loading ? data?.requests[0]:undefined)
  const selectedAction = selection?.action
  const availableAction =
    selectedAction && selectedRequest?.capabilities[selectedAction]
      ? selectedAction
      : null

  async function submitAction(note: string) {
    const action = availableAction
    if (!selection || !selectedRequest || !action || pending) return false
    setPending(true)
    setActionError("")
    try {
      await actOnLeave(selectedRequest.id, action, {
        actionId: selection.actionId,
        expectedVersion: selectedRequest.version,
        note,
      })
      sileo.success({
        title:
          action === "verify"
            ? "Leave request verified"
            : action === "approve"
              ? "Leave request approved"
              : action === "reject"
                ? "Leave request rejected"
                : action === "cancel"
                  ? "Leave request cancelled"
                  : "Leave approval reversed",
      })
      list.retry()
      return true
    } catch (failure) {
      setActionError(errorMessage(failure, "Couldn't update leave request."))
      if (
        failure instanceof ApiError &&
        failure.status === 409 &&
        failure.message === "Leave request changed; refresh and try again"
      ) {
        try {
          const { request } = await leaveDetail(selectedRequest.id)
          setSelection({ ...selection, request, action: null })
          if (linkedId) {
            list.setData((value) => value && { ...value, requests: [request] })
          } else {
            list.retry()
          }
        } catch {
          setSelection(null)
          setLinkedOpen(false)
          list.retry()
        }
      }
      return false
    } finally {
      setPending(false)
    }
  }

  return (
    <AttendanceShell
      tab="leave"
      actions={
        selfService ? (
          <PageHeaderButton onClick={() => setRequestOpen(true)}>
            <Plus aria-hidden="true" />
            Request leave
          </PageHeaderButton>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[560px]:items-stretch">
        <div className={filterBarClass}>
          <DateInput
            aria-label="Leave filter start date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(1)
            }}
          />
          <DateInput
            aria-label="Leave filter end date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(1)
            }}
          />
          <SearchField
            label="Search leave requests"
            placeholder="Search employee or reason…"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Leave type filter"
            value={type}
            triggerClassName="w-[140px]"
            options={[
              { value: "", label: "All types" },
              { value: "ANNUAL", label: "Annual" },
              { value: "SICK", label: "Sick" },
              { value: "EMERGENCY", label: "Emergency" },
              { value: "UNPAID", label: "Unpaid" },
              { value: "OTHER", label: "Other" },
            ]}
            onChange={(value) => {
              setType(value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Leave status filter"
            value={status}
            triggerClassName="w-[150px]"
            options={[
              { value: "", label: "All statuses" },
              { value: "SUBMITTED", label: "Submitted" },
              { value: "VERIFIED", label: "Verified" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "REVERSED", label: "Reversed" },
            ]}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
        </div>
        {manager && selfService && (
          <ManagementViewToggle
            active={effectiveScope === "mine"}
            ariaLabel="Leave request view"
            views={[
              {
                value: false,
                label:
                  account.role === "STAFF"
                    ? "Department requests"
                    : "Organization requests",
                icon: UsersRound,
              },
              { value: true, label: "My requests", icon: UserRound },
            ]}
            onChange={(mine) => {
              setScope(mine ? "mine" : "team")
              setPage(1)
            }}
          />
        )}
      </div>
      <p className="mb-4 text-xs leading-5 text-[#738096]">
        Department Heads verify requests before HR approval. Approved whole-day
        leave reduces attendance requirements for the covered working dates.
      </p>
      {!selectedRequest && actionError && <Alert>{actionError}</Alert>}
      <LeaveRequestTable
        items={data?.requests ?? []}
        loading={list.loading || searchPending}
        error={searchPending ? "" : list.error}
        onRetry={list.retry}
        onAction={(request, action) => {
          setSelection({
            request,
            action: action === "view" ? null : action,
            actionId: crypto.randomUUID(),
          })
          setActionError("")
        }}
      />
      {data && (
        <AttendancePagination
          data={data}
          disabled={list.loading || searchPending}
          onChange={setPage}
        />
      )}
      {requestOpen && (
        <LeaveRequestDialog
          onClose={() => setRequestOpen(false)}
          onSaved={list.retry}
        />
      )}
      {selectedRequest && (
        <LeaveReviewPanel
          request={selectedRequest}
          action={availableAction}
          pending={pending}
          error={actionError}
          onClose={() => {
            setSelection(null)
            setLinkedOpen(false)
            setActionError("")
          }}
          onSubmit={submitAction}
        />
      )}
    </AttendanceShell>
  )
}
