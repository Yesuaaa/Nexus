import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { issueSession } from "./features/auth/auth.service.js"
import type { ProjectWorkPlan } from "./features/project-workspace/templates.js"
import { getPrisma } from "./lib/db.js"

type Booking = {
  request: { id: string }
  project: { id: string }
}

type Workspace = {
  id: string
  name: string
  status: string
  structure: string
  workstreams: {
    id: string
    requestId: string | null
    status: string
    templateKey: string | null
    plan: ProjectWorkPlan | null
  }[]
}

test(
  "[NEX-003] workspace lifecycle API validates bookings, manager access, and persisted transitions",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const database = new PGlite()
    const cleanup: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}

    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await cleanup.socket?.stop()
      await database.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    await database.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((entry) => /^\d/.test(entry))
      .sort()) {
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }

    const socket = new PGLiteSocketServer({
      db: database,
      port: 0,
      host: "127.0.0.1",
    })
    cleanup.socket = socket
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma

    const head = await prisma.user.create({
      data: {
        id: "nex003-head",
        email: "nex003-head@example.com",
        fullName: "NEX-003 Department Head",
        passwordHash: "test-only-hash",
        role: "STAFF",
      },
    })
    const client = await prisma.user.create({
      data: {
        id: "nex003-client",
        email: "nex003-client@example.com",
        fullName: "NEX-003 Client",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const department = await prisma.department.create({
      data: {
        id: "nex003-department",
        name: "NEX-003 Department",
        code: "NX3",
        headId: head.id,
      },
    })
    await prisma.user.update({
      where: { id: head.id },
      data: { departmentId: department.id },
    })
    const staff = await prisma.user.create({
      data: {
        id: "nex003-staff",
        email: "nex003-staff@example.com",
        fullName: "NEX-003 Staff",
        passwordHash: "test-only-hash",
        role: "STAFF",
        departmentId: department.id,
      },
    })
    await prisma.employee.create({
      data: {
        employeeId: "NEX003-HEAD",
        fullName: head.fullName!,
        userId: head.id,
        departmentId: department.id,
      },
    })
    await prisma.employee.create({
      data: {
        employeeId: "NEX003-STAFF",
        fullName: staff.fullName!,
        userId: staff.id,
        departmentId: department.id,
      },
    })
    const service = await prisma.service.create({
      data: {
        name: "NEX-003 Test Service",
        description: "Isolated workspace lifecycle fixture.",
        departments: { connect: { id: department.id } },
      },
    })

    async function createBooking(
      key: string,
      approved: boolean,
    ): Promise<Booking> {
      const title = `NEX-003 Booking ${key}`
      const request = await prisma.serviceRequest.create({
        data: {
          id: `nex003-request-${key}`,
          clientId: client.id,
          serviceId: service.id,
          title,
          referenceNumber: `NEX003-${key}`,
          acceptedDepartmentId: department.id,
          workflow: { create: { state: "READY_FOR_ACTIVATION" } },
        },
      })
      if (approved) {
        const quotation = await prisma.workflowQuotation.create({
          data: {
            requestId: request.id,
            version: 1,
            scope: "Approved NEX-003 fixture scope",
            deliverables: [],
            lineItems: [],
            total: 100,
            currency: "PHP",
            timeline: "One week",
            paymentTerms: "Due on receipt",
            paymentDue: 100,
            validUntil: new Date("2027-01-01T00:00:00.000Z"),
            createdById: head.id,
          },
        })
        await prisma.workflowApproval.create({
          data: {
            requestId: request.id,
            quotationId: quotation.id,
            amount: 100,
            currency: "PHP",
            approvedById: head.id,
          },
        })
      }
      const project = await prisma.project.create({
        data: {
          id: `nex003-project-${key}`,
          clientId: client.id,
          name: title,
          requestId: request.id,
          status: "PLANNED",
        },
      })
      return { request, project }
    }

    const first = await createBooking("first", true)
    const second = await createBooking("second", true)
    const third = await createBooking("third", true)
    const unapproved = await createBooking("unapproved", false)

    const sessions = new Map<string, string>()
    sessions.set(head.id, (await issueSession(head)).token)
    sessions.set(staff.id, (await issueSession(staff)).token)
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/project-workspace`

    async function request(
      path: string,
      actorId: string,
      method = "GET",
      body?: unknown,
    ) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${sessions.get(actorId)}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }

    function createPayload(
      requestIds: string[],
      structure: "SEPARATE" | "MULTI_WORKSTREAM",
      name: string,
    ) {
      return {
        requestIds,
        structure,
        name,
        templateKeys: Object.fromEntries(
          requestIds.map((requestId) => [requestId, "blank-custom"]),
        ),
        customPlans: Object.fromEntries(
          requestIds.map((requestId, index) => [
            requestId,
            {
              phases: [
                {
                  id: `nex003-phase-${index}`,
                  title: "NEX-003 Plan",
                  tasks: [],
                },
              ],
            },
          ]),
        ),
      }
    }

    async function workspace(id: string): Promise<Workspace> {
      const response = await request(`/${id}`, head.id)
      assert.equal(response.status, 200, await response.clone().text())
      return (await response.json()) as Workspace
    }

    const approvedResponse = await request("/approved-bookings", head.id)
    assert.equal(approvedResponse.status, 200)
    const approvedBookings = (await approvedResponse.json()) as {
      requestId: string
      projectId: string
    }[]
    assert.deepEqual(
      approvedBookings.map(({ requestId }) => requestId).sort(),
      [first.request.id, second.request.id, third.request.id].sort(),
    )

    const groupsBefore = await prisma.projectWorkspaceGroup.count()
    const staffCreate = await request(
      "/",
      staff.id,
      "POST",
      createPayload([third.request.id], "SEPARATE", "Ignored name"),
    )
    assert.equal(staffCreate.status, 403)
    assert.equal(await prisma.projectWorkspaceGroup.count(), groupsBefore)
    assert.equal(
      (
        await prisma.project.findUniqueOrThrow({
          where: { id: third.project.id },
        })
      ).workspaceGroupId,
      null,
    )

    const invalidCreate = await request(
      "/",
      head.id,
      "POST",
      createPayload(
        [third.request.id, unapproved.request.id],
        "MULTI_WORKSTREAM",
        "Invalid mixed workspace",
      ),
    )
    assert.equal(invalidCreate.status, 409)
    assert.equal(await prisma.projectWorkspaceGroup.count(), groupsBefore)
    assert.equal(
      (
        await prisma.project.findUniqueOrThrow({
          where: { id: third.project.id },
        })
      ).workspaceGroupId,
      null,
    )
    assert.equal(
      await prisma.workflowEvent.count({
        where: {
          requestId: { in: [third.request.id, unapproved.request.id] },
          type: "WORKSPACE_CREATED",
        },
      }),
      0,
    )

    const createResponse = await request(
      "/",
      head.id,
      "POST",
      createPayload(
        [first.request.id, second.request.id],
        "MULTI_WORKSTREAM",
        "Initial NEX-003 Workspace",
      ),
    )
    assert.equal(
      createResponse.status,
      201,
      await createResponse.clone().text(),
    )
    const created = (await createResponse.json()) as {
      workspaces: { id: string; name: string }[]
    }
    assert.equal(created.workspaces.length, 1)
    const workspaceId = created.workspaces[0]!.id
    assert.equal(created.workspaces[0]!.name, "Initial NEX-003 Workspace")
    assert.equal(await prisma.projectWorkspaceGroup.count(), groupsBefore + 1)
    for (const project of [first.project, second.project]) {
      const persisted = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      })
      assert.equal(persisted.workspaceGroupId, workspaceId)
      assert.equal(persisted.templateKey, "blank-custom")
      assert.ok(persisted.workPlan)
    }
    const createdView = await workspace(workspaceId)
    assert.equal(createdView.name, "Initial NEX-003 Workspace")
    assert.equal(createdView.structure, "MULTI_WORKSTREAM")
    assert.deepEqual(
      createdView.workstreams.map(({ requestId }) => requestId).sort(),
      [first.request.id, second.request.id].sort(),
    )

    const staleCreate = await request(
      "/",
      head.id,
      "POST",
      createPayload(
        [first.request.id, third.request.id],
        "MULTI_WORKSTREAM",
        "Stale NEX-003 Workspace",
      ),
    )
    assert.equal(staleCreate.status, 409)
    assert.equal(await prisma.projectWorkspaceGroup.count(), groupsBefore + 1)
    assert.equal(
      (
        await prisma.project.findUniqueOrThrow({
          where: { id: third.project.id },
        })
      ).workspaceGroupId,
      null,
    )

    const deniedRename = await request(`/${workspaceId}`, staff.id, "PATCH", {
      name: "Unauthorized rename",
    })
    assert.equal(deniedRename.status, 404)
    const deniedCancel = await request(
      `/${workspaceId}/cancel`,
      staff.id,
      "POST",
    )
    assert.equal(deniedCancel.status, 404)
    assert.equal(
      (await workspace(workspaceId)).name,
      "Initial NEX-003 Workspace",
    )
    assert.deepEqual(
      (
        await prisma.project.findMany({
          where: { id: { in: [first.project.id, second.project.id] } },
          select: { status: true },
        })
      )
        .map(({ status }) => status)
        .sort(),
      ["PLANNED", "PLANNED"],
    )

    const renamed = await request(`/${workspaceId}`, head.id, "PATCH", {
      name: "  Renamed NEX-003 Workspace  ",
    })
    assert.equal(renamed.status, 200)
    assert.deepEqual(await renamed.json(), { saved: true })
    assert.equal(
      (await workspace(workspaceId)).name,
      "Renamed NEX-003 Workspace",
    )

    const invalidHold = await request(
      `/${workspaceId}/status`,
      head.id,
      "POST",
      { action: "ON_HOLD" },
    )
    assert.equal(invalidHold.status, 409)
    assert.deepEqual(
      (
        await prisma.project.findMany({
          where: { id: { in: [first.project.id, second.project.id] } },
          select: { status: true },
        })
      )
        .map(({ status }) => status)
        .sort(),
      ["PLANNED", "PLANNED"],
    )

    await prisma.project.updateMany({
      where: { id: { in: [first.project.id, second.project.id] } },
      data: { status: "IN_PROGRESS" },
    })
    const heldResponse = await request(
      `/${workspaceId}/status`,
      head.id,
      "POST",
      { action: "ON_HOLD" },
    )
    assert.equal(heldResponse.status, 200, await heldResponse.clone().text())
    const held = (await heldResponse.json()) as Workspace
    assert.equal(held.status, "ON_HOLD")
    assert.ok(held.workstreams.every(({ status }) => status === "ON_HOLD"))

    const resumedResponse = await request(
      `/${workspaceId}/status`,
      head.id,
      "POST",
      { action: "RESUME" },
    )
    assert.equal(
      resumedResponse.status,
      200,
      await resumedResponse.clone().text(),
    )
    const resumed = (await resumedResponse.json()) as Workspace
    assert.equal(resumed.status, "IN_PROGRESS")
    assert.ok(
      resumed.workstreams.every(({ status }) => status === "IN_PROGRESS"),
    )
    assert.ok(
      (
        await prisma.project.findMany({
          where: { id: { in: [first.project.id, second.project.id] } },
          select: { status: true },
        })
      ).every(({ status }) => status === "IN_PROGRESS"),
    )

    const invalidResume = await request(
      `/${workspaceId}/status`,
      head.id,
      "POST",
      { action: "RESUME" },
    )
    assert.equal(invalidResume.status, 409)
    assert.equal((await workspace(workspaceId)).status, "IN_PROGRESS")

    const completedResponse = await request(
      `/${workspaceId}/status`,
      head.id,
      "POST",
      { action: "COMPLETE" },
    )
    assert.equal(
      completedResponse.status,
      200,
      await completedResponse.clone().text(),
    )
    const completed = (await completedResponse.json()) as Workspace
    assert.equal(completed.status, "COMPLETED")
    assert.ok(
      completed.workstreams.every(({ status }) => status === "COMPLETED"),
    )
    assert.ok(
      (
        await prisma.project.findMany({
          where: { id: { in: [first.project.id, second.project.id] } },
          select: { status: true },
        })
      ).every(({ status }) => status === "COMPLETED"),
    )

    const archivedRename = await request(`/${workspaceId}`, head.id, "PATCH", {
      name: "Cannot rename completed workspace",
    })
    assert.equal(archivedRename.status, 409)
    assert.equal(
      (await workspace(workspaceId)).name,
      "Renamed NEX-003 Workspace",
    )

    const separateCreate = await request(
      "/",
      head.id,
      "POST",
      createPayload([third.request.id], "SEPARATE", "Ignored separate name"),
    )
    assert.equal(
      separateCreate.status,
      201,
      await separateCreate.clone().text(),
    )
    const separate = (await separateCreate.json()) as {
      workspaces: { id: string; name: string }[]
    }
    assert.equal(separate.workspaces.length, 1)
    const cancellableId = separate.workspaces[0]!.id
    const deniedSeparateCancel = await request(
      `/${cancellableId}/cancel`,
      staff.id,
      "POST",
    )
    assert.equal(deniedSeparateCancel.status, 404)
    assert.equal(
      (
        await prisma.project.findUniqueOrThrow({
          where: { id: third.project.id },
        })
      ).status,
      "PLANNED",
    )

    const cancelledResponse = await request(
      `/${cancellableId}/cancel`,
      head.id,
      "POST",
    )
    assert.equal(cancelledResponse.status, 200)
    assert.deepEqual(await cancelledResponse.json(), { saved: true })
    assert.equal((await workspace(cancellableId)).status, "CANCELLED")
    assert.equal(
      (
        await prisma.project.findUniqueOrThrow({
          where: { id: third.project.id },
        })
      ).status,
      "CANCELLED",
    )
    const repeatedCancel = await request(
      `/${cancellableId}/cancel`,
      head.id,
      "POST",
    )
    assert.equal(repeatedCancel.status, 409)
    assert.equal((await workspace(cancellableId)).status, "CANCELLED")

    await t.test(
      "[NEX-004] plan and task API updates persist and enforce project scope",
      async () => {
        const booking = await createBooking("plan-tasks", true)
        const createWorkspace = await request(
          "/",
          head.id,
          "POST",
          createPayload([booking.request.id], "SEPARATE", ""),
        )
        assert.equal(createWorkspace.status, 201)
        const createdWorkspace = (await createWorkspace.json()) as {
          workspaces: { id: string }[]
        }
        const workspaceId = createdWorkspace.workspaces[0]!.id
        const originalProject = await prisma.project.findUniqueOrThrow({
          where: { id: booking.project.id },
          select: { updatedAt: true },
        })
        const plan: ProjectWorkPlan = {
          phases: [
            {
              id: "nex004-planning",
              title: "Planning",
              tasks: [
                {
                  id: "nex004-scope-task",
                  title: "Confirm scope",
                  role: "Project lead",
                  status: "NOT_STARTED",
                },
              ],
            },
          ],
        }
        const projectPath = `/${workspaceId}/projects/${booking.project.id}`
        const savePlan = await request(`${projectPath}/plan`, head.id, "PUT", {
          plan,
          expectedUpdatedAt: originalProject.updatedAt.toISOString(),
        })
        assert.equal(savePlan.status, 200, await savePlan.clone().text())

        type WorkspacePlanResponse = {
          workstreams: { id: string; plan: ProjectWorkPlan | null }[]
        }
        function planFromResponse(response: WorkspacePlanResponse) {
          const workstream = response.workstreams.find(
            ({ id }) => id === booking.project.id,
          )
          assert.ok(workstream?.plan)
          return workstream.plan
        }
        async function readProjectPlan(actorId: string) {
          const response = await request(`/${workspaceId}`, actorId)
          assert.equal(response.status, 200, await response.clone().text())
          return planFromResponse(
            (await response.json()) as WorkspacePlanResponse,
          )
        }
        async function persistedProjectPlan(projectId: string) {
          return (
            await prisma.project.findUniqueOrThrow({
              where: { id: projectId },
              select: { workPlan: true },
            })
          ).workPlan
        }

        assert.deepEqual(
          planFromResponse((await savePlan.json()) as WorkspacePlanResponse),
          plan,
        )
        assert.deepEqual(await readProjectPlan(head.id), plan)
        assert.deepEqual(await persistedProjectPlan(booking.project.id), plan)

        const staffEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: staff.id },
        })
        await prisma.projectStaff.create({
          data: {
            projectId: booking.project.id,
            employeeId: staffEmployee.id,
            approvedById: head.id,
          },
        })

        const addTask = await request(
          `${projectPath}/tasks`,
          staff.id,
          "POST",
          {
            phaseId: "nex004-planning",
            title: "  Prepare assets  ",
            role: "Designer",
          },
        )
        assert.equal(addTask.status, 200, await addTask.clone().text())
        const addedPlan = planFromResponse(
          (await addTask.json()) as WorkspacePlanResponse,
        )
        const addedTask = addedPlan.phases[0]!.tasks.find(
          ({ title }) => title === "Prepare assets",
        )
        assert.ok(addedTask)
        assert.equal(addedTask.role, "Designer")
        assert.equal(addedTask.status, "NOT_STARTED")
        assert.deepEqual(await readProjectPlan(staff.id), addedPlan)
        assert.deepEqual(
          await persistedProjectPlan(booking.project.id),
          addedPlan,
        )

        const updateTask = await request(
          `${projectPath}/tasks/${addedTask.id}`,
          staff.id,
          "PATCH",
          { status: "IN_PROGRESS" },
        )
        assert.equal(updateTask.status, 200, await updateTask.clone().text())
        const updatedPlan = planFromResponse(
          (await updateTask.json()) as WorkspacePlanResponse,
        )
        const expectedUpdatedPlan: ProjectWorkPlan = {
          phases: addedPlan.phases.map((phase) => ({
            ...phase,
            tasks: phase.tasks.map((task) =>
              task.id === addedTask.id
                ? { ...task, status: "IN_PROGRESS" }
                : task,
            ),
          })),
        }
        assert.deepEqual(updatedPlan, expectedUpdatedPlan)
        assert.deepEqual(await readProjectPlan(staff.id), expectedUpdatedPlan)
        assert.deepEqual(
          await persistedProjectPlan(booking.project.id),
          expectedUpdatedPlan,
        )

        const unchangedPlan = await persistedProjectPlan(booking.project.id)
        const invalidTask = await request(
          `${projectPath}/tasks`,
          staff.id,
          "POST",
          { phaseId: "nex004-planning", title: "x" },
        )
        assert.equal(invalidTask.status, 400)
        assert.deepEqual(
          await persistedProjectPlan(booking.project.id),
          unchangedPlan,
        )
        assert.deepEqual(await readProjectPlan(staff.id), expectedUpdatedPlan)

        const invalidStatus = await request(
          `${projectPath}/tasks/${addedTask.id}`,
          staff.id,
          "PATCH",
          { status: "BLOCKED" },
        )
        assert.equal(invalidStatus.status, 400)
        assert.deepEqual(
          await persistedProjectPlan(booking.project.id),
          unchangedPlan,
        )
        assert.deepEqual(await readProjectPlan(staff.id), expectedUpdatedPlan)

        const secondPlanBeforeOutOfScopeRequest = await persistedProjectPlan(
          second.project.id,
        )
        const outOfScope = await request(
          `/${workspaceId}/projects/${second.project.id}/tasks`,
          staff.id,
          "POST",
          { phaseId: "nex003-phase-1", title: "Unassigned project task" },
        )
        assert.equal(outOfScope.status, 404)
        assert.deepEqual(
          await persistedProjectPlan(second.project.id),
          secondPlanBeforeOutOfScopeRequest,
        )
      },
    )

    await t.test(
      "[NEX-005] deliverable uploads, review, rejection, and sharing enforce access and persist transitions",
      async () => {
        const booking = await createBooking("deliverable", true)
        const createWorkspace = await request(
          "/",
          head.id,
          "POST",
          createPayload(
            [booking.request.id],
            "SEPARATE",
            "NEX-005 Deliverable Workspace",
          ),
        )
        assert.equal(createWorkspace.status, 201)
        const createdWorkspace = (await createWorkspace.json()) as {
          workspaces: { id: string }[]
        }
        const workspaceId = createdWorkspace.workspaces[0]!.id
        const staffEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: staff.id },
        })
        const outsider = await prisma.user.create({
          data: {
            id: "nex003-outsider",
            email: "nex003-outsider@example.com",
            fullName: "NEX-005 Unassigned Staff",
            passwordHash: "test-only-hash",
            role: "STAFF",
            departmentId: department.id,
          },
        })
        await prisma.employee.create({
          data: {
            employeeId: "NEX005-OUTSIDER",
            fullName: outsider.fullName!,
            userId: outsider.id,
            departmentId: department.id,
          },
        })
        sessions.set(outsider.id, (await issueSession(outsider)).token)
        await prisma.projectStaff.create({
          data: {
            projectId: booking.project.id,
            employeeId: staffEmployee.id,
            approvedById: head.id,
          },
        })
        await prisma.requestWorkflow.update({
          where: { requestId: booking.request.id },
          data: { state: "ACTIVE_PROJECT" },
        })
        await prisma.project.update({
          where: { id: booking.project.id },
          data: { status: "IN_PROGRESS" },
        })
        const deliverable = await prisma.projectMilestone.create({
          data: { projectId: booking.project.id, title: "Brand guide" },
        })
        const path = `/${workspaceId}/projects/${booking.project.id}/deliverables/${deliverable.id}`
        const upload = (fileName: string, content: string) => ({
          uploadId: randomUUID(),
          name: fileName,
          mimeType: "text/plain",
          content: Buffer.from(content).toString("base64"),
        })
        const milestone = () =>
          prisma.projectMilestone.findUniqueOrThrow({
            where: { id: deliverable.id },
            include: { workflowFile: true },
          })

        const headUpload = await request(
          `${path}/attachment`,
          head.id,
          "POST",
          upload("head.txt", "head cannot submit"),
        )
        assert.equal(headUpload.status, 403)
        assert.equal((await milestone()).deliveryStatus, "NOT_SUBMITTED")
        assert.equal(await prisma.workflowFile.count(), 0)

        const outsiderUpload = await request(
          `${path}/attachment`,
          outsider.id,
          "POST",
          upload("outsider.txt", "Unassigned staff cannot submit"),
        )
        assert.equal(outsiderUpload.status, 404)
        assert.equal((await milestone()).deliveryStatus, "NOT_SUBMITTED")
        assert.equal(await prisma.workflowFile.count(), 0)

        const firstUpload = await request(
          `${path}/attachment`,
          staff.id,
          "POST",
          upload("draft.txt", "Draft one"),
        )
        assert.equal(firstUpload.status, 201, await firstUpload.clone().text())
        const firstSaved = await milestone()
        assert.equal(firstSaved.deliveryStatus, "IN_REVIEW")
        assert.equal(firstSaved.workflowFile?.clientVisible, false)
        assert.equal(
          Buffer.from(firstSaved.workflowFile!.data).toString(),
          "Draft one",
        )

        const headRemove = await request(
          `${path}/attachment`,
          head.id,
          "DELETE",
        )
        assert.equal(headRemove.status, 403)
        assert.equal(
          (await milestone()).workflowFileId,
          firstSaved.workflowFileId,
        )

        const outsiderRemove = await request(
          `${path}/attachment`,
          outsider.id,
          "DELETE",
        )
        assert.equal(outsiderRemove.status, 404)
        assert.equal(
          (await milestone()).workflowFileId,
          firstSaved.workflowFileId,
        )

        const removed = await request(`${path}/attachment`, staff.id, "DELETE")
        assert.equal(removed.status, 200, await removed.clone().text())
        const afterRemove = await milestone()
        assert.equal(afterRemove.deliveryStatus, "NOT_SUBMITTED")
        assert.equal(afterRemove.workflowFileId, null)
        assert.equal(
          await prisma.workflowFile.count({
            where: { id: firstSaved.workflowFileId! },
          }),
          0,
        )

        const repeatedRemove = await request(
          `${path}/attachment`,
          staff.id,
          "DELETE",
        )
        assert.equal(repeatedRemove.status, 409)
        assert.equal((await milestone()).deliveryStatus, "NOT_SUBMITTED")

        const secondUpload = await request(
          `${path}/attachment`,
          staff.id,
          "POST",
          upload("draft.txt", "Draft two"),
        )
        assert.equal(
          secondUpload.status,
          201,
          await secondUpload.clone().text(),
        )
        const inReview = await milestone()
        assert.equal(inReview.deliveryStatus, "IN_REVIEW")
        assert.equal(inReview.workflowFile?.clientVisible, false)

        for (const reason of ["", "ok", "x".repeat(2001)]) {
          const invalidReject = await request(
            `${path}/reject`,
            head.id,
            "POST",
            {
              reason,
            },
          )
          assert.equal(invalidReject.status, 400)
          const unchanged = await milestone()
          assert.equal(unchanged.deliveryStatus, "IN_REVIEW")
          assert.equal(unchanged.rejectionReason, null)
        }
        const staffReject = await request(`${path}/reject`, staff.id, "POST", {
          reason: "Please revise the layout",
        })
        assert.equal(staffReject.status, 403)
        assert.equal((await milestone()).deliveryStatus, "IN_REVIEW")

        const prematureSend = await request(`${path}/send`, head.id, "POST")
        assert.equal(prematureSend.status, 409)
        assert.equal((await milestone()).deliveryStatus, "IN_REVIEW")
        assert.equal((await milestone()).workflowFile?.clientVisible, false)

        const rejected = await request(`${path}/reject`, head.id, "POST", {
          reason: "  Please revise the layout.  ",
        })
        assert.equal(rejected.status, 200, await rejected.clone().text())
        const rejectedMilestone = await milestone()
        assert.equal(rejectedMilestone.deliveryStatus, "REJECTED")
        assert.equal(
          rejectedMilestone.rejectionReason,
          "Please revise the layout.",
        )
        assert.equal(rejectedMilestone.reviewedById, head.id)
        assert.equal(rejectedMilestone.workflowFile?.clientVisible, false)

        const retry = await request(
          `${path}/attachment`,
          staff.id,
          "POST",
          upload("draft-v2.txt", "Revised draft"),
        )
        assert.equal(retry.status, 201, await retry.clone().text())
        const resubmitted = await milestone()
        assert.equal(resubmitted.deliveryStatus, "IN_REVIEW")
        assert.equal(resubmitted.rejectionReason, null)
        assert.equal(resubmitted.workflowFile?.name, "draft-v2.txt")
        assert.equal(resubmitted.workflowFile?.clientVisible, false)

        const staffApprove = await request(`${path}/approve`, staff.id, "POST")
        assert.equal(staffApprove.status, 403)
        assert.equal((await milestone()).deliveryStatus, "IN_REVIEW")

        const approved = await request(`${path}/approve`, head.id, "POST")
        assert.equal(approved.status, 200, await approved.clone().text())
        const approvedMilestone = await milestone()
        assert.equal(approvedMilestone.deliveryStatus, "APPROVED")
        assert.equal(approvedMilestone.workflowFile?.clientVisible, false)

        const staffSend = await request(`${path}/send`, staff.id, "POST")
        assert.equal(staffSend.status, 403)
        assert.equal((await milestone()).deliveryStatus, "APPROVED")

        const lockedRemove = await request(
          `${path}/attachment`,
          staff.id,
          "DELETE",
        )
        assert.equal(lockedRemove.status, 409)
        assert.equal((await milestone()).deliveryStatus, "APPROVED")

        const sent = await request(`${path}/send`, head.id, "POST")
        assert.equal(sent.status, 200, await sent.clone().text())
        const sentMilestone = await milestone()
        assert.equal(sentMilestone.deliveryStatus, "SENT_TO_CLIENT")
        assert.equal(sentMilestone.workflowFile?.clientVisible, true)
        assert.ok(sentMilestone.sentToClientAt)

        const editSent = await request(path, head.id, "PATCH", {
          title: "Changed after sharing",
        })
        assert.equal(editSent.status, 409)
        assert.equal((await milestone()).title, "Brand guide")
        assert.equal((await milestone()).deliveryStatus, "SENT_TO_CLIENT")
      },
    )
  },
)
