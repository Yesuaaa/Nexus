import { test, expect, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Policy picker regressions use a scoped mock API")

const employees = Array.from({ length: 12 }, (_, index) => ({
  id: `employee-${index + 1}`,
  fullName: `Policy employee ${String(index + 1).padStart(2, "0")}`,
  employeeId: `EMP-${String(index + 1).padStart(3, "0")}`,
  departmentId: null,
}))

async function openAssignment(page: Page, failSecondAssignment = false) {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
  await restoreSession(page, "ADMIN")
  const assignments: unknown[] = []
  const employeePages: number[] = []
  let shouldFail = failSecondAssignment
  await page.route("**/api/attendance/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith("/policies")) {
      await route.fulfill({
        json: {
          policies: [
            {
              id: "policy-1",
              name: "Flexible policy",
              timeZone: "Asia/Manila",
              unpaidBreaksEnabled: true,
              overnightRequiresReview: false,
              days: Array.from({ length: 7 }, (_, weekday) => ({
                weekday,
                isWorkingDay: false,
                requiredMinutes: 0,
              })),
            },
          ],
        },
      })
    } else if (url.pathname.endsWith("/employees")) {
      const pageNumber = Number(url.searchParams.get("page"))
      employeePages.push(pageNumber)
      await route.fulfill({
        json: {
          employees: employees.slice((pageNumber - 1) * 10, pageNumber * 10),
          page: pageNumber,
          pageSize: 10,
          total: employees.length,
        },
      })
    } else if (url.pathname.endsWith("/assignments")) {
      const body: unknown = request.postDataJSON()
      assignments.push(body)
      if (shouldFail && assignments.length === 2) {
        shouldFail = false
        await route.fulfill({
          status: 409,
          json: { error: "Choose a date after existing attendance records" },
        })
      } else {
        await route.fulfill({ status: 201, json: { assignment: body } })
      }
    } else await route.fallback()
  })
  await page.goto("/attendance/settings")
  await page
    .getByRole("button", { name: "Assign policy to employee", exact: true })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByRole("checkbox")).toHaveCount(12)
  await expect(
    panel.getByRole("combobox", { name: "Select attendance employee" }),
  ).toHaveCount(0)
  await expect(
    panel.getByRole("button", { name: "Assign policy", exact: true }),
  ).toBeDisabled()
  expect(employeePages).toEqual([1, 2])
  return { panel, assignments }
}

async function choosePolicy(page: Page) {
  await page
    .getByRole("combobox", { name: "Attendance policy", exact: true })
    .click()
  await page.getByRole("option", { name: /Flexible policy/ }).click()
  await page
    .getByRole("button", { name: "Effective from", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
    .click()
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test(`policy checkbox selection survives searches at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const { panel, assignments } = await openAssignment(page)
    const search = panel.getByRole("searchbox", {
      name: "Search attendance employees",
    })
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 01", exact: true })
      .check()
    await search.fill("EMP-012")
    await expect(panel.getByRole("checkbox")).toHaveCount(1)
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
      .check()
    await expect(panel.getByRole("status")).toHaveText("2 selected")
    await search.fill("no matching employee")
    await expect(
      panel.getByText("No employees match your search."),
    ).toBeVisible()
    await expect(panel.getByRole("status")).toHaveText("2 selected")
    await search.clear()
    await expect(
      panel.getByRole("checkbox", {
        name: "Select Policy employee 01",
        exact: true,
      }),
    ).toBeChecked()
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
      .uncheck()
    await expect(panel.getByRole("status")).toHaveText("1 selected")
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
      .check()
    await choosePolicy(page)
    await search.scrollIntoViewIfNeeded()
    await panel.screenshot({
      path: test.info().outputPath(`policy-checkboxes-${viewport.width}.png`),
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    await panel
      .getByRole("button", { name: "Assign policy", exact: true })
      .click()
    const confirmation = page.getByRole("dialog", {
      name: "Assign attendance policy?",
      exact: true,
    })
    await expect(confirmation.getByText("2 employees selected")).toBeVisible()
    await confirmation
      .getByRole("button", { name: "Confirm assignment", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(assignments).toEqual([
      {
        employeeId: "employee-1",
        policyId: "policy-1",
        effectiveFrom: "2026-11-16",
      },
      {
        employeeId: "employee-12",
        policyId: "policy-1",
        effectiveFrom: "2026-11-16",
      },
    ])
  })
}

test("policy assignment retries only employees that still need assignment", async ({
  page,
}) => {
  const { panel, assignments } = await openAssignment(page, true)
  await panel
    .getByRole("checkbox", { name: "Select Policy employee 01", exact: true })
    .check()
  await panel
    .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
    .check()
  await choosePolicy(page)
  await panel
    .getByRole("button", { name: "Assign policy", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Confirm assignment", exact: true })
    .click()
  await expect(panel.getByRole("alert")).toContainText(
    "Policy assigned to 1 employee. Remaining employees are still selected.",
  )
  await expect(panel.getByRole("alert")).toContainText(
    "Choose a date after existing attendance records",
  )
  await expect(
    panel.getByRole("checkbox", {
      name: "Select Policy employee 01",
      exact: true,
    }),
  ).not.toBeChecked()
  await expect(
    panel.getByRole("checkbox", {
      name: "Select Policy employee 12",
      exact: true,
    }),
  ).toBeChecked()
  await expect(panel.getByRole("status")).toHaveText("1 selected")
  await panel
    .getByRole("button", { name: "Assign policy", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Confirm assignment", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(assignments).toEqual([
    {
      employeeId: "employee-1",
      policyId: "policy-1",
      effectiveFrom: "2026-11-16",
    },
    {
      employeeId: "employee-12",
      policyId: "policy-1",
      effectiveFrom: "2026-11-16",
    },
    {
      employeeId: "employee-12",
      policyId: "policy-1",
      effectiveFrom: "2026-11-16",
    },
  ])
})
