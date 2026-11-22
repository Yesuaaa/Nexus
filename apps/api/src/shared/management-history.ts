/** Validation primitives for the two management histories; no logging hooks. */
import { randomUUID } from "node:crypto"
import { Role, type Prisma } from "../generated/prisma/client.js"
import type { AuthContext } from "../features/auth/auth.middleware.js"
import { isRecordId } from "./validation.js"

export type ManagementOperation = Readonly<{
  actorAccountId: string
  actorRoleAtTime: Role
  operationId: string
}>

const operations = new WeakSet<ManagementOperation>()

/** Backend-only: pass requireAuth's context, never a request body or claims. */
export function createManagementOperation(
  auth: AuthContext,
  scope: "management" | "staff-payroll" = "management",
): ManagementOperation {
  if (
    !auth?.user ||
    !isRecordId(auth.sessionId) ||
    !isRecordId(auth.user.id) ||
    !auth.user.isActive ||
    auth.user.accountDeletedAt !== null ||
    (scope === "staff-payroll"
      ? auth.user.role !== Role.STAFF
      : auth.user.role !== Role.ADMIN && auth.user.role !== Role.SUPERADMIN)
  ) {
    throw new Error("Management history requires authenticated administration")
  }
  const operation = Object.freeze({
    actorAccountId: auth.user.id,
    actorRoleAtTime: auth.user.role,
    operationId: randomUUID(),
  })
  operations.add(operation)
  return operation
}

export function assertManagementOperation(
  operation: ManagementOperation,
  scope: "management" | "staff-payroll" = "management",
): void {
  if (
    !operations.has(operation) ||
    (operation.actorRoleAtTime === Role.STAFF && scope !== "staff-payroll")
  ) {
    throw new Error("Management operation must be created by the backend")
  }
}

export type HistoryTransition<T> = { before: T; after: T }
export type HistoryValueCheck = (value: unknown) => boolean

export function assertHistoryObject(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[] = [],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).some(
      (key) =>
        typeof key !== "string" ||
        !allowed.includes(key) ||
        !Object.getOwnPropertyDescriptor(value, key)!.enumerable ||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, "value"),
    ) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    // Never echo rejected values (they may be credentials).
    throw new Error("Invalid management history fields")
  }
}

export function historyTransition(check: HistoryValueCheck): HistoryValueCheck {
  return (value) => {
    assertHistoryObject(value, ["before", "after"], ["before", "after"])
    return check(value.before) && check(value.after)
  }
}

export const historyNullableId: HistoryValueCheck = (value) =>
  value === null || isRecordId(value)
export const historyBoolean: HistoryValueCheck = (value) =>
  typeof value === "boolean"
export const historyTimestamp: HistoryValueCheck = (value) =>
  value === null ||
  (typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value)

/** Exact keys, exact transition shapes, bounded field names, no raw objects. */
export function validateHistoryPayload(
  input: unknown,
  subjectKey: "subjectAccountId" | "subjectId",
  fields: readonly string[],
  checks: Readonly<Record<string, HistoryValueCheck>>,
  required: readonly string[] = [],
): { changedFields: string[]; changes: Prisma.InputJsonObject } {
  const keys = ["action", "origin", subjectKey, "changedFields", "changes"]
  if (subjectKey === "subjectId") keys.push("subjectType")
  assertHistoryObject(input, keys, keys)
  if (
    !isRecordId(input[subjectKey]) ||
    !Array.isArray(input.changedFields) ||
    Object.getPrototypeOf(input.changedFields) !== Array.prototype ||
    input.changedFields.length > 24
  ) {
    throw new Error("Invalid management history subject or changed fields")
  }
  const changedFields: string[] = []
  if (
    Reflect.ownKeys(input.changedFields).length !==
    input.changedFields.length + 1
  ) {
    throw new Error("Invalid management history field list")
  }
  for (let index = 0; index < input.changedFields.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(
      input.changedFields,
      String(index),
    )
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      typeof descriptor.value !== "string" ||
      !fields.includes(descriptor.value)
    ) {
      throw new Error("Invalid management history field list")
    }
    changedFields.push(descriptor.value)
  }
  if (new Set(changedFields).size !== changedFields.length)
    throw new Error("Duplicate management history fields")
  assertHistoryObject(input.changes, Object.keys(checks), required)
  for (const field of changedFields) {
    if (Object.hasOwn(checks, field) && !Object.hasOwn(input.changes, field)) {
      throw new Error("History changed field requires its transition")
    }
  }
  for (const [key, value] of Object.entries(input.changes)) {
    if (!checks[key](value))
      throw new Error("Invalid management history change")
    if (fields.includes(key) && !changedFields.includes(key)) {
      throw new Error("History transition requires its changed field")
    }
  }
  return {
    changedFields,
    // Every value has passed a closed primitive/transition validator above.
    changes: structuredClone(input.changes) as Prisma.InputJsonObject,
  }
}
