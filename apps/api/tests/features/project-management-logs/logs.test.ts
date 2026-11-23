import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { setTimeout } from "node:timers/promises"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { purgeProjectLogs } from "../../../src/features/project-management-logs/retention.js"
import { retentionMs } from "../../../src/features/service-operation-logs/log-retention.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Project Management log attribution, filtering, rollback, incident safety, and expiry",
  { timeout: 120_000 },
  async (t) => {
    const { base, db, prisma } = await startPgliteApp(t)
    async function account(role: Role, key = role.toLowerCase()) {
      const user = await prisma.user.create({
        data: {
          email: `${key}@project-logs.test`,
          role,
          fullName: `${key} audit actor`,
          passwordHash: "PRIVATE-TEST-HASH",
        },
      })
      return { user, token: (await issueSession(user)).token }
    }
    const superadmin = await account("SUPERADMIN")
    const admin = await account("ADMIN")
    const staff = await account("STAFF")
    const client = await account("USER")
    const otherClient = await account("USER", "other-client")
    const project = await prisma.project.create({
      data: {
        clientId: client.user.id,
        name: "Initial Project",
        status: "IN_PROGRESS",
      },
    })
    const reader = "/project-management-logs"
    const brief = `/projects/${project.id}/brief`
    const spoofed = randomUUID()
    function call(
      path: string,
      token = superadmin.token,
      method = "GET",
      body?: unknown,
    ) {
      return fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Correlation-ID": spoofed,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    assert.equal((await fetch(base + reader)).status, 401)
    for (const actor of [admin, staff, client])
      assert.equal((await call(reader, actor.token)).status, 403)
    assert.equal((await call(reader, superadmin.token, "POST")).status, 404)
    for (const filter of [
      "page=0",
      "event=unknown",
      "correlationId=bad",
      "outcome=DENIED",
      "projectId[]=one",
      "from=not-a-date",
    ])
      assert.equal((await call(`${reader}?${filter}`)).status, 400)

    const input = {
      name: "Updated Project",
      description: "PRIVATE-BRIEF",
      actorId: superadmin.user.id,
      correlationId: spoofed,
    }
    assert.equal(
      (await call(brief, otherClient.token, "PATCH", input)).status,
      404,
    )
    assert.equal(await prisma.projectManagementLog.count(), 0)
    const mutation = await call(brief, client.token, "PATCH", input)
    assert.equal(mutation.status, 200, await mutation.text())
    const trace = mutation.headers.get("X-Correlation-ID")
    assert.notEqual(trace, spoofed)
    const success = await prisma.projectManagementLog.findFirstOrThrow()
    assert.equal(success.actorId, client.user.id)
    assert.equal(success.actorRole, "USER")
    assert.equal(success.projectId, project.id)
    assert.equal(success.workspaceId, project.id)
    assert.equal(success.endpoint, "PATCH /api/projects/:id/brief")
    assert.equal(success.correlationId, trace)
    assert.deepEqual(success.changes, [
      { field: "Name", before: "Initial Project", after: "Updated Project" },
      { field: "Brief edited", before: false, after: true },
    ])
    assert.equal((await call(brief, client.token, "PATCH", input)).status, 200)
    assert.equal(await prisma.projectManagementLog.count(), 1)
    await prisma.user.update({
      where: { id: client.user.id },
      data: { fullName: "New actor name" },
    })
    for (const filter of [
      `event=CLIENT_BRIEF_UPDATED&projectId=${project.id}`,
      `outcome=SUCCESS&workspaceId=${project.id}&actorId=${client.user.id}`,
      `correlationId=${trace}`,
      "search=updated+the+project+brief",
    ]) {
      const response = await call(`${reader}?${filter}`)
      const text = await response.text()
      assert.equal(response.status, 200, text)
      assert.doesNotMatch(text, /PRIVATE|New actor name/)
      const payload = JSON.parse(text) as {
        total: number
        events: {
          id: string
          actor: { name: string }
          message: string
          summaryDetail: string | null
        }[]
      }
      assert.equal(payload.total, 1)
      assert.equal(payload.events[0]?.id, success.id)
      assert.equal(payload.events[0]?.actor.name, client.user.fullName)
      assert.equal(
        payload.events[0]?.summaryDetail,
        "Initial Project → Updated Project",
      )
    }

    await db.exec(
      `ALTER TABLE "ProjectManagementLog" ADD CONSTRAINT "reject_success_for_test" CHECK ("outcome" <> 'SUCCESS' OR "projectName" <> 'Rollback Project')`,
    )
    const failure = await call(
      brief + "?debug=PRIVATE-QUERY",
      client.token,
      "PATCH",
      {
        name: "Rollback Project",
        description: "PRIVATE-FAILED-BRIEF",
      },
    )
    assert.equal(failure.status, 500)
    assert.equal(
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
        .name,
      "Updated Project",
    )
    assert.equal(
      await prisma.projectManagementLog.count({
        where: { outcome: "SUCCESS" },
      }),
      1,
    )
    const failureTrace = failure.headers.get("X-Correlation-ID")!
    let incident = await prisma.projectManagementLog.findFirst({
      where: { correlationId: failureTrace },
    })
    for (let attempt = 0; !incident && attempt < 20; attempt++) {
      await setTimeout(25)
      incident = await prisma.projectManagementLog.findFirst({
        where: { correlationId: failureTrace },
      })
    }
    assert.equal(incident?.failureCode, "ACTIVITY_LOG_PERSISTENCE_FAILED")
    assert.equal(incident?.status, 500)
    assert.equal(incident?.endpoint, "PATCH /api/projects/:id/brief")
    const failureDetails = await (
      await call(`${reader}?outcome=FAILURE&search=${failureTrace}`)
    ).text()
    assert.match(failureDetails, /requested change was rolled back/)
    assert.doesNotMatch(
      failureDetails,
      /PRIVATE|reject_success_for_test|passwordHash|stack/,
    )
    assert.equal(await prisma.serviceOperationLog.count(), 0)

    const task = await prisma.projectManagementLog.create({
      data: {
        event: "TASK_STATUS_CHANGED",
        source: "planning",
        outcome: "SUCCESS",
        projectId: project.id,
        projectName: "Updated Project",
        targetLabel: "Prepare artwork",
        correlationId: randomUUID(),
        changes: [{ field: "Status", before: "In progress", after: "Done" }],
      },
    })
    const taskLogs = (await (
      await call(`${reader}?correlationId=${task.correlationId}`)
    ).json()) as {
      events: { message: string; summaryDetail: string }[]
    }
    assert.deepEqual(
      taskLogs.events.map(({ message, summaryDetail }) => ({
        message,
        summaryDetail,
      })),
      [
        {
          message: "Moved task “Prepare artwork” to Done.",
          summaryDetail: "Project “Updated Project” · In progress → Done",
        },
      ],
    )

    const now = new Date()
    const boundary = new Date(now.getTime() - retentionMs)
    await prisma.projectManagementLog.update({
      where: { id: success.id },
      data: { createdAt: boundary },
    })
    assert.equal((await purgeProjectLogs(now))?.count, 0)
    await prisma.projectManagementLog.update({
      where: { id: success.id },
      data: { createdAt: new Date(boundary.getTime() - 1_000) },
    })
    const expired = (await (
      await call(`${reader}?from=2000-01-01&correlationId=${trace}`)
    ).json()) as { total: number }
    assert.equal(expired.total, 0)
    assert.equal((await purgeProjectLogs(now))?.count, 1)

    await prisma.user.update({
      where: { id: superadmin.user.id },
      data: { role: "ADMIN" },
    })
    assert.equal((await call(reader)).status, 403)
  },
)
