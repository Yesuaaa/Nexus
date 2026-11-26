"use client"

import {
  SidePanelSection,
  DetailItem,
  DetailList,
} from "@/components/ui/side-panel"
import { Alert } from "@/components/ui/alert"
import { Pill } from "@/components/ui/pill"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { humanizeEnum } from "@/lib/format"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { requestTypes, timestamp } from "../../model/payroll-documents"

/** Request information, responses and activity history. */
export function PayrollRequestDetails({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    selectedDetails,
    create,
    selectedRequestDescription,
    requestDetail,
    requestConversation,
  } = documents

  return (
    <>
      {selectedDetails && !create && (
        <>
          <SidePanelSection title="Request information">
            <DetailList>
              <DetailItem label="Concern type">
                {requestTypes.find(
                  (option) => option.value === selectedDetails.type,
                )?.label ?? humanizeEnum(selectedDetails.type)}
              </DetailItem>
              <DetailItem label="Employee">
                {selectedDetails.employee.fullName}
              </DetailItem>
              <DetailItem label="Employee ID">
                {selectedDetails.employee.employeeId}
              </DetailItem>
              <DetailItem label="Status">
                <Pill tone="neutral">
                  {humanizeEnum(selectedDetails.status)}
                </Pill>
              </DetailItem>
              <DetailItem label="Submitted">
                {timestamp(selectedDetails.createdAt)}
              </DetailItem>
              {selectedDetails.withdrawnAt && (
                <DetailItem label="Withdrawn">
                  {timestamp(selectedDetails.withdrawnAt)}
                </DetailItem>
              )}
              <DetailItem label="Related payslip">
                {selectedDetails.payslip?.reference}
              </DetailItem>
              <DetailItem label="Description">
                {selectedRequestDescription?.body}
              </DetailItem>
            </DetailList>
            {selectedDetails.needsFinancialCorrection && (
              <Pill tone="warning">Financial correction needed</Pill>
            )}
          </SidePanelSection>
          {requestDetail.error && <Alert>{requestDetail.error}</Alert>}
          {requestDetail.loading && (
            <div aria-busy="true">
              <span className="sr-only" role="status">
                Loading concern history…
              </span>
              <MemberRowSkeleton className="py-3" />
              <MemberRowSkeleton className="py-3" />
            </div>
          )}
          {requestConversation?.length ? (
            <SidePanelSection title="Responses">
              {requestConversation.map((entry) => (
                <div
                  className="grid gap-1 border-b border-[#eceef1] pb-3 last:border-b-0"
                  key={entry.id}
                >
                  <p className="text-xs">
                    {entry.isAdmin ? "Payroll Admin" : "Employee"} ·{" "}
                    {timestamp(entry.createdAt)}
                  </p>
                  <p className="m-0 whitespace-pre-wrap break-words text-sm">
                    {entry.body}
                  </p>
                </div>
              ))}
            </SidePanelSection>
          ) : null}
          {selectedDetails.activity?.length ? (
            <SidePanelSection title="Activity history">
              {selectedDetails.activity.map((entry) => {
                const activityName = entry.changes.activity
                const labels: Record<string, string> = {
                  REQUEST_CREATED: "Concern submitted",
                  REQUEST_EDITED: "Concern edited",
                  REQUEST_WITHDRAWN: "Concern deleted",
                  REQUEST_UPDATED: "Payroll updated the concern",
                  REQUEST_MESSAGE: "Employee added a message",
                }
                const summaries = [
                  entry.changes.type &&
                    `Type changed from ${humanizeEnum(entry.changes.type.before)} to ${humanizeEnum(entry.changes.type.after)}`,
                  entry.changes.description && "Description updated",
                  entry.changes.payslipId && "Related payslip updated",
                  entry.changes.requestStatus &&
                    `Status changed from ${humanizeEnum(entry.changes.requestStatus.before)} to ${humanizeEnum(entry.changes.requestStatus.after)}`,
                ].filter(Boolean)
                return (
                  <div
                    className="grid gap-1 border-b border-[#eceef1] pb-3 text-xs last:border-b-0"
                    key={entry.id}
                  >
                    <p className="font-medium">
                      {labels[activityName ?? ""] ?? humanizeEnum(entry.action)}
                    </p>
                    <p className="text-[#738096]">
                      {humanizeEnum(entry.actorRoleAtTime)} ·{" "}
                      {timestamp(entry.createdAt)}
                    </p>
                    {summaries.map((summary) => (
                      <p key={summary}>{summary}</p>
                    ))}
                  </div>
                )
              })}
            </SidePanelSection>
          ) : null}
        </>
      )}
    </>
  )
}
