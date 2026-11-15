import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "global request inspection remains read-only and separate from head/client scoping",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(role: Role, suffix: string) {
      const user = await prisma.user.create({
        data: {
          role,
          email: `${suffix}@request-inspection.test`,
          passwordHash: "PRIVATE-CREDENTIAL",
        },
      })
      return {
        user,
        headers: {
          Authorization: `Bearer ${(await issueSession(user)).token}`,
          "content-type": "application/json",
        },
      }
    }
    const sa = await actor(Role.SUPERADMIN, "sa")
    const admin = await actor(Role.ADMIN, "admin")
    const head = await actor(Role.STAFF, "head")
    const staff = await actor(Role.STAFF, "staff")
    const client = await actor(Role.USER, "client")
    const other = await actor(Role.USER, "other")
    const departments = await Promise.all(
      [0, 1].map((index) =>
        prisma.department.create({
          data: {
            name: `Department ${index}`,
            ...(index === 0 ? { headId: head.user.id } : {}),
          },
        }),
      ),
    )
    const service = await prisma.service.create({
      data: {
        name: "Inspection service",
        description: "Service",
        departments: { connect: departments.map(({ id }) => ({ id })) },
      },
    })
    const requests = []
    for (let index = 0; index < 2; index++) {
      const record = await prisma.serviceRequest.create({
        data: {
          clientId: index ? other.user.id : client.user.id,
          serviceId: service.id,
          title: `Request ${index}`,
          status: "UNDER_REVIEW",
          acceptedDepartmentId: departments[index].id,
          acceptedById: head.user.id,
          additionalDetails: "PRIVATE-SUBMISSION",
          requirementsPayload: { secret: "PRIVATE-PAYLOAD" },
        },
      })
      await prisma.requestWorkflow.create({
        data: { requestId: record.id, state: "CONSULTATION" },
      })
      const file = await prisma.workflowFile.create({
        data: {
          requestId: record.id,
          uploaderId: head.user.id,
          uploadId: randomUUID(),
          name: "PRIVATE-FILE.txt",
          mimeType: "text/plain",
          size: 4,
          sha256: "a".repeat(64),
          clientVisible: false,
          data: new Uint8Array([1, 2, 3, 4]),
        },
      })
      const conversation = await prisma.requestConversation.create({
        data: {
          clientId: record.clientId,
          departmentId: departments[index].id,
        },
      })
      await prisma.serviceRequest.update({
        where: { id: record.id },
        data: { conversationId: conversation.id },
      })
      await prisma.serviceRequestMessage.create({
        data: {
          conversationId: conversation.id,
          requestId: record.id,
          senderId: head.user.id,
          clientMessageId: randomUUID(),
          body: "PRIVATE-REQUEST-MESSAGE",
        },
      })
      const project = await prisma.project.create({
        data: {
          name: `Project ${index}`,
          clientId: index ? other.user.id : client.user.id,
          requestId: record.id,
        },
      })
      if (index === 0) {
        const employee = await prisma.employee.create({
          data: {
            employeeId: "request-staff",
            fullName: "Assigned specialist",
            position: "Designer",
            userId: staff.user.id,
            departmentId: departments[0].id,
          },
        })
        await prisma.projectStaff.create({
          data: {
            projectId: project.id,
            employeeId: employee.id,
            approvedById: head.user.id,
            isTeamLead: true,
          },
        })
      }
      await prisma.projectMessage.create({
        data: {
          projectId: project.id,
          senderId: head.user.id,
          body: "PRIVATE-CONVERSATION",
          clientMessageId: `message-${index}`,
        },
      })
      requests.push({
        ...record,
        privateFileId: file.id,
        privateConversationId: conversation.id,
      })
    }
    const pending = await prisma.serviceRequest.create({
      data: {
        clientId: client.user.id,
        serviceId: service.id,
        title: "Pending routed request",
      },
    })
    await prisma.serviceRequest.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        clientId: other.user.id,
        serviceId: service.id,
        title: `Archived ${index}`,
        status: "CANCELLED",
      })),
    })
    const get = (path: string, account = sa) =>
      fetch(`${base}${path}`, { headers: account.headers })
    assert.equal((await fetch(`${base}/administrative-requests`)).status, 401)
    const response = await get("/administrative-requests")
    assert.equal(response.status, 200)
    const serialized = await response.text()
    assert.ok(!serialized.includes("PRIVATE-"))
    const list = JSON.parse(serialized) as {
      total: number
      pageSize: number
      serviceRequests: { id: string }[]
    }
    assert.equal(list.total, 14)
    assert.equal(list.serviceRequests.length, list.pageSize)
    assert.equal(
      (
        (await (await get("/administrative-requests?page=2")).json()) as {
          serviceRequests: unknown[]
        }
      ).serviceRequests.length,
      4,
    )
    for (const record of requests) {
      const detail = await get(`/administrative-requests/${record.id}`)
      assert.equal(detail.status, 200)
      const text = await detail.text()
      assert.ok(!text.includes("PRIVATE-"))
      const { serviceRequest } = JSON.parse(text) as {
        serviceRequest: {
          acceptedDepartment: { id: string }
          workflow: { state: string }
          capabilities: Record<string, boolean>
          project: { staff: unknown[] }
        }
      }
      assert.ok(
        departments.some(
          ({ id }) => id === serviceRequest.acceptedDepartment.id,
        ),
      )
      assert.equal(serviceRequest.workflow.state, "CONSULTATION")
      assert.ok(
        Object.entries(serviceRequest.capabilities).every(
          ([key, value]) => value === (key === "read"),
        ),
      )
      if (record.id === requests[0].id)
        assert.equal(serviceRequest.project.staff.length, 1)
      for (const method of ["POST", "PATCH", "DELETE"])
        assert.equal(
          (
            await fetch(`${base}/administrative-requests/${record.id}`, {
              method,
              headers: sa.headers,
            })
          ).status,
          404,
        )
      assert.equal(
        (
          await fetch(`${base}/request-inbox/${record.id}/accept`, {
            method: "POST",
            headers: sa.headers,
          })
        ).status,
        403,
      )
      assert.equal(
        (await get(`/request-conversations/${record.privateConversationId}`))
          .status,
        404,
      )
      assert.equal((await get(`/request-workflows/${record.id}`)).status, 404)
      for (const command of [
        { type: "PREPARE_QUOTATION" },
        { type: "APPROVE_QUOTATION", quotationId: "quotation" },
        { type: "VERIFY_PAYMENT", approve: true, note: "" },
        { type: "STAFF_PROJECT", employeeIds: ["employee"] },
      ])
        assert.equal(
          (
            await fetch(`${base}/request-workflows/${record.id}/actions`, {
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
          await get(
            `/request-workflows/${record.id}/files/${record.privateFileId}`,
          )
        ).status,
        404,
      )
    }
    const scoped = (await (
      await get(
        `/administrative-requests?search=Request&departmentId=${departments[0].id}&status=UNDER_REVIEW`,
      )
    ).json()) as { total: number }
    assert.equal(scoped.total, 1)
    const routed = (await (
      await get(
        `/administrative-requests?search=Pending&departmentId=${departments[1].id}`,
      )
    ).json()) as { serviceRequests: { id: string }[] }
    assert.equal(routed.serviceRequests[0].id, pending.id)
    for (const query of [
      "page=0",
      "status=INVALID",
      "search=bad&search=another",
      "sortDir=bad",
    ])
      assert.equal((await get(`/administrative-requests?${query}`)).status, 400)
    assert.equal((await get("/administrative-requests/missing")).status, 404)
    for (const account of [admin, head, staff, client]) {
      assert.equal((await get("/administrative-requests", account)).status, 403)
      assert.equal(
        (await get(`/administrative-requests/${requests[0].id}`, account))
          .status,
        403,
      )
    }
    assert.equal(
      (await get(`/request-inbox/${requests[0].id}`, head)).status,
      200,
    )
    assert.equal(
      (await get(`/request-inbox/${requests[1].id}`, head)).status,
      404,
    )
    assert.equal(
      (await get(`/service-requests/${requests[0].id}`, client)).status,
      200,
    )
    assert.equal(
      (await get(`/service-requests/${requests[1].id}`, client)).status,
      404,
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
      data: { role: Role.ADMIN },
    })
    assert.equal((await get("/administrative-requests")).status, 403)
  },
)
