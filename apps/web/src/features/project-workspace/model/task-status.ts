import type { PillTone } from "@/components/ui/pill"
import type { ProjectTaskStatus } from "@/features/project-management/model/project-contracts"

export const taskStatusLabels: Record<ProjectTaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Complete",
}

export const taskStatusTones: Record<ProjectTaskStatus, PillTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  DONE: "success",
}
