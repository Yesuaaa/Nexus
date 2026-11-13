export const projectStatusValues = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const

export type ProjectStatus = (typeof projectStatusValues)[number]

export const projectTaskStatusValues = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
] as const

export type ProjectTaskStatus = (typeof projectTaskStatusValues)[number]

export const projectDeliverableStatusValues = [
  "NOT_SUBMITTED",
  "IN_REVIEW",
  "REJECTED",
  "APPROVED",
  "SENT_TO_CLIENT",
] as const

export type ProjectDeliverableStatus =
  (typeof projectDeliverableStatusValues)[number]

export type ProjectDeliverableContract = {
  id: string
  title: string
  description: string | null
  expectedFileType: string | null
  sentToClientAt: string | null
}

export type ManagedProjectDeliverable = ProjectDeliverableContract & {
  deliveryStatus: ProjectDeliverableStatus
  rejectionReason: string | null
  reviewedAt: string | null
  workflowFileId: string | null
  updatedAt: string
  completedAt: string | null
  workflowFile: {
    id: string
    name: string
    mimeType: string
    size: number
    uploaderId: string
    createdAt: string
    clientVisible: boolean
  } | null
}
