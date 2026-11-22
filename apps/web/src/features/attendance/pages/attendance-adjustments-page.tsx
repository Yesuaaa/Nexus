"use client"
import { useEffect, useState } from "react"
import { ApiError } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  canAccessPersonalAttendance,
  canManageAttendance,
} from "@/features/auth/model/permissions"
import { useAsyncResource } from "@/lib/use-async-resource"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { Alert } from "@/components/ui/alert"
import { AttendanceShell } from "../components/attendance-shell"
import {
  ResourceStatus,
  AttendancePagination,
} from "../components/attendance-shared"
import { AdjustmentDialog } from "../components/adjustment-dialog"
import {
  attendanceAdjustments,
  attendanceAdjustmentDetail,
  reviewAttendanceAdjustment,
  type AttendanceAdjustment,
} from "../api/attendance-api"
import { PageHeaderButton } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { UserRound, UsersRound } from "lucide-react"
import { AttendanceAdjustmentTable } from "../components/attendance-adjustment-table"
import { AttendanceAdjustmentReviewPanel } from "../components/attendance-adjustment-review-panel"

function isReviewConflict(error: ApiError) {
  return (
    [401, 403, 404].includes(error.status) ||
    (error.status === 409 &&
      [
        "This request has already been reviewed",
        "Employee placement changed; refresh and try again",
        "Department Head verification is required before HR approval",
      ].includes(error.message))
  )
}

export function AttendanceAdjustmentsPage({
  requestType,
  linkedId,
}: {
  linkedId?: string
  requestType?: "CORRECTION" | "OVERTIME"
}) {
  const [linkedOpen, setLinkedOpen] = useState(true)
  const account = usePortalAccount(),
    manager = canManageAttendance(account)
  const selfService = canAccessPersonalAttendance(account)
  const [scope, setScope] = useState<"mine" | "team">(manager ? "team" : "mine")
  const [search, setSearch] = useState("")
  const [settledSearch, setSettledSearch] = useState(search)
  const searchPending = search !== settledSearch
  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => setSettledSearch(search), 200)
    return () => window.clearTimeout(timer)
  }, [search, searchPending])
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [requestOpen, setRequestOpen] = useState(false)
  const [review, setReview] = useState<{
    request: AttendanceAdjustment
    decision: "APPROVED" | "REJECTED" | null
    readOnly: boolean
    reconciled?: boolean
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const list = useAsyncResource(
    async (signal) => {
      if (linkedId) {
        const { adjustment } = await attendanceAdjustmentDetail(
          linkedId,
          signal,
        )
        if (requestType && adjustment.type !== requestType) {
          throw new ApiError("Attendance request not found", 404)
        }
        return {
          adjustments: [adjustment],
          total: 1,
          page: 1,
          pageSize: 1,
          capabilities: { requestCorrection: false },
        }
      }
      return attendanceAdjustments(
        manager && (!selfService || scope === "team") ? "team" : "mine",
        page,
        settledSearch,
        signal,
        requestType ?? type,
        status,
      )
    },
    [
      linkedId,
      scope,
      page,
      manager,
      selfService,
      settledSearch,
      type,
      requestType,
      status,
    ],
    {
      enabled: !searchPending,
      fallbackError: "Couldn't load attendance requests.",
    },
  )
  const data = list.error && !searchPending ? undefined : list.data
  const listLoading = list.loading || searchPending
  const listError = data || searchPending ? "" : list.error
  const linkedRequest =
    linkedId && linkedOpen && !list.loading && !list.error
      ? data?.adjustments[0]
      : undefined
  const visibleReview =
    review ??
    (linkedRequest
      ? { request: linkedRequest, decision: null, readOnly: true }
      : null)
  const panelReview = data || review?.reconciled ? visibleReview : null
  const currentReview = data?.adjustments.find(
    (item) => item.id === review?.request.id,
  )
  const reviewAllowed = Boolean(
    manager &&
    scope === "team" &&
    currentReview &&
    (review?.decision === "APPROVED"
      ? currentReview.capabilities?.approve ||
        currentReview.capabilities?.verify
      : review?.decision === "REJECTED" && currentReview.capabilities?.reject),
  )
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  async function submitReview(reviewNote: string) {
    if (
      !review ||
      review.readOnly ||
      !review.decision ||
      !reviewAllowed ||
      pending
    )
      return false
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
      if (
        review.request.type === "OVERTIME" &&
        failure instanceof ApiError &&
        isReviewConflict(failure)
      ) {
        const id = review.request.id
        function clearReviewDetails() {
          setReview(null)
          setLinkedOpen(false)
          list.setData(
            (value) =>
              value && {
                ...value,
                adjustments: value.adjustments.filter((item) => item.id !== id),
              },
          )
        }
        if (failure.status !== 409) clearReviewDetails()
        try {
          const { adjustment } = await attendanceAdjustmentDetail(id)
          setReview({
            request: adjustment,
            decision: null,
            readOnly: true,
            reconciled: true,
          })
          if (linkedId) {
            list.setData(
              (value) => value && { ...value, adjustments: [adjustment] },
            )
          } else {
            list.retry()
          }
        } catch {
          clearReviewDetails()
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
      tab={
        requestType === "OVERTIME"
          ? "overtime"
          : requestType === "CORRECTION"
            ? "corrections"
            : "adjustments"
      }
      actions={
        selfService &&
        data?.capabilities?.requestCorrection &&
        requestType !== "OVERTIME" ? (
          <PageHeaderButton onClick={() => setRequestOpen(true)}>
            Request correction
          </PageHeaderButton>
        ) : undefined
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
          {!requestType && (
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
          )}
          <FilterSelect
            label="Request status filter"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: "", label: "All statuses" },
              ...["PENDING", "VERIFIED", "APPROVED", "REJECTED"].map(
                (value) => ({
                  value,
                  label: value.charAt(0) + value.slice(1).toLowerCase(),
                }),
              ),
            ]}
          />
        </div>
        {manager && selfService && (
          <ManagementViewToggle
            active={scope === "mine"}
            ariaLabel="Request view"
            views={[
              {
                value: false,
                label:
                  account.role !== "STAFF"
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
        verification and HR approval. Corrections follow the same review stages
        and update attendance only after final approval. Superadmin can approve
        or reject at either stage. Session details show your device timezone:{" "}
        {zone}.
      </p>
      {!panelReview && error && error !== listError && (
        <Alert className="mb-4">{error}</Alert>
      )}
      <ResourceStatus loading={false} error={listError} retry={list.retry} />
      {(data || listLoading) && (
        <AttendanceAdjustmentTable
          items={data?.adjustments ?? []}
          zone={zone}
          canReview={manager && scope === "team"}
          actorId={account.id}
          isHR={account.role !== "STAFF"}
          loading={listLoading}
          error={searchPending ? "" : list.error}
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
      {data && (
        <AttendancePagination
          data={data}
          disabled={listLoading}
          onChange={setPage}
        />
      )}
      {selfService && data?.capabilities?.requestCorrection && requestOpen && (
        <AdjustmentDialog
          session={null}
          onClose={() => setRequestOpen(false)}
          onSaved={list.retry}
        />
      )}
      {panelReview && (
        <AttendanceAdjustmentReviewPanel
          request={
            review?.reconciled
              ? panelReview.request
              : (currentReview ?? panelReview.request)
          }
          decision={panelReview.decision}
          readOnly={panelReview.readOnly || !reviewAllowed}
          verifying={
            Boolean(currentReview?.capabilities?.verify) &&
            panelReview.decision === "APPROVED"
          }
          zone={zone}
          pending={pending}
          error={error}
          onClose={() => {
            setReview(null)
            setLinkedOpen(false)
            setError("")
          }}
          onSubmit={submitReview}
        />
      )}
    </AttendanceShell>
  )
}
