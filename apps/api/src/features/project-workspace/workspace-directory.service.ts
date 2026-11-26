import {
  Prisma,
  Role,
  type ProjectStatus,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeAccount } from "../../shared/query/accounts.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { readWorkPlan } from "./templates.js"
import { pageWindow, type Page } from "../../shared/query/pagination.js"
import {
  type StaffContext,
  getStaffContext,
  mixedWorkspaceGroupIds,
  workspaceReadWhere,
} from "./workspace-access.js"
import {
  activityCounts,
  projectInclude,
  workspaceRows,
} from "./workspace-rows.js"

export async function listProjectWorkspaces(
  userId: string,
  options: { sort?: string; limit?: number } = {},
) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const context = await getStaffContext(tx, userId)
      const statusCounts = await tx.project.groupBy({
        by: ["status"],
        where: workspaceReadWhere(context),
        _count: { _all: true },
      })
      const byStatus: Record<ProjectStatus, number> = {
        PLANNED: 0,
        IN_PROGRESS: 0,
        ON_HOLD: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      }
      for (const { status, _count } of statusCounts)
        byStatus[status] = _count._all
      const projectCounts = {
        total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
        byStatus,
      }
      const take = Math.min(Math.max(options.limit ?? 200, 1), 250)
      const projects = await tx.project.findMany({
        where: workspaceReadWhere(context),
        include: projectInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
      })
      const counts = await activityCounts(tx, projects)
      const mixedGroupIds = await mixedWorkspaceGroupIds(
        tx,
        projects.flatMap(({ workspaceGroupId }) =>
          workspaceGroupId ? [workspaceGroupId] : [],
        ),
        context,
      )
      const rows = workspaceRows(projects, counts, context, mixedGroupIds)
      if (options.sort === "most-active")
        rows.sort(
          (left, right) =>
            right.activityCount - left.activityCount ||
            right.updatedAt.getTime() - left.updatedAt.getTime(),
        )
      return {
        workspaces: rows,
        canCreate: context.canCreate,
        projectCounts,
        resultsTruncated: projectCounts.total > projects.length,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

type DirectoryOptions = {
  page: number
  search: string
  departmentId: string
  status: string
  sort: "recent" | "name" | "client" | "projects"
  view: "all" | "active" | "archive"
}

type DirectoryRecord = {
  rowId: string
  id: string
  kind: "group" | "ungrouped-project"
  name: string
  clientName: string | null
  departmentNames: string[]
  statuses: ProjectStatus[]
  projectCount: number
  canManage: boolean
}

type WorkspaceDirectoryAccess =
  | { kind: "company"; canReadDepartments: boolean }
  | { kind: "department-head"; context: StaffContext }

async function workspaceDirectoryAccess(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<WorkspaceDirectoryAccess> {
  const user = await tx.user.findFirst({
    where: { id: userId, ...activeAccount },
    select: {
      id: true,
      role: true,
      isActive: true,
      accountDeletedAt: true,
    },
  })
  if (!user) throw new ServiceRequestsError(403, "Project access is required")

  if (
    (user.role === Role.ADMIN || user.role === Role.SUPERADMIN) &&
    hasAdministrativeCapability(user, AdministrativeCapability.MODULE_ACCESS) &&
    hasAdministrativeCapability(
      user,
      AdministrativeCapability.ORGANIZATION_READ,
    )
  )
    return {
      kind: "company",
      canReadDepartments: hasPermission(user.role, Permission.DEPARTMENTS_READ),
    }

  const context = await getStaffContext(tx, userId)
  if (!context.canCreate)
    throw new ServiceRequestsError(403, "Project directory access is required")
  return { kind: "department-head", context }
}

export async function listWorkspaceDirectory(
  userId: string,
  options: DirectoryOptions,
) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const access = await workspaceDirectoryAccess(tx, userId)
      if (access.kind === "company" && options.departmentId) {
        if (!access.canReadDepartments)
          throw new ServiceRequestsError(403, "Department access is required")
        const department = await tx.department.findUnique({
          where: { id: options.departmentId },
          select: { id: true },
        })
        if (!department)
          throw new ServiceRequestsError(404, "Department not found")
      }
      const headDepartmentId =
        access.kind === "department-head"
          ? access.context.headDepartmentIds[0]
          : null
      const departmentConstraint =
        access.kind === "company"
          ? options.departmentId
            ? Prisma.sql`r."acceptedDepartmentId" = ${options.departmentId}`
            : Prisma.sql`TRUE`
          : Prisma.sql`r."acceptedDepartmentId" = ${headDepartmentId}
              AND (${options.departmentId} = '' OR r."acceptedDepartmentId" = ${options.departmentId})`
      const { skip, take } = pageWindow(options.page)
      const search = `%${options.search.replace(/[\\%_]/g, "\\$&")}%`
      const order = {
        recent: Prisma.sql`"updatedAt" DESC`,
        name: Prisma.sql`lower(name) ASC`,
        client: Prisma.sql`lower("clientName") ASC NULLS LAST`,
        projects: Prisma.sql`"projectCount" DESC`,
      }[options.sort]
      // Aggregate authorized members before filtering or windowing the directory.
      const [result] = await tx.$queryRaw<
        { rows: DirectoryRecord[]; total: number; hasWorkspaces: boolean }[]
      >`
      WITH authorized AS (
        SELECT
          p.id,
          p."workspaceGroupId",
          p.name,
          p.status,
          p."updatedAt",
          p."clientId",
          COALESCE(d.name, 'Unassigned') AS "departmentName"
        FROM "Project" p
        LEFT JOIN "ServiceRequest" r ON r.id = p."requestId"
        LEFT JOIN "Department" d ON d.id = r."acceptedDepartmentId"
        WHERE ${departmentConstraint}
      ), grouped AS (
        SELECT
          CASE WHEN a."workspaceGroupId" IS NULL THEN 'ungrouped-project:' ELSE 'group:' END ||
            COALESCE(a."workspaceGroupId", a.id) AS "rowId",
          COALESCE(a."workspaceGroupId", a.id) AS id,
          CASE WHEN a."workspaceGroupId" IS NULL THEN 'ungrouped-project' ELSE 'group' END AS kind,
          COALESCE(g.name, min(a.name)) AS name,
          string_agg(
            DISTINCT NULLIF(u."fullName", ''),
            ', ' ORDER BY NULLIF(u."fullName", '')
          ) AS "clientName",
          array_agg(DISTINCT a."departmentName" ORDER BY a."departmentName") AS "departmentNames",
          array_agg(DISTINCT a.status ORDER BY a.status) AS statuses,
          count(*)::int AS "projectCount",
          max(a."updatedAt") AS "updatedAt",
          bool_or(a.status NOT IN ('COMPLETED', 'CANCELLED')) AS active,
          bool_or(a.name ILIKE ${search}) AS "projectMatch"
        FROM authorized a
        LEFT JOIN "ProjectWorkspaceGroup" g ON g.id = a."workspaceGroupId"
        LEFT JOIN "User" u ON u.id = a."clientId"
        GROUP BY a."workspaceGroupId", COALESCE(a."workspaceGroupId", a.id), g.name
      ), filtered AS (
        SELECT * FROM grouped
        WHERE (${options.view} = 'all' OR active = ${options.view === "active"})
          AND (${options.status} = '' OR ${options.status} = ANY(statuses::text[]))
          AND (${options.search} = '' OR name ILIKE ${search} OR "clientName" ILIKE ${search} OR "projectMatch")
      )
      SELECT
        (SELECT count(*)::int FROM filtered) AS total,
        EXISTS (SELECT 1 FROM grouped) AS "hasWorkspaces",
        COALESCE((
          SELECT json_agg(to_jsonb(page) - 'ordinal' ORDER BY ordinal) FROM (
            SELECT "rowId", id, kind, name, "clientName", "departmentNames", statuses, "projectCount",
              (${access.kind === "department-head"} AND active) AS "canManage",
              row_number() OVER (ORDER BY ${order}, "rowId") AS ordinal
            FROM filtered
            ORDER BY ${order}, "rowId"
            LIMIT ${take} OFFSET ${skip}
          ) page
        ), '[]'::json) AS rows
    `
      const groupIds = result.rows
        .filter(({ kind }) => kind === "group")
        .map(({ id }) => id)
      const projectIds = result.rows
        .filter(({ kind }) => kind === "ungrouped-project")
        .map(({ id }) => id)
      const projects = await tx.project.findMany({
        where: {
          AND: [
            access.kind === "company" ? {} : workspaceReadWhere(access.context),
            options.departmentId
              ? { request: { acceptedDepartmentId: options.departmentId } }
              : {},
            {
              OR: [
                { workspaceGroupId: { in: groupIds } },
                { id: { in: projectIds }, workspaceGroupId: null },
              ],
            },
          ],
        },
        select: {
          id: true,
          workspaceGroupId: true,
          workPlan: true,
          updatedAt: true,
        },
      })
      const mixed =
        access.kind === "department-head"
          ? await mixedWorkspaceGroupIds(tx, groupIds, access.context)
          : new Set<string>()
      const progressByRow = new Map<
        string,
        { completed: number; total: number; updatedAt: Date }
      >()
      for (const project of projects) {
        const rowId = project.workspaceGroupId
          ? `group:${project.workspaceGroupId}`
          : `ungrouped-project:${project.id}`
        const progress = progressByRow.get(rowId) ?? {
          completed: 0,
          total: 0,
          updatedAt: project.updatedAt,
        }
        for (const phase of readWorkPlan(project.workPlan)?.phases ?? []) {
          progress.total += phase.tasks.length
          progress.completed += phase.tasks.filter(
            ({ status }) => status === "DONE",
          ).length
        }
        if (project.updatedAt > progress.updatedAt)
          progress.updatedAt = project.updatedAt
        progressByRow.set(rowId, progress)
      }
      const rows = result.rows.map((row) => {
        const progress = progressByRow.get(row.rowId)!
        return {
          ...row,
          canRename:
            row.canManage && row.kind === "group" && !mixed.has(row.id),
          updatedAt: progress.updatedAt,
          progress: progress.total
            ? { completed: progress.completed, total: progress.total }
            : null,
        }
      })
      const page = {
        rows,
        total: result.total,
        page: options.page,
        pageSize: take,
      } satisfies Page<(typeof rows)[number]>
      return {
        ...page,
        totalPages: Math.ceil(result.total / take),
        hasWorkspaces: result.hasWorkspaces,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}
