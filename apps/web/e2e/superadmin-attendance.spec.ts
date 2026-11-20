import { expect, test, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type {
  AttendanceAdjustment,
  AttendanceOverview,
  AttendanceWorkday,
} from "../src/features/attendance/api/attendance-api"

configureRegressionTest()
test.skip(live, "Attendance administration uses isolated API fixtures")
const stamp = "2026-11-14T08:00:00Z"
const leaveLogMessage = "Approved a leave request for Workforce Employee."

for (const width of [1440, 390]) {
  test(`Workforce Compliance uses the shared log viewer at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 })
    await restoreSession(page, "SUPERADMIN")
    await mockAttendance(page)
    await page.route("**/api/workforce-compliance-logs?**", (route) => {
      const query = new URL(route.request().url()).searchParams
      const events =
        query.get("source") === "policies"
          ? []
          : [
              {
                id: "leave-log",
                operationId: "operation-1",
                correlationId: "trace-1",
                source: "leave",
                event: "APPROVED",
                action: "Approved",
                outcome: "SUCCESS",
                actorId: "superadmin-1",
                actorRole: "SUPERADMIN",
                actor: {
                  id: "superadmin-1",
                  name: "Superadmin",
                  role: "SUPERADMIN",
                  attribution: "CURRENT",
                },
                message: leaveLogMessage,
                summaryDetail: null,
                target: {
                  id: "leave-1",
                  type: "Leave request",
                  label: "Workforce Employee",
                },
                subjectId: "leave-1",
                changes: [],
                effects: [
                  {
                    id: "leave-change",
                    action: "Approved",
                    target: {
                      id: "leave-1",
                      type: "Leave request",
                      label: null,
                    },
                    changes: [
                      {
                        field: "Status",
                        before: "SUBMITTED",
                        after: "APPROVED",
                      },
                    ],
                    notes: [
                      {
                        label: "Current employee name",
                        value: "Workforce Employee",
                      },
                    ],
                  },
                ],
                createdAt: stamp,
              },
            ]
      return route.fulfill({
        json: { events, total: events.length, page: 1, pageSize: 25 },
      })
    })
    await page.goto("/attendance/time-logs/overview")
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const sidebar = page.locator("#app-sidebar")
    await expect(
      sidebar.getByRole("link", { name: "Audit Trail", exact: true }),
    ).toBeVisible()
    await sidebar
      .getByRole("group", { name: "System Tool", exact: true })
      .getByRole("link", { name: "Workforce Logs", exact: true })
      .click()
    await expect(page).toHaveURL(/\/module\/attendance-monitoring\/logs$/)
    await expect(
      page.getByRole("heading", {
        name: "Workforce Logs",
        exact: true,
      }),
    ).toBeVisible()
    await page.getByLabel("Filter by time").click()
    await expect(page.getByRole("option")).toHaveText([
      "Last 30 days",
      "Last 7 days",
      "Last 24 hours",
    ])
    await page.keyboard.press("Escape")
    await page.getByLabel("Filter by area").click()
    await page.getByRole("option", { name: "Policies", exact: true }).click()
    await expect(
      page.getByText("No logs match your search and filters."),
    ).toBeVisible()
    await page.getByLabel("Filter by area").click()
    await page.getByRole("option", { name: "Leave", exact: true }).click()
    await expect(
      page.getByRole("cell").getByText(leaveLogMessage, { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: `View log: ${leaveLogMessage}` })
      .click()
    const drawer = page.getByRole("dialog")
    await expect(
      drawer.getByRole("heading", { name: "Leave request", exact: true }),
    ).toBeVisible()
    await expect(drawer.getByText("SUBMITTED → APPROVED")).toBeVisible()
    await expect(drawer.getByText("trace-1", { exact: true })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

const employees = [
  {
    id: "design-employee",
    employeeId: "EMP-1",
    fullName: "Design Employee",
    departmentId: "design",
  },
  {
    id: "engineering-employee",
    employeeId: "EMP-2",
    fullName: "Engineering Employee",
    departmentId: "engineering",
  },
]
const overview: AttendanceOverview = {
  asOf: stamp,
  scope: "ORGANIZATION",
  recordedDays: 2,
  employees: 2,
  workedHours: 20,
  requiredHours: 16,
  completeDays: 2,
  activeSessions: 0,
  excessDays: 2,
  pendingCorrections: 1,
  overnightReviews: 2,
  statusBreakdown: {
    COMPLETE: 2,
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    HOURS_MET: 0,
    INCOMPLETE: 0,
    NOT_REQUIRED: 0,
  },
  checkIns: {
    employees: 2,
    total: 2,
    closed: 2,
    working: 0,
    onBreak: 0,
    recentActivity: [
      {
        id: "activity",
        employeeName: "Engineering Employee",
        action: "CLOCK_OUT",
        at: stamp,
      },
    ],
  },
}
const workdays: AttendanceWorkday[] = employees.map((employee, index) => ({
  employee,
  id: `day-${index}`,
  employeeId: employee.id,
  workDate: "2026-11-13",
  timeZone: "Asia/Manila",
  isWorkingDay: true,
  requiredMinutes: 480,
  workedMilliseconds: 36000000,
  workedHours: 10,
  remainingMinutes: 0,
  excessMinutes: 120,
  excessRequiresReview: true,
  progressPercent: 100,
  status: "COMPLETE",
  isComplete: true,
  activeSessionId: null,
  activeBreakId: null,
  pendingCorrections: 0,
  policy: {
    id: "policy",
    name: "Flexible policy",
    unpaidBreaksEnabled: true,
    overnightRequiresReview: true,
  },
  overnightRequiresReview: true,
  sessions: [
    {
      id: `session-${index}`,
      startedAt: "2026-11-13T20:00:00+08:00",
      endedAt: "2026-11-14T06:00:00+08:00",
      breaks: [],
    },
  ],
}))
const correction: AttendanceAdjustment = {
  id: "correction",
  type: "CORRECTION",
  employeeId: employees[0].id,
  employee: employees[0],
  sessionId: null,
  reason: "Missing attendance",
  requestedById: "staff",
  createdAt: stamp,
  proposedStartedAt: stamp,
  proposedEndedAt: stamp,
  status: "PENDING",
  overtimeMinutes: 0,
  reviewedBy: null,
  reviewNote: null,
  verifiedById: null,
  verificationNote: null,
  capabilities: { approve: true, verify: false, reject: true },
}
const overtime: AttendanceAdjustment = {
  ...correction,
  id: "overtime",
  type: "OVERTIME",
  employeeId: employees[1].id,
  employee: employees[1],
  overtimeMinutes: 120,
  reason: "Recorded excess time",
  capabilities: { approve: false, verify: false, reject: true },
}

async function mockAttendance(page: Page, allowReview = true) {
  const reads: URL[] = []
  const writes: string[] = []
  await page.route("**/api/leave/overview?**", (route) =>
    route.fulfill({ json: { groups: [] } }),
  )
  await page.route("**/api/attendance/**", (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== "GET") {
      writes.push(url.pathname)
      return route.fulfill({
        status: 403,
        json: { error: "No fixture writes" },
      })
    }
    reads.push(url)
    const path = url.pathname
    const json = path.endsWith("/departments")
      ? {
          departments: [
            { id: "design", name: "Design" },
            { id: "engineering", name: "Engineering" },
          ],
        }
      : path.endsWith("/employees")
        ? { employees, total: 2, page: 1, pageSize: 10 }
        : path.endsWith("/adjustments/overview")
          ? {
              groups: [
                {
                  type: "CORRECTION",
                  status: "PENDING",
                  count: 1,
                  overtimeMinutes: 0,
                },
                {
                  type: "OVERTIME",
                  status: "PENDING",
                  count: 1,
                  overtimeMinutes: 120,
                },
              ],
            }
          : path.endsWith("/adjustments")
            ? {
                adjustments: [
                  url.searchParams.get("type") === "OVERTIME"
                    ? overtime
                    : correction,
                ].map((item) =>
                  allowReview
                    ? item
                    : {
                        ...item,
                        capabilities: {
                          approve: false,
                          verify: false,
                          reject: false,
                        },
                      },
                ),
                capabilities: { requestCorrection: false },
                total: 1,
                page: 1,
                pageSize: 10,
              }
            : path.endsWith("/policies")
              ? {
                  policies: [
                    {
                      id: "policy",
                      name: "Flexible policy",
                      timeZone: "Asia/Manila",
                      unpaidBreaksEnabled: true,
                      overnightRequiresReview: true,
                      days: Array.from({ length: 7 }, (_, weekday) => ({
                        weekday,
                        isWorkingDay: true,
                        requiredMinutes: 480,
                      })),
                      _count: { assignments: 2 },
                    },
                  ],
                  summary: {
                    totalPolicies: 1,
                    activePolicies: 1,
                    archivedPolicies: 0,
                    assignmentPeriods: 2,
                  },
                }
              : path.endsWith("/assignments")
                ? {
                    assignments: employees.map((employee) => ({
                      id: employee.id,
                      employee: {
                        ...employee,
                        department: { name: employee.departmentId },
                      },
                      effectiveFrom: "2026-01-01",
                      effectiveUntil: null,
                      status: "CURRENT",
                    })),
                    total: 2,
                    page: 1,
                    pageSize: 10,
                  }
                : path.endsWith("/audit")
                  ? {
                      asOf: stamp,
                      events: [],
                      total: 0,
                      page: 1,
                      pageSize: 10,
                      actionCounts: [],
                    }
                  : path.endsWith("/records")
                    ? { asOf: stamp, workdays, total: 2, page: 1, pageSize: 10 }
                    : overview
    return route.fulfill({ json })
  })
  return { reads, writes }
}

for (const width of [1440, 390])
  test(`Superadmin uses existing attendance administration without self-service at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await restoreSession(page, "SUPERADMIN")
    const { reads, writes } = await mockAttendance(page)
    await page.goto("/module")
    if (width === 390)
      await page
        .getByRole("button", { name: "Next module", exact: true })
        .click()
    await page
      .getByRole("link", {
        name: "Open Workforce Compliance workspace",
        exact: true,
      })
      .click()
    await expect(page).toHaveURL(/\/attendance\/time-logs\/overview$/)
    await expect(
      page.getByRole("heading", {
        name: "Time Logs Overview",
        exact: true,
      }),
    ).toBeVisible()
    await page.goto("/attendance")
    await expect(page).toHaveURL(/\/attendance\/time-logs\/overview$/)
    await page.goto("/attendance/time-logs/records")
    await page.getByRole("button", { name: "All logs", exact: true }).click()
    await expect(
      page
        .getByRole("table", { name: "Attendance history", exact: true })
        .getByText("Engineering Employee", { exact: true }),
    ).toBeVisible()
    await page.goto("/attendance/requests/overview")
    await expect(
      page.getByRole("button", { name: "My requests", exact: true }),
    ).toHaveCount(0)
    await page.goto("/attendance/requests/corrections")
    await expect(
      page.getByRole("button", { name: "Request correction", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "My requests", exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole("button", {
        name: "More actions for Design Employee's request",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Approve request", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("menuitem", { name: "View details", exact: true })
      .click()
    await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(0)
    await page
      .getByRole("button", { name: "Close request details", exact: true })
      .click()
    await page.goto("/attendance/requests/overtime")
    await page
      .getByRole("button", {
        name: "More actions for Engineering Employee's request",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Approve request", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("menuitem", { name: "Verify overtime", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("menuitem", { name: "Reject request", exact: true }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await page.goto("/attendance/policies/management")
    await page
      .getByRole("button", {
        name: "More actions for Flexible policy",
        exact: true,
      })
      .click()
    await page
      .getByRole("menuitem", { name: "View policy details", exact: true })
      .click()
    await page
      .getByRole("tab", { name: "Assigned people", exact: true })
      .click()
    await expect(
      page.getByText("Engineering Employee", { exact: true }),
    ).toBeVisible()
    for (const path of [
      "/attendance/overview",
      "/attendance/check-ins",
      "/attendance/my",
    ]) {
      await page.goto(path)
      await expect(page).not.toHaveURL(new RegExp(`${path}$`))
      await expect(
        page.getByRole("button", { name: "Clock in", exact: true }),
      ).toHaveCount(0)
    }
    expect(
      reads.some(
        (url) =>
          url.pathname.includes("/me/") ||
          url.searchParams.get("scope") === "mine",
      ),
    ).toBe(false)
    expect(writes).toEqual([])
  })

test("backend-denied review capabilities override privileged menu assumptions", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await mockAttendance(page, false)
  await page.goto("/attendance/requests/corrections")
  await page
    .getByRole("button", {
      name: "More actions for Design Employee's request",
      exact: true,
    })
    .click()
  await expect(page.getByRole("menuitem")).toHaveCount(1)
  await expect(
    page.getByRole("menuitem", { name: "View details", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: /approve|verify|reject/i }),
  ).toHaveCount(0)
})

for (const scenario of [
  { name: "Admin", role: "ADMIN", head: false, manager: true },
  { name: "Department Head", role: "STAFF", head: true, manager: true },
  { name: "Staff", role: "STAFF", head: false, manager: false },
] as const)
  test(`${scenario.name} retains personal request controls and permitted review scope`, async ({
    page,
  }) => {
    await restoreSession(page, scenario.role, {
      account: {
        headOf: scenario.head ? { id: "design", name: "Design" } : null,
      },
    })
    await mockAttendance(page)
    const scopes: string[] = []
    await page.route("**/api/attendance/adjustments?**", (route) => {
      const scope = new URL(route.request().url()).searchParams.get("scope")!
      scopes.push(scope)
      return route.fulfill({
        json: {
          adjustments: [
            {
              ...correction,
              capabilities: {
                approve: scenario.manager && scope === "team",
                verify: false,
                reject: scenario.manager && scope === "team",
              },
            },
          ],
          capabilities: { requestCorrection: true },
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })
    })
    await page.goto("/attendance/requests/corrections")
    await expect(
      page.getByRole("button", { name: "Request correction", exact: true }),
    ).toBeVisible()
    expect(scopes.at(-1)).toBe(scenario.manager ? "team" : "mine")
    if (scenario.manager) {
      await page
        .getByRole("button", { name: "My requests", exact: true })
        .click()
      await expect.poll(() => scopes.at(-1)).toBe("mine")
      await expect(
        page.getByRole("button", { name: "Request correction", exact: true }),
      ).toBeVisible()
    }
    await page
      .getByRole("button", {
        name: "More actions for Design Employee's request",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: /approve|verify|reject/i }),
    ).toHaveCount(0)
  })
