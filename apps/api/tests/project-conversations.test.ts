import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { Role } from "../src/generated/prisma/client.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "project chats enforce current membership, group delivery, unread state and completion archives",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api`
    async function user(name: string, role: Role) {
      const record = await prisma!.user.create({
        data: {
          email: `${name}@example.com`,
          fullName: name,
          role,
          passwordHash: "test-only",
        },
      })
      return { ...record, token: (await issueSession(record)).token }
    }
    const client = await user("Client", "USER")
    const otherClient = await user("OtherClient", "USER")
    const staff = await user("Staff", "STAFF")
    const teammate = await user("Teammate", "STAFF")
    const outsider = await user("Outsider", "STAFF")
    const head = await user("Head", "STAFF")
    const admin = await user("Admin", "ADMIN")
    const department = await prisma.department.create({
      data: { name: "Design", headId: head.id },
    })
    const team = await prisma.team.create({
      data: { name: "Design team", departmentId: department.id },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "CHAT-1",
        fullName: "Staff",
        userId: staff.id,
        departmentId: department.id,
        teamId: team.id,
      },
    })
    const teammateEmployee = await prisma.employee.create({
      data: {
        employeeId: "CHAT-2",
        fullName: "Teammate",
        userId: teammate.id,
        departmentId: department.id,
        teamId: team.id,
      },
    })
    const service = await prisma.service.create({
      data: { name: "Design", description: "Design service" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Brand project",
        acceptedDepartmentId: department.id,
        workflow: { create: { state: "ACTIVE_PROJECT" } },
      },
    })
    const project = await prisma.project.create({
      data: {
        name: "Brand project",
        clientId: client.id,
        requestId: request.id,
        description: "Create a brand identity.",
        status: "IN_PROGRESS",
        startDate: new Date(),
        workPlan: {
          phases: [
            {
              id: "phase",
              title: "Delivery",
              tasks: [
                {
                  id: "task",
                  title: "Finish",
                  role: "Designer",
                  status: "DONE",
                },
              ],
            },
          ],
        },
        staff: { create: { employeeId: employee.id, approvedById: head.id } },
      },
    })
    const planned = await prisma.project.create({
      data: {
        name: "Not started",
        clientId: client.id,
        status: "PLANNED",
        staff: { create: { employeeId: employee.id, approvedById: head.id } },
      },
    })
    async function call(
      who: { token: string },
      path: string,
      method = "GET",
      body?: unknown,
    ) {
      return fetch(`${base}/project-conversations${path}`, {
        method,
        headers: {
          authorization: `Bearer ${who.token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    type ChatList = {
      conversations: {
        id: string
        isGroup: boolean
        participants: { id: string }[]
        unreadCount: number
      }[]
      unreadCount: number
      nextCursor: string | null
    }
    const list = (await (await call(client, "")).json()) as ChatList
    assert.deepEqual(
      list.conversations.map((chat) => chat.id),
      [project.id],
    )
    assert.equal(list.conversations[0].isGroup, false)
    for (const who of [client, staff]) {
      const history = (await (await call(who, `/${project.id}`)).json()) as {
        project: unknown
      }
      assert.deepEqual(history.project, {
        id: project.id,
        name: project.name,
        description: "Create a brand identity.",
        status: "IN_PROGRESS",
        startDate: project.startDate!.toISOString(),
        workspaceId: project.id,
        serviceName: service.name,
        referenceNumber: request.referenceNumber,
      })
    }
    assert.equal((await call(client, `/${planned.id}`)).status, 404)
    assert.equal((await fetch(`${base}/project-conversations`)).status, 401)
    for (const who of [outsider, otherClient, head]) {
      assert.equal((await call(who, `/${project.id}`)).status, 404)
      assert.equal(
        (await call(who, `/${project.id}/read`, "PATCH")).status,
        404,
      )
      assert.equal(
        (
          await call(who, `/${project.id}/messages`, "POST", {
            body: "Unauthorized",
            clientMessageId: randomUUID(),
          })
        ).status,
        404,
      )
    }
    assert.equal((await call(admin, "")).status, 403)
    assert.equal(
      (await call(client, `/${project.id}?before=missing`)).status,
      400,
    )
    assert.equal(
      (
        await call(client, `/${project.id}/messages`, "POST", {
          body: " ",
          clientMessageId: randomUUID(),
        })
      ).status,
      400,
    )
    const message = { body: "Hello designer", clientMessageId: randomUUID() }
    const first = await call(client, `/${project.id}/messages`, "POST", message)
    assert.equal(first.status, 201)
    const firstBody = (await first.json()) as { message: { id: string } }
    const retry = (await (
      await call(client, `/${project.id}/messages`, "POST", message)
    ).json()) as { message: { id: string } }
    assert.equal(firstBody.message.id, retry.message.id)
    assert.equal(
      (
        await call(client, `/${project.id}/messages`, "POST", {
          ...message,
          body: "Changed",
        })
      ).status,
      409,
    )
    const staffList = (await (await call(staff, "")).json()) as ChatList
    assert.equal(staffList.unreadCount, 1)
    const read = (await (
      await call(staff, `/${project.id}/read`, "PATCH")
    ).json()) as { unreadCount: number }
    assert.equal(read.unreadCount, 0)
    assert.equal(
      (
        await call(staff, `/${project.id}/messages`, "POST", {
          body: "Hello client",
          clientMessageId: randomUUID(),
        })
      ).status,
      201,
    )
    await prisma.projectStaff.create({
      data: {
        projectId: project.id,
        employeeId: teammateEmployee.id,
        approvedById: head.id,
      },
    })
    const group = (await (await call(teammate, "")).json()) as ChatList
    assert.equal(group.conversations[0].isGroup, true)
    assert.deepEqual(
      new Set(group.conversations[0].participants.map((person) => person.id)),
      new Set([client.id, staff.id, teammate.id]),
    )
    assert.equal(
      (
        await call(teammate, `/${project.id}/messages`, "POST", {
          body: "Team update",
          clientMessageId: randomUUID(),
        })
      ).status,
      201,
    )
    const history = (await (await call(client, `/${project.id}`)).json()) as {
      messages: { body: string }[]
      canSend: boolean
    }
    assert.deepEqual(
      history.messages.map((item) => item.body),
      ["Hello designer", "Hello client", "Team update"],
    )
    await prisma.projectStaff.delete({
      where: {
        projectId_employeeId: {
          projectId: project.id,
          employeeId: teammateEmployee.id,
        },
      },
    })
    assert.equal((await call(teammate, `/${project.id}`)).status, 404)
    assert.equal(
      (
        await call(teammate, `/${project.id}/messages`, "POST", {
          body: "Removed",
          clientMessageId: randomUUID(),
        })
      ).status,
      404,
    )
    await prisma.employee.update({
      where: { id: employee.id },
      data: { status: "ON_LEAVE" },
    })
    assert.equal((await call(staff, `/${project.id}`)).status, 404)
    await prisma.employee.update({
      where: { id: employee.id },
      data: { status: "ACTIVE" },
    })
    await prisma.projectStaff.create({
      data: {
        projectId: project.id,
        employeeId: teammateEmployee.id,
        approvedById: head.id,
      },
    })
    // Complete through the production workspace endpoint, without a separate archive call.
    const complete = await fetch(
      `${base}/project-workspace/${project.id}/status`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${head.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "COMPLETE" }),
      },
    )
    assert.equal(complete.status, 200, await complete.text())
    const active = (await (await call(client, "")).json()) as ChatList
    assert.equal(active.conversations.length, 0)
    assert.equal(active.unreadCount, 0)
    const archived = (await (
      await call(client, "?view=archived")
    ).json()) as ChatList
    assert.deepEqual(
      archived.conversations.map((chat) => chat.id),
      [project.id],
    )
    for (const who of [client, staff, teammate]) {
      const closed = (await (await call(who, `/${project.id}`)).json()) as {
        archived: boolean
        canSend: boolean
        messages: unknown[]
      }
      assert.equal(closed.archived, true)
      assert.equal(closed.canSend, false)
      assert.equal(closed.messages.length, 3)
      assert.equal(
        (
          await call(who, `/${project.id}/messages`, "POST", {
            body: "After completion",
            clientMessageId: randomUUID(),
          })
        ).status,
        409,
      )
    }
    assert.equal(
      await prisma.projectMessage.count({ where: { projectId: project.id } }),
      3,
    )
    await t.test(
      "workspace submissions publish scoped deliverable cards without bypassing review",
      async () => {
        const booking = await prisma.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            title: "Chat deliverables",
            acceptedDepartmentId: department.id,
            workflow: { create: { state: "ACTIVE_PROJECT" } },
          },
        })
        const work = await prisma.project.create({
          data: {
            name: "Chat deliverables",
            clientId: client.id,
            requestId: booking.id,
            status: "IN_PROGRESS",
            startDate: new Date(),
            staff: {
              create: { employeeId: employee.id, approvedById: head.id },
            },
            milestones: {
              create: [{ title: "Brand guide" }, { title: "Final artwork" }],
            },
          },
          include: { milestones: true },
        })
        const milestone = work.milestones[0]
        const target = `${base}/project-workspace/${work.id}/projects/${work.id}/deliverables/`
        const upload = {
          uploadId: randomUUID(),
          name: "guide.txt",
          mimeType: "text/plain",
          content: Buffer.from("Brand guide").toString("base64"),
          note: "Please review this draft.",
        }
        async function act(
          who: { token: string },
          suffix: string,
          body?: unknown,
        ) {
          return fetch(`${target}${suffix}`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${who.token}`,
              "content-type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        }
        type DeliverableHistory = {
          messages: {
            id: string
            body: string
            deliverable: { id: string; kind: string; fileName: string } | null
          }[]
          canSubmitDeliverables: boolean
          archived: boolean
        }
        const historyFor = async (who: { token: string }) =>
          (await (await call(who, `/${work.id}`)).json()) as DeliverableHistory
        assert.equal((await historyFor(client)).canSubmitDeliverables, false)
        assert.equal((await historyFor(staff)).canSubmitDeliverables, true)
        for (const who of [client, outsider, head])
          assert.ok(
            [403, 404].includes(
              (await act(who, `${milestone.id}/attachment`, upload)).status,
            ),
          )
        const foreign = await prisma.projectMilestone.create({
          data: { projectId: planned.id, title: "Other project" },
        })
        assert.equal(
          (await act(staff, `${foreign.id}/attachment`, upload)).status,
          404,
        )
        assert.equal(
          (
            await act(staff, `${milestone.id}/attachment`, {
              ...upload,
              note: "x".repeat(2001),
            })
          ).status,
          400,
        )
        assert.equal(
          (await act(staff, `${milestone.id}/attachment`, upload)).status,
          201,
        )
        assert.equal(
          (await act(staff, `${milestone.id}/attachment`, upload)).status,
          201,
        )
        assert.equal(
          (
            await act(staff, `${milestone.id}/attachment`, {
              ...upload,
              note: "Different note",
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await act(staff, `${milestone.id}/attachment`, {
              ...upload,
              uploadId: randomUUID(),
            })
          ).status,
          409,
        )
        const saved = await prisma.projectMilestone.findUniqueOrThrow({
          where: { id: milestone.id },
          include: { workflowFile: true },
        })
        assert.equal(saved.deliveryStatus, "IN_REVIEW")
        assert.equal(saved.workflowFile?.clientVisible, false)
        assert.equal(
          Buffer.from(saved.workflowFile!.data).toString(),
          "Brand guide",
        )
        assert.equal(
          await prisma.workflowFile.count({ where: { requestId: booking.id } }),
          1,
        )
        const staffHistory = await historyFor(staff)
        assert.equal(staffHistory.messages.length, 1)
        assert.equal(staffHistory.messages[0].deliverable?.id, milestone.id)
        assert.equal(staffHistory.messages[0].deliverable?.kind, "submission")
        assert.equal((await historyFor(client)).messages.length, 0)
        assert.equal(
          (
            await call(
              client,
              `/${work.id}?before=${staffHistory.messages[0].id}`,
            )
          ).status,
          400,
        )
        const clientList = (await (await call(client, "")).json()) as {
          conversations: {
            id: string
            unreadCount: number
            lastMessage: unknown
          }[]
        }
        assert.equal(
          clientList.conversations.find((item) => item.id === work.id)
            ?.lastMessage,
          null,
        )
        assert.equal(
          clientList.conversations.find((item) => item.id === work.id)
            ?.unreadCount,
          0,
        )
        const clientFileUrl = `${base}/projects/${work.id}/deliverables/${milestone.id}/file`
        const download = () =>
          fetch(clientFileUrl, {
            headers: { authorization: `Bearer ${client.token}` },
          })
        assert.equal((await download()).status, 404)
        assert.equal((await act(staff, `${milestone.id}/approve`)).status, 403)
        assert.equal((await act(head, `${milestone.id}/send`)).status, 409)
        assert.equal((await act(head, `${milestone.id}/approve`)).status, 200)
        assert.equal((await historyFor(client)).messages.length, 0)
        assert.equal((await act(head, `${milestone.id}/send`)).status, 200)
        const delivered = await historyFor(client)
        assert.equal(delivered.messages.length, 1)
        assert.equal(delivered.messages[0].deliverable?.kind, "delivery")
        assert.equal(delivered.messages[0].deliverable?.fileName, "guide.txt")
        assert.equal((await download()).status, 200)
        assert.equal(await (await download()).text(), "Brand guide")
        await prisma.project.update({
          where: { id: work.id },
          data: { status: "COMPLETED" },
        })
        assert.equal(
          (
            await act(staff, `${work.milestones[1].id}/attachment`, {
              ...upload,
              uploadId: randomUUID(),
            })
          ).status,
          409,
        )
        assert.equal((await historyFor(staff)).canSubmitDeliverables, false)
        assert.equal((await historyFor(client)).messages.length, 1)
        assert.equal((await historyFor(client)).archived, true)
        assert.equal(
          await prisma.projectMessage.count({ where: { projectId: work.id } }),
          2,
        )
        assert.equal(
          await prisma.workflowFile.count({ where: { requestId: booking.id } }),
          1,
        )
      },
    )
    await t.test(
      "message pagination stays within the authorized project",
      async () => {
        const paged = await prisma.project.create({
          data: {
            name: "Long project history",
            clientId: client.id,
            status: "IN_PROGRESS",
            startDate: new Date(),
            staff: {
              create: { employeeId: employee.id, approvedById: head.id },
            },
          },
        })
        await prisma.projectMessage.createMany({
          data: Array.from({ length: 55 }, (_, index) => ({
            projectId: paged.id,
            senderId: client.id,
            clientMessageId: randomUUID(),
            body: `History ${index}`,
            createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, index)),
          })),
        })
        const recent = (await (await call(staff, `/${paged.id}`)).json()) as {
          messages: { id: string; body: string }[]
          nextCursor: string | null
        }
        assert.equal(recent.messages.length, 50)
        assert.equal(recent.messages[0].body, "History 5")
        assert.ok(recent.nextCursor)
        const older = (await (
          await call(staff, `/${paged.id}?before=${recent.nextCursor}`)
        ).json()) as typeof recent
        assert.equal(older.messages.length, 5)
        assert.equal(older.nextCursor, null)
        assert.equal(older.messages[0].body, "History 0")
        assert.equal(
          new Set(
            [...recent.messages, ...older.messages].map((item) => item.id),
          ).size,
          55,
        )
        assert.equal(
          (await call(client, `/${project.id}?before=${recent.nextCursor}`))
            .status,
          400,
        )
        await prisma.project.update({
          where: { id: paged.id },
          data: { status: "CANCELLED" },
        })
        const cancelled = (await (
          await call(staff, `/${paged.id}`)
        ).json()) as { canSend: boolean; archived: boolean }
        assert.equal(cancelled.canSend, false)
        assert.equal(cancelled.archived, true)
      },
    )
  },
)
