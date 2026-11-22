import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "client outstanding actions are current, paginated, and independent of notifications",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const client = await prisma.user.create({
      data: {
        email: "client@actions.example.test",
        fullName: "Client",
        passwordHash: "test",
        role: "USER",
        settings: { workflowNotifications: false },
      },
    })
    const other = await prisma.user.create({
      data: {
        email: "other@actions.example.test",
        fullName: "Other",
        passwordHash: "test",
        role: "USER",
      },
    })
    const head = await prisma.user.create({
      data: {
        email: "head@actions.example.test",
        fullName: "Head",
        passwordHash: "test",
        role: "STAFF",
      },
    })
    const department = await prisma.department.create({
      data: { name: "Client action department", headId: head.id },
    })
    const service = await prisma.service.create({
      data: { name: "Action service", description: "Test service" },
    })
    async function request(
      referenceNumber: string,
      state:
        | "CONSULTATION"
        | "CLIENT_APPROVAL"
        | "QUOTATION_PENDING"
        | "ON_HOLD"
        | "AGREEMENT_PAYMENT_PENDING",
      clientId = client.id,
    ) {
      return prisma.serviceRequest.create({
        data: {
          referenceNumber,
          title: referenceNumber,
          serviceId: service.id,
          clientId,
          acceptedDepartmentId: department.id,
          workflow: { create: { state } },
        },
      })
    }
    const requirement = await request("OLD-REQUIREMENT", "CONSULTATION")
    const pending = await prisma.workflowRequirement.create({
      data: {
        requestId: requirement.id,
        title: "Old brief",
        createdAt: new Date("2020-01-01"),
      },
    })
    const notificationEvent = await prisma.workflowEvent.create({
      data: {
        requestId: requirement.id,
        type: "REQUIREMENT_REQUESTED",
        summary: "Old brief",
        actorId: head.id,
      },
    })
    const duplicateEvent = await prisma.workflowEvent.create({
      data: {
        requestId: requirement.id,
        type: "REQUIREMENT_REQUESTED",
        summary: "Old brief",
        actorId: head.id,
      },
    })
    await prisma.workflowNotification.createMany({
      data: [notificationEvent, duplicateEvent].map((event) => ({
        userId: client.id,
        requestId: requirement.id,
        eventId: event.id,
      })),
    })
    const current = await request("CURRENT-QUOTE", "CLIENT_APPROVAL")
    const expired = await request("EXPIRED-QUOTE", "CLIENT_APPROVAL")
    const superseded = await request("SUPERSEDED-QUOTE", "CLIENT_APPROVAL")
    const internal = await request("INTERNAL-QUOTE", "QUOTATION_PENDING")
    const held = await request("HELD", "ON_HOLD")
    await prisma.workflowRequirement.create({
      data: { requestId: held.id, title: "Held brief" },
    })
    const financial = await request("FINANCE", "AGREEMENT_PAYMENT_PENDING")
    const awaitingReview = await request(
      "UNDER-REVIEW",
      "AGREEMENT_PAYMENT_PENDING",
    )
    const foreign = await request(
      "FOREIGN",
      "AGREEMENT_PAYMENT_PENDING",
      other.id,
    )
    async function quote(
      requestId: string,
      version: number,
      status: "SENT" | "SUPERSEDED" | "PENDING_INTERNAL",
      future: boolean,
    ) {
      return prisma.workflowQuotation.create({
        data: {
          requestId,
          version,
          status,
          scope: "Scope",
          deliverables: ["Report"],
          lineItems: [],
          total: 500,
          currency: "PHP",
          timeline: "Timeline",
          paymentTerms: "Terms",
          paymentDue: 500,
          validUntil: new Date(Date.now() + (future ? 1 : -1) * 86_400_000),
          createdById: head.id,
          publishedAt: status === "PENDING_INTERNAL" ? null : new Date(),
        },
      })
    }
    await quote(current.id, 1, "SENT", true)
    await quote(expired.id, 1, "SENT", false)
    await quote(superseded.id, 1, "SENT", true)
    await quote(superseded.id, 2, "SUPERSEDED", true)
    await quote(internal.id, 1, "PENDING_INTERNAL", true)
    async function finance(requestId: string, status: "PENDING" | "SUBMITTED") {
      const file = await prisma.workflowFile.create({
        data: {
          requestId,
          uploaderId: head.id,
          uploadId: "agreement-" + requestId,
          name: "Agreement.pdf",
          mimeType: "application/pdf",
          size: 1,
          sha256: "test",
          data: Buffer.from("x"),
          clientVisible: true,
        },
      })
      await prisma.workflowAgreement.create({
        data: { requestId, documentFileId: file.id, status },
      })
      await prisma.workflowPayment.create({
        data: { requestId, amount: 500, currency: "PHP", status },
      })
    }
    await finance(financial.id, "PENDING")
    await finance(awaitingReview.id, "SUBMITTED")
    await finance(foreign.id, "PENDING")
    const sessions = await Promise.all(
      [client, other, head].map((account) => issueSession(account)),
    )
    const path = "/request-workflows/outstanding-actions"
    function read(index: number, suffix = path) {
      return fetch(base + suffix, {
        headers: { authorization: "Bearer " + sessions[index]!.token },
      })
    }
    const response = await read(
      0,
      path + "?page=1&clientId=" + other.id + "&requestId=" + foreign.id,
    )
    assert.equal(response.status, 200)
    const result = (await response.json()) as {
      total: number
      actions: { reference: string; title: string }[]
    }
    assert.equal(result.total, 4)
    assert.deepEqual(
      result.actions.map((item) => item.reference + ":" + item.title).sort(),
      [
        "CURRENT-QUOTE:Review your quotation",
        "FINANCE:Complete your payment",
        "FINANCE:Sign your agreement",
        "OLD-REQUIREMENT:Provide the requested information",
      ],
    )
    assert.equal((await read(2)).status, 403)
    assert.equal((await fetch(base + path)).status, 401)
    assert.equal((await read(0, path + "?page=0")).status, 400)
    assert.equal(
      (await read(0, "/request-workflows/" + foreign.id)).status,
      404,
    )
    const otherActions = (await (await read(1)).json()) as {
      total: number
      actions: { reference: string }[]
    }
    assert.equal(otherActions.total, 2)
    assert.ok(
      otherActions.actions.every((item) => item.reference === "FOREIGN"),
    )
    await prisma.workflowRequirement.update({
      where: { id: pending.id },
      data: { status: "COMPLETED" },
    })
    await prisma.workflowPayment.update({
      where: { requestId: financial.id },
      data: { status: "SUBMITTED" },
    })
    const next = (await (await read(0)).json()) as { total: number }
    assert.equal(next.total, 2)
    for (let index = 0; index < 11; index++) {
      await prisma.workflowRequirement.create({
        data: { requestId: requirement.id, title: "Page item " + index },
      })
    }
    const firstPage = (await (await read(0)).json()) as {
      total: number
      actions: { id: string }[]
    }
    const secondPage = (await (
      await read(0, path + "?page=2")
    ).json()) as typeof firstPage
    assert.equal(firstPage.total, 13)
    assert.equal(secondPage.total, 13)
    assert.equal(firstPage.actions.length, 10)
    assert.equal(secondPage.actions.length, 3)
    assert.equal(
      new Set(
        [...firstPage.actions, ...secondPage.actions].map((item) => item.id),
      ).size,
      13,
    )
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        requestId: requirement.id,
        name: "Client launch",
        status: "IN_PROGRESS",
        startDate: new Date(),
      },
    })
    const artifact = await prisma.workflowFile.create({
      data: {
        requestId: requirement.id,
        uploaderId: head.id,
        uploadId: "deliverable-v1",
        name: "Launch.pdf",
        mimeType: "application/pdf",
        size: 1,
        sha256: "test",
        data: Buffer.from("x"),
        clientVisible: true,
      },
    })
    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId: project.id,
        title: "Launch report",
        workflowFileId: artifact.id,
        deliveryStatus: "SENT_TO_CLIENT",
        sentToClientAt: new Date(),
      },
    })
    const resultWithDeliverable = (await (
      await read(0, path + "?page=2")
    ).json()) as {
      total: number
      actions: { id: string; destination?: string }[]
    }
    assert.equal(resultWithDeliverable.total, 14)
    assert.equal(
      resultWithDeliverable.actions.find((action) =>
        action.id.startsWith("deliverable:"),
      )?.destination,
      "/projects/" + project.id + "/deliverables/" + milestone.id,
    )
    const foreignFile = await read(
      1,
      "/projects/" + project.id + "/deliverables/" + milestone.id + "/file",
    )
    assert.equal(foreignFile.status, 404)
    await prisma.projectDeliverableClientReview.create({
      data: {
        milestoneId: milestone.id,
        workflowFileId: artifact.id,
        clientId: client.id,
        status: "APPROVED",
      },
    })
    const afterReview = (await (await read(0, path + "?page=2")).json()) as {
      total: number
    }
    assert.equal(afterReview.total, 13)
  },
)
