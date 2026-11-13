"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import { MemberIdentity } from "@/components/ui/member-identity"
import { Pill } from "@/components/ui/pill"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import type { AttendanceAdjustment } from "../api/attendance-api"
import { attendanceDate } from "../model/attendance"

export function AttendanceAdjustmentReviewPanel({
  request,
  decision,
  zone,
  pending,
  error,
  onClose,
  onSubmit,
  verifying = false,
  readOnly,
}: {
  request: AttendanceAdjustment
  decision: "APPROVED" | "REJECTED" | null
  zone: string
  pending: boolean
  error: string
  onClose: () => void
  onSubmit: (note: string) => Promise<boolean>
  verifying?: boolean
  readOnly?: boolean
}) {
  const panel = useSidePanel(onClose)
  const [note, setNote] = useState("")
  const readOnlyView = readOnly ?? decision === null
  const approving = decision === "APPROVED"
  const statusTone =
    request.status === "APPROVED"
      ? "success"
      : request.status === "REJECTED"
        ? "danger"
        : request.status === "VERIFIED"
          ? "info"
          : "warning"
  const statusLabel =
    request.status === "VERIFIED"
      ? "Verified — awaiting HR"
      : request.status.charAt(0) + request.status.slice(1).toLowerCase()

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={pending}
      fallbackFocus={() =>
        document.getElementById(`attendance-adjustment-actions-${request.id}`)
      }
    >
      <SidePanelHeader
        title={
          readOnlyView
            ? "Request details"
            : `${verifying ? "Verify" : approving ? "Approve" : "Reject"} ${request.type === "OVERTIME" ? "overtime" : "attendance correction"}`
        }
        description={
          readOnlyView
            ? `View ${request.employee.fullName}'s request details.`
            : `Review ${request.employee.fullName}'s request before recording your decision.`
        }
        closeLabel="Close request details"
        closeDisabled={pending}
      />
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={async (event) => {
          event.preventDefault()
          if (pending || readOnlyView) return
          const saved = await onSubmit(note)
          if (saved) panel.close()
        }}
      >
        <SidePanelBody>
          {error && <Alert>{error}</Alert>}
          <SidePanelSection title="Request details">
            <MemberIdentity
              member={request.employee}
              secondaryText={
                request.type === "OVERTIME"
                  ? `${request.overtimeMinutes} overtime minutes`
                  : request.sessionId
                    ? "Session correction"
                    : "Missing attendance"
              }
            />
            <DetailList layout="stacked">
              <DetailItem
                label={
                  request.type === "OVERTIME"
                    ? "Overtime period"
                    : "Requested clock times"
                }
              >
                <span className="block">
                  {attendanceDate(request.proposedStartedAt, zone)}
                </span>
                <span className="mt-1 block">
                  {attendanceDate(request.proposedEndedAt, zone)}
                </span>
              </DetailItem>
              <DetailItem label="Status">
                <Pill tone={statusTone}>
                  {request.status === "VERIFIED"
                    ? "Verified — awaiting HR"
                    : statusLabel}
                </Pill>
              </DetailItem>
              <DetailItem label="Reason">
                <span className="whitespace-pre-wrap text-[#65718a]">
                  {request.reason}
                </span>
              </DetailItem>
              {request.reviewNote && (
                <DetailItem label="Review">
                  <span className="whitespace-pre-wrap text-[#65718a]">
                    {request.reviewNote}
                  </span>
                  <span className="mt-1 block text-xs text-[#738096]">
                    Reviewed by{" "}
                    {request.reviewedBy?.fullName ?? "Authorized reviewer"}
                  </span>
                </DetailItem>
              )}
              {request.verificationNote && (
                <DetailItem label="Department verification">
                  {request.verificationNote}
                </DetailItem>
              )}
            </DetailList>
            {request.type === "OVERTIME" && (
              <p className="m-0 text-xs text-[#738096]">
                {verifying
                  ? "Verification sends this request to HR for final approval."
                  : "Overtime approval records approved minutes without modifying attendance timestamps."}
              </p>
            )}
          </SidePanelSection>
          {!readOnlyView && (
            <SidePanelSection
              title="Review note"
              className="border-t border-[#eceef1] pt-5"
            >
              <label className="grid gap-2 text-xs">
                Review note
                <FormTextarea
                  aria-label="Review note"
                  required
                  minLength={5}
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Explain the decision for the audit trail"
                />
              </label>
            </SidePanelSection>
          )}
        </SidePanelBody>
        <SidePanelFooter>
          {readOnlyView ? (
            <SidePanelButton
              variant="secondary"
              disabled={pending}
              onClick={() => panel.close()}
            >
              Done
            </SidePanelButton>
          ) : (
            <>
              <SidePanelButton
                variant="secondary"
                disabled={pending}
                onClick={() => panel.close()}
              >
                Cancel
              </SidePanelButton>
              <SidePanelButton
                type="submit"
                variant={approving ? "primary" : "danger"}
                disabled={pending}
              >
                {pending ? "Saving…" : "Confirm decision"}
              </SidePanelButton>
            </>
          )}
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
