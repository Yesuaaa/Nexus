import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type { ProjectManagementOverview } from "../src/features/admin-project-management/api/project-management-api"

configureRegressionTest()
test.skip(live, "Module entry coverage uses isolated API fixtures")

const emptyProjectManagementOverview: ProjectManagementOverview = {
  totals: {
    totalProjects: 0,
    planned: 0,
    inProgress: 0,
    onHold: 0,
    completed: 0,
    cancelled: 0,
    workspaceGroups: 0,
    departmentsWithProjects: 0,
    projectsWithoutDepartment: 0,
    projectsWithTasks: 0,
    projectsWithoutTasks: 0,
    totalTasks: 0,
    completedTasks: 0,
    activeProjects: 0,
    activeProjectsWithoutLead: 0,
    activeProjectsWithoutTeam: 0,
    activeAssignments: 0,
  },
  statusDistribution: [],
  departments: [],
  topStaffAssignments: [],
  recentlyUpdatedProjects: [],
}

for (const [title, path, heading] of [
  ["Service Operations", "/services", "Service Management"],
  ["Project Management", "/project-management/overview", "Project Overview"],
  ["People & HR", "/employees", "Employee Management"],
  [
    "Workforce Compliance",
    "/attendance/time-logs/overview",
    "Time Logs Overview",
  ],
  ["Administration", "/accounts", "Account Management"],
] as const) {
  test(`Superadmin selects and enters ${title}`, async ({ page }) => {
    await restoreSession(page, "SUPERADMIN")
    if (title === "Project Management")
      await page.route("**/api/project-management/overview", (route) =>
        route.fulfill({ json: emptyProjectManagementOverview }),
      )
    const personalReads: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/api/attendance/me/"))
        personalReads.push(request.url())
    })
    await page.route("**/api/attendance/**", async (route) => {
      const path = new URL(route.request().url()).pathname
      const overview = {
        asOf: "2026-11-14T00:00:00.000Z",
        scope: "ORGANIZATION",
        employees: 0,
        recordedDays: 0,
        workedHours: 0,
        requiredHours: 0,
        completeDays: 0,
        activeSessions: 0,
        excessDays: 0,
        pendingCorrections: 0,
        overnightReviews: 0,
        statusBreakdown: {},
        checkIns: {
          employees: 0,
          total: 0,
          closed: 0,
          working: 0,
          onBreak: 0,
          recentActivity: [],
        },
      }
      await route.fulfill({
        json: path.endsWith("/departments")
          ? { departments: [] }
          : path.endsWith("/policies")
            ? {
                policies: [],
                summary: {
                  totalPolicies: 0,
                  activePolicies: 0,
                  archivedPolicies: 0,
                  assignmentPeriods: 0,
                },
              }
            : path.endsWith("/audit")
              ? { audit: [], total: 0, actionCounts: [] }
              : path.includes("/adjustments/")
                ? { groups: [] }
                : overview,
      })
    })
    await page.goto("/module")
    const entry = page.getByRole("link", {
      name: `Open ${title} workspace`,
      exact: true,
    })
    await entry.focus()
    await entry.click()
    await expect(page).toHaveURL(path)
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible()
    if (path === "/attendance/time-logs/overview") {
      await page.goto("/attendance")
      await expect(page).toHaveURL(/\/attendance\/time-logs\/overview$/)
    }
    expect(personalReads).toEqual([])
  })
}

test("Superadmin enters Project Management without Staff reads and retains module navigation", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/project-management/overview", (route) =>
    route.fulfill({ json: emptyProjectManagementOverview }),
  )
  const operationalReads: string[] = []
  await page.route("**/api/projects/calendar**", (route) =>
    route.fulfill({
      json: { events: [], organization: true, canViewTeam: true },
    }),
  )
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (
      /^\/api\/(project-workspace|request-inbox|workload|attendance\/me)(\/|$)/.test(
        path,
      )
    )
      operationalReads.push(path)
  })
  await page.goto("/module")
  const entry = page.getByRole("link", {
    name: "Open Project Management workspace",
    exact: true,
  })
  await entry.focus()
  await entry.click()
  await expect(page).toHaveURL("/project-management/overview")
  await expect(
    page.getByRole("heading", {
      name: "Project Overview",
      exact: true,
    }),
  ).toBeVisible()
  const menu = page.getByRole("complementary", { name: "Primary navigation" })
  await expect(
    menu.getByRole("link", { name: "Project Workspace overview", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    menu.getByRole("link", { name: "Project Workspace", exact: true }),
  ).toHaveCount(0)
  await expect(
    menu.getByRole("link", { name: "Staff Workload", exact: true }),
  ).toHaveCount(0)
  await menu.getByRole("link", { name: "Calendar", exact: true }).click()
  await expect(
    menu.getByText("Project Management", { exact: true }),
  ).toBeVisible()
  const projectWorkspace = menu.getByRole("button", {
    name: "Project Workspace",
    exact: true,
  })
  if ((await projectWorkspace.getAttribute("aria-expanded")) === "false")
    await projectWorkspace.click()
  await menu
    .getByRole("link", { name: "Project Workspace overview", exact: true })
    .click()
  await expect(
    page.getByRole("heading", {
      name: "Project Overview",
      exact: true,
    }),
  ).toBeVisible()
  expect(operationalReads).toEqual([])
})

test("backend denial prevents administrative entry content even when the browser has a capability", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/modules/project-management", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Administrative module access is required" },
    }),
  )
  await page.goto("/module/project-management")
  await expect(
    page
      .getByRole("alert")
      .getByText("Administrative module access is required", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Project Management", exact: true }),
  ).toHaveCount(0)
})

for (const [role, width, readOnly] of [
  ["ADMIN", 390, false],
  ["SUPERADMIN", 1440, true],
] as const)
  test(`${role} opens Payroll from People & HR at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await restoreSession(page, role)
    await page.goto("/module")

    const payroll = page.getByRole("link", {
      name: "Open Payroll workspace",
      exact: true,
    })
    await expect(payroll).toHaveCount(0)
    await page.getByRole("link", { name: "Open People & HR workspace" }).click()
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const sidebar = page.getByRole("complementary", {
      name: "Primary navigation",
    })
    await expect(sidebar).toContainText("People & HR")
    await expect(sidebar).not.toContainText("Workforce Compliance")
    await sidebar.getByRole("button", { name: "Payroll", exact: true }).click()
    const payrollOverview = sidebar.getByRole("link", {
      name: "Payroll overview",
      exact: true,
    })
    await expect(payrollOverview).toHaveAttribute("href", "/module/payroll")
    await payrollOverview.click()
    await expect(page).toHaveURL("/module/payroll")
    await expect(
      page.getByRole("heading", { name: "Payroll Management", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText("People & HR")
    await expect(
      page.getByRole("heading", {
        name: "Configure compensation and schedules",
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByText("Read only", { exact: true })).toHaveCount(
      readOnly ? 1 : 0,
    )

    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const overview = sidebar.getByRole("link", {
      name: "Payroll overview",
      exact: true,
    })
    await expect(overview).toHaveAttribute("aria-current", "page")
    const sections = [
      "Compensation",
      "Settings",
      "Payroll Runs",
      "Approvals",
      "Disbursements",
      "Payslips & History",
    ]
    for (const section of sections) {
      const link = sidebar.getByRole("link", { name: section, exact: true })
      await expect(link).toBeVisible()
      await expect(link).not.toHaveAttribute("aria-disabled", "true")
    }
    if (width >= 768) {
      await page.getByRole("button", { name: "Collapse sidebar" }).click()
      await sidebar
        .getByRole("button", { name: "Payroll", exact: true })
        .click()
      const flyout = page.getByRole("menu")
      for (const section of sections) {
        const item = flyout.getByRole("menuitem", { name: section })
        await expect(item).toBeVisible()
        await expect(item).not.toHaveAttribute("aria-disabled", "true")
      }
      await page.keyboard.press("Escape")
      await page.getByRole("button", { name: "Expand sidebar" }).click()
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

for (const role of ["STAFF", "USER"] as const)
  test(`${role} cannot open the administrative Payroll route`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    const reads: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/api/modules/payroll"))
        reads.push(request.url())
    })
    await page.goto("/module/payroll")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    expect(reads).toEqual([])
    await expect(
      page.getByRole("heading", { name: "Payroll Management", exact: true }),
    ).toHaveCount(0)
  })

test("an unauthenticated visitor cannot open the administrative Payroll route", async ({
  page,
}) => {
  await page.goto("/module/payroll")
  await expect(page).toHaveURL(/\/(login|internal\/login)$/)
  await expect(
    page.getByRole("heading", { name: "Payroll Management", exact: true }),
  ).toHaveCount(0)
})

for (const role of ["ADMIN", "STAFF", "USER"] as const)
  test(`${role} cannot enter the global administrative module route`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    const reads: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/api/modules/")) reads.push(request.url())
    })
    await page.goto("/module/project-management")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    expect(reads).toEqual([])
  })

test("unknown and unavailable module routes disclose no administrative entry", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  for (const id of ["unknown-module", "billing-finance"]) {
    await page.goto(`/module/${id}`)
    await expect(
      page.getByRole("main", { name: "Administrative workspace" }),
    ).toHaveCount(0)
  }
})
