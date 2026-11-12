import { pillToneClass, type PillTone } from "@/components/ui/pill"
import type { ProjectDeliverableStatus } from "../api/project-workspace-api"

export function deliverableStatusLabel(status: ProjectDeliverableStatus) {
  switch (status) {
    case "IN_REVIEW":
      return "In review"
    case "REJECTED":
      return "Rejected"
    case "APPROVED":
      return "Approved"
    case "SENT_TO_CLIENT":
      return "Sent to client"
    default:
      return "Not submitted"
  }
}

export function deliverableStatusTone(
  status: ProjectDeliverableStatus,
): PillTone {
  switch (status) {
    case "IN_REVIEW":
      return "warning"
    case "REJECTED":
      return "danger"
    case "APPROVED":
      return "success"
    case "SENT_TO_CLIENT":
      return "info"
    default:
      return "neutral"
  }
}

/** Tone colours for a deliverable status badge that isn't a Pill. */
export function deliverableStatusClass(status: ProjectDeliverableStatus) {
  return pillToneClass(deliverableStatusTone(status))
}
