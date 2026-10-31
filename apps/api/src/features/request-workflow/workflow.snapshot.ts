import { getPrisma } from "../../lib/db.js"
import { workflowAccess, type WorkflowTx } from "./workflow.access.js"

const eventSelect = {
  id: true,
  type: true,
  summary: true,
  entityId: true,
  createdAt: true,
  actor: { select: { id: true, fullName: true } },
} as const
export const fileSelect = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  uploaderId: true,
  createdAt: true,
} as const

function nextAction(state: string) {
  const labels: Record<string, string> = {
    PENDING_REVIEW: "A department head will review your request.",
    CONSULTATION:
      "Complete the requirements and consultation before preparing a quotation.",
    QUOTATION_PENDING:
      "The department head is preparing the quotation or awaiting internal approval.",
    CLIENT_APPROVAL:
      "The client must formally accept, decline, or request revisions to the latest valid quotation.",
    REVISION_REQUESTED: "The department head will send a revised quotation.",
    AGREEMENT_PAYMENT_PENDING:
      "Complete the agreement and payment checklist. Payment verification is manual.",
    READY_FOR_ACTIVATION:
      "The department head must approve staffing and activate the project.",
    ACTIVE_PROJECT: "Your project workspace is ready.",
    ON_HOLD: "This request is on hold. The department head can resume it.",
    CANCELLED: "This workflow has been cancelled.",
    DECLINED: "The quotation was declined. This workflow has ended.",
  }
  return labels[state] || "Review the conversation for the next action."
}

export async function snapshot(
  tx: WorkflowTx,
  userId: string,
  requestId: string,
) {
  const { request, permissions } = await workflowAccess(tx, userId, requestId)
  const participant = permissions.isClient || permissions.manage
  const financialDocuments = participant || permissions.verifyPayment
  const workflow = request.workflow
  const state =
    workflow?.state ||
    (request.status === "CANCELLED" ? "CANCELLED" : "PENDING_REVIEW")
  const base = {
    request: {
      id: request.id,
      referenceNumber: request.referenceNumber,
      title: request.title,
      serviceName: request.service.name,
      packageName: request.packageName,
      pricingModel: request.pricingModel,
      goals: participant ? request.projectGoals : "",
      requirements: participant ? request.projectRequirements : "",
      expectedTimeline: request.expectedTimeline,
      client: { id: request.client.id, fullName: request.client.fullName },
      department: request.acceptedDepartment
        ? {
            id: request.acceptedDepartment.id,
            name: request.acceptedDepartment.name,
          }
        : null,
    },
    state,
    previousState: workflow?.previousState ?? null,
    version: workflow?.version ?? 0,
    nextAction: nextAction(state),
    consultationRequired:
      workflow?.consultationRequired ?? request.service.requiresConsultation,
    quotationApprovalRequired:
      workflow?.quotationApprovalRequired ??
      request.service.requiresQuotationApproval,
    permissions,
  }
  if (!workflow)
    return {
      ...base,
      requirements: [],
      files: [],
      consultations: [],
      quotations: [],
      approval: null,
      agreement: null,
      payment: null,
      project: null,
      events: [],
    }
  const [
    requirements,
    files,
    consultations,
    quotations,
    approval,
    agreement,
    payment,
    project,
    events,
  ] = await Promise.all([
    participant
      ? tx.workflowRequirement.findMany({
          where: { requestId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            details: true,
            mandatory: true,
            status: true,
            submission: true,
            fileId: true,
            reviewNote: true,
            createdAt: true,
          },
        })
      : [],
    tx.workflowFile.findMany({
      where: {
        requestId,
        ...(permissions.isClient ? { clientVisible: true } : {}),
        ...(!participant
          ? {
              OR: [
                ...(permissions.verifyPayment
                  ? [
                      { agreements: { some: { requestId } } },
                      { signatures: { some: { requestId } } },
                      { payments: { some: { requestId } } },
                    ]
                  : []),
                { uploaderId: userId },
              ],
            }
          : {}),
      },
      select: fileSelect,
      orderBy: { createdAt: "asc" },
    }),
    participant
      ? tx.workflowConsultation.findMany({
          where: { requestId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            location: true,
            notes: true,
            status: true,
          },
        })
      : [],
    tx.workflowQuotation.findMany({
      where: {
        requestId,
        ...(permissions.isClient ? { publishedAt: { not: null } } : {}),
        ...(!participant && !permissions.approveQuotation
          ? { status: "ACCEPTED" }
          : {}),
      },
      orderBy: { version: "asc" },
      select: {
        id: true,
        version: true,
        status: true,
        scope: true,
        deliverables: true,
        lineItems: true,
        total: true,
        currency: true,
        timeline: true,
        paymentTerms: true,
        paymentDue: true,
        validUntil: true,
        decisionNote: true,
        createdAt: true,
      },
    }),
    tx.workflowApproval.findUnique({
      where: { requestId },
      select: {
        quotationId: true,
        amount: true,
        currency: true,
        approvedById: true,
        approvedAt: true,
      },
    }),
    financialDocuments
      ? tx.workflowAgreement.findUnique({
          where: { requestId },
          select: {
            id: true,
            mandatory: true,
            status: true,
            documentFileId: true,
            signedFileId: true,
          },
        })
      : null,
    financialDocuments
      ? tx.workflowPayment.findUnique({
          where: { requestId },
          select: {
            id: true,
            mandatory: true,
            amount: true,
            currency: true,
            status: true,
            proofFileId: true,
            reference: true,
          },
        })
      : null,
    participant
      ? tx.project.findUnique({
          where: { requestId },
          select: { id: true, name: true, status: true, startDate: true },
        })
      : null,
    tx.workflowEvent.findMany({
      where: {
        requestId,
        internal: false,
        ...(!participant
          ? {
              OR: [
                ...(permissions.approveQuotation
                  ? [{ type: { startsWith: "QUOTATION_" } }]
                  : []),
                ...(permissions.verifyPayment
                  ? [
                      { type: { startsWith: "PAYMENT_" } },
                      { type: { startsWith: "AGREEMENT_" } },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      select: eventSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ])
  let internal
  if (!permissions.isClient) {
    const [staff, approvers, internalEvents] = await Promise.all([
      permissions.manage
        ? tx.employee.findMany({
            where: {
              departmentId: request.acceptedDepartmentId!,
              user: { isActive: true, accountDeletedAt: null, role: "STAFF" },
            },
            orderBy: [{ status: "asc" }, { fullName: "asc" }],
            select: {
              id: true,
              fullName: true,
              position: true,
              status: true,
              profileSpecialties: true,
              projectAssignments: {
                select: {
                  projectId: true,
                  project: { select: { status: true, requestId: true } },
                },
              },
            },
          })
        : [],
      permissions.manage
        ? tx.user.findMany({
            where: {
              role: { in: ["ADMIN", "SUPERADMIN"] },
              isActive: true,
              accountDeletedAt: null,
            },
            select: { id: true, fullName: true },
            orderBy: { fullName: "asc" },
          })
        : [],
      tx.workflowEvent.findMany({
        where: {
          requestId,
          internal: true,
          ...(!permissions.manage
            ? {
                OR: [
                  ...(permissions.approveQuotation
                    ? [{ type: { startsWith: "QUOTATION_" } }]
                    : []),
                  ...(permissions.verifyPayment
                    ? [{ type: { startsWith: "PAYMENT_" } }]
                    : []),
                  { type: "APPROVERS_ASSIGNED" },
                ],
              }
            : {}),
        },
        select: eventSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ])
    internal = {
      staff: staff.map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        status: employee.status,
        skills: employee.profileSpecialties,
        activeProjectCount: employee.projectAssignments.filter(
          (assignment) => assignment.project.status === "IN_PROGRESS",
        ).length,
        assigned: employee.projectAssignments.some(
          (assignment) => assignment.project.requestId === requestId,
        ),
      })),
      approvers,
      quotationApproverId: workflow.quotationApproverId,
      paymentVerifierId: workflow.paymentVerifierId,
      events: internalEvents,
    }
  }
  // Prisma decimals use a canonical two-place string in the public contract.
  return {
    ...base,
    requirements,
    files,
    consultations,
    quotations: quotations.map((quote) => ({
      ...quote,
      total: quote.total.toFixed(2),
      paymentDue: quote.paymentDue.toFixed(2),
    })),
    approval: approval
      ? { ...approval, amount: approval.amount.toFixed(2) }
      : null,
    agreement,
    payment: payment ? { ...payment, amount: payment.amount.toFixed(2) } : null,
    project:
      project && (!permissions.isClient || project.startDate)
        ? { id: project.id, name: project.name, status: project.status }
        : null,
    events,
    ...(internal ? { internal } : {}),
  }
}

export function getWorkflow(userId: string, requestId: string) {
  return getPrisma()!.$transaction((tx) => snapshot(tx, userId, requestId), {
    isolationLevel: "RepeatableRead",
  })
}
