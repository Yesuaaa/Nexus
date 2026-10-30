import { expect, test } from "@playwright/test"
import type { Employee } from "../src/features/employees/api/employees-api"

for (const width of [1440, 390]) {
  test(`employee profile and login controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    let employee: Employee = {
      id: "account:account-1",
      accountId: "account-1",
      hasEmployeeRecord: false,
      employeeId: "",
      fullName: "Alex Employee",
      email: "alex@example.com",
      contactNumber: "09123456789",
      position: null,
      employmentType: null,
      status: null,
      startDate: null,
      departmentId: null,
      teamId: null,
      department: null,
      team: null,
      hasAccount: true,
      accountIsActive: true,
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-01-15T00:00:00Z",
    }
    let accountDeleted = false
    let accountArchived = false
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "test-session"),
    )
    await page.route("**/api/**", async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === "/api/auth/me")
        return route.fulfill({
          json: {
            user: {
              id: "admin",
              fullName: "Admin",
              email: "admin@example.com",
              role: "ADMIN",
              isActive: true,
              permissions: [
                "employees:read",
                "employees:manage",
                "departments:read",
                "dashboard:read",
              ],
              createdAt: "2026-01-01T00:00:00Z",
            },
          },
        })
      const department = {
        id: "dept-1",
        name: "Engineering",
        code: "ENG",
        headId: null,
        head: null,
        memberCount: 1,
        teamCount: 0,
        description: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }
      if (path === "/api/departments")
        return route.fulfill({ json: { departments: [department] } })
      if (path === "/api/departments/dept-1")
        return route.fulfill({
          json: { department: { ...department, teams: [], members: [] } },
        })
      if (path === "/api/employees" && request.method() === "GET") {
        const archive =
          new URL(request.url()).searchParams.get("archived") === "true"
        const rows =
          !accountDeleted && archive === accountArchived ? [employee] : []
        return route.fulfill({
          json: { employees: rows, total: rows.length, page: 1, pageSize: 10 },
        })
      }
      if (
        path === "/api/employees/accounts/account-1/profile" &&
        request.method() === "POST"
      ) {
        const input = request.postDataJSON()
        expect(input).not.toHaveProperty("password")
        employee = {
          ...employee,
          ...input,
          id: "employee-1",
          hasEmployeeRecord: true,
          status: "ACTIVE",
          department: { id: "dept-1", name: "Engineering", code: "ENG" },
        }
        return route.fulfill({ status: 201, json: { employee } })
      }
      if (path === "/api/employees/employee-1/status-options")
        return route.fulfill({
          json: {
            isDepartmentHead: false,
            replacementCandidates: [],
            recommendedReplacementEmployeeId: null,
            willRestoreOriginalHead: false,
          },
        })
      if (path === "/api/employees/employee-1" && request.method() === "PUT") {
        const input = request.postDataJSON()
        expect(input).not.toHaveProperty("password")
        if (input.employeeId !== undefined)
          expect(input.employeeId).toBe("EXP-000001")
        employee = { ...employee, ...input }
        return route.fulfill({ json: { employee } })
      }
      if (
        path === "/api/employees/employee-1/account" &&
        request.method() === "POST"
      ) {
        expect(request.postDataJSON()).toEqual({ password: "ValidPassword1!" })
        employee = { ...employee, hasAccount: true, accountIsActive: true }
        return route.fulfill({ status: 201, json: { employee } })
      }
      if (path === "/api/employees/employee-1/account/status") {
        employee = {
          ...employee,
          accountIsActive: request.postDataJSON().isActive,
        }
        return route.fulfill({ status: 204 })
      }
      if (
        path === "/api/employees/employee-1/account" &&
        request.method() === "DELETE"
      ) {
        accountArchived = true
        employee = {
          ...employee,
          accountDeletedAt: "2026-10-30T00:00:00Z",
          hasAccount: false,
        }
        return route.fulfill({ status: 204 })
      }
      if (
        path === "/api/employees/employee-1/account/permanent" &&
        request.method() === "DELETE"
      ) {
        accountDeleted = true
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ status: 404, json: { error: "Not found" } })
    })
    await page.goto("/employees")
    await page
      .getByRole("button", { name: "Edit Alex Employee", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByLabel("Password", { exact: true })).toHaveCount(0)
    await expect(dialog.getByRole("heading")).toHaveText(
      "Complete employee details",
    )
    await expect(dialog.locator("#employee-id")).toHaveValue("")
    await dialog.locator("#employee-id").fill("000001")
    await dialog.locator("#employee-position").fill("Designer")
    await dialog
      .getByRole("combobox", { name: "Employment type", exact: true })
      .click()
    await page.getByRole("option", { name: "Full Time", exact: true }).click()
    await dialog.locator("#employee-start-date").fill("2026-01-15")
    await dialog
      .getByRole("combobox", { name: "Department", exact: true })
      .click()
    await page.getByRole("option", { name: "Engineering", exact: true }).click()
    await dialog.getByRole("combobox", { name: "Team", exact: true }).click()
    await page.getByRole("option", { name: "No Team", exact: true }).click()
    await dialog
      .getByRole("button", { name: "Save Employee", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    async function menu(label: string) {
      await page
        .getByRole("button", {
          name: "More actions for Alex Employee",
          exact: true,
        })
        .click()
      await page.getByRole("menuitem", { name: label, exact: true }).click()
    }
    await menu("Change status")
    await dialog.getByRole("combobox", { name: "Status", exact: true }).click()
    await page.getByRole("option", { name: "Inactive", exact: true }).click()
    await dialog
      .getByRole("button", { name: "Confirm status", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await page
      .getByRole("button", {
        name: "More actions for Alex Employee",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await menu("Deactivate account")
    await dialog
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await page
      .getByRole("button", {
        name: "More actions for Alex Employee",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toBeEnabled()
    await page.keyboard.press("Escape")
    await menu("Reactivate account")
    await dialog
      .getByRole("button", { name: "Reactivate account", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await menu("Deactivate account")
    await dialog
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await menu("Delete account")
    await expect(dialog).toContainText(
      "moves the deactivated account to Archive",
    )
    await dialog
      .getByRole("button", { name: "Move to Archive", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Edit Alex Employee", exact: true }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Archive", exact: true }).click()
    await menu("Delete permanently")
    await expect(dialog).toContainText("permanently deletes")
    await dialog
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText("No archived accounts.", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Back to Employees", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Create Employee", exact: true })
      .click()
    await expect(dialog.locator("#employee-id")).toHaveValue("")
    await dialog.locator("#employee-id").fill("42")
    await dialog
      .getByRole("button", { name: "Show password", exact: true })
      .click()
    await expect(dialog.locator("#employee-password")).toHaveAttribute(
      "type",
      "text",
    )
    await dialog
      .getByRole("button", { name: "Show confirm password", exact: true })
      .click()
    await expect(
      dialog.locator("#employee-password-confirmation"),
    ).toHaveAttribute("type", "text")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}
