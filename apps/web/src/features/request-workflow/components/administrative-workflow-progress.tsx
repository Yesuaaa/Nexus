import { DetailItem, DetailList } from "@/components/ui/side-panel"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { SystemStatusUpdate } from "./workflow-cards"
import {
  WorkflowBadge,
  WorkflowCard,
  WorkflowProgress,
} from "./workflow-primitives"
import type { AdministrativeWorkflow } from "../model/administrative-workflow"

/** Metadata-only rendering: no workflow hooks, participant controls or files. */
export function AdministrativeWorkflowProgress({
  workflow,
}: {
  workflow: AdministrativeWorkflow
}) {
  const { formatDateTime } = useDatePreferences()
  const date = (value: string | null) =>
    value ? formatDateTime(value) : "Not recorded"
  if (!workflow.capabilities.read) return null
  return (
    <section aria-label="Administrative workflow oversight">
      <h2 className="text-lg font-semibold">Workflow progress and history</h2>
      <WorkflowProgress workflow={workflow} />
      <WorkflowCard title="Current workflow" status={workflow.state}>
        <p className="m-0">Pending workflow step: {workflow.nextAction}</p>
        <DetailList>
          <DetailItem label="Workflow created">
            {date(workflow.createdAt)}
          </DetailItem>
          <DetailItem label="Last workflow update">
            {date(workflow.updatedAt)}
          </DetailItem>
          <DetailItem label="Previous stage">
            {workflow.previousState ? (
              <WorkflowBadge value={workflow.previousState} />
            ) : (
              "None"
            )}
          </DetailItem>
          <DetailItem label="Quotation approver">
            {workflow.quotationApprover?.fullName ?? "Not assigned"}
          </DetailItem>
          <DetailItem label="Payment verifier">
            {workflow.paymentVerifier?.fullName ?? "Not assigned"}
          </DetailItem>
        </DetailList>
        <p className="m-0">
          Administrative inspection only. Pending steps describe workflow
          progress; execution remains subject to operational permissions and
          business rules.
        </p>
      </WorkflowCard>
      <WorkflowCard
        title="Consultation"
        status={
          workflow.consultationComplete
            ? "COMPLETED"
            : workflow.consultationRequired
              ? "PENDING"
              : "NOT_REQUIRED"
        }
      >
        {workflow.consultations.map((item) => (
          <div key={item.id}>
            <WorkflowBadge value={item.status} />
            <p className="mb-0">
              {date(item.startsAt)} – {date(item.endsAt)}
            </p>
            <p className="mb-0">Recorded: {date(item.createdAt)}</p>
          </div>
        ))}
        {workflow.meetings.map((item) => (
          <div key={item.id}>
            <p className="m-0 font-medium">Linked service meeting</p>
            <WorkflowBadge value={item.status} />
            <p className="mb-0">
              {date(item.startsAt)} – {date(item.endsAt)}
            </p>
            <p className="mb-0">Last update: {date(item.updatedAt)}</p>
            {item.proposedStartsAt && (
              <p className="mb-0">
                Pending reschedule proposal: {date(item.proposedStartsAt)}. The
                confirmed schedule remains in effect.
              </p>
            )}
          </div>
        ))}
        {!workflow.consultations.length && !workflow.meetings.length && (
          <p className="m-0">No consultation records.</p>
        )}
      </WorkflowCard>
      <WorkflowCard title="Requirements">
        {workflow.requirements.map((item) => (
          <div key={item.id}>
            <p className="m-0 font-medium">
              {item.title} · {item.mandatory ? "Mandatory" : "Optional"}
            </p>
            <WorkflowBadge value={item.status} checklist />
            <p className="mb-0">
              Requested: {date(item.createdAt)} · Updated:{" "}
              {date(item.updatedAt)}
            </p>
          </div>
        ))}
        {!workflow.requirements.length && (
          <p className="m-0">No requirements recorded.</p>
        )}
      </WorkflowCard>
      <WorkflowCard title="Quotations and approvals">
        <p className="m-0">
          Internal quotation approval:{" "}
          {workflow.quotationApprovalRequired ? "Required" : "Not required"}
        </p>
        {workflow.quotations.map((item) => (
          <div key={item.id}>
            <p className="m-0 font-medium">Quotation version {item.version}</p>
            <WorkflowBadge value={item.status} />
            <DetailList>
              <DetailItem label="Created">{date(item.createdAt)}</DetailItem>
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
        {!workflow.quotations.length && (
          <p className="m-0">No quotations recorded.</p>
        )}
        <p className="m-0">
          Client acceptance:{" "}
          {workflow.approval
            ? `${workflow.approval.approvedBy.fullName ?? "Client"} · ${date(workflow.approval.approvedAt)}`
            : "Not recorded"}
        </p>
      </WorkflowCard>
      <WorkflowCard title="Agreement and payment verification">
        <DetailList>
          <DetailItem label="Agreement">
            {workflow.agreement ? (
              <WorkflowBadge value={workflow.agreement.status} />
            ) : (
              "Not created"
            )}
          </DetailItem>
          <DetailItem label="Agreement reviewed">
            {date(workflow.agreement?.reviewedAt ?? null)}
          </DetailItem>
          <DetailItem label="Payment required">
            {workflow.paymentRequired ? "Yes" : "No"}
          </DetailItem>
          <DetailItem label="Payment status">
            {workflow.payment ? (
              <WorkflowBadge value={workflow.payment.status} />
            ) : (
              "Not created"
            )}
          </DetailItem>
          <DetailItem label="Verified at">
            {date(workflow.payment?.verifiedAt ?? null)}
          </DetailItem>
        </DetailList>
      </WorkflowCard>
      <WorkflowCard
        title="Staffing and project activation"
        status={workflow.project?.status}
      >
        {workflow.project ? (
          <>
            <DetailList>
              <DetailItem label="Project">{workflow.project.name}</DetailItem>
              <DetailItem label="Project created">
                {date(workflow.project.createdAt)}
              </DetailItem>
              <DetailItem label="Activation start date">
                {date(workflow.project.startDate)}
              </DetailItem>
            </DetailList>
            {workflow.project.staff.map((item) => (
              <div key={item.employee.id}>
                <p className="m-0 font-medium">
                  {item.employee.fullName}
                  {item.isTeamLead ? " · Team lead" : ""}
                </p>
                <p className="mb-0">
                  Assignment approved: {date(item.approvedAt)} ·{" "}
                  {item.weeklyHours ?? "Unrecorded"} hrs/week
                </p>
                <p className="mb-0">
                  Allocation: {date(item.allocationStart)} –{" "}
                  {date(item.allocationEnd)}
                </p>
              </div>
            ))}
            {!workflow.project.staff.length && (
              <p className="m-0">No personnel assigned.</p>
            )}
          </>
        ) : (
          <p className="m-0">No project created.</p>
        )}
      </WorkflowCard>
      <WorkflowCard title="Workflow history">
        <p className="m-0">
          Structured events with private notes and attachments omitted.
          Timestamps and actors reflect recorded history.
        </p>
        <ol className="m-0 list-none p-0" aria-label="Workflow history events">
          {workflow.events.map((event) => (
            <li key={event.id}>
              <SystemStatusUpdate event={event} />
              <p className="text-center text-[11px]">
                {date(event.createdAt)} · {event.actor?.fullName ?? "System"}
                {event.internal ? " · Internal workflow event" : ""}
              </p>
            </li>
          ))}
        </ol>
        {!workflow.events.length && (
          <p className="m-0">No inspectable workflow events recorded.</p>
        )}
      </WorkflowCard>
    </section>
  )
}
