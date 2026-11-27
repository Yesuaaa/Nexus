import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp } from "./support/pglite-app.js"
import { seedPg019 } from "./support/pg019-client-fixture.js"

test("[PG-020-F001-A009-T003] single-read replay preserves scoped persisted read state", async (t) => {
  const { prisma, base } = await startPgliteApp(t)
  const { a, b, records } = await seedPg019(prisma)
  const requestId = records[0]!.request.id
  await prisma.requestWorkflow.create({ data: { requestId } })
  const event = await prisma.workflowEvent.create({
    data: {
      requestId,
      type: "REQUEST_ACCEPTED",
      summary: "Synthetic public notice",
    },
  })
  const notice = await prisma.workflowNotification.create({
    data: { userId: a.user.id, requestId, eventId: event.id },
  })
  const headers = { authorization: `Bearer ${a.token}` }
  const endpoint = `${base}/request-workflows/notifications`
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${endpoint}/${notice.id}/read`, {
      method: "PATCH",
      headers,
    })
    assert.equal(response.status, 200)
    const saved = await prisma.workflowNotification.findUniqueOrThrow({
      where: { id: notice.id },
    })
    assert.ok(saved.readAt)
    assert.equal(saved.userId, a.user.id)
    const feed = await fetch(endpoint, { headers })
    assert.equal(feed.status, 200)
    assert.equal(
      ((await feed.json()) as { unreadCount: number }).unreadCount,
      0,
    )
  }
  const before = await prisma.workflowNotification.findUniqueOrThrow({
    where: { id: notice.id },
  })
  assert.equal(
    (
      await fetch(`${endpoint}/${notice.id}/read`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${b.token}` },
      })
    ).status,
    404,
  )
  assert.deepEqual(
    await prisma.workflowNotification.findUniqueOrThrow({
      where: { id: notice.id },
    }),
    before,
  )
})

test("[PG-020-F001-A005-T003] client conversation lists exclude foreign clients", async (t) => {
  const { prisma, base } = await startPgliteApp(t)
  const { a, b, head, records } = await seedPg019(prisma)
  const department = await prisma.department.findFirstOrThrow()
  const conversationIds: string[] = []
  for (const record of records) {
    const conversation = await prisma.requestConversation.create({
      data: {
        clientId: record.request.clientId,
        departmentId: department.id,
        bookings: { connect: { id: record.request.id } },
      },
    })
    conversationIds.push(conversation.id)
    await prisma.project.update({
      where: { id: record.project.id },
      data: { status: "IN_PROGRESS" },
    })
    for (const clientVisible of [true, false]) {
      await prisma.projectMessage.create({
        data: {
          projectId: record.project.id,
          senderId: head.user.id,
          clientMessageId: crypto.randomUUID(),
          body: clientVisible ? "Public synthetic" : "Private sentinel",
          clientVisible,
        },
      })
    }
  }
  for (const actor of [a, b]) {
    const headers = { authorization: `Bearer ${actor.token}` }
    for (const path of [
      "/request-conversations",
      "/project-conversations?view=active",
    ]) {
      const response = await fetch(base + path, { headers })
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        conversations: { id: string; requestId?: string; projectId?: string }[]
        unreadCount: number
      }
      assert.equal(body.unreadCount, path.startsWith("/project") ? 1 : 0)
      const foreign = records.find((r) => r.request.clientId !== actor.user.id)!
      const ownIndex = records.findIndex(
        (r) => r.request.clientId === actor.user.id,
      )
      assert.deepEqual(
        body.conversations.map((c) => c.id),
        [
          path.startsWith("/project")
            ? records[ownIndex]!.project.id
            : conversationIds[ownIndex]!,
        ],
      )
      assert.ok(
        body.conversations.every(
          (c) =>
            c.requestId !== foreign.request.id &&
            c.projectId !== foreign.project.id,
        ),
      )
    }
  }
})
