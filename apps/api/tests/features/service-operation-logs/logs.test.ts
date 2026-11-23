import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  loggedWorkflowActions,
  writeServiceLog,
} from "../../../src/features/service-operation-logs/log-writer.js"
import {
  describeServiceLog,
  serviceIncidentOperations,
  workflowActionDescriptions,
  workflowActionFailureOperations,
} from "../../../src/features/service-operation-logs/log-descriptions.js"
import { classifyServiceIncident } from "../../../src/features/service-operation-logs/incident-diagnostics.js"
import {
  purgeServiceLogs,
  retentionMs,
} from "../../../src/features/service-operation-logs/log-retention.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test("Service Operations descriptions cover every logged workflow action", () => {
  assert.deepEqual(
    Object.keys(workflowActionDescriptions).sort(),
    [...loggedWorkflowActions].sort(),
  )
  assert.ok(
    Object.values(workflowActionDescriptions).every(
      (description) => description.length > 20 && description.endsWith("."),
    ),
  )
  assert.deepEqual(
    Object.keys(workflowActionFailureOperations).sort(),
    [...loggedWorkflowActions].sort(),
  )
  assert.equal(
    describeServiceLog(
      "API_FAILURE",
      null,
      "workload",
      "PUT /api/workload/capacity",
    ),
    "Failed while updating workload capacity.",
  )
  assert.equal(
    describeServiceLog(
      "API_FAILURE",
      "VERIFY_PAYMENT",
      "workflow",
      "POST /api/request-workflows/:id/actions",
    ),
    "Failed while verifying a submitted payment.",
  )
  assert.equal(
    serviceIncidentOperations["PATCH /api/services/:id/status"],
    "changing a service offering's availability",
  )
})

test("Service Operations incident reasons use only closed safe summaries", () => {
  const timeout = Object.assign(new Error("PRIVATE database details"), {
    code: "P1008",
  })
  const database = classifyServiceIncident(timeout, 503)
  assert.deepEqual(database, {
    code: "DATABASE_TIMEOUT",
    reason: "The database operation timed out before it could finish.",
  })
  assert.ok(!JSON.stringify(database).includes("PRIVATE"))
  const storage = classifyServiceIncident(
    Object.assign(new Error("PRIVATE file path"), { code: "ENOSPC" }),
    500,
    "POST /api/request-workflows/:id/files",
  )
  assert.deepEqual(storage, {
    code: "FILE_STORAGE_UNAVAILABLE",
    reason: "File storage was unavailable while processing the request.",
  })
})

test(
  "Service Operations logs: authenticated activity, privacy, rollback and expiry",
  { timeout: 120000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    async function actor(role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `${role}@logs.test`,
          fullName: `${role} Log Actor`,
          passwordHash: "PRIVATE-HASH",
          role,
        },
      })
      return {
        user,
        headers: {
          Authorization: `Bearer ${(await issueSession(user)).token}`,
          "Content-Type": "application/json",
        },
      }
    }
    const sa = await actor(Role.SUPERADMIN),
      admin = await actor(Role.ADMIN),
      head = await actor(Role.STAFF),
      client = await actor(Role.USER)
    const department = await prisma.department.create({
      data: { name: "Logs department", headId: head.user.id },
    })
    const service = await prisma.service.create({
      data: {
        name: "Log service",
        description: "PRIVATE-DESCRIPTION",
        isActive: false,
        departments: { connect: { id: department.id } },
      },
    })
    const call = (path: string, who = sa, method = "GET", body?: unknown) =>
      fetch(`${base}${path}`, {
        method,
        headers: who.headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })

    await t.test(
      "reader denies every other role and unauthenticated users",
      async () => {
        assert.equal(
          (await fetch(`${base}/service-operation-logs`)).status,
          401,
        )
        for (const who of [admin, head, client])
          assert.equal((await call("/service-operation-logs", who)).status, 403)
        assert.equal(
          (await call("/service-operation-logs", sa, "POST", {})).status,
          404,
        )
      },
    )
    await t.test(
      "catalog changes attribute the actual actor and ignore spoofed data",
      async () => {
        const response = await call(
          `/services/${service.id}/status`,
          admin,
          "PATCH",
          {
            isActive: true,
            actorId: client.user.id,
            correlationId: randomUUID(),
            secret: "PRIVATE-TOKEN",
          },
        )
        assert.equal(response.status, 200)
        const log = await prisma.serviceOperationLog.findFirstOrThrow({
          where: { event: "SERVICE_STATUS_CHANGED" },
        })
        assert.equal(log.actorId, admin.user.id)
        assert.equal(log.actorName, "ADMIN Log Actor")
        assert.equal(log.actorRole, Role.ADMIN)
        assert.equal(log.targetType, "Service offering")
        assert.equal(log.targetLabel, "Log service")
        assert.deepEqual(log.changes, [
          {
            field: "Availability",
            before: "Unavailable",
            after: "Available",
          },
        ])
        assert.equal(
          log.correlationId,
          response.headers.get("X-Correlation-ID"),
        )
      },
    )
    let requestId = ""
    await t.test(
      "submission replay creates one success; workflow logs retain safe action-specific changes",
      async () => {
        const body = {
          serviceId: service.id,
          submissionKey: randomUUID(),
          packageId: null,
          preferredSpecialistId: null,
          goals: "PRIVATE-GOALS",
          requirements: "PRIVATE-REQUIREMENTS",
          expectedTimeline: "PRIVATE-TIMELINE",
        }
        const response = await call("/service-requests", client, "POST", body)
        assert.equal(response.status, 201, await response.clone().text())
        const json = (await response.json()) as {
          serviceRequest: { id: string }
        }
        requestId = json.serviceRequest.id
        assert.equal(
          (await call("/client/service-requests", client, "POST", body)).status,
          201,
        )
        assert.equal(
          await prisma.serviceOperationLog.count({
            where: { event: "REQUEST_SUBMITTED", requestId },
          }),
          1,
        )
        assert.equal(
          (await call(`/request-inbox/${requestId}/accept`, head, "POST"))
            .status,
          200,
        )
        assert.equal(
          await prisma.serviceOperationLog.count({
            where: { event: "REQUEST_ACCEPTED", requestId },
          }),
          1,
        )
        const acceptedLog = await prisma.serviceOperationLog.findFirstOrThrow({
          where: { event: "REQUEST_ACCEPTED", requestId },
        })
        assert.match(acceptedLog.targetLabel ?? "", /^Log service \(SR-/)
        assert.deepEqual(acceptedLog.changes, [
          { field: "Status", before: "Submitted", after: "Under Review" },
          {
            field: "Department",
            before: null,
            after: "Logs department",
          },
        ])
        const workflow = await prisma.requestWorkflow.findUniqueOrThrow({
          where: { requestId },
        })
        const command = {
          actionId: randomUUID(),
          expectedVersion: workflow.version,
          type: "REQUEST_REQUIREMENT",
          title: "Proof of authorization",
          details: "PRIVATE-REQUIREMENT-DETAILS",
          mandatory: true,
        }
        const action = await call(
          `/request-workflows/${requestId}/actions`,
          head,
          "POST",
          command,
        )
        assert.equal(action.status, 200, await action.clone().text())
        assert.equal(
          (
            await call(
              `/request-workflows/${requestId}/actions`,
              head,
              "POST",
              command,
            )
          ).status,
          200,
        )
        assert.equal(
          await prisma.serviceOperationLog.count({
            where: {
              event: "WORKFLOW_ACTION_COMPLETED",
              requestId,
              action: "REQUEST_REQUIREMENT",
            },
          }),
          1,
        )
        const workflowLog = await prisma.serviceOperationLog.findFirstOrThrow({
          where: {
            event: "WORKFLOW_ACTION_COMPLETED",
            requestId,
            action: "REQUEST_REQUIREMENT",
          },
        })
        assert.deepEqual(workflowLog.changes, [
          {
            field: "Workflow action",
            before: null,
            after: "Request Requirement",
          },
          { field: "Requirement count", before: 0, after: 1 },
          { field: "Requirement status", before: null, after: "Requested" },
          { field: "Mandatory requirement", before: null, after: true },
        ])
        assert.ok(
          !JSON.stringify(workflowLog).includes("PRIVATE-REQUIREMENT-DETAILS"),
        )
      },
    )
    await t.test(
      "rollback removes success logs and writer rejects unapproved data",
      async () => {
        const before = await prisma.serviceOperationLog.count()
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await writeServiceLog(tx, "SERVICE_UPDATED", service.id)
            await tx.service.update({
              where: { id: service.id },
              data: { description: "rolled back" },
            })
            throw new Error("rollback")
          }),
        )
        assert.equal(await prisma.serviceOperationLog.count(), before)
        assert.equal(
          (
            await prisma.service.findUniqueOrThrow({
              where: { id: service.id },
            })
          ).description,
          "PRIVATE-DESCRIPTION",
        )
        await assert.rejects(
          prisma.$transaction((tx) =>
            writeServiceLog(
              tx,
              "WORKFLOW_ACTION_COMPLETED",
              requestId,
              requestId,
              head.user.id,
              "PRIVATE-PAYLOAD",
            ),
          ),
        )
      },
    )
    await t.test(
      "log insert failure rolls back business writes; incident survives independently",
      async () => {
        await db.exec(
          `CREATE FUNCTION reject_success_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."outcome" = 'SUCCESS' THEN RAISE EXCEPTION 'PRIVATE-ERROR'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_success BEFORE INSERT ON "ServiceOperationLog" FOR EACH ROW EXECUTE FUNCTION reject_success_log();`,
        )
        const response = await call(
          `/services/${service.id}/status`,
          admin,
          "PATCH",
          { isActive: false },
        )
        assert.equal(response.status, 500)
        assert.equal(
          (
            await prisma.service.findUniqueOrThrow({
              where: { id: service.id },
            })
          ).isActive,
          true,
        )
        // An async diagnostic insert may settle after the original response.
        let incident = await prisma.serviceOperationLog.findFirst({
          where: { outcome: "FAILURE" },
        })
        for (let i = 0; !incident && i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20))
          incident = await prisma.serviceOperationLog.findFirst({
            where: { outcome: "FAILURE" },
          })
        }
        assert.ok(incident)
        assert.equal(
          incident.correlationId,
          response.headers.get("X-Correlation-ID"),
        )
        assert.equal(incident.status, 500)
        assert.equal(incident.failureCode, "ACTIVITY_LOG_PERSISTENCE_FAILED")
        assert.equal(
          incident.failureReason,
          "The activity log could not be saved, so the requested change was rolled back.",
        )
        assert.equal(incident.subjectId, service.id)
        assert.equal(incident.targetType, "Service offering")
        assert.equal(incident.targetLabel, "Log service")
        assert.deepEqual(incident.changes, [
          {
            field: "Availability",
            before: "Available",
            after: "Unavailable",
          },
        ])
        const diagnosticResponse = await call(
          `/service-operation-logs?correlationId=${incident.correlationId}`,
        )
        const diagnosticText = await diagnosticResponse.text()
        assert.ok(!diagnosticText.includes("PRIVATE-ERROR"))
        const diagnosticBody = JSON.parse(diagnosticText) as {
          events: {
            message: string
            summaryDetail: string | null
            failureCode: string
            failureReason: string
            target: { id: string; type: string; label: string }
            changes: { field: string; before: string; after: string }[]
          }[]
        }
        assert.equal(
          diagnosticBody.events[0]?.message,
          "Failed while changing a service offering's availability for “Log service” because the activity log could not be saved and the requested change was rolled back.",
        )
        assert.equal(
          diagnosticBody.events[0]?.summaryDetail,
          "Attempted change · Availability · Available → Unavailable",
        )
        assert.equal(
          diagnosticBody.events[0]?.failureCode,
          "ACTIVITY_LOG_PERSISTENCE_FAILED",
        )
        assert.equal(
          diagnosticBody.events[0]?.failureReason,
          "The activity log could not be saved, so the requested change was rolled back.",
        )
        assert.deepEqual(diagnosticBody.events[0]?.target, {
          id: service.id,
          type: "Service offering",
          label: "Log service",
        })
        assert.deepEqual(diagnosticBody.events[0]?.changes, [
          {
            field: "Availability",
            before: "Available",
            after: "Unavailable",
          },
        ])
        await db.exec(
          `DROP TRIGGER reject_success ON "ServiceOperationLog"; DROP FUNCTION reject_success_log();`,
        )
        const before = await prisma.serviceOperationLog.count({
          where: { outcome: "FAILURE" },
        })
        assert.equal(
          (
            await call(`/services/${service.id}/status`, admin, "PATCH", {
              isActive: "PRIVATE-INVALID",
            })
          ).status,
          400,
        )
        assert.equal(
          await prisma.serviceOperationLog.count({
            where: { outcome: "FAILURE" },
          }),
          before,
        )
      },
    )
    await t.test("filters, projections and invalid input", async () => {
      await prisma.user.update({
        where: { id: admin.user.id },
        data: { fullName: "Renamed Admin" },
      })
      const response = await call(
        `/service-operation-logs?requestId=${requestId}&outcome=SUCCESS`,
      )
      assert.equal(response.status, 200)
      const text = await response.text()
      assert.ok(!text.includes("PRIVATE-"))
      const body = JSON.parse(text) as {
        events: {
          requestId: string
          event: string
          message: string
          summaryDetail: string | null
          actor: { name: string; attribution: string }
        }[]
        total: number
      }
      assert.equal(body.total, 3)
      assert.ok(body.events.every((row) => row.requestId === requestId))
      assert.ok(body.events.every((row) => row.message.endsWith(".")))
      assert.ok(body.events.every((row) => row.actor.name.length > 1))
      assert.equal(
        body.events.find(({ event }) => event === "REQUEST_ACCEPTED")
          ?.summaryDetail,
        "Status · Submitted → Under Review",
      )

      const catalog = await call(
        "/service-operation-logs?search=availability&outcome=SUCCESS",
      )
      assert.equal(catalog.status, 200)
      const catalogBody = (await catalog.json()) as {
        events: {
          event: string
          message: string
          actor: { name: string; attribution: string }
        }[]
      }
      assert.equal(catalogBody.events.length, 1)
      assert.equal(catalogBody.events[0]?.event, "SERVICE_STATUS_CHANGED")
      assert.equal(
        catalogBody.events[0]?.message,
        "Changed a service offering's availability “Log service”.",
      )
      assert.deepEqual(catalogBody.events[0]?.actor, {
        id: admin.user.id,
        name: "ADMIN Log Actor",
        role: Role.ADMIN,
        attribution: "RECORDED",
      })

      const legacy = await prisma.serviceOperationLog.create({
        data: {
          event: "SERVICE_UPDATED",
          source: "catalog",
          outcome: "SUCCESS",
          actorId: admin.user.id,
          actorRole: Role.ADMIN,
          correlationId: randomUUID(),
        },
      })
      const legacyResponse = await call(
        `/service-operation-logs?correlationId=${legacy.correlationId}`,
      )
      const legacyBody = (await legacyResponse.json()) as {
        events: {
          actor: { name: string; attribution: string }
          summaryDetail: string | null
        }[]
      }
      assert.equal(legacyBody.events[0]?.summaryDetail, null)
      assert.deepEqual(legacyBody.events[0]?.actor, {
        id: admin.user.id,
        name: "Renamed Admin",
        role: Role.ADMIN,
        attribution: "CURRENT",
      })
      const legacySearch = await call(
        "/service-operation-logs?search=Renamed%20Admin",
      )
      const legacySearchBody = (await legacySearch.json()) as {
        events: { id: string; actor: { name: string } }[]
      }
      assert.equal(legacySearchBody.events.length, 1)
      assert.equal(legacySearchBody.events[0]?.id, legacy.id)
      assert.equal(legacySearchBody.events[0]?.actor.name, "Renamed Admin")
      for (const query of [
        "from=invalid",
        "page=-1",
        "page=1.5",
        "event=PRIVATE-RAW",
        "source=attendance",
        "actorId[]=a",
        "outcome=unknown",
        "correlationId=invalid",
        "unknown=1",
        `search=${"x".repeat(81)}`,
      ])
        assert.equal(
          (await call(`/service-operation-logs?${query}`)).status,
          400,
          query,
        )
    })
    await t.test(
      "30-day expiry is hidden on reads and pruned with an exact boundary",
      async () => {
        const now = new Date(),
          cutoff = new Date(now.getTime() - retentionMs)
        const old = await prisma.serviceOperationLog.create({
          data: {
            event: "SERVICE_UPDATED",
            source: "catalog",
            outcome: "SUCCESS",
            correlationId: randomUUID(),
            createdAt: new Date(cutoff.getTime() - 1),
          },
        })
        const boundary = await prisma.serviceOperationLog.create({
          data: {
            event: "SERVICE_UPDATED",
            source: "catalog",
            outcome: "SUCCESS",
            correlationId: randomUUID(),
            createdAt: cutoff,
          },
        })
        const response = await call("/service-operation-logs?from=2000-01-01")
        assert.ok(!(await response.text()).includes(old.id))
        await purgeServiceLogs(now)
        assert.equal(
          await prisma.serviceOperationLog.findUnique({
            where: { id: old.id },
          }),
          null,
        )
        assert.ok(
          await prisma.serviceOperationLog.findUnique({
            where: { id: boundary.id },
          }),
        )
      },
    )
    await t.test(
      "current role revocation removes access immediately",
      async () => {
        await prisma.user.update({
          where: { id: sa.user.id },
          data: { role: Role.ADMIN },
        })
        assert.equal((await call("/service-operation-logs")).status, 403)
      },
    )
  },
)
