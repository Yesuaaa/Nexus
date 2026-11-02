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
import { getPrisma } from "./lib/db.js"
import type { Role } from "./generated/prisma/client.js"

const sharedConversationMigration =
  "20261102000000_shared_request_conversations"

test(
  "request conversations share chronology while booking workflows stay independent",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite()
    const resources: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      resources.server?.closeAllConnections()
      if (resources.server)
        await new Promise<void>((resolve) =>
          resources.server!.close(() => resolve()),
        )
      await resources.prisma?.$disconnect()
      await resources.socket?.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await db.waitReady
    await db.exec(`CREATE SCHEMA realtime;
      CREATE TABLE realtime.test_broadcasts (payload jsonb, event text, topic text, private boolean);
      CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) RETURNS void LANGUAGE sql AS $$
        INSERT INTO realtime.test_broadcasts VALUES (payload, event, topic, private);
      $$;`)

    const migrations = new URL("../prisma/migrations/", import.meta.url)
    const names = (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()
    for (const name of names) {
      if (name >= sharedConversationMigration) continue
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }

    // Seed the pre-migration shape to verify that multiple historical request
    // threads consolidate without losing messages or booking associations.
    await db.exec(`
      INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "role", "updatedAt") VALUES
        ('legacy-client', 'legacy-client@example.com', 'Legacy client', 'private', 'USER', CURRENT_TIMESTAMP),
        ('legacy-head', 'legacy-head@example.com', 'Legacy head', 'private', 'STAFF', CURRENT_TIMESTAMP);
      INSERT INTO "Department" ("id", "name", "headId", "updatedAt")
        VALUES ('legacy-department', 'Legacy design', 'legacy-head', CURRENT_TIMESTAMP);
      INSERT INTO "Service" ("id", "name", "description", "updatedAt")
        VALUES ('legacy-service', 'Legacy service', 'Historical service', CURRENT_TIMESTAMP);
      INSERT INTO "ServiceRequest" (
        "id", "clientId", "serviceId", "title", "status",
        "acceptedDepartmentId", "acceptedById", "acceptedAt", "updatedAt"
      ) VALUES
        ('legacy-booking-a', 'legacy-client', 'legacy-service', 'Legacy A', 'UNDER_REVIEW', 'legacy-department', 'legacy-head', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('legacy-booking-b', 'legacy-client', 'legacy-service', 'Legacy B', 'UNDER_REVIEW', 'legacy-department', 'legacy-head', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "ServiceRequestMessage" (
        "id", "requestId", "senderId", "clientMessageId", "body"
      ) VALUES (
        'legacy-message', 'legacy-booking-b', 'legacy-client',
        '00000000-0000-4000-8000-000000000001', 'Historical message'
      );
    `)
    await db.exec(
      await readFile(
        new URL(`${sharedConversationMigration}/migration.sql`, migrations),
        "utf8",
      ),
    )

    for (const name of names.filter(
      (name) => name > sharedConversationMigration,
    ))
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )

    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    resources.socket = socket
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    resources.prisma = prisma

    const legacyConversation = await prisma.requestConversation.findUnique({
      where: {
        clientId_departmentId: {
          clientId: "legacy-client",
          departmentId: "legacy-department",
        },
      },
      include: { bookings: true, messages: true },
    })
    assert.ok(legacyConversation)
    assert.equal(legacyConversation.bookings.length, 2)
    assert.equal(legacyConversation.messages.length, 1)
    assert.equal(legacyConversation.messages[0]!.id, "legacy-message")
    assert.equal(legacyConversation.messages[0]!.requestId, "legacy-booking-b")

    async function user(name: string, role: Role) {
      const record = await prisma!.user.create({
        data: {
          email: `${name.toLowerCase()}@example.com`,
          fullName: name,
          passwordHash: "private",
          role,
        },
      })
      const session = await issueSession(record)
      return {
        ...record,
        headers: { authorization: `Bearer ${session.token}` },
      }
    }

    const client = await user("Client", "USER")
    const foreignClient = await user("ForeignClient", "USER")
    const head = await user("Head", "STAFF")
    const otherHead = await user("OtherHead", "STAFF")
    const staff = await user("Staff", "STAFF")
    const admin = await user("Admin", "ADMIN")
    const design = await prisma.department.create({
      data: { name: "Design", headId: head.id },
    })
    const marketing = await prisma.department.create({
      data: { name: "Marketing", headId: otherHead.id },
    })
    const service = await prisma.service.create({
      data: {
        name: "Growth services",
        description: "Design and marketing",
        requiresAgreement: false,
        requiresPayment: false,
        departments: { connect: [{ id: design.id }, { id: marketing.id }] },
      },
    })
    const [bookingA, bookingB, bookingC] = await Promise.all(
      ["Website development", "SEO optimization", "Campaign strategy"].map(
        (title) =>
          prisma!.serviceRequest.create({
            data: { clientId: client.id, serviceId: service.id, title },
          }),
      ),
    )

    const server = createApp().listen(0, "127.0.0.1")
    resources.server = server
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const accept = (id: string, actor = head) =>
      fetch(`${base}/request-inbox/${id}/accept`, {
        method: "POST",
        headers: actor.headers,
      })
    const list = (actor = client, suffix = "") =>
      fetch(`${base}/request-conversations${suffix}`, {
        headers: actor.headers,
      })
    const history = (id: string, actor = client, suffix = "") =>
      fetch(`${base}/request-conversations/${id}${suffix}`, {
        headers: actor.headers,
      })
    const send = (
      id: string,
      actor: typeof client | typeof head,
      body: string,
      bookingId?: string,
      clientMessageId = randomUUID(),
    ) =>
      fetch(`${base}/request-conversations/${id}/messages`, {
        method: "POST",
        headers: { ...actor.headers, "content-type": "application/json" },
        body: JSON.stringify({
          body,
          bookingId: bookingId ?? null,
          clientMessageId,
        }),
      })

    await t.test(
      "concurrent acceptance reuses one client-department conversation",
      async () => {
        const [acceptedA, acceptedB] = await Promise.all([
          accept(bookingA.id),
          accept(bookingB.id),
        ])
        assert.equal(acceptedA.status, 200)
        assert.equal(acceptedB.status, 200)
        assert.equal((await accept(bookingC.id, otherHead)).status, 200)

        const designConversations = await prisma!.requestConversation.findMany({
          where: { clientId: client.id, departmentId: design.id },
          include: { bookings: true },
        })
        assert.equal(designConversations.length, 1)
        assert.deepEqual(
          new Set(designConversations[0]!.bookings.map((row) => row.id)),
          new Set([bookingA.id, bookingB.id]),
        )
        assert.equal(
          await prisma!.requestConversation.count({
            where: { clientId: client.id },
          }),
          2,
        )

        const inbox = (await (await list()).json()) as {
          conversations: { id: string; bookings: { id: string }[] }[]
        }
        assert.equal(inbox.conversations.length, 2)
        assert.equal(
          inbox.conversations.find((row) => row.bookings.length === 2)?.bookings
            .length,
          2,
        )
      },
    )

    const designConversation =
      await prisma.requestConversation.findUniqueOrThrow({
        where: {
          clientId_departmentId: {
            clientId: client.id,
            departmentId: design.id,
          },
        },
      })

    await t.test(
      "general and booking-specific messages share one chronological history",
      async () => {
        const generalMessageId = randomUUID()
        assert.equal(
          (
            await send(
              designConversation.id,
              head,
              "General update",
              undefined,
              generalMessageId,
            )
          ).status,
          201,
        )
        const retry = await send(
          bookingB.id,
          head,
          "General update",
          undefined,
          generalMessageId,
        )
        assert.equal(retry.status, 201)
        assert.equal(
          ((await retry.json()) as { message: { booking: unknown } }).message
            .booking,
          null,
        )
        assert.equal(
          (
            await send(
              designConversation.id,
              client,
              "SEO requirements attached",
              bookingB.id,
            )
          ).status,
          201,
        )
        const response = await history(bookingB.id)
        assert.equal(response.status, 200)
        const payload = (await response.json()) as {
          selectedBookingId: string
          conversation: { id: string; bookingCount: number }
          messages: {
            body: string
            booking: { id: string; serviceName: string } | null
          }[]
        }
        assert.equal(payload.conversation.id, designConversation.id)
        assert.equal(payload.conversation.bookingCount, 2)
        assert.equal(payload.selectedBookingId, bookingB.id)
        assert.deepEqual(
          payload.messages.map((message) => message.body),
          ["General update", "SEO requirements attached"],
        )
        assert.equal(payload.messages[0]!.booking, null)
        assert.equal(payload.messages[1]!.booking?.id, bookingB.id)
        assert.equal(
          (
            await send(
              designConversation.id,
              client,
              "Forged association",
              bookingC.id,
            )
          ).status,
          400,
        )
      },
    )

    await t.test(
      "a workflow action changes only its selected booking",
      async () => {
        const workflowA = await prisma!.requestWorkflow.findUniqueOrThrow({
          where: { requestId: bookingA.id },
        })
        const workflowB = await prisma!.requestWorkflow.findUniqueOrThrow({
          where: { requestId: bookingB.id },
        })
        assert.equal(workflowA.state, "CONSULTATION")
        assert.equal(workflowB.state, "CONSULTATION")
        const action = await fetch(
          `${base}/request-workflows/${bookingB.id}/actions`,
          {
            method: "POST",
            headers: { ...head.headers, "content-type": "application/json" },
            body: JSON.stringify({
              type: "PREPARE_QUOTATION",
              actionId: randomUUID(),
              expectedVersion: workflowB.version,
            }),
          },
        )
        assert.equal(action.status, 200)
        const [afterA, afterB] = await Promise.all([
          prisma!.requestWorkflow.findUniqueOrThrow({
            where: { requestId: bookingA.id },
          }),
          prisma!.requestWorkflow.findUniqueOrThrow({
            where: { requestId: bookingB.id },
          }),
        ])
        assert.equal(afterA.state, "CONSULTATION")
        assert.equal(afterA.version, workflowA.version)
        assert.equal(afterB.state, "QUOTATION_PENDING")
        assert.equal(afterB.version, workflowB.version + 1)
      },
    )

    await t.test(
      "access and unread state belong to the shared conversation",
      async () => {
        for (const actor of [foreignClient, otherHead, staff, admin]) {
          assert.equal(
            (await history(designConversation.id, actor)).status,
            404,
          )
        }
        const beforeRead = (await (await list(client)).json()) as {
          conversations: { id: string; unreadCount: number }[]
        }
        assert.equal(
          beforeRead.conversations.find(
            (row) => row.id === designConversation.id,
          )?.unreadCount,
          1,
        )
        const read = await fetch(
          `${base}/request-conversations/${bookingA.id}/read`,
          { method: "PATCH", headers: client.headers },
        )
        assert.equal(read.status, 200)
        const readPayload = (await read.json()) as {
          conversationId: string
          conversationUnreadCount: number
        }
        assert.equal(readPayload.conversationId, designConversation.id)
        assert.equal(readPayload.conversationUnreadCount, 0)
      },
    )

    await t.test(
      "meetings belong to the conversation with optional multiple services and strict participant access",
      async () => {
        const input = {
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 88_200_000).toISOString(),
          location: "https://meet.example.com/shared",
          notes: "General catch-up",
          bookingIds: [] as string[],
          clientActionId: randomUUID(),
        }
        const invite = (data: typeof input, actor = head) =>
          fetch(
            `${base}/request-conversations/${designConversation.id}/meetings`,
            {
              method: "POST",
              headers: { ...actor.headers, "content-type": "application/json" },
              body: JSON.stringify(data),
            },
          )
        const action = (meetingId: string, data: object, actor = head) =>
          fetch(
            `${base}/request-conversations/${designConversation.id}/meetings/${meetingId}`,
            {
              method: "PATCH",
              headers: { ...actor.headers, "content-type": "application/json" },
              body: JSON.stringify(data),
            },
          )
        const workflowsBefore = await prisma.requestWorkflow.findMany({
          where: { requestId: { in: [bookingA.id, bookingB.id] } },
          orderBy: { requestId: "asc" },
        })
        const created = await invite(input)
        assert.equal(created.status, 201)
        const { meeting } = (await created.json()) as {
          meeting: { id: string; bookings: unknown[]; version: number }
        }
        assert.deepEqual(meeting.bookings, [])
        assert.equal((await invite(input)).status, 201)
        assert.equal(await prisma.conversationMeeting.count(), 1)
        assert.equal(
          (await invite({ ...input, bookingIds: [bookingA.id] })).status,
          409,
        )
        assert.equal(
          (await invite({ ...input, clientActionId: randomUUID() }, client))
            .status,
          403,
        )
        for (const actor of [staff, admin, foreignClient, otherHead])
          assert.equal(
            (await invite({ ...input, clientActionId: randomUUID() }, actor))
              .status,
            404,
          )
        assert.equal(
          (
            await invite({
              ...input,
              clientActionId: randomUUID(),
              bookingIds: [bookingC.id],
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await invite({
              ...input,
              clientActionId: randomUUID(),
              startsAt: "not-a-date",
            })
          ).status,
          400,
        )
        assert.equal(
          (await action(meeting.id, { type: "COMPLETE", expectedVersion: 0 }))
            .status,
          409,
        )
        assert.equal(
          (
            await action(
              meeting.id,
              { type: "CANCEL", expectedVersion: 0 },
              client,
            )
          ).status,
          403,
        )
        assert.equal(
          (
            await action(
              meeting.id,
              { type: "CANCEL", expectedVersion: 0 },
              staff,
            )
          ).status,
          404,
        )
        assert.equal(
          (await action("unknown", { type: "CANCEL", expectedVersion: 0 }))
            .status,
          404,
        )
        assert.equal(
          (
            await action(
              meeting.id,
              {
                type: "REQUEST_RESCHEDULE",
                expectedVersion: 0,
                startsAt: input.startsAt,
                note: "Can we meet later?",
              },
              client,
            )
          ).status,
          200,
        )
        assert.equal(
          (
            await action(meeting.id, {
              type: "KEEP_SCHEDULE",
              expectedVersion: 0,
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await action(meeting.id, {
              type: "KEEP_SCHEDULE",
              expectedVersion: 1,
            })
          ).status,
          200,
        )
        assert.equal(
          (
            await action(meeting.id, {
              type: "RESCHEDULE",
              expectedVersion: 2,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              location: "Office",
            })
          ).status,
          200,
        )
        assert.equal(
          (await action(meeting.id, { type: "CANCEL", expectedVersion: 3 }))
            .status,
          200,
        )
        const after = await prisma.requestWorkflow.findMany({
          where: { requestId: { in: [bookingA.id, bookingB.id] } },
          orderBy: { requestId: "asc" },
        })
        assert.deepEqual(after, workflowsBefore)
        const sharedHistory = (await (await history(bookingB.id)).json()) as {
          meetings: { id: string; status: string }[]
        }
        assert.deepEqual(
          sharedHistory.meetings.map((item) => [item.id, item.status]),
          [[meeting.id, "CANCELLED"]],
        )
        const broadcasts = await db.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM realtime.test_broadcasts WHERE topic = 'request-conversation:${designConversation.id}'`,
        )
        assert.ok(broadcasts.rows[0]!.count >= 5)
      },
    )

    await t.test(
      "one completed meeting satisfies consultation only for its explicitly related services",
      async () => {
        await prisma.requestWorkflow.updateMany({
          where: { requestId: { in: [bookingA.id, bookingB.id] } },
          data: { consultationRequired: true },
        })
        const invite = await fetch(
          `${base}/request-conversations/${designConversation.id}/meetings`,
          {
            method: "POST",
            headers: { ...head.headers, "content-type": "application/json" },
            body: JSON.stringify({
              clientActionId: randomUUID(),
              startsAt: new Date(Date.now() + 86_400_000).toISOString(),
              endsAt: new Date(Date.now() + 88_200_000).toISOString(),
              location: "Office",
              notes: "Website and SEO",
              bookingIds: [bookingA.id, bookingB.id],
            }),
          },
        )
        assert.equal(invite.status, 201)
        const { meeting } = (await invite.json()) as {
          meeting: { id: string; bookings: { booking: { id: string } }[] }
        }
        assert.deepEqual(
          new Set(meeting.bookings.map((link) => link.booking.id)),
          new Set([bookingA.id, bookingB.id]),
        )
        const before = await prisma.requestWorkflow.findMany({
          where: { requestId: { in: [bookingA.id, bookingB.id] } },
        })
        await prisma.conversationMeeting.update({
          where: { id: meeting.id },
          data: {
            startsAt: new Date(Date.now() - 3_600_000),
            endsAt: new Date(Date.now() - 1_800_000),
          },
        })
        const complete = await fetch(
          `${base}/request-conversations/${designConversation.id}/meetings/${meeting.id}`,
          {
            method: "PATCH",
            headers: { ...head.headers, "content-type": "application/json" },
            body: JSON.stringify({ type: "COMPLETE", expectedVersion: 0 }),
          },
        )
        assert.equal(complete.status, 200)
        for (const originalWorkflow of before) {
          const workflow = await prisma.requestWorkflow.findUniqueOrThrow({
            where: { requestId: originalWorkflow.requestId },
          })
          assert.equal(workflow.state, originalWorkflow.state)
          assert.equal(workflow.version, originalWorkflow.version)
          const snapshot = await fetch(
            `${base}/request-workflows/${originalWorkflow.requestId}`,
            { headers: client.headers },
          )
          assert.equal(
            ((await snapshot.json()) as { consultationComplete: boolean })
              .consultationComplete,
            true,
          )
        }
        const unrelated = await fetch(
          `${base}/request-workflows/${bookingC.id}`,
          { headers: client.headers },
        )
        assert.equal(
          ((await unrelated.json()) as { consultationComplete: boolean })
            .consultationComplete,
          false,
        )
        const workflowA = await prisma.requestWorkflow.findUniqueOrThrow({
          where: { requestId: bookingA.id },
        })
        const quote = await fetch(
          `${base}/request-workflows/${bookingA.id}/actions`,
          {
            method: "POST",
            headers: { ...head.headers, "content-type": "application/json" },
            body: JSON.stringify({
              type: "PREPARE_QUOTATION",
              expectedVersion: workflowA.version,
              actionId: randomUUID(),
            }),
          },
        )
        assert.equal(quote.status, 200)
      },
    )

    await t.test(
      "the conversation remains available after every attached booking ends",
      async () => {
        await prisma!.serviceRequest.update({
          where: { id: bookingA.id },
          data: { status: "CLOSED" },
        })
        const activeWithOne = (await (await list()).json()) as {
          conversations: { id: string }[]
        }
        assert.ok(
          activeWithOne.conversations.some(
            (row) => row.id === designConversation.id,
          ),
        )
        await prisma!.serviceRequest.update({
          where: { id: bookingB.id },
          data: { status: "CANCELLED" },
        })
        const active = (await (await list()).json()) as {
          conversations: { id: string; status: string }[]
        }
        assert.equal(
          active.conversations.find((row) => row.id === designConversation.id)
            ?.status,
          "ACTIVE",
        )
        const sharedHistory = (await (
          await history(designConversation.id, head)
        ).json()) as {
          archived: boolean
          canSend: boolean
          messages: unknown[]
        }
        assert.equal(sharedHistory.archived, false)
        assert.equal(sharedHistory.canSend, true)
        assert.equal(sharedHistory.messages.length, 2)
      },
    )

    const rls = await db.query<{ table: string; enabled: boolean }>(`
      SELECT relname AS table, relrowsecurity AS enabled
      FROM pg_class
      WHERE relname IN ('RequestConversation', 'RequestConversationDeletion', 'ServiceRequestMessage', 'ConversationMeeting', 'ConversationMeetingBooking')
      ORDER BY relname
    `)
    assert.equal(rls.rows.length, 5)
    assert.ok(rls.rows.every((row) => row.enabled))
  },
)
