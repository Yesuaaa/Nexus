import type { ReactNode } from "react"
import { Check, Circle, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Workflow, WorkflowState } from "../model/workflow"

export const workflowInput =
  "w-full min-w-0 rounded-lg border border-[#dfe5ee] bg-background px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
export const workflowButton = "h-auto min-h-8 rounded-lg px-3 py-2 text-[11px]"

export function statusText(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function WorkflowBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#eaf0fb] px-2.5 py-1 text-[10px] font-medium text-[#203f8c]">
      {statusText(value)}
    </span>
  )
}

export function WorkflowField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[11px] font-medium text-[#52627a]">
      {label}
      {children}
    </label>
  )
}

export function WorkflowCard({
  title,
  status,
  children,
}: {
  title: string
  status?: string
  children: ReactNode
}) {
  return (
    <section className="my-3 w-full rounded-2xl border border-[#e1e6ee] bg-background p-4 text-xs shadow-[0_2px_8px_rgb(18_36_73_/_3%)]">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold text-[#182235]">{title}</h3>
        {status && <WorkflowBadge value={status} />}
      </header>
      <div className="space-y-3 leading-5 text-[#52627a]">{children}</div>
    </section>
  )
}

export function WorkflowProgress({ workflow }: { workflow: Workflow }) {
  const steps = [
    "Consultation",
    "Quotation",
    "Approval",
    "Agreement / payment",
    "Activation",
  ]
  const positions: Record<WorkflowState, number> = {
    PENDING_REVIEW: -1,
    CONSULTATION: 0,
    QUOTATION_PENDING: 1,
    CLIENT_APPROVAL: 2,
    AGREEMENT_PAYMENT_PENDING: 3,
    READY_FOR_ACTIVATION: 4,
    ACTIVE_PROJECT: 5,
    DECLINED: 2,
    CANCELLED: -1,
    REVISION_REQUESTED: 1,
    ON_HOLD: -1,
  }
  const current =
    positions[
      workflow.state === "ON_HOLD" && workflow.previousState
        ? workflow.previousState
        : workflow.state
    ]
  return (
    <div className="shrink-0 border-b border-[#e8ebef] px-5 py-3">
      <ol
        aria-label="Request progress"
        className="m-0 flex list-none gap-2 overflow-x-auto p-0"
      >
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={current === index ? "step" : undefined}
            className={cn(
              "flex min-w-fit flex-1 items-center gap-1.5 text-[10px]",
              index <= current ? "text-[#203f8c]" : "text-[#8791a2]",
            )}
          >
            {index < current ? (
              <Check size={13} aria-hidden="true" />
            ) : index === current ? (
              <LoaderCircle size={13} aria-hidden="true" />
            ) : (
              <Circle size={12} aria-hidden="true" />
            )}
            <span>{step}</span>
            {index !== steps.length - 1 && (
              <span
                aria-hidden="true"
                className="ml-1 h-px min-w-2 flex-1 bg-[#e1e6ee]"
              />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 mb-0 text-[11px] leading-5 text-[#52627a]">
        <span className="font-medium text-[#182235]">Next: </span>
        {workflow.nextAction}
      </p>
    </div>
  )
}

export function workflowMoney(value: string, currency: string) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
    }).format(Number(value))
  } catch {
    return `${currency} ${value}`
  }
}
