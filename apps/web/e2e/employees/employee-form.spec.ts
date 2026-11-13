import { expect, test } from "@playwright/test"
import type { Employee } from "../../src/features/employees/api/employees-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

async function openEmployeeForm(page: import("@playwright/test").Page) {
  await restoreSession(page, "ADMIN")
  await page.goto("/employees")
  await page.getByRole("button", { name: "Create Employee" }).click()
  return page.getByRole("dialog")
}

async function fillEmployeeFields(
  dialog: import("@playwright/test").Locator,
  contactNumber = "09123456789",
) {
  await dialog.locator("#employee-id").fill("0042")
  await dialog.locator("#employee-full-name").fill(" Jordan Reyes ")
  await dialog.locator("#employee-email").fill("jordan@example.com")
  await dialog.locator("#employee-contact-number").fill(contactNumber)
  await dialog.locator("#employee-position").fill(" Designer ")
  await dialog.getByRole("combobox", { name: "Employment type" }).click()
  await dialog.page().getByRole("option", { name: "Full Time" }).click()
  await dialog.locator("#employee-start-date").fill("2026-01-15")
  await dialog.getByRole("combobox", { name: "Department" }).click()
  await dialog.page().getByRole("option", { name: "Engineering" }).click()
  await dialog.getByRole("combobox", { name: "Team" }).click()
  await dialog.page().getByRole("option", { name: "No Team" }).click()
  await dialog.locator("#employee-password").fill("ValidPassword1!")
  await dialog
    .locator("#employee-password-confirmation")
    .fill("ValidPassword1!")
}

test("employee creation blocks invalid contact data before making an API request", async ({
  page,
}) => {
  let createRequests = 0
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/employees"
    ) {
      createRequests += 1
    }
  })

  const dialog = await openEmployeeForm(page)
  await fillEmployeeFields(dialog, "07123456789")
  await dialog.getByRole("button", { name: "Add Employee" }).click()

  await expect(dialog.locator("#employee-contact-number")).toHaveAttribute(
    "aria-invalid",
    "true",
  )
  await expect(
    dialog.getByText("Enter 11 digits starting with 09 or 08.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(createRequests).toBe(0)
})

test("employee creation keeps the form after a conflict and retries with normalized fields", async ({
  page,
}) => {
  const submissions: Record<string, unknown>[] = []
  await restoreSession(page, "ADMIN")
  await page.route("**/api/employees*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname !== "/api/employees" || request.method() !== "POST") {
      await route.fallback()
      return
    }

    const body = request.postDataJSON() as Record<string, unknown>
    submissions.push(body)
    if (submissions.length === 1) {
      await route.fulfill({
        status: 409,
        json: { error: "Employee email already exists." },
      })
      return
    }

    const saved: Employee = {
      id: "employee-created",
      employeeId: String(body.employeeId),
      fullName: String(body.fullName),
      email: String(body.email),
      contactNumber: String(body.contactNumber),
      position: String(body.position),
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      startDate: "2026-01-15T00:00:00.000Z",
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
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-01-15T00:00:00.000Z",
    }
    await route.fulfill({ status: 201, json: { employee: saved } })
  })

  await page.goto("/employees")
  await page.getByRole("button", { name: "Create Employee" }).click()
  const dialog = page.getByRole("dialog")
  await fillEmployeeFields(dialog)
  await dialog.getByRole("button", { name: "Add Employee" }).click()

  await expect(dialog.getByText("Employee email already exists.")).toBeVisible()
  await expect(dialog.locator("#employee-full-name")).toHaveValue(
    " Jordan Reyes ",
  )
  await expect(dialog.locator("#employee-password")).toHaveValue(
    "ValidPassword1!",
  )
  await dialog.locator("#employee-email").fill("jordan.reyes@example.com")
  await dialog.getByRole("button", { name: "Add Employee" }).click()

  await expect(dialog).toHaveCount(0)
  expect(submissions).toHaveLength(2)
  expect(submissions[1]).toEqual({
    employeeId: "EXP-0042",
    fullName: "Jordan Reyes",
    email: "jordan.reyes@example.com",
    contactNumber: "09123456789",
    position: "Designer",
    employmentType: "FULL_TIME",
    startDate: "2026-01-15T00:00:00.000Z",
    departmentId: "dept-1",
    teamId: null,
    password: "ValidPassword1!",
  })
})
