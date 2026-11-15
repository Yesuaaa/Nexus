import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Module entry coverage uses isolated API fixtures")

for (const [title, path, heading] of [
  ["Service Operations", "/services", "Service Management"],
  [
    "Project Management",
    "/project-management/overview",
    "Project Management Overview",
  ],
  ["People & HR", "/employees", "Employee Management"],
  [
    "Attendance & Monitoring",
    "/attendance/dashboard",
    "Attendance & Monitoring Dashboard",
  ],
  ["Administration", "/accounts", "Account Management"],
] as const) {
  test(`Superadmin selects and enters ${title}`, async ({ page }) => {
    await restoreSession(page, "SUPERADMIN")
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
    if (path === "/attendance/dashboard") {
      await page.goto("/attendance")
      await expect(page).toHaveURL(/\/attendance\/dashboard$/)
    }
    expect(personalReads).toEqual([])
  })
}

test("Superadmin enters Project Management without Staff reads and retains module navigation", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
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
      name: "Project Management Overview",
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
      name: "Project Management Overview",
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
