export type WorkflowState =
  | "PENDING_REVIEW"
  | "CONSULTATION"
  | "QUOTATION_PENDING"
  | "CLIENT_APPROVAL"
  | "AGREEMENT_PAYMENT_PENDING"
  | "READY_FOR_ACTIVATION"
  | "ACTIVE_PROJECT"
  | "DECLINED"
  | "CANCELLED"
  | "REVISION_REQUESTED"
  | "ON_HOLD"

export type WorkflowFile = {
  id: string
  name: string
  mimeType: string
  size: number
  uploaderId: string
  createdAt: string
}

export type WorkflowRequirement = {
  id: string
  title: string
  details: string | null
  mandatory: boolean
  status: "REQUESTED" | "SUBMITTED" | "COMPLETED"
  submission: string | null
  fileId: string | null
  reviewNote: string | null
  createdAt: string
}

export type WorkflowQuotation = {
  id: string
  version: number
  status:
    | "PENDING_INTERNAL"
    | "SENT"
    | "ACCEPTED"
    | "DECLINED"
    | "REVISION_REQUESTED"
    | "SUPERSEDED"
  scope: string
  deliverables: string[]
  lineItems: { description: string; quantity: number; unitPrice: string }[]
  total: string
  currency: string
  timeline: string
  paymentTerms: string
  paymentDue: string
  validUntil: string
  decisionNote: string | null
  createdAt: string
}

export type WorkflowEvent = {
  id: string
  type: string
  summary: string
  entityId: string | null
  createdAt: string
  actor: { id: string; fullName: string | null } | null
}

export type Workflow = {
  request: {
    id: string
    referenceNumber: string | null
    title: string
    serviceName: string
    packageName: string | null
    pricingModel: string | null
    goals: string
    requirements: string
    expectedTimeline: string
    client: { id: string; fullName: string | null }
    department: { id: string; name: string } | null
  }
  state: WorkflowState
  previousState: WorkflowState | null
  version: number
  nextAction: string
  consultationRequired: boolean
  quotationApprovalRequired: boolean
  permissions: {
    manage: boolean
    isClient: boolean
    approveQuotation: boolean
    verifyPayment: boolean
  }
  requirements: WorkflowRequirement[]
  files: WorkflowFile[]
  consultations: {
    id: string
    startsAt: string
    endsAt: string
    location: string
    notes: string | null
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
  }[]
  quotations: WorkflowQuotation[]
  approval: {
    quotationId: string
    amount: string
    currency: string
    approvedById: string
    approvedAt: string
  } | null
  agreement: {
    id: string
    mandatory: boolean
    status: "PENDING" | "SUBMITTED" | "APPROVED"
    documentFileId: string | null
    signedFileId: string | null
  } | null
  payment: {
    id: string
    mandatory: boolean
    amount: string
    currency: string
    status: "PENDING" | "SUBMITTED" | "VERIFIED"
    proofFileId: string | null
    reference: string | null
  } | null
  project: { id: string; name: string; status: string } | null
  events: WorkflowEvent[]
  internal?: {
    staff: {
      id: string
      fullName: string
      position: string | null
      status: string
      skills: string[]
      activeProjectCount: number
      assigned: boolean
    }[]
    approvers: { id: string; fullName: string | null }[]
    quotationApproverId: string | null
    paymentVerifierId: string | null
    events: WorkflowEvent[]
  }
}

export type WorkflowAction =
  | {
      type: "REQUEST_REQUIREMENT"
      title: string
      details: string
      mandatory: boolean
    }
  | {
      type: "SUBMIT_REQUIREMENT"
      requirementId: string
      submission: string
      fileId?: string
    }
  | {
      type: "REVIEW_REQUIREMENT"
      requirementId: string
      approve: boolean
      note: string
    }
  | {
      type: "SCHEDULE_CONSULTATION"
      startsAt: string
      endsAt: string
      location: string
      notes: string
    }
  | { type: "COMPLETE_CONSULTATION"; consultationId: string }
  | { type: "CANCEL_CONSULTATION"; consultationId: string }
  | { type: "PREPARE_QUOTATION" }
  | {
      type: "CREATE_QUOTATION"
      scope: string
      deliverables: string[]
      lineItems: { description: string; quantity: number; unitPrice: string }[]
      currency: string
      timeline: string
      paymentTerms: string
      paymentDue: string
      validUntil: string
    }
  | { type: "FIXED_QUOTATION" }
  | { type: "APPROVE_QUOTATION"; quotationId: string }
  | {
      type: "RESPOND_QUOTATION"
      quotationId: string
      decision: "ACCEPT" | "DECLINE" | "REVISE"
      note: string
    }
  | { type: "ATTACH_AGREEMENT"; fileId: string }
  | { type: "SIGN_AGREEMENT"; fileId: string }
  | { type: "REVIEW_AGREEMENT"; approve: boolean; note: string }
  | { type: "SUBMIT_PAYMENT"; fileId: string; reference: string }
  | { type: "VERIFY_PAYMENT"; approve: boolean; note: string }
  | {
      type: "ASSIGN_APPROVERS"
      quotationApproverId: string | null
      paymentVerifierId: string | null
    }
  | { type: "STAFF_PROJECT"; employeeIds: string[] }
  | { type: "ACTIVATE_PROJECT" }
  | { type: "HOLD" | "RESUME" | "CANCEL"; note: string }
  | { type: "INTERNAL_NOTE"; note: string }
