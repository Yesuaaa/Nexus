import type { ReactNode } from "react"
import { Check, Circle, ClipboardList, type LucideIcon } from "lucide-react"
import { humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"
import { formFieldClass } from "@/components/ui/form-control-styles"

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
    <Container className={formFieldClass}>
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

export type WorkflowProgressEntry = {
  id: string
  stage: string
  status: string
  summary: string
  createdAt: string
  actor: string
  internal: boolean
}

export function WorkflowProgress({
  entries,
  formatDateTime,
}: {
  entries: WorkflowProgressEntry[]
  formatDateTime: (value: string) => string
}) {
  const orderedEntries = [...entries].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime(),
  )
  return (
    <ol
      aria-label="Recorded workflow timeline"
      className={cn(
        "m-0 ml-1 grid list-none p-0",
        orderedEntries.length > 1 && "border-l border-[#d8e0eb]",
      )}
    >
      {orderedEntries.map((entry) => (
        <li key={entry.id} className="relative grid gap-1 pb-4 pl-4 last:pb-0">
          <span
            aria-hidden="true"
            className="absolute top-1 left-[-5px] size-2.5 rounded-full border-2 border-[#6c83b5] bg-background"
          />
          <div className="min-w-0 border-b border-[#eceef1] pb-3 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-foreground">
                {entry.stage}
              </span>
              <WorkflowBadge value={entry.status} />
              {entry.internal && (
                <span className="text-[10px] text-[#65718a]">
                  Internal workflow event
                </span>
              )}
            </div>
            <p className="mt-1 mb-0 text-xs leading-5 [overflow-wrap:anywhere]">
              {entry.summary}
            </p>
            <p className="mt-1 mb-0 text-[10px] leading-4 text-[#65718a]">
              <time dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)}
              </time>{" "}
              · {entry.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
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
