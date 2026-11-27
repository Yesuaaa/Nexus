import { getPrisma } from "../../src/lib/db.js"
import { servicesService } from "../../src/features/services/services.service.js"
import { submitServiceRequest } from "../../src/features/service-requests/service-requests.service.js"
import { acceptInboxRequest } from "../../src/features/request-inbox/request-inbox.service.js"
import { actOnWorkflow } from "../../src/features/request-workflow/workflow.service.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"
import { prepareShowcaseBoard } from "./showcase-kanban.js"

const scenarios = [
  {
    kind: "photography",
    service: "Showcase Product Photography",
    title: "Avelora Product Photography",
    client: 22,
  },
  {
    kind: "design",
    service: "Showcase Graphic Design",
    title: "Northline Brand Identity",
    client: 23,
  },
  {
    kind: "design",
    service: "Showcase Retail Brand Design",
    title: "Avelora Retail Brand Refresh",
    client: 22,
  },
  {
    kind: "photography",
    service: "Showcase Retail Campaign Imagery",
    title: "Avelora Seasonal Campaign Imagery",
    client: 22,
  },
] as const

/** Creates fictional requests and advances them through the normal project workflow. */
export async function seedShowcaseProjects(headId: string) {
  const target = assertPhase2Target(process.env)
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  const databaseClient = prisma
  await prisma.$transaction(async (tx) => {
    const [database] = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (database?.name !== target.database)
      throw new Error(
        "The connected database does not match the confirmed target",
      )
    await assertShowcaseRealtimeDisabled(tx)
  })
  const department = await prisma.department.findFirst({
    where: {
      headId,
      head: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
  })
  if (!department) throw new Error("An active department head is required")
  const staff = await prisma.employee.findMany({
    where: {
      id: { in: [0, 1, 2, 3].map((i) => showcaseId("employee", i)) },
      departmentId: department.id,
      status: "ACTIVE",
      user: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    orderBy: { id: "asc" },
    select: { id: true },
  })
  if (staff.length !== 4)
    throw new Error(
      "The four Phase 1 showcase employees must be active in the head's department",
    )
  const result = []
  for (let index = 0; index < scenarios.length; index++) {
    const scenario = scenarios[index]
    let service = await prisma.service.findUnique({
      where: { name: scenario.service },
      include: { departments: true, packages: true },
    })
    if (!service) {
      const created = await servicesService.create({
        name: scenario.service,
        description: "Fictional service for a local product demonstration.",
        departmentIds: [department.id],
        isActive: true,
        requiresConsultation: false,
        requiresAgreement: false,
        requiresPayment: false,
        requiresQuotationApproval: false,
      })
      service = await prisma.service.findUniqueOrThrow({
        where: { id: created.id },
        include: { departments: true, packages: true },
      })
    }
    if (
      !service.isActive ||
      service.requiresConsultation ||
      service.requiresAgreement ||
      service.requiresPayment ||
      service.requiresQuotationApproval ||
      service.packages.length ||
      service.departments.length !== 1 ||
      service.departments[0].id !== department.id
    )
      throw new Error("The showcase service has unexpected configuration")
    const clientId = showcaseId("user", scenario.client)
    const receipt = await submitServiceRequest(clientId, {
      serviceId: service.id,
      packageId: null,
      preferredSpecialistId: null,
      submissionKey: showcaseUuid("phase2-request", index),
      goals: "Prepare a coordinated creative launch.",
      requirements: `Deliver the ${scenario.kind} assets and review them with the client.`,
      expectedTimeline: "Six weeks",
      additionalDetails: "Fictional local showcase project.",
    })
    let request = await prisma.serviceRequest.findUniqueOrThrow({
      where: { id: receipt.id },
      include: { workflow: true, project: true },
    })
    if (!request.workflow) {
      await acceptInboxRequest(headId, request.id)
      request = await prisma.serviceRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: { workflow: true, project: true },
      })
    }
    async function action(
      actor: string,
      step: number,
      body: Record<string, unknown>,
    ) {
      const current = await databaseClient.requestWorkflow.findUniqueOrThrow({
        where: { requestId: request.id },
      })
      await actOnWorkflow(actor, request.id, {
        actionId: showcaseUuid(`phase2-${index}-action`, step),
        expectedVersion: current.version,
        ...body,
      })
    }
    if (request.workflow?.state === "CONSULTATION") {
      await action(headId, 0, {
        type: "CREATE_QUOTATION",
        scope: "Creative planning, production and client review.",
        deliverables: ["Creative direction", "Final approved assets"],
        lineItems: [
          {
            description: "Creative delivery",
            quantity: 1,
            unitPrice: "45000.00",
          },
        ],
        currency: "PHP",
        timeline: "Six weeks",
        paymentTerms:
          "No commencement payment required for this fictional engagement.",
        paymentDue: "0.00",
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
    }
    let workflow = await prisma.requestWorkflow.findUniqueOrThrow({
      where: { requestId: request.id },
    })
    if (workflow.state === "CLIENT_APPROVAL") {
      const quote = await prisma.workflowQuotation.findFirstOrThrow({
        where: { requestId: request.id },
        orderBy: { version: "desc" },
      })
      await action(clientId, 1, {
        type: "RESPOND_QUOTATION",
        quotationId: quote.id,
        decision: "ACCEPT",
        note: "Approved for the showcase project.",
      })
    }
    workflow = await prisma.requestWorkflow.findUniqueOrThrow({
      where: { requestId: request.id },
    })
    if (workflow.state === "READY_FOR_ACTIVATION") {
      await action(headId, 2, {
        type: "STAFF_PROJECT",
        employeeIds: staff.map((employee) => employee.id),
      })
      await action(headId, 3, {
        type: "ACTIVATE_PROJECT",
        projectName: scenario.title,
      })
    }
    workflow = await prisma.requestWorkflow.findUniqueOrThrow({
      where: { requestId: request.id },
    })
    if (workflow.state !== "ACTIVE_PROJECT")
      throw new Error(`Unexpected workflow state: ${workflow.state}`)
    const project = await prisma.project.findUniqueOrThrow({
      where: { requestId: request.id },
    })
    result.push(await prepareShowcaseBoard(headId, project.id, scenario.kind))
  }
  return result
}
