import { isDeepStrictEqual } from "node:util"
import { getPrisma } from "../../src/lib/db.js"
import { submitServiceRequest } from "../../src/features/service-requests/service-requests.service.js"
import { acceptInboxRequest } from "../../src/features/request-inbox/request-inbox.service.js"
import { actOnWorkflow } from "../../src/features/request-workflow/workflow.service.js"
import {
  getProjectWorkspace,
  assignProjectTeamLead,
  mutateKanbanColumn,
  saveProjectPlan,
  updateProjectTask,
} from "../../src/features/project-workspace/project-workspace.service.js"
import { projectWorkspaceIdentity } from "../../src/features/project-workspace/workspace-identity.js"
import type { ProjectWorkPlan } from "../../src/features/project-workspace/templates.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"

const groups = [
  {
    title: "Discovery & Strategy",
    tasks: [
      "Review the client brief",
      "Research target audiences",
      "Analyze competitor campaigns",
      "Define campaign objectives",
      "Approve the campaign strategy",
    ],
  },
  {
    title: "Creative Development",
    tasks: [
      "Develop creative concepts",
      "Prepare the visual direction",
      "Draft advertising copy",
      "Design campaign creatives",
      "Review brand consistency",
    ],
  },
  {
    title: "Campaign Execution",
    tasks: [
      "Configure campaign accounts",
      "Prepare tracking requirements",
      "Review the landing page",
      "Confirm campaign placements",
      "Launch the campaign",
    ],
  },
  {
    title: "Monitoring & Optimization",
    tasks: [
      "Review early performance",
      "Monitor audience engagement",
      "Review budget pacing",
      "Evaluate conversion quality",
      "Refine audience segments",
    ],
  },
  {
    title: "Reporting & Handover",
    tasks: [
      "Compile campaign performance",
      "Review campaign results",
      "Prepare final deliverables",
      "Conduct client handover",
    ],
  },
] as const
const deliverables = [
  "Campaign strategy document",
  "Audience research report",
  "Creative concept presentation",
  "Advertising visual assets",
  "Campaign copy document",
  "Performance and handover report",
]

export function featuredShowcasePlan(
  staff: string[],
  startDate: Date,
): ProjectWorkPlan {
  if (staff.length !== 6 || new Set(staff).size !== 6)
    throw new Error("Six distinct showcase staff are required")
  let offset = 0
  return {
    phases: groups.map((phase, phaseIndex) => ({
      id: showcaseUuid("featured-phase", phaseIndex),
      title: phase.title,
      tasks: phase.tasks.map((title, taskIndex) => {
        const index = offset++
        const status =
          index < 14 ? "DONE" : index < 21 ? "IN_PROGRESS" : "NOT_STARTED"
        const due = new Date(startDate.getTime() + (index - 13) * 86400000)
          .toISOString()
          .slice(0, 10)
        return {
          id: showcaseUuid(`featured-task-${phaseIndex}`, taskIndex),
          title,
          role: "Project team",
          status,
          employeeId: staff[index % staff.length],
          ...(index >= 14 ? { dueDate: due } : {}),
        }
      }),
    })),
  }
}

/** Creates one new fictional project using the application's existing lifecycle. */
export async function seedFeaturedShowcase(headId: string) {
  const target = assertPhase2Target(process.env)
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  const databaseClient = prisma
  await prisma.$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (current?.name !== target.database)
      throw new Error("Connected database does not match confirmed target")
    await assertShowcaseRealtimeDisabled(tx)
  })
  const dept = await prisma.department.findFirst({
    where: {
      headId,
      head: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    select: { id: true },
  })
  if (!dept) throw new Error("An active department head is required")
  const staff = Array.from({ length: 6 }, (_, index) =>
    showcaseId("employee", index),
  )
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: staff },
      departmentId: dept.id,
      status: "ACTIVE",
      user: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    select: { id: true, user: { select: { id: true, email: true } } },
  })
  if (
    employees.length !== staff.length ||
    employees.some((employee) => {
      const index = staff.indexOf(employee.id)
      return (
        employee.user?.id !== showcaseId("user", index + 2) ||
        employee.user.email !== `team${index + 1}@showcase.invalid`
      )
    })
  )
    throw new Error("Six active showcase staff in the department are required")
  const service = await prisma.service.findUnique({
    where: { name: "Showcase Retail Brand Design" },
    include: { departments: true, packages: true },
  })
  if (
    !service ||
    !service.isActive ||
    service.requiresConsultation ||
    service.requiresAgreement ||
    service.requiresPayment ||
    service.requiresQuotationApproval ||
    service.packages.length ||
    service.departments.length !== 1 ||
    service.departments[0].id !== dept.id
  )
    throw new Error("The showcase service has unexpected configuration")
  const clientId = showcaseId("user", 22)
  const client = await prisma.user.findFirst({
    where: {
      id: clientId,
      email: "client1@showcase.invalid",
      role: "USER",
      isActive: true,
      accountDeletedAt: null,
    },
    select: { id: true },
  })
  if (!client) throw new Error("The expected fictional client is unavailable")
  const receipt = await submitServiceRequest(clientId, {
    serviceId: service.id,
    packageId: null,
    preferredSpecialistId: null,
    submissionKey: showcaseUuid("featured-request", 0),
    goals: "Plan a coordinated digital brand launch.",
    requirements:
      "Research audiences, develop campaign creative, launch advertising, monitor results, and provide a client handover.",
    expectedTimeline: "Six weeks",
    additionalDetails: "Fictional local showcase project.",
  })
  let request = await prisma.serviceRequest.findUniqueOrThrow({
    where: { id: receipt.id },
    include: { workflow: true },
  })
  if (!request.workflow) {
    await acceptInboxRequest(headId, request.id)
    request = await prisma.serviceRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: { workflow: true },
    })
  }
  async function action(
    actor: string,
    step: number,
    body: Record<string, unknown>,
  ) {
    const workflow = await databaseClient.requestWorkflow.findUniqueOrThrow({
      where: { requestId: request.id },
    })
    await actOnWorkflow(actor, request.id, {
      actionId: showcaseUuid("featured-action", step),
      expectedVersion: workflow.version,
      ...body,
    })
  }
  if (request.workflow?.state === "CONSULTATION")
    await action(headId, 0, {
      type: "CREATE_QUOTATION",
      scope:
        "Plan and execute a coordinated digital brand launch, including audience research, creative development, campaign monitoring and reporting.",
      deliverables,
      lineItems: [
        {
          description: "Brand launch delivery",
          quantity: 1,
          unitPrice: "45000.00",
        },
      ],
      currency: "PHP",
      timeline: "Six weeks",
      paymentTerms:
        "No commencement payment required for this fictional engagement.",
      paymentDue: "0.00",
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
  let workflow = await prisma.requestWorkflow.findUniqueOrThrow({
    where: { requestId: request.id },
  })
  if (workflow.state === "CLIENT_APPROVAL") {
    const quote = await prisma.workflowQuotation.findFirstOrThrow({
      where: { requestId: request.id },
      orderBy: { version: "desc" },
    })
    await action(clientId, 1, {
      type: "RESPOND_QUOTATION",
      quotationId: quote.id,
      decision: "ACCEPT",
      note: "Approved for the showcase project.",
    })
  }
  workflow = await prisma.requestWorkflow.findUniqueOrThrow({
    where: { requestId: request.id },
  })
  if (workflow.state === "READY_FOR_ACTIVATION") {
    await action(headId, 2, { type: "STAFF_PROJECT", employeeIds: staff })
    await action(headId, 3, {
      type: "ACTIVATE_PROJECT",
      projectName: "Avelora Retail — Brand Launch Campaign",
    })
  }
  workflow = await prisma.requestWorkflow.findUniqueOrThrow({
    where: { requestId: request.id },
  })
  if (workflow.state !== "ACTIVE_PROJECT")
    throw new Error(`Unexpected workflow state: ${workflow.state}`)
  const project = await prisma.project.findUniqueOrThrow({
    where: { requestId: request.id },
    include: { staff: true },
  })
  if (
    project.status !== "IN_PROGRESS" ||
    !project.startDate ||
    project.clientId !== clientId ||
    project.staff.length !== staff.length ||
    project.staff.some((member) => !staff.includes(member.employeeId))
  )
    throw new Error(
      "Featured project does not match the expected showcase ownership and staffing",
    )
  const plan = featuredShowcasePlan(staff, project.startDate)
  const workspaceId = projectWorkspaceIdentity(project)
  let workspace = await getProjectWorkspace(headId, workspaceId)
  if (workspace.kanbanColumns.some((column) => column.name !== "In review"))
    throw new Error("Workspace contains unrelated columns")
  if (project.workPlan === null)
    await saveProjectPlan(headId, workspaceId, project.id, {
      plan,
      expectedUpdatedAt: project.updatedAt.toISOString(),
    })
  else if (!isDeepStrictEqual(project.workPlan, plan))
    throw new Error("Featured plan was modified; refusing to overwrite it")
  workspace = await getProjectWorkspace(headId, workspaceId)
  let review = workspace.kanbanColumns.find(
    (column) => column.name === "In review",
  )
  if (!review) {
    if (project.workPlan !== null)
      throw new Error(
        "The review column is missing; refusing to recreate it in an existing plan",
      )
    workspace = await mutateKanbanColumn(headId, workspaceId, "create", null, {
      name: "In review",
      afterColumnId: "IN_PROGRESS",
    })
    review = workspace.kanbanColumns.find(
      (column) => column.name === "In review",
    )
  }
  if (!review) throw new Error("Could not create the In review column")
  const reviewTasks = plan.phases.flatMap((phase) => phase.tasks).slice(18, 21)
  if (
    workspace.kanbanAssignments.some(
      (assignment) =>
        assignment.projectId !== project.id ||
        !reviewTasks.some((task) => task.id === assignment.taskId) ||
        assignment.columnId !== review!.id,
    )
  )
    throw new Error(
      "Featured board has unrelated changes; refusing to overwrite them",
    )
  for (const task of reviewTasks)
    if (
      !workspace.kanbanAssignments.some(
        (entry) => entry.projectId === project.id && entry.taskId === task.id,
      )
    ) {
      const previousPlacement = await prisma.workflowEvent.findFirst({
        where: {
          requestId: request.id,
          type: "WORKSPACE_TASK_UPDATED",
          summary: `Updated “${task.title}” to in progress.`,
        },
        select: { id: true },
      })
      if (previousPlacement)
        throw new Error(
          "A showcase task was moved; refusing to restore its prior column",
        )
      workspace = await updateProjectTask(
        headId,
        workspaceId,
        project.id,
        task.id,
        "IN_PROGRESS",
        review.id,
      )
    }
  if (!project.staff.some((member) => member.isTeamLead))
    await assignProjectTeamLead(headId, workspaceId, project.id, staff[0])
  return { workspaceId, projectId: project.id, requestId: request.id }
}
