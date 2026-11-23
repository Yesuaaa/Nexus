import assert from "node:assert/strict"
import { test } from "node:test"
import type { Prisma } from "../src/generated/prisma/client.js"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { ProjectWorkPlan } from "../src/features/project-workspace/templates.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "Page 15 workspace detail access and plan concurrency",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const sessions = new Map<string, string>()

    async function actor(
      id: string,
      role: "STAFF" | "USER" | "ADMIN" | "SUPERADMIN",
    ) {
      const user = await prisma.user.create({
        data: {
          id,
          email: `${id}@example.com`,
          fullName: id,
          passwordHash: "test-only-hash",
          role,
        },
      })
      sessions.set(id, (await issueSession(user)).token)
      return user
    }

    const headA = await actor("p15-head-a", "STAFF")
    const headB = await actor("p15-head-b", "STAFF")
    const assignedA = await actor("p15-assigned-a", "STAFF")
    const unassignedA = await actor("p15-unassigned-a", "STAFF")
    const assignedB = await actor("p15-assigned-b", "STAFF")
    const client = await actor("p15-client", "USER")
    const admin = await actor("p15-admin", "ADMIN")
    const superadmin = await actor("p15-superadmin", "SUPERADMIN")

    const departmentA = await prisma.department.create({
      data: {
        id: "p15-department-a",
        name: "P15 Department A",
        headId: headA.id,
      },
    })
    const departmentB = await prisma.department.create({
      data: {
        id: "p15-department-b",
        name: "P15 Department B",
        headId: headB.id,
      },
    })
    await prisma.user.update({
      where: { id: headA.id },
      data: { departmentId: departmentA.id },
    })
    await prisma.user.update({
      where: { id: headB.id },
      data: { departmentId: departmentB.id },
    })
    for (const user of [assignedA, unassignedA])
      await prisma.user.update({
        where: { id: user.id },
        data: { departmentId: departmentA.id },
      })
    await prisma.user.update({
      where: { id: assignedB.id },
      data: { departmentId: departmentB.id },
    })

    const employeeA = await prisma.employee.create({
      data: {
        employeeId: "P15-EMP-A",
        fullName: assignedA.fullName!,
        userId: assignedA.id,
        departmentId: departmentA.id,
      },
    })
    const employeeB = await prisma.employee.create({
      data: {
        employeeId: "P15-EMP-B",
        fullName: assignedB.fullName!,
        userId: assignedB.id,
        departmentId: departmentB.id,
      },
    })
    const serviceA = await prisma.service.create({
      data: {
        name: "P15 Service A",
        description: "Workspace detail access fixture.",
        departments: { connect: { id: departmentA.id } },
      },
    })
    const serviceB = await prisma.service.create({
      data: {
        name: "P15 Service B",
        description: "Workspace detail access fixture.",
        departments: { connect: { id: departmentB.id } },
      },
    })
    const requestA = await prisma.serviceRequest.create({
      data: {
        id: "p15-request-a",
        clientId: client.id,
        serviceId: serviceA.id,
        title: "P15 Request A",
        referenceNumber: "P15-REF-A",
        acceptedDepartmentId: departmentA.id,
        workflow: { create: { state: "ACTIVE_PROJECT" } },
      },
    })
    const requestB = await prisma.serviceRequest.create({
      data: {
        id: "p15-request-b",
        clientId: client.id,
        serviceId: serviceB.id,
        title: "P15 Request B",
        referenceNumber: "P15-REF-B",
        acceptedDepartmentId: departmentB.id,
        workflow: { create: { state: "ACTIVE_PROJECT" } },
      },
    })
    const originalPlan: ProjectWorkPlan = {
      phases: [
        {
          id: "p15-phase-one",
          title: "Planning",
          tasks: [
            {
              id: "p15-task-one",
              title: "Confirm scope",
              role: "Project lead",
              status: "NOT_STARTED",
            },
          ],
        },
      ],
    }
    const projectA = await prisma.project.create({
      data: {
        id: "p15-project-a",
        clientId: client.id,
        requestId: requestA.id,
        name: "P15 Project A",
        status: "IN_PROGRESS",
        workPlan: originalPlan as Prisma.InputJsonValue,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    })
    const projectB = await prisma.project.create({
      data: {
        id: "p15-project-b",
        clientId: client.id,
        requestId: requestB.id,
        name: "P15 Project B",
        status: "IN_PROGRESS",
      },
    })
    await prisma.projectStaff.createMany({
      data: [
        {
          projectId: projectA.id,
          employeeId: employeeA.id,
          approvedById: headA.id,
        },
        {
          projectId: projectB.id,
          employeeId: employeeB.id,
          approvedById: headB.id,
        },
      ],
    })

    async function readWorkspace(workspaceId: string, userId?: string) {
      const token = userId ? sessions.get(userId) : undefined
      return fetch(
        `${base}/project-workspace/${encodeURIComponent(workspaceId)}`,
        {
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
        },
      )
    }

    await t.test(
      "[P15-API-001] workspace detail reads enforce role and project scope",
      async () => {
        assert.equal((await readWorkspace(projectA.id)).status, 401)
        for (const user of [client, admin, superadmin])
          assert.equal((await readWorkspace(projectA.id, user.id)).status, 403)

        const headResponse = await readWorkspace(projectA.id, headA.id)
        assert.equal(
          headResponse.status,
          200,
          await headResponse.clone().text(),
        )
        const headDetail = (await headResponse.json()) as {
          id: string
          canManage: boolean
          workstreams: { id: string }[]
        }
        assert.equal(headDetail.id, projectA.id)
        assert.equal(headDetail.canManage, true)
        assert.deepEqual(
          headDetail.workstreams.map(({ id }) => id),
          [projectA.id],
        )

        const staffResponse = await readWorkspace(projectA.id, assignedA.id)
        assert.equal(
          staffResponse.status,
          200,
          await staffResponse.clone().text(),
        )
        const staffDetail = (await staffResponse.json()) as {
          canManage: boolean
          workstreams: {
            id: string
            canUploadDeliverables: boolean
            staff: { id: string; userId?: string }[]
          }[]
        }
        assert.equal(staffDetail.canManage, false)
        assert.equal(staffDetail.workstreams[0]?.canUploadDeliverables, true)
        assert.equal(staffDetail.workstreams[0]?.staff[0]?.userId, undefined)

        for (const user of [unassignedA, headB, assignedB])
          assert.equal((await readWorkspace(projectA.id, user.id)).status, 404)
        assert.equal((await readWorkspace("invalid id", headA.id)).status, 400)
      },
    )

    await t.test(
      "[P15-API-002] stale plan writes return conflict without replacing the saved plan",
      async () => {
        const before = await prisma.project.findUniqueOrThrow({
          where: { id: projectA.id },
          select: { updatedAt: true },
        })
        const expectedUpdatedAt = before.updatedAt.toISOString()
        const savedPlan: ProjectWorkPlan = {
          phases: [
            {
              id: "p15-phase-one",
              title: "Approved plan",
              tasks: [
                {
                  id: "p15-task-one",
                  title: "Confirm scope",
                  role: "Project lead",
                  status: "IN_PROGRESS",
                },
              ],
            },
          ],
        }
        const stalePlan: ProjectWorkPlan = {
          phases: [
            {
              id: "p15-phase-one",
              title: "Stale plan",
              tasks: [
                {
                  id: "p15-task-one",
                  title: "Confirm scope",
                  role: "Project lead",
                  status: "NOT_STARTED",
                },
              ],
            },
          ],
        }
        const planPath = `/project-workspace/${projectA.id}/projects/${projectA.id}/plan`
        const first = await fetch(`${base}${planPath}`, {
          method: "PUT",
          headers: {
            authorization: `Bearer ${sessions.get(headA.id)}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ plan: savedPlan, expectedUpdatedAt }),
        })
        assert.equal(first.status, 200, await first.clone().text())

        const stale = await fetch(`${base}${planPath}`, {
          method: "PUT",
          headers: {
            authorization: `Bearer ${sessions.get(headA.id)}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ plan: stalePlan, expectedUpdatedAt }),
        })
        assert.equal(stale.status, 409, await stale.clone().text())
        const staleBody = (await stale.json()) as { error: string }
        assert.match(staleBody.error, /plan changed/i)

        const persisted = await prisma.project.findUniqueOrThrow({
          where: { id: projectA.id },
          select: { workPlan: true },
        })
        assert.deepEqual(persisted.workPlan, savedPlan)
      },
    )

    await t.test(
      "[P15-API-003] task creation enforces the per-phase task limit",
      async () => {
        const cappedPlan: ProjectWorkPlan = {
          phases: [
            {
              id: "p15-phase-capped",
              title: "Capacity check",
              tasks: Array.from({ length: 50 }, (_, index) => ({
                id: `p15-task-${index + 1}`,
                title: `Task ${index + 1}`,
                role: "Project team",
                status: "NOT_STARTED" as const,
              })),
            },
          ],
        }
        await prisma.project.update({
          where: { id: projectA.id },
          data: { workPlan: cappedPlan as Prisma.InputJsonValue },
        })

        const response = await fetch(
          `${base}/project-workspace/${projectA.id}/projects/${projectA.id}/tasks`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${sessions.get(headA.id)}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              phaseId: "p15-phase-capped",
              title: "Overflow task",
            }),
          },
        )
        const persisted = await prisma.project.findUniqueOrThrow({
          where: { id: projectA.id },
          select: { workPlan: true },
        })
        const persistedPlan = persisted.workPlan as ProjectWorkPlan
        const persistedCount = persistedPlan.phases[0]?.tasks.length

        assert.equal(
          response.status,
          400,
          `Expected the API to reject a 51st task; received ${response.status} and persisted ${persistedCount}`,
        )
        assert.deepEqual(persisted.workPlan, cappedPlan)
      },
    )
  },
)
