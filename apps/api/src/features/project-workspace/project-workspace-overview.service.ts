import { Prisma, type ProjectStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireDepartmentHead } from "../request-inbox/request-inbox.service.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { readPreferences } from "../auth/settings.service.js"
import type { ProjectTaskStatus } from "./templates.js"

const projectStatuses: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]

const taskStatuses: ProjectTaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE"]

type ClientCount = { id: string; name: string; projectCount: number }

type JsonOverviewRow = {
  totalTasks: number
  completedTasks: number
  outstandingTasks: number
  upcomingCount: number
  overdueCount: number
  projectsWithTasks: number
  projectsWithoutTasks: number
  workspaceProgress: Prisma.JsonValue
  upcomingDeadlines: Prisma.JsonValue
  overdueTaskList: Prisma.JsonValue
}

type JsonRecord = Prisma.JsonObject

function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10)
}

function jsonRecords(value: Prisma.JsonValue): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is JsonRecord =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  )
}

function stringField(record: JsonRecord, field: string) {
  const value = record[field]
  return typeof value === "string" ? value : undefined
}

function countField(record: JsonRecord, field: string) {
  const value = record[field]
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0
}

function readTaskRows(value: Prisma.JsonValue) {
  return jsonRecords(value).flatMap((record) => {
    const id = stringField(record, "id")
    const title = stringField(record, "title")
    const projectId = stringField(record, "projectId")
    const projectName = stringField(record, "projectName")
    const dueDate = stringField(record, "dueDate")
    const status = stringField(record, "status")
    if (
      !id ||
      !title ||
      !projectId ||
      !projectName ||
      !dueDate ||
      !taskStatuses.includes(status as ProjectTaskStatus)
    )
      return []
    return [
      {
        id,
        title,
        projectId,
        projectName,
        dueDate,
        status: status as ProjectTaskStatus,
      },
    ]
  })
}

function progressRows(value: Prisma.JsonValue) {
  return jsonRecords(value).flatMap((record) => {
    const identity = stringField(record, "identity")
    const kind = stringField(record, "kind")
    const name = stringField(record, "name")
    if (
      !identity ||
      !name ||
      (kind !== "group" && kind !== "ungrouped-project")
    )
      return []
    return [
      {
        identity,
        kind,
        name,
        projectCount: countField(record, "projectCount"),
        completedTasks: countField(record, "completedTasks"),
        totalTasks: countField(record, "totalTasks"),
      },
    ]
  })
}

export async function getProjectWorkspaceOverview(userId: string) {
  const prisma = getPrisma()!
  return prisma.$transaction(
    async (tx) => {
      const [department, user] = await Promise.all([
        requireDepartmentHead(userId, {
          client: tx,
          message: "Only department heads can view project analytics",
        }),
        tx.user.findUnique({
          where: { id: userId },
          select: { settings: true },
        }),
      ])
      if (!user)
        throw new ServiceRequestsError(
          403,
          "Department head access is required",
        )

      const today = dateKeyInTimeZone(
        new Date(),
        readPreferences(user.settings).timeZone,
      )
      const lastUpcomingDate = addDays(today, 14)
      const projectWhere: Prisma.ProjectWhereInput = {
        request: { acceptedDepartmentId: department.id },
      }
      const [statusRows, groupRows, clientRows, taskRows] = await Promise.all([
        tx.project.groupBy({
          by: ["status"],
          where: projectWhere,
          _count: { _all: true },
        }),
        tx.$queryRaw<{ count: number }[]>`
          SELECT COUNT(DISTINCT p."workspaceGroupId")::int AS count
          FROM "Project" p
          JOIN "ServiceRequest" r ON r."id" = p."requestId"
          WHERE r."acceptedDepartmentId" = ${department.id}
            AND p."workspaceGroupId" IS NOT NULL
        `,
        tx.$queryRaw<ClientCount[]>`
          WITH authorized_projects AS (
            SELECT p."clientId" AS client_id, c."fullName" AS client_name
            FROM "Project" p
            JOIN "ServiceRequest" r ON r."id" = p."requestId"
            LEFT JOIN "User" c ON c."id" = p."clientId"
            WHERE r."acceptedDepartmentId" = ${department.id}
          ),
          client_counts AS (
            SELECT
              COALESCE(client_id, 'unassigned') AS id,
              COALESCE(NULLIF(client_name, ''), 'Unassigned client') AS name,
              COUNT(*)::int AS project_count
            FROM authorized_projects
            GROUP BY client_id, client_name
          ),
          ranked_clients AS (
            SELECT
              id,
              name,
              project_count,
              ROW_NUMBER() OVER (
                ORDER BY project_count DESC, name ASC, id ASC
              ) AS rank
            FROM client_counts
          )
          SELECT id, name, project_count AS "projectCount"
          FROM ranked_clients
          WHERE rank <= 7
          UNION ALL
          SELECT
            'other-clients' AS id,
            'Other clients' AS name,
            SUM(project_count)::int AS "projectCount"
          FROM ranked_clients
          WHERE rank > 7
          HAVING SUM(project_count) > 0
          ORDER BY "projectCount" DESC, name ASC
        `,
        tx.$queryRaw<JsonOverviewRow[]>`
          WITH authorized_projects AS (
            SELECT
              p."id",
              p."name",
              p."workspaceGroupId",
              p."workPlan",
              g."name" AS group_name
            FROM "Project" p
            JOIN "ServiceRequest" r ON r."id" = p."requestId"
            LEFT JOIN "ProjectWorkspaceGroup" g
              ON g."id" = p."workspaceGroupId"
            WHERE r."acceptedDepartmentId" = ${department.id}
          ),
          valid_plans AS (
            SELECT p.*
            FROM authorized_projects p
            WHERE jsonb_typeof(p."workPlan") = 'object'
              AND jsonb_typeof(p."workPlan"->'phases') = 'array'
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(p."workPlan"->'phases') = 'array'
                      THEN p."workPlan"->'phases'
                    ELSE '[]'::jsonb
                  END
                ) AS phase(value)
                WHERE jsonb_typeof(phase.value) <> 'object'
                  OR jsonb_typeof(phase.value->'id') <> 'string'
                  OR jsonb_typeof(phase.value->'title') <> 'string'
                  OR jsonb_typeof(phase.value->'tasks') <> 'array'
                  OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(
                      CASE
                        WHEN jsonb_typeof(phase.value->'tasks') = 'array'
                          THEN phase.value->'tasks'
                        ELSE '[]'::jsonb
                      END
                    ) AS task(value)
                    WHERE jsonb_typeof(task.value) <> 'object'
                      OR jsonb_typeof(task.value->'id') <> 'string'
                      OR jsonb_typeof(task.value->'title') <> 'string'
                      OR jsonb_typeof(task.value->'role') <> 'string'
                      OR COALESCE(task.value->>'status', '') NOT IN (
                        'NOT_STARTED', 'IN_PROGRESS', 'DONE'
                      )
                  )
              )
          ),
          tasks AS (
            SELECT
              p."id" AS project_id,
              p."name" AS project_name,
              p."workspaceGroupId" AS workspace_group_id,
              task.value->>'id' AS task_id,
              task.value->>'title' AS task_title,
              task.value->>'status' AS task_status,
              CASE
                WHEN task.value->>'dueDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  AND SUBSTRING(task.value->>'dueDate', 1, 4) BETWEEN '0001' AND '9999'
                  AND SUBSTRING(task.value->>'dueDate', 6, 2) BETWEEN '01' AND '12'
                  AND SUBSTRING(task.value->>'dueDate', 9, 2) BETWEEN '01' AND '31'
                THEN CASE
                  WHEN TO_CHAR(
                    TO_DATE(task.value->>'dueDate', 'YYYY-MM-DD'),
                    'YYYY-MM-DD'
                  ) = task.value->>'dueDate'
                    THEN task.value->>'dueDate'
                  ELSE NULL
                END
                ELSE NULL
              END AS due_date
            FROM valid_plans p
            CROSS JOIN LATERAL jsonb_array_elements(p."workPlan"->'phases') AS phase(value)
            CROSS JOIN LATERAL jsonb_array_elements(phase.value->'tasks') AS task(value)
          ),
          task_metrics AS (
            SELECT
              COUNT(*)::int AS total_tasks,
              COUNT(*) FILTER (WHERE task_status = 'DONE')::int AS completed_tasks,
              COUNT(*) FILTER (WHERE task_status <> 'DONE')::int AS outstanding_tasks,
              COUNT(*) FILTER (
                WHERE task_status <> 'DONE'
                  AND due_date >= ${today}
                  AND due_date <= ${lastUpcomingDate}
              )::int AS upcoming_count,
              COUNT(*) FILTER (
                WHERE task_status <> 'DONE' AND due_date < ${today}
              )::int AS overdue_count
            FROM tasks
          ),
          project_task_counts AS (
            SELECT
              project_id,
              COUNT(*)::int AS total_tasks,
              COUNT(*) FILTER (WHERE task_status = 'DONE')::int AS completed_tasks
            FROM tasks
            GROUP BY project_id
          ),
          workspace_progress AS (
            SELECT
              'group'::text AS kind,
              'group:' || p."workspaceGroupId" AS identity,
              COALESCE(p.group_name, 'Workspace') AS name,
              COUNT(*)::int AS project_count,
              COALESCE(SUM(pt.completed_tasks), 0)::int AS completed_tasks,
              COALESCE(SUM(pt.total_tasks), 0)::int AS total_tasks
            FROM authorized_projects p
            LEFT JOIN project_task_counts pt ON pt.project_id = p."id"
            WHERE p."workspaceGroupId" IS NOT NULL
            GROUP BY p."workspaceGroupId", p.group_name
            UNION ALL
            SELECT
              'ungrouped-project'::text AS kind,
              'ungrouped-project:' || p."id" AS identity,
              p."name" AS name,
              1::int AS project_count,
              COALESCE(pt.completed_tasks, 0)::int AS completed_tasks,
              COALESCE(pt.total_tasks, 0)::int AS total_tasks
            FROM authorized_projects p
            LEFT JOIN project_task_counts pt ON pt.project_id = p."id"
            WHERE p."workspaceGroupId" IS NULL
          )
          SELECT
            metrics.total_tasks AS "totalTasks",
            metrics.completed_tasks AS "completedTasks",
            metrics.outstanding_tasks AS "outstandingTasks",
            metrics.upcoming_count AS "upcomingCount",
            metrics.overdue_count AS "overdueCount",
            (SELECT COUNT(*)::int FROM project_task_counts) AS "projectsWithTasks",
            (
              (SELECT COUNT(*)::int FROM authorized_projects) -
              (SELECT COUNT(*)::int FROM project_task_counts)
            ) AS "projectsWithoutTasks",
            COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'identity', visible.identity,
                    'kind', visible.kind,
                    'name', visible.name,
                    'projectCount', visible.project_count,
                    'completedTasks', visible.completed_tasks,
                    'totalTasks', visible.total_tasks
                  )
                  ORDER BY visible.priority, visible.completion, visible.name, visible.identity
                )
                FROM (
                  SELECT
                    *,
                    CASE WHEN total_tasks = 0 THEN 1 ELSE 0 END AS priority,
                    CASE WHEN total_tasks = 0 THEN 0
                      ELSE completed_tasks::numeric / total_tasks
                    END AS completion
                  FROM workspace_progress
                  ORDER BY priority, completion, name, identity
                  LIMIT 8
                ) visible
              ),
              '[]'::jsonb
            ) AS "workspaceProgress",
            COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', visible.task_id,
                    'title', visible.task_title,
                    'projectId', visible.project_id,
                    'projectName', visible.project_name,
                    'dueDate', visible.due_date,
                    'status', visible.task_status
                  )
                  ORDER BY visible.due_date, visible.task_title, visible.project_name
                )
                FROM (
                  SELECT *
                  FROM tasks
                  WHERE task_status <> 'DONE'
                    AND due_date >= ${today}
                    AND due_date <= ${lastUpcomingDate}
                  ORDER BY due_date, task_title, project_name, task_id
                  LIMIT 8
                ) visible
              ),
              '[]'::jsonb
            ) AS "upcomingDeadlines",
            COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', visible.task_id,
                    'title', visible.task_title,
                    'projectId', visible.project_id,
                    'projectName', visible.project_name,
                    'dueDate', visible.due_date,
                    'status', visible.task_status
                  )
                  ORDER BY visible.due_date DESC, visible.task_title, visible.project_name
                )
                FROM (
                  SELECT *
                  FROM tasks
                  WHERE task_status <> 'DONE' AND due_date < ${today}
                  ORDER BY due_date DESC, task_title, project_name, task_id
                  LIMIT 8
                ) visible
              ),
              '[]'::jsonb
            ) AS "overdueTaskList"
          FROM task_metrics metrics
        `,
      ])

      const statusCounts = new Map(
        statusRows.map(({ status, _count }) => [status, _count._all]),
      )
      const statusDistribution = projectStatuses.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0,
      }))
      const totalProjects = statusDistribution.reduce(
        (sum, row) => sum + row.count,
        0,
      )
      const taskSummary = taskRows[0]
      const emptyJson: Prisma.JsonValue = []

      return {
        totals: {
          totalProjects,
          inProgress: statusCounts.get("IN_PROGRESS") ?? 0,
          completed: statusCounts.get("COMPLETED") ?? 0,
          onHold: statusCounts.get("ON_HOLD") ?? 0,
          planned: statusCounts.get("PLANNED") ?? 0,
          cancelled: statusCounts.get("CANCELLED") ?? 0,
          workspaceGroups: groupRows[0]?.count ?? 0,
          projectsWithTasks: taskSummary?.projectsWithTasks ?? 0,
          projectsWithoutTasks:
            taskSummary?.projectsWithoutTasks ?? totalProjects,
          totalTasks: taskSummary?.totalTasks ?? 0,
          completedTasks: taskSummary?.completedTasks ?? 0,
          outstandingTasks: taskSummary?.outstandingTasks ?? 0,
          upcomingTasks: taskSummary?.upcomingCount ?? 0,
          overdueTasks: taskSummary?.overdueCount ?? 0,
        },
        statusDistribution,
        clientDistribution: clientRows,
        workspaceProgress: progressRows(
          taskSummary?.workspaceProgress ?? emptyJson,
        ),
        upcomingDeadlines: readTaskRows(
          taskSummary?.upcomingDeadlines ?? emptyJson,
        ),
        overdueTaskList: readTaskRows(
          taskSummary?.overdueTaskList ?? emptyJson,
        ),
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  )
}
