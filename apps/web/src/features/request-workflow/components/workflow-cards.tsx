"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Download, FileText, ShieldCheck } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { downloadWorkflowFile } from "../api/workflow-api"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type {
  Workflow,
  WorkflowEvent,
  WorkflowFile,
  WorkflowQuotation,
  WorkflowRequirement,
} from "../model/workflow"
import {
  WorkflowCard,
  WorkflowField,
  workflowButton,
  workflowInput,
  workflowMoney,
} from "./workflow-primitives"

type CardProps = { workflow: Workflow; controls: WorkflowControls }

function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function FileSubmissionCard({
  file,
  requestId,
}: {
  file: WorkflowFile
  requestId: string
}) {
  const [downloading, setDownloading] = useState(false)
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e1e6ee] bg-[#f8fafd] p-3">
      <FileText
        size={20}
        className="shrink-0 text-[#203f8c]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className="m-0 truncate text-xs font-medium text-[#182235]"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="mt-1 mb-0 text-[10px] text-[#8791a2]">
          {Math.max(1, Math.ceil(file.size / 1024))} KB
        </p>
      </div>
      <Button
        aria-label={`Download ${file.name}`}
        variant="outline"
        className="size-8 shrink-0 p-0"
        disabled={downloading}
        onClick={async () => {
          setDownloading(true)
          try {
            await downloadWorkflowFile(requestId, file)
          } catch (reason) {
            sileo.error({
              title: "Couldn't download file",
              description:
                reason instanceof Error ? reason.message : "Try again.",
            })
          } finally {
            setDownloading(false)
          }
        }}
      >
        <Download size={15} aria-hidden="true" />
      </Button>
    </div>
  )
}

export function AttachedFile({
  fileId,
  workflow,
}: {
  fileId: string | null
  workflow: Workflow
}) {
  const file = workflow.files.find((item) => item.id === fileId)
  return file ? (
    <FileSubmissionCard file={file} requestId={workflow.request.id} />
  ) : null
}

export function WorkflowFileSelect({
  workflow,
  name = "fileId",
  required = false,
}: {
  workflow: Workflow
  name?: string
  required?: boolean
}) {
  const account = usePortalAccount()
  return (
    <select
      name={name}
      required={required}
      className={workflowInput}
      defaultValue=""
    >
      <option value="">
        {required ? "Select an attached file" : "No attachment"}
      </option>
      {workflow.files
        .filter((file) => file.uploaderId === account.id)
        .map((file) => (
          <option key={file.id} value={file.id}>
            {file.name}
          </option>
        ))}
    </select>
  )
}

export function RequirementRequestCard({
  requirement,
  workflow,
  controls,
}: CardProps & { requirement: WorkflowRequirement }) {
  const writable = ![
    "CANCELLED",
    "DECLINED",
    "ACTIVE_PROJECT",
    "ON_HOLD",
  ].includes(workflow.state)
  return (
    <WorkflowCard title={requirement.title} status={requirement.status}>
      <p className="m-0">
        {requirement.details ||
          "Submit the requested information or attach a document."}{" "}
        {requirement.mandatory && (
          <span className="font-medium">Required.</span>
        )}
      </p>
      {requirement.submission && (
        <p className="m-0 whitespace-pre-wrap rounded-lg bg-[#f5f7fa] p-3">
          {requirement.submission}
        </p>
      )}
      <AttachedFile fileId={requirement.fileId} workflow={workflow} />
      {requirement.reviewNote && (
        <p className="m-0 text-[11px]">Review: {requirement.reviewNote}</p>
      )}
      {workflow.permissions.isClient &&
        requirement.status !== "COMPLETED" &&
        writable && (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const form = event.currentTarget
              const data = new FormData(form)
              if (
                await controls.act({
                  type: "SUBMIT_REQUIREMENT",
                  requirementId: requirement.id,
                  submission: String(data.get("submission") || ""),
                  ...(data.get("fileId")
                    ? { fileId: String(data.get("fileId")) }
                    : {}),
                })
              )
                form.reset()
            }}
          >
            <WorkflowField label="Your response">
              <textarea
                name="submission"
                rows={2}
                maxLength={4000}
                defaultValue={requirement.submission || ""}
                className={workflowInput}
              />
            </WorkflowField>
            <WorkflowField label="Supporting document">
              <WorkflowFileSelect workflow={workflow} />
            </WorkflowField>
            <Button className={workflowButton} disabled={controls.busy}>
              Submit requirement
            </Button>
          </form>
        )}
      {workflow.permissions.manage &&
        requirement.status === "SUBMITTED" &&
        writable && (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const button = (event.nativeEvent as SubmitEvent).submitter
              await controls.act({
                type: "REVIEW_REQUIREMENT",
                requirementId: requirement.id,
                approve:
                  button instanceof HTMLButtonElement &&
                  button.value === "approve",
                note: String(data.get("note") || ""),
              })
            }}
          >
            <WorkflowField label="Review note">
              <input name="note" maxLength={2000} className={workflowInput} />
            </WorkflowField>
            <div className="flex flex-wrap gap-2">
              <Button
                name="decision"
                value="approve"
                className={workflowButton}
                disabled={controls.busy}
              >
                Mark complete
              </Button>
              <Button
                name="decision"
                value="reject"
                variant="outline"
                className={workflowButton}
                disabled={controls.busy}
              >
                Request changes
              </Button>
            </div>
          </form>
        )}
    </WorkflowCard>
  )
}

export function ConsultationSchedulingCard({
  consultation,
  workflow,
  controls,
}: CardProps & { consultation: Workflow["consultations"][number] }) {
  const now = useCurrentTime()
  return (
    <WorkflowCard title="Consultation" status={consultation.status}>
      <p className="m-0 font-medium text-[#182235]">
        {new Date(consultation.startsAt).toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      <p className="m-0">
        Until{" "}
        {new Date(consultation.endsAt).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        · {consultation.location}
      </p>
      {consultation.notes && (
        <p className="m-0 whitespace-pre-wrap">{consultation.notes}</p>
      )}
      {workflow.permissions.manage &&
        consultation.status === "SCHEDULED" &&
        [
          "CONSULTATION",
          "QUOTATION_PENDING",
          "CLIENT_APPROVAL",
          "REVISION_REQUESTED",
        ].includes(workflow.state) && (
          <div className="flex flex-wrap gap-2">
            <Button
              className={workflowButton}
              disabled={
                controls.busy || new Date(consultation.startsAt).getTime() > now
              }
              onClick={() =>
                void controls.act({
                  type: "COMPLETE_CONSULTATION",
                  consultationId: consultation.id,
                })
              }
            >
              Mark consultation complete
            </Button>
            <Button
              variant="outline"
              className={workflowButton}
              disabled={controls.busy}
              onClick={() =>
                void controls.act({
                  type: "CANCEL_CONSULTATION",
                  consultationId: consultation.id,
                })
              }
            >
              Cancel schedule
            </Button>
          </div>
        )}
    </WorkflowCard>
  )
}

export function QuotationProposalCard({
  quotation,
  workflow,
  controls,
}: CardProps & { quotation: WorkflowQuotation }) {
  const now = useCurrentTime()
  const latest = quotation.id === workflow.quotations.at(-1)?.id
  const valid = new Date(quotation.validUntil).getTime() > now
  const respond =
    workflow.permissions.isClient &&
    latest &&
    valid &&
    quotation.status === "SENT" &&
    workflow.state === "CLIENT_APPROVAL"
  return (
    <WorkflowCard
      title={`Quotation · version ${quotation.version}`}
      status={quotation.status}
    >
      <p className="m-0 whitespace-pre-wrap text-[#182235]">
        {quotation.scope}
      </p>
      <ul className="my-0 pl-4">
        {quotation.deliverables.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[230px] border-collapse text-[11px]">
          <caption className="sr-only">Pricing breakdown</caption>
          <thead>
            <tr className="border-b border-[#e1e6ee] text-left">
              <th className="pb-2 font-medium">Item</th>
              <th className="px-2 pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit price</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lineItems.map((item, index) => (
              <tr key={index}>
                <td className="py-1.5">{item.description}</td>
                <td className="px-2 py-1.5 text-right">{item.quantity}</td>
                <td className="py-1.5 text-right">
                  {workflowMoney(item.unitPrice, quotation.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 flex justify-between gap-3 border-t border-[#e1e6ee] pt-3 font-semibold text-[#182235]">
        <span>Total</span>
        <span>{workflowMoney(quotation.total, quotation.currency)}</span>
      </p>
      <dl className="m-0 grid gap-2">
        <div>
          <dt className="font-medium">Estimated timeline</dt>
          <dd className="m-0 whitespace-pre-wrap">{quotation.timeline}</dd>
        </div>
        <div>
          <dt className="font-medium">Payment terms</dt>
          <dd className="m-0 whitespace-pre-wrap">{quotation.paymentTerms}</dd>
          <dd className="m-0">
            Due before commencement:{" "}
            {workflowMoney(quotation.paymentDue, quotation.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Valid until</dt>
          <dd className="m-0">
            {new Date(quotation.validUntil).toLocaleString("en-PH")}
            {!valid && quotation.status === "SENT" ? " · Expired" : ""}
          </dd>
        </div>
      </dl>
      {quotation.decisionNote && (
        <p className="m-0 rounded-lg bg-[#f5f7fa] p-3 whitespace-pre-wrap">
          {quotation.decisionNote}
        </p>
      )}
      {respond && (
        <form
          className="space-y-3 border-t border-[#e1e6ee] pt-3"
          onSubmit={async (event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const button = (event.nativeEvent as SubmitEvent).submitter
            const decision =
              button instanceof HTMLButtonElement ? button.value : ""
            if (
              decision === "ACCEPT" ||
              decision === "DECLINE" ||
              decision === "REVISE"
            )
              await controls.act({
                type: "RESPOND_QUOTATION",
                quotationId: quotation.id,
                decision,
                note: String(data.get("note") || ""),
              })
          }}
        >
          <WorkflowField label="Decision note or requested revisions">
            <textarea
              name="note"
              rows={2}
              maxLength={2000}
              className={workflowInput}
            />
          </WorkflowField>
          <label className="flex items-start gap-2 text-[11px]">
            <input
              type="checkbox"
              name="confirmation"
              required
              className="mt-1 accent-[#203f8c]"
            />
            <span>
              I have reviewed this quotation and confirm my selected decision.
              Only these buttons record formal approval.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              value="ACCEPT"
              className={workflowButton}
              disabled={controls.busy}
            >
              Accept quotation
            </Button>
            <Button
              value="REVISE"
              variant="outline"
              className={workflowButton}
              disabled={controls.busy}
            >
              Request revision
            </Button>
            <Button
              value="DECLINE"
              variant="outline"
              className={workflowButton}
              disabled={controls.busy}
            >
              Decline quotation
            </Button>
          </div>
        </form>
      )}
      {workflow.permissions.approveQuotation &&
        quotation.status === "PENDING_INTERNAL" &&
        latest &&
        valid &&
        workflow.state === "QUOTATION_PENDING" && (
          <Button
            className={workflowButton}
            disabled={controls.busy}
            onClick={() =>
              void controls.act({
                type: "APPROVE_QUOTATION",
                quotationId: quotation.id,
              })
            }
          >
            Approve and send quotation
          </Button>
        )}
      {quotation.status === "PENDING_INTERNAL" &&
        !workflow.permissions.approveQuotation && (
          <p className="m-0 text-[11px]">
            Awaiting the assigned quotation approver.
          </p>
        )}
    </WorkflowCard>
  )
}

export function ApprovalConfirmationCard({ workflow }: { workflow: Workflow }) {
  const approval = workflow.approval
  if (!approval) return null
  const quotation = workflow.quotations.find(
    (item) => item.id === approval.quotationId,
  )
  return (
    <WorkflowCard title="Quotation formally accepted" status="APPROVED">
      <div className="flex gap-3">
        <ShieldCheck
          size={22}
          aria-hidden="true"
          className="shrink-0 text-[#203f8c]"
        />
        <div>
          <p className="m-0">
            {workflow.request.client.fullName || "The client"} accepted
            quotation version {quotation?.version || "—"} for{" "}
            <strong>{workflowMoney(approval.amount, approval.currency)}</strong>
            .
          </p>
          <p className="mt-1 mb-0 text-[10px]">
            {new Date(approval.approvedAt).toLocaleString("en-PH")} · Approval
            recorded for account {approval.approvedById}
          </p>
        </div>
      </div>
    </WorkflowCard>
  )
}

export function AgreementCard({ workflow, controls }: CardProps) {
  const agreement = workflow.agreement
  if (!agreement) return null
  const writable = [
    "AGREEMENT_PAYMENT_PENDING",
    "READY_FOR_ACTIVATION",
  ].includes(workflow.state)
  return (
    <WorkflowCard title="Service agreement" status={agreement.status}>
      <p className="m-0">
        {agreement.mandatory
          ? "An approved agreement is required before project activation."
          : "An agreement is optional for this service."}
      </p>
      <AttachedFile fileId={agreement.documentFileId} workflow={workflow} />
      {(workflow.permissions.manage || workflow.permissions.verifyPayment) &&
        writable &&
        agreement.status === "PENDING" && (
          <form
            className="flex flex-col gap-2"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              await controls.act({
                type: "ATTACH_AGREEMENT",
                fileId: String(data.get("fileId")),
              })
            }}
          >
            <WorkflowField label="Agreement document">
              <WorkflowFileSelect workflow={workflow} required />
            </WorkflowField>
            <Button
              variant="outline"
              className={workflowButton}
              disabled={controls.busy}
            >
              Attach agreement document
            </Button>
          </form>
        )}
      <AttachedFile fileId={agreement.signedFileId} workflow={workflow} />
      {workflow.permissions.isClient &&
        writable &&
        agreement.documentFileId &&
        agreement.status === "PENDING" && (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              await controls.act({
                type: "SIGN_AGREEMENT",
                fileId: String(data.get("fileId")),
              })
            }}
          >
            <WorkflowField label="Signed agreement">
              <WorkflowFileSelect workflow={workflow} required />
            </WorkflowField>
            <Button className={workflowButton} disabled={controls.busy}>
              Submit signed agreement
            </Button>
          </form>
        )}
      {workflow.permissions.manage &&
        writable &&
        agreement.status === "SUBMITTED" && (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const button = (event.nativeEvent as SubmitEvent).submitter
              await controls.act({
                type: "REVIEW_AGREEMENT",
                approve:
                  button instanceof HTMLButtonElement &&
                  button.value === "approve",
                note: String(data.get("note") || ""),
              })
            }}
          >
            <WorkflowField label="Agreement review note">
              <input name="note" maxLength={2000} className={workflowInput} />
            </WorkflowField>
            <div className="flex flex-wrap gap-2">
              <Button
                value="approve"
                className={workflowButton}
                disabled={controls.busy}
              >
                Approve agreement
              </Button>
              <Button
                value="reject"
                variant="outline"
                className={workflowButton}
                disabled={controls.busy}
              >
                Return agreement
              </Button>
            </div>
          </form>
        )}
    </WorkflowCard>
  )
}

export function PaymentVerificationCard({ workflow, controls }: CardProps) {
  const payment = workflow.payment
  if (!payment) return null
  const writable = [
    "AGREEMENT_PAYMENT_PENDING",
    "READY_FOR_ACTIVATION",
  ].includes(workflow.state)
  return (
    <WorkflowCard title="Payment requirement" status={payment.status}>
      <p className="m-0 font-semibold text-[#182235]">
        {workflowMoney(payment.amount, payment.currency)}
      </p>
      <p className="m-0">
        {payment.mandatory
          ? "Manual verification by the assigned payment verifier is required before activation."
          : "No mandatory commencement payment for this service."}
      </p>
      {payment.reference && (
        <p className="m-0">Reference: {payment.reference}</p>
      )}
      <AttachedFile fileId={payment.proofFileId} workflow={workflow} />
      {workflow.permissions.isClient &&
        writable &&
        payment.status !== "VERIFIED" && (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              await controls.act({
                type: "SUBMIT_PAYMENT",
                fileId: String(data.get("fileId")),
                reference: String(data.get("reference")),
              })
            }}
          >
            <WorkflowField label="Payment reference">
              <input
                name="reference"
                required
                maxLength={300}
                className={workflowInput}
              />
            </WorkflowField>
            <WorkflowField label="Proof of payment">
              <WorkflowFileSelect workflow={workflow} required />
            </WorkflowField>
            <Button className={workflowButton} disabled={controls.busy}>
              Submit payment proof
            </Button>
          </form>
        )}
      {workflow.permissions.verifyPayment &&
        writable &&
        payment.status === "SUBMITTED" && (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const button = (event.nativeEvent as SubmitEvent).submitter
              await controls.act({
                type: "VERIFY_PAYMENT",
                approve:
                  button instanceof HTMLButtonElement &&
                  button.value === "approve",
                note: String(data.get("note") || ""),
              })
            }}
          >
            <WorkflowField label="Verification note">
              <input
                name="note"
                required
                maxLength={2000}
                className={workflowInput}
              />
            </WorkflowField>
            <div className="flex flex-wrap gap-2">
              <Button
                value="approve"
                className={workflowButton}
                disabled={controls.busy}
              >
                Verify payment
              </Button>
              <Button
                value="reject"
                variant="outline"
                className={workflowButton}
                disabled={controls.busy}
              >
                Return payment proof
              </Button>
            </div>
          </form>
        )}
    </WorkflowCard>
  )
}

export function ProjectActivationCard({ workflow }: { workflow: Workflow }) {
  if (!workflow.project || workflow.state !== "ACTIVE_PROJECT") return null
  return (
    <WorkflowCard title="Your project is active" status="ACTIVE_PROJECT">
      <p className="m-0">{workflow.project.name}</p>
      <p className="m-0">
        Your consultation history and approved documents remain available in
        this conversation.
      </p>
      <Button asChild className={workflowButton}>
        <Link href={`/projects/${encodeURIComponent(workflow.project.id)}`}>
          View Project
        </Link>
      </Button>
    </WorkflowCard>
  )
}

export function SystemStatusUpdate({ event }: { event: WorkflowEvent }) {
  return (
    <div className="my-4 flex gap-2 text-[10px] leading-5 text-[#8791a2]">
      <span
        aria-hidden="true"
        className="mt-2 size-1.5 shrink-0 rounded-full bg-[#8ba1c7]"
      />
      <p className="m-0 flex-1 whitespace-pre-wrap">
        {event.summary}
        <time dateTime={event.createdAt} className="ml-2 text-[9px]">
          {new Date(event.createdAt).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
      </p>
    </div>
  )
}

export function WorkflowEventCard({
  event,
  workflow,
  controls,
}: CardProps & { event: WorkflowEvent }) {
  if (event.type === "APPROVAL_CONFIRMED")
    return (
      <>
        <SystemStatusUpdate event={event} />
        <ApprovalConfirmationCard workflow={workflow} />
      </>
    )
  const latest =
    !event.entityId ||
    workflow.events.filter((item) => item.entityId === event.entityId).at(-1)
      ?.id === event.id
  if (!latest) return <SystemStatusUpdate event={event} />
  const requirement = workflow.requirements.find(
    (item) => item.id === event.entityId,
  )
  if (requirement)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <RequirementRequestCard
          requirement={requirement}
          workflow={workflow}
          controls={controls}
        />
      </>
    )
  const file = workflow.files.find((item) => item.id === event.entityId)
  if (file)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <FileSubmissionCard file={file} requestId={workflow.request.id} />
      </>
    )
  const consultation = workflow.consultations.find(
    (item) => item.id === event.entityId,
  )
  if (consultation)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <ConsultationSchedulingCard
          consultation={consultation}
          workflow={workflow}
          controls={controls}
        />
      </>
    )
  const quotation = workflow.quotations.find(
    (item) => item.id === event.entityId,
  )
  if (quotation)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <QuotationProposalCard
          quotation={quotation}
          workflow={workflow}
          controls={controls}
        />
      </>
    )
  if (workflow.agreement?.id === event.entityId)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <AgreementCard workflow={workflow} controls={controls} />
      </>
    )
  if (workflow.payment?.id === event.entityId)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <PaymentVerificationCard workflow={workflow} controls={controls} />
      </>
    )
  if (workflow.project?.id === event.entityId)
    return (
      <>
        <SystemStatusUpdate event={event} />
        <ProjectActivationCard workflow={workflow} />
      </>
    )
  return <SystemStatusUpdate event={event} />
}
