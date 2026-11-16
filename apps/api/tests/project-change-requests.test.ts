import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

type RequestRow = {
  id: string
  kind: "CHANGE" | "CANCELLATION"
  details: string
  status: "PENDING" | "ACCEPTED" | "NOT_APPROVED"
  responseNote: string | null
  createdAt: string
}

type ProjectResponse = {
  id: string
  status: string
  changeRequests: RequestRow[]
}

test(
  "clients can keep independent project requests and cancellation approval stays one-time",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const [client, otherClient, head] = await Promise.all(
      ["client", "other-client", "head"].map((name) =>
        prisma.user.create({
          data: {
            email: `${name}@project-requests.test`,
            fullName: name,
            role: name === "head" ? "STAFF" : "USER",
            passwordHash: "test-only",
          },
        }),
      ),
    )
    const department = await prisma.department.create({
      data: { name: "Project Requests", headId: head.id },
    })
    const service = await prisma.service.create({
      data: {
        name: "Project Requests Service",
        description: "Service for project request tests",
        departments: { connect: { id: department.id } },
      },
    })
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Project request test booking",
        status: "ACTIVATED",
        acceptedDepartmentId: department.id,
        workflow: { create: { state: "ACTIVE_PROJECT" } },
      },
    })
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        requestId: serviceRequest.id,
        name: "Project request test project",
        status: "IN_PROGRESS",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    })
    const [clientSession, otherClientSession, headSession] = await Promise.all(
      [client, otherClient, head].map((user) => issueSession(user)),
    )

    async function call(
      token: string,
      path = "",
      method = "GET",
      body?: unknown,
    ) {
      return fetch(`${base}/projects/${project.id}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }

    async function submit(
      path: "/change-requests" | "/cancellation-requests",
      details: string,
    ) {
      const response = await call(clientSession.token, path, "POST", {
        details,
      })
      assert.equal(response.status, 201, await response.clone().text())
      return (await response.json()) as ProjectResponse
    }

    const changeOne = await submit(
      "/change-requests",
      "Please revise the first project detail.",
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    const changeTwo = await submit(
      "/change-requests",
      "Please revise a second project detail.",
    )
    assert.notEqual(
      changeOne.changeRequests[0]?.id,
      changeTwo.changeRequests[0]?.id,
    )
    const changeIds = changeTwo.changeRequests.map((request) => request.id)
    const changeTwoId = changeTwo.changeRequests.find(
      (request) => request.details === "Please revise a second project detail.",
    )?.id
    assert.ok(changeTwoId)
    assert.equal(new Set(changeIds).size, 2)
    assert.ok(
      changeTwo.changeRequests.every((request) => request.status === "PENDING"),
    )

    const rejectFirst = await call(
      headSession.token,
      `/change-requests/${changeIds.find((id) => id !== changeTwo.changeRequests[0]?.id)}`,
      "PATCH",
      { decision: "NOT_APPROVED", responseNote: "Please clarify this scope." },
    )
    assert.equal(rejectFirst.status, 200, await rejectFirst.clone().text())
    const afterReject = (await rejectFirst.json()) as ProjectResponse
    assert.equal(
      afterReject.changeRequests.find((request) => request.id === changeTwoId)
        ?.status,
      "PENDING",
    )

    await new Promise((resolve) => setTimeout(resolve, 10))
    const changeThree = await submit(
      "/change-requests",
      "Please revise a third project detail.",
    )
    const changeThreeId = changeThree.changeRequests.find(
      (request) => request.details === "Please revise a third project detail.",
    )?.id
    assert.ok(changeThreeId)

    await new Promise((resolve) => setTimeout(resolve, 10))
    const cancellationOne = await submit(
      "/cancellation-requests",
      "Please cancel the first time for this project.",
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    const cancellationTwo = await submit(
      "/cancellation-requests",
      "Please cancel the second time for this project.",
    )
    const cancellationRows = cancellationTwo.changeRequests.filter(
      (request) => request.kind === "CANCELLATION",
    )
    assert.equal(cancellationRows.length, 2)
    assert.equal(new Set(cancellationRows.map((request) => request.id)).size, 2)
    assert.ok(cancellationRows.every((request) => request.status === "PENDING"))
    assert.equal(
      cancellationTwo.changeRequests.filter(
        (request) => request.kind === "CHANGE",
      ).length,
      3,
    )
    assert.deepEqual(
      cancellationTwo.changeRequests.map((request) => request.createdAt),
      [...cancellationTwo.changeRequests]
        .map((request) => request.createdAt)
        .sort((left, right) => right.localeCompare(left)),
    )

    const unauthorizedRead = await call(otherClientSession.token)
    assert.equal(unauthorizedRead.status, 404)
    const unauthorizedCreate = await call(
      otherClientSession.token,
      "/change-requests",
      "POST",
      { details: "Try to change another client's project." },
    )
    assert.equal(unauthorizedCreate.status, 404)

    const firstCancellationId = cancellationOne.changeRequests.find(
      (request) => request.kind === "CANCELLATION",
    )?.id
    assert.ok(firstCancellationId)
    const approval = await call(
      headSession.token,
      `/cancellation-requests/${firstCancellationId}`,
      "PATCH",
      { decision: "ACCEPTED" },
    )
    assert.equal(approval.status, 200, await approval.clone().text())
    const afterApproval = (await approval.json()) as ProjectResponse
    assert.equal(afterApproval.status, "CANCELLED")
    assert.equal(
      afterApproval.changeRequests.find(
        (request) => request.id === firstCancellationId,
      )?.status,
      "ACCEPTED",
    )
    assert.ok(
      afterApproval.changeRequests
        .filter(
          (request) =>
            request.kind === "CANCELLATION" &&
            request.id !== firstCancellationId,
        )
        .every((request) => request.status === "NOT_APPROVED"),
    )

    const secondCancellationId = cancellationRows.find(
      (request) => request.id !== firstCancellationId,
    )?.id
    assert.ok(secondCancellationId)
    const repeatedApproval = await call(
      headSession.token,
      `/cancellation-requests/${secondCancellationId}`,
      "PATCH",
      { decision: "ACCEPTED" },
    )
    assert.equal(repeatedApproval.status, 409)
    assert.equal(
      await prisma.workflowEvent.count({
        where: {
          requestId: serviceRequest.id,
          type: "PROJECT_CANCELLATION_APPROVED",
        },
      }),
      1,
    )
    assert.equal(
      (
        await prisma.requestWorkflow.findUniqueOrThrow({
          where: { requestId: serviceRequest.id },
        })
      ).state,
      "CANCELLED",
    )
    assert.equal(
      (
        await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: serviceRequest.id },
        })
      ).status,
      "CANCELLED",
    )
  },
)
