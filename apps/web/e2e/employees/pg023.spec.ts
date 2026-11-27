import { expect, test } from "@playwright/test"
import type { Employee } from "../../src/features/employees/api/employees-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const directoryEmployee: Employee = {
  id: "pg023-directory",
  employeeId: "EXP-PG023",
  fullName: "PG023 Active Employee",
  email: "active@example.test",
  contactNumber: "09123456789",
  position: "Engineer",
  employmentType: "CONTRACT",
  status: "ON_LEAVE",
  startDate: "2026-01-15",
  departmentId: "dept-1",
  teamId: null,
  department: { id: "dept-1", name: "Engineering", code: "ENG", color: "teal" },
  team: null,
  hasAccount: true,
  accountIsActive: true,
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
}

test("PG-023-F007-A001-T009 resets directory filters and page in both views", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const queries: URLSearchParams[] = []
  let archiveEmpty = false
  await page.route("**/api/employees?*", async (route) => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    const archived = query.get("archived") === "true"
    const current = Number(query.get("page") ?? "1")
    const employees = archived
      ? archiveEmpty
        ? []
        : [
            {
              ...directoryEmployee,
              id: "pg023-archive",
              fullName: "PG023 Archived Employee",
              accountIsActive: false,
              accountDeletedAt: "2026-11-01T00:00:00Z",
            },
          ]
      : Array.from({ length: current === 1 ? 10 : 2 }, (_, index) => ({
          ...directoryEmployee,
          id: `${current}-${index}`,
          fullName: `${directoryEmployee.fullName} ${current}-${index}`,
        }))
    await route.fulfill({
      json: {
        employees,
        total: archived ? employees.length : 12,
        page: current,
        pageSize: 10,
      },
    })
  })
  await page.goto("/employees")
  const search = page.getByRole("searchbox", { name: "Search employees" })
  await search.fill("PG023")
  for (const [label, option] of [
    ["Filter by department", "Engineering"],
    ["Filter by employment type", "Contract"],
    ["Filter by employee status", "On Leave"],
  ]) {
    await page.getByRole("combobox", { name: label }).click()
    await page.getByRole("option", { name: option, exact: true }).click()
  }
  await expect.poll(() => queries.at(-1)?.get("search")).toBe("PG023")
  await page.getByRole("button", { name: "Next page" }).click()
  await expect(page.getByText("PG023 Active Employee 2-0")).toBeVisible()
  expect(Object.fromEntries(queries.at(-1) ?? [])).toMatchObject({
    page: "2",
    search: "PG023",
    departmentId: "dept-1",
    employmentType: "CONTRACT",
    status: "ON_LEAVE",
  })
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(page.getByText("PG023 Archived Employee")).toBeVisible()
  await expect(search).toHaveValue("")
  const expectReset = (archived: boolean) => {
    const query = queries.at(-1)!
    expect(query.get("archived")).toBe(archived ? "true" : null)
    expect(query.get("page") ?? "1").toBe("1")
    for (const key of ["search", "departmentId", "employmentType", "status"])
      expect(query.get(key) ?? "").toBe("")
  }
  expectReset(true)
  await page
    .getByRole("group", { name: "Employee view" })
    .getByRole("button", { name: "Employees", exact: true })
    .click()
  await expect(page.getByText("PG023 Active Employee 1-0")).toBeVisible()
  await expect(page.getByText("PG023 Archived Employee")).toHaveCount(0)
  expectReset(false)
  archiveEmpty = true
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(
    page.getByText("No archived accounts.", { exact: true }),
  ).toBeVisible()
})

test("PG-023-F001-A001-T001 admits only supported employee directory actors", async ({
  browser,
  baseURL,
}) => {
  for (const [role, destination] of [
    [null, "/login"],
    ["USER", "/dashboard"],
    ["STAFF", "/module"],
    ["ADMIN", "/employees"],
    ["SUPERADMIN", "/employees"],
  ] as const) {
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      const paths: string[] = []
      page.on("request", (request) => {
        paths.push(new URL(request.url()).pathname)
      })
      if (role) await restoreSession(page, role)
      await page.goto("/employees")
      await expect(page).toHaveURL((url) => url.pathname === destination)
      const heading = page.getByRole("heading", {
        name: "Employee Management",
      })
      if (destination === "/employees") {
        await expect(heading).toBeVisible()
        await expect.poll(() => paths.includes("/api/employees")).toBe(true)
        expect(paths.indexOf("/api/auth/me")).toBeGreaterThanOrEqual(0)
        expect(paths.indexOf("/api/auth/me")).toBeLessThan(
          paths.indexOf("/api/employees"),
        )
      } else {
        await expect(heading).toHaveCount(0)
        expect(paths).not.toContain("/api/employees")
      }
    } finally {
      await context.close()
    }
  }
})

test("PG-023-F008-A001-T010 preserves employee actions and layout across widths", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/employees")
  const action = page.getByRole("button", {
    name: "More actions for Alex Employee",
  })
  const row = page.getByRole("row").filter({ has: action })
  const toolbar = page
    .getByRole("searchbox", { name: "Search employees" })
    .locator("xpath=ancestor::div[contains(@class,'justify-between')][1]")

  for (const width of [390, 560, 561, 1000, 1001]) {
    await test.step(`${width} CSS pixels`, async () => {
      await page.setViewportSize({ width, height: 900 })
      await expect(row).toContainText("EMP-001")
      await expect(row).toContainText("Alex Employee")
      await expect(row).toContainText("alex.employee@example.com")
      await expect(action).toBeVisible()
      await expect
        .soft(toolbar)
        .toHaveCSS("flex-direction", width <= 560 ? "column" : "row")
      await expect
        .soft(row)
        .toHaveCSS("height", width <= 1000 ? "188px" : "58px")
      expect
        .soft(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
    })
  }
})
