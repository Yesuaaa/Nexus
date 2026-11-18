import type { Prisma } from "../../generated/prisma/client.js"
import {
  auditCode,
  auditDate,
  auditList,
  type ServiceLogChange,
} from "../service-operation-logs/audit-context.js"
import type { WorkflowCommand } from "./workflow.validation.js"

type WorkflowAuditSnapshot = Awaited<ReturnType<typeof workflowAuditSnapshot>>

function commandRecordId(
  command: WorkflowCommand,
  field: "requirementId" | "consultationId" | "quotationId",
) {
  return field in command
    ? (command as Partial<Record<typeof field, string>>)[field]
    : undefined
}

function timestamp(value: Date | null | undefined) {
  return value?.toISOString() ?? null
}

function money(
  value: { toFixed(fractionDigits: number): string } | null | undefined,
  currency: string | null | undefined,
) {
  return value && currency ? `${currency} ${value.toFixed(2)}` : null
}

function identity(value: { id: string; fullName: string | null } | null) {
  return value?.fullName?.trim() || value?.id || null
}

export async function workflowAuditSnapshot(
  tx: Prisma.TransactionClient,
  requestId: string,
  command: WorkflowCommand,
) {
  const requirementId = commandRecordId(command, "requirementId")
  const consultationId = commandRecordId(command, "consultationId")
  const quotationId = commandRecordId(command, "quotationId")
  const [
    request,
    requirementCount,
    consultationCount,
    requirement,
    consultation,
    quotation,
    agreement,
    payment,
    project,
  ] = await Promise.all([
    tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: {
        status: true,
        workflow: {
          select: {
            state: true,
            quotationApprover: { select: { id: true, fullName: true } },
            paymentVerifier: { select: { id: true, fullName: true } },
          },
        },
      },
    }),
    tx.workflowRequirement.count({ where: { requestId } }),
    tx.workflowConsultation.count({ where: { requestId } }),
    requirementId
      ? tx.workflowRequirement.findFirst({
          where: { id: requirementId, requestId },
          select: {
            status: true,
            mandatory: true,
            attachments: { select: { id: true } },
          },
        })
      : null,
    consultationId
      ? tx.workflowConsultation.findFirst({
          where: { id: consultationId, requestId },
          select: { status: true, startsAt: true, endsAt: true },
        })
      : null,
    tx.workflowQuotation.findFirst({
      where: { requestId, ...(quotationId ? { id: quotationId } : {}) },
      orderBy: { version: "desc" },
      select: {
        version: true,
        status: true,
        total: true,
        currency: true,
        paymentDue: true,
        validUntil: true,
      },
    }),
    tx.workflowAgreement.findUnique({
      where: { requestId },
      select: {
        status: true,
        documentFileId: true,
        signedFileId: true,
      },
    }),
    tx.workflowPayment.findUnique({
      where: { requestId },
      select: {
        status: true,
        amount: true,
        currency: true,
        proofFileId: true,
      },
    }),
    tx.project.findUnique({
      where: { requestId },
      select: {
        name: true,
        status: true,
        staff: {
          orderBy: { employee: { fullName: "asc" } },
          select: { employee: { select: { fullName: true } } },
        },
      },
    }),
  ])
  return {
    requestStatus: auditCode(request.status),
    workflowState: auditCode(request.workflow?.state),
    requirementCount,
    requirementStatus: auditCode(requirement?.status),
    requirementMandatory: requirement?.mandatory ?? null,
    requirementAttachments: requirement?.attachments.length ?? null,
    consultationCount,
    consultationStatus: auditCode(consultation?.status),
    consultationStarts: timestamp(consultation?.startsAt),
    consultationEnds: timestamp(consultation?.endsAt),
    quotationVersion: quotation?.version ?? null,
    quotationStatus: auditCode(quotation?.status),
    quotationTotal: money(quotation?.total, quotation?.currency),
    quotationPaymentDue: money(quotation?.paymentDue, quotation?.currency),
    quotationValidUntil: auditDate(quotation?.validUntil),
    agreementStatus: auditCode(agreement?.status),
    agreementDocument: agreement?.documentFileId ? "Attached" : "Not attached",
    signedAgreement: agreement?.signedFileId ? "Attached" : "Not attached",
    paymentStatus: auditCode(payment?.status),
    paymentAmount: money(payment?.amount, payment?.currency),
    paymentProof: payment?.proofFileId ? "Attached" : "Not attached",
    quotationApprover: identity(request.workflow?.quotationApprover ?? null),
    paymentVerifier: identity(request.workflow?.paymentVerifier ?? null),
    projectStatus: auditCode(project?.status),
    projectName: project?.name ?? null,
    projectStaff: project
      ? auditList(project.staff.map(({ employee }) => employee.fullName))
      : null,
  }
}

function add(
  changes: ServiceLogChange[],
  field: string,
  before: ServiceLogChange["before"],
  after: ServiceLogChange["after"],
) {
  if (before !== after) changes.push({ field, before, after })
}

function commonChanges(
  command: WorkflowCommand,
  before: WorkflowAuditSnapshot,
  after: WorkflowAuditSnapshot,
) {
  const changes: ServiceLogChange[] = [
    {
      field: "Workflow action",
      before: null,
      after: auditCode(command.type),
    },
  ]
  add(changes, "Workflow state", before.workflowState, after.workflowState)
  add(changes, "Request status", before.requestStatus, after.requestStatus)
  return changes
}

export function workflowAuditChanges(
  command: WorkflowCommand,
  before: WorkflowAuditSnapshot,
  after: WorkflowAuditSnapshot,
): ServiceLogChange[] {
  const changes = commonChanges(command, before, after)
  switch (command.type) {
    case "REQUEST_CONSULTATION_RESCHEDULE":
      add(
        changes,
        "Reschedule decision",
        "Not requested",
        `Requested for ${command.startsAt}`,
      )
      break
    case "RESPOND_CONSULTATION_RESCHEDULE":
      add(
        changes,
        "Reschedule decision",
        "Pending",
        command.approve ? "Approved" : "Declined",
      )
      add(
        changes,
        "Consultation starts",
        before.consultationStarts,
        after.consultationStarts,
      )
      add(
        changes,
        "Consultation ends",
        before.consultationEnds,
        after.consultationEnds,
      )
      break
    case "REQUEST_REQUIREMENT":
      add(
        changes,
        "Requirement count",
        before.requirementCount,
        after.requirementCount,
      )
      add(changes, "Requirement status", null, "Requested")
      add(changes, "Mandatory requirement", null, command.mandatory)
      add(
        changes,
        "Quotation status",
        before.quotationStatus,
        after.quotationStatus,
      )
      break
    case "SUBMIT_REQUIREMENT":
    case "REVIEW_REQUIREMENT":
      add(
        changes,
        "Requirement status",
        before.requirementStatus,
        after.requirementStatus,
      )
      add(
        changes,
        "Requirement attachments",
        before.requirementAttachments,
        after.requirementAttachments,
      )
      break
    case "SCHEDULE_CONSULTATION":
      add(
        changes,
        "Consultation count",
        before.consultationCount,
        after.consultationCount,
      )
      add(changes, "Consultation status", null, "Scheduled")
      add(changes, "Consultation starts", null, command.startsAt)
      add(changes, "Consultation ends", null, command.endsAt)
      break
    case "COMPLETE_CONSULTATION":
    case "CANCEL_CONSULTATION":
      add(
        changes,
        "Consultation status",
        before.consultationStatus,
        after.consultationStatus,
      )
      break
    case "FIXED_QUOTATION":
    case "CREATE_QUOTATION":
      add(
        changes,
        "Quotation version",
        before.quotationVersion,
        after.quotationVersion,
      )
      add(
        changes,
        "Quotation status",
        before.quotationStatus,
        after.quotationStatus,
      )
      add(
        changes,
        "Quotation total",
        before.quotationTotal,
        after.quotationTotal,
      )
      add(
        changes,
        "Commencement payment",
        before.quotationPaymentDue,
        after.quotationPaymentDue,
      )
      add(
        changes,
        "Quotation valid until",
        before.quotationValidUntil,
        after.quotationValidUntil,
      )
      break
    case "APPROVE_QUOTATION":
    case "RESPOND_QUOTATION":
      add(
        changes,
        "Quotation status",
        before.quotationStatus,
        after.quotationStatus,
      )
      add(
        changes,
        "Agreement status",
        before.agreementStatus,
        after.agreementStatus,
      )
      add(changes, "Payment status", before.paymentStatus, after.paymentStatus)
      add(changes, "Payment amount", before.paymentAmount, after.paymentAmount)
      add(changes, "Project status", before.projectStatus, after.projectStatus)
      break
    case "ATTACH_AGREEMENT":
    case "SIGN_AGREEMENT":
    case "REVIEW_AGREEMENT":
      add(
        changes,
        "Agreement status",
        before.agreementStatus,
        after.agreementStatus,
      )
      add(
        changes,
        "Agreement document",
        before.agreementDocument,
        after.agreementDocument,
      )
      add(
        changes,
        "Signed agreement",
        before.signedAgreement,
        after.signedAgreement,
      )
      break
    case "COMPLETE_SANDBOX_PAYMENT":
    case "SUBMIT_PAYMENT":
    case "VERIFY_PAYMENT":
      add(changes, "Payment status", before.paymentStatus, after.paymentStatus)
      add(changes, "Payment amount", before.paymentAmount, after.paymentAmount)
      add(changes, "Payment proof", before.paymentProof, after.paymentProof)
      break
    case "ASSIGN_APPROVERS":
      add(
        changes,
        "Quotation approver",
        before.quotationApprover,
        after.quotationApprover,
      )
      add(
        changes,
        "Payment verifier",
        before.paymentVerifier,
        after.paymentVerifier,
      )
      break
    case "STAFF_PROJECT":
      add(changes, "Project staff", before.projectStaff, after.projectStaff)
      break
    case "ACTIVATE_PROJECT":
      add(changes, "Project status", before.projectStatus, after.projectStatus)
      add(changes, "Project name", before.projectName, after.projectName)
      break
    case "CANCEL":
      add(changes, "Project status", before.projectStatus, after.projectStatus)
      break
    case "INTERNAL_NOTE":
      add(changes, "Internal note", "Not added", "Added")
      break
    case "PREPARE_QUOTATION":
    case "HOLD":
    case "RESUME":
      break
  }
  return changes
}
