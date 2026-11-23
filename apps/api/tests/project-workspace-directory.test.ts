import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "[P14-API-001] workspace directory enforces staff assignment and department scope",
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

    const headA = await actor("p14-head-a", "STAFF")
    const headB = await actor("p14-head-b", "STAFF")
    const client = await actor("p14-client", "USER")
    const admin = await actor("p14-admin", "ADMIN")
    const superadmin = await actor("p14-superadmin", "SUPERADMIN")

    const departmentA = await prisma.department.create({
      data: {
        id: "p14-department-a",
        name: "P14 Department A",
        headId: headA.id,
      },
    })
    const departmentB = await prisma.department.create({
      data: {
        id: "p14-department-b",
        name: "P14 Department B",
        headId: headB.id,
      },
    })
    await prisma.user.updateMany({
      where: { id: { in: [headA.id, headB.id] } },
      data: { departmentId: departmentA.id },
    })
    await prisma.user.update({
      where: { id: headB.id },
      data: { departmentId: departmentB.id },
    })

    const staffA = await actor("p14-staff-a", "STAFF")
    const staffB = await actor("p14-staff-b", "STAFF")
    await prisma.user.update({
      where: { id: staffA.id },
      data: { departmentId: departmentA.id },
    })
    await prisma.user.update({
      where: { id: staffB.id },
      data: { departmentId: departmentB.id },
    })
    const employeeA = await prisma.employee.create({
      data: {
        employeeId: "P14-EMP-A",
        fullName: staffA.fullName!,
        userId: staffA.id,
        departmentId: departmentA.id,
      },
    })
    const employeeB = await prisma.employee.create({
      data: {
        employeeId: "P14-EMP-B",
        fullName: staffB.fullName!,
        userId: staffB.id,
        departmentId: departmentB.id,
      },
    })

    const serviceA = await prisma.service.create({
      data: {
        name: "P14 Service A",
        description: "Project workspace directory fixture.",
        departments: { connect: { id: departmentA.id } },
      },
    })
    const serviceB = await prisma.service.create({
      data: {
        name: "P14 Service B",
        description: "Project workspace directory fixture.",
        departments: { connect: { id: departmentB.id } },
      },
    })

    async function project(
      id: string,
      departmentId: string,
      serviceId: string,
      status: "PLANNED" | "IN_PROGRESS",
    ) {
      const request = await prisma.serviceRequest.create({
        data: {
          id: `${id}-request`,
          clientId: client.id,
          serviceId,
          title: `${id} request`,
          referenceNumber: `${id}-reference`,
          acceptedDepartmentId: departmentId,
        },
      })
      return prisma.project.create({
        data: {
          id,
          clientId: client.id,
          requestId: request.id,
          name: `${id} workspace`,
          status,
        },
      })
    }

    const assignedA = await project(
      "p14-project-a-assigned",
      departmentA.id,
      serviceA.id,
      "IN_PROGRESS",
    )
    const unassignedA = await project(
      "p14-project-a-unassigned",
      departmentA.id,
      serviceA.id,
      "PLANNED",
    )
    const assignedB = await project(
      "p14-project-b-assigned",
      departmentB.id,
      serviceB.id,
      "IN_PROGRESS",
    )
    await prisma.projectStaff.createMany({
      data: [
        {
          projectId: assignedA.id,
          employeeId: employeeA.id,
          approvedById: headA.id,
        },
        {
          projectId: assignedB.id,
          employeeId: employeeB.id,
          approvedById: headB.id,
        },
      ],
    })

    async function list(userId?: string) {
      const token = userId ? sessions.get(userId) : undefined
      return fetch(`${base}/project-workspace`, {
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      })
    }

    assert.equal((await list()).status, 401)
    for (const user of [client, admin, superadmin])
      assert.equal((await list(user.id)).status, 403)

    const headResponse = await list(headA.id)
    assert.equal(headResponse.status, 200)
    const headPayload = (await headResponse.json()) as {
      canCreate: boolean
      workspaces: { id: string; canManage: boolean }[]
    }
    assert.equal(headPayload.canCreate, true)
    assert.deepEqual(
      headPayload.workspaces.map(({ id }) => id).sort(),
      [assignedA.id, unassignedA.id].sort(),
    )
    assert.ok(headPayload.workspaces.every(({ canManage }) => canManage))

    const staffResponse = await list(staffA.id)
    assert.equal(staffResponse.status, 200)
    const staffPayload = (await staffResponse.json()) as {
      canCreate: boolean
      workspaces: { id: string; canManage: boolean }[]
    }
    assert.equal(staffPayload.canCreate, false)
    assert.deepEqual(
      staffPayload.workspaces.map(({ id }) => id),
      [assignedA.id],
    )
    assert.equal(staffPayload.workspaces[0]?.canManage, false)

    const foreignHeadResponse = await list(headB.id)
    assert.equal(foreignHeadResponse.status, 200)
    const foreignHeadPayload = (await foreignHeadResponse.json()) as {
      workspaces: { id: string }[]
    }
    assert.deepEqual(
      foreignHeadPayload.workspaces.map(({ id }) => id),
      [assignedB.id],
    )

    const foreignStaffResponse = await list(staffB.id)
    assert.equal(foreignStaffResponse.status, 200)
    const foreignStaffPayload = (await foreignStaffResponse.json()) as {
      workspaces: { id: string }[]
    }
    assert.deepEqual(
      foreignStaffPayload.workspaces.map(({ id }) => id),
      [assignedB.id],
    )
  },
)
