import { EmptyState } from "@/components/ui/empty-state"
import {
  DetailItem,
  DetailList,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import type { AdministrativeRequest } from "@/features/request-inbox/api/administrative-requests-api"
import type { AdministrativeWorkflow } from "../model/administrative-workflow"
import {
  WorkflowBadge,
  WorkflowProgress,
  type WorkflowProgressEntry,
} from "./workflow-primitives"

type AdministrativeRequestSummary = Pick<
  AdministrativeRequest,
  "id" | "createdAt" | "status" | "client" | "acceptedDepartment" | "service"
>

function eventStage(type: string) {
  const normalized = type.toLocaleUpperCase()
  if (normalized.startsWith("DEPARTMENT_")) return "Department review"
  if (normalized.startsWith("CONSULTATION_")) return "Consultation"
  if (normalized.startsWith("REQUIREMENT_")) return "Requirements"
  if (normalized.startsWith("QUOTATION_")) return "Quotation"
  if (normalized.startsWith("APPROVAL_")) return "Approval"
  if (normalized.startsWith("AGREEMENT_")) return "Agreement"
  if (normalized.startsWith("PAYMENT_")) return "Payment"
  if (
    normalized.startsWith("STAFFING_") ||
    normalized.startsWith("PROJECT_") ||
    normalized === "COMMENCEMENT_READY"
  )
    return "Project activation"
  if (normalized.startsWith("REQUEST_")) return "Request"
  return "Workflow"
}

/** Metadata-only rendering: no workflow hooks, participant controls or files. */
export function AdministrativeWorkflowProgress({
  workflow,
  request,
}: {
  workflow: AdministrativeWorkflow
  request: AdministrativeRequestSummary
}) {
  const { formatDateTime } = useDatePreferences()
  if (!workflow.capabilities.read)
    return (
      <EmptyState
        role="status"
        size="sm"
        title="Workflow details are not available."
      />
    )

  const date = (value: string | null | undefined) =>
    value ? formatDateTime(value) : "Not recorded"
  const currentPerson =
    workflow.state === "QUOTATION_PENDING"
      ? workflow.quotationApprover?.fullName
      : workflow.state === "AGREEMENT_PAYMENT_PENDING"
        ? workflow.paymentVerifier?.fullName
        : null
  const responsibleDepartment =
    request.acceptedDepartment?.name ??
    (request.status === "SUBMITTED" ? "Not yet accepted" : "Not available")
  const timeline: WorkflowProgressEntry[] = [
    {
      id: `request-${request.id}`,
      stage: "Request",
      status: "RECORDED",
      summary: "Request submitted",
      createdAt: request.createdAt,
      actor: request.client.fullName || "Client",
      internal: false,
    },
    ...workflow.events.map((event) => ({
      id: event.id,
      stage: eventStage(event.type),
      status: "RECORDED",
      summary: event.summary,
      createdAt: event.createdAt,
      actor: event.actor?.fullName || "System",
      internal: event.internal,
    })),
  ]

  return (
    <div className="grid gap-5">
      <SidePanelSection title="Current workflow">
        <DetailList>
          <DetailItem label="Current stage and status">
            <WorkflowBadge value={workflow.state} />
          </DetailItem>
          <DetailItem label="Responsible department">
            {responsibleDepartment}
          </DetailItem>
          <DetailItem label="Current responsible person">
            {currentPerson || "Not recorded"}
          </DetailItem>
          <DetailItem label="Last workflow update">
            {date(workflow.updatedAt)}
          </DetailItem>
          {workflow.previousState && (
            <DetailItem label="Previous stage">
              <WorkflowBadge value={workflow.previousState} />
            </DetailItem>
          )}
        </DetailList>
      </SidePanelSection>
      <SidePanelSection title="Next action">
        <p className="m-0 text-xs leading-5 text-[#52627a]">
          {workflow.nextAction}
        </p>
      </SidePanelSection>
      <SidePanelSection title="Workflow history">
        <p className="m-0 text-[11px] text-[#65718a]">
          Recorded progress timeline · Oldest first
        </p>
        {timeline.length ? (
          <WorkflowProgress
            entries={timeline}
            formatDateTime={formatDateTime}
          />
        ) : null}
        {!workflow.events.length && (
          <EmptyState
            size="sm"
            title="No workflow events recorded."
            description="The submission date is available, but no other history appears in the inspection record."
          />
        )}
        <p className="m-0 text-[10px] leading-4 text-[#65718a]">
          History is limited to sanitized events. Private remarks and
          attachments are not included.
        </p>
      </SidePanelSection>
    </div>
  )
}

/** Full read-only records, separate from the workflow's summary and history. */
export function AdministrativeWorkflowRecords({
  workflow,
}: {
  workflow: AdministrativeWorkflow
}) {
  const { formatDateTime } = useDatePreferences()
  if (!workflow.capabilities.read)
    return (
      <EmptyState
        role="status"
        size="sm"
        title="Workflow records are not available."
      />
    )

  const date = (value: string | null | undefined) =>
    value ? formatDateTime(value) : "Not recorded"
  const quotations = [...workflow.quotations].sort(
    (first, second) => second.version - first.version,
  )

  return (
    <div className="grid gap-5">
      <SidePanelSection title="Consultation">
        {workflow.consultations.length || workflow.meetings.length ? (
          <div className="grid divide-y divide-[#eceef1]">
            {workflow.consultations.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 first:pt-0">
                <WorkflowBadge value={item.status} />
                <DetailList>
                  <DetailItem label="Scheduled">
                    {date(item.startsAt)} – {date(item.endsAt)}
                  </DetailItem>
                  <DetailItem label="Recorded">
                    {date(item.createdAt)}
                  </DetailItem>
                </DetailList>
              </div>
            ))}
            {workflow.meetings.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 last:pb-0">
                <p className="m-0 text-xs font-medium">
                  Linked service meeting
                </p>
                <WorkflowBadge value={item.status} />
                <DetailList>
                  <DetailItem label="Scheduled">
                    {date(item.startsAt)} – {date(item.endsAt)}
                  </DetailItem>
                  <DetailItem label="Last updated">
                    {date(item.updatedAt)}
                  </DetailItem>
                  {item.proposedStartsAt && (
                    <DetailItem label="Pending reschedule proposal">
                      {date(item.proposedStartsAt)}. The confirmed schedule
                      remains in effect.
                    </DetailItem>
                  )}
                </DetailList>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            size="sm"
            title={
              !workflow.consultationRequired
                ? "Consultation is not required."
                : workflow.consultationComplete
                  ? "Consultation completion is recorded; no details are available."
                  : "No consultation records yet."
            }
          />
        )}
      </SidePanelSection>

      <SidePanelSection title="Requirements">
        {workflow.requirements.length ? (
          <div className="grid divide-y divide-[#eceef1]">
            {workflow.requirements.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs font-medium [overflow-wrap:anywhere]">
                    {item.title}
                  </p>
                  <WorkflowBadge value={item.status} checklist />
                </div>
                <p className="m-0 text-[11px] text-[#65718a]">
                  {item.mandatory ? "Mandatory" : "Optional"} · Requested{" "}
                  {date(item.createdAt)} · Updated {date(item.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState size="sm" title="No requirements recorded." />
        )}
      </SidePanelSection>

      <SidePanelSection title="Quotations">
        {quotations.length ? (
          <div className="grid divide-y divide-[#eceef1]">
            {quotations.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs font-medium">
                    Quotation version {item.version}
                  </p>
                  <WorkflowBadge value={item.status} />
                </div>
                <DetailList>
                  <DetailItem label="Created">
                    {date(item.createdAt)}
                  </DetailItem>
                  <DetailItem label="Published">
                    {date(item.publishedAt)}
                  </DetailItem>
                  <DetailItem label="Internally approved">
                    {date(item.internallyApprovedAt)}
                  </DetailItem>
                  <DetailItem label="Valid until">
                    {date(item.validUntil)}
                  </DetailItem>
                </DetailList>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState size="sm" title="No quotations recorded." />
        )}
      </SidePanelSection>

      <SidePanelSection title="Approvals">
        <DetailList>
          <DetailItem label="Internal quotation approval">
            {workflow.quotationApprovalRequired ? "Required" : "Not required"}
          </DetailItem>
          <DetailItem label="Quotation approver">
            {workflow.quotationApprover?.fullName ?? "Not assigned"}
          </DetailItem>
          <DetailItem label="Client approval">
            {workflow.approval
              ? `Approved by ${workflow.approval.approvedBy.fullName || "Client"}`
              : "Not recorded"}
          </DetailItem>
          <DetailItem label="Client approval date">
            {date(workflow.approval?.approvedAt)}
          </DetailItem>
        </DetailList>
      </SidePanelSection>

      <SidePanelSection title="Agreements">
        {workflow.agreement ? (
          <DetailList>
            <DetailItem label="Status">
              <WorkflowBadge value={workflow.agreement.status} />
            </DetailItem>
            <DetailItem label="Requirement">
              {workflow.agreement.mandatory ? "Mandatory" : "Optional"}
            </DetailItem>
            <DetailItem label="Reviewed">
              {date(workflow.agreement.reviewedAt)}
            </DetailItem>
          </DetailList>
        ) : (
          <EmptyState size="sm" title="No agreement record yet." />
        )}
      </SidePanelSection>

      <SidePanelSection title="Payments">
        {workflow.payment ? (
          <DetailList>
            <DetailItem label="Status">
              <WorkflowBadge value={workflow.payment.status} />
            </DetailItem>
            <DetailItem label="Requirement">
              {workflow.payment.mandatory ? "Mandatory" : "Optional"}
            </DetailItem>
            <DetailItem label="Payment verifier">
              {workflow.paymentVerifier?.fullName ?? "Not assigned"}
            </DetailItem>
            <DetailItem label="Verified">
              {date(workflow.payment.verifiedAt)}
            </DetailItem>
          </DetailList>
        ) : (
          <div className="grid gap-3">
            <DetailList>
              <DetailItem label="Payment verifier">
                {workflow.paymentVerifier?.fullName ?? "Not assigned"}
              </DetailItem>
            </DetailList>
            <EmptyState
              size="sm"
              title={
                workflow.paymentRequired
                  ? "Payment is required; no payment record yet."
                  : "Payment is not required."
              }
            />
          </div>
        )}
      </SidePanelSection>

      <SidePanelSection title="Project and activation">
        {workflow.project ? (
          <div className="grid gap-3">
            <DetailList>
              <DetailItem label="Project reference">
                {workflow.project.id}
              </DetailItem>
              <DetailItem label="Project name">
                {workflow.project.name}
              </DetailItem>
              <DetailItem label="Project status">
                <WorkflowBadge value={workflow.project.status} />
              </DetailItem>
              <DetailItem label="Project created">
                {date(workflow.project.createdAt)}
              </DetailItem>
              <DetailItem label="Activation start date">
                {date(workflow.project.startDate)}
              </DetailItem>
            </DetailList>
            {workflow.project.staff.length ? (
              <div className="grid divide-y divide-[#eceef1]">
                {workflow.project.staff.map((item) => (
                  <div
                    key={item.employee.id}
                    className="grid gap-1 py-3 first:pt-0"
                  >
                    <p className="m-0 text-xs font-medium">
                      {item.employee.fullName}
                      {item.isTeamLead ? " · Team lead" : ""}
                    </p>
                    {item.employee.position && (
                      <p className="m-0 text-[11px] text-[#65718a]">
                        {item.employee.position}
                      </p>
                    )}
                    <p className="m-0 text-[11px] text-[#65718a]">
                      Assignment approved {date(item.approvedAt)} ·{" "}
                      {item.weeklyHours ?? "Unrecorded"} hrs/week
                    </p>
                    <p className="m-0 text-[11px] text-[#65718a]">
                      Allocation {date(item.allocationStart)} –{" "}
                      {date(item.allocationEnd)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState size="sm" title="No personnel assigned." />
            )}
          </div>
        ) : (
          <EmptyState size="sm" title="No project has been created yet." />
        )}
      </SidePanelSection>
    </div>
  )
}
