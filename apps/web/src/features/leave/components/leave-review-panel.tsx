"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
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
import type { LeaveAction, LeaveRequest } from "../api/leave-api"

const actionLabels: Record<LeaveAction, string> = {
  verify: "Verify request",
  approve: "Approve request",
  reject: "Reject request",
  cancel: "Cancel request",
  reverse: "Reverse approval",
}

function day(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(new Date(value))
}

export function LeaveReviewPanel({
  request,
  action,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  request: LeaveRequest
  action: LeaveAction | null
  pending: boolean
  error: string
  onClose: () => void
  onSubmit: (note: string) => Promise<boolean>
}) {
  const panel = useSidePanel(onClose)
  const [note, setNote] = useState("")
  const [confirming, setConfirming] = useState(false)
  const total = request.days.reduce((sum, item) => sum + item.leaveMinutes, 0)
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={pending}
      dismissible={!action}
      fallbackFocus={() =>
        document.getElementById(`leave-actions-${request.id}`)
      }
    >
      <SidePanelHeader
        title={action ? actionLabels[action] : "Leave request"}
        description={`${request.employee.fullName} · ${day(request.startDate)} through ${day(request.endDate)}`}
        closeLabel="Close leave request"
        closeDisabled={pending}
        meta={
          <Pill tone={request.status === "APPROVED" ? "success" : "warning"}>
            {request.status}
          </Pill>
        }
      />
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!action || pending) return
          if (action === "cancel" || action === "reverse") {
            setConfirming(true)
            return
          }
          if (await onSubmit(note)) panel.close()
        }}
      >
        <SidePanelBody>
          {error && <Alert>{error}</Alert>}
          <SidePanelSection title="Request summary">
            <DetailList>
              <DetailItem label="Employee">
                {request.employee.fullName}
              </DetailItem>
              <DetailItem label="Employee ID">
                {request.employee.employeeId}
              </DetailItem>
              <DetailItem label="Department">
                {request.employee.department?.name ?? "No department"}
              </DetailItem>
              <DetailItem label="Leave type">
                {request.type.charAt(0) + request.type.slice(1).toLowerCase()}
              </DetailItem>
              <DetailItem label="Working time">{total / 60} hours</DetailItem>
              <DetailItem label="Private reason">
                <span className="whitespace-pre-wrap">{request.reason}</span>
              </DetailItem>
            </DetailList>
          </SidePanelSection>
          <SidePanelSection title="Policy coverage">
            <div className="grid gap-2 text-xs">
              {request.days.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 border-b border-[#eceef1] pb-2 last:border-0"
                >
                  <span>{day(item.workDate)}</span>
                  <span className="text-[#65718a]">
                    {item.leaveMinutes / 60}h · {item.policyName}
                  </span>
                </div>
              ))}
            </div>
          </SidePanelSection>
          {request.decisions.length > 0 && (
            <SidePanelSection title="Decision history">
              <div className="grid gap-3 text-xs">
                {request.decisions.map((decision) => (
                  <div key={decision.id}>
                    <p className="m-0 font-medium">
                      {decision.action} ·{" "}
                      {decision.actor.fullName ?? "Workforce account"}
                    </p>
                    {decision.note && (
                      <p className="mt-1 mb-0 whitespace-pre-wrap text-[#65718a]">
                        {decision.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </SidePanelSection>
          )}
          {action && (
            <label className="grid gap-1 text-xs font-medium">
              Decision note
              <FormTextarea
                required
                minLength={5}
                maxLength={2000}
                value={note}
                disabled={pending}
                placeholder="Record the reason for this decision."
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          )}
        </SidePanelBody>
        <SidePanelFooter>
          <SidePanelButton
            variant="secondary"
            disabled={pending}
            onClick={() => panel.close()}
          >
            {action ? "Cancel" : "Close"}
          </SidePanelButton>
          {action && (
            <SidePanelButton
              type="submit"
              variant={
                action === "reject" ||
                action === "cancel" ||
                action === "reverse"
                  ? "danger"
                  : "primary"
              }
              disabled={pending}
            >
              {pending ? "Saving…" : actionLabels[action]}
            </SidePanelButton>
          )}
        </SidePanelFooter>
      </Form>
      {confirming && action && (
        <ConfirmationDialog
          title={actionLabels[action]}
          subject={request.employee.fullName}
          description={
            action === "reverse"
              ? "This removes approved leave coverage for the entire request and restores attendance requirements."
              : "This cancels the entire leave request. Submit a new request if your dates change."
          }
          confirmLabel={actionLabels[action]}
          pendingLabel="Saving…"
          pending={pending}
          error={error}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            if (await onSubmit(note)) {
              setConfirming(false)
              panel.close()
            }
          }}
        />
      )}
    </SidePanel>
  )
}
