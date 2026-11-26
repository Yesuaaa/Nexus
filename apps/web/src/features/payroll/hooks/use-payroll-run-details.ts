"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import {
  calculatePayrollRun,
  transitionPayrollApproval,
  type PayrollApprovalAction,
  getPayrollRun,
  listPayrollRunItems,
  type PayrollRunItem,
} from "../api/payroll-runs-api"
import {
  submissionFor,
  matchesItem,
  runStatusLabel,
  calculationTone,
  approvalItemColumns,
  itemColumns,
  formatPeriodRange,
  frequencyLabel,
} from "../model/payroll-run-view"

/** State, data and actions for one payroll run or approval. */
export function usePayrollRunDetails({
  runId,
  approvalRevisionId,
  canManage,
  approvals,
  refreshKey,
  onClose,
  onChanged,
}: {
  runId: string | null
  approvalRevisionId: string | null
  canManage: boolean
  approvals: boolean
  refreshKey: number
  onClose: () => void
  onChanged: () => void
}) {
  const [approvalAction, setApprovalAction] =
    useState<PayrollApprovalAction | null>(null)
  const [reason, setReason] = useState("")
  const [itemSearch, setItemSearch] = useState("")
  const [selectedCalculationId, setSelectedCalculationId] = useState("")
  const [selectedItem, setSelectedItem] = useState<PayrollRunItem | null>(null)
  const runBodyRef = useRef<HTMLDivElement>(null)
  const breakdownRef = useRef<HTMLDivElement>(null)
  const returnToRunRef = useRef<{
    button: HTMLButtonElement
    scrollTop: number
  } | null>(null)
  useEffect(() => {
    const body = runBodyRef.current
    if (!body) return
    if (selectedItem) {
      body.scrollTop = 0
      breakdownRef.current?.focus({ preventScroll: true })
    } else if (returnToRunRef.current) {
      body.scrollTop = returnToRunRef.current.scrollTop
      returnToRunRef.current.button.focus({ preventScroll: true })
      returnToRunRef.current = null
    }
  }, [selectedItem])
  const [confirmRecalculate, setConfirmRecalculate] = useState(false)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState("")
  const run = useAsyncResource(
    (signal) => getPayrollRun(runId ?? "", signal),
    [runId, refreshKey],
    {
      enabled: Boolean(runId),
      fallbackError: "Couldn't load this payroll run.",
    },
  )
  const reviewRevision = approvals
    ? run.data?.calculationHistory.find(
        (revision) =>
          revision.id === approvalRevisionId && submissionFor(revision),
      )
    : null
  const activeRevisionId = approvals
    ? (reviewRevision?.id ?? "")
    : selectedCalculationId
  const items = usePaginatedList({
    params: {
      search: itemSearch.trim(),
      runId: runId ?? "",
      calculationId: activeRevisionId,
    },
    load: ({ page, signal }) =>
      runId && (!approvals || activeRevisionId)
        ? listPayrollRunItems(runId, {
            page,
            search: itemSearch.trim(),
            calculationId: activeRevisionId || undefined,
            signal,
          })
        : Promise.resolve({
            rows: [],
            total: 0,
            page,
            pageSize: 10,
            calculationId: null,
          }),
    rows: (result) => result.rows,
    matches: matchesItem,
    initial: { rows: [], total: 0, page: 1, pageSize: 10, calculationId: null },
    fallbackError: "Couldn't load employee calculations.",
  })
  const { onRowsSettled: settleEmployeeRows } = items
  // Employee rows render directly, so there is no animation to settle.
  useEffect(settleEmployeeRows, [settleEmployeeRows])
  const selectedRevision = useMemo(
    () =>
      (approvals
        ? reviewRevision
        : run.data?.calculationHistory.find(
            ({ id }) =>
              id === (activeRevisionId || run.data?.latestCalculation?.id),
          )) ?? null,
    [approvals, reviewRevision, run.data, activeRevisionId],
  )

  const latest = run.data?.latestCalculation
  const account = usePortalAccount()
  const selfApproval =
    !run.data?.demoSelfApprovalEnabled &&
    (account.id === run.data?.createdBy.id ||
      account.id === selectedRevision?.createdBy?.id)
  const submission = submissionFor(selectedRevision)
  const decision = selectedRevision?.approvalEvents?.find(
    ({ action }) =>
      action === "PAYROLL_APPROVED" || action === "PAYROLL_REJECTED",
  )
  const approvalStatus = decision
    ? runStatusLabel(
        decision.action === "PAYROLL_APPROVED" ? "APPROVED" : "REJECTED",
      )
    : submission
      ? runStatusLabel("PENDING_APPROVAL")
      : "—"
  const canRecalculate =
    canManage &&
    !approvals &&
    run.data?.status !== "PENDING_APPROVAL" &&
    run.data?.status !== "APPROVED"
  const reviewIsCurrent = selectedRevision?.id === latest?.id
  const eligible =
    latest?.status === "COMPLETE" &&
    latest.calculatedItemCount > 0 &&
    !latest.reviewItemCount &&
    !latest.blockedItemCount

  function openApproval(action: PayrollApprovalAction) {
    setActionError("")
    setReason("")
    setApprovalAction(action)
  }

  async function confirmApproval() {
    if (!runId || !selectedRevision || !approvalAction || pending) return
    if (approvalAction === "reject" && reason.trim().length < 5) {
      setActionError("Enter a rejection reason of at least 5 characters.")
      return
    }
    setPending(true)
    setActionError("")
    try {
      await transitionPayrollApproval(
        runId,
        selectedRevision.id,
        approvalAction,
        reason.trim(),
      )
      sileo.success({
        title: {
          submit: "Payroll submitted",
          approve: "Payroll approved",
          reject: "Payroll rejected",
        }[approvalAction],
      })
      setApprovalAction(null)
      onChanged()
    } catch (error) {
      setActionError(errorMessage(error, "Couldn't update payroll approval."))
    } finally {
      setPending(false)
    }
  }

  async function recalculate() {
    if (!runId) return
    setPending(true)
    setActionError("")
    try {
      await calculatePayrollRun(runId)
      setSelectedCalculationId("")
      setSelectedItem(null)
      setConfirmRecalculate(false)
      run.retry()
      items.retry()
      onChanged()
      sileo.success({
        title: "New calculation revision saved",
        description: "Earlier revisions remain available for comparison.",
      })
    } catch (reason) {
      setActionError(errorMessage(reason, "Couldn't recalculate this run."))
    } finally {
      setPending(false)
    }
  }

  function closePanel() {
    returnToRunRef.current = null
    onClose()
    setSelectedCalculationId("")
    setSelectedItem(null)
    setItemSearch("")
    items.setPage(1)
  }

  const summary = selectedRevision
  const statusTone = summary
    ? calculationTone(summary.status)
    : ("neutral" as const)
  const employeeColumns = approvals ? approvalItemColumns : itemColumns
  const employeeColumnCount = approvals ? 6 : 5
  const historyEvents =
    run.data?.calculationHistory.flatMap((revision) =>
      (revision.approvalEvents ?? []).map((event) => ({ revision, event })),
    ) ?? []
  const displayedHistoryEvents = approvals
    ? [...historyEvents].sort((left, right) =>
        left.event.createdAt.localeCompare(right.event.createdAt),
      )
    : historyEvents
  const approvalPeriodDescription =
    approvals && run.data && selectedRevision
      ? [
          formatPeriodRange(run.data.period.startDate, run.data.period.endDate),
          frequencyLabel(run.data.period.frequency),
          `Revision ${selectedRevision.revision}`,
        ].join(" · ")
      : null

  return {
    approvalAction,
    setApprovalAction,
    reason,
    setReason,
    itemSearch,
    setItemSearch,
    setSelectedCalculationId,
    selectedItem,
    setSelectedItem,
    runBodyRef,
    breakdownRef,
    returnToRunRef,
    confirmRecalculate,
    setConfirmRecalculate,
    pending,
    actionError,
    run,
    items,
    selectedRevision,
    selfApproval,
    submission,
    approvalStatus,
    canRecalculate,
    reviewIsCurrent,
    eligible,
    openApproval,
    confirmApproval,
    recalculate,
    closePanel,
    summary,
    statusTone,
    employeeColumns,
    employeeColumnCount,
    displayedHistoryEvents,
    approvalPeriodDescription,
    runId,
    canManage,
    approvals,
  }
}

export type PayrollRunDetailsState = ReturnType<typeof usePayrollRunDetails>
