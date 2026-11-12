import type { ReactNode } from "react"
import {
  Check,
  Circle,
  ClipboardList,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react"
import { humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Workflow, WorkflowState } from "../model/workflow"

export const workflowInput =
  "w-full min-w-0 rounded-lg border border-[#dfe5ee] bg-background px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
export const workflowButton = "h-auto min-h-8 rounded-lg px-3 py-2 text-[11px]"

export function WorkflowBadge({
  value,
  checklist = false,
}: {
  value: string
  checklist?: boolean
}) {
  const complete = [
    "COMPLETED",
    "APPROVED",
    "VERIFIED",
    "NOT_REQUIRED",
  ].includes(value)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
        checklist
          ? complete
            ? "bg-[#ecfdf3] text-[#067647]"
            : "bg-[#fef3f2] text-[#b42318]"
          : "bg-[#eaf0fb] text-[#203f8c]",
      )}
    >
      {checklist &&
        (complete ? (
          <Check size={12} aria-hidden="true" />
        ) : (
          <Circle size={12} aria-hidden="true" />
        ))}
      {checklist && value === "SUBMITTED"
        ? "Pending review"
        : checklist && value === "REQUESTED"
          ? "Incomplete"
          : humanizeEnum(value)}
    </span>
  )
}

export function WorkflowField({
  label,
  children,
  asGroup = false,
}: {
  label: ReactNode
  children: ReactNode
  asGroup?: boolean
}) {
  const Container = asGroup ? "div" : "label"
  return (
    <Container className="grid min-w-0 gap-1.5 text-[11px] font-medium text-[#52627a]">
      {label}
      {children}
    </Container>
  )
}

export function WorkflowCard({
  title,
  status,
  children,
  className,
  icon: Icon = ClipboardList,
}: {
  title: string
  status?: string
  children: ReactNode
  className?: string
  icon?: LucideIcon
}) {
  return (
    <section
      className={cn(
        "my-3 w-full min-w-0 overflow-hidden rounded-2xl border-0 bg-[#294c96] bg-[linear-gradient(145deg,transparent_40%,rgb(20_54_129_/_42%))] p-2 text-xs shadow-[0_8px_24px_rgb(26_58_128_/_10%)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 text-white max-[560px]:p-3">
        <div className="flex min-w-0 flex-[1_1_180px] items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-white/80 bg-[rgb(22_48_105_/_10%)]"
            aria-hidden="true"
          >
            <Icon size={23} strokeWidth={1.8} />
          </span>
          <h3 className="m-0 min-w-0 flex-1 text-[15px] leading-snug font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">
            {title}
          </h3>
        </div>
        {status && (
          <span className="inline-flex max-w-full items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-medium text-white">
            {humanizeEnum(status)}
          </span>
        )}
      </header>
      <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 leading-5 text-[#52627a] [overflow-wrap:anywhere] max-[560px]:p-4">
        {children}
      </div>
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
              "flex min-w-fit flex-1 items-center gap-1.5 text-[10px] font-semibold",
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
                className={cn(
                  "ml-1 h-0.5 min-w-2 flex-1 rounded-full",
                  index < current ? "bg-[#203f8c]" : "bg-[#cbd5e1]",
                )}
              />
            )}
          </li>
        ))}
      </ol>
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
