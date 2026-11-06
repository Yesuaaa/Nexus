"use client"

import { Form } from "@/components/ui/form"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import { useEffect, useRef, type ReactNode } from "react"
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  ConsultationLocation,
  getConsultationMeetingUrl,
} from "./workflow-cards"
import { cn } from "@/lib/utils"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { Workflow, WorkflowAction } from "../model/workflow"
import {
  WorkflowBadge,
  WorkflowField,
  workflowButton,
  workflowInput,
} from "./workflow-primitives"

export function WorkflowDisclosure({
  id,
  title,
  children,
  open = false,
}: {
  id?: string
  title: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details
      id={id}
      open={open}
      className="group border-b border-[#e8ebef] py-3 last:border-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-[#182235] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 space-y-3 text-xs leading-5 text-[#52627a]">
        {children}
      </div>
    </details>
  )
}

function ActionForm({
  controls,
  action,
  children,
  label,
  readOnly = false,
  onComplete,
  onCancel,
  inline = false,
  destructive = false,
}: {
  controls: WorkflowControls
  action: (data: FormData) => WorkflowAction
  children?: ReactNode
  label: string
  readOnly?: boolean
  onComplete?: () => void
  onCancel?: () => void
  inline?: boolean
  destructive?: boolean
}) {
  if (readOnly) return <div>{children}</div>
  const submitClass = cn(
    workflowButton,
    destructive &&
      "border border-[#b42318] bg-background text-[#b42318] hover:bg-[#fef3f2] hover:text-[#912018] disabled:opacity-50",
  )
  return (
    <Form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        if (await controls.act(action(new FormData(form)))) {
          form.reset()
          onComplete?.()
        }
      }}
    >
      {children}
      {inline ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8ebef] pt-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[92px] text-[11px]"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button className={submitClass} disabled={controls.busy}>
            {controls.busy ? "Saving…" : label}
          </Button>
        </div>
      ) : (
        <Button className={submitClass} disabled={controls.busy}>
          {controls.busy ? "Saving…" : label}
        </Button>
      )}
    </Form>
  )
}

function InternalWorkspace({
  workflow,
  onManageStaff,
}: {
  workflow: Workflow
  onManageStaff?: () => void
}) {
  if (!workflow.permissions.manage || !workflow.internal || !workflow.approval)
    return null
  const assigned = workflow.internal.staff.filter((person) => person.assigned)
  const mutable = [
    "AGREEMENT_PAYMENT_PENDING",
    "READY_FOR_ACTIVATION",
    "ACTIVE_PROJECT",
  ].includes(workflow.state)
  return (
    <WorkflowDisclosure title="Assigned staff" open>
      {assigned.length ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {assigned.map((person) => (
            <li
              key={person.id}
              className="rounded-lg border border-[#e1e6ee] bg-white px-3 py-2"
            >
              <p className="m-0 text-[11px] font-semibold text-[#182235]">
                {person.fullName}
              </p>
              <p className="mt-1 mb-0 text-[10px] text-[#738096]">
                {person.position || "Staff"}
                {person.status !== "ACTIVE" &&
                  ` · ${person.status.toLowerCase().replaceAll("_", " ")}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[11px] text-[#738096]">No staff assigned yet.</p>
      )}
      {onManageStaff && (
        <Button
          type="button"
          variant="outline"
          disabled={!mutable}
          onClick={onManageStaff}
          className={`${workflowButton} w-full text-[#203f8c]`}
        >
          {assigned.length ? "Manage staff" : "Assign staff"}
        </Button>
      )}
    </WorkflowDisclosure>
  )
}
export function WorkflowContextPanel({
  workflow,
  controls,
  id,
  hidden = false,
  onViewEvent,
  conversationOverview,
  hasSelectedBooking,
  onDraft,
  onProjectSetup,
}: {
  workflow: Workflow | null
  controls: WorkflowControls
  id?: string
  hidden?: boolean
  onViewEvent?: (entityId: string) => void
  conversationOverview?: ReactNode
  hasSelectedBooking: boolean
  onDraft?: (action: "approver-assignments" | "internal-note") => void
  onProjectSetup?: (mode: "activation" | "staffing") => void
}) {
  const { formatDate, formatTime } = useDatePreferences()

  const detailsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const screen = window.matchMedia("(min-width: 1024px)")
    const update = () => {
      if (detailsRef.current) detailsRef.current.open = screen.matches
    }
    update()
    screen.addEventListener("change", update)
    return () => screen.removeEventListener("change", update)
  }, [])
  const terminal = Boolean(
    workflow &&
    ["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(workflow.state),
  )
  const sectionId = (name: string) => `${id ?? "request-context"}-${name}`
  const assignedStaff =
    workflow?.internal?.staff.filter((person) => person.assigned) || []
  const staffingApproved =
    assignedStaff.length > 0 &&
    assignedStaff.every((person) => person.status === "ACTIVE")
  return (
    <aside
      onClickCapture={(event) => {
        if (!onViewEvent || !(event.target instanceof Element)) return
        const link = event.target.closest('a[href^="#workflow-"]')
        const href = link?.getAttribute("href")
        if (!href) return
        event.preventDefault()
        onViewEvent(href.slice("#workflow-".length))
      }}
      id={id}
      aria-hidden={hidden}
      inert={hidden}
      aria-label="Request context"
      className={cn(
        "m-3 shrink-0 overflow-x-hidden overflow-y-auto rounded-[13px] border border-[#dedede] bg-background px-4 py-1 shadow-[0_2px_8px_rgb(20_30_50_/_11%)] transition-[width,max-height,opacity,transform,padding,margin,border-color] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none max-[1023px]:w-auto max-[1023px]:shrink max-[1023px]:overflow-hidden",
        hidden
          ? "m-0 w-0 min-w-0 translate-x-2 border-0 px-0 opacity-0 pointer-events-none max-[1199px]:w-0 max-[1023px]:max-h-0 max-[1023px]:translate-x-0 max-[1023px]:translate-y-2 max-[1023px]:px-4 max-[1023px]:py-0 max-[1023px]:opacity-0"
          : "w-[300px] max-[1199px]:w-[270px] max-[1023px]:max-h-[calc(50dvh+64px)] max-[1023px]:translate-x-0 max-[1023px]:translate-y-0 max-[1023px]:opacity-100",
      )}
    >
      <details
        ref={detailsRef}
        className="group/context min-w-[238px] min-[1200px]:min-w-[268px] max-[1023px]:min-w-0"
        open
      >
        <summary className="hidden cursor-pointer list-none items-center justify-between py-3 text-xs font-semibold max-[1023px]:flex [&::-webkit-details-marker]:hidden">
          Request details and actions
          <ChevronDown
            size={14}
            className="group-open/context:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="max-[1023px]:max-h-[50dvh] max-[1023px]:overflow-y-auto">
          {conversationOverview}
          {hasSelectedBooking && (
            <WorkflowDisclosure title="Service details" open>
              {workflow ? (
                <dl className="m-0 space-y-3">
                  {[
                    ["Service", workflow.request.serviceName],
                    [
                      "Package",
                      workflow.request.packageName || "Standard service",
                    ],
                    [
                      "Request reference",
                      workflow.request.referenceNumber || workflow.request.id,
                    ],
                    ["Project goals", workflow.request.goals || "Not provided"],
                    [
                      "Submitted requirements",
                      workflow.request.requirements || "Not provided",
                    ],
                    [
                      "Expected timeline",
                      workflow.request.expectedTimeline || "Not specified",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] text-[#8791a2]">{label}</dt>
                      <dd className="mt-1 ml-0 text-[11px] whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p role="status" className="m-0 text-[11px] text-[#52627a]">
                  {controls.error || "Loading service details…"}
                </p>
              )}
            </WorkflowDisclosure>
          )}
          {workflow && (
            <>
              <WorkflowDisclosure
                title={`Requirements · ${workflow.requirements.filter((item) => item.status === "COMPLETED").length}/${workflow.requirements.length}`}
                open
              >
                <ul className="m-0 list-none space-y-2 p-0">
                  {workflow.requirements.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <a
                        href={`#workflow-${item.id}`}
                        className="text-[11px] text-[#203f8c] underline-offset-2 hover:underline"
                      >
                        {item.title}
                        {item.mandatory ? " *" : ""}
                      </a>
                      <WorkflowBadge value={item.status} checklist />
                    </li>
                  ))}
                </ul>
                {!workflow.requirements.length && (
                  <p className="m-0 text-[11px]">
                    No additional requirements requested.
                  </p>
                )}
              </WorkflowDisclosure>
              {/* Latest quotation is available in the conversation timeline.
            <WorkflowDisclosure title="Latest quotation">
              <p className="m-0 text-sm font-semibold text-[#182235]">
                {workflowMoney(latest.total, latest.currency)}
              </p>
              <WorkflowBadge value={latest.status} />
              <p className="m-0 text-[11px]">
                Version {latest.version} · {latest.timeline}
              </p>
              {latest.status === "PENDING_INTERNAL" ? (
                <QuotationProposalCard
                  quotation={latest}
                  workflow={workflow}
                  controls={controls}
                />
              ) : (
                <a
                  href={`#workflow-${latest.id}`}
                  className="text-[11px] text-[#203f8c] hover:underline"
                >
                  View quotation and decision
                </a>
              )}
            </WorkflowDisclosure>
          )}
          */}
              {workflow.approval && (
                <WorkflowDisclosure
                  id={sectionId("commencement")}
                  title="Commencement checklist"
                  open
                >
                  <ul className="m-0 list-none space-y-2 p-0">
                    <li className="flex justify-between gap-2 text-[11px]">
                      <span>Client approval</span>
                      <WorkflowBadge value="COMPLETED" checklist />
                    </li>
                    {workflow.payment && (
                      <li className="flex justify-between gap-2 text-[11px]">
                        <a
                          href={`#workflow-${workflow.payment.id}`}
                          className="text-[#203f8c]"
                        >
                          Payment{workflow.payment.mandatory ? " *" : ""}
                        </a>
                        <WorkflowBadge
                          value={
                            !workflow.payment.mandatory &&
                            workflow.payment.amount === "0.00"
                              ? "NOT_REQUIRED"
                              : workflow.payment.status
                          }
                          checklist
                        />
                      </li>
                    )}
                    {workflow.requirements
                      .filter((item) => item.mandatory)
                      .map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 border-t border-[#e8ebef] pt-2 text-[11px]"
                        >
                          <a
                            href={`#workflow-${item.id}`}
                            className="min-w-0 break-words text-[#203f8c]"
                          >
                            {item.title} (required)
                          </a>
                          <WorkflowBadge value={item.status} checklist />
                        </li>
                      ))}
                  </ul>
                </WorkflowDisclosure>
              )}
              {workflow.permissions.manage &&
                workflow.state === "READY_FOR_ACTIVATION" && (
                  <WorkflowDisclosure
                    id={sectionId("activation")}
                    title="Project activation"
                    open
                  >
                    <p className="m-0 text-xs text-[#52627a]">
                      {staffingApproved
                        ? "Staffing is approved. Review and activate the project to open its workspace."
                        : "Assign your project team and approve staffing in project setup before activating."}
                    </p>
                    <Button
                      type="button"
                      disabled={controls.busy || !onProjectSetup}
                      className={`${workflowButton} w-full bg-[#203f8c] text-white hover:bg-[#172f70]`}
                      onClick={() => onProjectSetup?.("activation")}
                    >
                      Review and activate
                    </Button>
                  </WorkflowDisclosure>
                )}
              {(workflow.permissions.manage || workflow.permissions.isClient) &&
                workflow.consultations.some(
                  (item) => item.status === "SCHEDULED",
                ) && (
                  <WorkflowDisclosure
                    id={sectionId("scheduled-consultation")}
                    title="Scheduled consultation"
                  >
                    {workflow.consultations
                      .filter((item) => item.status === "SCHEDULED")
                      .map((consultation) => {
                        const startsAt = new Date(consultation.startsAt)
                        const endsAt = new Date(consultation.endsAt)
                        const meetingUrl = getConsultationMeetingUrl(
                          consultation.location,
                        )
                        return (
                          <div
                            key={consultation.id}
                            className="overflow-hidden rounded-xl border border-[#1b367a] bg-[linear-gradient(145deg,#2b5bbb,#203f8c)] text-white shadow-[0_8px_20px_rgb(32_63_140_/_20%)]"
                          >
                            <div className="flex items-start justify-between gap-3 border-b border-white/15 px-3.5 py-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white shadow-[0_4px_10px_rgb(12_35_93_/_20%)]">
                                  <CalendarDays size={15} aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <p className="m-0 truncate text-[11px] font-semibold text-white">
                                    Consultation appointment
                                  </p>
                                  <p className="m-0 text-[10px] text-blue-100">
                                    Confirmed schedule
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full border border-white/20 bg-white/15 px-2 py-1 text-[9px] font-semibold tracking-[0.04em] text-white uppercase">
                                Scheduled
                              </span>
                            </div>
                            <div className="space-y-3 px-3.5 py-3 text-[11px] text-blue-50">
                              <div className="flex items-start gap-2.5">
                                <CalendarDays
                                  size={14}
                                  aria-hidden="true"
                                  className="mt-0.5 shrink-0 text-blue-100"
                                />
                                <div>
                                  <p className="m-0 font-medium text-white">
                                    {formatDate(startsAt)}
                                  </p>
                                  <p className="m-0 flex items-center gap-1 text-[10px] text-blue-100">
                                    <Clock3 size={11} aria-hidden="true" />
                                    {formatTime(startsAt)} –{" "}
                                    {formatTime(endsAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <MapPin
                                  size={14}
                                  aria-hidden="true"
                                  className="mt-0.5 shrink-0 text-blue-100"
                                />
                                <div className="min-w-0 break-words">
                                  <p className="m-0 text-[10px] text-blue-100">
                                    Location
                                  </p>
                                  <ConsultationLocation
                                    location={consultation.location}
                                    className="text-white"
                                    showJoinButton={false}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {meetingUrl && (
                                  <a
                                    href={meetingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Join consultation"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white p-0 text-[#203f8c] transition-colors hover:bg-blue-50"
                                  >
                                    <Video size={12} aria-hidden="true" />
                                    <HoverTooltip>
                                      Join consultation
                                    </HoverTooltip>
                                  </a>
                                )}
                                <a
                                  href={`#workflow-${consultation.id}`}
                                  className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/35 bg-white/10 px-2.5 py-2 text-center text-[9px] leading-4 font-semibold text-white transition-colors hover:bg-white/20"
                                >
                                  View details and reschedule
                                  <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </WorkflowDisclosure>
                )}
              {/* Workflow action forms are opened from the + menu.
          {workflow.permissions.manage &&
            (beforeApproval ||
              ["AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION"].includes(
                workflow.state,
              )) && (
              <>
                <WorkflowDisclosure
                  id={sectionId("request-information")}
                  title="Request information"
                >
                  <ActionForm
                    controls={controls}
                    label="Request requirement"
                    action={(data) => ({
                      type: "REQUEST_REQUIREMENT",
                      title: String(data.get("title")),
                      details: String(data.get("details") || ""),
                      mandatory: data.get("mandatory") === "on",
                    })}
                  >
                    <WorkflowField label="Requirement title">
                      <input
                        name="title"
                        required
                        maxLength={200}
                        className={workflowInput}
                      />
                    </WorkflowField>
                    <WorkflowField label="Instructions">
                      <textarea
                        name="details"
                        rows={3}
                        maxLength={4000}
                        className={workflowInput}
                      />
                    </WorkflowField>
                    <label className="flex items-center gap-2 text-[11px]">
                      <input
                        name="mandatory"
                        type="checkbox"
                        defaultChecked
                        className="accent-[#203f8c]"
                      />
                      Required before activation
                    </label>
                  </ActionForm>
                </WorkflowDisclosure>
                {workflow.state === "CONSULTATION" && (
                  <WorkflowDisclosure
                    id={sectionId("schedule-consultation")}
                    title="Schedule consultation"
                  >
                    <ActionForm
                      controls={controls}
                      label="Schedule consultation"
                      action={(data) => ({
                        type: "SCHEDULE_CONSULTATION",
                        startsAt: new Date(
                          String(data.get("startsAt")),
                        ).toISOString(),
                        endsAt: new Date(
                          String(data.get("endsAt")),
                        ).toISOString(),
                        location: String(data.get("location")),
                        notes: String(data.get("notes") || ""),
                      })}
                    >
                      <WorkflowField label="Starts">
                        <input
                          name="startsAt"
                          type="datetime-local"
                          required
                          className={workflowInput}
                        />
                      </WorkflowField>
                      <WorkflowField label="Ends">
                        <input
                          name="endsAt"
                          type="datetime-local"
                          required
                          className={workflowInput}
                        />
                      </WorkflowField>
                      <WorkflowField label="Location or meeting link">
                        <input
                          name="location"
                          required
                          maxLength={1000}
                          className={workflowInput}
                        />
                      </WorkflowField>
                      <WorkflowField label="Consultation notes">
                        <textarea
                          name="notes"
                          maxLength={2000}
                          rows={2}
                          className={workflowInput}
                        />
                      </WorkflowField>
                    </ActionForm>
                  </WorkflowDisclosure>
                )}
                {workflow.state === "CONSULTATION" && (
                  <div className="py-3">
                    <Button
                      disabled={controls.busy}
                      className={`${workflowButton} w-full`}
                      onClick={() =>
                        void controls.act({ type: "PREPARE_QUOTATION" })
                      }
                    >
                      Continue to quotation
                    </Button>
                    <p className="mt-2 mb-0 text-[10px] leading-5 text-[#8791a2]">
                      {workflow.consultationRequired
                        ? "Complete the required consultation and requirements first."
                        : "Review requirements before preparing the proposal."}
                    </p>
                  </div>
                )}
              </>
            )}
          */}
              {/* Quotation forms are opened from the + menu.
          {canQuote && (
            <WorkflowDisclosure title="Create quotation">
              <QuotationForm workflow={workflow} controls={controls} />
              {workflow.request.pricingModel === "FIXED" && (
                <div className="border-t border-[#e1e6ee] pt-3">
                  <p className="mt-0 text-[11px]">
                    Use the fixed package price to prepare the quotation for
                    formal client approval.
                  </p>
                  <Button
                    variant="outline"
                    className={workflowButton}
                    disabled={controls.busy}
                    onClick={() =>
                      void controls.act({ type: "FIXED_QUOTATION" })
                    }
                  >
                    Use fixed package price
                  </Button>
                </div>
              )}
            </WorkflowDisclosure>
          )}
          */}
              <InternalWorkspace
                workflow={workflow}
                onManageStaff={
                  onProjectSetup ? () => onProjectSetup("staffing") : undefined
                }
              />
              {workflow.permissions.manage &&
                workflow.internal &&
                !terminal &&
                onDraft && (
                  <WorkflowDisclosure title="Internal tools">
                    <p className="m-0 text-[11px]">
                      Manage review assignments and private notes for this
                      booking.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={workflowButton}
                        disabled={controls.busy}
                        onClick={() => onDraft("approver-assignments")}
                      >
                        Approver assignments
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={workflowButton}
                        disabled={controls.busy}
                        onClick={() => onDraft("internal-note")}
                      >
                        Internal notes
                      </Button>
                    </div>
                  </WorkflowDisclosure>
                )}
              {(workflow.permissions.manage || workflow.permissions.isClient) &&
                !terminal &&
                workflow.state !== "PENDING_REVIEW" && (
                  <WorkflowDisclosure
                    id={sectionId("workflow-controls")}
                    title="Workflow controls"
                  >
                    {workflow.permissions.manage &&
                      (workflow.state === "ON_HOLD" ? (
                        <ActionForm
                          controls={controls}
                          label="Resume workflow"
                          action={(data) => ({
                            type: "RESUME",
                            note: String(data.get("note")),
                          })}
                        >
                          <WorkflowField label="Resume note">
                            <input
                              name="note"
                              required
                              maxLength={2000}
                              className={workflowInput}
                            />
                          </WorkflowField>
                        </ActionForm>
                      ) : (
                        <ActionForm
                          controls={controls}
                          label="Put on hold"
                          action={(data) => ({
                            type: "HOLD",
                            note: String(data.get("note")),
                          })}
                        >
                          <WorkflowField label="Reason for hold">
                            <input
                              name="note"
                              required
                              maxLength={2000}
                              className={workflowInput}
                            />
                          </WorkflowField>
                        </ActionForm>
                      ))}
                    <ActionForm
                      controls={controls}
                      label="Cancel request"
                      destructive
                      action={(data) => ({
                        type: "CANCEL",
                        note: String(data.get("note")),
                      })}
                    >
                      <WorkflowField label="Cancellation reason">
                        <textarea
                          name="note"
                          required
                          maxLength={2000}
                          rows={2}
                          className={workflowInput}
                        />
                      </WorkflowField>
                      <label className="flex items-start gap-2 text-[10px]">
                        <input
                          type="checkbox"
                          required
                          className="mt-1 accent-[#203f8c]"
                        />
                        I confirm this cancellation will end the request
                        workflow.
                      </label>
                    </ActionForm>
                  </WorkflowDisclosure>
                )}
            </>
          )}
        </div>
      </details>
    </aside>
  )
}
