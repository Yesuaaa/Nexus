import { expect, test, type Page } from "@playwright/test"
import type { Employee } from "../src/features/employees/api/employees-api"

test.use({ viewport: { width: 1600, height: 1000 } })

async function setup(page: Page, role = "ADMIN", failFirstList = false) {
  const department = {
    id: "product",
    name: "Product",
    code: "PROD",
    description: null,
    headId: null,
    head: null,
    memberCount: 1,
    teamCount: 1,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  }
  const initial: Employee = {
    id: "employee-jamie",
    employeeId: "EMP-1001",
    fullName: "Jamie Rivera",
    email: "jamie@example.com",
    contactNumber: "+63 912 345 6789",
    position: "Product Designer",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    startDate: "2026-01-15T00:00:00.000Z",
    departmentId: "product",
    department,
    teamId: null,
    team: null,
    hasAccount: true,
    accountIsActive: true,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  }
  let employees = [
    initial,
    {
      ...initial,
      id: "employee-robin",
      employeeId: "EMP-1002",
      fullName: "Robin Santos",
      email: null,
      departmentId: null,
      department: null,
      status: "ON_LEAVE" as const,
    },
  ]
  const mutations: { method: string; body: Record<string, unknown> }[] = []
  const searches: string[] = []
  let fail = failFirstList
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const path = url.pathname
    if (path === "/api/auth/me") {
      return route.fulfill({
        json: {
          user: {
            id: "actor",
            fullName: "Admin User",
            email: "admin@example.com",
            role,
            isActive: true,
            contactNumber: null,
            createdAt: "2026-10-01T00:00:00Z",
            permissions: [
              "dashboard:read",
              "profile:read",
              "accounts:read",
              "departments:read",
              "departments:manage",
              ...(role === "ADMIN"
                ? ["employees:read", "employees:manage"]
                : []),
            ],
          },
        },
      })
    }
    if (path === "/api/departments")
      return route.fulfill({ json: { departments: [department] } })
    if (path === "/api/departments/product")
      return route.fulfill({
        json: {
          department: {
            ...department,
            members: employees.filter(
              (employee) => employee.departmentId === "product",
            ),
            teams: [
              {
                id: "team-product",
                name: "Design",
                description: null,
                departmentId: "product",
                leadId: null,
                lead: null,
                memberCount: 0,
                createdAt: initial.createdAt,
                updatedAt: initial.updatedAt,
              },
            ],
          },
        },
      })
    if (path === "/api/employees" && method === "GET") {
      if (fail) {
        fail = false
        return route.fulfill({
          status: 503,
          json: { error: "Employee records are temporarily unavailable." },
        })
      }
      const search = url.searchParams.get("search") ?? ""
      searches.push(search)
      const matching = employees.filter(
        (employee) =>
          (!search ||
            `${employee.fullName} ${employee.employeeId}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!url.searchParams.get("status") ||
            employee.status === url.searchParams.get("status")) &&
          (!url.searchParams.get("departmentId") ||
            employee.departmentId === url.searchParams.get("departmentId")) &&
          (!url.searchParams.get("employmentType") ||
            employee.employmentType === url.searchParams.get("employmentType")),
      )
      return route.fulfill({
        json: {
          employees: matching,
          total: matching.length,
          page: Number(url.searchParams.get("page") ?? 1),
          pageSize: 20,
        },
      })
    }
    if (path === "/api/employees" && method === "POST") {
      const body = route.request().postDataJSON()
      mutations.push({ method, body })
      const employee = {
        ...initial,
        ...body,
        id: "employee-created",
        department: body.departmentId ? department : null,
      }
      employees = [employee, ...employees]
      return route.fulfill({ status: 201, json: { employee } })
    }
    if (path.startsWith("/api/employees/")) {
      if (path.endsWith("/status-options"))
        return route.fulfill({
          json: {
            isDepartmentHead: false,
            replacementCandidates: [],
            recommendedReplacementEmployeeId: null,
            willRestoreOriginalHead: false,
          },
        })
      const index = employees.findIndex(
        (employee) => employee.id === path.split("/").at(-1),
      )
      if (index < 0)
        return route.fulfill({
          status: 404,
          json: { error: "Employee not found" },
        })
      if (method === "PUT") {
        const body = route.request().postDataJSON()
        mutations.push({ method, body })
        employees[index] = { ...employees[index], ...body }
      }
      return route.fulfill({ json: { employee: employees[index] } })
    }
    return route.fulfill({
      status: 404,
      json: { error: `Unexpected test request: ${method} ${path}` },
    })
  })
  return { mutations, searches }
}

test("Admin directory, filters, retry and whitespace search stay usable", async ({
  page,
}) => {
  const state = await setup(page, "ADMIN", true)
  await page.goto("/employees")
  await expect(page.getByText("ADMIN ACCESS", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Employee Management", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("alert").filter({ hasText: "temporarily unavailable" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(page.getByText("Jamie Rivera", { exact: true })).toBeVisible()
  await page.getByRole("searchbox", { name: "Search employees" }).fill("  ")
  await expect(page.getByText("Jamie Rivera", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Loading employees…", { exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole("searchbox", { name: "Search employees" })
    .fill("No match")
  await expect(page.getByText(/No employees match these filters/)).toBeVisible()
  expect(state.searches).toContain("No match")
})

test("Superadmin is redirected and has no Employee Management navigation", async ({
  page,
}) => {
  await setup(page, "SUPERADMIN")
  await page.goto("/employees")
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole("link", { name: "Employee Management", exact: true }),
  ).toHaveCount(0)
})

test("Admin creates an employee and Staff account together", async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto("/employees")
  await page.getByRole("button", { name: "Add employee", exact: true }).click()
  const form = page.getByRole("dialog", { name: "Add employee", exact: true })
  await form.locator("#employee-id").fill("bad id")
  await form.locator("#employee-full-name").fill("Alex123")
  await form.locator("#employee-email").fill("alex@example.org")
  await form.locator("#employee-contact-number").fill("07123456789")
  await form.getByRole("button", { name: "Add employee", exact: true }).click()
  await expect(form.getByText(/hyphens, or underscores only/)).toBeVisible()
  await expect(form.locator("#employee-id")).toBeFocused()
  expect(state.mutations).toHaveLength(0)
  await form.locator("#employee-id").fill("EMP-2001")
  await form.locator("#employee-full-name").fill("Alex Dela Cruz")
  await form.locator("#employee-email").fill("alex@example.com")
  await form.locator("#employee-contact-number").fill("09123456789")
  await form.locator("#employee-position").fill("Designer")
  await form.locator("#employee-start-date").fill("2026-01-15")
  await form.getByRole("combobox", { name: "Employment type" }).click()
  await page.getByRole("option", { name: "Full time", exact: true }).click()
  await form.getByRole("combobox", { name: "Department" }).click()
  await page.getByRole("option", { name: "Product", exact: true }).click()
  await expect(form.getByRole("combobox", { name: "Team" })).toBeEnabled()
  await form.getByRole("combobox", { name: "Team" }).click()
  await page.getByRole("option", { name: "No team", exact: true }).click()
  await form.locator("#employee-password").fill("ValidPassword1!")
  await form.locator("#employee-password-confirmation").fill("ValidPassword1!")
  await form.getByRole("button", { name: "Add employee", exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect(
    page.getByText("Alex Dela Cruz", { exact: true }).first(),
  ).toBeVisible()
  expect(state.mutations[0].body).toMatchObject({
    employeeId: "EMP-2001",
    fullName: "Alex Dela Cruz",
    email: "alex@example.com",
    contactNumber: "09123456789",
    position: "Designer",
    employmentType: "FULL_TIME",
    startDate: "2026-01-15T00:00:00.000Z",
    departmentId: "product",
    teamId: null,
    password: "ValidPassword1!",
  })
  expect(state.mutations[0].body).not.toHaveProperty("passwordConfirmation")
  expect(state.mutations[0].body).not.toHaveProperty("userId")
})

test("employment status change requires confirmation", async ({ page }) => {
  const state = await setup(page)
  await page.goto("/employees")
  await page
    .getByRole("button", { name: "More actions for Jamie Rivera" })
    .click()
  await page
    .getByRole("menuitem", { name: "Change status", exact: true })
    .click()
  const dialog = page.getByRole("dialog", {
    name: "Change employee status",
    exact: true,
  })
  await dialog.getByRole("combobox", { name: "Status", exact: true }).click()
  await page.getByRole("option", { name: "Inactive", exact: true }).click()
  expect(state.mutations).toHaveLength(0)
  await dialog
    .getByRole("button", { name: "Confirm status", exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(state.mutations[0].body).toEqual({ status: "INACTIVE" })
})

test("mobile directory and full-height sheet fit the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto("/employees")
  await expect(page.getByText("Jamie Rivera", { exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page
    .getByRole("button", { name: "More actions for Jamie Rivera" })
    .click()
  await page
    .getByRole("menuitem", { name: "View details", exact: true })
    .click()
  const drawer = page.getByRole("dialog", {
    name: "Employee details",
    exact: true,
  })
  await expect(drawer).toBeVisible()
  const box = await drawer.boundingBox()
  expect(box?.width).toBeLessThanOrEqual(390)
  await drawer.getByRole("button", { name: "Done", exact: true }).click()
  await expect(drawer).toHaveCount(0)
})
