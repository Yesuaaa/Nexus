import { Prisma, type ProjectStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { validProjectWorkPlansCte } from "../project-workspace/overview-query.js"

const projectStatuses: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]

type DepartmentAggregateRow = {
  departmentId: string | null
  departmentName: string
  projectCount: number
  planned: number
  inProgress: number
  onHold: number
  completed: number
  cancelled: number
  projectsWithTasks: number
  projectsWithoutTasks: number
  totalTasks: number
  completedTasks: number
}

type WorkloadSummaryRow = {
  activeProjects: number
  activeProjectsWithoutLead: number
  activeProjectsWithoutTeam: number
  activeAssignments: number
}

type StaffAssignmentRow = {
  employeeId: string
  fullName: string
  departmentName: string | null
  activeProjects: number
  leadProjects: number
}

/** Company-wide read-only metrics, protected by the controller permission. */
export async function getProjectManagementOverview() {
  const prisma = getPrisma()!

  return prisma.$transaction(
    async (tx) => {
      // Interactive transactions share one connection, so issue reads in order.
      const statusRows = await tx.project.groupBy({
        by: ["status"],
        _count: { _all: true },
      })
      const workspaceGroups = await tx.projectWorkspaceGroup.count()
      const departmentRows = await tx.$queryRaw<DepartmentAggregateRow[]>`
            WITH authorized_projects AS (
              SELECT
                p."id",
                p."status",
                p."workPlan",
                r."acceptedDepartmentId" AS department_id
              FROM "Project" p
              LEFT JOIN "ServiceRequest" r ON r."id" = p."requestId"
            ),
            ${validProjectWorkPlansCte},
            tasks AS (
              SELECT
                p."id" AS project_id,
                task.value->>'status' AS task_status
              FROM authorized_projects p
              JOIN valid_plans plan ON plan."id" = p."id"
              CROSS JOIN LATERAL jsonb_array_elements(plan."workPlan"->'phases') AS phase(value)
              CROSS JOIN LATERAL jsonb_array_elements(phase.value->'tasks') AS task(value)
            ),
            project_task_counts AS (
              SELECT
                project_id,
                COUNT(*)::int AS total_tasks,
                COUNT(*) FILTER (WHERE task_status = 'DONE')::int AS completed_tasks
              FROM tasks
              GROUP BY project_id
            )
            SELECT
              p.department_id AS "departmentId",
              COALESCE(d."name", 'Unassigned department') AS "departmentName",
              COUNT(*)::int AS "projectCount",
              COUNT(*) FILTER (WHERE p."status" = 'PLANNED')::int AS planned,
              COUNT(*) FILTER (WHERE p."status" = 'IN_PROGRESS')::int AS "inProgress",
              COUNT(*) FILTER (WHERE p."status" = 'ON_HOLD')::int AS "onHold",
              COUNT(*) FILTER (WHERE p."status" = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE p."status" = 'CANCELLED')::int AS cancelled,
              COUNT(pt.project_id)::int AS "projectsWithTasks",
              (COUNT(*) - COUNT(pt.project_id))::int AS "projectsWithoutTasks",
              COALESCE(SUM(pt.total_tasks), 0)::int AS "totalTasks",
              COALESCE(SUM(pt.completed_tasks), 0)::int AS "completedTasks"
            FROM authorized_projects p
            LEFT JOIN "Department" d ON d."id" = p.department_id
            LEFT JOIN project_task_counts pt ON pt.project_id = p."id"
            GROUP BY p.department_id, d."name"
            ORDER BY "projectCount" DESC, "departmentName" ASC
          `
      const workloadRows = await tx.$queryRaw<WorkloadSummaryRow[]>`
            WITH active_projects AS (
              SELECT p."id"
              FROM "Project" p
              WHERE p."status" IN ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
            ),
            assignment_counts AS (
              SELECT
                p."id",
                COUNT(ps."id")::int AS team_size,
                COUNT(ps."id") FILTER (WHERE ps."isTeamLead")::int AS lead_count
              FROM active_projects p
              LEFT JOIN "ProjectStaff" ps ON ps."projectId" = p."id"
              GROUP BY p."id"
            )
            SELECT
              COUNT(*)::int AS "activeProjects",
              COUNT(*) FILTER (WHERE lead_count = 0)::int AS "activeProjectsWithoutLead",
              COUNT(*) FILTER (WHERE team_size = 0)::int AS "activeProjectsWithoutTeam",
              (
                SELECT COUNT(*)::int
                FROM "ProjectStaff" ps
                JOIN "Project" p ON p."id" = ps."projectId"
                WHERE p."status" IN ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
              ) AS "activeAssignments"
            FROM assignment_counts
          `
      const staffRows = await tx.$queryRaw<StaffAssignmentRow[]>`
            SELECT
              e."id" AS "employeeId",
              e."fullName",
              d."name" AS "departmentName",
              COUNT(DISTINCT p."id")::int AS "activeProjects",
              COUNT(DISTINCT p."id") FILTER (WHERE ps."isTeamLead")::int AS "leadProjects"
            FROM "ProjectStaff" ps
            JOIN "Project" p ON p."id" = ps."projectId"
            JOIN "Employee" e ON e."id" = ps."employeeId"
            LEFT JOIN "Department" d ON d."id" = e."departmentId"
            WHERE p."status" IN ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
            GROUP BY e."id", e."fullName", d."name"
            ORDER BY "activeProjects" DESC, e."fullName" ASC, e."id" ASC
            LIMIT 6
          `
      const recentProjects = await tx.project.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          workspaceGroupId: true,
          request: {
            select: {
              acceptedDepartmentId: true,
              acceptedDepartment: { select: { name: true } },
            },
          },
        },
      })

      const statusCounts = new Map(
        statusRows.map(({ status, _count }) => [status, _count._all]),
      )
      const statusDistribution = projectStatuses.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0,
      }))
      const totalProjects = statusDistribution.reduce(
        (sum, item) => sum + item.count,
        0,
      )
      const departmentsWithProjects = departmentRows.filter(
        (row) => row.departmentId !== null,
      ).length
      const unassignedDepartment = departmentRows.find(
        (row) => row.departmentId === null,
      )

      return {
        totals: {
          totalProjects,
          planned: statusCounts.get("PLANNED") ?? 0,
          inProgress: statusCounts.get("IN_PROGRESS") ?? 0,
          onHold: statusCounts.get("ON_HOLD") ?? 0,
          completed: statusCounts.get("COMPLETED") ?? 0,
          cancelled: statusCounts.get("CANCELLED") ?? 0,
          workspaceGroups,
          departmentsWithProjects,
          projectsWithoutDepartment: unassignedDepartment?.projectCount ?? 0,
          projectsWithTasks: departmentRows.reduce(
            (sum, row) => sum + row.projectsWithTasks,
            0,
          ),
          projectsWithoutTasks: departmentRows.reduce(
            (sum, row) => sum + row.projectsWithoutTasks,
            0,
          ),
          totalTasks: departmentRows.reduce(
            (sum, row) => sum + row.totalTasks,
            0,
          ),
          completedTasks: departmentRows.reduce(
            (sum, row) => sum + row.completedTasks,
            0,
          ),
          activeProjects: workloadRows[0]?.activeProjects ?? 0,
          activeProjectsWithoutLead:
            workloadRows[0]?.activeProjectsWithoutLead ?? 0,
          activeProjectsWithoutTeam:
            workloadRows[0]?.activeProjectsWithoutTeam ?? 0,
          activeAssignments: workloadRows[0]?.activeAssignments ?? 0,
        },
        statusDistribution,
        departments: departmentRows,
        topStaffAssignments: staffRows,
        recentlyUpdatedProjects: recentProjects.map((project) => ({
          id: project.id,
          identity: project.workspaceGroupId
            ? `group:${project.workspaceGroupId}`
            : `ungrouped-project:${project.id}`,
          name: project.name,
          status: project.status,
          updatedAt: project.updatedAt.toISOString(),
          departmentId: project.request?.acceptedDepartmentId ?? null,
          departmentName:
            project.request?.acceptedDepartment?.name ??
            "Unassigned department",
        })),
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  )
}
