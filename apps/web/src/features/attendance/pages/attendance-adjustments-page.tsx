"use client"
import { useState } from "react"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canManageAttendance } from "@/features/auth/model/permissions"
import { useAsyncResource } from "@/lib/use-async-resource"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { AttendanceShell } from "../components/attendance-shell"
import {
  ResourceStatus,
  AttendancePagination,
} from "../components/attendance-shared"
import { AdjustmentDialog } from "../components/adjustment-dialog"
import {
  attendanceAdjustments,
  reviewAttendanceAdjustment,
  type AttendanceAdjustment,
} from "../api/attendance-api"
import { PageHeaderButton } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { UserRound, UsersRound } from "lucide-react"
import { AttendanceAdjustmentTable } from "../components/attendance-adjustment-table"
import { AttendanceAdjustmentReviewPanel } from "../components/attendance-adjustment-review-panel"

export function AttendanceAdjustmentsPage() {
  const account = usePortalAccount(),
    manager = canManageAttendance(account)
  const [scope, setScope] = useState<"mine" | "team">(manager ? "team" : "mine")
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [requestOpen, setRequestOpen] = useState(false)
  const [review, setReview] = useState<{
    request: AttendanceAdjustment
    decision: "APPROVED" | "REJECTED" | null
    readOnly: boolean
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const list = useAsyncResource(
    (signal) =>
      attendanceAdjustments(
        manager ? scope : "mine",
        page,
        search,
        signal,
        type,
      ),
    [scope, page, manager, search, type],
    { fallbackError: "Couldn't load attendance requests." },
  )
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  async function submitReview(reviewNote: string) {
    if (!review || review.readOnly || !review.decision || pending) return false
    setPending(true)
    setError("")
    try {
      await reviewAttendanceAdjustment(
        review.request.id,
        review.decision,
        reviewNote,
      )
      sileo.success({ title: "Attendance request reviewed" })
      list.retry()
      return true
    } catch (failure) {
      setError(errorMessage(failure, "Couldn't review this request."))
      return false
    } finally {
      setPending(false)
    }
  }
  return (
    <AttendanceShell
      tab="adjustments"
      actions={
        <PageHeaderButton onClick={() => setRequestOpen(true)}>
          Request correction
        </PageHeaderButton>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[560px]:items-stretch">
        <div className="flex flex-wrap items-center gap-3 max-[560px]:w-full">
          <SearchField
            label="Search attendance requests"
            placeholder="Search employee or reason…"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Request type filter"
            value={type}
            triggerClassName="w-[140px]"
            options={[
              { value: "", label: "All requests" },
              { value: "CORRECTION", label: "Corrections" },
              { value: "OVERTIME", label: "Overtime" },
            ]}
            onChange={(value) => {
              setType(value)
              setPage(1)
            }}
          />
        </div>
        {manager && (
          <ManagementViewToggle
            active={scope === "mine"}
            ariaLabel="Request view"
            views={[
              {
                value: false,
                label:
                  account.role === "ADMIN"
                    ? "Organization requests"
                    : "Department requests",
                icon: UsersRound,
              },
              { value: true, label: "My requests", icon: UserRound },
            ]}
            className="max-[560px]:w-full"
            onChange={(mine) => {
              setScope(mine ? "mine" : "team")
              setPage(1)
            }}
          />
        )}
      </div>
      <p className="mb-4 text-xs text-[#738096]">
        Overtime is submitted automatically at clock-out for Department Head
        verification and HR approval. Corrections update attendance after
        approval. Session details show your device timezone: {zone}.
      </p>
      <ResourceStatus
        loading={list.loading && !list.data}
        error={list.data ? "" : list.error}
        retry={list.retry}
      />
      {list.data && (
        <AttendanceAdjustmentTable
          items={list.data.adjustments}
          zone={zone}
          canReview={manager && scope === "team"}
          actorId={account.id}
          isHR={account.role === "ADMIN"}
          loading={list.loading}
          error={list.error}
          onRetry={list.retry}
          onReview={(request, decision) => {
            setReview({ request, decision, readOnly: false })
            setError("")
          }}
          onViewDetails={(request) => {
            setReview({ request, decision: null, readOnly: true })
            setError("")
          }}
        />
      )}
      {list.data && (
        <AttendancePagination
          data={list.data}
          disabled={list.loading}
          onChange={setPage}
        />
      )}
      {requestOpen && (
        <AdjustmentDialog
          session={null}
          onClose={() => setRequestOpen(false)}
          onSaved={list.retry}
        />
      )}
      {review && (
        <AttendanceAdjustmentReviewPanel
          request={review.request}
          decision={review.decision}
          readOnly={review.readOnly}
          verifying={
            account.role !== "ADMIN" &&
            review.request.type === "OVERTIME" &&
            review.decision === "APPROVED"
          }
          zone={zone}
          pending={pending}
          error={error}
          onClose={() => setReview(null)}
          onSubmit={submitReview}
        />
      )}
    </AttendanceShell>
  )
}
