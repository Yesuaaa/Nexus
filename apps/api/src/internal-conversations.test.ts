import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { startPgliteApp } from "./test/pglite-app.js"
import { issueSession } from "./features/auth/auth.service.js"
import { sendInternalMessage } from "./features/internal-conversations/internal-conversations.service.js"
import type { User } from "./generated/prisma/client.js"

test(
  "internal messaging preserves account pairs and rejects former internal senders",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const accounts: (User & { token: string })[] = []
    for (const role of [
      "STAFF",
      "ADMIN",
      "SUPERADMIN",
      "USER",
      "STAFF",
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `pair-${accounts.length}@example.com`,
          fullName: role,
          role,
          passwordHash: "test-only",
        },
      })
      accounts.push({ ...user, token: (await issueSession(user)).token })
    }
    const [staff, admin, superadmin, client, outsider] = accounts
    async function call(
      actor: { token: string },
      path: string,
      method = "GET",
      body?: unknown,
    ) {
      return fetch(`${origin}/api/internal-conversations${path}`, {
        method,
        headers: {
          authorization: `Bearer ${actor.token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    const created = await call(staff!, "", "POST", { recipientId: admin!.id })
    assert.equal(created.status, 201)
    const { id } = (await created.json()) as { id: string }
    const reverse = await call(admin!, "", "POST", { recipientId: staff!.id })
    assert.equal(((await reverse.json()) as { id: string }).id, id)
    assert.equal(await prisma.internalConversation.count(), 1)
    const input = {
      body: "Persistent colleague message",
      clientMessageId: randomUUID(),
    }
    assert.equal(
      (await call(staff!, `/${id}/messages`, "POST", input)).status,
      201,
    )
    assert.equal(
      (await call(staff!, `/${id}/messages`, "POST", input)).status,
      201,
    )
    assert.equal(await prisma.internalMessage.count(), 1)
    const unread = (await (await call(admin!, "")).json()) as {
      unreadCount: number
    }
    assert.equal(unread.unreadCount, 1)
    assert.equal((await call(admin!, `/${id}/read`, "PATCH")).status, 200)
    const read = (await (await call(admin!, "")).json()) as {
      unreadCount: number
    }
    assert.equal(read.unreadCount, 0)
    for (const actor of [superadmin!, outsider!]) {
      assert.equal((await call(actor, `/${id}`)).status, 404)
      assert.equal(
        (
          await call(actor, `/${id}/messages`, "POST", {
            ...input,
            clientMessageId: randomUUID(),
          })
        ).status,
        404,
      )
    }
    assert.equal(
      (await call(superadmin!, "", "POST", { recipientId: staff!.id })).status,
      201,
    )
    assert.equal(
      (await call(staff!, "", "POST", { recipientId: staff!.id })).status,
      400,
    )
    assert.equal(
      (await call(staff!, "", "POST", { recipientId: client!.id })).status,
      404,
    )
    for (const actor of [client!, staff!]) {
      if (actor.id === staff!.id)
        await prisma.user.update({
          where: { id: staff!.id },
          data: { role: "USER" },
        })
      for (const [path, method, body] of [
        ["", "GET", undefined],
        ["/contacts", "GET", undefined],
        ["", "POST", { recipientId: admin!.id }],
        [`/${id}`, "GET", undefined],
        [`/${id}/read`, "PATCH", undefined],
        [`/${id}/messages`, "POST", input],
      ] as const)
        assert.equal((await call(actor, path, method, body)).status, 403)
    }
    await assert.rejects(
      sendInternalMessage(staff!.id, id, input.body, input.clientMessageId),
      /Only staff and administrators/,
    )
    const recipientState = (await (await call(admin!, `/${id}`)).json()) as {
      canSend: boolean
      messages: unknown[]
    }
    assert.equal(recipientState.canSend, false)
    assert.equal(recipientState.messages.length, 1)
    assert.equal(
      (
        await call(admin!, `/${id}/messages`, "POST", {
          ...input,
          clientMessageId: randomUUID(),
        })
      ).status,
      409,
    )
    await prisma.user.update({
      where: { id: staff!.id },
      data: { role: "STAFF", isActive: false },
    })
    await assert.rejects(
      sendInternalMessage(staff!.id, id, "Inactive sender", randomUUID()),
      /Only staff and administrators/,
    )
    assert.equal(await prisma.internalMessage.count(), 1)
  },
)
