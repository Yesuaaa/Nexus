import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { readWorkPlan } from "../project-workspace/templates.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

type CalendarPerson = { id: string; name: string }
export type CalendarEvent = {
  id: string
  type: "consultation" | "meeting" | "milestone" | "task"
  title: string
  context: string
  startsAt: Date
  endsAt: Date | null
  location: string | null
  staff: string | null
  staffMembers: CalendarPerson[]
  department: CalendarPerson | null
  project: CalendarPerson | null
  pending: boolean
  completed: boolean
  deadline: boolean
  unassigned: boolean
  href: string | null
}

export async function listInternalCalendar(userId: string, scope: unknown) {
  const prisma = getPrisma()!
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, accountDeletedAt: null },
    select: {
      role: true,
      headOf: { select: { id: true } },
      leadOfTeam: { select: { id: true } },
      employee: {
        select: {
          id: true,
          projectAssignments: {
            where: { isTeamLead: true },
            select: { projectId: true },
          },
        },
      },
    },
  })
  if (!user || user.role === "USER")
    throw new ServiceRequestsError(403, "Internal calendar access is required")
  const organization = user.role === "ADMIN" || user.role === "SUPERADMIN"
  if (scope !== undefined && scope !== "mine" && scope !== "team")
    throw new ServiceRequestsError(400, "Choose a valid calendar scope")
  const canViewTeam = Boolean(
    user.headOf || user.leadOfTeam || user.employee?.projectAssignments.length,
  )
  if (!organization && scope === "team" && !canViewTeam)
    throw new ServiceRequestsError(403, "Team calendar access is required")
  const team = scope === "team"
  const membership: Prisma.ProjectWhereInput = {
    staff: { some: { employee: { userId } } },
  }
  const projectScope: Prisma.ProjectWhereInput = organization
    ? {}
    : {
        OR: [
          membership,
          ...(user.headOf
            ? [{ request: { acceptedDepartmentId: user.headOf.id } }]
            : []),
        ],
      }
  const teamScope: Prisma.ProjectWhereInput =
    !organization && team && !user.headOf
      ? {
          OR: [
            { staff: { some: { isTeamLead: true, employee: { userId } } } },
            ...(user.leadOfTeam
              ? [
                  {
                    AND: [
                      membership,
                      {
                        staff: {
                          some: { employee: { teamId: user.leadOfTeam.id } },
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      : {}
  const [consultations, meetings, projects] = await Promise.all([
    prisma.workflowConsultation.findMany({
      where: {
        status: { not: "CANCELLED" },
        workflow: {
          request: {
            status: { not: "CANCELLED" },
            ...(!organization
              ? { acceptedDepartment: { headId: userId } }
              : {}),
          },
        },
      },
      include: {
        workflow: {
          include: {
            request: {
              include: {
                service: { select: { name: true } },
                acceptedDepartment: {
                  select: {
                    id: true,
                    name: true,
                    headId: true,
                    head: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.conversationMeeting.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(!organization
          ? { conversation: { department: { headId: userId } } }
          : {}),
      },
      include: {
        conversation: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                headId: true,
                head: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: {
        AND: [projectScope, teamScope, { status: { not: "CANCELLED" } }],
      },
      include: {
        request: {
          select: { acceptedDepartment: { select: { id: true, name: true } } },
        },
        staff: {
          include: {
            employee: { select: { id: true, userId: true, fullName: true } },
          },
        },
        milestones: { where: { sentToClientAt: { not: null } } },
      },
    }),
  ])
  const events: CalendarEvent[] = []
  for (const item of consultations) {
    const { request } = item.workflow
    const department = request.acceptedDepartment
    const head = department?.head
    const canOpen =
      department?.headId === userId ||
      item.workflow.quotationApproverId === userId ||
      item.workflow.paymentVerifierId === userId
    events.push({
      id: `consultation-${item.id}`,
      type: "consultation",
      title: `${request.service.name} consultation`,
      context: request.referenceNumber ?? request.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      location: canOpen ? item.location : null,
      staff: head?.fullName ?? null,
      staffMembers: head
        ? [{ id: head.id, name: head.fullName ?? "Department head" }]
        : [],
      department: department
        ? { id: department.id, name: department.name }
        : null,
      project: null,
      pending: false,
      completed: item.status === "COMPLETED",
      deadline: false,
      unassigned: !head,
      href: canOpen
        ? `/messages?request=${encodeURIComponent(request.id)}`
        : null,
    })
  }
  for (const item of meetings) {
    const { department } = item.conversation
    const head = department.head
    const canOpen = department.headId === userId
    events.push({
      id: `meeting-${item.id}`,
      type: "meeting",
      title: "Service meeting",
      context: department.name,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      location: canOpen ? item.location : null,
      staff: head?.fullName ?? null,
      staffMembers: head
        ? [{ id: head.id, name: head.fullName ?? "Department head" }]
        : [],
      department: { id: department.id, name: department.name },
      project: null,
      pending: Boolean(item.proposedStartsAt),
      completed: item.status === "COMPLETED",
      deadline: false,
      unassigned: !head,
      href: canOpen
        ? `/messages?request=${encodeURIComponent(item.conversationId)}`
        : null,
    })
  }
  for (const project of projects) {
    const department = project.request?.acceptedDepartment ?? null
    const members = project.staff.flatMap(({ employee }) =>
      employee.userId ? [{ id: employee.userId, name: employee.fullName }] : [],
    )
    // Calendar overview access does not grant access to staff-only workspaces.
    const href = organization
      ? null
      : `/project-workspace/${encodeURIComponent(project.workspaceGroupId ?? project.id)}`
    const common = {
      context: project.name,
      department,
      project: { id: project.id, name: project.name },
      href,
      location: null,
      pending: false,
    }
    for (const task of readWorkPlan(project.workPlan)?.phases.flatMap(
      (phase) => phase.tasks,
    ) ?? []) {
      if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) continue
      const startsAt = new Date(`${task.dueDate}T00:00:00+08:00`)
      if (!Number.isFinite(startsAt.getTime())) continue
      const assignee = project.staff.find(
        ({ employeeId }) => employeeId === task.employeeId,
      )?.employee
      if (!organization && !team && assignee?.userId !== userId) continue
      events.push({
        ...common,
        id: `task-${project.id}-${task.id}`,
        type: "task",
        title: task.title,
        startsAt,
        endsAt: null,
        staff: assignee?.fullName ?? null,
        staffMembers: assignee?.userId
          ? [{ id: assignee.userId, name: assignee.fullName }]
          : [],
        completed: task.status === "DONE",
        deadline: true,
        unassigned: !assignee,
      })
    }
    for (const milestone of project.milestones) {
      if (!milestone.sentToClientAt) continue
      if (!organization && !team && !members.some(({ id }) => id === userId))
        continue
      events.push({
        ...common,
        id: `milestone-${milestone.id}`,
        type: "milestone",
        title: milestone.title,
        startsAt: milestone.sentToClientAt,
        endsAt: null,
        staff: null,
        staffMembers: members,
        completed: Boolean(milestone.completedAt),
        deadline: false,
        unassigned: false,
      })
    }
  }
  return {
    events: events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    canViewTeam,
    organization,
  }
}
