import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { issueSession } from "../../src/features/auth/auth.service.js"
import type { Role } from "../../src/generated/prisma/client.js"
import { startPgliteApp } from "../support/pglite-app.js"
import type { TestContext } from "node:test"

export type TestWorkflow = {
  state: string
  version: number
  nextAction: string
  permissions: {
    manage: boolean
    isClient: boolean
    approveQuotation: boolean
    verifyPayment: boolean
  }
  requirements: {
    id: string
    status: string
    submission: string | null
    fileId: string | null
    fileIds: string[]
  }[]
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

/** Shared fixtures for the request workflow steps, which run in order on one database. */
export async function createWorkflowContext(t: TestContext) {
  const state = {
    requirementId: "",
    acceptedQuotationId: "",
    projectId: "",
    submittedFileId: "",
  }

  const { prisma, db, origin } = await startPgliteApp(t)
  const originalEnvironment = process.env.NODE_ENV
  const originalSimulator = process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR
  delete process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR
  t.after(() => {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnvironment
    if (originalSimulator === undefined)
      delete process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR
    else process.env.WORKFLOW_LOCAL_PAYMENT_SIMULATOR = originalSimulator
  })
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
  const base = `${origin}/api`
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
    const response = await send(actor, input, current.version, randomUUID(), id)
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

  return {
    prisma,
    db,
    origin,
    originalEnvironment,
    originalSimulator,
    user,
    client,
    otherClient,
    head,
    replacement,
    staff,
    admin,
    paymentAdmin,
    otherAdmin,
    superadmin,
    department,
    foreignDepartment,
    employee,
    inactiveEmployee,
    foreignEmployee,
    service,
    request,
    anotherRequest,
    base,
    path,
    get,
    read,
    send,
    act,
    accept,
    upload,
    quote,
    state,
  }
}

export type WorkflowContext = Awaited<ReturnType<typeof createWorkflowContext>>
export type Actor = WorkflowContext["client"]
