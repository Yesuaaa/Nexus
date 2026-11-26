import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp, readMigration } from "./support/pglite-app.js"
import { issueSession } from "../src/features/auth/auth.service.js"
import {
  updateProjectWorkspaceStatus,
  cancelProjectWorkspace,
} from "../src/features/project-workspace/workspace-lifecycle.service.js"

test(
  "request lifecycle migration, filters, completion and cancellation preserve their meanings",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const head = await prisma.user.create({
      data: {
        email: "head@lifecycle.test",
        passwordHash: "unused",
        role: "STAFF",
      },
    })
    const client = await prisma.user.create({
      data: {
        email: "client@lifecycle.test",
        passwordHash: "unused",
        role: "USER",
      },
    })
    const department = await prisma.department.create({
      data: { name: "Lifecycle", headId: head.id },
    })
    const service = await prisma.service.create({
      data: {
        name: "Lifecycle",
        description: "Lifecycle service",
        departments: { connect: { id: department.id } },
      },
    })
    const headers = {
      Authorization: `Bearer ${(await issueSession(head)).token}`,
    }
    const records = []
    for (const status of [
      "SUBMITTED",
      "UNDER_REVIEW",
      "ACTIVATED",
      "CANCELLED",
      "CONCLUDED",
    ] as const) {
      const request = await prisma.serviceRequest.create({
        data: {
          clientId: client.id,
          serviceId: service.id,
          title: status,
          status,
          ...(status !== "SUBMITTED"
            ? { acceptedDepartmentId: department.id }
            : {}),
        },
      })
      records.push(request)
      if (status !== "SUBMITTED")
        await prisma.requestWorkflow.create({
          data: { requestId: request.id, state: "ACTIVE_PROJECT" },
        })
      const view =
        status === "SUBMITTED"
          ? "pending"
          : status.toLowerCase().replaceAll("_", "-")
      const response = await fetch(`${base}/request-inbox?view=${view}`, {
        headers,
      })
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        serviceRequests: { id: string; status: string }[]
      }
      assert.deepEqual(
        body.serviceRequests.map((item) => item.status),
        [status],
      )
    }
    const active = records[2]!
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        requestId: active.id,
        name: "Active workspace",
        status: "IN_PROGRESS",
        workPlan: {
          phases: [
            {
              id: "delivery",
              title: "Delivery",
              tasks: [
                {
                  id: "task",
                  title: "Deliver",
                  role: "Designer",
                  status: "IN_PROGRESS",
                },
              ],
            },
          ],
        },
      },
    })
    await assert.rejects(
      updateProjectWorkspaceStatus(head.id, project.id, "COMPLETE"),
      /Finish every project task/,
    )
    assert.equal(
      (
        await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: active.id },
        })
      ).status,
      "ACTIVATED",
    )
    await prisma.project.update({
      where: { id: project.id },
      data: {
        workPlan: {
          phases: [
            {
              id: "delivery",
              title: "Delivery",
              tasks: [
                {
                  id: "task",
                  title: "Deliver",
                  role: "Designer",
                  status: "DONE",
                },
              ],
            },
          ],
        },
      },
    })
    await updateProjectWorkspaceStatus(head.id, project.id, "COMPLETE")
    assert.equal(
      (
        await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: active.id },
        })
      ).status,
      "CONCLUDED",
    )
    const review = records[1]!
    const cancelledProject = await prisma.project.create({
      data: {
        clientId: client.id,
        requestId: review.id,
        name: "Cancelled workspace",
        status: "IN_PROGRESS",
      },
    })
    await cancelProjectWorkspace(head.id, cancelledProject.id)
    assert.equal(
      (
        await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: review.id },
        })
      ).status,
      "CANCELLED",
    )
    await prisma.serviceRequest.update({
      where: { id: records[0]!.id },
      data: {
        status: "READY_FOR_QUOTATION",
        acceptedDepartmentId: department.id,
      },
    })
    await db.exec(
      await readMigration("20261115040100_normalize_request_lifecycle"),
    )
    assert.equal(
      (
        await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: records[0]!.id },
        })
      ).status,
      "UNDER_REVIEW",
    )
    assert.equal(
      (
        await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: active.id },
        })
      ).status,
      "CONCLUDED",
    )
  },
)
