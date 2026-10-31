import { createHash } from "node:crypto"
import type { RequestWorkflowState } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  appendEvent,
  lockRequest,
  workflowAccess,
  type WorkflowTx,
} from "./workflow.access.js"
import { snapshot } from "./workflow.snapshot.js"
import {
  amount,
  cents,
  fail,
  parseAction,
  type WorkflowCommand,
} from "./workflow.validation.js"

const terminal = ["CANCELLED", "DECLINED", "ACTIVE_PROJECT"] as const
const consultationStates: readonly RequestWorkflowState[] = [
  "CONSULTATION",
  "QUOTATION_PENDING",
  "CLIENT_APPROVAL",
  "REVISION_REQUESTED",
]

async function requireConsultationComplete(
  tx: WorkflowTx,
  requestId: string,
  consultationRequired: boolean,
) {
  if (
    await tx.workflowRequirement.count({
      where: { requestId, mandatory: true, status: { not: "COMPLETED" } },
    })
  )
    fail("Complete all mandatory requirements before sending a quotation", 409)
  if (
    consultationRequired &&
    !(await tx.workflowConsultation.count({
      where: { requestId, status: "COMPLETED" },
    }))
  )
    fail("Complete the required consultation before sending a quotation", 409)
}

async function refreshReadiness(
  tx: WorkflowTx,
  requestId: string,
  actorId: string,
) {
  const workflow = await tx.requestWorkflow.findUniqueOrThrow({
    where: { requestId },
    include: { approval: true, agreement: true, payment: true },
  })
  if (
    !workflow.approval ||
    workflow.state === "ON_HOLD" ||
    terminal.some((state) => state === workflow.state)
  )
    return
  const outstanding = await tx.workflowRequirement.count({
    where: { requestId, mandatory: true, status: { not: "COMPLETED" } },
  })
  const ready =
    !outstanding &&
    (!workflow.agreementRequired ||
      workflow.agreement?.status === "APPROVED") &&
    (!workflow.paymentRequired || workflow.payment?.status === "VERIFIED")
  const nextState = ready ? "READY_FOR_ACTIVATION" : "AGREEMENT_PAYMENT_PENDING"
  if (workflow.state !== nextState) {
    await tx.requestWorkflow.update({
      where: { requestId },
      data: { state: nextState },
    })
    if (ready)
      await appendEvent(
        tx,
        requestId,
        actorId,
        "COMMENCEMENT_READY",
        "All mandatory commencement requirements are complete. The department head can approve staffing and activate the project.",
      )
  }
}

async function runAction(
  tx: WorkflowTx,
  userId: string,
  requestId: string,
  command: WorkflowCommand,
) {
  const { request, permissions } = await workflowAccess(tx, userId, requestId)
  const workflow = request.workflow
  if (!workflow) fail("Accept this request for consultation first", 409)
  const state = workflow.state
  const requireManager = () => {
    if (!permissions.manage)
      fail("Only the assigned department head can perform this action", 403)
  }
  const requireClient = () => {
    if (!permissions.isClient)
      fail("Only the owning client can perform this action", 403)
  }
  const requireStage = (...states: RequestWorkflowState[]) => {
    if (!states.includes(state))
      fail("This action is not available at the current workflow stage", 409)
  }
  const setState = (nextState: RequestWorkflowState) =>
    tx.requestWorkflow.update({
      where: { requestId },
      data: { state: nextState },
    })
  const event = (
    type: string,
    summary: string,
    entityId: string | null = null,
    internal = false,
  ) => appendEvent(tx, requestId, userId, type, summary, entityId, internal)
  async function file(fileId: string, own = false) {
    const record = await tx.workflowFile.findFirst({
      where: { id: fileId, requestId, ...(own ? { uploaderId: userId } : {}) },
      select: { id: true },
    })
    if (!record)
      fail(
        "Select a file uploaded to this request by the appropriate account",
        404,
      )
    return record.id
  }
  if (terminal.some((value) => value === state))
    fail(
      "This workflow has ended or the project has already been activated",
      409,
    )
  if (
    state === "ON_HOLD" &&
    !["RESUME", "CANCEL", "INTERNAL_NOTE", "ASSIGN_APPROVERS"].includes(
      command.type,
    )
  )
    fail("Resume this workflow before making changes", 409)
  // Neither a manager nor an approver can process an inactive client's decision.
  if (
    !request.client.isActive ||
    request.client.accountDeletedAt ||
    request.client.role !== "USER"
  )
    fail("The client account is unavailable", 409)
  const head = request.acceptedDepartment?.head
  if (!head?.isActive || head.accountDeletedAt || head.role !== "STAFF")
    fail("An active department head must be assigned before continuing", 409)
  if (request.status === "CANCELLED" || request.status === "CLOSED")
    fail("This service request is closed", 409)

  switch (command.type) {
    case "REQUEST_REQUIREMENT": {
      requireManager()
      requireStage(
        ...consultationStates,
        "AGREEMENT_PAYMENT_PENDING",
        "READY_FOR_ACTIVATION",
      )
      const requirement = await tx.workflowRequirement.create({
        data: {
          requestId,
          title: command.title,
          details: command.details || null,
          mandatory: command.mandatory,
        },
      })
      if (consultationStates.includes(state)) {
        // New consultation requirements invalidate every outstanding proposal.
        await tx.workflowQuotation.updateMany({
          where: { requestId, status: { in: ["SENT", "PENDING_INTERNAL"] } },
          data: { status: "SUPERSEDED" },
        })
        await setState("CONSULTATION")
      }
      await event(
        "REQUIREMENT_REQUESTED",
        `Additional information requested: ${command.title}`,
        requirement.id,
      )
      break
    }
    case "SUBMIT_REQUIREMENT": {
      requireClient()
      const requirement = await tx.workflowRequirement.findFirst({
        where: { id: command.requirementId, requestId },
      })
      if (!requirement) fail("Requirement not found", 404)
      if (requirement.status === "COMPLETED")
        fail("This requirement is already complete", 409)
      await tx.workflowRequirement.update({
        where: { id: requirement.id },
        data: {
          submission: command.submission || null,
          fileId: command.fileId ? await file(command.fileId, true) : null,
          status: "SUBMITTED",
          reviewNote: null,
        },
      })
      await event(
        "REQUIREMENT_SUBMITTED",
        `Submitted for review: ${requirement.title}`,
        requirement.id,
      )
      break
    }
    case "REVIEW_REQUIREMENT": {
      requireManager()
      const requirement = await tx.workflowRequirement.findFirst({
        where: { id: command.requirementId, requestId, status: "SUBMITTED" },
      })
      if (!requirement) fail("No pending submission to review", 409)
      await tx.workflowRequirement.update({
        where: { id: requirement.id },
        data: {
          status: command.approve ? "COMPLETED" : "REQUESTED",
          reviewNote: command.note || null,
        },
      })
      await event(
        "REQUIREMENT_REVIEWED",
        `${command.approve ? "Completed" : "Changes requested"}: ${requirement.title}${command.note ? `. ${command.note}` : ""}`,
        requirement.id,
      )
      break
    }
    case "SCHEDULE_CONSULTATION": {
      requireManager()
      requireStage(...consultationStates)
      const startsAt = new Date(command.startsAt),
        endsAt = new Date(command.endsAt)
      if (
        startsAt <= new Date() ||
        endsAt <= startsAt ||
        endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000
      )
        fail("Schedule a future consultation lasting at most eight hours")
      const consultation = await tx.workflowConsultation.create({
        data: {
          requestId,
          startsAt,
          endsAt,
          location: command.location,
          notes: command.notes || null,
        },
      })
      await event(
        "CONSULTATION_SCHEDULED",
        "A consultation has been scheduled.",
        consultation.id,
      )
      break
    }
    case "COMPLETE_CONSULTATION":
    case "CANCEL_CONSULTATION": {
      requireManager()
      requireStage(...consultationStates)
      const consultation = await tx.workflowConsultation.findFirst({
        where: { id: command.consultationId, requestId, status: "SCHEDULED" },
      })
      if (!consultation) fail("Scheduled consultation not found", 409)
      const completed = command.type === "COMPLETE_CONSULTATION"
      if (completed && consultation.startsAt > new Date())
        fail("A future consultation cannot be marked complete", 409)
      await tx.workflowConsultation.update({
        where: { id: consultation.id },
        data: { status: completed ? "COMPLETED" : "CANCELLED" },
      })
      await event(
        completed ? "CONSULTATION_COMPLETED" : "CONSULTATION_CANCELLED",
        completed
          ? "Consultation completed."
          : "Consultation cancelled. The department head can schedule another session.",
        consultation.id,
      )
      break
    }
    case "PREPARE_QUOTATION":
      requireManager()
      requireStage("CONSULTATION", "REVISION_REQUESTED", "QUOTATION_PENDING")
      await requireConsultationComplete(
        tx,
        requestId,
        workflow.consultationRequired,
      )
      await setState("QUOTATION_PENDING")
      await event(
        "QUOTATION_PREPARATION",
        "Consultation requirements are complete. A quotation is being prepared.",
      )
      break
    case "FIXED_QUOTATION":
    case "CREATE_QUOTATION": {
      requireManager()
      requireStage(...consultationStates)
      if (await tx.workflowApproval.count({ where: { requestId } }))
        fail("The accepted quotation is immutable", 409)
      await requireConsultationComplete(
        tx,
        requestId,
        workflow.consultationRequired,
      )
      let input
      if (command.type === "FIXED_QUOTATION") {
        if (request.pricingModel !== "FIXED" || request.agreedPrice === null)
          fail(
            "Only a fixed-price booking with a captured price can use package pricing",
            409,
          )
        const price = request.agreedPrice.toFixed(2)
        input = {
          scope:
            request.projectRequirements || request.description || request.title,
          deliverables: [request.packageName || request.title],
          lineItems: [
            {
              description: request.packageName || request.title,
              quantity: 1,
              unitPrice: price,
            },
          ],
          currency: request.currency || "PHP",
          timeline:
            request.expectedTimeline ||
            "To be coordinated after project activation",
          paymentTerms:
            "Full payment before project activation. Manual verification is required.",
          paymentDue: workflow.paymentRequired ? price : "0.00",
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        }
      } else input = { ...command, validUntil: new Date(command.validUntil) }
      if (
        input.validUntil <= new Date() ||
        input.validUntil.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000
      )
        fail("Quotation validity must be within the next year")
      const total = amount(
        input.lineItems.reduce(
          (sum, item) => sum + cents(item.unitPrice) * BigInt(item.quantity),
          0n,
        ),
      )
      if (
        cents(input.paymentDue) > cents(total) ||
        (workflow.paymentRequired && cents(input.paymentDue) === 0n)
      )
        fail(
          "The commencement payment must be positive when required and cannot exceed the quotation total",
        )
      if (workflow.quotationApprovalRequired && !workflow.quotationApproverId)
        fail("Assign an authorized quotation approver first", 409)
      const latest = await tx.workflowQuotation.findFirst({
        where: { requestId },
        orderBy: { version: "desc" },
        select: { version: true },
      })
      await tx.workflowQuotation.updateMany({
        where: { requestId, status: { in: ["SENT", "PENDING_INTERNAL"] } },
        data: { status: "SUPERSEDED" },
      })
      const pending = workflow.quotationApprovalRequired
      const quote = await tx.workflowQuotation.create({
        data: {
          requestId,
          version: (latest?.version ?? 0) + 1,
          status: pending ? "PENDING_INTERNAL" : "SENT",
          scope: input.scope,
          deliverables: input.deliverables,
          lineItems: input.lineItems,
          total,
          currency: input.currency,
          timeline: input.timeline,
          paymentTerms: input.paymentTerms,
          paymentDue: input.paymentDue,
          validUntil: input.validUntil,
          createdById: userId,
          publishedAt: pending ? null : new Date(),
        },
      })
      await setState(pending ? "QUOTATION_PENDING" : "CLIENT_APPROVAL")
      await event(
        pending ? "QUOTATION_INTERNAL_REVIEW" : "QUOTATION_SENT",
        pending
          ? `Quotation v${quote.version} requires the assigned approver's review.`
          : `Quotation v${quote.version} is ready for the client's formal decision.`,
        quote.id,
        pending,
      )
      break
    }
    case "APPROVE_QUOTATION": {
      if (!permissions.approveQuotation)
        fail(
          "Only the explicitly assigned quotation approver can approve this quotation",
          403,
        )
      requireStage("QUOTATION_PENDING")
      const latest = await tx.workflowQuotation.findFirst({
        where: { requestId },
        orderBy: { version: "desc" },
      })
      if (
        !latest ||
        latest.id !== command.quotationId ||
        latest.status !== "PENDING_INTERNAL"
      )
        fail("Only the latest pending quotation can be approved", 409)
      if (latest.validUntil <= new Date())
        fail("This quotation has expired", 409)
      await tx.workflowQuotation.update({
        where: { id: latest.id },
        data: {
          status: "SENT",
          internallyApprovedById: userId,
          internallyApprovedAt: new Date(),
          publishedAt: new Date(),
        },
      })
      await setState("CLIENT_APPROVAL")
      await event(
        "QUOTATION_SENT",
        `Quotation v${latest.version} is ready for the client's formal decision.`,
        latest.id,
      )
      await event(
        "QUOTATION_INTERNAL_APPROVED",
        `Quotation v${latest.version} received internal approval.`,
        latest.id,
        true,
      )
      break
    }
    case "RESPOND_QUOTATION": {
      requireClient()
      requireStage("CLIENT_APPROVAL")
      const quote = await tx.workflowQuotation.findFirst({
        where: { requestId },
        orderBy: { version: "desc" },
      })
      if (
        !quote ||
        quote.id !== command.quotationId ||
        quote.status !== "SENT" ||
        !quote.publishedAt
      )
        fail("Only the latest valid quotation can receive a decision", 409)
      if (quote.validUntil <= new Date())
        fail(
          "This quotation has expired. Ask the department head for a new version.",
          409,
        )
      if (workflow.quotationApprovalRequired && !quote.internallyApprovedAt)
        fail("Internal quotation approval is required", 409)
      await requireConsultationComplete(
        tx,
        requestId,
        workflow.consultationRequired,
      )
      const status =
        command.decision === "ACCEPT"
          ? "ACCEPTED"
          : command.decision === "DECLINE"
            ? "DECLINED"
            : "REVISION_REQUESTED"
      await tx.workflowQuotation.update({
        where: { id: quote.id },
        data: { status, decisionNote: command.note || null },
      })
      if (command.decision !== "ACCEPT") {
        await setState(
          command.decision === "DECLINE" ? "DECLINED" : "REVISION_REQUESTED",
        )
        if (command.decision === "DECLINE")
          await tx.serviceRequest.update({
            where: { id: requestId },
            data: { status: "CLOSED" },
          })
        await event(
          `QUOTATION_${status}`,
          `The client ${command.decision === "DECLINE" ? "declined" : "requested revisions to"} quotation v${quote.version}.${command.note ? ` ${command.note}` : ""}`,
          quote.id,
        )
        break
      }
      // Formal acceptance, immutable approval, payment checklist and draft project
      // are committed atomically; ordinary messages cannot reach this operation.
      const approval = await tx.workflowApproval.create({
        data: {
          requestId,
          quotationId: quote.id,
          amount: quote.total,
          currency: quote.currency,
          approvedById: userId,
        },
      })
      const agreement = await tx.workflowAgreement.create({
        data: { requestId, mandatory: workflow.agreementRequired },
      })
      const payment = await tx.workflowPayment.create({
        data: {
          requestId,
          mandatory: workflow.paymentRequired,
          amount: quote.paymentDue,
          currency: quote.currency,
        },
      })
      await tx.project.create({
        data: {
          requestId,
          quotationId: quote.id,
          clientId: request.clientId,
          name: request.title,
          description: quote.scope,
          status: "PLANNED",
          milestones: {
            create: quote.deliverables.map((title, index) => ({
              title,
              displayOrder: index,
            })),
          },
        },
      })
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          quotedPrice: quote.total,
          agreedPrice: quote.total,
          currency: quote.currency,
        },
      })
      await setState("AGREEMENT_PAYMENT_PENDING")
      await event(
        "APPROVAL_CONFIRMED",
        `The client formally accepted quotation v${quote.version} for ${quote.currency} ${quote.total.toFixed(2)}. Agreement and payment requirements are now available.`,
        approval.id,
      )
      await event(
        "AGREEMENT_CREATED",
        workflow.agreementRequired
          ? "A signed agreement is required before commencement."
          : "An optional agreement checklist is available.",
        agreement.id,
      )
      await event(
        "PAYMENT_CREATED",
        workflow.paymentRequired
          ? "Submit payment evidence for manual verification before commencement."
          : "No mandatory commencement payment is required.",
        payment.id,
      )
      break
    }
    case "ATTACH_AGREEMENT": {
      if (!permissions.manage && !permissions.verifyPayment)
        fail("Agreement management requires an assigned authorization", 403)
      requireStage("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")
      const agreement = await tx.workflowAgreement.findUnique({
        where: { requestId },
      })
      if (!agreement || agreement.status !== "PENDING")
        fail("The agreement is already submitted or approved", 409)
      const documentFileId = await file(command.fileId, true)
      await tx.workflowFile.update({
        where: { id: documentFileId },
        data: { clientVisible: true },
      })
      await tx.workflowAgreement.update({
        where: { requestId },
        data: { documentFileId },
      })
      await event(
        "AGREEMENT_ATTACHED",
        "The agreement document is ready for the client's signature.",
        agreement.id,
      )
      break
    }
    case "SIGN_AGREEMENT": {
      requireClient()
      requireStage("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")
      const agreement = await tx.workflowAgreement.findUnique({
        where: { requestId },
      })
      if (!agreement?.documentFileId || agreement.status !== "PENDING")
        fail(
          "An agreement document must be available before submitting the signed copy",
          409,
        )
      await tx.workflowAgreement.update({
        where: { requestId },
        data: {
          signedFileId: await file(command.fileId, true),
          status: "SUBMITTED",
        },
      })
      await event(
        "AGREEMENT_SUBMITTED",
        "The client submitted the signed agreement for review.",
        agreement.id,
      )
      break
    }
    case "REVIEW_AGREEMENT": {
      requireManager()
      requireStage("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")
      const agreement = await tx.workflowAgreement.findUnique({
        where: { requestId },
      })
      if (!agreement || agreement.status !== "SUBMITTED")
        fail("No signed agreement is awaiting review", 409)
      await tx.workflowAgreement.update({
        where: { requestId },
        data: {
          status: command.approve ? "APPROVED" : "PENDING",
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      })
      await event(
        "AGREEMENT_REVIEWED",
        `${command.approve ? "Agreement approved." : "A revised signed agreement is required."}${command.note ? ` ${command.note}` : ""}`,
        agreement.id,
      )
      break
    }
    case "SUBMIT_PAYMENT": {
      requireClient()
      requireStage("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")
      const payment = await tx.workflowPayment.findUnique({
        where: { requestId },
      })
      if (!payment || payment.status === "VERIFIED")
        fail("Payment is already verified or unavailable", 409)
      await tx.workflowPayment.update({
        where: { requestId },
        data: {
          proofFileId: await file(command.fileId, true),
          reference: command.reference,
          status: "SUBMITTED",
        },
      })
      await event(
        "PAYMENT_SUBMITTED",
        "Payment evidence was submitted for manual verification.",
        payment.id,
      )
      break
    }
    case "VERIFY_PAYMENT": {
      if (!permissions.verifyPayment)
        fail(
          "Only the explicitly assigned payment verifier can verify payment",
          403,
        )
      requireStage("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")
      const payment = await tx.workflowPayment.findUnique({
        where: { requestId },
      })
      if (!payment || payment.status !== "SUBMITTED")
        fail("No payment is awaiting verification", 409)
      await tx.workflowPayment.update({
        where: { requestId },
        data: {
          status: command.approve ? "VERIFIED" : "PENDING",
          verifiedById: userId,
          verifiedAt: new Date(),
        },
      })
      await event(
        "PAYMENT_VERIFIED",
        command.approve
          ? "Payment was manually verified by the assigned approver."
          : "Payment evidence needs to be resubmitted.",
        payment.id,
      )
      if (command.note)
        await event("PAYMENT_INTERNAL_REVIEW", command.note, payment.id, true)
      break
    }
    case "ASSIGN_APPROVERS": {
      requireManager()
      const ids = [
        ...new Set(
          [command.quotationApproverId, command.paymentVerifierId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ]
      const count = await tx.user.count({
        where: {
          id: { in: ids },
          role: { in: ["ADMIN", "SUPERADMIN"] },
          isActive: true,
          accountDeletedAt: null,
        },
      })
      if (count !== ids.length)
        fail("Select active authorized approver accounts")
      if (
        workflow.quotationApprovalRequired &&
        !command.quotationApproverId &&
        (await tx.workflowQuotation.count({
          where: { requestId, status: "PENDING_INTERNAL" },
        }))
      )
        fail("A pending quotation must retain an assigned approver", 409)
      await tx.requestWorkflow.update({
        where: { requestId },
        data: {
          quotationApproverId: command.quotationApproverId,
          paymentVerifierId: command.paymentVerifierId,
        },
      })
      await event(
        "APPROVERS_ASSIGNED",
        `Financial approval assignments updated. Quotation approver: ${command.quotationApproverId ?? "unassigned"}. Payment verifier: ${command.paymentVerifierId ?? "unassigned"}.`,
        null,
        true,
      )
      break
    }
    case "STAFF_PROJECT": {
      requireManager()
      requireStage("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")
      const project = await tx.project.findUnique({ where: { requestId } })
      if (!project || project.status !== "PLANNED")
        fail("No project draft is available", 409)
      const eligible = await tx.employee.findMany({
        where: {
          id: { in: command.employeeIds },
          departmentId: request.acceptedDepartmentId,
          status: "ACTIVE",
          user: { role: "STAFF", isActive: true, accountDeletedAt: null },
        },
        select: { id: true },
      })
      if (eligible.length !== command.employeeIds.length)
        fail("Select active staff from the responsible department", 409)
      await tx.projectStaff.deleteMany({ where: { projectId: project.id } })
      await tx.projectStaff.createMany({
        data: eligible.map((employee) => ({
          projectId: project.id,
          employeeId: employee.id,
          approvedById: userId,
        })),
      })
      await event(
        "STAFFING_APPROVED",
        `The department head approved project staffing. Employee records: ${eligible.map((employee) => employee.id).join(", ")}.`,
        project.id,
        true,
      )
      break
    }
    case "ACTIVATE_PROJECT": {
      requireManager()
      requireStage("READY_FOR_ACTIVATION")
      await requireConsultationComplete(
        tx,
        requestId,
        workflow.consultationRequired,
      )
      const [approval, agreement, payment, project] = await Promise.all([
        tx.workflowApproval.findUnique({ where: { requestId } }),
        tx.workflowAgreement.findUnique({ where: { requestId } }),
        tx.workflowPayment.findUnique({ where: { requestId } }),
        tx.project.findUnique({
          where: { requestId },
          include: {
            staff: { include: { employee: { include: { user: true } } } },
          },
        }),
      ])
      if (!approval || !project || project.quotationId !== approval.quotationId)
        fail(
          "A formally accepted quotation and matching draft project are required",
          409,
        )
      if (
        (workflow.agreementRequired && agreement?.status !== "APPROVED") ||
        (workflow.paymentRequired && payment?.status !== "VERIFIED")
      )
        fail(
          "All mandatory agreement and payment requirements must be completed",
          409,
        )
      if (
        !project.staff.length ||
        project.staff.some(
          ({ employee }) =>
            employee.status !== "ACTIVE" ||
            employee.departmentId !== request.acceptedDepartmentId ||
            employee.user?.role !== "STAFF" ||
            !employee.user.isActive ||
            employee.user.accountDeletedAt,
        )
      )
        fail("Approve eligible department staffing before activation", 409)
      const activated = await tx.project.updateMany({
        where: { id: project.id, status: "PLANNED" },
        data: { status: "IN_PROGRESS", startDate: new Date() },
      })
      if (activated.count !== 1)
        fail("This project has already been activated", 409)
      await setState("ACTIVE_PROJECT")
      await event(
        "PROJECT_ACTIVATED",
        "Your project is active. Open the project workspace to view deliverables and progress.",
        project.id,
      )
      break
    }
    case "HOLD":
      requireManager()
      if (state === "ON_HOLD") fail("This workflow is already on hold", 409)
      await tx.requestWorkflow.update({
        where: { requestId },
        data: { previousState: state, state: "ON_HOLD" },
      })
      await event(
        "WORKFLOW_ON_HOLD",
        `Workflow placed on hold. ${command.note}`,
      )
      break
    case "RESUME":
      requireManager()
      requireStage("ON_HOLD")
      await tx.requestWorkflow.update({
        where: { requestId },
        data: {
          state: workflow.previousState ?? "CONSULTATION",
          previousState: null,
        },
      })
      await event(
        "WORKFLOW_RESUMED",
        "The department head resumed this workflow.",
      )
      break
    case "CANCEL":
      if (!permissions.isClient && !permissions.manage)
        fail("Only a participant can cancel this workflow", 403)
      await setState("CANCELLED")
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      })
      await tx.project.updateMany({
        where: { requestId, status: "PLANNED" },
        data: { status: "CANCELLED" },
      })
      await event("WORKFLOW_CANCELLED", `Workflow cancelled. ${command.note}`)
      break
    case "INTERNAL_NOTE":
      requireManager()
      await event("INTERNAL_NOTE", command.note, null, true)
      break
  }
  await refreshReadiness(tx, requestId, userId)
}

export async function actOnWorkflow(
  userId: string,
  requestId: string,
  input: unknown,
) {
  const { actionId, expectedVersion, command } = parseAction(input)
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex")
  return getPrisma()!.$transaction(
    async (tx) => {
      await lockRequest(tx, requestId)
      const { request } = await workflowAccess(tx, userId, requestId)
      const existing = await tx.workflowActionReceipt.findUnique({
        where: {
          requestId_actorId_actionId: { requestId, actorId: userId, actionId },
        },
      })
      if (existing) {
        if (existing.payloadHash !== payloadHash)
          fail("This action ID was already used for different input", 409)
        return snapshot(tx, userId, requestId)
      }
      if (!request.workflow || request.workflow.version !== expectedVersion)
        fail(
          "The workflow changed. Review the latest state and try again.",
          409,
        )
      await runAction(tx, userId, requestId, command)
      await tx.requestWorkflow.update({
        where: { requestId },
        data: { version: { increment: 1 } },
      })
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: { updatedAt: new Date() },
      })
      await tx.workflowActionReceipt.create({
        data: { requestId, actorId: userId, actionId, payloadHash },
      })
      return snapshot(tx, userId, requestId)
    },
    { timeout: 20_000 },
  )
}
