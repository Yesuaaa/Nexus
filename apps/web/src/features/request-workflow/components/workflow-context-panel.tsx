"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  CalendarDays,
  Check,
  Circle,
  LoaderCircle,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin,
  Plus,
  Trash2,
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
  workflowMoney,
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
    <form
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
    </form>
  )
}

export function QuotationForm({
  controls,
  workflow,
  onComplete,
  onCancel,
  inline = false,
}: {
  controls: WorkflowControls
  workflow: Workflow
  onComplete?: () => void
  onCancel?: () => void
  inline?: boolean
}) {
  const latest = workflow.quotations.at(-1)
  const [rows, setRows] = useState(() =>
    latest?.lineItems.length
      ? latest.lineItems.map((item, key) => ({ key, ...item }))
      : [{ key: 0, description: "", quantity: 1, unitPrice: "" }],
  )
  const [nextKey, setNextKey] = useState(rows.length)
  const [step, setStep] = useState(0)
  const [review, setReview] = useState<FormData | null>(null)
  const steps = ["Scope", "Pricing", "Terms", "Review"]
  function validate(form: HTMLFormElement, index: number) {
    const data = new FormData(form)
    const section = form.querySelector(`[data-quotation-step="${index}"]`)
    for (const input of section?.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select") ?? []) {
      input.setCustomValidity(
        input.required && !input.value.trim() ? "Complete this field." : "",
      )
      if (input.name === "deliverables" && input.value.trim()) {
        const items = input.value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
        if (items.length > 30 || items.some((item) => item.length > 300))
          input.setCustomValidity(
            "Provide up to 30 deliverables, each at most 300 characters.",
          )
      }
      if (input.name === "validUntil" && input.value) {
        const validity = new Date(input.value).getTime()
        if (
          validity <= Date.now() ||
          validity > Date.now() + 366 * 24 * 60 * 60 * 1000
        )
          input.setCustomValidity(
            "Choose a future validity date within the next year.",
          )
      }
      if (input.name === "paymentDue" && input.value) {
        const total = rows.reduce(
          (sum, { key }) =>
            sum +
            Math.round(Number(data.get(`price-${key}`)) * 100) *
              Number(data.get(`quantity-${key}`)),
          0,
        )
        if (Math.round(Number(input.value) * 100) > total)
          input.setCustomValidity(
            "The commencement payment cannot exceed the quotation total.",
          )
      }
      if (!input.reportValidity()) return false
    }
    return true
  }
  return (
    <form
      className="space-y-4 [&_input]:min-h-10 [&_input]:bg-white [&_label]:text-xs [&_select]:min-h-10 [&_select]:bg-white [&_textarea]:bg-white"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        if (controls.busy) return
        if (step < 3) {
          if (validate(form, step)) {
            setReview(new FormData(form))
            setStep(step + 1)
          }
          return
        }
        const data = new FormData(form)
        if (
          await controls.act({
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
          })
        )
          onComplete?.()
      }}
    >
      <ol
        aria-label="Quotation steps"
        className="m-0 flex list-none items-center gap-2 overflow-x-auto border-b border-[#e8ebef] p-0 pb-3"
      >
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={cn(
              "flex min-w-fit flex-1 items-center gap-1.5 text-[10px] font-semibold last:flex-none",
              index <= step ? "text-[#203f8c]" : "text-[#52627a]",
            )}
          >
            {index < step ? (
              <Check size={13} className="shrink-0" aria-hidden="true" />
            ) : index === step ? (
              <LoaderCircle size={13} className="shrink-0" aria-hidden="true" />
            ) : (
              <Circle size={12} className="shrink-0" aria-hidden="true" />
            )}
            <span>{label}</span>
            <span className="sr-only">
              {index < step
                ? " completed"
                : index === step
                  ? " current step"
                  : " upcoming"}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "ml-1 h-0.5 min-w-1 flex-1 rounded-full",
                  index < step ? "bg-[#203f8c]" : "bg-[#cbd5e1]",
                )}
              />
            )}
          </li>
        ))}
      </ol>
      <header className="space-y-1">
        <p className="m-0 text-[10px] font-medium text-[#52627a]">
          Step {step + 1} of {steps.length}
        </p>
        <h3 className="m-0 text-sm font-semibold text-[#182235]">
          {
            [
              "Define the scope",
              "Set the pricing",
              "Add timeline and payment terms",
              "Review quotation",
            ][step]
          }
        </h3>
        <p className="m-0 text-[11px] leading-5 text-[#52627a]">
          {
            [
              "Describe the work and what the client will receive.",
              "List each item with its quantity and unit price.",
              "Confirm delivery, payment and quotation validity.",
              "Check the details before sending to the client.",
            ][step]
          }
        </p>
      </header>
      <div data-quotation-step="0" hidden={step !== 0} className="space-y-3">
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
      </div>
      <div data-quotation-step="1" hidden={step !== 1} className="space-y-3">
        <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
          <legend className="mb-2 text-[11px] font-medium">
            Pricing breakdown
          </legend>
          {rows.map(({ key }, index) => (
            <div
              key={key}
              className="space-y-3 rounded-lg border border-[#d8e1ef] bg-[#f6f8fc] p-3"
            >
              <WorkflowField label={`Item ${index + 1}`}>
                <input
                  name={`description-${key}`}
                  defaultValue={rows[index].description}
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
                    defaultValue={rows[index].quantity}
                    className={workflowInput}
                  />
                </WorkflowField>
                <WorkflowField label="Unit price">
                  <input
                    name={`price-${key}`}
                    defaultValue={rows[index].unitPrice}
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
              setRows((items) => [
                ...items,
                { key: nextKey, description: "", quantity: 1, unitPrice: "" },
              ])
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
            {latest &&
              !["PHP", "USD", "EUR", "GBP"].includes(latest.currency) && (
                <option value={latest.currency}>{latest.currency}</option>
              )}
          </select>
        </WorkflowField>
      </div>
      <div data-quotation-step="2" hidden={step !== 2} className="space-y-3">
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
            min={workflow.paymentRequired ? "0.01" : "0"}
            max="999999999"
            step="0.01"
            defaultValue={latest?.paymentDue}
            className={workflowInput}
          />
        </WorkflowField>
        <WorkflowField label="Valid until">
          <input
            name="validUntil"
            defaultValue={
              latest
                ? new Date(
                    new Date(latest.validUntil).getTime() -
                      new Date(latest.validUntil).getTimezoneOffset() * 60_000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
            required
            type="datetime-local"
            className={workflowInput}
          />
        </WorkflowField>
      </div>
      {step === 3 && review && (
        <section
          aria-label="Quotation review"
          className="space-y-3 text-xs text-[#182235]"
        >
          <p className="whitespace-pre-wrap">
            <strong>Scope</strong>
            <br />
            {String(review.get("scope"))}
          </p>
          <p className="whitespace-pre-wrap">
            <strong>Deliverables</strong>
            <br />
            {String(review.get("deliverables"))}
          </p>
          <ul className="space-y-2 pl-4">
            {rows.map(({ key }) => (
              <li key={key}>
                {String(review.get(`description-${key}`))} ·{" "}
                {String(review.get(`quantity-${key}`))} ×{" "}
                {workflowMoney(
                  String(review.get(`price-${key}`)),
                  String(review.get("currency")),
                )}
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#edf2fb] px-3 py-2.5 text-sm font-semibold text-[#203f8c]">
            <strong>Total: </strong>
            {workflowMoney(
              String(
                rows.reduce(
                  (total, { key }) =>
                    total +
                    Number(review.get(`quantity-${key}`)) *
                      Number(review.get(`price-${key}`)),
                  0,
                ),
              ),
              String(review.get("currency")),
            )}
          </p>
          <p className="whitespace-pre-wrap">
            <strong>Timeline</strong>
            <br />
            {String(review.get("timeline"))}
          </p>
          <p className="whitespace-pre-wrap">
            <strong>Payment terms</strong>
            <br />
            {String(review.get("paymentTerms"))}
          </p>
          <p>
            Due before commencement:{" "}
            {workflowMoney(
              String(review.get("paymentDue")),
              String(review.get("currency")),
            )}
          </p>
          <p>
            Valid until: {String(review.get("validUntil")).replace("T", " ")}
          </p>
        </section>
      )}
      {workflow.quotationApprovalRequired && (
        <p className="m-0 text-[11px]">
          The assigned quotation approver must authorize this version before the
          client can accept it.
        </p>
      )}
      <div
        className={cn(
          "sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-[#e8ebef] bg-white py-3",
          inline && "justify-end",
        )}
      >
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={controls.busy}
            onClick={onCancel}
            className="mr-auto min-h-10 border-[#d8e1ef] text-xs text-[#52627a]"
          >
            Cancel
          </Button>
        )}
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={controls.busy}
            onClick={() => setStep(step - 1)}
            className="min-h-10 border-[#d8e1ef] text-xs text-[#203f8c]"
          >
            Back
          </Button>
        )}
        <Button
          className={`${workflowButton} min-h-10 min-w-20 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]`}
          disabled={controls.busy}
        >
          {controls.busy
            ? "Saving…"
            : step < 2
              ? "Next"
              : step === 2
                ? "Review"
                : latest
                  ? "Send revised quotation"
                  : "Send quotation"}
        </Button>
      </div>
    </form>
  )
}

function InternalWorkspace({
  workflow,
  controls,
  id,
}: {
  workflow: Workflow
  controls: WorkflowControls
  id: string
}) {
  const internal = workflow.internal
  if (!workflow.permissions.manage || !internal || !workflow.approval)
    return null
  const mutable = !["ACTIVE_PROJECT", "DECLINED", "CANCELLED"].includes(
    workflow.state,
  )
  return (
    <div className="mt-3 rounded-xl border border-[#d8e1ef] bg-[#f6f8fc] px-3 pt-3 pb-1">
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-[#52627a] uppercase">
        Internal · Department head only
      </p>
      {workflow.approval && (
        <WorkflowDisclosure
          id={id}
          title="Staffing and workload"
          open={workflow.state === "READY_FOR_ACTIVATION"}
        >
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
      {/* Internal notes are opened from the + menu.
              <p className="mt-1 mb-0 text-[9px] text-[#8791a2]">
                {event.actor?.fullName || "System"} ·{" "}
                {new Date(event.createdAt).toLocaleString("en-PH")}
              </p>
            </div>
          ))}
        </div>
      */}
    </div>
  )
}

export function WorkflowContextPanel({
  workflow,
  controls,
  id,
  hidden = false,
  onViewEvent,
  conversationOverview,
}: {
  workflow: Workflow | null
  controls: WorkflowControls
  id?: string
  hidden?: boolean
  onViewEvent?: (entityId: string) => void
  conversationOverview?: ReactNode
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
                    {workflow.agreement && (
                      <li className="flex justify-between gap-2 text-[11px]">
                        <a
                          href={`#workflow-${workflow.agreement.id}`}
                          className="text-[#203f8c]"
                        >
                          Agreement{workflow.agreement.mandatory ? " *" : ""}
                        </a>
                        <WorkflowBadge
                          value={
                            !workflow.agreement.mandatory &&
                            !workflow.agreement.documentFileId
                              ? "NOT_REQUIRED"
                              : workflow.agreement.status
                          }
                          checklist
                        />
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
                                    {startsAt.toLocaleDateString("en-PH", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </p>
                                  <p className="m-0 flex items-center gap-1 text-[10px] text-blue-100">
                                    <Clock3 size={11} aria-hidden="true" />
                                    {startsAt.toLocaleTimeString("en-PH", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}{" "}
                                    –{" "}
                                    {endsAt.toLocaleTimeString("en-PH", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
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
                controls={controls}
                id={sectionId("staffing")}
              />
              {(workflow.permissions.manage || workflow.permissions.isClient) &&
                !terminal &&
                workflow.state !== "PENDING_REVIEW" && (
                  <WorkflowDisclosure
                    id={sectionId("workflow-controls")}
                    title="Workflow controls"
                  >
                    {workflow.permissions.manage &&
                      workflow.state === "READY_FOR_ACTIVATION" && (
                        <WorkflowDisclosure
                          id={sectionId("activation")}
                          title="Project activation"
                          open
                        >
                          <p className="m-0 text-xs text-[#52627a]">
                            {staffingApproved
                              ? "Documents, payment and staffing are approved. Activate the project to start delivery."
                              : "Choose at least one active department employee under Staffing and workload, then click Approve staffing before activating the project."}
                          </p>
                          {!staffingApproved && (
                            <Button
                              type="button"
                              variant="outline"
                              className={`${workflowButton} w-full text-[#203f8c]`}
                              onClick={() => {
                                const section = document.getElementById(
                                  sectionId("staffing"),
                                )
                                if (section instanceof HTMLDetailsElement)
                                  section.open = true
                                section?.scrollIntoView({
                                  block: "nearest",
                                  behavior: "smooth",
                                })
                              }}
                            >
                              Review staffing
                            </Button>
                          )}
                          <Button
                            type="button"
                            disabled={controls.busy || !staffingApproved}
                            className={`${workflowButton} w-full bg-[#203f8c] text-white hover:bg-[#172f70]`}
                            onClick={() =>
                              void controls.act({ type: "ACTIVATE_PROJECT" })
                            }
                          >
                            Activate project
                          </Button>
                        </WorkflowDisclosure>
                      )}
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
