import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test, type TestContext } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import type { Role } from "../src/generated/prisma/client.js"
import { startPgliteApp } from "./support/pglite-app.js"

async function fixture(t: TestContext) {
  const { prisma, origin } = await startPgliteApp(t)
  async function user(name: string, role: Role) {
    const record = await prisma.user.create({
      data: {
        email: name + "@example.test",
        fullName: name,
        passwordHash: "fixture",
        role,
      },
    })
    return { id: record.id, token: (await issueSession(record)).token }
  }
  const owner = await user("owner", "USER")
  const foreign = await user("foreign", "USER")
  const head = await user("head", "STAFF")
  const other = await user("other", "STAFF")
  const admin = await user("admin", "ADMIN")
  const department = await prisma.department.create({
    data: { name: "Design", headId: head.id },
  })
  await prisma.department.create({ data: { name: "Other", headId: other.id } })
  const service = await prisma.service.create({
    data: { name: "Design", description: "Synthetic" },
  })
  const thread = await prisma.requestConversation.create({
    data: { clientId: owner.id, departmentId: department.id },
  })
  const sibling = await prisma.requestConversation.create({
    data: { clientId: foreign.id, departmentId: department.id },
  })
  const booking = await prisma.serviceRequest.create({
    data: {
      title: "First booking",
      clientId: owner.id,
      serviceId: service.id,
      conversationId: thread.id,
      status: "UNDER_REVIEW",
      acceptedDepartmentId: department.id,
      acceptedById: head.id,
      acceptedAt: new Date(),
    },
  })
  const foreignBooking = await prisma.serviceRequest.create({
    data: {
      title: "Other booking",
      clientId: foreign.id,
      serviceId: service.id,
      conversationId: sibling.id,
      status: "UNDER_REVIEW",
      acceptedDepartmentId: department.id,
      acceptedById: head.id,
      acceptedAt: new Date(),
    },
  })
  async function call(
    actor: { token: string },
    path: string,
    method = "GET",
    data?: unknown,
  ) {
    return fetch(origin + "/api/" + path, {
      method,
      headers: {
        authorization: "Bearer " + actor.token,
        "content-type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    })
  }
  return {
    prisma,
    owner,
    foreign,
    head,
    other,
    admin,
    department,
    service,
    thread,
    sibling,
    booking,
    foreignBooking,
    call,
    servicePath: "request-conversations/" + thread.id,
  }
}

test(
  "PG-028-F007-A001-T007 service read scope and waiting access",
  { timeout: 120_000 },
  async (t) => {
    const f = await fixture(t)
    const waiting = await f.prisma.serviceRequest.create({
      data: {
        title: "Waiting fixture",
        clientId: f.owner.id,
        serviceId: f.service.id,
      },
    })
    const sentinel = "Scoped foreign preview sentinel"
    await f.prisma.serviceRequestMessage.create({
      data: {
        conversationId: f.sibling.id,
        senderId: f.head.id,
        body: sentinel,
        clientMessageId: randomUUID(),
      },
    })
    const before = await f.prisma.requestConversation.findMany({
      orderBy: { id: "asc" },
      include: { messages: true, bookings: true },
    })
    const waitingPath = "request-conversations/" + waiting.id
    const waitingRead = await f.call(f.owner, waitingPath)
    const waitingBody: unknown = await waitingRead.json()
    const ownList = await f.call(f.owner, "request-conversations")
    const listBody = (await ownList.json()) as {
      conversations: { id: string }[]
      unreadCount: number
    }
    const headDetail = await f.call(f.head, f.servicePath)
    const denies = await Promise.all(
      [f.foreign, f.other, f.admin].map((actor) =>
        f.call(actor, f.servicePath),
      ),
    )
    const waitingDenial = await f.call(f.foreign, waitingPath)
    const after = await f.prisma.requestConversation.findMany({
      orderBy: { id: "asc" },
      include: { messages: true, bookings: true },
    })
    assert.deepEqual(after, before)
    assert.equal(waitingRead.status, 200)
    assert.deepEqual(waitingBody, {
      archived: false,
      selectedBookingId: null,
      conversation: null,
      canSend: false,
      messages: [],
      meetings: [],
      nextCursor: null,
    })
    assert.equal(waitingDenial.status, 404)
    assert.equal(ownList.status, 200)
    assert.deepEqual(
      listBody.conversations.map((row) => row.id),
      [f.thread.id],
    )
    assert.equal(listBody.unreadCount, 0)
    assert.ok(!JSON.stringify(listBody).includes(sentinel))
    assert.equal(headDetail.status, 200)
    for (const response of denies) {
      assert.equal(response.status, 404)
      assert.ok(!(await response.text()).includes(f.thread.id))
    }
  },
)

test(
  "PG-028-F008-A001-T008 service replay and booking relationship",
  { timeout: 120_000 },
  async (t) => {
    const f = await fixture(t)
    const input = {
      body: "  synthetic replay  ",
      bookingId: f.booking.id,
      clientMessageId: randomUUID(),
    }
    const sibling = await f.prisma.requestConversation.findUnique({
      where: { id: f.sibling.id },
      include: { messages: true },
    })
    const send = (data: typeof input) =>
      f.call(f.owner, f.servicePath + "/messages", "POST", data)
    const first = await send(input)
    const replay = await send(input)
    const changed = await send({ ...input, body: "Different content" })
    const foreign = await send({
      ...input,
      clientMessageId: randomUUID(),
      bookingId: f.foreignBooking.id,
    })
    const rows = await f.prisma.serviceRequestMessage.findMany()
    assert.equal(rows.length, 1)
    assert.deepEqual(
      {
        body: rows[0].body,
        sender: rows[0].senderId,
        booking: rows[0].requestId,
        conversation: rows[0].conversationId,
      },
      {
        body: "synthetic replay",
        sender: f.owner.id,
        booking: f.booking.id,
        conversation: f.thread.id,
      },
    )
    assert.deepEqual(
      await f.prisma.requestConversation.findUnique({
        where: { id: f.sibling.id },
        include: { messages: true },
      }),
      sibling,
    )
    assert.deepEqual(
      [first.status, replay.status, changed.status, foreign.status],
      [201, 201, 409, 400],
    )
    assert.deepEqual(await replay.json(), await first.json())
  },
)

test(
  "PG-028-F010-A001-T010 message ownership and tombstones",
  { timeout: 120_000 },
  async (t) => {
    const f = await fixture(t)
    const seed = (conversationId: string) =>
      f.prisma.serviceRequestMessage.create({
        data: {
          conversationId,
          senderId: f.head.id,
          body: "original",
          clientMessageId: randomUUID(),
        },
      })
    const target = await seed(f.thread.id)
    const other = await seed(f.sibling.id)
    const clientMessage = await f.prisma.serviceRequestMessage.create({
      data: {
        conversationId: f.thread.id,
        senderId: f.owner.id,
        body: "client-authored fixture",
        clientMessageId: randomUUID(),
      },
    })
    const path = f.servicePath + "/messages/" + target.id
    const edit = (actor: typeof f.head, endpoint = path) =>
      f.call(actor, endpoint, "PATCH", { body: "edited body" })
    const allowed = await edit(f.head)
    const edited = await f.prisma.serviceRequestMessage.findUniqueOrThrow({
      where: { id: target.id },
    })
    const denied = await edit(f.other)
    const nonAuthor = await edit(
      f.head,
      f.servicePath + "/messages/" + clientMessage.id,
    )
    const wrongRole = await edit(
      f.owner,
      f.servicePath + "/messages/" + clientMessage.id,
    )
    const wrongParent = await edit(
      f.head,
      f.servicePath + "/messages/" + other.id,
    )
    const deleted = await f.call(f.head, path, "DELETE")
    const tombstone = await f.prisma.serviceRequestMessage.findUniqueOrThrow({
      where: { id: target.id },
    })
    const repeated = await f.call(f.head, path, "DELETE")
    const editDeleted = await edit(f.head)
    assert.equal(edited.body, "edited body")
    assert.equal(tombstone.body, null)
    assert.ok(tombstone.deletedAt && tombstone.purgeAt)
    assert.equal(tombstone.senderId, f.head.id)
    assert.equal(tombstone.conversationId, f.thread.id)
    assert.deepEqual(
      await f.prisma.serviceRequestMessage.findUnique({
        where: { id: target.id },
      }),
      tombstone,
    )
    assert.deepEqual(
      await f.prisma.serviceRequestMessage.findUnique({
        where: { id: other.id },
      }),
      other,
    )
    assert.deepEqual(
      await f.prisma.serviceRequestMessage.findUnique({
        where: { id: clientMessage.id },
      }),
      clientMessage,
    )
    assert.deepEqual(
      [
        allowed.status,
        denied.status,
        nonAuthor.status,
        wrongRole.status,
        wrongParent.status,
        deleted.status,
        repeated.status,
        editDeleted.status,
      ],
      [200, 404, 404, 403, 404, 200, 200, 409],
    )
  },
)

test(
  "PG-028-F012-A001-T012 service archive persistence and viewer visibility",
  { timeout: 120_000 },
  async (t) => {
    const f = await fixture(t)
    const active = await f.call(f.owner, f.servicePath, "DELETE")
    await f.prisma.serviceRequest.update({
      where: { id: f.booking.id },
      data: { status: "CLOSED" },
    })
    await f.prisma.serviceRequestMessage.create({
      data: {
        conversationId: f.thread.id,
        senderId: f.head.id,
        clientMessageId: randomUUID(),
        body: "Retained synthetic archived message",
      },
    })
    const protectedState = () =>
      f.prisma.requestConversation.findMany({
        orderBy: { id: "asc" },
        include: { bookings: true, messages: true },
      })
    const before = await protectedState()
    const outsider = await f.call(f.foreign, f.servicePath, "DELETE")
    const first = await f.call(f.owner, f.servicePath, "DELETE")
    const repeated = await f.call(f.owner, f.servicePath, "DELETE")
    const markers = await f.prisma.requestConversationDeletion.findMany({
      select: { conversationId: true, userId: true },
    })
    const after = await protectedState()
    const archiveList = async (actor: typeof f.owner) => {
      const response = await f.call(
        actor,
        "request-conversations?view=archived",
      )
      const body = (await response.json()) as {
        conversations: { id: string }[]
      }
      return {
        status: response.status,
        visible: body.conversations.some((row) => row.id === f.thread.id),
      }
    }
    const [ownerList, headList, ownerDetail, headDetail] = await Promise.all([
      archiveList(f.owner),
      archiveList(f.head),
      f.call(f.owner, f.servicePath),
      f.call(f.head, f.servicePath),
    ])
    const headHistory = await headDetail.text()
    await t.test("independent persisted marker and protected rows", () => {
      assert.deepEqual(
        [active.status, outsider.status, first.status, repeated.status],
        [409, 404, 200, 200],
      )
      assert.deepEqual(markers, [
        { conversationId: f.thread.id, userId: f.owner.id },
      ])
      assert.deepEqual(after, before)
    })
    await t.test("independent other-viewer history", () => {
      assert.deepEqual(headList, { status: 200, visible: true })
      assert.equal(headDetail.status, 200)
      assert.match(headHistory, /Retained synthetic archived message/)
    })
    await t.test("independent deleting-viewer list", () => {
      assert.deepEqual(ownerList, { status: 200, visible: false })
    })
    await t.test("independent deleting-viewer detail", () => {
      assert.equal(ownerDetail.status, 404)
    })
  },
)

test(
  "PG-028-F028-A001-T028 message payload validation",
  { timeout: 120_000 },
  async (t) => {
    const f = await fixture(t)
    const employee = await f.prisma.employee.create({
      data: {
        employeeId: "PG028",
        fullName: "Fixture head",
        userId: f.head.id,
        departmentId: f.department.id,
      },
    })
    const project = await f.prisma.project.create({
      data: {
        name: "Started fixture",
        clientId: f.owner.id,
        status: "IN_PROGRESS",
        startDate: new Date(),
        staff: { create: { employeeId: employee.id, approvedById: f.head.id } },
      },
    })
    const created = await f.call(f.head, "internal-conversations", "POST", {
      recipientId: f.admin.id,
    })
    assert.equal(created.status, 201)
    const pair = (await created.json()) as { id: string }
    for (const [path, actor] of [
      [f.servicePath, f.owner],
      ["project-conversations/" + project.id, f.owner],
      ["internal-conversations/" + pair.id, f.head],
    ] as const) {
      await t.test(path.split("/")[0], async () => {
        const snapshot = async () => ({
          request: await f.prisma.serviceRequestMessage.findMany({
            orderBy: { id: "asc" },
          }),
          internal: await f.prisma.internalMessage.findMany({
            orderBy: { id: "asc" },
          }),
          project: await f.prisma.projectMessage.findMany({
            orderBy: { id: "asc" },
          }),
        })
        const before = await snapshot()
        const send = (
          body: unknown,
          clientMessageId = randomUUID() as string,
        ) =>
          f.call(actor, path + "/messages", "POST", { body, clientMessageId })
        const invalid = []
        for (const body of [" ", 123, "a".repeat(4001), "a\u0000b"])
          invalid.push((await send(body)).status)
        invalid.push((await send("text", "invalid")).status)
        assert.deepEqual(await snapshot(), before)
        assert.deepEqual(invalid, [400, 400, 400, 400, 400])
        for (const [input, expected] of [
          ["x", "x"],
          ["x".repeat(4000), "x".repeat(4000)],
          [" padded ", "padded"],
        ]) {
          const response = await send(input)
          assert.equal(response.status, 201)
          const output = (await response.json()) as { message: { id: string } }
          const persisted = await snapshot()
          const row = [
            ...persisted.request,
            ...persisted.internal,
            ...persisted.project,
          ].find((item) => item.id === output.message.id)
          assert.ok(row)
          assert.equal(row.body, expected)
          assert.equal(row.senderId, actor.id)
          assert.equal(
            "projectId" in row ? row.projectId : row.conversationId,
            path.split("/")[1],
          )
        }
      })
    }
  },
)
