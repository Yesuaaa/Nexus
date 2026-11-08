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

export function deliverableStatusClass(status: ProjectDeliverableStatus) {
  switch (status) {
    case "IN_REVIEW":
      return "bg-[#fff1d4] text-[#946000]"
    case "REJECTED":
      return "bg-[#ffeaeb] text-[#b3343b]"
    case "APPROVED":
      return "bg-[#e3f5e9] text-[#13743b]"
    case "SENT_TO_CLIENT":
      return "bg-[#e7efff] text-[#294c96]"
    default:
      return "bg-[#edf1f6] text-[#60718c]"
  }
}
