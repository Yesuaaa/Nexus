"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Download, FileText, ShieldCheck } from "lucide-react"
import { sileo } from "sileo"
import { AttachmentPreview, attachmentAccept } from "./attachment-preview"

export function getConsultationMeetingUrl(location: string) {
  try {
    const url = new URL(location)
    return ["https:", "http:"].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export function ConsultationLocation({
  location,
  className,
  showJoinButton = true,
}: {
  location: string
  className?: string
  showJoinButton?: boolean
}) {
  const href = getConsultationMeetingUrl(location)
  if (href && showJoinButton)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex w-fit items-center justify-center rounded-lg bg-[#203f8c] px-3 py-2 text-[10px] font-semibold text-white no-underline shadow-[0_4px_10px_rgb(32_63_140_/_18%)] transition-colors hover:bg-[#172f70]",
          className,
        )}
      >
        Join consultation
      </a>
    )
  return (
    <span className={cn("break-words", className)}>
      {href ? "Online meeting" : location}
    </span>
  )
}
import { Button } from "@/components/ui/button"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import {
  createWorkflowFilePreviewUrl,
  downloadWorkflowFile,
} from "../api/workflow-api"
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

type CardProps = {
  workflow: Workflow
  controls: WorkflowControls
  onPrepareQuotation?: () => void
}
const workflowPrimaryButton = `${workflowButton} bg-[#203f8c] text-white hover:bg-[#172f70]`

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
  className,
}: {
  file: WorkflowFile
  requestId: string
  className?: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [preview, setPreview] = useState<{
    fileId: string
    url: string
  } | null>(null)
  const isImage = file.mimeType.startsWith("image/")
  const isVideo = file.mimeType.startsWith("video/")
  const isMedia = isImage || isVideo

  useEffect(() => {
    if (!isMedia) return
    let active = true
    let objectUrl: string | null = null
    void createWorkflowFilePreviewUrl(requestId, file.id)
      .then((url) => {
        objectUrl = url
        if (!active) {
          URL.revokeObjectURL(url)
          return
        }
        setPreview({ fileId: file.id, url })
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.id, isMedia, requestId])

  return (
    <div
      className={cn(
        isMedia
          ? "w-fit max-w-[min(100%,22rem)] overflow-hidden rounded-xl border border-[#dce4ef] bg-[#f8fafd]"
          : "w-[min(100%,22rem)] rounded-xl border border-[#dce4ef] bg-[#f1f3f7] p-2",
        className,
      )}
    >
      {isMedia && preview?.fileId === file.id ? (
        isImage ? (
          <Image
            src={preview.url}
            alt={file.name}
            width={960}
            height={640}
            unoptimized
            className="block h-auto max-h-[min(50dvh,18rem)] max-w-full w-auto object-contain"
          />
        ) : (
          <video
            controls
            preload="metadata"
            className="block h-auto max-h-[min(50dvh,18rem)] max-w-full w-auto bg-[#101828]"
          >
            <source src={preview.url} type={file.mimeType} />
            Your browser does not support video playback.
          </video>
        )
      ) : null}
      <div
        className={
          isMedia
            ? "flex min-w-0 items-center gap-3 p-2.5"
            : "flex min-w-0 items-center gap-3"
        }
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#dfe7f5] text-[#203f8c]">
          <FileText size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="m-0 truncate text-xs font-semibold text-[#182235]"
            title={file.name}
          >
            {file.name}
          </p>
          <p className="mt-0.5 mb-0 text-[11px] text-[#6d7b91]">
            {isVideo ? "Video · " : isImage ? "Image · " : "File · "}
            {Math.max(1, Math.ceil(file.size / 1024))} KB
          </p>
        </div>
        <Button
          aria-label={`Download ${file.name}`}
          variant="outline"
          className="size-9 shrink-0 rounded-full border-0 bg-transparent p-0 text-[#52627a] hover:bg-[#dfe7f5] hover:text-[#203f8c]"
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
          <Download size={16} aria-hidden="true" />
        </Button>
      </div>
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
        requirement.status === "REQUESTED" &&
        writable && (
          <form
            className="grid gap-4"
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
            <Button className={workflowPrimaryButton} disabled={controls.busy}>
              Submit requirement
            </Button>
          </form>
        )}
      {workflow.permissions.manage &&
        requirement.status === "SUBMITTED" &&
        writable && (
          <form
            className="grid gap-4"
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
                className={workflowPrimaryButton}
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
      {workflow.permissions.isClient && requirement.status === "SUBMITTED" && (
        <p
          role="status"
          className="m-0 rounded-lg bg-[#edf2fb] p-3 text-xs text-[#294a9b]"
        >
          Your response is awaiting department review. You can submit changes if
          it is returned.
        </p>
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
  const [rescheduling, setRescheduling] = useState(false)
  const rescheduleEvent = workflow.events
    .filter(
      (event) =>
        event.entityId === consultation.id &&
        [
          "CONSULTATION_RESCHEDULE_REQUESTED",
          "CONSULTATION_RESCHEDULE_CONFIRMED",
          "CONSULTATION_RESCHEDULE_DECLINED",
        ].includes(event.type),
    )
    .at(-1)
  const pendingReschedule =
    rescheduleEvent?.type === "CONSULTATION_RESCHEDULE_REQUESTED"
      ? rescheduleEvent
      : null
  const preferredTime =
    pendingReschedule?.summary.match(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
    )?.[0] || consultation.startsAt
  function localDateTime(value: number) {
    const date = new Date(value)
    return new Date(value - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  }
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
        · <ConsultationLocation location={consultation.location} />
      </p>
      {consultation.notes && (
        <p className="m-0 whitespace-pre-wrap">{consultation.notes}</p>
      )}
      {pendingReschedule && consultation.status === "SCHEDULED" && (
        <div className="flex flex-col gap-5 rounded-xl border border-[#d8e1ef] bg-[#edf2fb] p-5">
          <p className="m-0 text-xs font-semibold text-[#294a9b]">
            Reschedule requested · Awaiting department response
          </p>
          <div className="space-y-2 text-xs leading-6">
            <p className="m-0">
              <span className="font-medium">Preferred time: </span>
              {new Date(preferredTime).toLocaleString("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p className="m-0 whitespace-pre-wrap">
              <span className="font-medium">Reason: </span>
              {pendingReschedule.summary
                .replace(
                  /^Client requested a consultation reschedule to \S+\.\s*/,
                  "",
                )
                .replace(
                  / The existing schedule remains in place until the department confirms a replacement\.$/,
                  "",
                )}
            </p>
            <p className="m-0 text-[#738096]">
              The current schedule stays in place until a replacement is
              confirmed.
            </p>
          </div>
          {workflow.permissions.manage &&
            [
              "CONSULTATION",
              "QUOTATION_PENDING",
              "CLIENT_APPROVAL",
              "REVISION_REQUESTED",
            ].includes(workflow.state) && (
              <form
                key={pendingReschedule.id}
                className="grid gap-5 border-t border-[#d8e1ef] pt-5"
                onSubmit={async (event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  const submitter = (event.nativeEvent as SubmitEvent).submitter
                  const approve =
                    !(submitter instanceof HTMLButtonElement) ||
                    submitter.value !== "decline"
                  await controls.act({
                    type: "RESPOND_CONSULTATION_RESCHEDULE",
                    consultationId: consultation.id,
                    requestEventId: pendingReschedule.id,
                    approve,
                    startsAt: approve
                      ? new Date(String(data.get("startsAt"))).toISOString()
                      : "",
                    endsAt: approve
                      ? new Date(String(data.get("endsAt"))).toISOString()
                      : "",
                    location: String(data.get("location") || ""),
                    note: String(data.get("note") || ""),
                  })
                }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <WorkflowField label="Replacement start">
                    <input
                      type="datetime-local"
                      name="startsAt"
                      required
                      defaultValue={localDateTime(
                        new Date(preferredTime).getTime(),
                      )}
                      className={workflowInput}
                    />
                  </WorkflowField>
                  <WorkflowField label="Replacement end">
                    <input
                      type="datetime-local"
                      name="endsAt"
                      required
                      defaultValue={localDateTime(
                        new Date(preferredTime).getTime() +
                          new Date(consultation.endsAt).getTime() -
                          new Date(consultation.startsAt).getTime(),
                      )}
                      className={workflowInput}
                    />
                  </WorkflowField>
                </div>
                <WorkflowField label="Meeting link or location">
                  <input
                    name="location"
                    required
                    maxLength={1000}
                    defaultValue={consultation.location}
                    className={workflowInput}
                  />
                </WorkflowField>
                <WorkflowField label="Response to client (required when declining)">
                  <textarea
                    name="note"
                    rows={2}
                    maxLength={2000}
                    className={workflowInput}
                  />
                </WorkflowField>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={controls.busy}
                    className={`${workflowButton} bg-[#203f8c] text-white hover:bg-[#172f70]`}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="submit"
                    value="decline"
                    formNoValidate
                    variant="outline"
                    disabled={controls.busy}
                    className={`${workflowButton} text-[#bc3649]`}
                  >
                    Decline
                  </Button>
                </div>
              </form>
            )}
        </div>
      )}
      {workflow.permissions.isClient &&
        !pendingReschedule &&
        consultation.status === "SCHEDULED" &&
        [
          "CONSULTATION",
          "QUOTATION_PENDING",
          "CLIENT_APPROVAL",
          "REVISION_REQUESTED",
        ].includes(workflow.state) &&
        (rescheduling ? (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              if (
                await controls.act({
                  type: "REQUEST_CONSULTATION_RESCHEDULE",
                  consultationId: consultation.id,
                  startsAt: new Date(
                    String(data.get("startsAt")),
                  ).toISOString(),
                  note: String(data.get("note")),
                })
              )
                setRescheduling(false)
            }}
          >
            <WorkflowField label="Preferred date and time">
              <input
                type="datetime-local"
                name="startsAt"
                required
                className={workflowInput}
              />
            </WorkflowField>
            <WorkflowField label="Reason for rescheduling">
              <textarea
                name="note"
                required
                maxLength={2000}
                rows={2}
                className={workflowInput}
              />
            </WorkflowField>
            <p className="m-0 text-xs">
              Your current schedule remains until the department confirms a
              replacement.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={controls.busy}
                className={`${workflowButton} bg-[#203f8c] text-white hover:bg-[#172f70]`}
              >
                Request reschedule
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={controls.busy}
                onClick={() => setRescheduling(false)}
                className={`${workflowButton} text-[#294a9b]`}
              >
                Keep schedule
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            className={workflowButton}
            disabled={controls.busy}
            onClick={() => setRescheduling(true)}
          >
            Request reschedule
          </Button>
        ))}
      {workflow.permissions.manage &&
        consultation.status === "SCHEDULED" &&
        [
          "CONSULTATION",
          "QUOTATION_PENDING",
          "CLIENT_APPROVAL",
          "REVISION_REQUESTED",
        ].includes(workflow.state) && (
          <div className="flex flex-wrap gap-2 border-t border-[#e1e6ee] pt-4">
            <Button
              className={`${workflowButton} bg-[#203f8c] text-white hover:bg-[#172f70]`}
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
              Mark as complete
            </Button>
            <Button
              variant="outline"
              className={`${workflowButton} text-[#bc3649] hover:text-[#a42f40]`}
              disabled={controls.busy}
              onClick={() =>
                void controls.act({
                  type: "CANCEL_CONSULTATION",
                  consultationId: consultation.id,
                })
              }
            >
              Cancel
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
  onPrepareQuotation,
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
      {latest && quotation.status === "REVISION_REQUESTED" && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#d8e1ef] bg-[#edf2fb] p-4">
          <p className="m-0 font-medium text-[#294a9b]">
            {workflow.permissions.manage
              ? "The client requested changes. Prepare a revised quotation for review."
              : "Your revision request is awaiting a revised quotation from the department."}
          </p>
          {workflow.permissions.manage && onPrepareQuotation && (
            <Button
              type="button"
              className={`${workflowButton} self-start bg-[#203f8c] text-white hover:bg-[#172f70]`}
              disabled={controls.busy}
              onClick={onPrepareQuotation}
            >
              Prepare revised quotation
            </Button>
          )}
        </div>
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
              className={workflowPrimaryButton}
              disabled={controls.busy}
            >
              Accept quotation
            </Button>
            <Button
              value="REVISE"
              className={cn(
                workflowButton,
                "!border-transparent !bg-[#f2b632] !text-[#3d2c08] hover:!bg-[#e0a622]",
              )}
              disabled={controls.busy}
            >
              Request revision
            </Button>
            <Button
              value="DECLINE"
              className={cn(
                workflowButton,
                "!border-transparent !bg-[#d12f2f] !text-white hover:!bg-[#b82525]",
              )}
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
            className={workflowPrimaryButton}
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
      {workflow.permissions.isClient && agreement.status === "SUBMITTED" && (
        <p
          role="status"
          className="m-0 rounded-lg bg-[#edf2fb] p-3 text-xs text-[#294a9b]"
        >
          Your signed agreement is awaiting department review.
        </p>
      )}
      {workflow.permissions.isClient &&
        writable &&
        agreement.documentFileId &&
        agreement.status === "PENDING" && (
          <form
            className="grid gap-4"
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
            <Button className={workflowPrimaryButton} disabled={controls.busy}>
              Submit signed agreement
            </Button>
          </form>
        )}
      {workflow.permissions.manage &&
        writable &&
        agreement.status === "SUBMITTED" && (
          <form
            className="grid gap-4"
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
                className={workflowPrimaryButton}
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
  const [proofDraft, setProofDraft] = useState<File | null>(null)
  const [proofSource, setProofSource] = useState<"upload" | "existing">(
    "upload",
  )
  const proofInput = useRef<HTMLInputElement>(null)
  const account = usePortalAccount()
  const hasExistingFiles = workflow.files.some(
    (file) => file.uploaderId === account.id,
  )
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
      {workflow.permissions.isClient && payment.status === "SUBMITTED" && (
        <p
          role="status"
          className="m-0 rounded-lg bg-[#edf2fb] p-3 text-xs text-[#294a9b]"
        >
          Your payment proof has been submitted and is awaiting verification.
          You can submit another if the verifier returns it.
        </p>
      )}
      {workflow.permissions.isClient &&
        writable &&
        payment.status === "PENDING" && (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const uploaded = proofDraft
                ? await controls.attach(proofDraft)
                : null
              if (proofDraft && !uploaded) return
              const submitted = await controls.act({
                type: "SUBMIT_PAYMENT",
                fileId: uploaded?.id || String(data.get("fileId")),
                reference: String(data.get("reference")),
              })
              if (submitted) setProofDraft(null)
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
              <input
                ref={proofInput}
                type="file"
                accept={attachmentAccept}
                disabled={controls.busy}
                aria-label="Attach proof of payment"
                className="hidden"
                onChange={(event) => {
                  setProofDraft(event.currentTarget.files?.[0] || null)
                  event.currentTarget.value = ""
                }}
              />
              {proofSource === "existing" ? (
                <WorkflowFileSelect workflow={workflow} required />
              ) : proofDraft ? (
                <AttachmentPreview
                  file={proofDraft}
                  disabled={controls.busy}
                  onRemove={() => setProofDraft(null)}
                />
              ) : (
                <div className="space-y-2 rounded-lg border border-dashed border-[#d8e1ef] bg-[#f6f8fc] p-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 text-xs"
                    disabled={controls.busy}
                    onClick={() => proofInput.current?.click()}
                  >
                    <FileText size={15} aria-hidden="true" />
                    Attach payment proof
                  </Button>
                  <p className="m-0 text-[11px] text-[#738096]">
                    Choose a receipt or transfer screenshot. PDF, Word, PNG,
                    JPEG, or text · Up to 5 MB.
                  </p>
                </div>
              )}
              {hasExistingFiles && !proofDraft && (
                <button
                  type="button"
                  disabled={controls.busy}
                  className="min-h-11 cursor-pointer text-left text-xs font-medium text-[#294a9b] underline-offset-2 hover:underline disabled:opacity-50"
                  onClick={() =>
                    setProofSource(
                      proofSource === "upload" ? "existing" : "upload",
                    )
                  }
                >
                  {proofSource === "upload"
                    ? "Choose an existing attachment instead"
                    : "Upload a new file instead"}
                </button>
              )}
            </WorkflowField>
            <Button
              className={workflowPrimaryButton}
              disabled={
                controls.busy || (proofSource === "upload" && !proofDraft)
              }
            >
              Submit payment proof
            </Button>
          </form>
        )}
      {workflow.permissions.verifyPayment &&
        writable &&
        payment.status === "SUBMITTED" && (
          <form
            className="grid gap-4"
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
                className={workflowPrimaryButton}
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
      <Button asChild className={workflowPrimaryButton}>
        <Link href={`/projects/${encodeURIComponent(workflow.project.id)}`}>
          View Project
        </Link>
      </Button>
    </WorkflowCard>
  )
}

export function SystemStatusUpdate({ event }: { event: WorkflowEvent }) {
  return (
    <div className="mx-auto my-4 w-full max-w-2xl overflow-x-auto text-[10px] leading-5 text-[#8791a2] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <p className="mx-auto my-0 w-max whitespace-nowrap">{event.summary}</p>
      <time
        dateTime={event.createdAt}
        className="mt-0.5 block text-center text-[9px] leading-4"
      >
        {new Date(event.createdAt).toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </time>
    </div>
  )
}

export function WorkflowEventCard({
  event,
  workflow,
  controls,
  fileClassName,
  onPrepareQuotation,
}: CardProps & { event: WorkflowEvent; fileClassName?: string }) {
  const statusUpdate = () => <SystemStatusUpdate event={event} />
  if (event.type === "APPROVAL_CONFIRMED")
    return (
      <>
        {statusUpdate()}
        <ApprovalConfirmationCard workflow={workflow} />
      </>
    )
  const latest =
    !event.entityId ||
    workflow.events.filter((item) => item.entityId === event.entityId).at(-1)
      ?.id === event.id
  if (!latest) return statusUpdate()
  const requirement = workflow.requirements.find(
    (item) => item.id === event.entityId,
  )
  if (requirement)
    return (
      <>
        {statusUpdate()}
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
        {statusUpdate()}
        <FileSubmissionCard
          file={file}
          requestId={workflow.request.id}
          className={fileClassName}
        />
      </>
    )
  const consultation = workflow.consultations.find(
    (item) => item.id === event.entityId,
  )
  if (consultation)
    return (
      <>
        {statusUpdate()}
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
        {statusUpdate()}
        <QuotationProposalCard
          onPrepareQuotation={onPrepareQuotation}
          quotation={quotation}
          workflow={workflow}
          controls={controls}
        />
      </>
    )
  if (workflow.agreement?.id === event.entityId)
    return (
      <>
        {statusUpdate()}
        <AgreementCard workflow={workflow} controls={controls} />
      </>
    )
  if (workflow.payment?.id === event.entityId)
    return (
      <>
        {statusUpdate()}
        <PaymentVerificationCard workflow={workflow} controls={controls} />
      </>
    )
  if (workflow.project?.id === event.entityId)
    return (
      <>
        {statusUpdate()}
        <ProjectActivationCard workflow={workflow} />
      </>
    )
  return statusUpdate()
}
