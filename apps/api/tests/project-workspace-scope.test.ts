import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "workspace reads and renames respect department ownership",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const [head, staff, client] = await Promise.all(
      ["head", "staff", "client"].map((name) =>
        prisma.user.create({
          data: {
            email: `${name}@example.com`,
            fullName: name,
            role: name === "client" ? "USER" : "STAFF",
            passwordHash: "test-only",
          },
        }),
      ),
    )
    const own = await prisma.department.create({
      data: { name: "Design", headId: head.id },
    })
    const other = await prisma.department.create({
      data: { name: "Operations" },
    })
    await prisma.user.update({
      where: { id: head.id },
      data: { departmentId: other.id },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "SCOPE-1",
        fullName: "Staff",
        userId: staff.id,
        departmentId: own.id,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Design", description: "Design service" },
    })
    const mixed = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Shared workspace",
        clientId: client.id,
        createdById: head.id,
        structure: "MULTI_WORKSTREAM",
        updatedAt: new Date("2030-01-01T00:00:00Z"),
      },
    })
    const singleDepartment = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Design workspace",
        clientId: client.id,
        createdById: head.id,
        structure: "SEPARATE",
      },
    })
    const projectUpdatedAt = new Date("2025-01-01T00:00:00Z")
    async function project(
      name: string,
      departmentId: string | null,
      workspaceGroupId?: string,
    ) {
      const request = await prisma.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: service.id,
          title: name,
          acceptedDepartmentId: departmentId,
          workflow: { create: { state: "ACTIVE_PROJECT" } },
        },
      })
      return prisma.project.create({
        data: {
          clientId: client.id,
          requestId: request.id,
          workspaceGroupId,
          name,
          status: departmentId === own.id ? "PLANNED" : "IN_PROGRESS",
          updatedAt: projectUpdatedAt,
          ...(departmentId === null
            ? {
                staff: {
                  create: { employeeId: employee.id, approvedById: head.id },
                },
              }
            : {}),
        },
      })
    }
    const visible = await project("Design brief", own.id, mixed.id)
    const hidden = await project("Operations brief", other.id, mixed.id)
    const unowned = await project("Assigned legacy project", null, mixed.id)
    await project("Design delivery", own.id, singleDepartment.id)
    const otherOnly = await prisma.projectWorkspaceGroup.create({
      data: {
        name: "Operations workspace",
        clientId: client.id,
        createdById: head.id,
        structure: "SEPARATE",
      },
    })
    await project("Operations delivery", other.id, otherOnly.id)

    async function apiFor(user: typeof head) {
      const { token } = await issueSession(user)
      return (path = "", method = "GET", body?: unknown) =>
        fetch(`${origin}/api/project-workspace${path}`, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
    }
    const headApi = await apiFor(head)
    const staffApi = await apiFor(staff)
    const list = await headApi()
    assert.equal(list.status, 200)
    type Workspace = {
      id: string
      name: string
      status: string
      updatedAt: string
      canManage: boolean
      canRename: boolean
      workstreams: { id: string }[]
    }
    const { workspaces } = (await list.json()) as { workspaces: Workspace[] }
    assert.equal(workspaces.length, 2)
    const mixedRow = workspaces.find((row) => row.id === mixed.id)
    assert.ok(mixedRow)
    assert.equal(mixedRow.name, mixed.name)
    assert.equal(mixedRow.status, "PLANNED")
    assert.equal(mixedRow.updatedAt, projectUpdatedAt.toISOString())
    assert.equal(mixedRow.canManage, true)
    assert.equal(mixedRow.canRename, false)
    assert.deepEqual(
      mixedRow.workstreams.map(({ id }: { id: string }) => id),
      [visible.id],
    )
    assert.equal(
      workspaces.find((row) => row.id === singleDepartment.id)?.canRename,
      true,
    )

    const detail = await headApi(`/${mixed.id}`)
    assert.equal(detail.status, 200)
    const mixedDetail = (await detail.json()) as Workspace
    assert.equal(mixedDetail.canRename, false)
    assert.deepEqual(
      mixedDetail.workstreams.map(({ id }: { id: string }) => id),
      [visible.id],
    )
    for (const id of [hidden.id, unowned.id, otherOnly.id]) {
      assert.equal((await headApi(`/${id}`)).status, 404)
    }
    assert.equal(
      (await headApi(`/${mixed.id}`, "PATCH", { name: "Rejected rename" }))
        .status,
      403,
    )
    assert.equal(
      (
        await headApi(`/${visible.id}`, "PATCH", {
          name: "Rejected project-ID rename",
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await prisma.projectWorkspaceGroup.findUniqueOrThrow({
          where: { id: mixed.id },
        })
      ).name,
      mixed.name,
    )
    // A previously returned canRename flag must not authorize a stale rename.
    await prisma.project.update({
      where: { id: hidden.id },
      data: { workspaceGroupId: singleDepartment.id },
    })
    assert.equal(
      (
        await headApi(`/${singleDepartment.id}`, "PATCH", {
          name: "Stale rename",
        })
      ).status,
      403,
    )
    await prisma.project.update({
      where: { id: hidden.id },
      data: { workspaceGroupId: mixed.id },
    })
    assert.equal(
      (
        await headApi(`/${singleDepartment.id}`, "PATCH", {
          name: "Renamed design workspace",
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await prisma.projectWorkspaceGroup.findUniqueOrThrow({
          where: { id: singleDepartment.id },
        })
      ).name,
      "Renamed design workspace",
    )

    const staffDetail = await staffApi(`/${mixed.id}`)
    assert.equal(staffDetail.status, 200)
    const staffWorkspace = (await staffDetail.json()) as Workspace
    assert.equal(staffWorkspace.canRename, false)
    assert.deepEqual(
      staffWorkspace.workstreams.map(({ id }: { id: string }) => id),
      [unowned.id],
    )
    assert.equal(
      (await staffApi(`/${mixed.id}`, "PATCH", { name: "Staff rename" }))
        .status,
      403,
    )

    const booking = await project("Approved design booking", own.id)
    assert.ok(booking.requestId)
    async function directory(query = "") {
      const response = await headApi(`/directory?${query}`)
      assert.equal(response.status, 200)
      return (await response.json()) as {
        total: number
        totalPages: number
        rows: {
          id: string
          rowId: string
          kind: string
          statuses: string[]
          projectCount: number
          canRename: boolean
          updatedAt: string
          progress: { completed: number; total: number } | null
        }[]
      }
    }
    assert.equal((await staffApi("/directory")).status, 403)
    assert.equal((await directory("search=Operations")).total, 0)
    assert.equal((await directory("status=IN_PROGRESS")).total, 0)
    assert.equal((await directory("view=archive")).total, 0)
    const mixedDirectoryRow = (await directory("search=Shared")).rows[0]
    assert.equal(mixedDirectoryRow.canRename, false)
    assert.equal(mixedDirectoryRow.projectCount, 1)
    assert.deepEqual(mixedDirectoryRow.statuses, ["PLANNED"])
    assert.equal(mixedDirectoryRow.updatedAt, projectUpdatedAt.toISOString())
    const before = (await directory("search=approved%20design")).rows[0]
    assert.equal(before.id, booking.id)
    assert.equal(before.rowId, `ungrouped-project:${booking.id}`)
    assert.equal(before.kind, "ungrouped-project")
    assert.equal(before.canRename, false)
    assert.equal(before.progress, null)
    assert.equal((await headApi(`/${before.id}`)).status, 200)
    for (let index = 0; index < 9; index++) {
      await project(`Extra project ${index}`, own.id)
    }
    const firstPage = await directory("sort=recent")
    const secondPage = await directory("sort=recent&page=2")
    assert.equal(firstPage.total, 12)
    assert.equal(firstPage.totalPages, 2)
    assert.equal(firstPage.rows.length, 10)
    assert.equal(secondPage.rows.length, 2)
    const rowIds = [...firstPage.rows, ...secondPage.rows].map(
      ({ rowId }) => rowId,
    )
    assert.deepEqual(rowIds, [...new Set(rowIds)].sort())
    const quotation = await prisma.workflowQuotation.create({
      data: {
        requestId: booking.requestId,
        version: 1,
        scope: "Design",
        deliverables: ["Design brief"],
        lineItems: [],
        total: 100,
        currency: "PHP",
        timeline: "One week",
        paymentTerms: "Full payment",
        paymentDue: 100,
        validUntil: new Date("2030-01-01T00:00:00Z"),
        createdById: head.id,
      },
    })
    await prisma.workflowApproval.create({
      data: {
        requestId: booking.requestId,
        quotationId: quotation.id,
        amount: 100,
        currency: "PHP",
        approvedById: client.id,
      },
    })
    const bookings = await headApi("/approved-bookings")
    assert.equal(bookings.status, 200)
    assert.deepEqual(
      ((await bookings.json()) as { requestId: string }[]).map(
        ({ requestId }) => requestId,
      ),
      [booking.requestId],
    )
    const setup = await headApi("", "POST", {
      requestIds: [booking.requestId],
      templateKeys: { [booking.requestId]: "website-development" },
      structure: "SEPARATE",
    })
    assert.equal(setup.status, 201)
    const created = (await setup.json()) as { workspaces: { id: string }[] }
    assert.equal((await headApi(`/${created.workspaces[0].id}`)).status, 200)
    const after = (await directory("search=approved%20design")).rows[0]
    assert.equal(after.rowId, `group:${created.workspaces[0].id}`)
    assert.equal(after.kind, "group")
    assert.equal(after.canRename, true)
    assert.ok(after.progress && after.progress.total > 0)
    const completed = await project("Completed design", own.id, mixed.id)
    await prisma.project.update({
      where: { id: completed.id },
      data: { status: "COMPLETED" },
    })
    const activeMixed = await directory("status=COMPLETED")
    assert.deepEqual(
      activeMixed.rows.map(({ id }) => id),
      [mixed.id],
    )
    assert.deepEqual(activeMixed.rows[0].statuses, ["PLANNED", "COMPLETED"])
    assert.equal((await directory("view=archive&status=COMPLETED")).total, 0)
    await prisma.project.update({
      where: { id: visible.id },
      data: { status: "CANCELLED" },
    })
    const archived = await directory("view=archive")
    assert.deepEqual(
      archived.rows.map(({ id }) => id),
      [mixed.id],
    )
    assert.equal(archived.rows[0].canRename, false)

    const collision = await project("Standalone collision", own.id)
    const collidingGroup = await prisma.projectWorkspaceGroup.create({
      data: {
        id: collision.id,
        name: "Colliding group",
        structure: "SEPARATE",
        clientId: client.id,
        createdById: head.id,
      },
    })
    const member = await project(
      "Colliding group member",
      own.id,
      collidingGroup.id,
    )
    const groupPath = `/group%3A${collision.id}`
    const projectPath = `/ungrouped-project%3A${collision.id}`
    const collidingRows = (await directory("search=colli")).rows
    assert.deepEqual(
      new Set(collidingRows.map(({ rowId }) => rowId)),
      new Set([`group:${collision.id}`, `ungrouped-project:${collision.id}`]),
    )
    const groupDetail = await headApi(groupPath)
    const projectDetail = await headApi(projectPath)
    assert.equal(groupDetail.status, 200)
    assert.equal(projectDetail.status, 200)
    assert.deepEqual(
      ((await groupDetail.json()) as Workspace).workstreams.map(({ id }) => id),
      [member.id],
    )
    const standalone = (await projectDetail.json()) as Workspace
    assert.deepEqual(
      standalone.workstreams.map(({ id }) => id),
      [collision.id],
    )
    assert.equal(standalone.canRename, false)
    assert.equal((await headApi(`/group%3A${booking.id}`)).status, 404)
    assert.equal(
      (
        await headApi(`${projectPath}/projects/${member.id}/tasks`, "POST", {
          phaseId: "phase",
          title: "Wrong target",
        })
      ).status,
      404,
    )
    assert.equal(
      (await headApi(projectPath, "PATCH", { name: "Forbidden rename" }))
        .status,
      403,
    )
    assert.equal((await staffApi(`${projectPath}/cancel`, "POST")).status, 404)
    assert.equal(
      (await headApi(`/ungrouped-project%3A${hidden.id}/cancel`, "POST"))
        .status,
      404,
    )
    assert.equal((await headApi(`${projectPath}/cancel`, "POST")).status, 200)
    assert.equal(
      (await prisma.project.findUniqueOrThrow({ where: { id: collision.id } }))
        .status,
      "CANCELLED",
    )
    assert.equal(
      (await prisma.project.findUniqueOrThrow({ where: { id: member.id } }))
        .status,
      "PLANNED",
    )
    assert.ok(member.requestId)
    await prisma.serviceRequest.update({
      where: { id: member.requestId },
      data: { acceptedDepartmentId: other.id },
    })
    assert.equal((await headApi(groupPath)).status, 404)
    assert.equal((await headApi(`${groupPath}/cancel`, "POST")).status, 404)
    assert.equal((await headApi(projectPath)).status, 200)
    assert.equal(
      (await headApi(`/ungrouped-project%3A${booking.id}`)).status,
      404,
    )
    assert.equal(
      (await headApi(`/group%3A${created.workspaces[0].id}`)).status,
      200,
    )
  },
)
