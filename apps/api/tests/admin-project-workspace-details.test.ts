import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

type ProjectDetails = {
  id: string
  name: string
  status: string
  client: { id: string; fullName: string | null }
  team: { id: string; fullName: string; position: string | null }[]
  leads: { id: string; fullName: string; position: string | null }[]
  progress: { completed: number; total: number } | null
  tasks: { total: number; completed: number; incomplete: number }
  taskDueDates: string[]
}

type WorkspaceDetails = {
  identity: string
  kind: "group" | "ungrouped-project"
  name: string
  department: {
    id: string
    name: string
    memberCount: number
    head: { fullName: string | null } | null
  }
  clients: { id: string; fullName: string | null }[]
  statuses: string[]
  projectCount: number
  progress: { completed: number; total: number } | null
  teamMembers: { id: string; fullName: string; position: string | null }[]
  projects: ProjectDetails[]
  activity: { id: string; projectId: string; summary: string }[]
  [key: string]: unknown
}

test(
  "Admin Project Management details are read-only, typed, and department scoped",
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
          email: `${id}@workspace-details.example`,
          fullName: `${id} Person`,
          passwordHash: "test-only",
          role,
        },
      })
    }

    const [admin, superadmin, staff, client, foreignClient, head] =
      await Promise.all([
        user("details-admin", "ADMIN"),
        user("details-superadmin", "SUPERADMIN"),
        user("details-staff", "STAFF"),
        user("details-client", "USER"),
        user("foreign-client", "USER"),
        user("details-head", "STAFF"),
      ])
    const [design, marketing] = await Promise.all([
      prisma.department.create({
        data: { id: "details-design", name: "Design", headId: head.id },
      }),
      prisma.department.create({
        data: { id: "details-marketing", name: "Marketing" },
      }),
    ])
    const [designEmployee, marketingEmployee] = await Promise.all([
      prisma.employee.create({
        data: {
          id: "details-designer",
          employeeId: "DETAILS-DESIGN-1",
          fullName: "Design Assignee",
          position: "Designer",
          departmentId: design.id,
        },
      }),
      prisma.employee.create({
        data: {
          id: "details-marketer",
          employeeId: "DETAILS-MARKETING-1",
          fullName: "Marketing Assignee",
          position: "Marketer",
          departmentId: marketing.id,
        },
      }),
    ])
    const service = await prisma.service.create({
      data: { name: "Workspace details test", description: "Read-only test" },
    })
    const shared = await prisma.projectWorkspaceGroup.create({
      data: {
        id: "details-shared",
        name: "Shared workspace display name",
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
      workspaceGroupId?: string
      status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED"
      workPlan?: unknown
      staff?: { employeeId: string; isTeamLead?: boolean }[]
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
          description: `${input.name} description`,
          status: input.status ?? "IN_PROGRESS",
          startDate: new Date("2026-01-15T00:00:00Z"),
          workPlan: input.workPlan as object | undefined,
          ...(input.staff?.length
            ? {
                staff: {
                  create: input.staff.map((assignment) => ({
                    employeeId: assignment.employeeId,
                    approvedById: head.id,
                    isTeamLead: assignment.isTeamLead ?? false,
                  })),
                },
              }
            : {}),
        },
      })
    }

    const designProject = await project({
      id: "details-design-project",
      name: "Authorized design project",
      departmentId: design.id,
      clientId: client.id,
      workspaceGroupId: shared.id,
      workPlan: {
        phases: [
          {
            id: "design-phase",
            title: "Design phase",
            tasks: [
              {
                id: "design-done",
                title: "Finished",
                role: "Designer",
                status: "DONE",
                dueDate: "2026-02-01",
              },
              {
                id: "design-open",
                title: "In progress",
                role: "Designer",
                status: "NOT_STARTED",
                dueDate: "2026-02-10",
              },
            ],
          },
        ],
      },
      staff: [
        { employeeId: designEmployee.id, isTeamLead: true },
        { employeeId: marketingEmployee.id },
      ],
    })
    await project({
      id: "details-design-project-two",
      name: "Second authorized project",
      departmentId: design.id,
      clientId: client.id,
      workspaceGroupId: shared.id,
      status: "COMPLETED",
      staff: [{ employeeId: designEmployee.id }],
    })
    await project({
      id: "details-marketing-project",
      name: "Private marketing project",
      departmentId: marketing.id,
      clientId: foreignClient.id,
      workspaceGroupId: shared.id,
      status: "PLANNED",
      workPlan: {
        phases: [
          {
            id: "private-phase",
            title: "Private phase",
            tasks: [
              {
                id: "private-task",
                title: "Private task",
                role: "Marketer",
                status: "DONE",
              },
            ],
          },
        ],
      },
      staff: [{ employeeId: marketingEmployee.id, isTeamLead: true }],
    })

    const collidingGroup = await prisma.projectWorkspaceGroup.create({
      data: {
        id: "same-workspace-record-id",
        name: "Persisted colliding group",
        clientId: client.id,
        createdById: head.id,
        structure: "SEPARATE",
      },
    })
    await project({
      id: "grouped-collision-member",
      name: "Grouped collision member",
      departmentId: design.id,
      clientId: client.id,
      workspaceGroupId: collidingGroup.id,
    })
    const ungroupedCollision = await project({
      id: collidingGroup.id,
      name: "Ungrouped collision project",
      departmentId: design.id,
      clientId: client.id,
      status: "PLANNED",
    })
    const otherOnly = await prisma.projectWorkspaceGroup.create({
      data: {
        id: "details-other-only",
        name: "Other department only",
        clientId: foreignClient.id,
        createdById: head.id,
        structure: "SEPARATE",
      },
    })
    await project({
      id: "details-other-only-project",
      name: "Other department only project",
      departmentId: marketing.id,
      clientId: foreignClient.id,
      workspaceGroupId: otherOnly.id,
    })

    async function request(actor: typeof admin, path: string, method = "GET") {
      const { token } = await issueSession(actor)
      const response = await fetch(`${origin}/api${path}`, {
        method,
        headers: { authorization: `Bearer ${token}` },
      })
      return {
        status: response.status,
        payload: (await response.json().catch(() => null)) as
          WorkspaceDetails | { error?: string } | null,
      }
    }
    function detailsPath(departmentId: string, identity: string) {
      return `/project-workspace/admin/departments/${encodeURIComponent(departmentId)}/workspaces/${encodeURIComponent(identity)}`
    }

    const adminDenied = await request(
      admin,
      detailsPath(design.id, `group:${shared.id}`),
    )
    assert.equal(adminDenied.status, 403)

    for (const actor of [superadmin]) {
      const result = await request(
        actor,
        detailsPath(design.id, `group:${shared.id}`),
      )
      assert.equal(result.status, 200, JSON.stringify(result.payload))
      const workspace = result.payload as WorkspaceDetails
      assert.equal(workspace.kind, "group")
      assert.equal(workspace.identity, `group:${shared.id}`)
      assert.equal(workspace.name, shared.name)
      assert.equal(workspace.projectCount, 2)
      assert.deepEqual(workspace.statuses, ["COMPLETED", "IN_PROGRESS"])
      assert.deepEqual(workspace.progress, { completed: 1, total: 2 })
      assert.deepEqual(workspace.clients, [
        { id: client.id, fullName: client.fullName },
      ])
      assert.equal(workspace.department.name, design.name)
      assert.equal(workspace.department.memberCount, 1)
      assert.equal(workspace.department.head?.fullName, head.fullName)
      assert.deepEqual(workspace.teamMembers, [
        {
          id: designEmployee.id,
          fullName: designEmployee.fullName,
          position: designEmployee.position,
        },
      ])
      assert.deepEqual(
        workspace.projects.map(({ id }) => id),
        ["details-design-project", "details-design-project-two"],
      )
      assert.equal(workspace.projects[0]?.id, designProject.id)
      assert.deepEqual(workspace.projects[0]?.tasks, {
        total: 2,
        completed: 1,
        incomplete: 1,
      })
      assert.deepEqual(workspace.projects[0]?.progress, {
        completed: 1,
        total: 2,
      })
      assert.deepEqual(workspace.projects[0]?.taskDueDates, [
        "2026-02-01",
        "2026-02-10",
      ])
      assert.deepEqual(
        workspace.projects[0]?.leads.map(({ id }) => id),
        [designEmployee.id],
      )
      assert.equal(workspace.projects[0]?.team.length, 1)
      assert.equal(
        JSON.stringify(workspace).includes("Private marketing project"),
        false,
      )
      assert.equal(
        JSON.stringify(workspace).includes("Marketing Assignee"),
        false,
      )
      assert.equal(
        JSON.stringify(workspace).includes(foreignClient.fullName!),
        false,
      )
      assert.equal("billing" in workspace, false)
      assert.equal("price" in workspace, false)

      const groupWithCollidingId = await request(
        actor,
        detailsPath(design.id, `group:${ungroupedCollision.id}`),
      )
      const projectWithCollidingId = await request(
        actor,
        detailsPath(design.id, `ungrouped-project:${ungroupedCollision.id}`),
      )
      assert.equal(groupWithCollidingId.status, 200)
      assert.equal(projectWithCollidingId.status, 200)
      assert.equal(
        (groupWithCollidingId.payload as WorkspaceDetails).name,
        collidingGroup.name,
      )
      assert.equal(
        (projectWithCollidingId.payload as WorkspaceDetails).name,
        ungroupedCollision.name,
      )
      assert.equal(
        (projectWithCollidingId.payload as WorkspaceDetails).kind,
        "ungrouped-project",
      )
    }

    const ungrouped = await request(
      superadmin,
      detailsPath(design.id, `ungrouped-project:${ungroupedCollision.id}`),
      "GET",
    )
    assert.equal(ungrouped.status, 200)
    assert.equal((ungrouped.payload as WorkspaceDetails).projectCount, 1)

    for (const actor of [admin, staff, client]) {
      const denied = await request(
        actor,
        detailsPath(design.id, `group:${shared.id}`),
      )
      assert.equal(denied.status, 403)
    }
    assert.equal(
      (
        await fetch(
          `${origin}/api${detailsPath(design.id, `group:${shared.id}`)}`,
        )
      ).status,
      401,
    )
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(
        (
          await request(
            superadmin,
            detailsPath(design.id, `group:${shared.id}`),
            method,
          )
        ).status,
        404,
        `${method} must not be available on the read-only details endpoint`,
      )
    }
    assert.equal(
      (
        await request(
          superadmin,
          detailsPath(design.id, `group:${otherOnly.id}`),
        )
      ).status,
      404,
    )
    assert.equal(
      (
        await request(
          superadmin,
          detailsPath(design.id, `ungrouped-project:${designProject.id}`),
        )
      ).status,
      404,
    )
    assert.equal(
      (await request(superadmin, detailsPath(design.id, `legacy-bare-id`)))
        .status,
      400,
    )
  },
)
