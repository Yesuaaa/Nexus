"use client"

import { useState } from "react"
import {
  CalendarDays,
  Check,
  CircleHelp,
  FileText,
  Paperclip,
  Plus,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Workflow } from "@/features/request-workflow/model/workflow"
import type { WorkflowDraftAction } from "@/features/request-workflow/components/workflow-action-draft"
import { humanizeEnum } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"
import { getWorkflow } from "@/features/request-workflow/api/workflow-api"
import type { ConversationBooking } from "../api/request-conversations-api"

type Tool = {
  id:
    | Extract<WorkflowDraftAction, "request-information" | "quotation">
    | "schedule-consultation"
    | "attachment"
    | "activation"
  label: string
  description: string
  icon: LucideIcon
  managerOnly?: boolean
  stages?: readonly Workflow["state"][]
}

const tools: Tool[] = [
  {
    id: "attachment",
    label: "Attach file",
    description:
      "Share a supporting file for a booking, such as a brief, reference, or document.",
    icon: Paperclip,
    stages: [
      "CONSULTATION",
      "QUOTATION_PENDING",
      "CLIENT_APPROVAL",
      "REVISION_REQUESTED",
      "AGREEMENT_PAYMENT_PENDING",
      "READY_FOR_ACTIVATION",
      "ACTIVE_PROJECT",
    ],
  },
  {
    id: "request-information",
    label: "Request information",
    description:
      "Ask the client for details or documents needed for a booking and track their response.",
    icon: CircleHelp,
    stages: [
      "CONSULTATION",
      "QUOTATION_PENDING",
      "CLIENT_APPROVAL",
      "REVISION_REQUESTED",
      "AGREEMENT_PAYMENT_PENDING",
      "READY_FOR_ACTIVATION",
    ],
    managerOnly: true,
  },
  {
    id: "schedule-consultation",
    label: "Schedule consultation/meeting",
    description:
      "Arrange a general meeting with the client or discuss one or more booked services.",
    icon: CalendarDays,
    managerOnly: true,
  },
  {
    id: "quotation",
    label: "Create quotation",
    description:
      "Prepare a proposal with the scope, deliverables, pricing, timeline, and payment terms for a booking.",
    icon: FileText,
    stages: [
      "CONSULTATION",
      "QUOTATION_PENDING",
      "CLIENT_APPROVAL",
      "REVISION_REQUESTED",
    ],
    managerOnly: true,
  },
  {
    id: "activation",
    label: "Project activation",
    description:
      "Activate a paid service and open its project workspace once staffing is approved.",
    icon: Check,
    stages: ["READY_FOR_ACTIVATION"],
    managerOnly: true,
  },
]

function unavailableReason(tool: Tool, workflow: Workflow): string | null {
  if (tool.managerOnly && !workflow.permissions.manage)
    return "Only the department head can use this tool for this booking."
  if (tool.stages && !tool.stages.includes(workflow.state))
    return "This action is not available at the current booking stage."
  return null
}

export function ConversationTools({
  workflow,
  bookings,
  workflows,
  isClient,
  isManager,
  canSend,
  loading,
  busy,
  error,
  onSelectBooking,
  onDraft,
  onScheduleMeeting,
  onActivate,
  onAttach,
  onRetry,
}: {
  workflow: Workflow | null
  bookings: ConversationBooking[]
  workflows: Workflow[]
  isClient: boolean
  isManager: boolean
  canSend: boolean
  loading: boolean
  busy: boolean
  error: string
  onSelectBooking: (id: string) => void
  onDraft: (action: WorkflowDraftAction) => void
  onScheduleMeeting: () => void
  onActivate: () => void
  onAttach: () => void
  onRetry: () => void
}) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const latestWorkflows = new Map(
    workflows.map((snapshot) => [snapshot.request.id, snapshot]),
  )
  if (workflow) latestWorkflows.set(workflow.request.id, workflow)
  const currentStages = bookings.length
    ? bookings.map(
        (booking) =>
          latestWorkflows.get(booking.id)?.state ?? booking.workflowState,
      )
    : workflow
      ? [workflow.state]
      : []
  const relevantTools = tools.filter(
    (item) =>
      (!item.managerOnly || isManager) &&
      (!item.stages ||
        currentStages.some((stage) => item.stages?.includes(stage))),
  )
  const bookingIdsKey = JSON.stringify(
    bookings.length
      ? bookings.map((booking) => booking.id)
      : workflow
        ? [workflow.request.id]
        : [],
  )
  const toolId = tool?.id
  // Check every booking's latest workflow before offering it for this tool.
  const options = useAsyncResource(
    async (signal) => {
      const ids = JSON.parse(bookingIdsKey) as string[]
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getWorkflow(id, signal)
          } catch {
            return null
          }
        }),
      )
      return {
        workflows: results.filter((item): item is Workflow => item !== null),
        failed: results.some((item) => item === null),
      }
    },
    [toolId, bookingIdsKey],
    { enabled: Boolean(toolId) },
  )
  const checkingOptions = !toolId || options.loading
  const candidates =
    !checkingOptions && tool
      ? (options.data?.workflows ?? [])
          .map((snapshot) =>
            workflow?.request.id === snapshot.request.id &&
            workflow.version > snapshot.version
              ? workflow
              : snapshot,
          )
          .filter((snapshot) => unavailableReason(tool, snapshot) === null)
          .map((snapshot) => snapshot.request)
      : []
  const targetWorkflow = workflow?.request.id === targetId ? workflow : null
  const reason =
    tool && targetWorkflow ? unavailableReason(tool, targetWorkflow) : null
  const ready = Boolean(
    tool &&
    targetWorkflow &&
    candidates.some((booking) => booking.id === targetId) &&
    !reason &&
    !loading &&
    !busy &&
    canSend,
  )

  function proceed() {
    if (!ready || !tool) return
    setTool(null)
    switch (tool.id) {
      case "schedule-consultation":
        onScheduleMeeting()
        break
      case "attachment":
        onAttach()
        break
      case "activation":
        onActivate()
        break
      default:
        onDraft(tool.id)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            aria-label={
              isClient ? "Open attachment options" : "Open request actions"
            }
            variant="brand"
            className="size-10 shrink-0 rounded-full p-0"
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[280px] rounded-xl border-[#dce3ee] bg-white p-2 text-[#203047] shadow-[0_12px_30px_rgb(18_36_73_/_16%)]"
        >
          <DropdownMenuLabel className="px-2.5 py-2 text-[10px] text-[#52627a]">
            Conversation tools
          </DropdownMenuLabel>
          {relevantTools
            .filter((item) => !item.managerOnly || isManager)
            .map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={busy || !canSend}
                onSelect={() => {
                  if (item.id === "schedule-consultation") {
                    onScheduleMeeting()
                    return
                  }
                  setTargetId(null)
                  setTool(item)
                }}
                className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
              >
                <item.icon aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            ))}
          {!relevantTools.length && (
            <p className="m-0 px-2.5 py-2 text-xs text-[#52627a]">
              No actions available for the current bookings.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={Boolean(tool)}
        onOpenChange={(open) => {
          if (!open) setTool(null)
        }}
      >
        <DialogContent
          className="z-[141] max-h-[85dvh] w-[calc(100%-32px)] max-w-md overflow-y-auto rounded-2xl border-[#dce3ee] bg-white text-[#182235]"
          overlayClassName="z-[140] bg-[#14213d]/35"
        >
          <DialogTitle className="pr-5 text-sm">
            {tool?.label}: choose a booking
          </DialogTitle>
          <DialogDescription className="text-xs leading-5 text-[#52627a]">
            {tool?.description}
            <span className="mt-2 block">
              Choose the service this tool applies to.
            </span>
          </DialogDescription>
          <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
            <legend className="sr-only">
              Booking for {tool?.label.toLowerCase()}
            </legend>
            {candidates.map((booking) => (
              <label
                key={booking.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce3ee] p-3 has-checked:border-[#294a9b] has-checked:bg-[#edf1f8]"
              >
                <input
                  type="radio"
                  name="tool-booking"
                  value={booking.id}
                  checked={targetId === booking.id}
                  disabled={busy}
                  onChange={() => {
                    setTargetId(booking.id)
                    onSelectBooking(booking.id)
                  }}
                  className="mt-1 accent-[#203f8c]"
                />
                <span className="min-w-0 text-xs">
                  <span className="block font-semibold">
                    {booking.serviceName}
                  </span>
                  <span className="mt-1 block text-[10px] break-all text-[#52627a]">
                    {booking.referenceNumber || booking.id}
                  </span>
                </span>
              </label>
            ))}
            {checkingOptions && (
              <p role="status" className="text-xs text-[#52627a]">
                Checking eligible services…
              </p>
            )}
            {!checkingOptions && !candidates.length && (
              <p className="text-xs text-[#52627a]">
                No eligible services for this action.
              </p>
            )}
            {!checkingOptions && options.data?.failed && (
              <div role="status" className="text-xs text-[#52627a]">
                <p>Some services could not be checked.</p>
                <Button
                  variant="outline"
                  onClick={options.retry}
                  className="text-xs"
                >
                  Retry booking options
                </Button>
              </div>
            )}
          </fieldset>
          {targetId && (loading || (!targetWorkflow && !error)) && (
            <p role="status" className="m-0 text-xs text-[#52627a]">
              Loading booking tools…
            </p>
          )}
          {targetId && !loading && error && (
            <div role="status" className="text-xs text-[#52627a]">
              <p>Couldn't load tools for this booking. {error}</p>
              <Button variant="outline" onClick={onRetry} className="text-xs">
                Retry booking tools
              </Button>
            </div>
          )}
          {targetWorkflow && !loading && (
            <div className="text-xs text-[#52627a]">
              <p className="m-0">
                Current stage: {humanizeEnum(targetWorkflow.state)}
              </p>
              {reason && (
                <p role="status" className="mt-2 mb-0 leading-5">
                  {reason}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTool(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              disabled={!ready}
              onClick={proceed}
              variant="brand"
              className="text-xs"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
