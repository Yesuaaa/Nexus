import assert from "node:assert/strict"
import { test } from "node:test"
import {
  defaultHistoryFilters,
  historyQuery,
  parseHistoryEvent,
  parseHistoryPage,
  canAdvanceHistory,
  initialHistoryFilters,
  historyModuleCoverage,
  historyModuleOptions,
  investigateHistoryOperation,
} from "../src/features/system-logs/model/management-history.ts"
import {
  canAccessRoute,
  getNavigationPolicies,
  getActiveWorkspaceModuleId,
} from "../src/features/workspaces/model/route-policy.ts"
import { loadHistory } from "../src/features/system-logs/api/system-logs-api.ts"
import { resolveWorkspaceModuleId } from "../src/features/workspaces/model/workspace-selection.ts"
import {
  incompatibleHistoryFilters,
  clearIncompatibleHistoryFilters,
} from "../src/features/system-logs/model/history-filter-compatibility.ts"

test("scope compatibility offers a minimal explicit correction and preserves investigation identifiers and dates", () => {
  const original = {
    ...defaultHistoryFilters(new Date("2026-11-16T12:00:00Z")),
    moduleId: "project-management",
    source: "audit.workflow",
    eventName: "service_request.quotation_sent",
    action: "QUOTATION_SENT",
    subjectType: "service_request",
    actorId: "historical-actor",
    subjectId: "recorded-request",
  }
  const snapshot = structuredClone(original)
  const incompatible = incompatibleHistoryFilters(original)
  assert.deepEqual(incompatible, ["action", "subjectType", "eventName"])
  const corrected = clearIncompatibleHistoryFilters(original, incompatible)
  assert.deepEqual(corrected, {
    ...original,
    action: "",
    subjectType: "",
    eventName: "",
  })
  assert.deepEqual(original, snapshot)
  assert.deepEqual(incompatibleHistoryFilters(corrected), [])
  assert.deepEqual(
    incompatibleHistoryFilters({ ...original, moduleId: "service-operations" }),
    [],
  )
  assert.deepEqual(
    incompatibleHistoryFilters({ ...original, moduleId: "" }),
    [],
  )
})

test("compatibility preserves supported management operations, separates workflow subsets, and detects source/event conflicts in All Modules", () => {
  const base = defaultHistoryFilters()
  for (const moduleId of [
    "administration",
    "people-hr",
    "service-operations",
    "",
  ])
    assert.deepEqual(
      incompatibleHistoryFilters({
        ...base,
        moduleId,
        eventName: "account.role_changed",
        operationId: "5168086b-2d02-4e99-9c14-93cef129aabc",
      }),
      [],
    )
  assert.deepEqual(
    incompatibleHistoryFilters({
      ...base,
      source: "audit.account-management",
      eventName: "project.staffing_allocated",
    }),
    ["source"],
  )
  assert.deepEqual(
    incompatibleHistoryFilters({
      ...base,
      moduleId: "project-management",
      source: "audit.workflow",
      eventName: "project.staffing_allocated",
      operationId: "5168086b-2d02-4e99-9c14-93cef129aabc",
    }),
    ["operationId"],
  )
  assert.deepEqual(
    incompatibleHistoryFilters({
      ...base,
      moduleId: "attendance-monitoring",
      eventName: "attendance_workday.delete",
    }),
    ["eventName"],
  )
  assert.deepEqual(
    incompatibleHistoryFilters({
      ...base,
      moduleId: "people-hr",
      subjectType: "team",
      action: "HEAD_CHANGED",
    }),
    ["action"],
  )
  assert.deepEqual(
    incompatibleHistoryFilters({
      ...base,
      moduleId: "billing-finance",
      source: "audit.workflow",
    }),
    [],
  )
})

const operation = "5168086b-2d02-4e99-9c14-93cef129aabc"
const event = {
  schemaVersion: 1,
  eventId: "audit.account-management:one",
  source: "audit.account-management",
  sourceEventId: "one",
  occurredAt: "2026-11-16T01:00:00.000Z",
  category: "audit",
  area: "module",
  moduleId: "administration",
  sourceAction: "ROLE_CHANGED",
  eventName: "account.role_changed",
  severity: "info",
  outcome: "succeeded",
  actor: {
    kind: "account",
    accountId: "deleted-actor",
    roleAtTime: "ADMIN",
    roleEvidence: "recorded",
  },
  subject: { type: "account", id: "deleted-subject" },
  correlation: { operationId: operation },
  details: {
    kind: "management",
    changedFields: ["role"],
    transitions: { role: { before: "STAFF", after: "ADMIN" } },
    sessionsRevoked: null,
  },
}
const page = {
  schemaVersion: 1,
  events: [event],
  nextCursor: "signed-cursor",
  complete: true,
  snapshotBoundary: "2026-11-16T02:00:00.000Z",
  sources: [
    {
      source: event.source,
      status: "available",
      omittedCount: 0,
      reasonCode: null,
    },
  ],
  grouping: { scope: "page", eventCount: 1, operationCount: 1 },
}

test("Service request parser uses recorded request identity with no project misclassification or invented correlation", () => {
  const service = {
    ...event,
    source: "audit.workflow",
    eventId: "audit.workflow:one",
    moduleId: "service-operations",
    sourceAction: "QUOTATION_SENT",
    eventName: "service_request.quotation_sent",
    subject: { type: "service_request", id: "recorded-request" },
    actor: {
      kind: "unknown",
      accountId: null,
      roleAtTime: null,
      roleEvidence: "not-recorded",
    },
    correlation: { operationId: null },
    details: {
      kind: "service",
      origin: null,
      changedFields: [],
      transitions: {},
      sessionsRevoked: null,
    },
  }
  const parsed = parseHistoryEvent(service)
  assert.equal(parsed.kind, "service")
  assert.equal(parsed.subjectId, "recorded-request")
  assert.equal(parsed.operationId, null)
  for (const change of [
    { moduleId: "project-management" },
    { subject: { type: "project", id: "recorded-request" } },
    { correlation: { operationId: operation } },
    {
      sourceAction: "QUOTATION_INTERNAL_APPROVED",
      eventName: "service_request.quotation_internal_approved",
    },
    { details: { ...service.details, changedFields: ["amount"] } },
  ])
    assert.throws(() => parseHistoryEvent({ ...service, ...change }))
  const pageWithBoth = {
    ...page,
    events: [event, service],
    sources: [
      ...page.sources,
      { ...page.sources[0], source: "audit.workflow" },
    ],
    grouping: {
      scope: "page",
      eventCount: 2,
      operationCount: 1,
      ungroupedEventCount: 1,
    },
  }
  assert.equal(parseHistoryPage(pageWithBoth).ungroupedEventCount, 1)
})

test("Project parser permits only approved metadata and rejects fabricated roles/operations and service event types", () => {
  const project = {
    ...event,
    source: "audit.workflow",
    eventId: "audit.workflow:one",
    moduleId: "project-management",
    subject: { type: "project", id: "historical-project" },
    sourceAction: "STAFFING_ALLOCATED",
    eventName: "project.staffing_allocated",
    actor: {
      kind: "unknown",
      accountId: null,
      roleAtTime: null,
      roleEvidence: "not-recorded",
    },
    correlation: { operationId: null },
    details: {
      kind: "project",
      origin: null,
      changedFields: [],
      transitions: {},
      sessionsRevoked: null,
    },
  }
  const parsed = parseHistoryEvent(project)
  assert.equal(parsed.kind, "project")
  assert.equal(parsed.operationId, null)
  assert.equal(
    parseHistoryPage({
      ...page,
      events: [project],
      sources: [{ ...page.sources[0], source: "audit.workflow" }],
      grouping: {
        scope: "page",
        eventCount: 1,
        operationCount: 0,
        ungroupedEventCount: 1,
      },
    }).operationCount,
    0,
  )
  for (const change of [
    {
      sourceAction: "PROJECT_ACTIVATED",
      eventName: "project.project_activated",
    },
    { correlation: { operationId: operation } },
    { details: { ...project.details, changedFields: ["weeklyHours"] } },
    { moduleId: "service-operations" },
  ])
    assert.throws(() => parseHistoryEvent({ ...project, ...change }))
})

test("Attendance parser preserves unknown role/operation and excludes fabricated groups and raw details", () => {
  const attendance = {
    ...event,
    source: "audit.attendance",
    eventId: "audit.attendance:one",
    moduleId: "attendance-monitoring",
    sourceAction: "UPDATE",
    eventName: "attendance_policy_day.update",
    subject: { type: "attendance_policy_day", id: "policy:1" },
    actor: {
      kind: "account",
      accountId: "historical-actor",
      roleAtTime: null,
      roleEvidence: "not-recorded",
    },
    correlation: { operationId: null },
    details: {
      kind: "attendance",
      origin: null,
      changedFields: [],
      transitions: {},
      sessionsRevoked: null,
    },
  }
  const parsed = parseHistoryEvent(attendance)
  assert.equal(parsed.kind, "attendance")
  assert.equal(parsed.operationId, null)
  assert.equal(parsed.roleAtTime, null)
  const envelope = {
    ...page,
    events: [attendance],
    sources: [{ ...page.sources[0], source: "audit.attendance" }],
    grouping: {
      scope: "page",
      eventCount: 1,
      operationCount: 0,
      ungroupedEventCount: 1,
    },
  }
  assert.equal(parseHistoryPage(envelope).operationCount, 0)
  assert.equal(parseHistoryPage(envelope).ungroupedEventCount, 1)
  for (const change of [
    {
      actor: {
        ...attendance.actor,
        roleAtTime: "ADMIN",
        roleEvidence: "recorded",
      },
    },
    { correlation: { operationId: operation } },
    { details: { ...attendance.details, changedFields: ["reason"] } },
    {
      sourceAction: "DELETE",
      eventName: "attendance_workday.delete",
      subject: { type: "attendance_workday", id: "workday" },
    },
  ])
    assert.throws(() => parseHistoryEvent({ ...attendance, ...change }))
  assert.throws(() =>
    parseHistoryPage({
      ...envelope,
      grouping: { ...envelope.grouping, operationCount: 1 },
    }),
  )
})
test("System Logs route and marked Shared navigation are exclusively current Superadmin", () => {
  for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"]) {
    const account = {
      role,
      isActive: true,
      accountDeletedAt: null,
      permissions: [],
    }
    assert.equal(canAccessRoute(account, "/system-logs"), role === "SUPERADMIN")
    assert.equal(
      getNavigationPolicies(account, "main").some(
        (p) => p.id === "system-logs",
      ),
      role === "SUPERADMIN",
    )
    if (role === "SUPERADMIN") {
      assert.equal(
        getNavigationPolicies(account, "main").find(
          (p) => p.id === "system-logs",
        ).navigation.label,
        "System Logs (Unavailable)",
      )
      assert.equal(getActiveWorkspaceModuleId(account, "/system-logs"), null)
    }
    assert.equal(
      canAccessRoute({ ...account, isActive: false }, "/system-logs"),
      false,
    )
    assert.equal(
      canAccessRoute(
        { ...account, accountDeletedAt: "2026-01-01" },
        "/system-logs",
      ),
      false,
    )
  }
})

test("shared history preserves all authorized workspace contexts and defaults once from origin", () => {
  const actor = {
    id: "root",
    role: "SUPERADMIN",
    isActive: true,
    accountDeletedAt: null,
    permissions: ["modules:access-all"],
  }
  for (const origin of [
    "administration",
    "people-hr",
    "service-operations",
    "project-management",
    "attendance-monitoring",
  ]) {
    assert.equal(
      resolveWorkspaceModuleId(actor, "/system-logs", origin),
      origin,
    )
    const filters = initialHistoryFilters(origin)
    assert.equal(filters.moduleId, origin)
    assert.equal(
      investigateHistoryOperation(
        {
          ...filters,
          actorId: "actor",
          subjectId: "subject",
          source: "audit.workforce-management",
        },
        operation,
      ).moduleId,
      origin,
    )
  }
  assert.equal(initialHistoryFilters(null).moduleId, "")
  assert.equal(resolveWorkspaceModuleId(actor, "/system-logs", "unknown"), null)
  const manual = {
    ...initialHistoryFilters("administration"),
    moduleId: "service-operations",
    actorId: "actor",
    subjectId: "subject",
    action: "PROFILE_UPDATED",
  }
  assert.deepEqual(investigateHistoryOperation(manual, operation), {
    ...manual,
    operationId: operation,
  })
  assert.equal(manual.operationId, "")
})

test("coverage catalog identifies scoped support, partial integration and unsupported registry modules", () => {
  assert.equal(historyModuleCoverage("administration").status, "supported")
  assert.equal(historyModuleCoverage("people-hr").status, "supported")
  assert.equal(historyModuleCoverage("service-operations").status, "partial")
  assert.match(
    historyModuleCoverage("").explanation,
    /not complete application-wide/,
  )
  for (const id of ["billing-finance"]) {
    assert.equal(historyModuleCoverage(id).readable, false)
    assert.match(
      historyModuleOptions().find((o) => o.value === id).label,
      /Not yet integrated/,
    )
  }
  assert.equal(historyModuleOptions().length, 7)
  assert.equal(historyModuleCoverage("attendance-monitoring").readable, true)
  assert.equal(historyModuleCoverage("attendance-monitoring").status, "partial")
  assert.equal(historyModuleCoverage("project-management").status, "partial")
  assert.equal(historyModuleCoverage("project-management").readable, true)
})
test("history filters serialize bounded UTC dates and preserve exact cursor", () => {
  const filters = {
    ...defaultHistoryFilters(new Date("2026-11-16T12:00:00Z")),
    moduleId: "people-hr",
    source: "audit.workforce-management",
    eventName: "team.lead_changed",
    action: "LEAD_CHANGED",
    actorId: "actor",
    subjectId: "team",
    subjectType: "team",
    operationId: operation,
  }
  const q = new URLSearchParams(historyQuery(filters, "signed+/cursor="))
  assert.equal(q.get("from"), "2026-11-10T00:00:00.000Z")
  assert.equal(q.get("to"), "2026-11-16T23:59:59.999Z")
  assert.equal(q.get("cursor"), "signed+/cursor=")
  for (const key of [
    "moduleId",
    "source",
    "eventName",
    "action",
    "actorId",
    "subjectId",
    "subjectType",
    "operationId",
  ])
    assert.equal(q.get(key), filters[key])
  for (const range of [
    { from: "2026-01-01", to: "2026-03-01" },
    { from: "2026-02-30", to: "2026-03-02" },
    { from: "2026-11-17", to: "2026-11-16" },
  ])
    assert.throws(
      () => historyQuery({ ...filters, ...range }),
      /UTC date range/,
    )
})
test("event detail projection preserves historical evidence and discards extra personal/raw fields", () => {
  const parsed = parseHistoryEvent({
    ...event,
    summary: "private-note",
    passwordHash: "secret",
    details: { ...event.details, raw: { email: "private" } },
  })
  assert.equal(parsed.actorId, "deleted-actor")
  assert.equal(parsed.roleAtTime, "ADMIN")
  assert.deepEqual(parsed.transitions, [
    { field: "role", before: "STAFF", after: "ADMIN" },
  ])
  assert.ok(!JSON.stringify(parsed).includes("private"))
  assert.ok(!JSON.stringify(parsed).includes("secret"))
  assert.equal(
    parseHistoryEvent({
      ...event,
      actor: { ...event.actor, roleAtTime: null, roleEvidence: "not-recorded" },
    }).roleAtTime,
    null,
  )
  assert.throws(
    () =>
      parseHistoryEvent({
        ...event,
        details: {
          ...event.details,
          changedFields: ["email"],
          transitions: { email: { before: "private", after: "personal" } },
        },
      }),
    /could not be verified/,
  )
  assert.throws(
    () => parseHistoryEvent({ ...event, eventId: "wrong-source:one" }),
    /could not be verified/,
  )
})
test("page counts and incomplete scan/unavailable pagination never imply global operation totals", () => {
  assert.equal(parseHistoryPage(page).eventCount, 1)
  assert.equal(canAdvanceHistory(parseHistoryPage(page)), true)
  const scan = parseHistoryPage({
    ...page,
    events: [],
    complete: false,
    sources: [
      { ...page.sources[0], reasonCode: "SCAN_CAP", omittedCount: 500 },
    ],
    grouping: { scope: "page", eventCount: 0, operationCount: 0 },
  })
  assert.equal(canAdvanceHistory(scan), true)
  const missing = parseHistoryPage({
    ...page,
    nextCursor: null,
    complete: false,
    sources: [
      {
        ...page.sources[0],
        status: "unavailable",
        reasonCode: "SOURCE_UNAVAILABLE",
        omittedCount: null,
      },
    ],
  })
  assert.equal(canAdvanceHistory(missing), false)
  assert.throws(() =>
    parseHistoryPage({
      ...page,
      grouping: { ...page.grouping, scope: "global" },
    }),
  )
  assert.throws(() => parseHistoryPage({ ...page, events: [event, event] }))
  assert.throws(() =>
    parseHistoryPage({
      ...page,
      grouping: { ...page.grouping, operationCount: 9 },
    }),
  )
})
test("API uses authenticated client and preserves safe 503 coverage while replacing pages", async (t) => {
  const filters = defaultHistoryFilters(new Date("2026-11-16T12:00:00Z"))
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options })
    return Response.json(
      {
        ...page,
        complete: false,
        nextCursor: null,
        sources: [
          {
            ...page.sources[0],
            status: "unavailable",
            reasonCode: "SOURCE_UNAVAILABLE",
            omittedCount: null,
          },
        ],
      },
      { status: 503 },
    )
  })
  const result = await loadHistory(
    { ...filters, operationId: operation },
    null,
    new AbortController().signal,
  )
  assert.equal(result.complete, false)
  assert.equal(result.sources[0].status, "unavailable")
  assert.match(calls[0].url, new RegExp(`/operations/${operation}\\?`))
  assert.equal(calls[0].options.cache, "no-store")
  assert.equal(
    new URL(calls[0].url, "http://test").searchParams.has("operationId"),
    false,
  )
})
