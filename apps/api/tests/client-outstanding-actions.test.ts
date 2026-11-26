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
    const currentQuoteRequestId = current.id
    await t.test(
      "financial and deliverable eligibility follows the current version",
      async () => {
        const financialResults = async () => {
          const response = await read(0)
          assert.equal(response.status, 200)
          return (await response.json()) as {
            total: number
            actions: { title: string; reference: string | null }[]
          }
        }
        const baseTotal = (await financialResults()).total
        for (const [amount, mandatory, status, expected] of [
          [0, true, "PENDING", 0],
          [-10, true, "PENDING", 0],
          [500, false, "PENDING", 0],
          [500, true, "VERIFIED", 0],
          [500, true, "SUBMITTED", 0],
          [500, true, "PENDING", 1],
        ] as const) {
          await prisma.workflowPayment.update({
            where: { requestId: financial.id },
            data: { amount, mandatory, status },
          })
          assert.equal((await financialResults()).total, baseTotal + expected)
        }
        await prisma.workflowAgreement.update({
          where: { requestId: financial.id },
          data: { documentFileId: null },
        })
        assert.equal((await financialResults()).total, baseTotal)
        await prisma.workflowAgreement.update({
          where: { requestId: financial.id },
          data: { status: "APPROVED" },
        })
        assert.equal((await financialResults()).total, baseTotal)
        await prisma.requestWorkflow.update({
          where: { requestId: financial.id },
          data: { state: "ON_HOLD" },
        })
        assert.equal((await financialResults()).total, baseTotal - 1)

        const nextFile = await prisma.workflowFile.create({
          data: {
            requestId: requirement.id,
            uploaderId: head.id,
            uploadId: "deliverable-v2",
            name: "New launch.pdf",
            mimeType: "application/pdf",
            size: 1,
            sha256: "test",
            data: Buffer.from("y"),
            clientVisible: false,
          },
        })
        await prisma.projectMilestone.update({
          where: { id: milestone.id },
          data: { workflowFileId: nextFile.id },
        })
        assert.equal((await financialResults()).total, baseTotal - 1)
        await prisma.workflowFile.update({
          where: { id: nextFile.id },
          data: { clientVisible: true },
        })
        assert.equal((await financialResults()).total, baseTotal)
        await prisma.project.update({
          where: { id: project.id },
          data: { status: "CANCELLED" },
        })
        assert.equal((await financialResults()).total, baseTotal - 1)
        await prisma.projectMilestone.update({
          where: { id: milestone.id },
          data: { workflowFileId: null },
        })
        assert.equal((await financialResults()).total, baseTotal - 1)
      },
    )

    await t.test(
      "session isolation, pagination boundaries, and workflow changes use current records",
      async () => {
        const secondSession = await issueSession(client)
        const secondRead = () =>
          fetch(base + path, {
            headers: { authorization: "Bearer " + secondSession.token },
          })
        const snapshot = async (response: Response) => {
          assert.equal(response.status, 200)
          return (await response.json()) as {
            total: number
            actions: { id: string; reference: string }[]
          }
        }
        const [a1, a2, b] = await Promise.all([
          read(0).then(snapshot),
          secondRead().then(snapshot),
          read(1).then(snapshot),
        ])
        assert.deepEqual(a1, a2)
        assert.ok(b.actions.every((item) => item.reference === "FOREIGN"))
        assert.ok(a1.actions.every((item) => item.reference !== "FOREIGN"))
        for (const invalid of ["-1", "100001", "1.5", "abc", "1&page=2"])
          assert.equal((await read(0, path + "?page=" + invalid)).status, 400)
        const large = await snapshot(await read(0, path + "?page=100000"))
        assert.equal(large.total, a1.total)
        assert.equal(large.actions.length, 0)
        const pendingRows = await prisma.workflowRequirement.findMany({
          where: { requestId: requirement.id, status: "REQUESTED" },
          orderBy: { id: "asc" },
        })
        for (const target of [11, 10, 2, 1, 0]) {
          const current = await snapshot(await read(0))
          const countToComplete = current.total - target
          const rows = await prisma.workflowRequirement.findMany({
            where: { requestId: requirement.id, status: "REQUESTED" },
            take: countToComplete,
          })
          await prisma.workflowRequirement.updateMany({
            where: { id: { in: rows.map((row) => row.id) } },
            data: { status: "COMPLETED" },
          })
          if (target === 0)
            await prisma.workflowQuotation.updateMany({
              where: { requestId: currentQuoteRequestId },
              data: { validUntil: new Date() },
            })
          const result = await snapshot(await read(0))
          assert.equal(result.total, target)
          assert.equal(result.actions.length, Math.min(10, target))
          const tail = await snapshot(await read(0, path + "?page=2"))
          assert.equal(tail.actions.length, Math.max(0, target - 10))
        }
        assert.ok(pendingRows.length > 0)
        await prisma.user.update({
          where: { id: client.id },
          data: { role: "STAFF" },
        })
        assert.equal((await secondRead()).status, 403)
        await prisma.user.update({
          where: { id: client.id },
          data: { role: "USER" },
        })
        await prisma.session.updateMany({
          where: { userId: client.id },
          data: { expiresAt: new Date(0) },
        })
        assert.equal((await read(0)).status, 401)
        const revoked = await issueSession(client)
        await prisma.session.deleteMany({ where: { userId: client.id } })
        assert.equal(
          (
            await fetch(base + path, {
              headers: { authorization: "Bearer " + revoked.token },
            })
          ).status,
          401,
        )
      },
    )
  },
)
