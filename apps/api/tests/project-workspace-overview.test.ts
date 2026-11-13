import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { ProjectStatus, Role } from "../src/generated/prisma/client.js"
import type { ProjectTaskStatus } from "../src/features/project-workspace/templates.js"
import { startPgliteApp } from "./support/pglite-app.js"

type TaskInput = {
  id: string
  title: string
  status: ProjectTaskStatus
  dueDate?: string | null
}

type OverviewResponse = {
  totals: {
    totalProjects: number
    inProgress: number
    completed: number
    onHold: number
    planned: number
    cancelled: number
    workspaceGroups: number
    projectsWithTasks: number
    projectsWithoutTasks: number
    totalTasks: number
    completedTasks: number
    outstandingTasks: number
    upcomingTasks: number
    overdueTasks: number
  }
  statusDistribution: { status: ProjectStatus; count: number }[]
  clientDistribution: { id: string; name: string; projectCount: number }[]
  workspaceProgress: {
    identity: string
    kind: "group" | "ungrouped-project"
    name: string
    projectCount: number
    completedTasks: number
    totalTasks: number
  }[]
  upcomingDeadlines: {
    id: string
    title: string
    projectId: string
    projectName: string
    dueDate: string
    status: ProjectTaskStatus
  }[]
  overdueTaskList: {
    id: string
    title: string
    projectId: string
    projectName: string
    dueDate: string
    status: ProjectTaskStatus
  }[]
}

function dateInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10)
}

function plan(tasks: TaskInput[]) {
  return {
    phases: [
      {
        id: "phase-1",
        title: "Delivery",
        tasks: tasks.map((task) => ({ role: "Designer", ...task })),
      },
    ],
  }
}

test(
  "workspace overview aggregates only the department's projects and tasks",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    async function user(name: string, role: Role, settings = {}) {
      const record = await prisma.user.create({
        data: {
          email: `${name.toLowerCase().replaceAll(" ", "-")}@example.com`,
          fullName: name,
          role,
          settings,
          passwordHash: "test-only",
        },
      })
      return { ...record, token: (await issueSession(record)).token }
    }
    const [head, otherHead, staff, firstClient, secondClient] =
      await Promise.all([
        user("Design Head", "STAFF", { timeZone: "America/Los_Angeles" }),
        user("Operations Head", "STAFF"),
        user("Ordinary Staff", "STAFF"),
        user("Client One", "USER"),
        user("Client Two", "USER"),
      ])
    const own = await prisma.department.create({
      data: { name: "Design", headId: head.id },
    })
    const other = await prisma.department.create({
      data: { name: "Operations", headId: otherHead.id },
    })
    await prisma.user.update({
      where: { id: head.id },
      data: { departmentId: other.id },
    })
    const service = await prisma.service.create({
      data: { name: "Design service", description: "Test service" },
    })
    const group = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Shared workspace name",
        structure: "MULTI_WORKSTREAM",
        clientId: firstClient.id,
        createdById: head.id,
      },
    })
    const timeZone = "America/Los_Angeles"
    const today = dateInZone(new Date(), timeZone)
    const yesterday = shiftDate(today, -1)
    const day3 = shiftDate(today, 3)
    const day14 = shiftDate(today, 14)
    const day15 = shiftDate(today, 15)
    async function project(input: {
      name: string
      departmentId: string | null
      status: ProjectStatus
      clientId?: string
      workspaceGroupId?: string
      tasks?: TaskInput[]
      hasPlan?: boolean
      noRequest?: boolean
    }) {
      const request = input.noRequest
        ? null
        : await prisma.serviceRequest.create({
            data: {
              clientId: input.clientId ?? firstClient.id,
              serviceId: service.id,
              title: input.name,
              acceptedDepartmentId: input.departmentId,
            },
          })
      return prisma.project.create({
        data: {
          name: input.name,
          clientId: input.clientId ?? firstClient.id,
          status: input.status,
          requestId: request?.id,
          workspaceGroupId: input.workspaceGroupId,
          ...(input.hasPlan
            ? { workPlan: plan(input.tasks ?? []) }
            : input.tasks?.length
              ? { workPlan: plan(input.tasks) }
              : {}),
        },
      })
    }
    const activeProject = await project({
      name: "Design project in shared group",
      departmentId: own.id,
      status: "IN_PROGRESS",
      workspaceGroupId: group.id,
      tasks: [
        {
          id: "done-yesterday",
          title: "Finished task",
          status: "DONE",
          dueDate: yesterday,
        },
        {
          id: "late-open",
          title: "Overdue task",
          status: "IN_PROGRESS",
          dueDate: yesterday,
        },
        {
          id: "due-today",
          title: "Due today task",
          status: "NOT_STARTED",
          dueDate: today,
        },
        {
          id: "due-in-14",
          title: "Fourteen day task",
          status: "NOT_STARTED",
          dueDate: day14,
        },
        {
          id: "due-in-15",
          title: "Fifteen day task",
          status: "IN_PROGRESS",
          dueDate: day15,
        },
        { id: "no-date", title: "Unscheduled task", status: "IN_PROGRESS" },
      ],
    })
    const secondGroupProject = await project({
      name: "Second design project in group",
      departmentId: own.id,
      status: "PLANNED",
      clientId: secondClient.id,
      workspaceGroupId: group.id,
      tasks: [
        {
          id: "due-in-3",
          title: "Three day task",
          status: "NOT_STARTED",
          dueDate: day3,
        },
      ],
    })
    await project({
      name: "Completed design project",
      departmentId: own.id,
      status: "COMPLETED",
      tasks: [
        {
          id: "completed-task",
          title: "Completed task",
          status: "DONE",
          dueDate: yesterday,
        },
      ],
    })
    await project({
      name: "On hold design project",
      departmentId: own.id,
      status: "ON_HOLD",
      clientId: secondClient.id,
      hasPlan: true,
    })
    await project({
      name: "Cancelled design project",
      departmentId: own.id,
      status: "CANCELLED",
      clientId: secondClient.id,
    })
    const unplannedProject = await project({
      name: "Unplanned design project",
      departmentId: own.id,
      status: "PLANNED",
      tasks: [],
    })
    await project({
      name: "Design project with duplicate task IDs",
      departmentId: own.id,
      status: "PLANNED",
      workspaceGroupId: group.id,
      tasks: [
        {
          id: "duplicate-deadline",
          title: "Duplicate deadline one",
          status: "NOT_STARTED",
          dueDate: today,
        },
        {
          id: "duplicate-deadline",
          title: "Duplicate deadline two",
          status: "NOT_STARTED",
          dueDate: today,
        },
      ],
    })
    await project({
      name: "Operations confidential project",
      departmentId: other.id,
      status: "COMPLETED",
      clientId: secondClient.id,
      workspaceGroupId: group.id,
      tasks: [
        {
          id: "foreign-deadline",
          title: "Foreign confidential task",
          status: "IN_PROGRESS",
          dueDate: today,
        },
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `foreign-${index}`,
          title: `Foreign task ${index}`,
          status: "DONE" as const,
        })),
      ],
    })
    await project({
      name: "Unaccepted confidential project",
      departmentId: null,
      status: "IN_PROGRESS",
      tasks: [
        {
          id: "unaccepted-deadline",
          title: "Unaccepted task",
          status: "NOT_STARTED",
          dueDate: today,
        },
      ],
    })
    await project({
      name: "Project without accepted request",
      departmentId: own.id,
      status: "PLANNED",
      noRequest: true,
      tasks: [
        {
          id: "requestless-task",
          title: "Requestless task",
          status: "NOT_STARTED",
          dueDate: today,
        },
      ],
    })

    async function getOverview(token: string) {
      return fetch(`${origin}/api/project-workspace/overview`, {
        headers: { authorization: `Bearer ${token}` },
      })
    }
    assert.equal((await getOverview(staff.token)).status, 403)
    const otherResponse = await getOverview(otherHead.token)
    assert.equal(otherResponse.status, 200)
    const otherOverview = (await otherResponse.json()) as OverviewResponse
    assert.equal(otherOverview.totals.totalProjects, 1)
    assert.equal(otherOverview.totals.totalTasks, 5)
    assert.equal(
      otherOverview.totals.upcomingTasks + otherOverview.totals.overdueTasks,
      1,
    )
    const response = await getOverview(head.token)
    assert.equal(response.status, 200)
    const overview = (await response.json()) as OverviewResponse

    assert.deepEqual(overview.totals, {
      totalProjects: 7,
      inProgress: 1,
      completed: 1,
      onHold: 1,
      planned: 3,
      cancelled: 1,
      workspaceGroups: 1,
      projectsWithTasks: 3,
      projectsWithoutTasks: 4,
      totalTasks: 8,
      completedTasks: 2,
      outstandingTasks: 6,
      upcomingTasks: 3,
      overdueTasks: 1,
    })
    assert.deepEqual(
      Object.fromEntries(
        overview.statusDistribution.map(({ status, count }) => [status, count]),
      ),
      {
        PLANNED: 3,
        IN_PROGRESS: 1,
        ON_HOLD: 1,
        COMPLETED: 1,
        CANCELLED: 1,
      },
    )
    assert.equal(
      overview.statusDistribution.reduce((sum, item) => sum + item.count, 0),
      overview.totals.totalProjects,
    )
    assert.deepEqual(
      overview.clientDistribution.map(({ name, projectCount }) => [
        name,
        projectCount,
      ]),
      [
        ["Client One", 4],
        ["Client Two", 3],
      ],
    )
    assert.deepEqual(
      overview.workspaceProgress.find(
        ({ identity }) => identity === `group:${group.id}`,
      ),
      {
        identity: `group:${group.id}`,
        kind: "group",
        name: group.name,
        projectCount: 3,
        completedTasks: 1,
        totalTasks: 7,
      },
    )
    assert.deepEqual(
      overview.workspaceProgress.find(
        ({ identity }) =>
          identity === `ungrouped-project:${unplannedProject.id}`,
      ),
      {
        identity: `ungrouped-project:${unplannedProject.id}`,
        kind: "ungrouped-project",
        name: unplannedProject.name,
        projectCount: 1,
        completedTasks: 0,
        totalTasks: 0,
      },
    )
    assert.deepEqual(
      overview.upcomingDeadlines.map(({ id }) => id).sort(),
      ["due-today", "due-in-14", "due-in-3"].sort(),
    )
    assert.deepEqual(
      overview.overdueTaskList.map(({ id }) => id),
      ["late-open"],
    )
    assert.equal(
      JSON.stringify(overview).includes("Operations confidential"),
      false,
    )
    assert.equal(
      JSON.stringify(overview).includes("Foreign confidential"),
      false,
    )
    assert.equal(
      JSON.stringify(overview).includes("Unaccepted confidential"),
      false,
    )
    assert.equal("updatedAt" in overview, false)
    assert.notEqual(activeProject.id, secondGroupProject.id)

    const earlyTimeZone = "Etc/GMT+12"
    const lateTimeZone = "Pacific/Kiritimati"
    const earlyToday = dateInZone(new Date(), earlyTimeZone)
    assert.ok(dateInZone(new Date(), lateTimeZone) > earlyToday)
    await prisma.project.updateMany({
      where: { request: { acceptedDepartmentId: own.id } },
      data: { workPlan: { phases: [] } },
    })
    await prisma.project.update({
      where: { id: activeProject.id },
      data: {
        workPlan: plan([
          {
            id: "timezone-boundary-task",
            title: "Timezone boundary task",
            status: "NOT_STARTED",
            dueDate: earlyToday,
          },
        ]),
      },
    })
    await prisma.user.update({
      where: { id: head.id },
      data: { settings: { timeZone: earlyTimeZone } },
    })
    const earlyResponse = await getOverview(head.token)
    assert.equal(earlyResponse.status, 200)
    const earlyOverview = (await earlyResponse.json()) as OverviewResponse
    assert.equal(earlyOverview.totals.upcomingTasks, 1)
    assert.equal(earlyOverview.totals.overdueTasks, 0)
    assert.deepEqual(
      earlyOverview.upcomingDeadlines.map(({ id }) => id),
      ["timezone-boundary-task"],
    )

    await prisma.user.update({
      where: { id: head.id },
      data: { settings: { timeZone: lateTimeZone } },
    })
    const lateResponse = await getOverview(head.token)
    assert.equal(lateResponse.status, 200)
    const lateOverview = (await lateResponse.json()) as OverviewResponse
    assert.equal(lateOverview.totals.upcomingTasks, 0)
    assert.equal(lateOverview.totals.overdueTasks, 1)
    assert.deepEqual(
      lateOverview.overdueTaskList.map(({ id }) => id),
      ["timezone-boundary-task"],
    )
  },
)
