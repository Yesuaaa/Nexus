"use client"

import { EmptyState } from "@/components/ui/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pill } from "@/components/ui/pill"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import {
  SidePanelError,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
} from "@/components/ui/side-panel"
import { formatPayrollDate } from "../../model/period-format"
import { usePayrollRunDetails } from "../../hooks/use-payroll-run-details"
import { frequencyLabel, runStatusLabel } from "../../model/payroll-run-view"
import { RunSummaryTab } from "./run-summary-tab"
import { RunApprovalTab } from "./run-approval-tab"
import { RunEmployeesTab } from "./run-employees-tab"
import { RunDialogs } from "./run-dialogs"

/** Side panel for a payroll run, or for an approval of one. */
export function PayrollRunDetailsPanel({
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
  const details = usePayrollRunDetails({
    runId,
    approvalRevisionId,
    canManage,
    approvals,
    refreshKey,
    onClose,
    onChanged,
  })
  const {
    closePanel,
    run,
    approvalPeriodDescription,
    approvalStatus,
    runBodyRef,
    summary,
    returnToRunRef,
    setSelectedItem,
    reviewIsCurrent,
    pending,
    openApproval,
    selfApproval,
    eligible,
  } = details

  return (
    <>
      <SidePanel
        open={Boolean(runId)}
        onOpenChange={(open) => !open && closePanel()}
      >
        {runId && (
          <>
            <SidePanelHeader
              title={
                approvals
                  ? "Approval Details"
                  : (run.data?.period.cutoffLabel ?? "Payroll run details")
              }
              description={
                run.data
                  ? approvals
                    ? (approvalPeriodDescription ??
                      "Review the submitted payroll revision.")
                    : `${formatPayrollDate(run.data.period.startDate)} – ${formatPayrollDate(run.data.period.endDate)} · ${frequencyLabel(run.data.period.frequency)}`
                  : approvals
                    ? "Review the submitted payroll revision."
                    : "Review period results and employee calculation details."
              }
              eyebrow={approvals ? undefined : "Payroll run"}
              meta={
                run.data ? (
                  <Pill
                    tone={run.data.status === "DRAFT" ? "warning" : "brand"}
                  >
                    {approvals
                      ? approvalStatus
                      : runStatusLabel(run.data.status)}
                  </Pill>
                ) : undefined
              }
            />
            <SidePanelBody ref={runBodyRef}>
              {run.loading ? (
                <div aria-busy="true">
                  <span className="sr-only" role="status">
                    Loading payroll run…
                  </span>
                  <MemberRowSkeleton className="py-3" />
                  <MemberRowSkeleton className="py-3" />
                </div>
              ) : run.error ? (
                <SidePanelError message={run.error} onRetry={run.retry} />
              ) : run.data && approvals && !summary ? (
                <EmptyState title="No submitted revision" size="sm" />
              ) : run.data ? (
                <Tabs
                  className="min-w-0"
                  defaultValue={approvals && summary ? "approval" : "summary"}
                  onValueChange={() => {
                    returnToRunRef.current = null
                    setSelectedItem(null)
                    if (runBodyRef.current) runBodyRef.current.scrollTop = 0
                  }}
                >
                  <TabsList
                    aria-label={
                      approvals
                        ? "Payroll approval sections"
                        : "Payroll run sections"
                    }
                    variant="underline"
                    className="-mx-6 -mt-5 w-auto max-[560px]:-mx-5"
                  >
                    {!approvals && (
                      <TabsTrigger value="summary" variant="underline">
                        Summary
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="approval"
                      variant="underline"
                      disabled={!summary}
                    >
                      Approval
                    </TabsTrigger>
                    <TabsTrigger
                      value="employees"
                      variant="underline"
                      disabled={!summary}
                    >
                      Employees
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="summary"
                    className="mt-5 gap-5 data-[state=active]:grid"
                  >
                    <RunSummaryTab details={details} data={run.data} />
                  </TabsContent>
                  <TabsContent
                    value="approval"
                    className="mt-5 gap-5 data-[state=active]:grid"
                  >
                    <RunApprovalTab details={details} data={run.data} />
                  </TabsContent>
                  <TabsContent
                    value="employees"
                    className="mt-5 gap-5 data-[state=active]:grid"
                  >
                    <RunEmployeesTab details={details} />
                  </TabsContent>
                </Tabs>
              ) : null}
            </SidePanelBody>
            <SidePanelFooter
              className={approvals ? "justify-between" : undefined}
            >
              <SidePanelButton variant="secondary" onClick={closePanel}>
                Close
              </SidePanelButton>
              {approvals &&
                canManage &&
                run.data?.status === "PENDING_APPROVAL" &&
                reviewIsCurrent && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <SidePanelButton
                      variant="danger"
                      disabled={pending}
                      onClick={() => openApproval("reject")}
                    >
                      Reject
                    </SidePanelButton>
                    {!selfApproval && (
                      <SidePanelButton
                        disabled={pending || !eligible}
                        onClick={() => openApproval("approve")}
                      >
                        Approve
                      </SidePanelButton>
                    )}
                  </div>
                )}
            </SidePanelFooter>
          </>
        )}
      </SidePanel>
      <RunDialogs details={details} />
    </>
  )
}
