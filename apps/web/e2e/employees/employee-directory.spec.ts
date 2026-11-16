import { expect, test } from "@playwright/test"
import type { Employee } from "../../src/features/employees/api/employees-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("employee directory applies filters and resets pagination to the first page", async ({
  page,
}) => {
  const employees: Employee[] = Array.from({ length: 12 }, (_, index) => {
    const first = index === 0
    const number = String(index + 1).padStart(2, "0")
    return {
      id: `employee-${number}`,
      employeeId: `EXP-DIR-${number}`,
      fullName: first ? "Jordan Reyes" : `Directory Person ${number}`,
      email: first ? "jordan@example.com" : `person${number}@example.com`,
      contactNumber: "09123456789",
      position: "Designer",
      employmentType: first ? "CONTRACT" : "FULL_TIME",
      status: first ? "ON_LEAVE" : "ACTIVE",
      startDate: "2026-01-15",
      departmentId: "dept-1",
      teamId: null,
      department: {
        id: "dept-1",
        name: "Engineering",
        code: "ENG",
        color: "teal",
      },
      team: null,
      hasAccount: true,
      accountIsActive: true,
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-01-15T00:00:00Z",
    }
  })
  let lastQuery = ""
  await restoreSession(page, "ADMIN", { initialEmployees: employees })
  await page.route("**/api/employees*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname !== "/api/employees" || request.method() !== "GET") {
      await route.fallback()
      return
    }

    lastQuery = url.search
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""
    const departmentId = url.searchParams.get("departmentId") ?? ""
    const employmentType = url.searchParams.get("employmentType") ?? ""
    const status = url.searchParams.get("status") ?? ""
    const filtered = employees.filter(
      (employee) =>
        (!search ||
          employee.fullName.toLowerCase().includes(search) ||
          employee.employeeId.toLowerCase().includes(search) ||
          employee.email?.toLowerCase().includes(search)) &&
        (!departmentId || employee.departmentId === departmentId) &&
        (!employmentType || employee.employmentType === employmentType) &&
        (!status || employee.status === status),
    )
    const requestedPage = Number(url.searchParams.get("page") ?? "1")
    const pageSize = 10
    await route.fulfill({
      json: {
        employees: filtered.slice(
          (requestedPage - 1) * pageSize,
          requestedPage * pageSize,
        ),
        total: filtered.length,
        page: requestedPage,
        pageSize,
      },
    })
  })

  await page.goto("/employees")
  await expect(
    page.getByText("Showing 1–10 of 12", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("navigation", { name: "Employee pages" })
    .getByRole("button", { name: "Next page" })
    .click()
  await expect(
    page.getByText("Showing 11–12 of 12", { exact: true }),
  ).toBeVisible()
  expect(new URLSearchParams(lastQuery).get("page")).toBe("2")

  await page.getByRole("combobox", { name: "Filter by department" }).click()
  await page.getByRole("option", { name: "Engineering" }).click()
  await page
    .getByRole("combobox", { name: "Filter by employment type" })
    .click()
  await page.getByRole("option", { name: "Contract" }).click()
  await page
    .getByRole("combobox", { name: "Filter by employee status" })
    .click()
  await page.getByRole("option", { name: "On Leave" }).click()
  await page
    .getByRole("searchbox", { name: "Search employees" })
    .fill(" Jordan ")

  await expect(page.getByRole("row", { name: /Jordan Reyes/ })).toBeVisible()
  await expect(
    page.getByText("Showing 1–1 of 1", { exact: true }),
  ).toBeVisible()
  const finalQuery = new URLSearchParams(lastQuery)
  expect(finalQuery.get("page")).toBe("1")
  expect(finalQuery.get("search")).toBe("Jordan")
  expect(finalQuery.get("departmentId")).toBe("dept-1")
  expect(finalQuery.get("employmentType")).toBe("CONTRACT")
  expect(finalQuery.get("status")).toBe("ON_LEAVE")
})
