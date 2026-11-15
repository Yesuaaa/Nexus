import type {
  Workflow,
  WorkflowEvent,
  WorkflowRequirement,
  WorkflowQuotation,
} from "./workflow"

type Person = { id: string; fullName: string | null }
export type AdministrativeWorkflow = Pick<
  Workflow,
  | "state"
  | "previousState"
  | "version"
  | "nextAction"
  | "consultationRequired"
  | "consultationComplete"
  | "quotationApprovalRequired"
  | "paymentRequired"
  | "permissions"
> & {
  createdAt: string | null
  updatedAt: string | null
  capabilities: {
    read: boolean
    mutateWorkflow: false
    participate: false
    downloadFiles: false
    activateProject: false
  }
  quotationApprover: Person | null
  paymentVerifier: Person | null
  requirements: (Pick<
    WorkflowRequirement,
    "id" | "title" | "status" | "mandatory" | "createdAt"
  > & { updatedAt: string })[]
  consultations: (Pick<
    Workflow["consultations"][number],
    "id" | "status" | "startsAt" | "endsAt"
  > & { createdAt: string })[]
  meetings: (Pick<
    Workflow["consultations"][number],
    "id" | "status" | "startsAt" | "endsAt"
  > & {
    createdAt: string
    updatedAt: string
    proposedStartsAt: string | null
  })[]
  quotations: (Pick<
    WorkflowQuotation,
    "id" | "version" | "status" | "createdAt" | "validUntil"
  > & { publishedAt: string | null; internallyApprovedAt: string | null })[]
  approval: {
    quotationId: string
    approvedAt: string
    approvedBy: Person
  } | null
  agreement: {
    mandatory: boolean
    status: string
    reviewedAt: string | null
  } | null
  payment: {
    mandatory: boolean
    status: string
    verifiedAt: string | null
  } | null
  project: {
    id: string
    name: string
    status: string
    startDate: string | null
    createdAt: string
    staff: {
      employee: { id: string; fullName: string; position: string | null }
      isTeamLead: boolean
      approvedAt: string
      weeklyHours: number | null
      allocationStart: string | null
      allocationEnd: string | null
    }[]
  } | null
  events: (WorkflowEvent & { internal: boolean })[]
}
