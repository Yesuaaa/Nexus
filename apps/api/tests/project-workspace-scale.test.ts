import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { ProjectStatus } from "../src/generated/prisma/client.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "large workspace data preserves department isolation, task totals, and deep directory pages",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const head = await prisma.user.create({
      data: {
        email: "scale-head@example.com",
        fullName: "Scale Department Head",
        role: "STAFF",
        passwordHash: "test-only",
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "scale-client@example.com",
        fullName: "Scale Client",
        role: "USER",
        passwordHash: "test-only",
      },
    })
    const ownDepartment = await prisma.department.create({
      data: { name: "Scale Design", headId: head.id },
    })
    const otherDepartment = await prisma.department.create({
      data: { name: "Scale Operations" },
    })
    const service = await prisma.service.create({
      data: { name: "Scale Test Service", description: "Test service" },
    })
    const group = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Scale shared group",
        structure: "MULTI_WORKSTREAM",
        clientId: client.id,
        createdById: head.id,
      },
    })

    const groupMembers = [
      ...Array.from({ length: 40 }, (_, index) => ({
        departmentId: ownDepartment.id,
        projectId: `scale-own-project-${String(index).padStart(3, "0")}`,
        requestId: `scale-own-request-${String(index).padStart(3, "0")}`,
        name: `Scale own project ${String(index).padStart(3, "0")}`,
        status: (["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)[index % 3],
        workPlan: {
          phases: [
            {
              id: `phase-own-${index}`,
              title: "Delivery",
              tasks: Array.from({ length: 50 }, (_, taskIndex) => ({
                id: `own-${index}-${taskIndex}`,
                title: `Task ${taskIndex}`,
                role: "Designer",
                status: taskIndex < 20 ? "DONE" : "IN_PROGRESS",
              })),
            },
          ],
        },
      })),
      ...Array.from({ length: 20 }, (_, index) => ({
        departmentId: otherDepartment.id,
        projectId: `scale-other-project-${String(index).padStart(3, "0")}`,
        requestId: `scale-other-request-${String(index).padStart(3, "0")}`,
        name: `Scale other project ${String(index).padStart(3, "0")}`,
        status: "IN_PROGRESS" as const,
        workPlan: {
          phases: [
            {
              id: `phase-other-${index}`,
              title: "Operations",
              tasks: Array.from({ length: 50 }, (_, taskIndex) => ({
                id: `other-${index}-${taskIndex}`,
                title: `Task ${taskIndex}`,
                role: "Operations",
                status: "DONE",
              })),
            },
          ],
        },
      })),
    ]
    const ungroupedProjects = Array.from({ length: 120 }, (_, index) => ({
      departmentId: ownDepartment.id,
      projectId: `scale-virtual-project-${String(index).padStart(3, "0")}`,
      requestId: `scale-virtual-request-${String(index).padStart(3, "0")}`,
      name: `Scale ungrouped ${String(index).padStart(3, "0")}`,
      status: "PLANNED" as const,
      workPlan: null,
    }))
    const fixtures = [...groupMembers, ...ungroupedProjects]

    await prisma.serviceRequest.createMany({
      data: fixtures.map((fixture) => ({
        id: fixture.requestId,
        clientId: client.id,
        serviceId: service.id,
        title: fixture.name,
        acceptedDepartmentId: fixture.departmentId,
      })),
    })
    await prisma.project.createMany({
      data: fixtures.map((fixture) => ({
        id: fixture.projectId,
        clientId: client.id,
        name: fixture.name,
        status: fixture.status as ProjectStatus,
        requestId: fixture.requestId,
        workspaceGroupId:
          fixture.departmentId === otherDepartment.id ||
          fixture.projectId.startsWith("scale-own-project-")
            ? group.id
            : null,
        ...(fixture.workPlan ? { workPlan: fixture.workPlan } : {}),
      })),
    })

    const token = (await issueSession(head)).token
    const headers = { authorization: `Bearer ${token}` }
    const overviewResponse = await fetch(
      `${origin}/api/project-workspace/overview`,
      { headers },
    )
    assert.equal(overviewResponse.status, 200)
    const overview = (await overviewResponse.json()) as {
      totals: {
        totalProjects: number
        projectsWithTasks: number
        projectsWithoutTasks: number
        totalTasks: number
        completedTasks: number
      }
      workspaceProgress: {
        identity: string
        projectCount: number
        totalTasks: number
        completedTasks: number
      }[]
    }
    assert.deepEqual(overview.totals, {
      totalProjects: 160,
      inProgress: 14,
      completed: 13,
      onHold: 0,
      planned: 120,
      cancelled: 13,
      workspaceGroups: 1,
      projectsWithTasks: 40,
      projectsWithoutTasks: 120,
      totalTasks: 2_000,
      completedTasks: 800,
      outstandingTasks: 1_200,
      upcomingTasks: 0,
      overdueTasks: 0,
    })
    assert.deepEqual(
      overview.workspaceProgress.find(
        ({ identity }) => identity === `group:${group.id}`,
      ),
      {
        identity: `group:${group.id}`,
        kind: "group",
        name: group.name,
        projectCount: 40,
        totalTasks: 2_000,
        completedTasks: 800,
      },
    )

    const sharedGroupResponse = await fetch(
      `${origin}/api/project-workspace/directory?search=Scale%20shared%20group`,
      { headers },
    )
    assert.equal(sharedGroupResponse.status, 200)
    const sharedDirectory = (await sharedGroupResponse.json()) as {
      total: number
      rows: {
        rowId: string
        projectCount: number
        statuses: string[]
        canRename: boolean
        progress: { completed: number; total: number } | null
      }[]
    }
    assert.equal(sharedDirectory.total, 1)
    assert.equal(sharedDirectory.rows[0]?.rowId, `group:${group.id}`)
    assert.equal(sharedDirectory.rows[0]?.projectCount, 40)
    assert.deepEqual([...(sharedDirectory.rows[0]?.statuses ?? [])].sort(), [
      "CANCELLED",
      "COMPLETED",
      "IN_PROGRESS",
    ])
    assert.equal(sharedDirectory.rows[0]?.canRename, false)
    assert.deepEqual(sharedDirectory.rows[0]?.progress, {
      completed: 800,
      total: 2_000,
    })

    const deepPageResponse = await fetch(
      `${origin}/api/project-workspace/directory?page=13&sort=name`,
      { headers },
    )
    assert.equal(deepPageResponse.status, 200)
    const deepPage = (await deepPageResponse.json()) as {
      total: number
      page: number
      pageSize: number
      totalPages: number
      rows: { rowId: string; name: string; projectCount: number }[]
    }
    assert.equal(deepPage.total, 121)
    assert.equal(deepPage.page, 13)
    assert.equal(deepPage.pageSize, 10)
    assert.equal(deepPage.totalPages, 13)
    assert.equal(deepPage.rows.length, 1)
    assert.equal(
      deepPage.rows[0]?.rowId,
      "ungrouped-project:scale-virtual-project-119",
    )
    assert.equal(deepPage.rows[0]?.name, "Scale ungrouped 119")
    assert.equal(deepPage.rows[0]?.projectCount, 1)
  },
)
