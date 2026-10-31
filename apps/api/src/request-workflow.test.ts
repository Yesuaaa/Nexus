import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { issueSession } from "./features/auth/auth.service.js"
import type { Role } from "./generated/prisma/client.js"
import { getPrisma } from "./lib/db.js"

type TestWorkflow = {
  state: string
  version: number
  nextAction: string
  permissions: {
    manage: boolean
    isClient: boolean
    approveQuotation: boolean
    verifyPayment: boolean
  }
  requirements: { id: string; status: string; submission: string | null }[]
  consultations: { id: string; status: string }[]
  quotations: { id: string; version: number; status: string; total: string }[]
  approval: {
    quotationId: string
    amount: string
    approvedById: string
    approvedAt: string
  } | null
  agreement: { status: string; mandatory: boolean } | null
  payment: { status: string; mandatory: boolean } | null
  project: { id: string; status: string } | null
  events: { type: string; summary: string; entityId: string | null }[]
  files: { id: string; name: string; size: number }[]
  internal?: {
    staff: { id: string; assigned: boolean; activeProjectCount: number }[]
    events: { type: string; summary: string }[]
  }
}

const migrationDirectory = new URL("../prisma/migrations/", import.meta.url)
const workflowMigrationName = "20261031010000_request_workflow"

test("workflow migration preserves accepted history without granting approvals", async () => {
  const db = new PGlite()
  try {
    for (const name of (await readdir(migrationDirectory))
      .filter((name) => /^\d/.test(name) && name < workflowMigrationName)
      .sort())
      await db.exec(
        await readFile(
          new URL(`${name}/migration.sql`, migrationDirectory),
          "utf8",
        ),
      )
    await db.exec(`
      INSERT INTO "User" ("id", "email", "passwordHash", "role", "updatedAt") VALUES
        ('migration-client', 'migration-client@example.com', 'private', 'USER', CURRENT_TIMESTAMP),
        ('migration-head', 'migration-head@example.com', 'private', 'STAFF', CURRENT_TIMESTAMP);
      INSERT INTO "Department" ("id", "name", "headId", "updatedAt") VALUES ('migration-department', 'Migration department', 'migration-head', CURRENT_TIMESTAMP);
      INSERT INTO "Service" ("id", "name", "description", "clientRequirements", "requiresConsultation", "updatedAt") VALUES
        ('migration-service', 'Migration service', 'Service', ARRAY['Brand guidelines', 'Project brief'], true, CURRENT_TIMESTAMP);
      INSERT INTO "ServiceRequest" ("id", "clientId", "serviceId", "title", "status", "acceptedDepartmentId", "acceptedById", "acceptedAt", "updatedAt") VALUES
        ('migration-accepted', 'migration-client', 'migration-service', 'Accepted request', 'UNDER_REVIEW', 'migration-department', 'migration-head', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('migration-pending', 'migration-client', 'migration-service', 'Pending request', 'SUBMITTED', NULL, NULL, NULL, CURRENT_TIMESTAMP);
    `)
    await db.exec(
      await readFile(
        new URL(`${workflowMigrationName}/migration.sql`, migrationDirectory),
        "utf8",
      ),
    )
    const records = await db.query<{
      requestId: string
      state: string
      consultationRequired: boolean
      agreementRequired: boolean
      paymentRequired: boolean
    }>(
      'SELECT "requestId", "state", "consultationRequired", "agreementRequired", "paymentRequired" FROM "RequestWorkflow"',
    )
    assert.deepEqual(records.rows, [
      {
        requestId: "migration-accepted",
        state: "CONSULTATION",
        consultationRequired: true,
        agreementRequired: true,
        paymentRequired: true,
      },
    ])
    const requirements = await db.query<{ status: string; mandatory: boolean }>(
      'SELECT "status", "mandatory" FROM "WorkflowRequirement"',
    )
    assert.equal(requirements.rows.length, 2)
    assert.ok(
      requirements.rows.every(
        (row) => row.status === "REQUESTED" && row.mandatory,
      ),
    )
    const approvals = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM "WorkflowApproval"',
    )
    assert.equal(approvals.rows[0]!.count, 0)
    const rls = await db.query<{ enabled: boolean }>(
      `SELECT relrowsecurity AS enabled FROM pg_class WHERE relname IN ('RequestWorkflow', 'WorkflowFile', 'WorkflowApproval', 'WorkflowEvent', 'ProjectStaff')`,
    )
    assert.equal(rls.rows.length, 5)
    assert.ok(rls.rows.every((row) => row.enabled))
    await assert.rejects(
      db.exec('UPDATE "WorkflowEvent" SET "summary" = \'Changed\''),
      /immutable/,
    )
    await assert.rejects(db.exec('DELETE FROM "WorkflowEvent"'), /immutable/)
  } finally {
    await db.close()
  }
})

test(
  "conversation workflow enforces formal approvals, scoped controls and project gates",
  { timeout: 180_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite()
    let socket: PGLiteSocketServer | undefined = undefined
    let server: Server | undefined = undefined
    let prisma: ReturnType<typeof getPrisma> | undefined = undefined
    t.after(async () => {
      server?.closeAllConnections()
      if (server)
        await new Promise<void>((resolve) => server!.close(() => resolve()))
      await prisma?.$disconnect()
      await socket?.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    for (const name of (await readdir(migrationDirectory))
      .filter((name) => /^\d/.test(name))
      .sort())
      await db.exec(
        await readFile(
          new URL(`${name}/migration.sql`, migrationDirectory),
          "utf8",
        ),
      )
    socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    prisma = getPrisma()!
    async function user(name: string, role: Role) {
      const record = await prisma!.user.create({
        data: {
          email: `${name}@example.com`,
          fullName: name,
          passwordHash: "private",
          role,
        },
      })
      const session = await issueSession(record)
      return {
        ...record,
        headers: { authorization: `Bearer ${session.token}` },
      }
    }
    const client = await user("WorkflowClient", "USER")
    const otherClient = await user("OtherWorkflowClient", "USER")
    const head = await user("WorkflowHead", "STAFF")
    const replacement = await user("ReplacementHead", "STAFF")
    const staff = await user("WorkflowStaff", "STAFF")
    const admin = await user("WorkflowApprover", "ADMIN")
    const paymentAdmin = await user("WorkflowPaymentVerifier", "ADMIN")
    const otherAdmin = await user("OtherWorkflowAdmin", "ADMIN")
    const superadmin = await user("WorkflowSuperadmin", "SUPERADMIN")
    const department = await prisma.department.create({
      data: { name: "Workflow Design", headId: head.id },
    })
    const foreignDepartment = await prisma.department.create({
      data: { name: "Workflow Marketing" },
    })
    await prisma.user.updateMany({
      where: {
        id: {
          in: [head.id, replacement.id, staff.id, admin.id, paymentAdmin.id],
        },
      },
      data: { departmentId: department.id },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "WF-ACTIVE",
        fullName: "Available Designer",
        departmentId: department.id,
        userId: staff.id,
        profileSpecialties: ["Design", "Accessibility"],
      },
    })
    const inactiveEmployee = await prisma.employee.create({
      data: {
        employeeId: "WF-LEAVE",
        fullName: "Unavailable Designer",
        departmentId: department.id,
        status: "ON_LEAVE",
      },
    })
    const foreignEmployee = await prisma.employee.create({
      data: {
        employeeId: "WF-FOREIGN",
        fullName: "Foreign Designer",
        departmentId: foreignDepartment.id,
      },
    })
    const service = await prisma.service.create({
      data: {
        name: "Consultation Website",
        description: "Custom website",
        requiresConsultation: true,
        requiresQuotationApproval: true,
        clientRequirements: ["Brand guidelines"],
        departments: { connect: { id: department.id } },
      },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        title: "Accessible website",
        pricingModel: "CUSTOM_QUOTE",
        referenceNumber: "WF-001",
        expectedTimeline: "Six weeks",
      },
    })
    const anotherRequest = await prisma.serviceRequest.create({
      data: {
        clientId: otherClient.id,
        serviceId: service.id,
        title: "Other client's website",
      },
    })
    server = createApp().listen(0, "127.0.0.1")
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    type Actor = typeof client
    const path = (id = request.id) => `${base}/request-workflows/${id}`
    const get = (actor = client, id = request.id) =>
      fetch(path(id), { headers: actor.headers })
    const read = async (actor = client, id = request.id) => {
      const response = await get(actor, id)
      assert.equal(response.status, 200, await response.clone().text())
      return (await response.json()) as TestWorkflow
    }
    const send = (
      actor: Actor,
      input: Record<string, unknown>,
      expectedVersion: number,
      actionId = randomUUID(),
      id = request.id,
    ) =>
      fetch(`${path(id)}/actions`, {
        method: "POST",
        headers: { ...actor.headers, "content-type": "application/json" },
        body: JSON.stringify({ ...input, expectedVersion, actionId }),
      })
    const act = async (
      actor: Actor,
      input: Record<string, unknown>,
      id = request.id,
    ) => {
      const current = await read(actor, id)
      const response = await send(
        actor,
        input,
        current.version,
        randomUUID(),
        id,
      )
      assert.equal(response.status, 200, await response.clone().text())
      return (await response.json()) as TestWorkflow
    }
    const accept = (id = request.id) =>
      fetch(`${base}/request-inbox/${id}/accept`, {
        method: "POST",
        headers: head.headers,
      })
    const upload = async (
      actor: Actor,
      name = "requirements.txt",
      content = "Private submitted document",
      id = request.id,
      uploadId = randomUUID(),
    ) => {
      const response = await fetch(`${path(id)}/files`, {
        method: "POST",
        headers: { ...actor.headers, "content-type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "text/plain",
          content: Buffer.from(content).toString("base64"),
          uploadId,
        }),
      })
      assert.ok(
        [200, 201].includes(response.status),
        await response.clone().text(),
      )
      return ((await response.json()) as { file: { id: string } }).file
    }
    let requirementId = ""
    let acceptedQuotationId = ""
    let projectId = ""
    let submittedFileId = ""
    const quote = (scope = "Build an accessible website") => ({
      type: "CREATE_QUOTATION",
      scope,
      deliverables: ["Design approval", "Website launch"],
      lineItems: [
        {
          description: "Design and development",
          quantity: 2,
          unitPrice: "15000.00",
        },
      ],
      currency: "PHP",
      timeline: "Six weeks",
      paymentTerms: "50% before commencement",
      paymentDue: "15000.00",
      validUntil: new Date(Date.now() + 86_400_000).toISOString(),
    })

    await t.test(
      "acceptance initializes consultation without delivering a service or approving a quotation",
      async () => {
        assert.equal((await fetch(path())).status, 401)
        assert.equal((await get(head)).status, 404)
        assert.equal((await accept()).status, 200)
        const workflow = await read()
        assert.equal(workflow.state, "CONSULTATION")
        assert.equal(workflow.requirements.length, 1)
        assert.equal(workflow.requirements[0]!.status, "REQUESTED")
        assert.equal(workflow.approval, null)
        assert.equal(workflow.project, null)
        assert.ok(workflow.nextAction.length > 0)
        requirementId = workflow.requirements[0]!.id
        assert.equal(workflow.internal, undefined)
        for (const actor of [otherClient, staff, admin, otherAdmin, superadmin])
          assert.equal((await get(actor)).status, 404)
        for (const actor of [client, head, admin])
          assert.equal((await get(actor, anotherRequest.id)).status, 404)
      },
    )

    await t.test(
      "requirements and consultations cannot be bypassed; files stay private and retry safely",
      async () => {
        const current = await read(head)
        assert.equal(
          (
            await send(
              client,
              {
                type: "REQUEST_REQUIREMENT",
                title: "Forged",
                details: "",
                mandatory: false,
              },
              current.version,
            )
          ).status,
          403,
        )
        assert.equal(
          (await send(head, { type: "PREPARE_QUOTATION" }, current.version))
            .status,
          409,
        )
        const uploadId = randomUUID()
        const file = await upload(
          client,
          "brand.txt",
          "Brand guidelines",
          request.id,
          uploadId,
        )
        submittedFileId = file.id
        assert.equal(
          (
            await upload(
              client,
              "brand.txt",
              "Brand guidelines",
              request.id,
              uploadId,
            )
          ).id,
          file.id,
        )
        assert.equal(
          await prisma!.workflowFile.count({
            where: { requestId: request.id },
          }),
          1,
        )
        const changedUpload = await fetch(`${path()}/files`, {
          method: "POST",
          headers: { ...client.headers, "content-type": "application/json" },
          body: JSON.stringify({
            uploadId,
            name: "brand.txt",
            mimeType: "text/plain",
            content: Buffer.from("Different document").toString("base64"),
          }),
        })
        assert.equal(changedUpload.status, 409)
        const privateDownload = await fetch(`${path()}/files/${file.id}`, {
          headers: client.headers,
        })
        assert.equal(privateDownload.status, 200)
        assert.equal(await privateDownload.text(), "Brand guidelines")
        assert.match(
          privateDownload.headers.get("content-disposition") || "",
          /attachment/,
        )
        for (const actor of [otherClient, otherAdmin, staff])
          assert.equal(
            (
              await fetch(`${path()}/files/${file.id}`, {
                headers: actor.headers,
              })
            ).status,
            404,
          )
        const submitted = await act(client, {
          type: "SUBMIT_REQUIREMENT",
          requirementId,
          submission: "Please review our brand standards",
          fileId: file.id,
        })
        assert.equal(submitted.requirements[0]!.status, "SUBMITTED")
        await act(head, {
          type: "REVIEW_REQUIREMENT",
          requirementId,
          approve: false,
          note: "Include the latest logo",
        })
        assert.equal((await read()).requirements[0]!.status, "REQUESTED")
        await act(client, {
          type: "SUBMIT_REQUIREMENT",
          requirementId,
          submission: "Latest logo included",
          fileId: file.id,
        })
        await act(head, {
          type: "REVIEW_REQUIREMENT",
          requirementId,
          approve: true,
          note: "Complete",
        })
        const afterRequirement = await read(head)
        assert.equal(
          (
            await send(
              head,
              { type: "PREPARE_QUOTATION" },
              afterRequirement.version,
            )
          ).status,
          409,
        )
        const scheduled = await act(head, {
          type: "SCHEDULE_CONSULTATION",
          startsAt: new Date(Date.now() + 3_600_000).toISOString(),
          endsAt: new Date(Date.now() + 7_200_000).toISOString(),
          location: "Video meeting",
          notes: "Review goals",
        })
        await prisma!.workflowConsultation.update({
          where: { id: scheduled.consultations[0]!.id },
          data: {
            startsAt: new Date(Date.now() - 7_200_000),
            endsAt: new Date(Date.now() - 3_600_000),
          },
        })
        await act(head, {
          type: "COMPLETE_CONSULTATION",
          consultationId: scheduled.consultations[0]!.id,
        })
        const prepared = await act(head, { type: "PREPARE_QUOTATION" })
        assert.equal(prepared.state, "QUOTATION_PENDING")
      },
    )

    await t.test(
      "quotation control is scoped and internal data never reaches the client",
      async () => {
        await act(head, {
          type: "ASSIGN_APPROVERS",
          quotationApproverId: admin.id,
          paymentVerifierId: paymentAdmin.id,
        })
        const created = await act(head, quote())
        assert.equal(created.quotations.at(-1)!.status, "PENDING_INTERNAL")
        const unpublishedQuotationId = created.quotations.at(-1)!.id
        const replacementQuote = await act(
          head,
          quote("Corrected internal draft scope"),
        )
        const quotationId = replacementQuote.quotations.at(-1)!.id
        assert.equal(
          replacementQuote.quotations.find(
            (row) => row.id === unpublishedQuotationId,
          )!.status,
          "SUPERSEDED",
        )
        const clientView = await read()
        assert.ok(
          !clientView.quotations.some((row) =>
            [quotationId, unpublishedQuotationId].includes(row.id),
          ),
        )
        assert.equal(clientView.internal, undefined)
        assert.equal((await get(otherAdmin)).status, 404)
        const quotationApprover = await read(admin)
        assert.equal(quotationApprover.permissions.approveQuotation, true)
        assert.equal(quotationApprover.permissions.verifyPayment, false)
        assert.equal(quotationApprover.payment, null)
        assert.equal(quotationApprover.agreement, null)
        assert.equal(quotationApprover.project, null)
        const paymentVerifier = await read(paymentAdmin)
        assert.equal(paymentVerifier.permissions.approveQuotation, false)
        assert.equal(paymentVerifier.permissions.verifyPayment, true)
        assert.equal(paymentVerifier.quotations.length, 0)
        assert.ok(
          !(await read(admin)).files.some(
            (file) => file.id === submittedFileId,
          ),
        )
        assert.equal(
          (
            await fetch(`${path()}/files/${submittedFileId}`, {
              headers: admin.headers,
            })
          ).status,
          404,
        )
        const current = await read(head)
        assert.equal(
          (
            await send(
              head,
              { type: "APPROVE_QUOTATION", quotationId },
              current.version,
            )
          ).status,
          403,
        )
        assert.equal(
          (
            await send(
              paymentAdmin,
              { type: "APPROVE_QUOTATION", quotationId },
              current.version,
            )
          ).status,
          403,
        )
        const approved = await act(admin, {
          type: "APPROVE_QUOTATION",
          quotationId,
        })
        assert.equal(approved.state, "CLIENT_APPROVAL")
        assert.equal((await read()).quotations.at(-1)!.status, "SENT")
        const financialFile = await upload(
          paymentAdmin,
          "finance.txt",
          "Confidential financial controls",
        )
        assert.ok(
          !(await read()).files.some((file) => file.id === financialFile.id),
        )
        assert.equal(
          (
            await fetch(`${path()}/files/${financialFile.id}`, {
              headers: client.headers,
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await fetch(`${path()}/files/${financialFile.id}`, {
              headers: paymentAdmin.headers,
            })
          ).status,
          200,
        )
        await act(head, {
          type: "INTERNAL_NOTE",
          note: "Private staffing cost estimate",
        })
        const serialized = JSON.stringify(await read())
        assert.ok(!serialized.includes("Private staffing cost estimate"))
        assert.ok(!serialized.includes("payloadHash"))
        assert.ok(!serialized.includes("sha256"))
        assert.ok(!serialized.includes("passwordHash"))
        assert.ok(!serialized.includes("clientVisible"))
      },
    )

    await t.test(
      "only the latest valid quotation can be formally accepted; retries do not duplicate decisions",
      async () => {
        const first = (await read()).quotations.at(-1)!
        const revised = await act(client, {
          type: "RESPOND_QUOTATION",
          quotationId: first.id,
          decision: "REVISE",
          note: "Include accessibility testing",
        })
        assert.equal(revised.state, "REVISION_REQUESTED")
        const second = await act(
          head,
          quote("Build an accessible and tested website"),
        )
        const latest = second.quotations.at(-1)!
        assert.equal(latest.version, first.version + 1)
        await act(admin, { type: "APPROVE_QUOTATION", quotationId: latest.id })
        const current = await read()
        assert.equal(
          (
            await send(
              client,
              {
                type: "RESPOND_QUOTATION",
                quotationId: first.id,
                decision: "ACCEPT",
                note: "",
              },
              current.version,
            )
          ).status,
          409,
        )
        await prisma!.workflowQuotation.update({
          where: { id: latest.id },
          data: { validUntil: new Date(Date.now() - 1000) },
        })
        assert.equal(
          (
            await send(
              client,
              {
                type: "RESPOND_QUOTATION",
                quotationId: latest.id,
                decision: "ACCEPT",
                note: "",
              },
              current.version,
            )
          ).status,
          409,
        )
        await prisma!.workflowQuotation.update({
          where: { id: latest.id },
          data: { validUntil: new Date(Date.now() + 86_400_000) },
        })
        const message = await fetch(
          `${base}/request-conversations/${request.id}/messages`,
          {
            method: "POST",
            headers: { ...client.headers, "content-type": "application/json" },
            body: JSON.stringify({
              body: "I approve this quotation",
              clientMessageId: randomUUID(),
            }),
          },
        )
        assert.equal(message.status, 201)
        assert.equal((await read()).approval, null)
        const actionId = randomUUID()
        const responseAction = {
          type: "RESPOND_QUOTATION",
          quotationId: latest.id,
          decision: "ACCEPT",
          note: "",
        }
        const accepted = await send(
          client,
          responseAction,
          current.version,
          actionId,
        )
        assert.equal(accepted.status, 200, await accepted.clone().text())
        const acceptedBody = (await accepted.json()) as TestWorkflow
        assert.equal(acceptedBody.state, "AGREEMENT_PAYMENT_PENDING")
        assert.equal(Number(acceptedBody.approval!.amount), 30000)
        assert.equal(acceptedBody.approval!.approvedById, client.id)
        assert.ok(acceptedBody.approval!.approvedAt)
        acceptedQuotationId = latest.id
        assert.equal(
          (await send(client, responseAction, current.version, actionId))
            .status,
          200,
        )
        assert.equal(
          (
            await send(
              client,
              { ...responseAction, decision: "DECLINE" },
              current.version,
              actionId,
            )
          ).status,
          409,
        )
        assert.equal(
          await prisma!.workflowApproval.count({
            where: { requestId: request.id },
          }),
          1,
        )
        assert.equal(
          await prisma!.project.count({ where: { requestId: request.id } }),
          1,
        )
        assert.equal(acceptedBody.project, null)
        const draft = await prisma!.project.findUniqueOrThrow({
          where: { requestId: request.id },
        })
        assert.equal((await read(admin)).payment, null)
        assert.equal((await read(admin)).agreement, null)
        const paymentView = await read(paymentAdmin)
        assert.equal(paymentView.quotations.length, 1)
        assert.equal(paymentView.quotations[0]!.status, "ACCEPTED")
        assert.equal(
          (
            await fetch(`${base}/projects/${draft.id}`, {
              headers: client.headers,
            })
          ).status,
          404,
        )
        await assert.rejects(
          db.query(
            'UPDATE "WorkflowApproval" SET "amount" = 1 WHERE "requestId" = $1',
            [request.id],
          ),
          /immutable/,
        )
        await assert.rejects(
          db.query('DELETE FROM "WorkflowApproval" WHERE "requestId" = $1', [
            request.id,
          ]),
          /immutable/,
        )
      },
    )

    await t.test(
      "agreement, payment and staffing gates block premature project activation",
      async () => {
        const current = await read(head)
        assert.equal(
          (await send(head, { type: "ACTIVATE_PROJECT" }, current.version))
            .status,
          409,
        )
        for (const invalid of [inactiveEmployee.id, foreignEmployee.id])
          assert.equal(
            (
              await send(
                head,
                { type: "STAFF_PROJECT", employeeIds: [invalid] },
                current.version,
              )
            ).status,
            409,
          )
        await act(head, { type: "STAFF_PROJECT", employeeIds: [employee.id] })
        const agreement = await upload(
          paymentAdmin,
          "agreement.txt",
          "Agreement terms",
        )
        assert.equal(
          (
            await fetch(`${path()}/files/${agreement.id}`, {
              headers: client.headers,
            })
          ).status,
          404,
        )
        await act(paymentAdmin, {
          type: "ATTACH_AGREEMENT",
          fileId: agreement.id,
        })
        assert.equal(
          (
            await fetch(`${path()}/files/${agreement.id}`, {
              headers: client.headers,
            })
          ).status,
          200,
        )
        assert.equal(
          (
            await fetch(`${path()}/files/${agreement.id}`, {
              headers: admin.headers,
            })
          ).status,
          404,
        )
        const signature = await upload(client, "signed.txt", "Signed agreement")
        await act(client, { type: "SIGN_AGREEMENT", fileId: signature.id })
        await act(head, {
          type: "REVIEW_AGREEMENT",
          approve: true,
          note: "Signed by client",
        })
        const proof = await upload(
          client,
          "receipt.txt",
          "Manual bank payment proof",
        )
        await act(client, {
          type: "SUBMIT_PAYMENT",
          fileId: proof.id,
          reference: "BANK-WF-001",
        })
        const beforeVerification = await read(head)
        assert.equal(
          (
            await send(
              admin,
              {
                type: "VERIFY_PAYMENT",
                approve: true,
                note: "No verifier grant",
              },
              beforeVerification.version,
            )
          ).status,
          403,
        )
        assert.equal(
          (
            await send(
              head,
              {
                type: "VERIFY_PAYMENT",
                approve: true,
                note: "Self-verification",
              },
              beforeVerification.version,
            )
          ).status,
          403,
        )
        assert.equal(
          (
            await send(
              client,
              { type: "VERIFY_PAYMENT", approve: true, note: "" },
              beforeVerification.version,
            )
          ).status,
          403,
        )
        assert.equal(
          (
            await send(
              head,
              { type: "ACTIVATE_PROJECT" },
              beforeVerification.version,
            )
          ).status,
          409,
        )
        const ready = await act(paymentAdmin, {
          type: "VERIFY_PAYMENT",
          approve: true,
          note: "Bank deposit confirmed",
        })
        assert.equal(ready.payment!.status, "VERIFIED")
        assert.equal(ready.state, "READY_FOR_ACTIVATION")
        assert.equal(ready.project, null)
        assert.equal((await read(head)).project!.status, "PLANNED")
        assert.equal((await read()).project, null)
        const manager = await read(head)
        const response = await send(
          admin,
          { type: "ACTIVATE_PROJECT" },
          manager.version,
        )
        assert.equal(response.status, 403)
        const activationId = randomUUID()
        const activations = await Promise.all([
          send(
            head,
            { type: "ACTIVATE_PROJECT" },
            manager.version,
            activationId,
          ),
          send(
            head,
            { type: "ACTIVATE_PROJECT" },
            manager.version,
            activationId,
          ),
        ])
        for (const activation of activations)
          assert.equal(activation.status, 200, await activation.clone().text())
        const active = await read()
        assert.equal(active.state, "ACTIVE_PROJECT")
        assert.equal(active.project!.status, "IN_PROGRESS")
        projectId = active.project!.id
        assert.equal(
          await prisma!.project.count({ where: { requestId: request.id } }),
          1,
        )
        assert.equal(
          await prisma!.projectMilestone.count({ where: { projectId } }),
          2,
        )
        const persisted = await prisma!.project.findUniqueOrThrow({
          where: { id: projectId },
        })
        assert.equal(persisted.quotationId, acceptedQuotationId)
        assert.ok(
          active.events.some((event) => event.type === "PROJECT_ACTIVATED"),
        )
        assert.equal(active.internal, undefined)
        const workspace = await fetch(`${base}/projects/${projectId}`, {
          headers: client.headers,
        })
        assert.equal(workspace.status, 200)
        const workspaceJson = await workspace.text()
        assert.ok(!workspaceJson.includes("Private staffing cost estimate"))
        assert.ok(!workspaceJson.includes(employee.id))
        assert.equal(
          (
            await fetch(`${base}/projects/${projectId}`, {
              headers: otherClient.headers,
            })
          ).status,
          404,
        )
        const milestones = (
          JSON.parse(workspaceJson) as {
            milestones: { id: string; completedAt: string | null }[]
          }
        ).milestones
        const milestoneId = milestones[0]!.id
        const patchMilestone = (actor: Actor, completed: boolean) =>
          fetch(`${base}/projects/${projectId}/milestones/${milestoneId}`, {
            method: "PATCH",
            headers: { ...actor.headers, "content-type": "application/json" },
            body: JSON.stringify({ completed }),
          })
        assert.equal((await patchMilestone(client, true)).status, 404)
        const completed = await patchMilestone(staff, true)
        assert.equal(completed.status, 200, await completed.clone().text())
        assert.ok(
          (
            (await completed.json()) as {
              milestones: { completedAt: string | null }[]
            }
          ).milestones[0]!.completedAt,
        )
        const reopened = await patchMilestone(staff, false)
        assert.equal(reopened.status, 200)
        assert.equal(
          (
            (await reopened.json()) as {
              milestones: { completedAt: string | null }[]
            }
          ).milestones[0]!.completedAt,
          null,
        )
        await prisma!.employee.update({
          where: { id: employee.id },
          data: { departmentId: foreignDepartment.id },
        })
        assert.equal(
          (
            await fetch(`${base}/projects/${projectId}`, {
              headers: staff.headers,
            })
          ).status,
          404,
        )
        assert.equal((await patchMilestone(staff, true)).status, 404)
        await prisma!.employee.update({
          where: { id: employee.id },
          data: { departmentId: department.id },
        })
      },
    )

    await t.test(
      "version checks, pause and department head handoffs enforce live authorization",
      async () => {
        const heldRequest = await prisma!.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: service.id,
            title: "Paused request",
          },
        })
        assert.equal((await accept(heldRequest.id)).status, 200)
        const initial = await read(head, heldRequest.id)
        const concurrent = await Promise.all([
          send(
            head,
            { type: "INTERNAL_NOTE", note: "Version race one" },
            initial.version,
            randomUUID(),
            heldRequest.id,
          ),
          send(
            head,
            { type: "INTERNAL_NOTE", note: "Version race two" },
            initial.version,
            randomUUID(),
            heldRequest.id,
          ),
        ])
        assert.deepEqual(
          concurrent.map((response) => response.status).sort(),
          [200, 409],
        )
        const before = await read(head, heldRequest.id)
        const held = await act(
          head,
          { type: "HOLD", note: "Awaiting client availability" },
          heldRequest.id,
        )
        assert.equal(held.state, "ON_HOLD")
        assert.equal(
          (
            await send(
              head,
              {
                type: "REQUEST_REQUIREMENT",
                title: "Extra",
                details: "",
                mandatory: true,
              },
              before.version,
              randomUUID(),
              heldRequest.id,
            )
          ).status,
          409,
        )
        const resumed = await act(
          head,
          { type: "RESUME", note: "Client available" },
          heldRequest.id,
        )
        assert.equal(resumed.state, "CONSULTATION")
        await prisma!.department.update({
          where: { id: department.id },
          data: { headId: replacement.id },
        })
        assert.equal((await get(head)).status, 404)
        assert.equal(
          (
            await fetch(`${path()}/files/${submittedFileId}`, {
              headers: head.headers,
            })
          ).status,
          404,
        )
        assert.equal((await get(replacement)).status, 200)
        const replacementView = await read(replacement)
        assert.ok(replacementView.internal)
        assert.equal((await get()).status, 200)
        await prisma!.department.update({
          where: { id: department.id },
          data: { headId: head.id },
        })
      },
    )

    await t.test(
      "fixed-price requests skip negotiation but retain formal approval and authorized activation",
      async () => {
        const fixedService = await prisma!.service.create({
          data: {
            name: "Fixed audit",
            description: "Audit",
            requiresAgreement: false,
            requiresPayment: false,
            departments: { connect: { id: department.id } },
          },
        })
        const fixedRequest = await prisma!.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: fixedService.id,
            title: "Accessibility audit",
            pricingModel: "FIXED",
            agreedPrice: "5000.00",
            currency: "PHP",
            packageName: "Audit",
          },
        })
        assert.equal((await accept(fixedRequest.id)).status, 200)
        const fixed = await act(
          head,
          { type: "FIXED_QUOTATION" },
          fixedRequest.id,
        )
        const quotation = fixed.quotations.at(-1)!
        assert.equal(Number(quotation.total), 5000)
        const approved = await act(
          client,
          {
            type: "RESPOND_QUOTATION",
            quotationId: quotation.id,
            decision: "ACCEPT",
            note: "",
          },
          fixedRequest.id,
        )
        assert.ok(approved.approval)
        await act(
          head,
          { type: "STAFF_PROJECT", employeeIds: [employee.id] },
          fixedRequest.id,
        )
        const activated = await act(
          head,
          { type: "ACTIVATE_PROJECT" },
          fixedRequest.id,
        )
        assert.equal(activated.state, "ACTIVE_PROJECT")
        assert.equal(
          await prisma!.workflowApproval.count({
            where: { requestId: fixedRequest.id },
          }),
          1,
        )
        const cancelledRequest = await prisma!.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: fixedService.id,
            title: "Cancelled audit",
            pricingModel: "FIXED",
            agreedPrice: "5000.00",
            currency: "PHP",
          },
        })
        assert.equal((await accept(cancelledRequest.id)).status, 200)
        const cancelledQuote = await act(
          head,
          { type: "FIXED_QUOTATION" },
          cancelledRequest.id,
        )
        await act(
          client,
          {
            type: "RESPOND_QUOTATION",
            quotationId: cancelledQuote.quotations[0]!.id,
            decision: "ACCEPT",
            note: "",
          },
          cancelledRequest.id,
        )
        const cancelledDraft = await prisma!.project.findUniqueOrThrow({
          where: { requestId: cancelledRequest.id },
        })
        await act(
          head,
          {
            type: "CANCEL",
            note: "Client requested cancellation before commencement",
          },
          cancelledRequest.id,
        )
        assert.equal(
          (
            await fetch(`${base}/projects/${cancelledDraft.id}`, {
              headers: client.headers,
            })
          ).status,
          404,
        )
        const declinedRequest = await prisma!.serviceRequest.create({
          data: {
            clientId: client.id,
            serviceId: fixedService.id,
            title: "Declined audit",
            pricingModel: "FIXED",
            agreedPrice: "5000.00",
            currency: "PHP",
          },
        })
        assert.equal((await accept(declinedRequest.id)).status, 200)
        const declinedQuote = await act(
          head,
          { type: "FIXED_QUOTATION" },
          declinedRequest.id,
        )
        const declined = await act(
          client,
          {
            type: "RESPOND_QUOTATION",
            quotationId: declinedQuote.quotations[0]!.id,
            decision: "DECLINE",
            note: "Budget changed",
          },
          declinedRequest.id,
        )
        assert.equal(declined.state, "DECLINED")
        assert.equal(declined.approval, null)
        assert.equal(
          await prisma!.project.count({
            where: { requestId: declinedRequest.id },
          }),
          0,
        )
      },
    )

    await t.test(
      "events and notifications retain an audit trail without leaking internal notes",
      async () => {
        const events = await prisma!.workflowEvent.findMany({
          where: { requestId: request.id },
        })
        assert.ok(
          events.some(
            (event) =>
              event.internal &&
              event.summary.includes("Private staffing cost estimate"),
          ),
        )
        const clientNotifications = await prisma!.workflowNotification.findMany(
          {
            where: { requestId: request.id, userId: client.id },
            include: { event: true },
          },
        )
        assert.ok(clientNotifications.length > 0)
        assert.ok(
          clientNotifications.every(
            (notification) => !notification.event.internal,
          ),
        )
        assert.equal(
          await prisma!.project.count({
            where: { id: projectId, requestId: request.id },
          }),
          1,
        )
      },
    )
  },
)
