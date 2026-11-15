import type { WorkflowTx } from "./workflow.access.js"
import { nextAction } from "./workflow.snapshot.js"

// Only structured workflow history is inspectable. Never return raw summaries:
// they can contain private submissions, credentials, locations or internal notes.
const historyLabels: Record<string, string> = {
  CONSULTATION_OPENED: "Consultation opened",
  CONSULTATION_SCHEDULED: "Consultation scheduled",
  CONSULTATION_COMPLETED: "Consultation completed",
  CONSULTATION_CANCELLED: "Consultation cancelled",
  CONSULTATION_RESCHEDULE_REQUESTED: "Consultation reschedule requested",
  CONSULTATION_RESCHEDULE_CONFIRMED: "Consultation reschedule confirmed",
  CONSULTATION_RESCHEDULE_DECLINED: "Consultation reschedule declined",
  REQUIREMENT_REQUESTED: "Requirement requested",
  REQUIREMENT_SUBMITTED: "Requirement submitted",
  REQUIREMENT_REVIEWED: "Requirement reviewed",
  QUOTATION_PREPARATION: "Quotation preparation started",
  QUOTATION_INTERNAL_REVIEW: "Quotation submitted for internal review",
  QUOTATION_INTERNAL_APPROVED: "Quotation internally approved",
  QUOTATION_SENT: "Quotation sent to client",
  QUOTATION_DECLINED: "Quotation declined",
  QUOTATION_REVISION_REQUESTED: "Quotation revision requested",
  APPROVAL_CONFIRMED: "Client quotation acceptance recorded",
  AGREEMENT_CONFIRMED: "Service agreement confirmed",
  AGREEMENT_ATTACHED: "Agreement document recorded",
  AGREEMENT_SUBMITTED: "Agreement submitted",
  AGREEMENT_REVIEWED: "Agreement reviewed",
  PAYMENT_CREATED: "Payment stage created",
  PAYMENT_SUBMITTED: "Payment submitted for verification",
  PAYMENT_VERIFIED: "Payment verification reviewed",
  APPROVERS_ASSIGNED: "Approver assignments updated",
  STAFFING_APPROVED: "Project staffing reviewed",
  STAFFING_ALLOCATED: "Weekly staffing allocation recorded",
  COMMENCEMENT_READY: "Commencement requirements completed",
  PROJECT_ACTIVATED: "Project activated",
  WORKFLOW_ON_HOLD: "Workflow placed on hold",
  WORKFLOW_RESUMED: "Workflow resumed",
  WORKFLOW_CANCELLED: "Workflow cancelled",
}

/** Caller must authorize organization read. No participant snapshots or writes. */
export async function administrativeWorkflowSnapshot(
  tx: WorkflowTx,
  requestId: string,
) {
  const request = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      status: true,
      service: {
        select: {
          requiresConsultation: true,
          requiresQuotationApproval: true,
          requiresPayment: true,
        },
      },
      workflow: {
        select: {
          state: true,
          previousState: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          consultationRequired: true,
          quotationApprovalRequired: true,
          paymentRequired: true,
          quotationApprover: { select: { id: true, fullName: true } },
          paymentVerifier: { select: { id: true, fullName: true } },
          requirements: {
            select: {
              id: true,
              title: true,
              mandatory: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          consultations: {
            select: {
              id: true,
              status: true,
              startsAt: true,
              endsAt: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          quotations: {
            select: {
              id: true,
              version: true,
              status: true,
              createdAt: true,
              publishedAt: true,
              internallyApprovedAt: true,
              validUntil: true,
            },
            orderBy: { version: "asc" },
          },
          approval: {
            select: {
              approvedAt: true,
              quotationId: true,
              approvedBy: { select: { id: true, fullName: true } },
            },
          },
          agreement: {
            select: { mandatory: true, status: true, reviewedAt: true },
          },
          payment: {
            select: { mandatory: true, status: true, verifiedAt: true },
          },
          events: {
            where: { type: { in: Object.keys(historyLabels) } },
            select: {
              id: true,
              type: true,
              createdAt: true,
              internal: true,
              actor: { select: { id: true, fullName: true } },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          createdAt: true,
          staff: {
            select: {
              isTeamLead: true,
              approvedAt: true,
              weeklyHours: true,
              allocationStart: true,
              allocationEnd: true,
              employee: {
                select: { id: true, fullName: true, position: true },
              },
            },
            orderBy: { employeeId: "asc" },
          },
        },
      },
      meetings: {
        select: {
          meeting: {
            select: {
              status: true,
              startsAt: true,
              endsAt: true,
              createdAt: true,
              updatedAt: true,
              proposedStartsAt: true,
            },
          },
        },
        orderBy: { meetingId: "asc" },
      },
    },
  })
  const workflow = request.workflow
  const state =
    workflow?.state ??
    (request.status === "CANCELLED" ? "CANCELLED" : "PENDING_REVIEW")
  const consultations = workflow?.consultations ?? []
  return {
    state,
    previousState: workflow?.previousState ?? null,
    version: workflow?.version ?? 0,
    createdAt: workflow?.createdAt ?? null,
    updatedAt: workflow?.updatedAt ?? null,
    nextAction: nextAction(state),
    consultationRequired:
      workflow?.consultationRequired ?? request.service.requiresConsultation,
    consultationComplete:
      consultations.some((item) => item.status === "COMPLETED") ||
      request.meetings.some(({ meeting }) => meeting.status === "COMPLETED"),
    quotationApprovalRequired:
      workflow?.quotationApprovalRequired ??
      request.service.requiresQuotationApproval,
    paymentRequired:
      workflow?.paymentRequired ?? request.service.requiresPayment,
    permissions: {
      manage: false,
      isClient: false,
      approveQuotation: false,
      verifyPayment: false,
    },
    capabilities: {
      read: true,
      mutateWorkflow: false,
      participate: false,
      downloadFiles: false,
      activateProject: false,
    },
    quotationApprover: workflow?.quotationApprover ?? null,
    paymentVerifier: workflow?.paymentVerifier ?? null,
    requirements: workflow?.requirements ?? [],
    consultations,
    // Local references cannot be used as private meeting/conversation links.
    meetings: request.meetings.map(({ meeting }, index) => ({
      ...meeting,
      id: `meeting-${index + 1}`,
    })),
    quotations: workflow?.quotations ?? [],
    approval: workflow?.approval ?? null,
    agreement: workflow?.agreement ?? null,
    payment: workflow?.payment ?? null,
    project: request.project,
    events: (workflow?.events ?? []).map((event) => ({
      ...event,
      entityId: null,
      summary: historyLabels[event.type],
    })),
  }
}
