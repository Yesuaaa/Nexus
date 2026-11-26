import { isDeepStrictEqual } from "node:util"
import { getPrisma } from "../../src/lib/db.js"
import {
  getProjectWorkspace,
  updateProjectWorkspaceStatus,
} from "../../src/features/project-workspace/project-workspace.service.js"
import { projectWorkspaceIdentity } from "../../src/features/project-workspace/workspace-identity.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseBoardPlan } from "./showcase-kanban.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"

const cases = [
  { index: 1, name: "Northline Brand Identity", client: 23, kind: "design" },
  {
    index: 3,
    name: "Avelora Seasonal Campaign Imagery",
    client: 22,
    kind: "photography",
  },
] as const

/** Transition only the two unchanged, workflow-owned Phase 2 examples. */
export async function seedShowcaseOnHold(headId: string, apply = true) {
  const target = assertPhase2Target(process.env)
  const db = getPrisma()
  if (!db) throw new Error("Database configuration is required")
  await db.$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (current?.name !== target.database)
      throw new Error("Connected database does not match confirmed target")
    await assertShowcaseRealtimeDisabled(tx)
  })
  const department = await db.department.findFirst({
    where: {
      headId,
      head: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    select: { id: true },
  })
  if (!department) throw new Error("An active department head is required")
  const results = { placedOnHold: 0, skipped: 0 }
  for (const scenario of cases) {
    const project = await db.project.findFirst({
      where: {
        name: scenario.name,
        clientId: showcaseId("user", scenario.client),
        request: {
          submissionKey: showcaseUuid("phase2-request", scenario.index),
          acceptedDepartmentId: department.id,
          workflow: { state: "ACTIVE_PROJECT" },
        },
      },
      include: {
        client: {
          select: {
            email: true,
            role: true,
            isActive: true,
            accountDeletedAt: true,
          },
        },
        staff: {
          include: { employee: { include: { user: true } } },
          orderBy: { employeeId: "asc" },
        },
        request: { select: { id: true } },
      },
    })
    if (
      !project ||
      !project.request ||
      !project.startDate ||
      project.workspaceGroupId !== null
    )
      throw new Error("An expected Phase 2 project is unavailable")
    if (project.status === "ON_HOLD") {
      results.skipped++
      continue
    }
    if (project.status !== "IN_PROGRESS") {
      results.skipped++
      continue
    }
    if (
      project.client.email !==
        `client${scenario.client - 21}@showcase.invalid` ||
      project.client.role !== "USER" ||
      !project.client.isActive ||
      project.client.accountDeletedAt
    )
      throw new Error("The fictional client changed; refusing to change status")
    const prior = await db.workflowEvent.findFirst({
      where: {
        requestId: project.request.id,
        type: "WORKSPACE_ON_HOLD",
        entityId: project.id,
      },
      select: { id: true },
    })
    if (prior) {
      results.skipped++
      continue
    }
    const staff = Array.from({ length: 4 }, (_, index) =>
      showcaseId("employee", index),
    )
    if (
      project.staff.length !== staff.length ||
      project.staff.some(
        (member, index) =>
          member.employeeId !== staff[index] ||
          member.employee.user?.id !== showcaseId("user", index + 2) ||
          member.employee.user.email !== `team${index + 1}@showcase.invalid` ||
          !member.employee.user.isActive ||
          member.employee.user.accountDeletedAt ||
          member.employee.status !== "ACTIVE" ||
          member.employee.departmentId !== department.id,
      )
    )
      throw new Error("The showcase team changed; refusing to change status")
    if (
      !isDeepStrictEqual(
        project.workPlan,
        showcaseBoardPlan(scenario.kind, staff, project.startDate),
      )
    )
      throw new Error("The showcase plan changed; refusing to change status")
    const workspaceId = projectWorkspaceIdentity(project)
    const workspace = await getProjectWorkspace(headId, workspaceId)
    const review = workspace.kanbanColumns.find(
      (column) => column.name === "Revisions",
    )
    const expectedTasks = showcaseBoardPlan(
      scenario.kind,
      staff,
      project.startDate,
    ).phases[2].tasks
    if (
      !review ||
      workspace.kanbanColumns.length !== 1 ||
      workspace.kanbanAssignments.length !== expectedTasks.length ||
      workspace.kanbanAssignments.some(
        (entry) =>
          entry.projectId !== project.id ||
          entry.columnId !== review.id ||
          !expectedTasks.some((task) => task.id === entry.taskId),
      )
    )
      throw new Error("The showcase board changed; refusing to change status")
    results.placedOnHold++
    if (apply)
      await updateProjectWorkspaceStatus(headId, workspaceId, "ON_HOLD")
  }
  return results
}
