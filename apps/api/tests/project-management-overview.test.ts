import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { Role } from "../src/generated/prisma/client.js"
import { startPgliteApp } from "./support/pglite-app.js"

type OverviewResponse = {
  totals: {
    totalProjects: number
    planned: number
    inProgress: number
    onHold: number
    completed: number
    cancelled: number
    workspaceGroups: number
    departmentsWithProjects: number
    projectsWithoutDepartment: number
    projectsWithTasks: number
    projectsWithoutTasks: number
    totalTasks: number
    completedTasks: number
    activeProjects: number
    activeProjectsWithoutLead: number
    activeProjectsWithoutTeam: number
    activeAssignments: number
  }
  statusDistribution: { status: string; count: number }[]
  departments: {
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
  }[]
  topStaffAssignments: {
    employeeId: string
    fullName: string
    departmentName: string | null
    activeProjects: number
    leadProjects: number
  }[]
  recentlyUpdatedProjects: {
    id: string
    identity: string
    name: string
    status: string
    updatedAt: string
    departmentId: string | null
    departmentName: string
  }[]
}

test(
  "Project Management overview authorizes Admin roles and aggregates the full company project population",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)

    async function user(name: string, role: Role) {
      const record = await prisma.user.create({
        data: {
          email: `${name.toLowerCase().replaceAll(" ", "-")}@example.com`,
          fullName: name,
          role,
          passwordHash: "test-only",
        },
      })
      return { ...record, token: (await issueSession(record)).token }
    }

    const [admin, superadmin, staff, client] = await Promise.all([
      user("Project Admin", "ADMIN"),
      user("Project Superadmin", "SUPERADMIN"),
      user("Department Head", "STAFF"),
      user("Project Client", "USER"),
    ])
    const design = await prisma.department.create({
      data: { name: "Design", headId: staff.id },
    })
    const operations = await prisma.department.create({
      data: { name: "Operations" },
    })
    const service = await prisma.service.create({
      data: { name: "Analytics fixture service", description: "Test service" },
    })
    const group = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Cross-department group",
        structure: "MULTI_WORKSTREAM",
        clientId: client.id,
        createdById: admin.id,
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "EMP-PM-OVERVIEW",
        fullName: "Assigned Designer",
        departmentId: design.id,
      },
    })

    async function project(input: {
      name: string
      status: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
      departmentId?: string | null
      noRequest?: boolean
      workspaceGroupId?: string
      workPlan?: unknown
      assignLead?: boolean
    }) {
      const request = input.noRequest
        ? null
        : await prisma.serviceRequest.create({
            data: {
              clientId: client.id,
              serviceId: service.id,
              title: input.name,
              acceptedDepartmentId: input.departmentId ?? null,
            },
          })
      const record = await prisma.project.create({
        data: {
          clientId: client.id,
          name: input.name,
          status: input.status,
          requestId: request?.id,
          workspaceGroupId: input.workspaceGroupId,
          ...(input.workPlan ? { workPlan: input.workPlan } : {}),
        },
      })
      if (input.assignLead)
        await prisma.projectStaff.create({
          data: {
            projectId: record.id,
            employeeId: employee.id,
            approvedById: admin.id,
            isTeamLead: true,
          },
        })
      return record
    }

    async function getOverview(token: string) {
      return fetch(`${origin}/api/project-management/overview`, {
        headers: { authorization: `Bearer ${token}` },
      })
    }

    const emptyResponse = await getOverview(admin.token)
    assert.equal(emptyResponse.status, 200)
    const emptyOverview = (await emptyResponse.json()) as OverviewResponse
    assert.equal(emptyOverview.totals.totalProjects, 0)
    assert.equal(emptyOverview.departments.length, 0)
    assert.deepEqual(
      emptyOverview.statusDistribution.map((row) => row.count),
      [0, 0, 0, 0, 0],
    )

    const doneTask = {
      id: "task-done",
      title: "Finished design",
      role: "Designer",
      status: "DONE",
    }
    const openTask = {
      id: "task-open",
      title: "Open design",
      role: "Designer",
      status: "IN_PROGRESS",
    }
    await project({
      name: "Active design work",
      departmentId: design.id,
      status: "IN_PROGRESS",
      workspaceGroupId: group.id,
      workPlan: {
        phases: [
          { id: "phase-design", title: "Design", tasks: [doneTask, openTask] },
        ],
      },
      assignLead: true,
    })
    await project({
      name: "Completed design work",
      departmentId: design.id,
      status: "COMPLETED",
      workPlan: {
        phases: [
          {
            id: "phase-complete",
            title: "Complete",
            tasks: [
              {
                id: "task-complete",
                title: "Completed task",
                role: "Designer",
                status: "DONE",
              },
            ],
          },
        ],
      },
    })
    await project({
      name: "Operations planning",
      departmentId: operations.id,
      status: "PLANNED",
      workspaceGroupId: group.id,
    })
    await project({
      name: "Operations on hold",
      departmentId: operations.id,
      status: "ON_HOLD",
    })
    await project({
      name: "Cancelled without a department",
      status: "CANCELLED",
      noRequest: true,
    })

    assert.equal((await getOverview(staff.token)).status, 403)
    assert.equal((await getOverview(client.token)).status, 403)

    for (const token of [admin.token, superadmin.token]) {
      const response = await getOverview(token)
      assert.equal(response.status, 200)
      const overview = (await response.json()) as OverviewResponse
      assert.deepEqual(overview.totals, {
        totalProjects: 5,
        planned: 1,
        inProgress: 1,
        onHold: 1,
        completed: 1,
        cancelled: 1,
        workspaceGroups: 1,
        departmentsWithProjects: 2,
        projectsWithoutDepartment: 1,
        projectsWithTasks: 2,
        projectsWithoutTasks: 3,
        totalTasks: 3,
        completedTasks: 2,
        activeProjects: 3,
        activeProjectsWithoutLead: 2,
        activeProjectsWithoutTeam: 2,
        activeAssignments: 1,
      })
      assert.deepEqual(
        overview.statusDistribution.map(({ status, count }) => [status, count]),
        [
          ["PLANNED", 1],
          ["IN_PROGRESS", 1],
          ["ON_HOLD", 1],
          ["COMPLETED", 1],
          ["CANCELLED", 1],
        ],
      )
      assert.equal(
        overview.departments.reduce((sum, row) => sum + row.projectCount, 0),
        5,
      )
      assert.equal(
        overview.departments.find((row) => row.departmentId === design.id)
          ?.completedTasks,
        2,
      )
      assert.equal(
        overview.departments.find((row) => row.departmentId === null)
          ?.departmentName,
        "Unassigned department",
      )
      assert.deepEqual(overview.topStaffAssignments, [
        {
          employeeId: employee.id,
          fullName: "Assigned Designer",
          departmentName: "Design",
          activeProjects: 1,
          leadProjects: 1,
        },
      ])
      assert.equal(overview.recentlyUpdatedProjects.length, 5)
      assert.ok(
        overview.recentlyUpdatedProjects.every(
          (projectRow) =>
            projectRow.identity.startsWith("group:") ||
            projectRow.identity.startsWith("ungrouped-project:"),
        ),
      )
    }
  },
)
