import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import {
  RequestWorkflowState,
  type Role,
} from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "administrative workflow inspection is global, metadata-only and never operational",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(name: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@workflow-inspection.test`,
          fullName: name,
          role,
          passwordHash: "PRIVATE-CREDENTIAL",
        },
      })
      return {
        user,
        headers: {
          authorization: `Bearer ${(await issueSession(user)).token}`,
          "content-type": "application/json",
        },
      }
    }
    const sa = await actor("Superadmin", "SUPERADMIN")
    const admin = await actor("Approver", "ADMIN")
    const head = await actor("Head", "STAFF")
    const staff = await actor("Staff", "STAFF")
    const client = await actor("Client", "USER")
    const other = await actor("OtherClient", "USER")
    const departments = await Promise.all(
      [0, 1].map((index) =>
        prisma.department.create({
          data: {
            name: `Inspection ${index}`,
            ...(index === 0 ? { headId: head.user.id } : {}),
          },
        }),
      ),
    )
    const service = await prisma.service.create({
      data: {
        name: "Workflow service",
        description: "Test",
        requiresConsultation: true,
        requiresQuotationApproval: true,
        requiresPayment: true,
      },
    })
    const records = []
    const stamp = new Date("2026-11-14T08:00:00Z")
    for (const [index, department] of departments.entries()) {
      const owner = index ? other : client
      const record = await prisma.serviceRequest.create({
        data: {
          clientId: owner.user.id,
          serviceId: service.id,
          title: `Workflow ${index}`,
          status: "UNDER_REVIEW",
          acceptedDepartmentId: department.id,
          acceptedById: head.user.id,
          acceptedAt: stamp,
          workflow: {
            create: {
              state: "AGREEMENT_PAYMENT_PENDING",
              consultationRequired: true,
              quotationApprovalRequired: true,
              paymentRequired: true,
              quotationApproverId: admin.user.id,
              paymentVerifierId: admin.user.id,
            },
          },
        },
      })
      const file = await prisma.workflowFile.create({
        data: {
          requestId: record.id,
          uploaderId: head.user.id,
          uploadId: randomUUID(),
          name: "PRIVATE-FILE",
          mimeType: "text/plain",
          size: 4,
          sha256: "a".repeat(64),
          clientVisible: false,
          data: new Uint8Array([1, 2, 3, 4]),
        },
      })
      const requirement = await prisma.workflowRequirement.create({
        data: {
          requestId: record.id,
          title: "Brand assets",
          details: "PRIVATE-DETAILS",
          submission: "PRIVATE-SUBMISSION",
          reviewNote: "PRIVATE-REVIEW",
          fileId: file.id,
          status: "SUBMITTED",
        },
      })
      await prisma.workflowConsultation.create({
        data: {
          requestId: record.id,
          startsAt: stamp,
          endsAt: new Date(stamp.getTime() + 3600000),
          status: "COMPLETED",
          location: "PRIVATE-MEETING-URL",
          notes: "PRIVATE-CONSULTATION-NOTE",
        },
      })
      const conversation = await prisma.requestConversation.create({
        data: { clientId: owner.user.id, departmentId: department.id },
      })
      await prisma.serviceRequest.update({
        where: { id: record.id },
        data: { conversationId: conversation.id },
      })
      const meeting = await prisma.conversationMeeting.create({
        data: {
          conversationId: conversation.id,
          clientActionId: randomUUID(),
          startsAt: stamp,
          endsAt: new Date(stamp.getTime() + 3600000),
          location: "PRIVATE-CONVERSATION-URL",
          notes: "PRIVATE-CONVERSATION-NOTE",
          status: "SCHEDULED",
          proposedStartsAt: new Date(stamp.getTime() + 7200000),
          bookings: { create: { bookingId: record.id } },
        },
      })
      await prisma.serviceRequestMessage.create({
        data: {
          conversationId: conversation.id,
          requestId: record.id,
          senderId: owner.user.id,
          body: "PRIVATE-MESSAGE",
          clientMessageId: randomUUID(),
        },
      })
      const quotation = await prisma.workflowQuotation.create({
        data: {
          requestId: record.id,
          version: 1,
          status: "ACCEPTED",
          scope: "PRIVATE-SCOPE",
          deliverables: ["PRIVATE-DELIVERABLE"],
          lineItems: [{ secret: "PRIVATE-LINE-ITEM" }],
          total: "4000",
          currency: "PHP",
          timeline: "PRIVATE-TIMELINE",
          paymentTerms: "PRIVATE-TERMS",
          paymentDue: "4000",
          validUntil: new Date("2026-12-01"),
          decisionNote: "PRIVATE-DECISION",
          createdById: head.user.id,
          internallyApprovedById: admin.user.id,
          internallyApprovedAt: stamp,
          publishedAt: stamp,
        },
      })
      await prisma.workflowApproval.create({
        data: {
          requestId: record.id,
          quotationId: quotation.id,
          amount: "4000",
          currency: "PHP",
          approvedById: owner.user.id,
          approvedAt: stamp,
        },
      })
      await prisma.workflowAgreement.create({
        data: {
          requestId: record.id,
          status: "APPROVED",
          documentFileId: file.id,
          signedFileId: file.id,
          reviewedById: admin.user.id,
          reviewedAt: stamp,
        },
      })
      await prisma.workflowPayment.create({
        data: {
          requestId: record.id,
          status: "SUBMITTED",
          amount: "4000",
          currency: "PHP",
          proofFileId: file.id,
          reference: "PRIVATE-PAYMENT-CREDENTIALS",
        },
      })
      const employee = await prisma.employee.create({
        data: {
          employeeId: `INSPECT-${index}`,
          fullName: `Assigned ${index}`,
          userId: index ? null : staff.user.id,
          departmentId: department.id,
          email: "PRIVATE-HR",
        },
      })
      const project = await prisma.project.create({
        data: {
          requestId: record.id,
          clientId: owner.user.id,
          name: `Project ${index}`,
          quotationId: quotation.id,
          status: "PLANNED",
          staff: {
            create: {
              employeeId: employee.id,
              isTeamLead: true,
              weeklyHours: 20,
              approvedById: head.user.id,
              approvedAt: stamp,
            },
          },
        },
      })
      const events = []
      for (const [eventIndex, type] of [
        "CONSULTATION_OPENED",
        "REQUIREMENT_SUBMITTED",
        "QUOTATION_INTERNAL_APPROVED",
        "APPROVAL_CONFIRMED",
        "PAYMENT_VERIFIED",
        "STAFFING_APPROVED",
      ].entries())
        events.push(
          await prisma.workflowEvent.create({
            data: {
              requestId: record.id,
              type,
              summary: "PRIVATE-EVENT-SUMMARY",
              entityId: file.id,
              actorId: eventIndex % 2 ? head.user.id : admin.user.id,
              internal: eventIndex === 2 || eventIndex === 5,
              createdAt: new Date(stamp.getTime() + eventIndex * 1000),
            },
          }),
        )
      for (const type of [
        "INTERNAL_NOTE",
        "PAYMENT_INTERNAL_REVIEW",
        "UNREVIEWED_EVENT",
      ])
        await prisma.workflowEvent.create({
          data: {
            requestId: record.id,
            type,
            summary: "PRIVATE-INTERNAL-NOTE",
            actorId: head.user.id,
            internal: true,
          },
        })
      records.push({
        record,
        file,
        quotation,
        requirement,
        conversation,
        meeting,
        project,
        events,
      })
    }
    const get = (path: string, who = sa) =>
      fetch(`${base}${path}`, { headers: who.headers })
    type Inspection = {
      state: string
      previousState: string | null
      version: number
      nextAction: string
      consultationComplete: boolean
      permissions: Record<string, boolean>
      capabilities: Record<string, boolean>
      requirements: { id: string; status: string; title: string }[]
      consultations: { status: string; startsAt: string }[]
      meetings: { id: string; status: string; proposedStartsAt: string }[]
      quotations: {
        id: string
        status: string
        version: number
        internallyApprovedAt: string
      }[]
      approval: { approvedAt: string; approvedBy: { id: string } }
      agreement: { status: string; reviewedAt: string }
      payment: { status: string; verifiedAt: string | null }
      quotationApprover: { id: string }
      paymentVerifier: { id: string }
      project: {
        id: string
        startDate: string | null
        staff: { employee: { fullName: string }; approvedAt: string }[]
      }
      events: {
        id: string
        type: string
        summary: string
        createdAt: string
        internal: boolean
        entityId: null
        actor: { id: string }
      }[]
    }
    async function inspect(id: string) {
      const response = await get(`/administrative-requests/${id}`)
      assert.equal(response.status, 200)
      const text = await response.text()
      assert.ok(!text.includes("PRIVATE-"))
      return {
        text,
        inspection: (
          JSON.parse(text) as {
            serviceRequest: { workflowInspection: Inspection }
          }
        ).serviceRequest.workflowInspection,
      }
    }
    for (const [index, item] of records.entries()) {
      const { text, inspection } = await inspect(item.record.id)
      for (const id of [item.file.id, item.conversation.id, item.meeting.id])
        assert.ok(!text.includes(id))
      assert.equal(inspection.state, "AGREEMENT_PAYMENT_PENDING")
      assert.equal(inspection.consultationComplete, true)
      assert.ok(Object.values(inspection.permissions).every((value) => !value))
      assert.ok(
        Object.entries(inspection.capabilities).every(
          ([key, value]) => value === (key === "read"),
        ),
      )
      assert.equal(inspection.requirements[0].status, "SUBMITTED")
      assert.equal(inspection.consultations[0].status, "COMPLETED")
      assert.equal(inspection.consultations[0].startsAt, stamp.toISOString())
      assert.equal(inspection.meetings[0].id, "meeting-1")
      assert.equal(
        inspection.meetings[0].proposedStartsAt,
        new Date(stamp.getTime() + 7200000).toISOString(),
      )
      assert.equal(
        inspection.quotations[0].internallyApprovedAt,
        stamp.toISOString(),
      )
      assert.equal(inspection.quotations[0].status, "ACCEPTED")
      assert.equal(inspection.approval.approvedAt, stamp.toISOString())
      assert.equal(
        inspection.approval.approvedBy.id,
        index ? other.user.id : client.user.id,
      )
      assert.equal(inspection.agreement.status, "APPROVED")
      assert.equal(inspection.payment.status, "SUBMITTED")
      assert.equal(inspection.payment.verifiedAt, null)
      assert.equal(inspection.quotationApprover.id, admin.user.id)
      assert.equal(inspection.paymentVerifier.id, admin.user.id)
      assert.equal(
        inspection.project.staff[0].employee.fullName,
        `Assigned ${index}`,
      )
      assert.equal(inspection.project.startDate, null)
      assert.deepEqual(
        inspection.events.map((event) => event.id),
        item.events.map((event) => event.id),
      )
      assert.deepEqual(
        inspection.events.map((event) => event.actor.id),
        item.events.map((event) => event.actorId),
      )
      assert.equal(
        inspection.events.find((event) => event.type === "PAYMENT_VERIFIED")!
          .summary,
        "Payment verification reviewed",
      )
      assert.ok(inspection.events.every((event) => event.entityId === null))
      assert.equal(
        (await get(`/request-workflows/${item.record.id}`)).status,
        404,
      )
      assert.equal(
        (
          await get(
            `/request-workflows/${item.record.id}/files/${item.file.id}`,
          )
        ).status,
        404,
      )
      assert.equal(
        (await get(`/request-conversations/${item.conversation.id}`)).status,
        404,
      )
      for (const command of [
        { type: "PREPARE_QUOTATION" },
        { type: "APPROVE_QUOTATION", quotationId: item.quotation.id },
        { type: "VERIFY_PAYMENT", approve: true, note: "" },
        { type: "ACTIVATE_PROJECT" },
        { type: "STAFF_PROJECT", employeeIds: ["employee"] },
      ])
        assert.equal(
          (
            await fetch(`${base}/request-workflows/${item.record.id}/actions`, {
              method: "POST",
              headers: sa.headers,
              body: JSON.stringify({
                ...command,
                actionId: randomUUID(),
                expectedVersion: 1,
              }),
            })
          ).status,
          404,
        )
      assert.equal(
        (
          await prisma.requestWorkflow.findUniqueOrThrow({
            where: { requestId: item.record.id },
          })
        ).version,
        1,
      )
      assert.equal(
        await prisma.workflowEvent.count({
          where: { requestId: item.record.id },
        }),
        9,
      )
    }
    for (const state of Object.values(RequestWorkflowState)) {
      await prisma.requestWorkflow.update({
        where: { requestId: records[0].record.id },
        data: {
          state,
          previousState: state === "ON_HOLD" ? "QUOTATION_PENDING" : null,
        },
      })
      const { inspection } = await inspect(records[0].record.id)
      assert.equal(inspection.state, state)
      assert.equal(
        inspection.previousState,
        state === "ON_HOLD" ? "QUOTATION_PENDING" : null,
      )
      assert.ok(inspection.nextAction.length > 0)
    }
    await prisma.project.update({
      where: { id: records[0].project.id },
      data: { startDate: stamp, status: "IN_PROGRESS" },
    })
    assert.equal(
      (await inspect(records[0].record.id)).inspection.project.startDate,
      stamp.toISOString(),
    )
    const pending = await prisma.serviceRequest.create({
      data: {
        clientId: client.user.id,
        serviceId: service.id,
        title: "Not accepted",
      },
    })
    const untouched = await inspect(pending.id)
    assert.equal(untouched.inspection.state, "PENDING_REVIEW")
    assert.equal(untouched.inspection.version, 0)
    assert.equal(
      await prisma.requestWorkflow.count({ where: { requestId: pending.id } }),
      0,
    )
    await prisma.serviceRequest.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    })
    assert.equal((await inspect(pending.id)).inspection.state, "CANCELLED")
    for (const who of [admin, head, staff, client, other])
      assert.equal(
        (await get(`/administrative-requests/${records[0].record.id}`, who))
          .status,
        403,
      )
    assert.equal(
      (await fetch(`${base}/administrative-requests/${records[0].record.id}`))
        .status,
      401,
    )
    assert.equal((await get("/administrative-requests/missing")).status, 404)
    assert.equal(
      (await get(`/request-workflows/${records[0].record.id}`, head)).status,
      200,
    )
    assert.equal(
      (await get(`/request-workflows/${records[1].record.id}`, head)).status,
      404,
    )
    assert.equal(
      (await get(`/request-workflows/${records[0].record.id}`, client)).status,
      200,
    )
    assert.equal(
      (await get(`/request-workflows/${records[1].record.id}`, client)).status,
      404,
    )
    assert.equal(
      (await get(`/request-workflows/${records[0].record.id}`, staff)).status,
      404,
    )
    const operational = await get(
      `/request-workflows/${records[0].record.id}`,
      admin,
    )
    assert.equal(operational.status, 200)
    assert.deepEqual(
      ((await operational.json()) as { permissions: unknown }).permissions,
      {
        isClient: false,
        manage: false,
        approveQuotation: true,
        verifyPayment: true,
      },
    )
    await prisma.requestWorkflow.update({
      where: { requestId: records[1].record.id },
      data: { quotationApproverId: sa.user.id, paymentVerifierId: sa.user.id },
    })
    assert.ok(
      Object.values(
        (await inspect(records[1].record.id)).inspection.permissions,
      ).every((value) => !value),
    )
    assert.equal(
      (await get(`/request-workflows/${records[1].record.id}`)).status,
      200,
    )
    assert.equal(
      await prisma.employee.count({ where: { userId: sa.user.id } }),
      0,
    )
    assert.equal(
      await prisma.department.count({ where: { headId: sa.user.id } }),
      0,
    )
    await prisma.user.update({
      where: { id: sa.user.id },
      data: { role: "ADMIN" },
    })
    assert.equal(
      (await get(`/administrative-requests/${records[1].record.id}`)).status,
      403,
    )
  },
)
