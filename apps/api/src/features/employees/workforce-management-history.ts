import {
  WorkforceManagementAction as Action,
  WorkforceManagementOrigin as Origin,
  WorkforceManagementSubject as Subject,
  EmployeeStatus,
  PayrollRequestStatus,
  PayrollRequestType,
  EmploymentType,
  type Prisma,
} from "../../generated/prisma/client.js"
import {
  assertHistoryObject,
  assertManagementOperation,
  historyNullableId,
  historyTimestamp,
  historyTransition,
  validateHistoryPayload,
  type HistoryTransition as Transition,
  type ManagementOperation,
  type HistoryValueCheck,
} from "../../shared/management-history.js"
import { isRecordId } from "../../shared/validation.js"

type Assignments = {
  departmentId?: Transition<string | null>
  teamId?: Transition<string | null>
  userId?: Transition<string | null>
}
type Heads = {
  headId?: Transition<string | null>
  temporaryHeadOriginalId?: Transition<string | null>
  temporaryHeadAssignedId?: Transition<string | null>
}
export type PayrollApprovalAuditAction =
  | "PAYROLL_SUBMITTED"
  | "PAYROLL_APPROVED"
  | "PAYROLL_REJECTED"
  | "PAYROLL_RETURNED_FOR_REVISION"
  | "PAYROLL_RESUBMITTED"

type PayrollDocumentActivity =
  | "GENERATED"
  | "PUBLISHED"
  | "REQUEST_CREATED"
  | "REQUEST_UPDATED"
  | "REQUEST_MESSAGE"
  | "REQUEST_EDITED"
  | "REQUEST_WITHDRAWN"

type Payloads = Record<
  PayrollApprovalAuditAction,
  { calculationId: string; reason?: string }
> & {
  CREATED: Assignments &
    Heads & {
      status?: Transition<EmployeeStatus | null>
      employmentType?: Transition<EmploymentType | null>
      leadId?: Transition<string | null>
    }
  PROFILE_UPDATED: { employmentType?: Transition<EmploymentType> }
  STATUS_CHANGED: { status: Transition<EmployeeStatus> }
  ASSIGNMENT_CHANGED: Assignments & { affectedAccountId?: string }
  HEAD_CHANGED: Heads & { headId: Transition<string | null> }
  TEMPORARY_HEAD_CHANGED: Heads
  LEAD_CHANGED: { leadId: Transition<string | null> }
  TITLE_CLEARED: { cause: "FORMER_DEPARTMENT_HEAD"; affectedAccountId?: string }
  DELETED: Heads & {
    departmentId?: Transition<string | null>
    leadId?: Transition<string | null>
  }
  VERSION_CREATED: {
    previousVersionId: string | null
    versionId: string
    reason: string
  }
  PAYROLL_PERIOD_CREATED: {
    configurationId: string
    startDate: string
    endDate: string
    frequency: "MONTHLY" | "SEMI_MONTHLY"
  }
  PAYROLL_DOCUMENT_ACTIVITY: {
    requestStatus?: Transition<PayrollRequestStatus>
    correctionFlag?: Transition<boolean>
    type?: Transition<PayrollRequestType>
    description?: Transition<string>
    payslipId?: Transition<string | null>
    withdrawnAt?: Transition<string | null>
    withdrawnBy?: Transition<string | null>
    activity: PayrollDocumentActivity
    calculationId?: string
  }
  PAYROLL_RUN_CREATED: { periodId: string }
  PAYROLL_CALCULATED: {
    calculationId: string
    previousCalculationId: string | null
    revision: number
  }
  PAYROLL_RECALCULATED: {
    calculationId: string
    previousCalculationId: string | null
    revision: number
  }
  PAYROLL_CALCULATION_FAILED: {
    attemptId: string
    revision: number
    failureCode: "CALCULATION_INPUT_INVALID" | "CALCULATION_FAILED"
  }
}

type WorkforceField =
  | "employeeId"
  | "fullName"
  | "email"
  | "contactNumber"
  | "position"
  | "employmentType"
  | "startDate"
  | "status"
  | "departmentId"
  | "teamId"
  | "userId"
  | "name"
  | "code"
  | "color"
  | "description"
  | "headId"
  | "temporaryHeadOriginalId"
  | "temporaryHeadAssignedId"
  | "leadId"
  | "previousVersionId"
  | "versionId"
  | "reason"
  | "configurationId"
  | "periodId"
  | "startDate"
  | "endDate"
  | "frequency"
  | "calculationId"
  | "previousCalculationId"
  | "revision"
  | "attemptId"
  | "failureCode"
  | "type"
  | "requestStatus"
  | "correctionFlag"
  | "payslipId"
  | "withdrawnAt"
  | "withdrawnBy"

type ActionSubjects = Record<PayrollApprovalAuditAction, "PAYROLL_RUN"> & {
  CREATED: Exclude<
    Subject,
    | "COMPENSATION"
    | "PAYROLL_CONFIGURATION"
    | "PAYROLL_PERIOD"
    | "PAYROLL_RUN"
    | "PAYROLL_REQUEST"
  >
  PROFILE_UPDATED: Exclude<
    Subject,
    | "COMPENSATION"
    | "PAYROLL_CONFIGURATION"
    | "PAYROLL_PERIOD"
    | "PAYROLL_RUN"
    | "PAYROLL_REQUEST"
  >
  STATUS_CHANGED: "EMPLOYEE"
  ASSIGNMENT_CHANGED: "EMPLOYEE" | "DEPARTMENT"
  HEAD_CHANGED: "DEPARTMENT"
  TEMPORARY_HEAD_CHANGED: "DEPARTMENT"
  LEAD_CHANGED: "TEAM"
  TITLE_CLEARED: "EMPLOYEE" | "DEPARTMENT"
  DELETED: "DEPARTMENT" | "TEAM"
  VERSION_CREATED: "COMPENSATION" | "PAYROLL_CONFIGURATION"
  PAYROLL_PERIOD_CREATED: "PAYROLL_PERIOD"
  PAYROLL_DOCUMENT_ACTIVITY: "PAYROLL_RUN" | "PAYROLL_REQUEST"
  PAYROLL_RUN_CREATED: "PAYROLL_RUN"
  PAYROLL_CALCULATED: "PAYROLL_RUN"
  PAYROLL_RECALCULATED: "PAYROLL_RUN"
  PAYROLL_CALCULATION_FAILED: "PAYROLL_RUN"
}

export type WorkforceManagementChangeInput = {
  [A in Action]: {
    action: A
    origin: Origin
    subjectType: ActionSubjects[A]
    subjectId: string
    changedFields: readonly WorkforceField[]
    changes: Payloads[A]
  }
}[Action]

const profile = {
  EMPLOYEE: [
    "employeeId",
    "fullName",
    "email",
    "contactNumber",
    "position",
    "employmentType",
    "startDate",
  ],
  DEPARTMENT: ["name", "code", "color", "description"],
  TEAM: ["name", "description"],
}
const id = historyTransition(historyNullableId)
// Deletion can remove an existing relationship, never create or reassign one.
const removedId: HistoryValueCheck = (value) => {
  if (!id(value)) return false
  const transition = value as Transition<string | null>
  return transition.before !== null && transition.after === null
}
const assignments = { departmentId: id, teamId: id, userId: id }
const heads = {
  headId: id,
  temporaryHeadOriginalId: id,
  temporaryHeadAssignedId: id,
}
const status: HistoryValueCheck = (v) =>
  Object.values(EmployeeStatus).some((s) => s === v)
const employment: HistoryValueCheck = (v) =>
  Object.values(EmploymentType).some((s) => s === v)

/** Append only, within the same transaction as the future workforce mutation. */
export async function writeWorkforceManagementChange(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  input: WorkforceManagementChangeInput,
) {
  assertManagementOperation(
    operation,
    input?.action === Action.PAYROLL_DOCUMENT_ACTIVITY
      ? "staff-payroll"
      : "management",
  )
  assertHistoryObject(input, [
    "action",
    "origin",
    "subjectType",
    "subjectId",
    "changedFields",
    "changes",
  ])
  if (
    !Object.values(Action).includes(input.action) ||
    !Object.values(Origin).includes(input.origin) ||
    !Object.values(Subject).includes(input.subjectType)
  )
    throw new Error("Invalid workforce history classification")

  let fields: readonly string[] = []
  let checks: Record<string, HistoryValueCheck> = {}
  let required: string[] = []
  const employee = input.subjectType === Subject.EMPLOYEE
  const department = input.subjectType === Subject.DEPARTMENT
  switch (input.action) {
    case Action.CREATED:
      checks = employee
        ? {
            ...assignments,
            status: historyTransition((v) => v === null || status(v)),
            employmentType: historyTransition(
              (v) => v === null || employment(v),
            ),
          }
        : department
          ? heads
          : { departmentId: id, leadId: id }
      fields = [...profile[input.subjectType], ...Object.keys(checks)]
      break
    case Action.PROFILE_UPDATED:
      fields = profile[input.subjectType]
      checks = employee ? { employmentType: historyTransition(employment) } : {}
      break
    case Action.STATUS_CHANGED:
      if (!employee) throw new Error("Only Employee has HR status history")
      fields = ["status"]
      checks = { status: historyTransition(status) }
      required = ["status"]
      break
    case Action.ASSIGNMENT_CHANGED:
      if (!employee && !department)
        throw new Error("Invalid assignment history subject")
      checks = employee
        ? assignments
        : { departmentId: id, teamId: id, affectedAccountId: isRecordId }
      fields = employee
        ? Object.keys(assignments)
        : ["departmentId", "teamId", "position"]
      required = employee ? [] : ["affectedAccountId"]
      break
    case Action.HEAD_CHANGED:
    case Action.TEMPORARY_HEAD_CHANGED:
      if (!department) throw new Error("Head history requires a Department")
      fields = Object.keys(heads)
      checks = heads
      required = input.action === Action.HEAD_CHANGED ? ["headId"] : []
      if (
        input.action === Action.TEMPORARY_HEAD_CHANGED &&
        !Object.hasOwn(input.changes, "temporaryHeadOriginalId") &&
        !Object.hasOwn(input.changes, "temporaryHeadAssignedId")
      ) {
        throw new Error("Temporary head history requires a tracking transition")
      }
      break
    case Action.LEAD_CHANGED:
      if (input.subjectType !== Subject.TEAM)
        throw new Error("Lead history requires a Team")
      fields = ["leadId"]
      checks = { leadId: id }
      required = ["leadId"]
      break
    case Action.TITLE_CLEARED:
      if (!employee && !department)
        throw new Error("Invalid title cleanup subject")
      fields = ["position"]
      checks = {
        cause: (v) => v === "FORMER_DEPARTMENT_HEAD",
        ...(department ? { affectedAccountId: isRecordId } : {}),
      }
      required = department ? ["cause", "affectedAccountId"] : ["cause"]
      break
    case Action.DELETED:
      if (employee)
        throw new Error("No Employee deletion management operation exists")
      checks = department
        ? {
            headId: removedId,
            temporaryHeadOriginalId: removedId,
            temporaryHeadAssignedId: removedId,
          }
        : { departmentId: removedId, leadId: removedId }
      fields = Object.keys(checks)
      break
    case Action.VERSION_CREATED:
      if (
        input.subjectType !== "COMPENSATION" &&
        input.subjectType !== "PAYROLL_CONFIGURATION"
      )
        throw new Error("Version history requires a payroll subject")
      fields = ["previousVersionId", "versionId", "reason"]
      checks = {
        previousVersionId: historyNullableId,
        versionId: isRecordId,
        reason: (value) =>
          typeof value === "string" && value.length >= 3 && value.length <= 500,
      }
      required = [...fields]
      break
    case Action.PAYROLL_PERIOD_CREATED:
      if (input.subjectType !== Subject.PAYROLL_PERIOD)
        throw new Error("Payroll period history requires a PayrollPeriod")
      fields = ["configurationId", "startDate", "endDate", "frequency"]
      checks = {
        configurationId: isRecordId,
        startDate: (value) =>
          typeof value === "string" &&
          /^\d{4}-\d\d-\d\d$/.test(value) &&
          Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
          new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) ===
            value,
        endDate: (value) =>
          typeof value === "string" &&
          /^\d{4}-\d\d-\d\d$/.test(value) &&
          Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
          new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) ===
            value,
        frequency: (value) => value === "MONTHLY" || value === "SEMI_MONTHLY",
      }
      required = [...fields]
      break
    case Action.PAYROLL_RUN_CREATED:
      if (input.subjectType !== Subject.PAYROLL_RUN)
        throw new Error("Payroll run history requires a PayrollRun")
      fields = ["periodId"]
      checks = { periodId: isRecordId }
      required = [...fields]
      break
    case Action.PAYROLL_CALCULATED:
    case Action.PAYROLL_RECALCULATED:
      if (input.subjectType !== Subject.PAYROLL_RUN)
        throw new Error("Payroll calculation history requires a PayrollRun")
      fields = ["calculationId", "previousCalculationId", "revision"]
      checks = {
        calculationId: isRecordId,
        previousCalculationId: historyNullableId,
        revision: (value) => Number.isInteger(value) && Number(value) > 0,
      }
      required = [...fields]
      break
    case Action.PAYROLL_DOCUMENT_ACTIVITY: {
      const run = input.subjectType === Subject.PAYROLL_RUN
      const request = input.subjectType === Subject.PAYROLL_REQUEST
      if ((!run && !request) || input.origin !== Origin.PAYROLL_MANAGEMENT)
        throw new Error("Invalid payroll activity subject")
      fields = request
        ? [
            "type",
            "description",
            "requestStatus",
            "correctionFlag",
            "payslipId",
            "withdrawnAt",
            "withdrawnBy",
          ]
        : []
      required = run ? ["activity", "calculationId"] : ["activity"]
      checks = {
        activity: (v) =>
          run
            ? operation.actorRoleAtTime === "ADMIN" &&
              (v === "GENERATED" || v === "PUBLISHED")
            : operation.actorRoleAtTime === "STAFF"
              ? v === "REQUEST_CREATED" ||
                v === "REQUEST_MESSAGE" ||
                v === "REQUEST_EDITED" ||
                v === "REQUEST_WITHDRAWN"
              : operation.actorRoleAtTime === "ADMIN" &&
                v === "REQUEST_UPDATED",
        ...(run ? { calculationId: isRecordId } : {}),
        ...(request
          ? {
              type: historyTransition((value) =>
                Object.values(PayrollRequestType).some(
                  (item) => item === value,
                ),
              ),
              description: historyTransition(
                (value) =>
                  typeof value === "string" &&
                  value.trim().length >= 5 &&
                  value.length <= 2000,
              ),
              payslipId: historyTransition(historyNullableId),
              withdrawnAt: historyTransition(historyTimestamp),
              withdrawnBy: historyTransition(historyNullableId),
            }
          : {}),
        ...(input.changes.activity === "REQUEST_UPDATED" ||
        input.changes.activity === "REQUEST_WITHDRAWN"
          ? {
              requestStatus: historyTransition((value) =>
                Object.values(PayrollRequestStatus).some(
                  (item) => item === value,
                ),
              ),
              ...(input.changes.activity === "REQUEST_UPDATED"
                ? {
                    correctionFlag: historyTransition(
                      (value) => typeof value === "boolean",
                    ),
                  }
                : {}),
            }
          : {}),
      }
      break
    }
    case Action.PAYROLL_SUBMITTED:
    case Action.PAYROLL_APPROVED:
    case Action.PAYROLL_REJECTED:
    case Action.PAYROLL_RETURNED_FOR_REVISION:
    case Action.PAYROLL_RESUBMITTED:
      if (input.subjectType !== Subject.PAYROLL_RUN)
        throw new Error("Payroll approval history requires a PayrollRun")
      fields = ["calculationId", "status"]
      required = ["calculationId"]
      checks = { calculationId: isRecordId }
      if (input.action === Action.PAYROLL_REJECTED) {
        fields = [...fields, "reason"]
        required.push("reason")
        checks.reason = (value) =>
          typeof value === "string" &&
          value.trim().length >= 5 &&
          value.length <= 500
      }
      break
    case Action.PAYROLL_CALCULATION_FAILED:
      if (input.subjectType !== Subject.PAYROLL_RUN)
        throw new Error("Payroll calculation history requires a PayrollRun")
      fields = ["attemptId", "revision", "failureCode"]
      checks = {
        attemptId: isRecordId,
        revision: (value) => Number.isInteger(value) && Number(value) > 0,
        failureCode: (value) =>
          value === "CALCULATION_INPUT_INVALID" ||
          value === "CALCULATION_FAILED",
      }
      required = [...fields]
      break
  }
  const payload = validateHistoryPayload(
    input,
    "subjectId",
    fields,
    checks,
    required,
  )
  return tx.workforceManagementChange.create({
    data: {
      actorAccountId: operation.actorAccountId,
      actorRoleAtTime: operation.actorRoleAtTime,
      operationId: operation.operationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      action: input.action,
      origin: input.origin,
      ...payload,
    },
  })
}
