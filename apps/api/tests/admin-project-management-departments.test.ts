import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

type ProjectManagementApiPayload = {
  departments?: {
    id: string
    name: string
    head: { fullName: string | null } | null
    memberCount: number
    projectCount?: number
  }[]
  department?: {
    name: string
    projectCount: number
    members: { fullName: string; contactNumber?: string }[]
  }
  rows?: {
    rowId: string
    projectCount: number
    statuses: string[]
    clientName: string | null
    departmentNames: string[]
    progress: { completed: number; total: number } | null
  }[]
  total?: number
  error?: string
}

test(
  "Admin Project Management department reads are scoped, read-only, and count projects",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    async function user(
      id: string,
      role: "ADMIN" | "SUPERADMIN" | "STAFF" | "USER",
    ) {
      return prisma.user.create({
        data: {
          id,
          email: `${id}@project-management.example`,
          fullName: `${id} Person`,
          passwordHash: "test-only",
          role,
          ...(id === "stale-member" ? { position: "Department Head" } : {}),
        },
      })
    }

    const [admin, superadmin, staff, client, head, member, otherClient] =
      await Promise.all([
        user("admin", "ADMIN"),
        user("superadmin", "SUPERADMIN"),
        user("staff", "STAFF"),
        user("client", "USER"),
        user("head", "STAFF"),
        user("stale-member", "STAFF"),
        user("other-client", "USER"),
      ])
    const [design, marketing] = await Promise.all([
      prisma.department.create({
        data: { id: "design-department", name: "Design", headId: head.id },
      }),
      prisma.department.create({
        data: { id: "marketing-department", name: "Marketing" },
      }),
    ])
    await prisma.employee.create({
      data: {
        id: "design-employee",
        employeeId: "PM-DESIGN-1",
        fullName: "stale-member Person",
        email: member.email,
        contactNumber: "+63 900 000 0000",
        position: "Department Head",
        startDate: new Date("2020-01-01T00:00:00Z"),
        userId: member.id,
        departmentId: design.id,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Project Management Test", description: "Test service" },
    })
    const sharedGroup = await prisma.projectWorkspaceGroup.create({
      data: {
        id: "shared-department-group",
        name: "Shared workspace name",
        clientId: client.id,
        createdById: head.id,
        structure: "MULTI_WORKSTREAM",
      },
    })

    async function project(input: {
      id: string
      name: string
      departmentId: string
      clientId: string
      status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      workspaceGroupId?: string
      workPlan?: unknown
    }) {
      const request = await prisma.serviceRequest.create({
        data: {
          clientId: input.clientId,
          serviceId: service.id,
          title: input.name,
          acceptedDepartmentId: input.departmentId,
          workflow: { create: { state: "ACTIVE_PROJECT" } },
        },
      })
      return prisma.project.create({
        data: {
          id: input.id,
          clientId: input.clientId,
          requestId: request.id,
          workspaceGroupId: input.workspaceGroupId,
          name: input.name,
          status: input.status,
          workPlan: input.workPlan as object | undefined,
        },
      })
    }

    await Promise.all([
      project({
        id: "design-shared-project",
        name: "Design authorized project",
        departmentId: design.id,
        clientId: client.id,
        status: "IN_PROGRESS",
        workspaceGroupId: sharedGroup.id,
        workPlan: {
          phases: [
            {
              id: "design-phase",
              title: "Design",
              tasks: [
                {
                  id: "design-done",
                  title: "Completed task",
                  role: "Designer",
                  status: "DONE",
                },
                {
                  id: "design-open",
                  title: "Open task",
                  role: "Designer",
                  status: "NOT_STARTED",
                },
              ],
            },
          ],
        },
      }),
      project({
        id: "marketing-shared-project",
        name: "Marketing private project",
        departmentId: marketing.id,
        clientId: otherClient.id,
        status: "COMPLETED",
        workspaceGroupId: sharedGroup.id,
        workPlan: {
          phases: [
            {
              id: "marketing-phase",
              title: "Marketing",
              tasks: Array.from({ length: 5 }, (_, index) => ({
                id: `marketing-task-${index}`,
                title: "Private task",
                role: "Marketer",
                status: "DONE",
              })),
            },
          ],
        },
      }),
      project({
        id: "design-archived-project",
        name: "Design archived project",
        departmentId: design.id,
        clientId: client.id,
        status: "CANCELLED",
      }),
      project({
        id: "design-completed-project",
        name: "Design completed project",
        departmentId: design.id,
        clientId: client.id,
        status: "COMPLETED",
      }),
    ])

    async function request(
      actor: typeof admin,
      path: string,
    ): Promise<{ status: number; payload: ProjectManagementApiPayload }> {
      const { token } = await issueSession(actor)
      const response = await fetch(`${origin}/api${path}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      return {
        status: response.status,
        payload: (await response.json()) as ProjectManagementApiPayload,
      }
    }

    for (const actor of [admin, superadmin]) {
      const directory = await request(
        actor,
        "/departments/project-management-directory",
      )
      assert.equal(directory.status, 200, JSON.stringify(directory.payload))
      assert.ok(directory.payload.departments)
      const designRow = directory.payload.departments.find(
        (department: { id: string }) => department.id === design.id,
      )
      const marketingRow = directory.payload.departments.find(
        (department: { id: string }) => department.id === marketing.id,
      )
      assert.ok(designRow)
      assert.ok(designRow.head)
      assert.ok(marketingRow)
      assert.equal(designRow.name, "Design")
      assert.equal(designRow.head.fullName, head.fullName)
      assert.equal(designRow.memberCount, 1)
      assert.equal(designRow.projectCount, 3)
      assert.equal(marketingRow.projectCount, 1)

      const detail = await request(
        actor,
        `/departments/project-management-directory/${design.id}`,
      )
      assert.equal(detail.status, 200, JSON.stringify(detail.payload))
      assert.ok(detail.payload.department)
      assert.ok(detail.payload.department.members[0])
      assert.equal(detail.payload.department.name, "Design")
      assert.equal(detail.payload.department.projectCount, 3)
      assert.equal(detail.payload.department.members.length, 1)
      assert.equal(
        detail.payload.department.members[0].fullName,
        member.fullName,
      )
      assert.equal(
        "contactNumber" in detail.payload.department.members[0],
        false,
      )

      const scoped = await request(
        actor,
        `/project-workspace/directory?departmentId=${design.id}&search=Shared`,
      )
      assert.equal(scoped.status, 200, JSON.stringify(scoped.payload))
      assert.ok(scoped.payload.rows)
      assert.ok(scoped.payload.rows[0])
      assert.equal(scoped.payload.total, 1)
      assert.deepEqual(scoped.payload.rows[0].rowId, `group:${sharedGroup.id}`)
      assert.equal(scoped.payload.rows[0].projectCount, 1)
      assert.deepEqual(scoped.payload.rows[0].statuses, ["IN_PROGRESS"])
      assert.equal(scoped.payload.rows[0].clientName, client.fullName)
      assert.deepEqual(scoped.payload.rows[0].departmentNames, ["Design"])
      assert.deepEqual(scoped.payload.rows[0].progress, {
        completed: 1,
        total: 2,
      })

      const missingDepartment = await request(
        actor,
        "/project-workspace/directory?departmentId=missing-department",
      )
      assert.equal(missingDepartment.status, 404)
    }

    const stale = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
      include: { employee: true },
    })
    assert.equal(stale.position, "Department Head")
    assert.equal(stale.employee?.position, "Department Head")

    const staffProjectDirectory = await request(
      staff,
      "/departments/project-management-directory",
    )
    assert.equal(staffProjectDirectory.status, 403)
    const staffProjectDetails = await request(
      staff,
      `/departments/project-management-directory/${design.id}`,
    )
    assert.equal(staffProjectDetails.status, 403)
    const clientProjectDirectory = await request(
      client,
      "/departments/project-management-directory",
    )
    assert.equal(clientProjectDirectory.status, 403)

    const regularDepartmentList = await request(admin, "/departments")
    assert.equal(regularDepartmentList.status, 200)
    assert.ok(regularDepartmentList.payload.departments)
    assert.equal(
      "projectCount" in regularDepartmentList.payload.departments[0],
      false,
    )
  },
)
