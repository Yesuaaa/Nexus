import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"
import type { Role } from "./generated/prisma/client.js"
import type { ConversationRealtime } from "./features/request-conversations/request-conversations.realtime.js"
import { ServiceRequestsError } from "./features/service-requests/service-requests.service.js"

test(
  "accepted request conversations preserve privacy, history and live delivery",
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
    let socket: PGLiteSocketServer | undefined = undefined
    let server: Server | undefined = undefined
    let prisma: ReturnType<typeof getPrisma> | undefined = undefined
    const controllers: AbortController[] = []
    t.after(async () => {
      controllers.forEach((controller) => controller.abort())
      server?.closeAllConnections()
      if (server)
        await new Promise<void>((resolve) => server!.close(() => resolve()))
      await prisma?.$disconnect()
      await socket?.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await db.waitReady
    // Emulate Supabase's database function, recording the actual trigger payload.
    await db.exec(`CREATE SCHEMA realtime;
    CREATE TABLE realtime.test_broadcasts (payload jsonb, event text, topic text, private boolean);
    CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) RETURNS void LANGUAGE sql AS $$
      INSERT INTO realtime.test_broadcasts VALUES (payload, event, topic, private);
    $$;`)
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort())
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    prisma = getPrisma()!
    async function user(name: string, role: Role) {
      const record = await prisma!.user.create({
        data: {
          email: `${name}@example.com`,
          fullName: name,
          passwordHash: "private",
          role,
        },
      })
      const session = await issueSession(record)
      return {
        ...record,
        session,
        headers: { authorization: `Bearer ${session.token}` },
      }
    }
    const client = await user("Client", "USER")
    const foreignClient = await user("OtherClient", "USER")
    const head = await user("Head", "STAFF")
    const otherHead = await user("OtherHead", "STAFF")
    const staff = await user("Staff", "STAFF")
    const admin = await user("Admin", "ADMIN")
    const superadmin = await user("Superadmin", "SUPERADMIN")
    const department = await prisma.department.create({
      data: { name: "Design", headId: head.id },
    })
    const otherDepartment = await prisma.department.create({
      data: { name: "Marketing", headId: otherHead.id },
    })
    const service = await prisma.service.create({
      data: {
        name: "Shared website",
        description: "Website",
        departments: {
          connect: [{ id: department.id }, { id: otherDepartment.id }],
        },
      },
    })
    const booking = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Website booking",
      },
    })
    type Listener = { change: () => void; status: (connected: boolean) => void }
    const listeners = new Map<string, Set<Listener>>()
    let offline = false
    const realtime: ConversationRealtime = {
      async subscribe(id, change, status) {
        if (offline)
          throw new ServiceRequestsError(
            503,
            "Live messaging could not connect. Try again.",
          )
        const room = listeners.get(id) ?? new Set<Listener>()
        listeners.set(id, room)
        const listener = { change, status }
        room.add(listener)
        status(true)
        return async () => {
          room.delete(listener)
        }
      },
    }
    const notify = (id = booking.id) => {
      for (const listener of listeners.get(id) ?? []) listener.change()
    }
    server = createApp({ conversationRealtime: realtime }).listen(
      0,
      "127.0.0.1",
    )
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const path = (id = booking.id) => `/request-conversations/${id}`
    const list = (actor = client, suffix = "") =>
      fetch(`${base}/request-conversations${suffix}`, {
        headers: actor.headers,
      })
    const get = (actor = client, suffix = "", id = booking.id) =>
      fetch(`${base}${path(id)}${suffix}`, { headers: actor.headers })
    const post = (
      actor = client,
      body: unknown = { body: "Hello", clientMessageId: randomUUID() },
      id = booking.id,
    ) =>
      fetch(`${base}${path(id)}/messages`, {
        method: "POST",
        headers: { ...actor.headers, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    const accept = (actor = head, id = booking.id) =>
      fetch(`${base}/request-inbox/${id}/accept`, {
        method: "POST",
        headers: actor.headers,
      })

    await t.test(
      "acceptance records one department and gates all message operations",
      async () => {
        assert.equal((await fetch(`${base}${path()}`)).status, 401)
        assert.equal((await fetch(`${base}/request-conversations`)).status, 401)
        assert.deepEqual(await (await list()).json(), {
          conversations: [],
          nextCursor: null,
        })
        const waiting = (await (await get()).json()) as {
          conversation: unknown
          canSend: boolean
          messages: unknown[]
        }
        assert.equal(waiting.conversation, null)
        assert.equal(waiting.canSend, false)
        assert.deepEqual(waiting.messages, [])
        assert.equal((await post()).status, 409)
        assert.equal((await get(head)).status, 404)
        assert.equal((await accept()).status, 200)
        const stored = await prisma!.serviceRequest.findUniqueOrThrow({
          where: { id: booking.id },
        })
        assert.equal(stored.acceptedDepartmentId, department.id)
        assert.equal(stored.acceptedById, head.id)
        assert.ok(stored.acceptedAt)
        assert.equal((await accept(otherHead)).status, 409)
        for (const actor of [
          foreignClient,
          otherHead,
          staff,
          admin,
          superadmin,
        ]) {
          assert.equal((await get(actor)).status, 404)
          assert.equal((await get(actor, "/events")).status, 404)
          assert.equal((await post(actor)).status, 404)
        }
        assert.equal((await get(head)).status, 200)
        for (const actor of [client, head]) {
          const inbox = (await (await list(actor)).json()) as {
            conversations: { id: string; title: string; lastMessage: unknown }[]
            nextCursor: string | null
          }
          assert.equal(inbox.conversations.length, 1)
          assert.equal(inbox.conversations[0]!.id, booking.id)
          assert.equal(inbox.conversations[0]!.title, booking.title)
          assert.equal(inbox.conversations[0]!.lastMessage, null)
          assert.equal(inbox.nextCursor, null)
        }
        for (const actor of [
          foreignClient,
          otherHead,
          staff,
          admin,
          superadmin,
        ])
          assert.deepEqual(await (await list(actor)).json(), {
            conversations: [],
            nextCursor: null,
          })
      },
    )

    let messageId = ""
    await t.test(
      "messages are persisted, validated and idempotent, with server-derived senders",
      async () => {
        const clientMessageId = randomUUID()
        const input = {
          body: "  Hello department\nPlease review the brief.  ",
          clientMessageId,
          senderId: admin.id,
          requestId: "forged",
        }
        const [a, b] = await Promise.all([
          post(client, input),
          post(client, input),
        ])
        assert.equal(a.status, 201)
        assert.equal(b.status, 201)
        const first = (await a.json()) as {
          message: { id: string; body: string; sender: { id: string } }
        }
        const second = (await b.json()) as typeof first
        assert.equal(first.message.id, second.message.id)
        assert.equal(first.message.sender.id, client.id)
        assert.equal(first.message.body, input.body.trim())
        messageId = first.message.id
        assert.equal(
          (await post(client, { ...input, body: "Different text" })).status,
          409,
        )
        assert.equal(
          (
            await post(head, {
              body: "Thanks, I can help.",
              clientMessageId: randomUUID(),
            })
          ).status,
          201,
        )
        assert.equal(
          await prisma!.serviceRequestMessage.count({
            where: { requestId: booking.id },
          }),
          2,
        )
        for (const input of [
          null,
          {},
          { body: " " },
          { body: "x", clientMessageId: "invalid" },
          { body: "x".repeat(4001), clientMessageId: randomUUID() },
          { body: "bad\u0000text", clientMessageId: randomUUID() },
        ])
          assert.equal((await post(client, input)).status, 400)
        const broadcasts = await db.query<{
          payload: unknown
          event: string
          topic: string
          private: boolean
        }>("SELECT * FROM realtime.test_broadcasts")
        assert.equal(broadcasts.rows.length, 4) // acceptance, consultation event, two unique messages
        for (const broadcast of broadcasts.rows)
          assert.deepEqual(broadcast, {
            payload: {},
            event: "messages-changed",
            topic: `request-conversation:${booking.id}`,
            private: true,
          })
        const history = (await (await get(head)).json()) as {
          messages: Record<string, unknown>[]
          conversation: object
          canSend: boolean
        }
        assert.equal(history.messages.length, 2)
        assert.equal(history.canSend, true)
        assert.deepEqual(Object.keys(history.messages[0]!).sort(), [
          "body",
          "clientMessageId",
          "createdAt",
          "deletedAt",
          "editedAt",
          "id",
          "purgeAt",
          "sender",
        ])
        const rls = await db.query<{ enabled: boolean }>(
          `SELECT relrowsecurity AS enabled FROM pg_class WHERE relname = 'ServiceRequestMessage'`,
        )
        assert.equal(rls.rows[0]!.enabled, true)
      },
    )

    await t.test(
      "history pagination is stable and rejects cursors from another request",
      async () => {
        const paged = await prisma!.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            title: "History",
            status: "UNDER_REVIEW",
            acceptedDepartmentId: department.id,
            acceptedById: head.id,
            acceptedAt: new Date(),
          },
        })
        await prisma!.serviceRequestMessage.createMany({
          data: Array.from({ length: 57 }, (_, index) => ({
            id: `history-${String(index).padStart(3, "0")}`,
            requestId: paged.id,
            senderId: client.id,
            clientMessageId: randomUUID(),
            body: `Message ${index}`,
            createdAt: new Date("2026-10-30T00:00:00Z"),
          })),
        })
        const first = (await (await get(client, "", paged.id)).json()) as {
          messages: { id: string }[]
          nextCursor: string
        }
        assert.equal(first.messages.length, 50)
        assert.equal(first.messages[0]!.id, "history-007")
        const second = (await (
          await get(client, `?before=${first.nextCursor}`, paged.id)
        ).json()) as typeof first
        assert.equal(second.messages.length, 7)
        assert.equal(second.nextCursor, null)
        assert.equal(
          new Set([...first.messages, ...second.messages].map((row) => row.id))
            .size,
          57,
        )
        assert.equal(
          (await get(client, `?before=${messageId}`, paged.id)).status,
          400,
        )
        assert.equal((await get(client, "?before=x&before=y")).status, 400)
        assert.equal((await get(client, "", "bad.id")).status, 400)
      },
    )

    async function stream(actor = client) {
      const controller = new AbortController()
      controllers.push(controller)
      const response = await fetch(`${base}${path()}/events`, {
        headers: actor.headers,
        signal: controller.signal,
      })
      assert.equal(response.status, 200)
      assert.match(response.headers.get("content-type")!, /text\/event-stream/)
      const reader = response.body!.getReader()
      let buffer = ""
      const decoder = new TextDecoder()
      async function until(name: string) {
        while (!buffer.includes(`event: ${name}\n`)) {
          const result = await reader.read()
          assert.equal(result.done, false)
          buffer += decoder.decode(result.value, { stream: true })
        }
        buffer = buffer.slice(
          buffer.indexOf(`event: ${name}\n`) + `event: ${name}\n`.length,
        )
      }
      await until("messages-changed") // initial history sync after subscription
      return { controller, until, reader }
    }

    await t.test(
      "Supabase events reach both participants and reconnect restores missed messages",
      async () => {
        const clientStream = await stream()
        const headStream = await stream(head)
        assert.equal(listeners.get(booking.id)!.size, 2)
        assert.equal(
          (
            await post(head, {
              body: "A live reply",
              clientMessageId: randomUUID(),
            })
          ).status,
          201,
        )
        notify()
        await Promise.all([
          clientStream.until("messages-changed"),
          headStream.until("messages-changed"),
        ])
        clientStream.controller.abort()
        assert.equal(
          (
            await post(head, {
              body: "Sent while disconnected",
              clientMessageId: randomUUID(),
            })
          ).status,
          201,
        )
        const reconnected = await stream()
        const history = (await (await get()).json()) as {
          messages: { body: string }[]
        }
        assert.ok(
          history.messages.some(
            (row) => row.body === "Sent while disconnected",
          ),
        )
        reconnected.controller.abort()
        headStream.controller.abort()
      },
    )

    await t.test(
      "conversation inbox paginates without exposing other participants",
      async () => {
        const ids = Array.from({ length: 31 }, (_, index) => `inbox-${index}`)
        await prisma!.serviceRequest.createMany({
          data: ids.map((id) => ({
            id,
            clientId: client.id,
            serviceId: service.id,
            title: `Conversation ${id}`,
            acceptedAt: new Date(),
            acceptedDepartmentId: department.id,
            status: "UNDER_REVIEW" as const,
            updatedAt: new Date(0),
          })),
        })
        try {
          type Inbox = {
            conversations: {
              id: string
              lastMessage: { body: string } | null
            }[]
            nextCursor: string | null
          }
          const first = (await (await list()).json()) as Inbox
          assert.equal(first.conversations.length, 30)
          assert.equal(first.conversations[0]!.id, booking.id)
          assert.ok(first.conversations[0]!.lastMessage?.body)
          assert.ok(first.nextCursor)
          const next = (await (
            await list(client, `?before=${first.nextCursor}`)
          ).json()) as Inbox
          assert.equal(next.conversations.length, 3)
          assert.equal(next.nextCursor, null)
          assert.equal(
            new Set(
              [...first.conversations, ...next.conversations].map(
                (row) => row.id,
              ),
            ).size,
            33,
          )
          assert.deepEqual(await (await list(foreignClient)).json(), {
            conversations: [],
            nextCursor: null,
          })
          assert.equal(
            (await list(foreignClient, `?before=${first.nextCursor}`)).status,
            400,
          )
          assert.equal((await list(client, "?before=missing")).status, 400)
          assert.equal((await list(client, "?before=x&before=y")).status, 400)
        } finally {
          await prisma!.serviceRequest.deleteMany({
            where: { id: { in: ids } },
          })
        }
      },
    )

    await t.test(
      "head handoff revokes open streams and moves conversation access to the replacement",
      async () => {
        const oldStream = await stream(head)
        await prisma!.department.update({
          where: { id: department.id },
          data: { headId: staff.id },
        })
        notify()
        await oldStream.until("access-revoked")
        assert.equal((await get(head)).status, 404)
        assert.equal((await post(head)).status, 404)
        assert.deepEqual(await (await list(head)).json(), {
          conversations: [],
          nextCursor: null,
        })
        const replacementInbox = (await (await list(staff)).json()) as {
          conversations: { id: string }[]
        }
        assert.ok(
          replacementInbox.conversations.some((row) => row.id === booking.id),
        )
        assert.equal((await get(staff)).status, 200)
        assert.equal((await post(staff)).status, 201)
        // Accepted department retains access even when catalog routing changes later.
        await prisma!.service.update({
          where: { id: service.id },
          data: { departments: { set: { id: otherDepartment.id } } },
        })
        assert.equal((await get(staff)).status, 200)
        assert.equal(
          (
            await fetch(`${base}/request-inbox/${booking.id}`, {
              headers: staff.headers,
            })
          ).status,
          200,
        )
        const activeStream = await stream(staff)
        await prisma!.user.update({
          where: { id: staff.id },
          data: { isActive: false },
        })
        notify()
        await activeStream.until("access-revoked")
        assert.equal((await get(staff)).status, 401)
        assert.equal((await post()).status, 409)
        const paused = (await (await get()).json()) as {
          canSend: boolean
          conversation: { head: unknown }
        }
        assert.equal(paused.canSend, false)
        assert.equal(paused.conversation.head, null)
        await prisma!.user.update({
          where: { id: staff.id },
          data: { isActive: true, role: "ADMIN" },
        })
        assert.equal((await get(staff)).status, 404)
        await prisma!.user.update({
          where: { id: staff.id },
          data: { role: "STAFF" },
        })
      },
    )

    await t.test(
      "closed requests keep history but reject new messages; logout revokes streams",
      async () => {
        await prisma!.serviceRequest.update({
          where: { id: booking.id },
          data: { status: "CLOSED" },
        })
        assert.equal((await get()).status, 200)
        assert.equal((await post()).status, 409)
        assert.equal((await post(staff)).status, 409)
        await prisma!.serviceRequest.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        })
        assert.equal((await post()).status, 409)
        const activeStream = await stream()
        await fetch(`${base}/auth/logout`, {
          method: "POST",
          headers: client.headers,
        })
        notify()
        await activeStream.until("access-revoked")
        assert.equal((await get()).status, 401)
      },
    )

    await t.test(
      "historical acceptance is claimed explicitly and atomically without guessing its department",
      async () => {
        await prisma!.service.update({
          where: { id: service.id },
          data: { departments: { connect: { id: department.id } } },
        })
        const legacy = await prisma!.serviceRequest.create({
          data: {
            clientId: foreignClient.id,
            serviceId: service.id,
            title: "Historical request",
            status: "UNDER_REVIEW",
          },
        })
        const results = await Promise.all([
          accept(staff, legacy.id),
          accept(otherHead, legacy.id),
        ])
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [200, 409],
        )
        const winner = results[0]!.status === 200 ? staff : otherHead
        assert.equal((await get(winner, "", legacy.id)).status, 200)
        offline = true
        const response = await get(winner, "/events", legacy.id)
        assert.equal(response.status, 503)
        assert.equal(
          (
            await post(
              winner,
              {
                body: "Saved during provider outage",
                clientMessageId: randomUUID(),
              },
              legacy.id,
            )
          ).status,
          201,
        )
      },
    )
  },
)
