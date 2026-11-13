import type { PillTone } from "@/components/ui/pill"
import type { ProjectStatus } from "@/features/project-management/model/project-contracts"
import { humanizeEnum } from "@/lib/format"

const projectStatusTones: Record<ProjectStatus, PillTone> = {
  PLANNED: "neutral",
  IN_PROGRESS: "warning",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
}

/** "IN_PROGRESS" → "In progress". */
export function statusLabel(status: string): string {
  return humanizeEnum(status)
}

/** Pill tone for a project status; unknown statuses are neutral. */
export function statusTone(status: string): PillTone {
  return Object.hasOwn(projectStatusTones, status)
    ? projectStatusTones[status as ProjectStatus]
    : "neutral"
}

/** Completed-task percentage, 0–100. */
export function projectProgress(project: {
  taskCount: number
  completedTasks: number
}): number {
  return project.taskCount
    ? Math.min(
        100,
        Math.round((project.completedTasks / project.taskCount) * 100),
      )
    : 0
}
