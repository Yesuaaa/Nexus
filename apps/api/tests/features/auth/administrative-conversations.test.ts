import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "business conversation oversight is metadata-only and independent of participation",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(name: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@oversight.test`,
          fullName: name,
          role,
          passwordHash: "SECRET-CREDENTIAL",
        },
      })
      return { ...user, token: (await issueSession(user)).token }
    }
    const sa = await actor("Superadmin", "SUPERADMIN")
    const admin = await actor("Administrator", "ADMIN")
    const staff = await actor("Staff", "STAFF")
    const head = await actor("Head", "STAFF")
    const otherHead = await actor("OtherHead", "STAFF")
    const replacementHead = await actor("ReplacementHead", "STAFF")
    const client = await actor("Client", "USER")
    const otherClient = await actor("OtherClient", "USER")
    const departments = await Promise.all(
      ["Design", "Engineering"].map((name, index) =>
        prisma.department.create({
          data: { name, headId: index ? otherHead.id : head.id },
        }),
      ),
    )
    const employee = await prisma.employee.create({
      data: {
        employeeId: "CHAT-OVERSIGHT",
        fullName: "Staff",
        userId: staff.id,
        departmentId: departments[0].id,
      },
    })
    const service = await prisma.service.create({
      data: {
        name: "Business service",
        description: "SECRET-SERVICE-DESCRIPTION",
      },
    })
    const threads = await Promise.all(
      departments.map((department, index) =>
        prisma.requestConversation.create({
          data: {
            clientId: index ? otherClient.id : client.id,
            departmentId: department.id,
          },
        }),
      ),
    )
    const bookings: { id: string }[] = []
    for (let index = 0; index < 12; index++) {
      bookings.push(
        await prisma.serviceRequest.create({
          data: {
            title: `Business booking ${index}`,
            referenceNumber: `OVERSIGHT-${index}`,
            clientId: index === 11 ? otherClient.id : client.id,
            serviceId: service.id,
            conversationId: threads[index === 11 ? 1 : 0].id,
            acceptedDepartmentId: departments[index === 11 ? 1 : 0].id,
            acceptedAt: new Date(),
            acceptedById: index === 11 ? otherHead.id : head.id,
            status: index === 11 ? "CLOSED" : "UNDER_REVIEW",
            description: "SECRET-BOOKING-DESCRIPTION",
            requirementsPayload: { password: "SECRET-REQUIREMENT" },
            workflow: { create: { state: "CONSULTATION" } },
          },
        }),
      )
    }
    const sharedAt = new Date("2026-10-01T08:00:00Z")
    const privateAt = new Date("2026-10-02T08:00:00Z")
    const serviceMessage = await prisma.serviceRequestMessage.create({
      data: {
        conversationId: threads[0].id,
        requestId: bookings[0].id,
        senderId: client.id,
        body: "SECRET-SERVICE-MESSAGE",
        clientMessageId: randomUUID(),
        createdAt: sharedAt,
      },
    })
    await prisma.serviceRequestMessage.create({
      data: {
        conversationId: threads[0].id,
        senderId: client.id,
        body: null,
        clientMessageId: randomUUID(),
        createdAt: privateAt,
        deletedAt: privateAt,
        purgeAt: new Date(privateAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    await prisma.conversationMeeting.create({
      data: {
        conversationId: threads[0].id,
        clientActionId: randomUUID(),
        startsAt: sharedAt,
        endsAt: privateAt,
        location: "SECRET-MEETING-LOCATION",
        notes: "SECRET-MEETING-NOTES",
      },
    })
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        requestId: bookings[0].id,
        name: "Design delivery",
        status: "IN_PROGRESS",
        startDate: sharedAt,
        description: "SECRET-PROJECT-DESCRIPTION",
        workPlan: { secret: "SECRET-PLAN" },
        staff: { create: { employeeId: employee.id, approvedById: head.id } },
      },
    })
    const archivedProject = await prisma.project.create({
      data: {
        clientId: otherClient.id,
        requestId: bookings[11].id,
        name: "Completed engineering",
        status: "COMPLETED",
        startDate: sharedAt,
      },
    })
    const planned = await prisma.project.create({
      data: {
        clientId: client.id,
        name: "Not a conversation yet",
        status: "PLANNED",
      },
    })
    await prisma.projectMessage.createMany({
      data: [
        {
          projectId: project.id,
          senderId: client.id,
          body: "SECRET-PROJECT-MESSAGE",
          clientMessageId: randomUUID(),
          createdAt: sharedAt,
        },
        {
          projectId: project.id,
          senderId: staff.id,
          body: "SECRET-STAFF-SUBMISSION",
          clientMessageId: randomUUID(),
          clientVisible: false,
          createdAt: privateAt,
          deliverable: { url: "SECRET-ATTACHMENT-URL" },
        },
      ],
    })
    const file = await prisma.workflowFile.create({
      data: {
        requestId: bookings[0].id,
        uploaderId: head.id,
        uploadId: randomUUID(),
        name: "SECRET-FILE.txt",
        mimeType: "text/plain",
        size: 11,
        sha256: "0".repeat(64),
        clientVisible: false,
        data: Buffer.from("SECRET-FILE"),
      },
    })
    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId: project.id,
        title: "Restricted draft",
        workflowFileId: file.id,
      },
    })
    const privateThread = await prisma.internalConversation.create({
      data: {
        participantKey: [staff.id, admin.id].sort().join(":"),
        participantOneId: staff.id,
        participantTwoId: admin.id,
        participants: { create: [{ userId: staff.id }, { userId: admin.id }] },
        messages: {
          create: {
            senderId: staff.id,
            body: "SECRET-PRIVATE-DM",
            clientMessageId: randomUUID(),
          },
        },
      },
    })
    const call = (path: string, who = sa, method = "GET", body?: unknown) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${who.token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    const root = "/administrative-conversations"
    type Summary = {
      id: string
      kind: string
      status: string
      client: { id: string; fullName: string | null }
      department: {
        id: string
        name: string
        head: { id: string; fullName: string | null } | null
      } | null
      lastMessageAt: string | null
      capabilities: Record<string, boolean>
    }
    type List = {
      conversations: Summary[]
      total: number
      page: number
      pageSize: number
    }
    type Details = {
      conversation: Summary
      linkedRecords: { id: string; project: { id: string } | null }[]
      total: number
      page: number
    }
    const json = async <T>(response: Response): Promise<T> => {
      assert.equal(response.status, 200, await response.clone().text())
      assert.equal(response.headers.get("cache-control"), "no-store")
      const body: unknown = await response.json()
      const serialized = JSON.stringify(body)
      assert.ok(!serialized.includes("SECRET-"), serialized)
      for (const key of [
        "body",
        "lastMessage",
        "messages",
        "deliverable",
        "passwordHash",
        "email",
        "contactNumber",
        "clientReadAt",
        "managerReadAt",
        "readAt",
        "unreadCount",
        "attachments",
        "data",
      ])
        assert.ok(!serialized.includes(`"${key}":`), `Private field ${key}`)
      return body as T
    }
    const snapshot = () =>
      Promise.all([
        prisma.requestConversation.findMany({
          select: {
            id: true,
            clientReadAt: true,
            managerReadAt: true,
            updatedAt: true,
          },
          orderBy: { id: "asc" },
        }),
        prisma.projectConversationRead.findMany(),
        prisma.internalConversationParticipant.findMany(),
        prisma.serviceRequestMessage.count(),
        prisma.projectMessage.count(),
        prisma.internalMessage.count(),
        prisma.employee.count({ where: { userId: sa.id } }),
        prisma.internalConversation.count(),
        prisma.projectStaff.count(),
        prisma.requestConversationDeletion.count(),
      ])
    const before = await snapshot()

    await t.test(
      "lists service and started project metadata across departments with accurate lifecycle and timestamps",
      async () => {
        const services = await json<List>(await call(root))
        assert.equal(services.total, 2)
        assert.deepEqual(
          new Set(services.conversations.map((row) => row.department?.id)),
          new Set(departments.map((row) => row.id)),
        )
        assert.ok(
          services.conversations.every((row) => row.status === "ACTIVE"),
        )
        assert.equal(
          services.conversations.find((row) => row.id === threads[0].id)
            ?.lastMessageAt,
          sharedAt.toISOString(),
        )
        const projects = await json<List>(await call(`${root}?kind=project`))
        assert.deepEqual(
          new Set(projects.conversations.map((row) => row.id)),
          new Set([project.id, archivedProject.id]),
        )
        assert.equal(
          projects.conversations.find((row) => row.id === archivedProject.id)
            ?.status,
          "ARCHIVED",
        )
        assert.equal(
          projects.conversations.find((row) => row.id === project.id)
            ?.lastMessageAt,
          sharedAt.toISOString(),
        )
        for (const row of [
          ...services.conversations,
          ...projects.conversations,
        ])
          assert.deepEqual(row.capabilities, {
            inspectMetadata: true,
            readMessages: false,
            downloadFiles: false,
            participate: false,
            markRead: false,
          })
        const projected = services.conversations[0]
        assert.deepEqual(
          Object.keys(projected).sort(),
          [
            "id",
            "kind",
            "name",
            "status",
            "businessStatus",
            "client",
            "department",
            "createdAt",
            "updatedAt",
            "startDate",
            "lastMessageAt",
            "linkedRecordCount",
            "capabilities",
          ].sort(),
        )
      },
    )

    await t.test(
      "search, department scope and pagination preserve safe metadata projections",
      async () => {
        const filtered = await json<List>(
          await call(`${root}?departmentId=${departments[1].id}`),
        )
        assert.deepEqual(
          filtered.conversations.map((row) => row.id),
          [threads[1].id],
        )
        assert.equal(
          (await json<List>(await call(`${root}?search=OVERSIGHT-11`))).total,
          1,
        )
        assert.equal(
          (
            await json<List>(
              await call(
                `${root}?kind=project&departmentId=${departments[1].id}&search=engineering`,
              ),
            )
          ).total,
          1,
        )
        assert.equal(
          (
            await json<List>(
              await call(`${root}?search=SECRET-SERVICE-MESSAGE`),
            )
          ).total,
          0,
        )
        assert.equal(
          (await json<List>(await call(`${root}?page=2`))).conversations.length,
          0,
        )
        const details = await json<Details>(
          await call(`${root}/service/${threads[0].id}`),
        )
        assert.equal(details.total, 11)
        assert.equal(details.linkedRecords.length, 10)
        const next = await json<Details>(
          await call(`${root}/service/${threads[0].id}?page=2`),
        )
        assert.equal(next.linkedRecords.length, 1)
        assert.equal(
          new Set(
            [...details.linkedRecords, ...next.linkedRecords].map(
              (row) => row.id,
            ),
          ).size,
          11,
        )
        const projectDetails = await json<Details>(
          await call(`${root}/project/${project.id}?include=messages,files`),
        )
        assert.equal(projectDetails.linkedRecords[0].id, bookings[0].id)
        assert.equal(projectDetails.linkedRecords[0].project?.id, project.id)
      },
    )

    await t.test(
      "complete nested response allowlists and searches exclude private data in both business categories",
      async () => {
        const keys = (value: object, allowed: string[]) =>
          assert.deepEqual(Object.keys(value).sort(), allowed.sort())
        for (const kind of ["service", "project"]) {
          const list = await json<List>(
            await call(
              `${root}?kind=${kind}&include=messages,files,participants&select=passwordHash`,
            ),
          )
          for (const row of list.conversations) {
            keys(row, [
              "id",
              "kind",
              "name",
              "status",
              "businessStatus",
              "client",
              "department",
              "createdAt",
              "updatedAt",
              "startDate",
              "lastMessageAt",
              "linkedRecordCount",
              "capabilities",
            ])
            keys(row.client, ["id", "fullName"])
            if (row.department) {
              keys(row.department, ["id", "name", "head"])
              if (row.department.head)
                keys(row.department.head, ["id", "fullName"])
            }
            const details = await json<Details>(
              await call(
                `${root}/${kind}/${row.id}?include=messages,attachments,readReceipts`,
              ),
            )
            keys(details, [
              "conversation",
              "linkedRecords",
              "total",
              "page",
              "pageSize",
            ])
            assert.deepEqual(details.conversation, row)
            for (const record of details.linkedRecords) {
              keys(record, [
                "id",
                "title",
                "referenceNumber",
                "status",
                "serviceName",
                "createdAt",
                "updatedAt",
                "project",
              ])
              if (record.project) keys(record.project, ["id", "name", "status"])
            }
          }
          for (const secret of [
            "SECRET-PROJECT-MESSAGE",
            "SECRET-STAFF-SUBMISSION",
            "SECRET-PRIVATE-DM",
            "SECRET-FILE",
            "SECRET-MEETING-NOTES",
            "SECRET-BOOKING-DESCRIPTION",
          ])
            assert.equal(
              (
                await json<List>(
                  await call(`${root}?kind=${kind}&search=${secret}`),
                )
              ).total,
              0,
              `${kind}: ${secret}`,
            )
        }
      },
    )

    await t.test(
      "private DM identifiers, unstarted projects and invalid requests cannot enter oversight",
      async () => {
        for (const kind of ["service", "project"])
          assert.equal(
            (await call(`${root}/${kind}/${privateThread.id}`)).status,
            404,
          )
        assert.equal((await call(`${root}/project/${planned.id}`)).status, 404)
        for (const suffix of [
          "?kind=internal",
          "?kind=service&kind=project",
          "?page=0",
          "?page=1.5",
          "?search=test&search=other",
          `?departmentId=${"x".repeat(81)}`,
          "/internal/private",
          `/service/${threads[0].id}?page=0`,
        ])
          assert.equal((await call(`${root}${suffix}`)).status, 400, suffix)
        for (const who of [
          admin,
          staff,
          head,
          otherHead,
          client,
          otherClient,
        ]) {
          assert.equal((await call(root, who)).status, 403)
          assert.equal(
            (await call(`${root}/service/${threads[0].id}`, who)).status,
            403,
          )
          assert.equal((await call(`${root}?kind=project`, who)).status, 403)
          assert.equal(
            (await call(`${root}/project/${project.id}`, who)).status,
            403,
          )
        }
        assert.equal((await fetch(`${base}${root}`)).status, 401)
      },
    )

    await t.test(
      "administrative nested resources and identity claims cannot expand authority",
      async () => {
        for (const [kind, id] of [
          ["service", threads[0].id],
          ["project", project.id],
        ] as const) {
          const path = `${root}/${kind}/${id}`
          for (const suffix of [
            "messages",
            `messages/${serviceMessage.id}`,
            "read",
            "events",
            `files/${file.id}`,
            "attachments",
            "meetings",
            "participants",
          ])
            assert.equal(
              (await call(`${path}/${suffix}`)).status,
              404,
              `${path}/${suffix}`,
            )
          for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            for (const suffix of [
              "",
              "/messages",
              "/read",
              "/participants",
              "/reactions",
            ])
              assert.equal(
                (
                  await call(`${path}${suffix}`, sa, method, {
                    userId: client.id,
                    senderId: head.id,
                    body: "FORGED",
                    clientMessageId: randomUUID(),
                  })
                ).status,
                404,
              )
          }
        }
        for (const who of [admin, staff, head, client]) {
          const denied = await fetch(
            `${base}${root}?userId=${sa.id}&role=SUPERADMIN&permissions=conversations:inspect-business`,
            {
              headers: {
                authorization: `Bearer ${who.token}`,
                "x-user-id": sa.id,
                "x-role": "SUPERADMIN",
              },
            },
          )
          assert.equal(denied.status, 403)
          assert.equal(denied.headers.get("cache-control"), "no-store")
          assert.deepEqual(
            Object.keys((await denied.json()) as Record<string, unknown>),
            ["error"],
          )
        }
        assert.deepEqual(await snapshot(), before)
      },
    )

    await t.test(
      "metadata authority grants no message, file, stream, mutation or read-receipt authority",
      async () => {
        for (const thread of threads) {
          for (const [path, method, body] of [
            [`/request-conversations/${thread.id}`, "GET", undefined],
            [`/request-conversations/${thread.id}/events`, "GET", undefined],
            [
              `/request-conversations/${thread.id}/read`,
              "PATCH",
              { userId: client.id },
            ],
            [
              `/request-conversations/${thread.id}/messages`,
              "POST",
              {
                body: "forged",
                clientMessageId: randomUUID(),
                senderId: client.id,
              },
            ],
            [
              `/request-conversations/${thread.id}/messages/${serviceMessage.id}`,
              "PATCH",
              { body: "forged" },
            ],
            [
              `/request-conversations/${thread.id}/messages/${serviceMessage.id}`,
              "DELETE",
              undefined,
            ],
            [`/request-conversations/${thread.id}`, "DELETE", undefined],
          ] as const)
            assert.ok(
              [403, 404].includes((await call(path, sa, method, body)).status),
              `${method} ${path}`,
            )
        }
        for (const [path, method, body] of [
          [`/project-conversations/${project.id}`, "GET", undefined],
          [
            `/project-conversations/${project.id}/read`,
            "PATCH",
            { userId: staff.id },
          ],
          [
            `/project-conversations/${project.id}/messages`,
            "POST",
            { body: "forged", clientMessageId: randomUUID() },
          ],
          [`/internal-conversations/${privateThread.id}`, "GET", undefined],
          [
            `/internal-conversations/${privateThread.id}/read`,
            "PATCH",
            undefined,
          ],
          [
            `/internal-conversations/${privateThread.id}/messages`,
            "POST",
            { body: "forged", clientMessageId: randomUUID() },
          ],
          [
            `/request-workflows/${bookings[0].id}/files/${file.id}`,
            "GET",
            undefined,
          ],
          [
            `/project-workspace/${project.id}/projects/${project.id}/deliverables/${milestone.id}/attachment`,
            "GET",
            undefined,
          ],
        ] as const)
          assert.ok(
            [403, 404].includes((await call(path, sa, method, body)).status),
            path,
          )
        const internalList = (await (
          await call("/internal-conversations")
        ).json()) as { conversations: unknown[] }
        assert.deepEqual(internalList.conversations, [])
        const serviceList = (await (
          await call("/request-conversations")
        ).json()) as { conversations: unknown[] }
        assert.deepEqual(serviceList.conversations, [])
        for (const method of ["POST", "PATCH", "DELETE"])
          assert.equal(
            (
              await call(`${root}/service/${threads[0].id}`, sa, method, {
                body: "forged",
              })
            ).status,
            404,
          )
        assert.deepEqual(await snapshot(), before)
        const actor = await prisma.user.findUniqueOrThrow({
          where: { id: sa.id },
        })
        assert.equal(actor.departmentId, null)
        assert.equal(actor.teamId, null)
      },
    )

    await t.test(
      "the mounted workflow attachment route authorizes the real participant and denies oversight-only readers",
      async () => {
        const path = `/request-workflows/${bookings[0].id}/files/${file.id}`
        const allowed = await call(path, head)
        assert.equal(allowed.status, 200)
        assert.equal(await allowed.text(), "SECRET-FILE")
        for (const who of [sa, admin, otherHead, client, otherClient, staff])
          assert.equal(
            (await call(path, who)).status,
            404,
            who.fullName ?? who.id,
          )
      },
    )

    await t.test(
      "existing participants still read and send in their authorized conversations",
      async () => {
        assert.equal(
          (await call(`/request-conversations/${threads[0].id}`, client))
            .status,
          200,
        )
        assert.equal(
          (await call(`/request-conversations/${threads[0].id}`, head)).status,
          200,
        )
        assert.equal(
          (await call(`/request-conversations/${threads[0].id}`, otherHead))
            .status,
          404,
        )
        assert.equal(
          (await call(`/project-conversations/${project.id}`, staff)).status,
          200,
        )
        assert.equal(
          (await call(`/project-conversations/${project.id}`, client)).status,
          200,
        )
        assert.equal(
          (await call(`/internal-conversations/${privateThread.id}`, admin))
            .status,
          200,
        )
        assert.equal(
          (
            await call(
              `/internal-conversations/${privateThread.id}/messages`,
              staff,
              "POST",
              { body: "Own message", clientMessageId: randomUUID() },
            )
          ).status,
          201,
        )
        assert.equal(
          (
            await call(
              `/request-conversations/${threads[0].id}/messages`,
              head,
              "POST",
              { body: "Own message", clientMessageId: randomUUID() },
            )
          ).status,
          201,
        )
        assert.equal(
          (
            await call(
              `/project-conversations/${project.id}/messages`,
              staff,
              "POST",
              { body: "Own message", clientMessageId: randomUUID() },
            )
          ).status,
          201,
        )
      },
    )

    await t.test(
      "Superadmin's own private chat remains explicit participation and cannot impersonate or mark another participant read",
      async () => {
        const created = await call("/internal-conversations", sa, "POST", {
          recipientId: admin.id,
        })
        assert.equal(created.status, 201)
        const { id } = (await created.json()) as { id: string }
        const sent = await call(
          `/internal-conversations/${id}/messages`,
          sa,
          "POST",
          {
            body: "SECRET-OWN-PRIVATE-DM",
            clientMessageId: randomUUID(),
            senderId: staff.id,
            userId: head.id,
          },
        )
        assert.equal(sent.status, 201)
        const { message } = (await sent.json()) as {
          message: { sender: { id: string } }
        }
        assert.equal(message.sender.id, sa.id)
        assert.equal(
          (await call(`/internal-conversations/${id}/read`, admin, "PATCH"))
            .status,
          200,
        )
        const adminRead =
          await prisma.internalConversationParticipant.findUniqueOrThrow({
            where: {
              conversationId_userId: { conversationId: id, userId: admin.id },
            },
          })
        assert.ok(adminRead.readAt)
        assert.equal(
          (
            await call(`/internal-conversations/${id}/read`, sa, "PATCH", {
              userId: admin.id,
            })
          ).status,
          200,
        )
        assert.deepEqual(
          (
            await prisma.internalConversationParticipant.findUniqueOrThrow({
              where: {
                conversationId_userId: { conversationId: id, userId: admin.id },
              },
            })
          ).readAt,
          adminRead.readAt,
        )
        assert.equal(
          (await call(`/internal-conversations/${privateThread.id}`)).status,
          404,
        )
        for (const kind of ["service", "project"]) {
          const data = await json<List>(await call(`${root}?kind=${kind}`))
          assert.ok(!JSON.stringify(data).includes(privateThread.id))
          assert.ok(!JSON.stringify(data).includes(id))
          assert.equal((await call(`${root}/${kind}/${id}`)).status, 404)
          assert.equal(
            (
              await json<List>(
                await call(`${root}?kind=${kind}&search=SECRET-OWN-PRIVATE-DM`),
              )
            ).total,
            0,
          )
        }
      },
    )

    await t.test(
      "Head handoff and project assignment revocation affect participation, not administrative metadata scope",
      async () => {
        await prisma.department.update({
          where: { id: departments[0].id },
          data: { headId: replacementHead.id },
        })
        assert.equal(
          (await call(`/request-conversations/${threads[0].id}`, head)).status,
          404,
        )
        assert.equal(
          (
            await call(
              `/request-conversations/${threads[0].id}/read`,
              head,
              "PATCH",
            )
          ).status,
          404,
        )
        assert.equal(
          (
            await call(
              `/request-conversations/${threads[0].id}`,
              replacementHead,
            )
          ).status,
          200,
        )
        assert.equal(
          (await call(`${root}/service/${threads[0].id}`)).status,
          200,
        )
        await prisma.projectStaff.deleteMany({
          where: { projectId: project.id, employeeId: employee.id },
        })
        for (const [method, suffix, body] of [
          ["GET", "", undefined],
          ["PATCH", "/read", { userId: client.id }],
          [
            "POST",
            "/messages",
            { body: "Revoked", clientMessageId: randomUUID() },
          ],
        ] as const)
          assert.equal(
            (
              await call(
                `/project-conversations/${project.id}${suffix}`,
                staff,
                method,
                body,
              )
            ).status,
            404,
          )
        assert.equal(
          (await call(`/project-conversations/${project.id}`, client)).status,
          200,
        )
        assert.equal((await call(`${root}/project/${project.id}`)).status, 200)
        assert.equal(
          (await call(`${root}/project/${project.id}`, replacementHead)).status,
          403,
        )
      },
    )

    await t.test(
      "deactivation and role changes revoke oversight on the existing session",
      async () => {
        await prisma.user.update({
          where: { id: sa.id },
          data: { isActive: false },
        })
        assert.equal((await call(root)).status, 401)
        await prisma.user.update({
          where: { id: sa.id },
          data: { isActive: true, accountDeletedAt: new Date() },
        })
        assert.equal((await call(`${root}/project/${project.id}`)).status, 401)
        await prisma.user.update({
          where: { id: sa.id },
          data: { isActive: true, accountDeletedAt: null, role: "ADMIN" },
        })
        assert.equal((await call(root)).status, 403)
        assert.equal((await call(`${root}/project/${project.id}`)).status, 403)
      },
    )
  },
)
