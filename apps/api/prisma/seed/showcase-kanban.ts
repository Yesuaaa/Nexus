import { isDeepStrictEqual } from "node:util"
import { getPrisma } from "../../src/lib/db.js"
import {
  getProjectWorkspace,
  mutateKanbanColumn,
  saveProjectPlan,
  updateProjectTask,
} from "../../src/features/project-workspace/project-workspace.service.js"
import { projectWorkspaceIdentity } from "../../src/features/project-workspace/workspace-identity.js"
import type { ProjectWorkPlan } from "../../src/features/project-workspace/templates.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { showcaseUuid } from "./showcase-plan.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"

const photographyGroups = [
  {
    title: "Creative direction",
    status: "DONE",
    tasks: [
      "Review client creative brief",
      "Finalize photography shot list",
      "Prepare studio equipment",
      "Approve visual direction",
    ],
  },
  {
    title: "Production",
    status: "IN_PROGRESS",
    tasks: [
      "Conduct product photoshoot",
      "Retouch hero product images",
      "Perform background cleanup",
      "Process lifestyle photographs",
      "Prepare product catalog layout",
    ],
  },
  {
    title: "Client revisions",
    status: "IN_PROGRESS",
    tasks: [
      "Adjust product color accuracy",
      "Refine lighting and shadows",
      "Address client composition feedback",
    ],
  },
  {
    title: "Delivery",
    status: "NOT_STARTED",
    tasks: [
      "Prepare final image export presets",
      "Organize product image library",
      "Create social media image variants",
      "Prepare client handover package",
    ],
  },
] as const

const designGroups = [
  {
    title: "Discovery",
    status: "DONE",
    tasks: [
      "Review brand guidelines",
      "Interview the client team",
      "Map the target audience",
      "Approve the creative brief",
    ],
  },
  {
    title: "Design",
    status: "IN_PROGRESS",
    tasks: [
      "Sketch logo concepts",
      "Develop the typography system",
      "Create the color palette",
      "Design social media templates",
      "Prepare brand applications",
    ],
  },
  {
    title: "Client revisions",
    status: "IN_PROGRESS",
    tasks: [
      "Refine the selected logo",
      "Adjust campaign color contrast",
      "Revise the presentation layout",
    ],
  },
  {
    title: "Handover",
    status: "NOT_STARTED",
    tasks: [
      "Export final logo assets",
      "Write brand usage guidelines",
      "Package editable design files",
      "Prepare the client handover",
    ],
  },
] as const

type ShowcaseBoard = "photography" | "design"

export function showcaseBoardPlan(
  kind: ShowcaseBoard,
  employeeIds: string[],
  startDate?: Date,
): ProjectWorkPlan {
  if (
    employeeIds.length < 2 ||
    new Set(employeeIds).size !== employeeIds.length
  )
    throw new Error("At least two distinct project staff are required")
  return {
    phases: (kind === "photography" ? photographyGroups : designGroups).map(
      (group, phaseIndex) => ({
        id: showcaseUuid(`${kind}-phase`, phaseIndex),
        title: group.title,
        tasks: group.tasks.map((title, taskIndex) => ({
          id: showcaseUuid(`${kind}-task-${phaseIndex}`, taskIndex),
          title,
          role: "Project team",
          status: group.status,
          employeeId:
            employeeIds[(phaseIndex + taskIndex) % employeeIds.length],
          ...(startDate
            ? {
                dueDate: new Date(
                  startDate.getTime() +
                    (phaseIndex * 7 + taskIndex + 2) * 86400000,
                )
                  .toISOString()
                  .slice(0, 10),
              }
            : {}),
        })),
      }),
    ),
  }
}

export const photographyShowcasePlan = (employeeIds: string[]) =>
  showcaseBoardPlan("photography", employeeIds)

/** Populate only a new Phase 2 project that was activated by its workflow. */
export async function preparePhotographyShowcaseBoard(
  actorId: string,
  projectId: string,
) {
  return prepareShowcaseBoard(actorId, projectId, "photography")
}

export async function prepareShowcaseBoard(
  actorId: string,
  projectId: string,
  kind: ShowcaseBoard,
) {
  const expectedTarget = assertPhase2Target(process.env)
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  await prisma.$transaction(async (tx) => {
    const [target] = await tx.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`
    if (target?.database !== expectedTarget.database)
      throw new Error(
        "The connected database does not match the confirmed target",
      )
    await assertShowcaseRealtimeDisabled(tx)
  })
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      request: { include: { acceptedDepartment: true, workflow: true } },
      staff: {
        include: { employee: { include: { user: true } } },
        orderBy: { employeeId: "asc" },
      },
    },
  })
  if (
    ![
      showcaseUuid("phase2-request", 0),
      showcaseUuid("phase2-request", 1),
      showcaseUuid("phase2-request", 2),
      showcaseUuid("phase2-request", 3),
    ].includes(project.request?.submissionKey ?? "") ||
    !["IN_PROGRESS", "ON_HOLD"].includes(project.status) ||
    project.request?.workflow?.state !== "ACTIVE_PROJECT" ||
    project.request?.acceptedDepartment?.headId !== actorId
  )
    throw new Error(
      "A workflow-activated Phase 2 project managed by this department head is required",
    )
  const staff = project.staff
    .filter(
      ({ employee }) =>
        employee.status === "ACTIVE" &&
        employee.departmentId === project.request?.acceptedDepartmentId &&
        employee.user?.role === "STAFF" &&
        employee.user.isActive &&
        employee.user.accountDeletedAt === null,
    )
    .map(({ employeeId }) => employeeId)
  if (!project.startDate)
    throw new Error("The active project needs a start date")
  const plan = showcaseBoardPlan(kind, staff, project.startDate)
  const workspaceId = projectWorkspaceIdentity(project)
  let workspace = await getProjectWorkspace(actorId, workspaceId)
  const revisionTaskIds = new Set(plan.phases[2].tasks.map((task) => task.id))
  if (
    workspace.kanbanColumns.some((column) => column.name !== "Revisions") ||
    workspace.kanbanAssignments.some(
      (assignment) =>
        assignment.projectId === projectId &&
        !revisionTaskIds.has(assignment.taskId),
    )
  )
    throw new Error(
      "Workspace contains unrelated Kanban data; refusing to change it",
    )
  if (project.workPlan === null) {
    if (project.status === "ON_HOLD")
      throw new Error("A held showcase plan cannot be initialized")
    await saveProjectPlan(actorId, workspaceId, project.id, {
      plan,
      expectedUpdatedAt: project.updatedAt.toISOString(),
    })
  } else if (!isDeepStrictEqual(project.workPlan, plan)) {
    throw new Error(
      "Project plan is not the expected showcase plan; refusing to overwrite it",
    )
  }
  let revision = workspace.kanbanColumns.find(
    (column) => column.name === "Revisions",
  )
  if (!revision) {
    if (project.status === "ON_HOLD")
      throw new Error("A held showcase board cannot be initialized")
    workspace = await mutateKanbanColumn(actorId, workspaceId, "create", null, {
      name: "Revisions",
      afterColumnId: "IN_PROGRESS",
    })
    revision = workspace.kanbanColumns.find(
      (column) => column.name === "Revisions",
    )
  }
  if (!revision) throw new Error("Could not create the Revisions column")
  const revisionTasks = plan.phases[2].tasks
  for (const task of revisionTasks) {
    const existing = workspace.kanbanAssignments.find(
      (assignment) =>
        assignment.projectId === projectId && assignment.taskId === task.id,
    )
    if (existing && existing.columnId !== revision.id)
      throw new Error(
        "A showcase task was moved to another column; refusing to overwrite it",
      )
    if (!existing && project.status === "ON_HOLD")
      throw new Error(
        "A held showcase board was modified; refusing to restore it",
      )
    if (!existing)
      workspace = await updateProjectTask(
        actorId,
        workspaceId,
        projectId,
        task.id,
        "IN_PROGRESS",
        revision.id,
      )
  }
  return { workspaceId, projectId, tasks: 16, revisions: 3 }
}
