import { isPlainObject, isUuidV4 } from "../../shared/validation.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

export type WorkflowCommand =
  | {
      type: "RESPOND_CONSULTATION_RESCHEDULE"
      consultationId: string
      requestEventId: string
      approve: boolean
      startsAt: string
      endsAt: string
      location: string
      note: string
    }
  | {
      type: "REQUEST_CONSULTATION_RESCHEDULE"
      consultationId: string
      startsAt: string
      note: string
    }
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
      fileIds?: string[]
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
  | {
      type: "COMPLETE_CONSULTATION" | "CANCEL_CONSULTATION"
      consultationId: string
    }
  | { type: "PREPARE_QUOTATION" }
  | { type: "FIXED_QUOTATION" }
  | { type: "ACTIVATE_PROJECT"; projectName?: string }
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
  | { type: "APPROVE_QUOTATION"; quotationId: string }
  | {
      type: "RESPOND_QUOTATION"
      quotationId: string
      decision: "ACCEPT" | "DECLINE" | "REVISE"
      note: string
    }
  | { type: "ATTACH_AGREEMENT" | "SIGN_AGREEMENT"; fileId: string }
  | {
      type: "REVIEW_AGREEMENT" | "VERIFY_PAYMENT"
      approve: boolean
      note: string
    }
  | { type: "SUBMIT_PAYMENT"; fileId: string; reference: string }
  | { type: "COMPLETE_SANDBOX_PAYMENT" }
  | {
      type: "ASSIGN_APPROVERS"
      quotationApproverId: string | null
      paymentVerifierId: string | null
    }
  | { type: "STAFF_PROJECT"; employeeIds: string[] }
  | { type: "HOLD" | "RESUME" | "CANCEL" | "INTERNAL_NOTE"; note: string }

export function fail(message: string, status = 400): never {
  throw new ServiceRequestsError(status, message)
}

export function object(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) fail("Invalid action")
  return value
}

export function textField(
  value: unknown,
  name: string,
  max = 4000,
  optional = false,
): string {
  if (optional && (value === undefined || value === null || value === ""))
    return ""
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    value.includes("\u0000")
  )
    fail(`Invalid ${name}`)
  return value.trim()
}

export function idField(value: unknown, name = "record ID"): string {
  const valueString = textField(value, name, 80)
  if (!/^[A-Za-z0-9_-]+$/.test(valueString)) fail(`Invalid ${name}`)
  return valueString
}

export function uuid(value: unknown): string {
  const result = textField(value, "action ID", 36)
  if (!isUuidV4(result)) fail("A valid action ID is required")
  return result
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") fail("A boolean value is required")
  return value
}

function date(value: unknown): string {
  const result = textField(value, "date", 40)
  if (!/^\d{4}-\d\d-\d\dT/.test(result) || !Number.isFinite(Date.parse(result)))
    fail("Invalid date")
  return new Date(result).toISOString()
}

export function money(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(value))
    fail(
      "Amounts must be positive decimal strings with at most two decimal places",
    )
  return value
}

export function cents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".")
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))
}

export function amount(value: bigint): string {
  if (value < 0n || value > 999999999999n)
    fail("Amount exceeds the supported range")
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`
}

export function parseAction(input: unknown) {
  const body = object(input)
  const actionId = uuid(body.actionId)
  if (
    !Number.isSafeInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 1
  )
    fail("A current workflow version is required")
  const note = () => textField(body.note, "note", 2000, true)
  const id = (name: string) => idField(body[name], name)
  let command: WorkflowCommand
  switch (body.type) {
    case "REQUEST_REQUIREMENT":
      command = {
        type: body.type,
        title: textField(body.title, "title", 300),
        details: textField(body.details, "details", 4000),
        mandatory: bool(body.mandatory),
      }
      break
    case "SUBMIT_REQUIREMENT": {
      let fileIds: string[] | undefined
      if (body.fileIds !== undefined) {
        if (
          body.fileId !== undefined ||
          !Array.isArray(body.fileIds) ||
          body.fileIds.length < 1 ||
          body.fileIds.length > 5
        )
          fail("Attach between 1 and 5 files")
        fileIds = body.fileIds.map((value) => idField(value, "file ID"))
        if (new Set(fileIds).size !== fileIds.length)
          fail("Choose distinct attachments")
      }
      command = {
        type: body.type,
        requirementId: id("requirementId"),
        submission: textField(body.submission, "submission", 4000, true),
        ...(body.fileId ? { fileId: id("fileId") } : {}),
        ...(fileIds ? { fileIds } : {}),
      }
      if (!command.submission && !command.fileId && !command.fileIds?.length)
        fail("Submit text or a file")
      break
    }
    case "REVIEW_REQUIREMENT":
      command = {
        type: body.type,
        requirementId: id("requirementId"),
        approve: bool(body.approve),
        note: note(),
      }
      break
    case "RESPOND_CONSULTATION_RESCHEDULE":
      command = {
        type: body.type,
        consultationId: id("consultationId"),
        requestEventId: id("requestEventId"),
        approve: bool(body.approve),
        startsAt: body.approve === true ? date(body.startsAt) : "",
        endsAt: body.approve === true ? date(body.endsAt) : "",
        location: textField(
          body.location,
          "location",
          1000,
          body.approve !== true,
        ),
        note: note(),
      }
      break
    case "SCHEDULE_CONSULTATION":
      command = {
        type: body.type,
        startsAt: date(body.startsAt),
        endsAt: date(body.endsAt),
        location: textField(body.location, "location", 1000),
        notes: textField(body.notes, "notes", 2000, true),
      }
      break
    case "REQUEST_CONSULTATION_RESCHEDULE":
      command = {
        type: body.type,
        consultationId: id("consultationId"),
        startsAt: date(body.startsAt),
        note: note(),
      }
      break
    case "COMPLETE_CONSULTATION":
    case "CANCEL_CONSULTATION":
      command = { type: body.type, consultationId: id("consultationId") }
      break
    case "PREPARE_QUOTATION":
    case "FIXED_QUOTATION":
    case "COMPLETE_SANDBOX_PAYMENT":
      command = { type: body.type }
      break
    case "ACTIVATE_PROJECT": {
      const projectName =
        body.projectName === undefined
          ? undefined
          : textField(body.projectName, "project name", 120)
      if (projectName !== undefined && projectName.length < 2)
        fail("Enter a project name between 2 and 120 characters")
      command = {
        type: body.type,
        ...(projectName === undefined ? {} : { projectName }),
      }
      break
    }
    case "CREATE_QUOTATION": {
      if (
        !Array.isArray(body.deliverables) ||
        !body.deliverables.length ||
        body.deliverables.length > 30 ||
        !Array.isArray(body.lineItems) ||
        !body.lineItems.length ||
        body.lineItems.length > 30
      )
        fail("Provide 1–30 deliverables and price items")
      const currency = textField(body.currency, "currency", 3).toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) fail("Invalid currency")
      command = {
        type: body.type,
        scope: textField(body.scope, "scope", 6000),
        deliverables: body.deliverables.map((item) =>
          textField(item, "deliverable", 300),
        ),
        lineItems: body.lineItems.map((item) => {
          const line = object(item)
          if (
            !Number.isSafeInteger(line.quantity) ||
            Number(line.quantity) < 1 ||
            Number(line.quantity) > 10000
          )
            fail("Quantity must be 1–10000")
          return {
            description: textField(line.description, "price item", 300),
            quantity: Number(line.quantity),
            unitPrice: money(line.unitPrice),
          }
        }),
        currency,
        timeline: textField(body.timeline, "timeline", 1000),
        paymentTerms: textField(body.paymentTerms, "payment terms", 2000),
        paymentDue: money(body.paymentDue),
        validUntil: date(body.validUntil),
      }
      break
    }
    case "APPROVE_QUOTATION":
      command = { type: body.type, quotationId: id("quotationId") }
      break
    case "RESPOND_QUOTATION":
      if (!["ACCEPT", "DECLINE", "REVISE"].includes(String(body.decision)))
        fail("Invalid quotation decision")
      command = {
        type: body.type,
        quotationId: id("quotationId"),
        decision: body.decision as "ACCEPT" | "DECLINE" | "REVISE",
        note: note(),
      }
      break
    case "ATTACH_AGREEMENT":
    case "SIGN_AGREEMENT":
      command = { type: body.type, fileId: id("fileId") }
      break
    case "REVIEW_AGREEMENT":
    case "VERIFY_PAYMENT":
      command = { type: body.type, approve: bool(body.approve), note: note() }
      break
    case "SUBMIT_PAYMENT":
      command = {
        type: body.type,
        fileId: id("fileId"),
        reference: textField(body.reference, "payment reference", 300),
      }
      break
    case "ASSIGN_APPROVERS":
      command = {
        type: body.type,
        quotationApproverId:
          body.quotationApproverId === null ? null : id("quotationApproverId"),
        paymentVerifierId:
          body.paymentVerifierId === null ? null : id("paymentVerifierId"),
      }
      break
    case "STAFF_PROJECT":
      if (
        !Array.isArray(body.employeeIds) ||
        !body.employeeIds.length ||
        body.employeeIds.length > 30
      )
        fail("Select 1–30 employees")
      command = {
        type: body.type,
        employeeIds: [
          ...new Set(body.employeeIds.map((item) => idField(item))),
        ],
      }
      break
    case "HOLD":
    case "RESUME":
    case "CANCEL":
    case "INTERNAL_NOTE":
      command = {
        type: body.type,
        note: textField(body.note, "note", 2000, body.type === "RESUME"),
      }
      break
    default:
      fail("Unsupported workflow action")
  }
  return { actionId, expectedVersion: Number(body.expectedVersion), command }
}
