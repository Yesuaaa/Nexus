import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { WorkflowContext } from "./context.js"

/** Fixed-price requests, the audit trail and notifications. */
export async function fixedPriceAndNotifications(
  t: TestContext,
  {
    prisma,
    department,
    client,
    accept,
    act,
    head,
    employee,
    base,
    request,
    state,
    otherClient,
  }: WorkflowContext,
) {
  await t.test(
    "fixed-price requests skip negotiation but retain formal approval and authorized activation",
    async () => {
      const fixedService = await prisma!.service.create({
        data: {
          name: "Fixed audit",
          description: "Audit",
          requiresAgreement: false,
          requiresPayment: false,
          departments: { connect: { id: department.id } },
        },
      })
      const fixedRequest = await prisma!.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: fixedService.id,
          title: "Accessibility audit",
          pricingModel: "FIXED",
          agreedPrice: "5000.00",
          currency: "PHP",
          packageName: "Audit",
        },
      })
      assert.equal((await accept(fixedRequest.id)).status, 200)
      const fixed = await act(
        head,
        { type: "FIXED_QUOTATION" },
        fixedRequest.id,
      )
      const quotation = fixed.quotations.at(-1)!
      assert.equal(Number(quotation.total), 5000)
      const approved = await act(
        client,
        {
          type: "RESPOND_QUOTATION",
          quotationId: quotation.id,
          decision: "ACCEPT",
          note: "",
        },
        fixedRequest.id,
      )
      assert.ok(approved.approval)
      await act(
        head,
        { type: "STAFF_PROJECT", employeeIds: [employee.id] },
        fixedRequest.id,
      )
      const activated = await act(
        head,
        { type: "ACTIVATE_PROJECT" },
        fixedRequest.id,
      )
      assert.equal(activated.state, "ACTIVE_PROJECT")
      assert.equal(
        (
          await prisma!.serviceRequest.findUniqueOrThrow({
            where: { id: fixedRequest.id },
          })
        ).status,
        "ACTIVATED",
      )
      assert.equal(
        await prisma!.workflowApproval.count({
          where: { requestId: fixedRequest.id },
        }),
        1,
      )
      const cancelledRequest = await prisma!.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: fixedService.id,
          title: "Cancelled audit",
          pricingModel: "FIXED",
          agreedPrice: "5000.00",
          currency: "PHP",
        },
      })
      assert.equal((await accept(cancelledRequest.id)).status, 200)
      const cancelledQuote = await act(
        head,
        { type: "FIXED_QUOTATION" },
        cancelledRequest.id,
      )
      await act(
        client,
        {
          type: "RESPOND_QUOTATION",
          quotationId: cancelledQuote.quotations[0]!.id,
          decision: "ACCEPT",
          note: "",
        },
        cancelledRequest.id,
      )
      const cancelledDraft = await prisma!.project.findUniqueOrThrow({
        where: { requestId: cancelledRequest.id },
      })
      await act(
        head,
        {
          type: "CANCEL",
          note: "Client requested cancellation before commencement",
        },
        cancelledRequest.id,
      )
      assert.equal(
        (
          await fetch(`${base}/projects/${cancelledDraft.id}`, {
            headers: client.headers,
          })
        ).status,
        404,
      )
      const declinedRequest = await prisma!.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: fixedService.id,
          title: "Declined audit",
          pricingModel: "FIXED",
          agreedPrice: "5000.00",
          currency: "PHP",
        },
      })
      assert.equal((await accept(declinedRequest.id)).status, 200)
      const declinedQuote = await act(
        head,
        { type: "FIXED_QUOTATION" },
        declinedRequest.id,
      )
      const declined = await act(
        client,
        {
          type: "RESPOND_QUOTATION",
          quotationId: declinedQuote.quotations[0]!.id,
          decision: "DECLINE",
          note: "Budget changed",
        },
        declinedRequest.id,
      )
      assert.equal(declined.state, "DECLINED")
      assert.equal(declined.approval, null)
      assert.equal(
        await prisma!.project.count({
          where: { requestId: declinedRequest.id },
        }),
        0,
      )
    },
  )

  await t.test(
    "events and notifications retain an audit trail without leaking internal notes",
    async () => {
      const events = await prisma!.workflowEvent.findMany({
        where: { requestId: request.id },
      })
      assert.ok(
        events.some(
          (event) =>
            event.internal &&
            event.summary.includes("Private staffing cost estimate"),
        ),
      )
      const clientNotifications = await prisma!.workflowNotification.findMany({
        where: { requestId: request.id, userId: client.id },
        include: { event: true },
      })
      assert.ok(clientNotifications.length > 0)
      assert.ok(
        clientNotifications.every(
          (notification) => notification.event?.internal === false,
        ),
      )
      assert.equal(
        await prisma!.project.count({
          where: { id: state.projectId, requestId: request.id },
        }),
        1,
      )
    },
  )

  await t.test(
    "mark all as read covers notifications beyond the list limit and preserves recipient access boundaries",
    async () => {
      const eventIds = Array.from({ length: 47 }, () => randomUUID())
      await prisma!.workflowEvent.createMany({
        data: eventIds.map((id, index) => ({
          id,
          requestId: request.id,
          actorId: head.id,
          type: "NOTIFICATION_TEST",
          summary: `Notification ${index + 1}`,
          internal: index === 46,
        })),
      })
      const earlierReadAt = new Date("2026-10-01T00:00:00Z")
      const tiedCreatedAt = new Date("2099-01-01T00:00:00Z")
      const noticeIds = eventIds.map(
        (_, index) => `notice-order-${String(index).padStart(2, "0")}`,
      )
      await prisma!.workflowNotification.createMany({
        data: [
          ...eventIds.map((eventId, index) => ({
            id: noticeIds[index]!,
            eventId,
            requestId: request.id,
            userId: client.id,
            createdAt: tiedCreatedAt,
            readAt: index === 45 ? earlierReadAt : null,
          })),
          {
            eventId: eventIds[0]!,
            requestId: request.id,
            userId: otherClient.id,
            readAt: null,
          },
        ],
      })
      const endpoint = `${base}/request-workflows/notifications`
      const list = async () => {
        const response = await fetch(endpoint, { headers: client.headers })
        assert.equal(response.status, 200)
        return (await response.json()) as {
          notifications: { id: string; readAt: string | null }[]
          unreadCount: number
        }
      }
      const before = await list()
      assert.deepEqual(
        before.notifications.map(({ id }) => id),
        noticeIds.slice(6, 46).reverse(),
      )
      assert.ok(before.unreadCount >= 45)
      await prisma!.user.update({
        where: { id: client.id },
        data: { settings: { workflowNotifications: false } },
      })
      const muted = await list()
      assert.deepEqual(muted, { notifications: [], unreadCount: 0 })
      await prisma!.user.update({
        where: { id: client.id },
        data: { settings: {} },
      })
      const restored = await list()
      assert.deepEqual(restored, before)

      const markRead = (id: string, headers: typeof client.headers) =>
        fetch(`${endpoint}/${id}/read`, { method: "PATCH", headers })
      assert.equal((await markRead(noticeIds[46]!, client.headers)).status, 404)
      assert.equal(
        (await markRead(noticeIds[0]!, otherClient.headers)).status,
        404,
      )
      assert.deepEqual(await list(), before)
      assert.equal((await markRead(noticeIds[0]!, client.headers)).status, 200)
      const afterSingle = await list()
      assert.deepEqual(afterSingle.notifications, before.notifications)
      assert.equal(afterSingle.unreadCount, before.unreadCount - 1)

      assert.equal(
        (await fetch(`${endpoint}/read-all`, { method: "PATCH" })).status,
        401,
      )
      const markAll = () =>
        fetch(`${endpoint}/read-all`, {
          method: "PATCH",
          headers: client.headers,
        })
      assert.equal((await markAll()).status, 200)
      const after = await list()
      assert.equal(after.unreadCount, 0)
      assert.ok(after.notifications.every((item) => item.readAt))
      const saved = await prisma!.workflowNotification.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { id: "asc" },
      })
      assert.ok(
        saved
          .filter(
            (item) =>
              item.userId === client.id && item.eventId !== eventIds[46],
          )
          .every((item) => item.readAt),
      )
      assert.equal(
        saved.find((item) => item.userId === otherClient.id)!.readAt,
        null,
      )
      assert.equal(
        saved.find((item) => item.eventId === eventIds[46])!.readAt,
        null,
      )
      assert.equal(
        saved
          .find((item) => item.eventId === eventIds[45])!
          .readAt!.toISOString(),
        earlierReadAt.toISOString(),
      )
      assert.equal((await markAll()).status, 200)
      assert.deepEqual(
        await prisma!.workflowNotification.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { id: "asc" },
        }),
        saved,
      )
    },
  )
}
