import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { parseMeeting } from "../src/features/request-conversations/conversation-meetings.validation.js"
import { parseAction } from "../src/features/request-workflow/workflow.validation.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "[P20-API-001] client calendar is owner-scoped across consultation and meeting sources",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    async function client(name: string) {
      return prisma.user.create({
        data: {
          email: `${name.toLowerCase()}@page20.example.test`,
          fullName: name,
          passwordHash: "test-only-hash",
          role: "USER",
        },
      })
    }

    const owner = await client("Page20Owner")
    const foreign = await client("Page20Foreign")
    const department = await prisma.department.create({
      data: { name: "Page 20 Calendar Department" },
    })
    const service = await prisma.service.create({
      data: {
        name: "Page 20 Calendar Service",
        description: "Isolated calendar fixture.",
      },
    })

    async function booking(clientId: string, referenceNumber: string) {
      return prisma.serviceRequest.create({
        data: {
          clientId,
          serviceId: service.id,
          title: referenceNumber,
          referenceNumber,
          workflow: { create: {} },
        },
      })
    }

    const ownerBooking = await booking(owner.id, "P20-OWN-BOOKING")
    const foreignBooking = await booking(foreign.id, "P20-FOREIGN-BOOKING")
    const ownerStart = new Date("2032-02-29T16:00:00.000Z")
    const ownerEnd = new Date("2032-02-29T16:30:00.000Z")
    const ownerConsultation = await prisma.workflowConsultation.create({
      data: {
        requestId: ownerBooking.id,
        startsAt: ownerStart,
        endsAt: ownerEnd,
        location: "https://meet.example.test/owner-consultation",
      },
    })
    const foreignConsultation = await prisma.workflowConsultation.create({
      data: {
        requestId: foreignBooking.id,
        startsAt: ownerStart,
        endsAt: ownerEnd,
        location: "https://meet.example.test/private-consultation",
      },
    })

    async function conversation(clientId: string) {
      return prisma.requestConversation.create({
        data: { clientId, departmentId: department.id },
      })
    }

    const ownerConversation = await conversation(owner.id)
    const foreignConversation = await conversation(foreign.id)

    async function meeting(conversationId: string, location: string) {
      return prisma.conversationMeeting.create({
        data: {
          conversationId,
          clientActionId: randomUUID(),
          startsAt: ownerStart,
          endsAt: ownerEnd,
          location,
          notes: "Page 20 isolation fixture.",
        },
      })
    }

    const ownerMeeting = await meeting(
      ownerConversation.id,
      "https://meet.example.test/owner-meeting",
    )
    const foreignMeeting = await meeting(
      foreignConversation.id,
      "https://meet.example.test/private-meeting",
    )

    async function snapshot() {
      const [consultations, meetings] = await Promise.all([
        prisma.workflowConsultation.findMany({
          orderBy: { id: "asc" },
          select: {
            id: true,
            requestId: true,
            startsAt: true,
            endsAt: true,
            location: true,
            status: true,
          },
        }),
        prisma.conversationMeeting.findMany({
          orderBy: { id: "asc" },
          select: {
            id: true,
            conversationId: true,
            startsAt: true,
            endsAt: true,
            location: true,
            status: true,
            version: true,
          },
        }),
      ])
      return { consultations, meetings }
    }

    const before = await snapshot()
    const ownerSession = await issueSession(owner)
    const ownerResponse = await fetch(
      `${origin}/api/projects/calendar?scope=team&clientId=${encodeURIComponent(foreign.id)}`,
      { headers: { authorization: `Bearer ${ownerSession.token}` } },
    )
    assert.equal(ownerResponse.status, 200)
    const ownerEvents = (await ownerResponse.json()) as {
      id: string
      type: string
      startsAt: string
      endsAt: string | null
      location: string | null
    }[]
    assert.deepEqual(
      ownerEvents.map(({ id }) => id),
      [`consultation-${ownerConsultation.id}`, `meeting-${ownerMeeting.id}`],
    )
    assert.equal(ownerEvents[0]?.startsAt, ownerStart.toISOString())
    assert.equal(ownerEvents[0]?.endsAt, ownerEnd.toISOString())
    assert.equal(
      ownerEvents[0]?.location,
      "https://meet.example.test/owner-consultation",
    )
    assert.equal(ownerEvents[1]?.type, "meeting")
    assert.equal(
      ownerEvents[1]?.location,
      "https://meet.example.test/owner-meeting",
    )
    assert.equal(
      ownerEvents.some(
        ({ id }) =>
          id === `consultation-${foreignConsultation.id}` ||
          id === `meeting-${foreignMeeting.id}`,
      ),
      false,
    )

    const foreignSession = await issueSession(foreign)
    const foreignResponse = await fetch(
      `${origin}/api/projects/calendar?scope=mine&clientId=${encodeURIComponent(owner.id)}`,
      { headers: { authorization: `Bearer ${foreignSession.token}` } },
    )
    assert.equal(foreignResponse.status, 200)
    const foreignEvents = (await foreignResponse.json()) as {
      id: string
    }[]
    assert.deepEqual(
      foreignEvents.map(({ id }) => id),
      [
        `consultation-${foreignConsultation.id}`,
        `meeting-${foreignMeeting.id}`,
      ],
    )
    assert.deepEqual(await snapshot(), before)
  },
)

test("[P20-API-002] meeting validation rejects impossible leap-day dates", () => {
  assert.throws(
    () =>
      parseMeeting({
        clientActionId: randomUUID(),
        bookingIds: [],
        startsAt: "2032-02-30T10:00:00.000Z",
        endsAt: "2032-02-30T11:00:00.000Z",
        location: "https://meet.example.test",
        notes: "",
      }),
    /valid meeting date and time/i,
  )
})

test("[P20-API-003] consultation action validation rejects impossible leap-day dates", () => {
  assert.throws(
    () =>
      parseAction({
        actionId: randomUUID(),
        expectedVersion: 1,
        type: "SCHEDULE_CONSULTATION",
        startsAt: "2032-02-30T10:00:00.000Z",
        endsAt: "2032-02-30T11:00:00.000Z",
        location: "Online",
        notes: "",
      }),
    /invalid date/i,
  )
})
