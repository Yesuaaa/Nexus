import { clientProjectScope } from "../projects/projects.service.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { readTransaction } from "../../lib/database-read.js"
import { activeAccount, activeStaff } from "../../shared/query/accounts.js"
import { PAGE_SIZE, pageWindow } from "../../shared/query/pagination.js"
import {
  canSubmitAgreement,
  closedRequestStatuses,
  financialWorkflowStates,
  isPublishedSentQuotation,
  terminalWorkflowStates,
} from "./workflow.eligibility.js"

type Action = {
  id: string
  requestId: string | null
  destination?: string
  reference: string | null
  service: string
  title: string
  reason: string
  deadline?: Date
}

export function listClientOutstandingActions(clientId: string, page: number) {
  return readTransaction(async (tx) => {
    const now = new Date()
    const actionableWorkflow: Prisma.RequestWorkflowWhereInput = {
      state: { notIn: [...terminalWorkflowStates, "ON_HOLD"] },
      OR: [
        { requirements: { some: { status: "REQUESTED" } } },
        {
          state: "CLIENT_APPROVAL",
          quotations: {
            some: {
              status: "SENT",
              publishedAt: { not: null },
              validUntil: { gt: now },
            },
          },
        },
        {
          state: { in: [...financialWorkflowStates] },
          OR: [
            {
              agreement: {
                is: {
                  status: "PENDING",
                  documentFile: { clientVisible: true },
                },
              },
            },
            {
              payment: {
                is: { status: "PENDING", mandatory: true, amount: { gt: 0 } },
              },
            },
          ],
        },
      ],
    }
    const records = await tx.serviceRequest.findMany({
      where: {
        clientId,
        client: { ...activeAccount, role: "USER" },
        OR: [
          { status: "AWAITING_CLIENT_INFO", workflow: null },
          {
            status: { notIn: [...closedRequestStatuses] },
            acceptedDepartment: { head: activeStaff },
            workflow: { is: actionableWorkflow },
          },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        referenceNumber: true,
        service: { select: { name: true } },
        meetings: {
          where: { meeting: { status: "COMPLETED" } },
          take: 1,
          select: { meetingId: true },
        },
        workflow: {
          select: {
            state: true,
            consultationRequired: true,
            quotationApprovalRequired: true,
            requirements: {
              where: { status: "REQUESTED" },
              orderBy: { id: "asc" },
              select: { id: true, title: true },
            },
            _count: {
              select: {
                requirements: {
                  where: { mandatory: true, status: { not: "COMPLETED" } },
                },
                consultations: { where: { status: "COMPLETED" } },
              },
            },
            quotations: {
              orderBy: { version: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                publishedAt: true,
                validUntil: true,
                internallyApprovedAt: true,
              },
            },
            agreement: {
              select: {
                id: true,
                status: true,
                documentFileId: true,
                documentFile: { select: { clientVisible: true } },
              },
            },
            payment: {
              select: { id: true, status: true, amount: true, mandatory: true },
            },
          },
        },
      },
    })
    const actions: Action[] = []
    for (const request of records) {
      const common = {
        requestId: request.id,
        reference: request.referenceNumber,
        service: request.service.name,
      }
      const workflow = request.workflow
      if (!workflow) {
        actions.push({
          ...common,
          id: `info:${request.id}`,
          title: "Provide the requested information",
          reason: "Your request is waiting for more information.",
        })
        continue
      }
      for (const item of workflow.requirements) {
        actions.push({
          ...common,
          id: `requirement:${item.id}`,
          title: "Provide the requested information",
          reason: item.title,
        })
      }
      const quote = workflow.quotations[0]
      if (
        workflow.state === "CLIENT_APPROVAL" &&
        quote &&
        isPublishedSentQuotation(quote) &&
        quote.validUntil > now &&
        (!workflow.quotationApprovalRequired || quote.internallyApprovedAt) &&
        !workflow._count.requirements &&
        (!workflow.consultationRequired ||
          workflow._count.consultations ||
          request.meetings.length)
      ) {
        actions.push({
          ...common,
          id: `quotation:${quote.id}`,
          title: "Review your quotation",
          reason:
            "Accept, decline, or request revisions to the latest quotation.",
          deadline: quote.validUntil,
        })
      }
      if (financialWorkflowStates.some((state) => state === workflow.state)) {
        const { agreement, payment } = workflow
        if (
          agreement?.documentFile?.clientVisible &&
          canSubmitAgreement(agreement)
        ) {
          actions.push({
            ...common,
            id: `agreement:${agreement.id}`,
            title: "Sign your agreement",
            reason: "Review the agreement and submit a signed copy.",
          })
        }
        if (
          payment?.status === "PENDING" &&
          payment.mandatory &&
          payment.amount.gt(0)
        ) {
          actions.push({
            ...common,
            id: `payment:${payment.id}`,
            title: "Complete your payment",
            reason: "Pay the outstanding balance or submit payment evidence.",
          })
        }
      }
    }
    const deliverables = await tx.projectMilestone.findMany({
      where: {
        project: {
          ...clientProjectScope(clientId),
          status: { not: "CANCELLED" },
        },
        deliveryStatus: "SENT_TO_CLIENT",
        workflowFile: {
          clientVisible: true,
          clientDeliverableReviews: { none: { clientId } },
        },
      },
      orderBy: [{ sentToClientAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        workflowFileId: true,
        project: { select: { id: true, name: true, requestId: true } },
      },
    })
    for (const deliverable of deliverables) {
      actions.push({
        id: "deliverable:" + deliverable.workflowFileId,
        requestId: deliverable.project.requestId,
        reference: null,
        service: deliverable.project.name,
        title: "Review your deliverable",
        reason: deliverable.title,
        destination:
          "/projects/" +
          encodeURIComponent(deliverable.project.id) +
          "/deliverables/" +
          encodeURIComponent(deliverable.id),
      })
    }
    const { skip, take } = pageWindow(page)
    return {
      actions: actions.slice(skip, skip + take),
      total: actions.length,
      page,
      pageSize: PAGE_SIZE,
    }
  })
}
