import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { jwtKey } from "../auth/auth.jwt.js"
import registry from "../modules/module-registry.json" with { type: "json" }
import {
  assertHistoryObject,
  historyTimestamp,
} from "../../shared/management-history.js"
import { HttpError } from "../../shared/http-error.js"
import { isRecordId } from "../../shared/validation.js"
import { projectSource, projectActions } from "./project-audit.catalog.js"
import { serviceActions, workflowTypes } from "./service-audit.catalog.js"
import {
  attendanceSource,
  attendanceSubjects,
  attendanceActions,
} from "./attendance-audit.catalog.js"
import {
  sources,
  eventNames,
  accountActions,
  workforceActions,
  type ManagementSource,
  type ModuleId,
  type SubjectType,
} from "./management-event.js"

export type Position = { time: string; source: ManagementSource; id: string }
export type ManagementFilters = {
  from: string
  to: string
  pageSize: number
  sources: ManagementSource[]
  moduleId?: ModuleId
  actorId?: string
  subjectType?: SubjectType
  subjectId?: string
  operationId?: string
  eventName?: string
  action?: string
}
type Cursor = {
  version: 1
  fingerprint: string
  snapshot: string
  after: Position
  from: string
  to: string
  expires: number
}
const day = 86400000
const invalid = (): never => {
  throw new HttpError(400, "Invalid management history query")
}
export const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && historyTimestamp(v)
const signature = (body: string) =>
  createHmac("sha256", jwtKey())
    .update(`converyn.management-cursor.v1:${body}`)
    .digest()
export function encodeCursor(cursor: Cursor): string {
  const body = Buffer.from(JSON.stringify(cursor)).toString("base64url")
  return `${body}.${signature(body).toString("base64url")}`
}
function decodeCursor(value: unknown, now: Date): Cursor {
  try {
    if (
      typeof value !== "string" ||
      value.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
    )
      return invalid()
    const [body, sig] = value.split(".")
    const expected = signature(body),
      actual = Buffer.from(sig, "base64url")
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return invalid()
    const c: unknown = JSON.parse(Buffer.from(body, "base64url").toString())
    assertHistoryObject(
      c,
      ["version", "fingerprint", "snapshot", "after", "from", "to", "expires"],
      ["version", "fingerprint", "snapshot", "after", "from", "to", "expires"],
    )
    assertHistoryObject(
      c.after,
      ["time", "source", "id"],
      ["time", "source", "id"],
    )
    if (
      c.version !== 1 ||
      typeof c.fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(c.fingerprint) ||
      !timestamp(c.snapshot) ||
      !timestamp(c.from) ||
      !timestamp(c.to) ||
      typeof c.expires !== "number" ||
      !Number.isSafeInteger(c.expires) ||
      c.expires <= now.getTime() ||
      c.expires > now.getTime() + day ||
      c.snapshot > now.toISOString() ||
      !timestamp(c.after.time) ||
      c.after.time > c.snapshot ||
      c.after.time < c.from ||
      c.after.time > c.to ||
      !sources.includes(c.after.source as ManagementSource) ||
      typeof c.after.id !== "string" ||
      c.after.id.length < 1 ||
      c.after.id.length > 100
    )
      return invalid()
    return c as Cursor
  } catch {
    return invalid()
  }
}
export function parseManagementQuery(
  input: unknown,
  identity: string,
  now: Date,
) {
  try {
    assertHistoryObject(input, [
      "category",
      "area",
      "moduleId",
      "source",
      "eventName",
      "action",
      "actorId",
      "subjectType",
      "subjectId",
      "operationId",
      "from",
      "to",
      "pageSize",
      "cursor",
    ])
    const cursor =
      input.cursor === undefined ? null : decodeCursor(input.cursor, now)
    for (const key of ["subjectType", "action", "eventName"])
      if (input[key] !== undefined && typeof input[key] !== "string")
        return invalid()
    const from =
      input.from ??
      cursor?.from ??
      new Date(now.getTime() - 7 * day).toISOString()
    const to = input.to ?? cursor?.to ?? now.toISOString()
    if (
      !timestamp(from) ||
      !timestamp(to) ||
      from > to ||
      Date.parse(to) - Date.parse(from) > 31 * day
    )
      return invalid()
    if (
      (input.category !== undefined && input.category !== "audit") ||
      (input.area !== undefined && input.area !== "module")
    )
      return invalid()
    if (
      input.source !== undefined &&
      !sources.includes(input.source as ManagementSource)
    )
      return invalid()
    if (
      input.moduleId !== undefined &&
      (typeof input.moduleId !== "string" ||
        !Object.hasOwn(registry, input.moduleId))
    )
      return invalid()
    if (
      input.moduleId !== undefined &&
      ![
        "administration",
        "people-hr",
        "service-operations",
        "attendance-monitoring",
        "project-management",
      ].includes(String(input.moduleId))
    )
      return invalid()
    if (
      input.subjectType !== undefined &&
      ![
        "account",
        "employee",
        "department",
        "team",
        "project",
        "service_request",
        ...Object.values(attendanceSubjects),
      ].includes(String(input.subjectType))
    )
      return invalid()
    if (input.actorId !== undefined && !isRecordId(input.actorId))
      return invalid()
    if (
      input.subjectId !== undefined &&
      (typeof input.subjectId !== "string" ||
        !/^[A-Za-z0-9_:-]{1,100}$/.test(input.subjectId))
    )
      return invalid()
    if (input.operationId !== undefined && !uuid(input.operationId))
      return invalid()
    if (
      input.eventName !== undefined &&
      !eventNames().includes(String(input.eventName))
    )
      return invalid()
    if (
      input.action !== undefined &&
      ![
        ...accountActions,
        ...workforceActions,
        ...attendanceActions,
        ...projectActions,
        ...serviceActions,
      ].includes(String(input.action))
    )
      return invalid()
    if (
      typeof input.subjectType === "string" &&
      typeof input.action === "string" &&
      !eventNames().includes(
        `${input.subjectType}.${input.action.toLowerCase()}`,
      )
    )
      return invalid()
    const pageSize = input.pageSize ?? 50
    if (
      typeof pageSize !== "number" ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      return invalid()
    const selected = (
      input.source === undefined
        ? [...sources]
        : [input.source as ManagementSource]
    ).filter((source) => {
      const attendance = source === attendanceSource
      if (source === projectSource)
        return (
          !input.operationId &&
          workflowTypes({
            moduleId: input.moduleId as string | undefined,
            subjectType: input.subjectType as string | undefined,
            action: input.action as string | undefined,
            eventName: input.eventName as string | undefined,
          }).length > 0
        )
      const subjects = attendance
        ? Object.values(attendanceSubjects)
        : source === sources[0]
          ? ["account"]
          : ["employee", "department", "team"]
      const actions: readonly string[] = attendance
        ? attendanceActions
        : source === sources[0]
          ? accountActions
          : workforceActions
      const modules = attendance
        ? ["attendance-monitoring"]
        : source === sources[0]
          ? ["administration", "people-hr", "service-operations"]
          : ["administration", "people-hr"]
      return (
        (!input.moduleId || modules.includes(String(input.moduleId))) &&
        (!input.subjectType ||
          subjects.some((subject) => subject === input.subjectType)) &&
        (!input.action || actions.includes(String(input.action))) &&
        (!input.eventName ||
          (subjects.some((subject) =>
            String(input.eventName).startsWith(subject + "."),
          ) &&
            actions.some((action) =>
              String(input.eventName).endsWith("." + action.toLowerCase()),
            ))) &&
        (!input.operationId || !attendance)
      )
    })
    if (!selected.length) return invalid()
    if (
      input.eventName !== undefined &&
      ((input.subjectType !== undefined &&
        !String(input.eventName).startsWith(String(input.subjectType) + ".")) ||
        (input.action !== undefined &&
          !String(input.eventName).endsWith(
            "." + String(input.action).toLowerCase(),
          )))
    )
      return invalid()
    const filters: ManagementFilters = {
      from,
      to,
      pageSize,
      sources: selected,
      ...(input.moduleId !== undefined
        ? { moduleId: input.moduleId as ModuleId }
        : {}),
      ...(input.actorId !== undefined
        ? { actorId: input.actorId as string }
        : {}),
      ...(input.subjectType !== undefined
        ? { subjectType: input.subjectType as SubjectType }
        : {}),
      ...(input.subjectId !== undefined
        ? { subjectId: input.subjectId as string }
        : {}),
      ...(input.operationId !== undefined
        ? { operationId: String(input.operationId).toLowerCase() }
        : {}),
      ...(input.eventName !== undefined
        ? { eventName: input.eventName as string }
        : {}),
      ...(input.action !== undefined ? { action: input.action as string } : {}),
    }
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(["workflow-subsets-v2", identity, filters]))
      .digest("hex")
    if (cursor && cursor.fingerprint !== fingerprint) return invalid()
    return {
      filters,
      fingerprint,
      snapshot: cursor?.snapshot ?? now.toISOString(),
      after: cursor?.after ?? null,
      expires: cursor?.expires ?? now.getTime() + day,
    }
  } catch {
    return invalid()
  }
}
export function comparePositions(a: Position, b: Position): number {
  return (
    b.time.localeCompare(a.time) ||
    (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) ||
    (a.id > b.id ? -1 : a.id < b.id ? 1 : 0)
  )
}
