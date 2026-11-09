import Link from "next/link"
import { FileText } from "lucide-react"
import {
  deliverableStatusLabel,
  deliverableStatusClass,
} from "@/features/project-workspace/components/deliverable-status"
import { Pill } from "@/components/ui/pill"
import { focusRing } from "@/components/layout/styles"
import type { RequestMessage } from "../api/request-conversations-api"
import type { ProjectConversationDetails } from "../model/project-conversation"

export function ProjectDeliverableMessage({
  message,
  project,
  isClient,
}: {
  message: RequestMessage
  project: ProjectConversationDetails
  isClient: boolean
}) {
  const card = message.deliverable
  if (!card) return null
  const status = card.kind === "submission" ? "IN_REVIEW" : "SENT_TO_CLIENT"
  return (
    <div className="w-[min(65vw,340px)] max-w-full space-y-3 rounded-xl border border-[#d8e1ef] bg-[#f6f8fc] p-3 text-[#182235]">
      <div className="flex items-start gap-2">
        <FileText
          size={18}
          className="shrink-0 text-[#294a9b]"
          aria-hidden="true"
        />
        <span className="text-xs font-semibold [overflow-wrap:anywhere]">
          {card.title}
        </span>
      </div>
      <Pill className={deliverableStatusClass(status)}>
        {deliverableStatusLabel(status)}
      </Pill>
      <p className="m-0 text-xs text-[#52627a] [overflow-wrap:anywhere]">
        {card.fileName}
      </p>
      {message.body && (
        <p className="m-0 text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {message.body}
        </p>
      )}
      {card.kind === "submission" && (
        <p className="m-0 text-[10px] text-[#52627a]">
          Submitted for review · Visible to staff only
        </p>
      )}
      <Link
        href={
          isClient
            ? `/projects/${encodeURIComponent(project.id)}/deliverables/${encodeURIComponent(card.id)}`
            : `/project-workspace/${encodeURIComponent(project.workspaceId)}?tab=deliverables`
        }
        className={`inline-block rounded-md text-xs font-medium text-[#294a9b] ${focusRing}`}
      >
        View deliverable
      </Link>
    </div>
  )
}
