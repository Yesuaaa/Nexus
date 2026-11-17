import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

const slip = {
  id: "payslip-one",
  reference: "PS-TEST",
  employeeName: "Morgan Payroll",
  employeeNumber: "EMP-001",
  gross: "10100.00",
  deductions: "100.00",
  net: "10000.00",
  currency: "PHP",
  revision: 1,
  calculationId: "approved-one",
  generatedAt: "2026-11-30T10:00:00Z",
  generatedBy: "admin",
  publishedAt: "2026-11-30T11:00:00Z",
  publishedBy: "admin",
  period: {
    cutoffLabel: "November 2026",
    configuration: { frequency: "MONTHLY" },
  },
  lines: [
    {
      name: "Base earnings",
      componentType: "BASE_EARNING",
      amount: "10100.00",
    },
  ],
}
const pageOf = <T>(rows: T[]) => ({
  rows,
  page: 1,
  pageSize: 10,
  total: rows.length,
})

test("Staff searches concerns, views history, edits an open concern and withdraws it", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  const concern: {
    id: string
    type: string
    status: string
    createdAt: string
    updatedAt: string
    resolvedAt: string | null
    withdrawnAt: string | null
    withdrawnBy: string | null
    needsFinancialCorrection: boolean
    employee: { fullName: string; employeeId: string }
    payslip: null
    messages: {
      id: string
      isAdmin: boolean
      body: string
      createdAt: string
    }[]
    activity: {
      id: string
      action: string
      actorRoleAtTime: string
      changedFields: string[]
      createdAt: string
      changes: {
        activity: string
        description?: { before: string; after: string }
      }
    }[]
  } = {
    id: "payroll-concern-one",
    type: "MISSING_SALARY_PAYMENT",
    status: "OPEN",
    createdAt: "2026-11-17T08:00:00.000Z",
    updatedAt: "2026-11-17T08:00:00.000Z",
    resolvedAt: null,
    withdrawnAt: null,
    withdrawnBy: null,
    needsFinancialCorrection: false,
    employee: { fullName: "Morgan Payroll", employeeId: "EMP-001" },
    payslip: null,
    messages: [
      {
        id: "concern-description",
        isAdmin: false,
        body: "My salary payment is missing for November.",
        createdAt: "2026-11-17T08:00:00.000Z",
      },
    ],
    activity: [
      {
        id: "concern-created",
        action: "PAYROLL_DOCUMENT_ACTIVITY",
        actorRoleAtTime: "STAFF",
        changedFields: [],
        createdAt: "2026-11-17T08:00:00.000Z",
        changes: { activity: "REQUEST_CREATED" },
      },
    ],
  }
  const otherConcern = {
    ...concern,
    id: "payroll-concern-two",
    messages: concern.messages.map((entry) => ({
      ...entry,
      id: "other-concern-description",
      body: "Other salary payment is missing for December.",
    })),
    activity: [],
  }
  const listQueries: URLSearchParams[] = []
  let editPayload: Record<string, unknown> | undefined
  let deleteCount = 0
  await page.route("**/api/attendance/me/**", (route) =>
    route.fulfill({ status: 503, json: { error: "Attendance unavailable" } }),
  )
  await page.route("**/api/staff/my-payroll**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith("/requests")) {
      if (route.request().method() === "GET") {
        const query = url.searchParams
        listQueries.push(query)
        const pageNumber = Number(query.get("page") ?? "1")
        const rows = [concern, otherConcern].filter(
          (row) =>
            (!query.get("search") ||
              row.messages[0]!.body.toLowerCase().includes(
                query.get("search")!.toLowerCase(),
              )) &&
            (!query.get("status") || query.get("status") === row.status) &&
            (!query.get("type") || query.get("type") === row.type) &&
            !row.withdrawnAt,
        )
        return route.fulfill({
          json: {
            rows: rows.slice(pageNumber - 1, pageNumber),
            page: pageNumber,
            pageSize: 1,
            total: rows.length,
          },
        })
      }
      return route.fulfill({
        status: 405,
        json: { error: "Unexpected method" },
      })
    }
    if (path.endsWith("/requests/" + concern.id)) {
      if (route.request().method() === "GET")
        return route.fulfill({ json: concern })
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON() as Record<
          string,
          unknown
        >
        editPayload = payload
        concern.type = String(payload.type)
        concern.messages[0]!.body = String(payload.description)
        concern.updatedAt = "2026-11-17T09:00:00.000Z"
        concern.activity!.push({
          id: "concern-edited",
          action: "PAYROLL_DOCUMENT_ACTIVITY",
          actorRoleAtTime: "STAFF",
          changedFields: ["description"],
          createdAt: concern.updatedAt,
          changes: {
            activity: "REQUEST_EDITED",
            description: {
              before: "My salary payment is missing for November.",
              after: concern.messages[0]!.body,
            },
          },
        })
        return route.fulfill({ json: concern })
      }
      if (route.request().method() === "DELETE") {
        deleteCount += 1
        concern.withdrawnAt = "2026-11-17T10:00:00.000Z"
        concern.withdrawnBy = "staff-account"
        concern.status = "CLOSED"
        return route.fulfill({ json: concern })
      }
    }
    if (path.endsWith("/payslips")) return route.fulfill({ json: pageOf([]) })
    return route.fulfill({
      json: {
        linked: true,
        latestPayslip: null,
        recentRequests: [],
        openConcernCount: concern.withdrawnAt ? 0 : 1,
      },
    })
  })

  await page.goto("/staff/my-payroll")
  await expect(
    page.getByRole("heading", { name: "Payroll summary" }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "My payslips" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Payroll Concerns" }),
  ).toBeVisible()
  const search = page.getByRole("searchbox", {
    name: "Search payroll concerns",
  })
  await search.fill("salary payment")
  const statusFilter = page.getByRole("combobox", { name: "Concern status" })
  await statusFilter.click()
  await page.getByRole("option", { name: "Open", exact: true }).click()
  const typeFilter = page.getByRole("combobox", { name: "Concern type" })
  await typeFilter.click()
  await page
    .getByRole("option", { name: "Missing salary payment report", exact: true })
    .click()
  await expect
    .poll(() => listQueries.at(-1)?.toString())
    .toContain("search=salary+payment")
  expect(listQueries.at(-1)?.get("status")).toBe("OPEN")
  expect(listQueries.at(-1)?.get("type")).toBe("MISSING_SALARY_PAYMENT")
  await expect(page.getByText("Missing salary payment report")).toBeVisible()
  const pagination = page.getByRole("navigation", {
    name: "Payroll concern pages",
  })
  await pagination.getByRole("button", { name: "Next page" }).click()
  await expect.poll(() => listQueries.at(-1)?.get("page")).toBe("2")
  expect(listQueries.at(-1)?.get("search")).toBe("salary payment")
  expect(listQueries.at(-1)?.get("status")).toBe("OPEN")
  expect(listQueries.at(-1)?.get("type")).toBe("MISSING_SALARY_PAYMENT")
  await pagination.getByRole("button", { name: "Previous page" }).click()
  await expect.poll(() => listQueries.at(-1)?.get("page")).toBe("1")

  const actions = page.getByRole("button", {
    name: "Actions for payroll concern payroll-concern-one",
  })
  await actions.click()
  await page.getByRole("menuitem", { name: "View concern" }).click()
  await expect(
    page.getByText("Concern type · Missing salary payment report"),
  ).toBeVisible()
  await expect(page.getByText(/Submitted · Nov 17, 2026/)).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Activity history" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Close panel" }).click()

  await actions.click()
  await page.getByRole("menuitem", { name: "Edit concern" }).click()
  const editDialog = page.getByRole("dialog")
  await expect(
    editDialog.getByRole("heading", { name: "Edit concern" }),
  ).toBeVisible()
  const description = editDialog.getByLabel("Describe your concern")
  await expect(description).toHaveValue(
    "My salary payment is missing for November.",
  )
  await description.fill("Missing salary for my November pay.")
  await editDialog.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Payroll concern updated")).toBeVisible()
  expect(editPayload).toEqual({
    type: "MISSING_SALARY_PAYMENT",
    description: "Missing salary for my November pay.",
    payslipId: null,
  })
  await page.getByRole("button", { name: "Close panel" }).click()

  await actions.click()
  await page.getByRole("menuitem", { name: "Delete concern" }).click()
  const deleteDialog = page.getByRole("dialog")
  await expect(
    deleteDialog.getByRole("heading", { name: "Delete concern?" }),
  ).toBeVisible()
  await deleteDialog.getByRole("button", { name: "Delete concern" }).click()
  await expect(page.getByText("Payroll concern deleted")).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Actions for payroll concern payroll-concern-one",
    }),
  ).toHaveCount(0)
  await expect(
    page.getByText("Other salary payment is missing for December."),
  ).toBeVisible()
  expect(deleteCount).toBe(1)
})

test("Staff opens My Payroll from Workforce Compliance, downloads a PDF and raises a concern", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreSession(page, "STAFF")
  let concernPosts = 0
  let concernReads = 0
  await page.route("**/api/attendance/me/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Attendance unavailable in this payroll fixture" },
    }),
  )
  await page.route("**/api/staff/my-payroll**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/download"))
      return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4" })
    if (path.endsWith("/payslips"))
      return route.fulfill({ json: pageOf([slip]) })
    if (path.endsWith("/requests")) {
      if (route.request().method() === "POST") {
        concernPosts += 1
        expect(route.request().postDataJSON()).toMatchObject({
          payslipId: slip.id,
          type: "PAYSLIP_CORRECTION",
        })
        expect(route.request().postDataJSON().description).toBe(
          "Please review the payslip breakdown.",
        )
        if (concernPosts === 1)
          return route.fulfill({
            status: 503,
            json: { error: "Payroll is temporarily unavailable." },
          })
        await new Promise((resolve) => setTimeout(resolve, 300))
        return route.fulfill({
          status: 201,
          json: { id: "request-one", messages: [] },
        })
      }
      concernReads += 1
      return route.fulfill({ json: pageOf([]) })
    }
    return route.fulfill({
      json: {
        linked: true,
        latestPayslip: slip,
        recentRequests: [],
        openConcernCount: 2,
      },
    })
  })
  await page.goto("/module")
  await expect(
    page.getByRole("link", { name: "Open My Payroll workspace" }),
  ).toHaveCount(0)
  await page
    .getByRole("link", { name: "Open Workforce Compliance workspace" })
    .click()
  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await page.getByRole("link", { name: "My Payroll", exact: true }).click()
  await expect(page).toHaveURL(/\/my-payroll$/)
  await expect(
    page.getByRole("heading", { name: "My Payroll", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(
      "View your payslips, payroll history, and salary-related concerns.",
    ),
  ).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Home")
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("My Payroll")
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).not.toContainText("Attendance")
  await expect(
    page.locator('dl[aria-label="My payroll overview"]'),
  ).toContainText("PHP 10000.00")
  await expect(
    page.locator('dl[aria-label="My payroll overview"]'),
  ).toContainText("2")
  await expect(
    page.locator('dl[aria-label="My payroll overview"]'),
  ).toContainText("November 2026")
  await page.getByRole("button", { name: "View", exact: true }).click()
  const detail = page.getByRole("dialog")
  await expect(detail.getByText(/Base earnings.*10100.00/)).toBeVisible()
  const downloading = page.waitForEvent("download")
  await detail.getByRole("button", { name: "Download PDF" }).click()
  expect((await downloading).suggestedFilename()).toBe("PS-TEST.pdf")
  await detail
    .getByRole("button", { name: "Raise a concern about this payslip" })
    .click()
  const firstConcernDialog = page.getByRole("dialog")
  await expect(
    firstConcernDialog.getByText("Concern type", { exact: true }),
  ).toBeVisible()
  const emptySubmitConcern = firstConcernDialog.getByRole("button", {
    name: "Submit concern",
  })
  await expect(emptySubmitConcern).toBeDisabled()
  await firstConcernDialog.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(concernPosts).toBe(0)

  await page.getByRole("button", { name: "Raise a concern" }).click()
  const concernDialog = page.getByRole("dialog")
  const submitConcern = concernDialog.getByRole("button", {
    name: "Submit concern",
  })
  await concernDialog.getByRole("combobox", { name: "Concern type" }).click()
  await page
    .getByRole("option", { name: "Payslip correction", exact: true })
    .click()
  const relatedPayslip = concernDialog.getByRole("combobox", {
    name: "Related payslip",
  })
  await expect(relatedPayslip).toContainText("November 2026 — PS-TEST")
  await relatedPayslip.click()
  await page
    .getByRole("option", { name: "November 2026 — PS-TEST", exact: true })
    .click()
  const description = concernDialog.getByLabel("Describe your concern")
  await description.fill("     ")
  await description.blur()
  await expect(
    concernDialog.getByText("Enter a description.", { exact: true }),
  ).toBeVisible()
  await expect(submitConcern).toBeDisabled()
  await description.fill("  Please review the payslip breakdown.  ")
  await expect(submitConcern).toBeEnabled()
  const initialConcernReads = concernReads
  await submitConcern.click()
  await expect(
    concernDialog.getByText("Payroll is temporarily unavailable."),
  ).toBeVisible()
  await expect(description).toHaveValue(
    "  Please review the payslip breakdown.  ",
  )
  await expect(relatedPayslip).toContainText("November 2026 — PS-TEST")
  await expect(submitConcern).toBeEnabled()
  await submitConcern.click()
  await expect(submitConcern).toBeDisabled()
  await expect(page.getByText("Payroll concern submitted")).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect.poll(() => concernPosts).toBe(2)
  await expect.poll(() => concernReads).toBeGreaterThan(initialConcernReads)
  await expect(page.getByRole("button", { name: /acknowledge/i })).toHaveCount(
    0,
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("Staff concern modal stays compact on desktop and keeps its submit action on the right", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await restoreSession(page, "STAFF")
  await page.route("**/api/attendance/me/**", (route) =>
    route.fulfill({ status: 503, json: { error: "Attendance unavailable" } }),
  )
  await page.route("**/api/staff/my-payroll**", (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/payslips") || path.endsWith("/requests"))
      return route.fulfill({ json: pageOf([]) })
    return route.fulfill({
      json: {
        linked: true,
        latestPayslip: null,
        recentRequests: [],
        openConcernCount: 0,
      },
    })
  })
  await page.goto("/staff/my-payroll")
  await page.getByRole("button", { name: "Raise a concern" }).click()

  const dialog = page.getByRole("dialog")
  const dialogBox = await dialog.boundingBox()
  const footer = dialog.locator("footer")
  const footerBox = await footer.boundingBox()
  const submit = footer.getByRole("button", { name: "Submit concern" })
  const submitBox = await submit.boundingBox()

  expect(dialogBox?.width).toBeGreaterThan(500)
  expect(dialogBox?.width).toBeLessThanOrEqual(620)
  expect(footerBox).not.toBeNull()
  expect(submitBox).not.toBeNull()
  expect(submitBox!.x + submitBox!.width).toBeGreaterThan(
    footerBox!.x + footerBox!.width - 60,
  )
})

for (const role of ["ADMIN", "SUPERADMIN"] as const) {
  test(role + " opens Payslips & History through Payroll", async ({ page }) => {
    await restoreSession(page, role)
    await page.route("**/api/payroll/**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith("/payslips"))
        return route.fulfill({ json: pageOf([slip]) })
      return route.fulfill({ json: pageOf([]) })
    })
    await page.goto("/module/payroll/payslips")
    await expect(
      page.getByRole("heading", { name: "Payslips & Payroll History" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Payslips & History" }),
    ).toBeVisible()
    await expect(page.getByText(slip.reference)).toBeVisible()
    await expect(page.getByText("Read only", { exact: true })).toHaveCount(
      role === "SUPERADMIN" ? 1 : 0,
    )
    await expect(
      page.getByRole("heading", { name: "Approved runs" }),
    ).toHaveCount(role === "ADMIN" ? 1 : 0)
  })
}

test("My Payroll opens directly and survives refresh with no published payslips", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  let concernPayload: Record<string, unknown> | undefined
  await page.route("**/api/attendance/me/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Attendance unavailable in this payroll fixture" },
    }),
  )
  await page.route("**/api/staff/my-payroll**", (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/requests") && route.request().method() === "POST") {
      concernPayload = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        json: { id: "request-no-slip", messages: [] },
      })
    }
    return route.fulfill({
      json: path.endsWith("/my-payroll")
        ? {
            linked: true,
            latestPayslip: null,
            recentRequests: [],
            openConcernCount: 0,
          }
        : pageOf([]),
    })
  })
  await page.goto("/staff/my-payroll")
  await expect(page).toHaveURL(/\/my-payroll$/)
  const sidebar = page.locator("#app-sidebar")
  await expect(sidebar).toContainText("Workforce Compliance")
  await expect(sidebar).toContainText("My Payroll")
  await expect(
    sidebar.getByRole("link", { name: "My Payroll", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(sidebar).toContainText("Attendance")
  await expect(page.getByText("No payslips available")).toBeVisible()
  await expect(
    page.getByText(
      "Your published payslips will appear here once they're available.",
    ),
  ).toBeVisible()
  await expect(page.getByRole("table", { name: "My payslips" })).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "No payroll concerns" }),
  ).toBeVisible()
  await expect(
    page.getByRole("table", { name: "Payroll concerns" }),
  ).toHaveCount(0)
  await page.reload()
  await expect(page.getByText("No payslips available")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("My Payroll")
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).not.toContainText("Attendance")
  await expect(
    page.getByRole("link", { name: "Approvals", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Raise a concern" }).click()
  const concernDialog = page.getByRole("dialog")
  await concernDialog.getByRole("combobox", { name: "Concern type" }).click()
  await page
    .getByRole("option", { name: "Payroll discrepancy", exact: true })
    .click()
  await expect(
    concernDialog.getByText("Related payslip", { exact: true }),
  ).toBeVisible()
  await expect(
    concernDialog.getByRole("heading", { name: "No published payslips" }),
  ).toBeVisible()
  await concernDialog
    .getByLabel("Describe your concern")
    .fill("My expected salary has not arrived.")
  await concernDialog.getByRole("button", { name: "Submit concern" }).click()
  await expect(page.getByText("Payroll concern submitted")).toBeVisible()
  expect(concernPayload).toMatchObject({ type: "PAYROLL_DISCREPANCY" })
  expect(concernPayload).not.toHaveProperty("payslipId")
})
