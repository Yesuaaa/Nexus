"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { Workflow, WorkflowAction } from "../model/workflow"
import { QuotationProposalCard } from "./workflow-cards"
import {
  WorkflowBadge,
  WorkflowField,
  workflowButton,
  workflowInput,
  workflowMoney,
} from "./workflow-primitives"

export function WorkflowDisclosure({
  title,
  children,
  open = false,
}: {
  title: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details
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
}: {
  controls: WorkflowControls
  action: (data: FormData) => WorkflowAction
  children?: ReactNode
  label: string
  readOnly?: boolean
}) {
  if (readOnly) return <div>{children}</div>
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        if (await controls.act(action(new FormData(form)))) form.reset()
      }}
    >
      {children}
      <Button className={workflowButton} disabled={controls.busy}>
        {controls.busy ? "Saving…" : label}
      </Button>
    </form>
  )
}

function QuotationForm({
  controls,
  workflow,
}: {
  controls: WorkflowControls
  workflow: Workflow
}) {
  const [rows, setRows] = useState([{ key: 0 }])
  const [nextKey, setNextKey] = useState(1)
  const latest = workflow.quotations.at(-1)
  return (
    <ActionForm
      controls={controls}
      label={latest ? "Send revised quotation" : "Send quotation"}
      action={(data) => ({
        type: "CREATE_QUOTATION",
        scope: String(data.get("scope")),
        deliverables: String(data.get("deliverables"))
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        lineItems: rows.map(({ key }) => ({
          description: String(data.get(`description-${key}`)),
          quantity: Number(data.get(`quantity-${key}`)),
          unitPrice: String(data.get(`price-${key}`)),
        })),
        currency: String(data.get("currency")),
        timeline: String(data.get("timeline")),
        paymentTerms: String(data.get("paymentTerms")),
        paymentDue: String(data.get("paymentDue")),
        validUntil: new Date(String(data.get("validUntil"))).toISOString(),
      })}
    >
      <WorkflowField label="Service scope">
        <textarea
          name="scope"
          required
          rows={3}
          maxLength={6000}
          defaultValue={latest?.scope || workflow.request.goals}
          className={workflowInput}
        />
      </WorkflowField>
      <WorkflowField label="Deliverables (one per line)">
        <textarea
          name="deliverables"
          required
          rows={3}
          maxLength={8000}
          defaultValue={latest?.deliverables.join("\n") || ""}
          className={workflowInput}
        />
      </WorkflowField>
      <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
        <legend className="mb-2 text-[11px] font-medium">
          Pricing breakdown
        </legend>
        {rows.map(({ key }, index) => (
          <div
            key={key}
            className="space-y-2 rounded-lg border border-[#e1e6ee] p-2"
          >
            <WorkflowField label={`Item ${index + 1}`}>
              <input
                name={`description-${key}`}
                required
                maxLength={300}
                className={workflowInput}
              />
            </WorkflowField>
            <div className="grid grid-cols-2 gap-2">
              <WorkflowField label="Quantity">
                <input
                  name={`quantity-${key}`}
                  type="number"
                  required
                  min="1"
                  max="10000"
                  step="1"
                  defaultValue="1"
                  className={workflowInput}
                />
              </WorkflowField>
              <WorkflowField label="Unit price">
                <input
                  name={`price-${key}`}
                  type="number"
                  required
                  min="0"
                  max="999999999"
                  step="0.01"
                  className={workflowInput}
                />
              </WorkflowField>
            </div>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="outline"
                aria-label={`Remove item ${index + 1}`}
                className="h-7 text-[10px]"
                onClick={() =>
                  setRows((items) => items.filter((item) => item.key !== key))
                }
              >
                <Trash2 size={12} aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className={workflowButton}
          disabled={rows.length >= 30}
          onClick={() => {
            setRows((items) => [...items, { key: nextKey }])
            setNextKey((value) => value + 1)
          }}
        >
          <Plus size={12} aria-hidden="true" />
          Add item
        </Button>
      </fieldset>
      <WorkflowField label="Currency">
        <select
          name="currency"
          defaultValue={latest?.currency || "PHP"}
          className={workflowInput}
        >
          <option value="PHP">PHP</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </WorkflowField>
      <WorkflowField label="Estimated timeline">
        <textarea
          name="timeline"
          required
          maxLength={1000}
          rows={2}
          defaultValue={latest?.timeline || workflow.request.expectedTimeline}
          className={workflowInput}
        />
      </WorkflowField>
      <WorkflowField label="Payment terms">
        <textarea
          name="paymentTerms"
          required
          maxLength={2000}
          rows={2}
          defaultValue={latest?.paymentTerms || ""}
          className={workflowInput}
        />
      </WorkflowField>
      <WorkflowField label="Amount due before commencement">
        <input
          name="paymentDue"
          required
          type="number"
          min="0"
          max="999999999"
          step="0.01"
          defaultValue={latest?.paymentDue}
          className={workflowInput}
        />
      </WorkflowField>
      <WorkflowField label="Valid until">
        <input
          name="validUntil"
          required
          type="datetime-local"
          className={workflowInput}
        />
      </WorkflowField>
      {workflow.quotationApprovalRequired && (
        <p className="m-0 text-[11px]">
          The assigned quotation approver must authorize this version before the
          client can accept it.
        </p>
      )}
    </ActionForm>
  )
}

function InternalWorkspace({
  workflow,
  controls,
}: {
  workflow: Workflow
  controls: WorkflowControls
}) {
  const internal = workflow.internal
  if (!workflow.permissions.manage || !internal) return null
  const mutable = !["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(
    workflow.state,
  )
  return (
    <div className="mt-3 rounded-xl border border-[#d8e1ef] bg-[#f6f8fc] px-3">
      <p className="mb-0 text-[10px] font-semibold tracking-wide text-[#52627a] uppercase">
        Internal · Department head only
      </p>
      {mutable && (
        <WorkflowDisclosure title="Approver assignments">
          <ActionForm
            controls={controls}
            label="Save assignments"
            action={(data) => ({
              type: "ASSIGN_APPROVERS",
              quotationApproverId:
                String(data.get("quotationApproverId") || "") || null,
              paymentVerifierId:
                String(data.get("paymentVerifierId") || "") || null,
            })}
          >
            <WorkflowField label="Quotation approver">
              <select
                name="quotationApproverId"
                defaultValue={internal.quotationApproverId || ""}
                className={workflowInput}
              >
                <option value="">Select an authorized approver</option>
                {internal.approvers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName || person.id}
                  </option>
                ))}
              </select>
            </WorkflowField>
            <WorkflowField label="Payment verifier">
              <select
                name="paymentVerifierId"
                defaultValue={internal.paymentVerifierId || ""}
                className={workflowInput}
              >
                <option value="">Select an authorized verifier</option>
                {internal.approvers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName || person.id}
                  </option>
                ))}
              </select>
            </WorkflowField>
          </ActionForm>
          <p className="m-0 text-[10px]">
            Assignments grant access only to the relevant approval records for
            this request.
          </p>
        </WorkflowDisclosure>
      )}
      {workflow.approval && (
        <WorkflowDisclosure title="Staffing and workload">
          <p className="m-0 text-[11px]">
            Review department assignments, specialties, availability, and active
            project counts. Personnel selection requires your approval.
          </p>
          <ActionForm
            controls={controls}
            label="Approve staffing"
            readOnly={!mutable || workflow.state === "ON_HOLD"}
            action={(data) => ({
              type: "STAFF_PROJECT",
              employeeIds: data.getAll("employeeIds").map(String),
            })}
          >
            <fieldset className="m-0 space-y-2 border-0 p-0">
              <legend className="sr-only">Department employees</legend>
              {internal.staff.length ? (
                internal.staff.map((person) => (
                  <label
                    key={person.id}
                    className="flex items-start gap-2 rounded-lg border border-[#e1e6ee] bg-background p-2"
                  >
                    <input
                      type="checkbox"
                      name="employeeIds"
                      value={person.id}
                      defaultChecked={person.assigned}
                      disabled={
                        person.status !== "ACTIVE" ||
                        !mutable ||
                        workflow.state === "ON_HOLD"
                      }
                      className="mt-1 accent-[#203f8c]"
                    />
                    <span className="min-w-0">
                      <strong className="block text-[11px] text-[#182235]">
                        {person.fullName}
                      </strong>
                      <span className="block text-[10px]">
                        {person.position || "Staff"} ·{" "}
                        {person.status.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="block text-[10px]">
                        {person.activeProjectCount} active{" "}
                        {person.activeProjectCount === 1
                          ? "project"
                          : "projects"}
                      </span>
                      {!!person.skills.length && (
                        <span className="block text-[10px]">
                          {person.skills.join(", ")}
                        </span>
                      )}
                    </span>
                  </label>
                ))
              ) : (
                <p className="m-0 text-[11px]">
                  No eligible employees are assigned to this department.
                </p>
              )}
            </fieldset>
          </ActionForm>
        </WorkflowDisclosure>
      )}
      <WorkflowDisclosure title="Internal notes">
        {mutable && (
          <ActionForm
            controls={controls}
            label="Add internal note"
            action={(data) => ({
              type: "INTERNAL_NOTE",
              note: String(data.get("note")),
            })}
          >
            <WorkflowField label="Private note">
              <textarea
                name="note"
                required
                rows={3}
                maxLength={2000}
                className={workflowInput}
              />
            </WorkflowField>
          </ActionForm>
        )}
        <div className="space-y-3">
          {internal.events.slice(-10).map((event) => (
            <div
              key={event.id}
              className="rounded-lg bg-background p-2 text-[11px]"
            >
              <p className="m-0 whitespace-pre-wrap">{event.summary}</p>
              <p className="mt-1 mb-0 text-[9px] text-[#8791a2]">
                {event.actor?.fullName || "System"} ·{" "}
                {new Date(event.createdAt).toLocaleString("en-PH")}
              </p>
            </div>
          ))}
        </div>
      </WorkflowDisclosure>
    </div>
  )
}

export function WorkflowContextPanel({
  workflow,
  controls,
}: {
  workflow: Workflow
  controls: WorkflowControls
}) {
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
  const latest = workflow.quotations.at(-1)
  const beforeApproval = [
    "CONSULTATION",
    "QUOTATION_PENDING",
    "CLIENT_APPROVAL",
    "REVISION_REQUESTED",
  ].includes(workflow.state)
  const canQuote =
    workflow.permissions.manage &&
    ["QUOTATION_PENDING", "REVISION_REQUESTED", "CLIENT_APPROVAL"].includes(
      workflow.state,
    )
  const terminal = ["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(
    workflow.state,
  )
  return (
    <aside
      aria-label="Request context"
      className="w-[300px] shrink-0 overflow-y-auto border-l border-[#e8ebef] px-4 py-1 max-[1199px]:w-[270px] max-[1023px]:w-full max-[1023px]:shrink max-[1023px]:overflow-visible max-[1023px]:border-b max-[1023px]:border-l-0"
    >
      <details ref={detailsRef} className="group/context" open>
        <summary className="hidden cursor-pointer list-none items-center justify-between py-3 text-xs font-semibold max-[1023px]:flex [&::-webkit-details-marker]:hidden">
          Request details and actions
          <ChevronDown
            size={14}
            className="group-open/context:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="max-[1023px]:max-h-[50dvh] max-[1023px]:overflow-y-auto">
          <WorkflowDisclosure title="Service details" open>
            <dl className="m-0 space-y-3">
              {[
                ["Service", workflow.request.serviceName],
                ["Package", workflow.request.packageName || "Standard service"],
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
          </WorkflowDisclosure>
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
                  <WorkflowBadge value={item.status} />
                </li>
              ))}
            </ul>
            {!workflow.requirements.length && (
              <p className="m-0 text-[11px]">
                No additional requirements requested.
              </p>
            )}
          </WorkflowDisclosure>
          {latest && (
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
          {workflow.approval && (
            <WorkflowDisclosure title="Commencement checklist" open>
              <ul className="m-0 list-none space-y-2 p-0">
                <li className="flex justify-between gap-2 text-[11px]">
                  <span>Client approval</span>
                  <WorkflowBadge value="COMPLETED" />
                </li>
                {workflow.agreement && (
                  <li className="flex justify-between gap-2 text-[11px]">
                    <a
                      href={`#workflow-${workflow.agreement.id}`}
                      className="text-[#203f8c]"
                    >
                      Agreement{workflow.agreement.mandatory ? " *" : ""}
                    </a>
                    <WorkflowBadge value={workflow.agreement.status} />
                  </li>
                )}
                {workflow.payment && (
                  <li className="flex justify-between gap-2 text-[11px]">
                    <a
                      href={`#workflow-${workflow.payment.id}`}
                      className="text-[#203f8c]"
                    >
                      Payment{workflow.payment.mandatory ? " *" : ""}
                    </a>
                    <WorkflowBadge value={workflow.payment.status} />
                  </li>
                )}
              </ul>
            </WorkflowDisclosure>
          )}
          {workflow.permissions.manage &&
            (beforeApproval ||
              ["AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION"].includes(
                workflow.state,
              )) && (
              <>
                <WorkflowDisclosure title="Request information">
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
                  <WorkflowDisclosure title="Schedule consultation">
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
          {workflow.permissions.manage &&
            workflow.state === "READY_FOR_ACTIVATION" && (
              <div className="py-4">
                <Button
                  disabled={controls.busy}
                  className={`${workflowButton} w-full`}
                  onClick={() =>
                    void controls.act({ type: "ACTIVATE_PROJECT" })
                  }
                >
                  Activate project
                </Button>
                <p className="mt-2 mb-0 text-[10px] leading-5 text-[#8791a2]">
                  Activation validates mandatory documents, payment, and
                  approved staffing.
                </p>
              </div>
            )}
          <InternalWorkspace workflow={workflow} controls={controls} />
          {(workflow.permissions.manage || workflow.permissions.isClient) &&
            !terminal &&
            workflow.state !== "PENDING_REVIEW" && (
              <WorkflowDisclosure title="Workflow controls">
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
                    I confirm this cancellation will end the request workflow.
                  </label>
                </ActionForm>
              </WorkflowDisclosure>
            )}
        </div>
      </details>
    </aside>
  )
}
