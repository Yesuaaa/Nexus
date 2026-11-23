import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "[P22-API-001] My Projects listing stays owner-scoped when selector query parameters are supplied",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const owner = await prisma.user.create({
      data: {
        id: "p22-project-owner",
        email: "p22-project-owner@example.com",
        fullName: "Page 22 owner",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const foreign = await prisma.user.create({
      data: {
        id: "p22-project-foreign",
        email: "p22-project-foreign@example.com",
        fullName: "Page 22 foreign client",
        passwordHash: "test-only-hash",
        role: "USER",
      },
    })
    const ownerSession = await issueSession(owner)
    const foreignSession = await issueSession(foreign)
    const ownerProjectIds: string[] = []

    for (const status of [
      "IN_PROGRESS",
      "ON_HOLD",
      "COMPLETED",
      "CANCELLED",
      "PLANNED",
    ] as const) {
      const project = await prisma.project.create({
        data: {
          id: `p22-${status.toLocaleLowerCase()}`,
          clientId: owner.id,
          name: `Page 22 ${status}`,
          status,
          workPlan: {
            phases: [
              {
                tasks: [
                  { status: "DONE" },
                  { status: "DONE" },
                  { status: "IN_PROGRESS" },
                ],
              },
            ],
          },
        },
      })
      ownerProjectIds.push(project.id)
    }
    const foreignProject = await prisma.project.create({
      data: {
        id: "p22-foreign-project",
        clientId: foreign.id,
        name: "Foreign confidential launch",
        status: "IN_PROGRESS",
        workPlan: { phases: [] },
      },
    })

    const unauthenticated = await fetch(`${base}/projects`)
    assert.equal(unauthenticated.status, 401)

    const url = new URL(`${base}/projects`)
    url.searchParams.set("clientId", foreign.id)
    url.searchParams.set("userId", foreign.id)
    url.searchParams.set("projectId", foreignProject.id)
    url.searchParams.set("requestId", "foreign-request-id")
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${ownerSession.token}` },
    })
    assert.equal(response.status, 200)
    const summaries = (await response.json()) as {
      id: string
      name: string
      status: string
      completedTasks: number
      taskCount: number
      deliverableCount: number
    }[]

    assert.deepEqual(
      summaries.map(({ id }) => id).sort(),
      ownerProjectIds.filter((id) => id !== "p22-planned").sort(),
    )
    assert.ok(!summaries.some(({ name }) => name.includes("confidential")))
    assert.ok(
      summaries.every(
        (summary) =>
          !Object.hasOwn(summary, "clientId") &&
          !Object.hasOwn(summary, "workPlan"),
      ),
    )
    const active = summaries.find(({ id }) => id === "p22-in_progress")
    assert.deepEqual(
      {
        completedTasks: active?.completedTasks,
        taskCount: active?.taskCount,
        deliverableCount: active?.deliverableCount,
      },
      { completedTasks: 2, taskCount: 3, deliverableCount: 0 },
    )

    const foreignRead = await fetch(`${base}/projects`, {
      headers: { authorization: `Bearer ${foreignSession.token}` },
    })
    assert.equal(foreignRead.status, 200)
    const foreignSummaries = (await foreignRead.json()) as { id: string }[]
    assert.deepEqual(
      foreignSummaries.map(({ id }) => id),
      [foreignProject.id],
    )
  },
)
