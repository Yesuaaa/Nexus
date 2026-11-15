import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
  accountFor,
} from "./regression-support"
import { Permissions } from "../src/features/auth/model/permissions"
import type { Employee } from "../src/features/employees/api/employees-api"

configureRegressionTest()
test.skip(live, "People and HR coverage uses isolated management fixtures")

const employees: Employee[] = [
  "Design Specialist",
  "Engineering Specialist",
  "HR Administrator",
].map((fullName, index) => ({
  id: `hr-${index}`,
  accountId: `hr-account-${index}`,
  accountRole: index === 2 ? "ADMIN" : "STAFF",
  hasEmployeeRecord: true,
  employeeId: `EXP-HR-${index}`,
  fullName,
  email: `hr-${index}@example.test`,
  contactNumber: "09123456789",
  position: "Specialist",
  employmentType: "FULL_TIME",
  status: "ACTIVE",
  startDate: "2026-01-01",
  departmentId: index === 1 ? "engineering" : "design",
  teamId: null,
  department: {
    id: index === 1 ? "engineering" : "design",
    name: index === 1 ? "Engineering" : "Design",
    code: null,
    color: "blue",
  },
  team: null,
  hasAccount: true,
  accountIsActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}))
const departments = ["Design", "Engineering"].map((name) => ({
  id: name.toLowerCase(),
  name,
  color: "blue" as const,
  code: null,
  description: null,
  headId: null,
  head: null,
  memberCount: name === "Design" ? 2 : 1,
  teamCount: 1,
  serviceCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}))

for (const width of [1440, 390])
  test(`Superadmin enters existing HR management and inspects departments and teams at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await restoreSession(page, "SUPERADMIN", {
      initialEmployees: employees,
      initialDepartments: departments,
    })
    const operational: string[] = []
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname
      if (
        /^\/api\/(?:attendance\/me|workload|project-workspace)(\/|$)/.test(path)
      )
        operational.push(path)
    })
    await page.route("**/api/departments/design", (route) =>
      route.fulfill({
        json: {
          department: {
            ...departments[0],
            members: [],
            teams: [
              {
                id: "team-design",
                name: "Design Team",
                description: null,
                departmentId: "design",
                leadId: null,
                lead: null,
                memberCount: 0,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ],
          },
        },
      }),
    )
    await page.goto("/module")
    await page
      .getByRole("link", { name: "Open People & HR workspace", exact: true })
      .click()
    await expect(page).toHaveURL(/\/employees$/)
    await expect(
      page.getByRole("button", { name: "Create Employee", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Design Specialist", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Engineering Specialist", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("row")
      .filter({ hasText: "HR Administrator" })
      .scrollIntoViewIfNeeded()
    await page
      .getByRole("button", {
        name: "More actions for HR Administrator",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Edit", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", {
        name: /deactivate|reactivate|delete account|create login/i,
      }),
    ).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page
      .getByRole("row")
      .filter({ hasText: "Design Specialist" })
      .scrollIntoViewIfNeeded()
    await page
      .getByRole("button", {
        name: "More actions for Design Specialist",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Deactivate account", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
    await page
      .getByRole("menuitem", { name: "View Employee", exact: true })
      .click()
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Edit employee", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Close employee details", exact: true })
      .click()
    await page.goto("/employees/overview")
    await expect(
      page.getByRole("link", { name: "Manage employees", exact: true }),
    ).toBeVisible()
    await page.goto("/departments")
    await expect(
      page.getByRole("button", { name: "Create Department", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Actions for Design", exact: true })
      .click()
    await page
      .getByRole("menuitem", { name: "View Department", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("tab", { name: "Teams", exact: true })
      .click()
    await expect(
      page.getByRole("dialog").getByText("Design Team", { exact: true }),
    ).toBeVisible()
    await page.goto("/departments/overview")
    await expect(
      page.getByRole("link", { name: "Manage departments", exact: true }),
    ).toBeVisible()
    expect(operational).toEqual([])
  })

test("read permission alone exposes employee inspection without management or login actions", async ({
  page,
}) => {
  const permissions = accountFor("SUPERADMIN").permissions.filter(
    (value) => value !== Permissions.EMPLOYEES_MANAGE,
  )
  await restoreSession(page, "SUPERADMIN", {
    account: { permissions },
    initialEmployees: employees,
    initialDepartments: departments,
  })
  await page.goto("/employees")
  await expect(
    page.getByRole("button", { name: "Create Employee", exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole("button", {
      name: "More actions for Design Specialist",
      exact: true,
    })
    .click()
  await expect(page.getByRole("menuitem")).toHaveCount(1)
  await page
    .getByRole("menuitem", { name: "View Employee", exact: true })
    .click()
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Edit employee", exact: true }),
  ).toHaveCount(0)
})

for (const role of ["STAFF", "USER"] as const)
  test(`${role} gains no employee or department management page access`, async ({
    page,
  }) => {
    await restoreSession(page, role, {
      account: {
        headOf: role === "STAFF" ? { id: "design", name: "Design" } : null,
      },
    })
    const reads: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/employees")
        reads.push(request.url())
    })
    for (const path of [
      "/employees",
      "/employees/overview",
      "/departments",
      "/departments/overview",
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(
        role === "USER" ? /\/dashboard$/ : /\/module$/,
      )
    }
    expect(reads).toEqual([])
  })
