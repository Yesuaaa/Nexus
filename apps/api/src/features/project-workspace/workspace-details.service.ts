import { getPrisma } from "../../lib/db.js"
import { activeAccount } from "../../shared/query/accounts.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { readWorkPlan } from "./templates.js"
import {
  parseWorkspaceIdentity,
  projectWorkspaceIdentity,
} from "./workspace-identity.js"
import {
  activityCounts,
  projectInclude,
  workspaceRows,
} from "./workspace-rows.js"
import {
  activityTypes,
  safeProjectActivitySummary,
} from "./workspace-activity.js"
import {
  getStaffContext,
  mixedWorkspaceGroupIds,
  workspaceReadWhere,
} from "./workspace-access.js"

export async function getAdminProjectManagementWorkspaceDetails(
  userId: string,
  departmentId: string,
  identity: string,
) {
  const { id, kind } = parseWorkspaceIdentity(identity)
  if (!kind) throw new ServiceRequestsError(400, "Use a typed workspace ID")

  return getPrisma()!.$transaction(
    async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: userId, ...activeAccount },
        select: {
          id: true,
          role: true,
          isActive: true,
          accountDeletedAt: true,
        },
      })
      if (
        !actor ||
        !hasAdministrativeCapability(
          actor,
          AdministrativeCapability.MODULE_ACCESS,
        ) ||
        !hasAdministrativeCapability(
          actor,
          AdministrativeCapability.ORGANIZATION_READ,
        ) ||
        !hasPermission(actor.role, Permission.DEPARTMENTS_READ)
      )
        throw new ServiceRequestsError(
          403,
          "Project details access is required",
        )

      const department = await tx.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true,
          name: true,
          head: {
            select: {
              id: true,
              fullName: true,
              email: true,
              position: true,
            },
          },
          _count: { select: { employees: true } },
        },
      })
      if (!department)
        throw new ServiceRequestsError(404, "Department not found")

      const group =
        kind === "group"
          ? await tx.projectWorkspaceGroup.findUnique({
              where: { id },
              select: { id: true, name: true, structure: true },
            })
          : null
      if (kind === "group" && !group)
        throw new ServiceRequestsError(404, "Project workspace not found")

      const projects = await tx.project.findMany({
        where:
          kind === "group"
            ? {
                workspaceGroupId: id,
                request: { acceptedDepartmentId: departmentId },
              }
            : {
                id,
                workspaceGroupId: null,
                request: { acceptedDepartmentId: departmentId },
              },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          client: { select: { id: true, fullName: true } },
          request: {
            select: {
              id: true,
              acceptedDepartment: { select: { id: true, name: true } },
            },
          },
          workspaceGroup: { select: { id: true, name: true } },
          workPlan: true,
          staff: {
            where: { employee: { departmentId } },
            select: {
              isTeamLead: true,
              employee: {
                select: { id: true, fullName: true, position: true },
              },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
      if (!projects.length)
        throw new ServiceRequestsError(404, "Project workspace not found")

      const projectDetails = projects.map((project) => {
        const tasks =
          readWorkPlan(project.workPlan)?.phases.flatMap(
            ({ tasks: phaseTasks }) => phaseTasks,
          ) ?? []
        const completed = tasks.filter(({ status }) => status === "DONE").length
        const team = project.staff
          .map(({ employee, isTeamLead }) => ({
            ...employee,
            isTeamLead,
          }))
          .sort((left, right) => left.fullName.localeCompare(right.fullName))
        const taskDueDates = [
          ...new Set(
            tasks.flatMap(({ dueDate }) =>
              typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
                ? [dueDate]
                : [],
            ),
          ),
        ].sort()
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          client: project.client,
          department: project.request?.acceptedDepartment ?? {
            id: department.id,
            name: department.name,
          },
          workspace: project.workspaceGroup,
          leads: team
            .filter(({ isTeamLead }) => isTeamLead)
            .map(({ id, fullName, position }) => ({ id, fullName, position })),
          team,
          startDate: project.startDate,
          taskDueDates,
          tasks: {
            total: tasks.length,
            completed,
            incomplete: tasks.length - completed,
          },
          progress: tasks.length ? { completed, total: tasks.length } : null,
        }
      })

      const completedTasks = projectDetails.reduce(
        (sum, project) => sum + project.tasks.completed,
        0,
      )
      const totalTasks = projectDetails.reduce(
        (sum, project) => sum + project.tasks.total,
        0,
      )
      const teamMembers = new Map<
        string,
        { id: string; fullName: string; position: string | null }
      >()
      for (const project of projectDetails)
        for (const member of project.team) {
          if (!teamMembers.has(member.id))
            teamMembers.set(member.id, {
              id: member.id,
              fullName: member.fullName,
              position: member.position,
            })
        }
      const clients = new Map(
        projects.map(({ client }) => [client.id, client] as const),
      )
      const requestIds = projects.flatMap(({ request }) =>
        request ? [request.id] : [],
      )
      const events = requestIds.length
        ? await tx.workflowEvent.findMany({
            where: {
              requestId: { in: requestIds },
              type: { in: [...activityTypes] },
            },
            select: {
              id: true,
              type: true,
              summary: true,
              createdAt: true,
              actor: { select: { fullName: true } },
              workflow: {
                select: {
                  request: {
                    select: {
                      project: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 100,
          })
        : []
      const activity = events.flatMap(({ workflow, ...event }) => {
        const project = workflow.request.project
        if (!project) return []
        return [
          {
            id: event.id,
            projectId: project.id,
            projectName: project.name,
            type: event.type,
            summary: safeProjectActivitySummary(event.type, event.summary),
            createdAt: event.createdAt,
            actor: event.actor,
          },
        ]
      })
      const name = group?.name ?? projects[0]!.name
      const statuses = [...new Set(projects.map(({ status }) => status))].sort()
      return {
        identity: `${kind}:${id}`,
        kind,
        id,
        name,
        structure: group?.structure ?? null,
        department: {
          id: department.id,
          name: department.name,
          head: department.head,
          memberCount: department._count.employees,
        },
        clients: [...clients.values()].sort((left, right) =>
          (left.fullName ?? "").localeCompare(right.fullName ?? ""),
        ),
        statuses,
        projectCount: projectDetails.length,
        unplannedProjectCount: projectDetails.filter(
          ({ tasks }) => tasks.total === 0,
        ).length,
        progress: totalTasks
          ? { completed: completedTasks, total: totalTasks }
          : null,
        teamMembers: [...teamMembers.values()].sort((left, right) =>
          left.fullName.localeCompare(right.fullName),
        ),
        projects: projectDetails,
        activity,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function getProjectWorkspace(userId: string, workspaceId: string) {
  const { id, kind } = parseWorkspaceIdentity(workspaceId)
  return getPrisma()!.$transaction(
    async (tx) => {
      const context = await getStaffContext(tx, userId)
      const scope = workspaceReadWhere(context)
      const group =
        kind === "ungrouped-project"
          ? null
          : await tx.projectWorkspaceGroup.findUnique({
              where: { id },
              include: {
                projects: {
                  where: scope,
                  include: projectInclude,
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
            })
      let projects = group?.projects ?? []
      if (!projects.length && kind !== "group") {
        const single = await tx.project.findFirst({
          where: {
            id,
            ...scope,
            ...(kind === "ungrouped-project" ? { workspaceGroupId: null } : {}),
          },
          include: projectInclude,
        })
        if (!single)
          throw new ServiceRequestsError(404, "Project workspace not found")
        projects = [single]
      }
      if (!projects.length)
        throw new ServiceRequestsError(404, "Project workspace not found")
      const counts = await activityCounts(tx, projects)
      const groupId = projects[0].workspaceGroupId
      const mixedGroupIds = await mixedWorkspaceGroupIds(
        tx,
        groupId ? [groupId] : [],
        context,
      )
      const workspace = workspaceRows(
        projects,
        counts,
        context,
        mixedGroupIds,
        true,
      )[0]
      if (kind === "ungrouped-project") workspace.canRename = false
      const projectIds = projects.map(({ id: projectId }) => projectId)
      const milestoneIds = projects.flatMap(({ milestones }) =>
        milestones.map(({ id: milestoneId }) => milestoneId),
      )
      const [notes, changeRequests, submissions] = await Promise.all([
        tx.projectNote.findMany({
          where: { projectId: { in: projectIds } },
          select: {
            id: true,
            projectId: true,
            createdAt: true,
            updatedAt: true,
            createdBy: { select: { id: true, fullName: true } },
            revisions: {
              select: {
                id: true,
                revision: true,
                content: true,
                authorId: true,
                status: true,
                submittedAt: true,
                reviewedAt: true,
                feedback: true,
                escalatedAt: true,
                clientVisible: true,
                publishedAt: true,
                publishedById: true,
                publishedBy: { select: { id: true, fullName: true } },
                supersededAt: true,
                supersededByRevisionId: true,
                supersededByRevision: {
                  select: { id: true, revision: true },
                },
                unpublishedAt: true,
                unpublishedById: true,
                unpublishedBy: { select: { id: true, fullName: true } },
                author: { select: { id: true, fullName: true } },
                reviewedBy: { select: { id: true, fullName: true } },
              },
              orderBy: [{ revision: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        }),
        tx.projectChangeRequest.findMany({
          where: { projectId: { in: projectIds } },
          select: {
            id: true,
            projectId: true,
            kind: true,
            details: true,
            status: true,
            responseNote: true,
            createdAt: true,
            reviewedAt: true,
            requestedBy: { select: { fullName: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        tx.projectDeliverableSubmission.findMany({
          where: { milestoneId: { in: milestoneIds } },
          select: {
            id: true,
            milestoneId: true,
            version: true,
            note: true,
            status: true,
            submittedAt: true,
            submittedById: true,
            submittedBy: { select: { id: true, fullName: true } },
            reviewedAt: true,
            feedback: true,
            escalatedAt: true,
            reviewedBy: { select: { id: true, fullName: true } },
            workflowFile: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                size: true,
                createdAt: true,
              },
            },
          },
          orderBy: [{ version: "desc" }, { id: "desc" }],
        }),
      ])
      const notesByProject = new Map<string, typeof notes>()
      for (const note of notes) {
        const projectNotes = notesByProject.get(note.projectId) ?? []
        projectNotes.push(note)
        notesByProject.set(note.projectId, projectNotes)
      }
      const requestsByProject = new Map<string, typeof changeRequests>()
      for (const changeRequest of changeRequests) {
        const projectRequests =
          requestsByProject.get(changeRequest.projectId) ?? []
        projectRequests.push(changeRequest)
        requestsByProject.set(changeRequest.projectId, projectRequests)
      }
      const submissionsByMilestone = new Map<string, typeof submissions>()
      for (const submission of submissions) {
        const milestoneSubmissions =
          submissionsByMilestone.get(submission.milestoneId) ?? []
        milestoneSubmissions.push(submission)
        submissionsByMilestone.set(submission.milestoneId, milestoneSubmissions)
      }
      const detailedWorkstreams = workspace.workstreams.map((workstream) => ({
        ...workstream,
        notes: notesByProject.get(workstream.id) ?? [],
        changeRequests: requestsByProject.get(workstream.id) ?? [],
        milestones: workstream.milestones.map((milestone) => ({
          ...milestone,
          submissions: submissionsByMilestone.get(milestone.id) ?? [],
        })),
      }))
      const requestIds = projects.flatMap(({ requestId }) =>
        requestId ? [requestId] : [],
      )
      const events = requestIds.length
        ? await tx.workflowEvent.findMany({
            where: {
              requestId: { in: requestIds },
              type: { in: [...activityTypes] },
            },
            select: {
              id: true,
              type: true,
              summary: true,
              createdAt: true,
              actor: { select: { fullName: true } },
              workflow: {
                select: {
                  request: { select: { project: { select: { name: true } } } },
                },
              },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 100,
          })
        : []
      const workspaceKey = projectWorkspaceIdentity(projects[0])
      const columns = await tx.workspaceKanbanColumn.findMany({
        where: { workspaceKey },
        orderBy: { position: "asc" },
      })
      const assignments = await tx.workspaceKanbanAssignment.findMany({
        where: { workspaceKey, projectId: { in: projectIds } },
      })
      return {
        ...workspace,
        workstreams: detailedWorkstreams,
        kanbanColumns: columns.map(({ id, name }) => ({ id, name })),
        kanbanAssignments: assignments.map(
          ({ projectId, taskId, columnId }) => ({
            projectId,
            taskId,
            columnId,
          }),
        ),
        activity: events.map(({ workflow, ...event }) => ({
          ...event,
          summary: safeProjectActivitySummary(event.type, event.summary),
          projectName: workflow.request.project?.name ?? workspace.name,
        })),
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}
