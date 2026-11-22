import { expect, test } from "@playwright/test"
import type { AuditLog } from "../src/features/audit-logs/api/audit-logs-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Uses isolated People & HR history fixtures")

const message =
  "Created an employee record and Staff login for “Staff account”."
const independentMessage = "Changed the HR status to Inactive."
const log: AuditLog = {
  id: "operation-1",
  operationId: "operation-1",
  source: "EMPLOYEE_MANAGEMENT",
  event: "CREATED",
  action: "Created",
  outcome: "SUCCESS",
  actorId: "admin-1",
  actorRole: "ADMIN",
  actor: {
    name: "HR Administrator",
    id: "admin-1",
    role: "ADMIN",
    attribution: "CURRENT",
  },
  target: { id: "staff-1", label: "Staff account", type: "Staff login" },
  subjectId: "staff-1",
  message,
  summaryDetail: null,
  effects: [
    {
      id: "account-change",
      action: "Created",
      target: { id: "staff-1", label: "Staff account", type: "Staff login" },
      changes: [{ field: "Login enabled", before: null, after: true }],
      notes: [],
    },
    {
      id: "employee-change",
      action: "Created",
      target: { id: "employee-1", label: null, type: "Employee" },
      changes: [{ field: "Email" }],
      notes: [],
    },
    {
      id: "employee-assignment",
      action: "Assigned department",
      target: { id: "employee-1", label: null, type: "Employee" },
      changes: [
        { field: "Department ID", before: null, after: "department-1" },
      ],
      notes: [],
    },
  ],
  changes: [],
  createdAt: "2025-01-01T12:00:00.000Z",
  correlationId: null,
  endpoint: null,
  requestId: null,
  status: null,
  failureCode: null,
  failureReason: null,
}

const independentLog: AuditLog = {
  ...log,
  id: "operation-2",
  operationId: "operation-2",
  event: "STATUS_CHANGED",
  action: "Changed status",
  message: independentMessage,
  target: { id: "employee-1", label: null, type: "Employee" },
  subjectId: "employee-1",
  effects: [
    {
      id: "employee-status-change",
      action: "Changed status",
      target: { id: "employee-1", label: null, type: "Employee" },
      changes: [{ field: "HR status", before: "ACTIVE", after: "INACTIVE" }],
      notes: [],
    },
  ],
}

for (const width of [1440, 390]) {
  test(`People & HR logs reuse the workspace audit layout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await restoreSession(page, "SUPERADMIN")
    await page.route("**/api/people-hr-logs?**", (route) => {
      const query = new URL(route.request().url()).searchParams
      const matches =
        !query.has("search") || query.get("search") === "employee-1"
      const events = matches ? [log, independentLog] : []
      return route.fulfill({
        json: {
          total: events.length,
          events,
          page: 1,
          pageSize: 25,
          retentionDays: null,
        },
      })
    })
    await page.goto("/employees")
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const menu = page.locator('#app-sidebar nav[aria-label="Main menu"]')
    const systemTool = menu.getByRole("group", {
      name: "System Tool",
      exact: true,
    })
    await expect(systemTool.locator('a[href$="/logs"]')).toHaveCount(1)
    await systemTool
      .getByRole("link", { name: "People & HR Logs", exact: true })
      .click()
    await expect(page).toHaveURL(/\/module\/people-hr\/logs$/)
    await expect(
      page.getByRole("heading", { name: "People & HR Logs", exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel("Filter by time")).toHaveText("Last 30 days")
    await expect(page.getByLabel("Filter by outcome")).toHaveCount(0)
    await expect(page.getByLabel("Filter by action")).toHaveText("All actions")
    await expect(page.getByLabel("Filter by area")).toHaveText("All areas")
    await expect(
      page.getByRole("button", { name: "Refresh", exact: true }),
    ).toHaveCount(0)
    await expect(page.getByLabel("Actor account ID")).toHaveCount(0)
    await expect(page.getByLabel("Affected record ID")).toHaveCount(0)

    const search = page.getByRole("searchbox", { name: "Search logs" })
    await search.fill("missing")
    await expect(
      page.getByText("No logs match your search and filters."),
    ).toBeVisible()
    await search.fill("employee-1")
    await expect(page.getByRole("button", { name: /^View log:/ })).toHaveCount(
      2,
    )
    await expect(
      page.getByText("3 recorded changes", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("cell").getByText(independentMessage, { exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: `View log: ${message}` }).click()
    const details = page.getByRole("dialog")
    await expect(
      details.getByRole("heading", { name: "Recorded changes" }),
    ).toBeVisible()
    await expect(
      details.getByRole("heading", { name: "Staff login", exact: true }),
    ).toBeVisible()
    const employeeChange = details.getByRole("heading", {
      name: "Employee",
      exact: true,
    })
    await expect(employeeChange).toHaveCount(1)
    await expect(
      employeeChange.locator("..").getByText("Assigned department"),
    ).toBeVisible()
    await expect(
      employeeChange.locator("..").getByText("Not set → department-1"),
    ).toBeVisible()
    await expect(employeeChange.locator("..")).toHaveCSS(
      "border-top-width",
      "0px",
    )
    await expect(details.getByText("Not set → Yes")).toBeVisible()
    await expect(details.getByText("Changed", { exact: true })).toBeVisible()
    await expect(
      details.getByText("operation-1", { exact: true }),
    ).toBeVisible()
    await expect(
      details.getByText("Correlation ID", { exact: true }),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await details
      .getByRole("button", { name: "Close log details", exact: true })
      .click()
    await page
      .getByRole("button", { name: `View log: ${independentMessage}` })
      .click()
    await expect(
      details.getByText("ACTIVE → INACTIVE", { exact: true }),
    ).toBeVisible()
    await expect(
      details.getByText("operation-2", { exact: true }),
    ).toBeVisible()
  })
}
