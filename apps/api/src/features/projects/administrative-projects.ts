import { Router } from "express"
import { Prisma, ProjectStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import {
  insensitive,
  paginate,
  parsePage,
} from "../../shared/query/pagination.js"
import { recordIdParam } from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { readWorkPlan } from "../project-workspace/templates.js"
import { renameProjectWorkspaceAdministratively } from "../project-workspace/project-workspace.service.js"

const selection = {
  id: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  createdAt: true,
  updatedAt: true,
  templateKey: true,
  workPlan: true,
  client: { select: { id: true, fullName: true } },
  workspaceGroup: {
    select: {
      id: true,
      name: true,
      structure: true,
      projects: {
        select: {
          status: true,
          request: { select: { workflow: { select: { requestId: true } } } },
        },
      },
    },
  },
  request: {
    select: {
      id: true,
      referenceNumber: true,
      workflow: { select: { requestId: true } },
      service: { select: { name: true } },
      acceptedDepartment: { select: { id: true, name: true } },
    },
  },
  milestones: {
    select: {
      id: true,
      title: true,
      description: true,
      expectedFileType: true,
      updatedAt: true,
      completedAt: true,
      deliveryStatus: true,
      sentToClientAt: true,
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  },
  staff: {
    select: {
      isTeamLead: true,
      approvedAt: true,
      employee: {
        select: { id: true, fullName: true, position: true, status: true },
      },
    },
    orderBy: { employeeId: "asc" },
  },
} satisfies Prisma.ProjectSelect

function administrativeProject(
  project: Prisma.ProjectGetPayload<{ select: typeof selection }>,
  administrativeManagement: boolean,
) {
  const members = project.workspaceGroup?.projects ?? [
    { status: project.status, request: project.request },
  ]
  const rename =
    administrativeManagement &&
    members.length > 0 &&
    members.every((item) => Boolean(item.request?.workflow)) &&
    !members.every((item) => ["COMPLETED", "CANCELLED"].includes(item.status))
  const rawPlan = readWorkPlan(project.workPlan)
  // Persisted JSON is never returned wholesale: strip unrecognized/private fields.
  const plan = rawPlan
    ? {
        phases: rawPlan.phases.map((phase) => ({
          id: phase.id,
          title: phase.title,
          tasks: phase.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            role: task.role,
            status: task.status,
            employeeId:
              typeof task.employeeId === "string" ? task.employeeId : null,
            dueDate: typeof task.dueDate === "string" ? task.dueDate : null,
          })),
        })),
      }
    : null
  const tasks = plan?.phases.flatMap((phase) => phase.tasks) ?? []
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    client: project.client,
    updatedAt: project.updatedAt,
    structure: project.workspaceGroup?.structure ?? "SEPARATE",
    workspaceGroup: project.workspaceGroup
      ? {
          id: project.workspaceGroup.id,
          name: project.workspaceGroup.name,
          structure: project.workspaceGroup.structure,
        }
      : null,
    department: project.request?.acceptedDepartment ?? null,
    activityCount: 0,
    activity: [],
    canCreate: false,
    canManage: false,
    capabilities: {
      read: true,
      manage: false,
      rename,
      approve: false,
      release: false,
      participate: false,
      downloadFiles: false,
    },
    workstreams: [
      {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        requestId: project.request?.id ?? null,
        referenceNumber: project.request?.referenceNumber ?? null,
        serviceName: project.request?.service.name ?? "Custom project",
        workflowState: null,
        startDate: project.startDate,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        templateKey: project.templateKey,
        plan,
        taskCount: tasks.length,
        completedTaskCount: tasks.filter((task) => task.status === "DONE")
          .length,
        milestones: project.milestones.map((milestone) => ({
          ...milestone,
          rejectionReason: null,
          reviewedAt: null,
          workflowFileId: null,
          workflowFile: null,
        })),
        staff: project.staff.map(({ employee, ...assignment }) => ({
          ...employee,
          ...assignment,
          profileSpecialties: [],
        })),
        canAssign: false,
        canUploadDeliverables: false,
      },
    ],
  }
}

export type AdministrativeProject = ReturnType<typeof administrativeProject>

export const administrativeProjectsRouter = Router()
administrativeProjectsRouter.use(requireAuth, (request, _response, next) => {
  const actor = request.auth!.user
  if (
    !hasAdministrativeCapability(
      actor,
      AdministrativeCapability.MODULE_ACCESS,
    ) ||
    !hasAdministrativeCapability(
      actor,
      AdministrativeCapability.ORGANIZATION_READ,
    )
  )
    fail(403, "Organization-wide project read access is required")
  next()
})
administrativeProjectsRouter.get("/", async (request, response) => {
  const {
    page: rawPage,
    search = "",
    status = "",
    departmentId = "",
  } = request.query
  const page = parsePage(rawPage)
  if (
    !page ||
    typeof search !== "string" ||
    search.length > 200 ||
    typeof status !== "string" ||
    (status &&
      !Object.values(ProjectStatus).includes(status as ProjectStatus)) ||
    typeof departmentId !== "string" ||
    departmentId.length > 100
  )
    fail(400, "Invalid project filters")
  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status: status as ProjectStatus } : {}),
    ...(departmentId
      ? { request: { acceptedDepartmentId: departmentId } }
      : {}),
    ...insensitive<Prisma.ProjectWhereInput>(search.trim(), [
      "name",
      (text) => ({ client: { fullName: text } }),
    ]),
  }
  const { rows, ...pagination } = await paginate(page, {
    rows: (db, window) =>
      db.project.findMany({
        where,
        select: selection,
        ...window,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
    count: (db) => db.project.count({ where }),
  })
  const departments = await getPrisma()!.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  response.json({
    projects: rows.map((project) =>
      administrativeProject(
        project,
        hasAdministrativeCapability(
          request.auth!.user,
          AdministrativeCapability.MANAGEMENT,
        ),
      ),
    ),
    departments,
    ...pagination,
  })
})
administrativeProjectsRouter.param("id", recordIdParam("Invalid project ID"))
administrativeProjectsRouter.get("/:id", async (request, response) => {
  const project = await getPrisma()!.project.findUnique({
    where: { id: String(request.params.id) },
    select: selection,
  })
  if (!project) fail(404, "Project not found")
  response.json({
    project: administrativeProject(
      project,
      hasAdministrativeCapability(
        request.auth!.user,
        AdministrativeCapability.MANAGEMENT,
      ),
    ),
  })
})
administrativeProjectsRouter.patch(
  "/:id/workspace-name",
  async (request, response) => {
    if (
      !hasAdministrativeCapability(
        request.auth!.user,
        AdministrativeCapability.MANAGEMENT,
      )
    )
      fail(403, "Administrative project management is required")
    response.json(
      await renameProjectWorkspaceAdministratively(
        request.auth!.user.id,
        String(request.params.id),
        request.body,
      ),
    )
  },
)
