import type { Prisma } from "../../generated/prisma/client.js"
import type { ServiceLogEvent } from "./log-writer.js"

export type ServiceLogChangeValue = string | number | boolean | null
export type ServiceLogChange = {
  field: string
  before: ServiceLogChangeValue
  after: ServiceLogChangeValue
}
export type ServiceLogDetails = {
  targetLabel?: string
  changes?: readonly ServiceLogChange[]
}

export const serviceLogTargetTypes: Record<ServiceLogEvent, string> = {
  SERVICE_CREATED: "Service offering",
  SERVICE_UPDATED: "Service offering",
  SERVICE_STATUS_CHANGED: "Service offering",
  SERVICE_DELETED: "Service offering",
  PRICING_UPDATED: "Pricing template",
  PRICING_DELETED: "Pricing template",
  REQUEST_SUBMITTED: "Service request",
  REQUEST_ACCEPTED: "Service request",
  REQUEST_CANCELLED: "Service request",
  REQUEST_CONCLUDED: "Service request",
  WORKFLOW_ACTION_COMPLETED: "Service request",
  FILE_UPLOADED: "Service request",
  CAPACITY_UPDATED: "Staff capacity",
  STAFF_ALLOCATED: "Project staffing",
  STAFF_REMOVED: "Project staffing",
  INVOICE_PAYMENT_RECORDED: "Invoice",
  INVOICE_PAYMENT_ALLOCATED: "Invoice",
  INVOICE_CANCELLED: "Invoice",
  INVOICE_ISSUED: "Invoice",
  INVOICE_CREATED: "Invoice",
  INVOICE_EDITED: "Invoice",
  EXPENSE_CREATED: "Expense",
  EXPENSE_EDITED: "Expense",
  EXPENSE_DELETED: "Expense",
  BILLING_SETTINGS_UPDATED: "Billing configuration",
  PAYMENT_METHOD_CREATED: "Payment method",
  PAYMENT_METHOD_DELETED: "Payment method",
}

const changeFields: Record<ServiceLogEvent, ReadonlySet<string>> = {
  INVOICE_PAYMENT_RECORDED: new Set(["Amount"]),
  INVOICE_PAYMENT_ALLOCATED: new Set(["Amount"]),
  INVOICE_CANCELLED: new Set(["Status"]),
  INVOICE_ISSUED: new Set(["Status"]),
  INVOICE_CREATED: new Set(["Status", "Total"]),
  INVOICE_EDITED: new Set([
    "Total",
    "Issue date",
    "Due date",
    "Service request",
  ]),
  EXPENSE_CREATED: new Set(["Amount", "Category"]),
  EXPENSE_EDITED: new Set(["Amount", "Category"]),
  EXPENSE_DELETED: new Set(["Amount", "Category"]),
  BILLING_SETTINGS_UPDATED: new Set([
    "Invoice prefix",
    "Due days",
    "Terms changed",
  ]),
  PAYMENT_METHOD_CREATED: new Set([]),
  PAYMENT_METHOD_DELETED: new Set([]),
  SERVICE_CREATED: new Set(["Record", "Availability"]),
  SERVICE_UPDATED: new Set([
    "Name",
    "Availability",
    "Departments",
    "Pricing template",
    "Packages",
    "Key benefits",
    "Client requirements",
    "Consultation required",
    "Agreement required",
    "Payment required",
    "Quotation approval required",
    "Image",
  ]),
  SERVICE_STATUS_CHANGED: new Set(["Availability"]),
  SERVICE_DELETED: new Set(["Record"]),
  PRICING_UPDATED: new Set([
    "Name",
    "Pricing model",
    "Amount",
    "Billing interval",
    "Public pricing",
  ]),
  PRICING_DELETED: new Set(["Record"]),
  REQUEST_SUBMITTED: new Set(["Status", "Package", "Preferred specialist"]),
  REQUEST_ACCEPTED: new Set(["Status", "Department"]),
  REQUEST_CANCELLED: new Set(["Status"]),
  REQUEST_CONCLUDED: new Set(["Status"]),
  WORKFLOW_ACTION_COMPLETED: new Set([
    "Workflow action",
    "Workflow state",
    "Request status",
    "Consultation count",
    "Consultation status",
    "Consultation starts",
    "Consultation ends",
    "Reschedule decision",
    "Requirement count",
    "Requirement status",
    "Mandatory requirement",
    "Requirement attachments",
    "Quotation version",
    "Quotation status",
    "Quotation total",
    "Commencement payment",
    "Quotation valid until",
    "Agreement status",
    "Agreement document",
    "Signed agreement",
    "Payment status",
    "Payment amount",
    "Payment proof",
    "Quotation approver",
    "Payment verifier",
    "Project status",
    "Project name",
    "Project staff",
    "Internal note",
  ]),
  FILE_UPLOADED: new Set(["File upload"]),
  CAPACITY_UPDATED: new Set(["Week", "Scheduled hours", "Time off hours"]),
  STAFF_ALLOCATED: new Set([
    "Staff member",
    "Weekly hours",
    "Allocation start",
    "Allocation end",
  ]),
  STAFF_REMOVED: new Set([
    "Staff member",
    "Weekly hours",
    "Allocation start",
    "Allocation end",
  ]),
}

function boundedText(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return "Not set"
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 1)}…`
}

export function auditText(value: string | null | undefined) {
  return value == null ? null : boundedText(value, 240)
}

export function auditList(values: readonly string[]) {
  return values.length ? boundedText(values.join(", "), 240) : "None"
}

export function auditCode(value: string | null | undefined) {
  if (!value) return null
  return boundedText(
    value
      .toLocaleLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
      .join(" "),
    240,
  )
}

export function auditDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function validValue(value: unknown): value is ServiceLogChangeValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
}

export function prepareServiceLogDetails(
  event: ServiceLogEvent,
  details?: ServiceLogDetails,
): {
  targetType: string
  targetLabel?: string
  changes?: Prisma.InputJsonValue
} {
  const targetLabel = details?.targetLabel
    ? boundedText(details.targetLabel, 160)
    : undefined
  if ((details?.changes?.length ?? 0) > 16)
    throw new Error("Too many service log changes")
  const changes = (details?.changes ?? []).filter(
    ({ before, after }) => before !== after,
  )
  if (
    changes.some(
      ({ field, before, after }) =>
        !changeFields[event].has(field) ||
        !validValue(before) ||
        !validValue(after) ||
        (typeof before === "string" && before.length > 240) ||
        (typeof after === "string" && after.length > 240),
    )
  )
    throw new Error("Invalid service log change")
  return {
    targetType: serviceLogTargetTypes[event],
    targetLabel,
    changes: changes.length
      ? changes.map(({ field, before, after }) => ({ field, before, after }))
      : undefined,
  }
}

export function readServiceLogChanges(value: unknown): ServiceLogChange[] {
  if (!Array.isArray(value) || value.length > 16) return []
  const changes: ServiceLogChange[] = []
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("field" in item) ||
      !("before" in item) ||
      !("after" in item) ||
      typeof item.field !== "string" ||
      item.field.length > 80 ||
      !validValue(item.before) ||
      !validValue(item.after) ||
      (typeof item.before === "string" && item.before.length > 240) ||
      (typeof item.after === "string" && item.after.length > 240)
    )
      return []
    changes.push({
      field: item.field,
      before: item.before,
      after: item.after,
    })
  }
  return changes
}
