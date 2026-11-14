import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "[P23-API-001] completed client projects keep owner-scoped deliverable review and Unicode boundary behavior",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const client = await prisma.user.create({
      data: {
        id: "p23-api-client",
        email: "p23-api-client@example.com",
        fullName: "Page 23 Client",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const foreign = await prisma.user.create({
      data: {
        id: "p23-api-foreign",
        email: "p23-api-foreign@example.com",
        fullName: "Page 23 Foreign Client",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const staff = await prisma.user.create({
      data: {
        id: "p23-api-staff",
        email: "p23-api-staff@example.com",
        fullName: "Page 23 Staff",
        passwordHash: "test-only-hash",
        role: "STAFF",
      },
    })
    const admin = await prisma.user.create({
      data: {
        id: "p23-api-admin",
        email: "p23-api-admin@example.com",
        fullName: "Page 23 Admin",
        passwordHash: "test-only-hash",
        role: "ADMIN",
      },
    })
    const superadmin = await prisma.user.create({
      data: {
        id: "p23-api-superadmin",
        email: "p23-api-superadmin@example.com",
        fullName: "Page 23 Superadmin",
        passwordHash: "test-only-hash",
        role: "SUPERADMIN",
      },
    })
    const service = await prisma.service.create({
      data: {
        name: "Page 23 API service",
        description: "Isolated service for client deliverable tests.",
      },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        id: "p23-api-request",
        clientId: client.id,
        serviceId: service.id,
        title: "Page 23 completed project",
        status: "CLOSED",
        workflow: { create: {} },
      },
    })
    const project = await prisma.project.create({
      data: {
        id: "p23-api-project",
        clientId: client.id,
        requestId: request.id,
        name: "Completed Aurora launch",
        status: "COMPLETED",
        startDate: new Date("2026-11-10T08:00:00.000Z"),
      },
    })
    const file = await prisma.workflowFile.create({
      data: {
        requestId: request.id,
        uploaderId: staff.id,
        uploadId: randomUUID(),
        name: "completed-design.txt",
        mimeType: "text/plain",
        size: 32,
        sha256: "a".repeat(64),
        clientVisible: true,
        data: Buffer.from("isolated completed project bytes"),
      },
    })
    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId: project.id,
        title: "Final design",
        description: "Approved brand treatment",
        deliveryStatus: "SENT_TO_CLIENT",
        sentToClientAt: new Date("2026-11-10T08:00:00.000Z"),
        workflowFileId: file.id,
      },
    })
    const actors = new Map(
      await Promise.all(
        [client, foreign, staff, admin, superadmin].map(
          async (user) => [user.id, (await issueSession(user)).token] as const,
        ),
      ),
    )
    const path = `/projects/${project.id}/deliverables/${milestone.id}`
    async function api(
      suffix: string,
      actorId?: string,
      method = "GET",
      body?: unknown,
    ) {
      const token = actorId ? actors.get(actorId) : undefined
      return fetch(`${base}${suffix}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }

    assert.equal((await api(`${path}/file`)).status, 401)
    assert.equal(
      (
        await api(`${path}/review`, undefined, "POST", {
          decision: "APPROVED",
        })
      ).status,
      401,
    )
    for (const user of [foreign, staff, admin, superadmin]) {
      assert.equal((await api(`${path}/file`, user.id)).status, 404)
      assert.equal(
        (await api(`${path}/review`, user.id, "POST", { decision: "APPROVED" }))
          .status,
        404,
      )
    }

    const fileResponse = await api(`${path}/file`, client.id)
    assert.equal(fileResponse.status, 200)
    assert.equal(await fileResponse.text(), "isolated completed project bytes")
    assert.equal(fileResponse.headers.get("x-content-type-options"), "nosniff")

    const note = "🙂x"
    assert.equal(note.trim().length, 3)
    const reviewResponse = await api(`${path}/review`, client.id, "POST", {
      decision: "REVISION_REQUESTED",
      note: ` ${note} `,
    })
    assert.equal(
      reviewResponse.status,
      200,
      await reviewResponse.clone().text(),
    )
    const reviewedProject = (await reviewResponse.json()) as {
      status: string
      deliverables: {
        id: string
        workflowFile: { id: string; name: string }
        clientReviews: {
          status: string
          note: string | null
          workflowFileId: string | null
          createdAt: string
        }[]
      }[]
    }
    assert.equal(reviewedProject.status, "COMPLETED")
    assert.equal(
      reviewedProject.deliverables[0]?.clientReviews[0]?.status,
      "REVISION_REQUESTED",
    )
    assert.equal(reviewedProject.deliverables[0]?.clientReviews[0]?.note, note)
    assert.equal(
      reviewedProject.deliverables[0]?.clientReviews[0]?.workflowFileId,
      file.id,
    )
    assert.ok(
      Number.isFinite(
        Date.parse(
          reviewedProject.deliverables[0]?.clientReviews[0]?.createdAt ?? "",
        ),
      ),
    )
    assert.equal(reviewedProject.deliverables[0]?.id, milestone.id)
    assert.deepEqual(reviewedProject.deliverables[0]?.workflowFile, {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt.toISOString(),
    })
    assert.equal(
      (
        await prisma.projectDeliverableClientReview.findUniqueOrThrow({
          where: {
            workflowFileId_clientId: {
              workflowFileId: file.id,
              clientId: client.id,
            },
          },
        })
      ).note,
      note,
    )
    assert.equal(
      (
        await api(`${path}/review`, client.id, "POST", {
          decision: "APPROVED",
        })
      ).status,
      409,
    )
    assert.equal(
      await prisma.projectDeliverableClientReview.count({
        where: { milestoneId: milestone.id },
      }),
      1,
    )
  },
)
