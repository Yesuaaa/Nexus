import { expect, test } from "@playwright/test"
import { renderPayslipPdf } from "../../api/src/features/payroll/payslip-pdf"
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

test("Staff opens My Payroll from the module picker, downloads a PDF and raises a concern", async ({
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
    page.getByRole("link", { name: "Open Workforce Compliance workspace" }),
  ).toBeVisible()
  await page.getByRole("link", { name: "Open My Payroll workspace" }).click()
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
      if (path.endsWith("/preview") || path.endsWith("/download"))
        return route.fulfill({
          contentType: "application/pdf",
          body: Buffer.from(
            renderPayslipPdf({
              employee: slip.employeeName,
              employeeId: slip.employeeNumber,
              period: slip.period.cutoffLabel,
              dates: "2026-12-01 to 2026-12-31",
              frequency: "Monthly",
              revision: slip.revision,
              reference: slip.reference,
              generatedOn: slip.generatedAt.slice(0, 10),
              earnings: [{ name: "Base earnings", amount: slip.gross }],
              deductions: [],
              gross: slip.gross,
              totalDeductions: slip.deductions,
              net: slip.net,
            }),
          ),
        })
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
    const tabs = page.getByRole("group", { name: "Payroll history sections" })
    const headerBox = await page.locator("main > header").boundingBox()
    const tabsBox = await tabs.boundingBox()
    expect(headerBox).not.toBeNull()
    expect(tabsBox).not.toBeNull()
    expect(tabsBox!.y - (headerBox!.y + headerBox!.height)).toBeLessThanOrEqual(
      20,
    )
    await expect(tabs.getByRole("button")).toHaveText([
      "Payslips",
      "Approved Runs",
      "Payroll Requests",
    ])
    const payslipsTab = tabs.getByRole("button", {
      name: "Payslips",
      exact: true,
    })
    await expect(payslipsTab).toHaveAttribute("aria-pressed", "true")
    const activePanel = page.getByRole("tabpanel")
    await expect(
      activePanel.getByRole("heading", { name: "Payslips", exact: true }),
    ).toHaveCount(0)
    await expect(activePanel.locator("thead")).toHaveCSS(
      "background-color",
      "rgb(232, 238, 242)",
    )
    const payslipAction = activePanel.getByRole("button", {
      name: /^View payslip for /,
    })
    const table = activePanel.getByRole("table")
    const horizontalOverflow = () =>
      table.evaluate((element) => {
        const wrapper = element.parentElement!
        return wrapper.scrollWidth - wrapper.clientWidth
      })
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(1)
    await payslipAction.hover()
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(1)
    await payslipAction.click()
    const detail = page.getByRole("dialog", { name: "Payslip Details" })
    await expect(
      detail.getByText(slip.employeeNumber, { exact: true }),
    ).toBeVisible()
    await expect(
      detail.getByRole("region", { name: "Financial breakdown" }),
    ).toBeVisible()
    await expect(
      detail.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible()
    const download = page.waitForEvent("download")
    await detail.getByRole("button", { name: "Download PDF" }).click()
    expect((await download).suggestedFilename()).toBe(slip.reference + ".pdf")
    const desktopViewport = page.viewportSize()!
    await page.setViewportSize({ width: 375, height: 800 })
    const visibleTab = detail.getByRole("tabpanel")
    await expect
      .poll(() =>
        visibleTab.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1)
    await page.setViewportSize(desktopViewport)
    await detail.getByRole("tab", { name: "Document" }).click()
    await detail
      .getByRole("tabpanel")
      .getByRole("button", { name: "Preview PDF" })
      .click()
    const preview = page.getByRole("dialog", { name: "Payslip PDF preview" })
    await expect
      .poll(() =>
        page.frames().some((frame) => frame.url().startsWith("blob:")),
      )
      .toBe(true)
    await expect(
      preview.getByTitle(`Payslip preview for ${slip.employeeName}`),
    ).toHaveAttribute("src", /^blob:/)
    await page.keyboard.press("Escape")
    await expect(preview).toBeHidden()
    await page.keyboard.press("Escape")
    await expect(detail).toBeHidden()

    const search = page.getByRole("searchbox", { name: "Search payslips" })
    await search.fill(slip.reference)
    await tabs.getByRole("button", { name: "Approved Runs" }).click()
    await expect(
      tabs.getByRole("button", { name: "Approved Runs" }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(
      page
        .getByRole("tabpanel")
        .getByRole("heading", { name: "Approved runs", exact: true }),
    ).toHaveCount(0)
    if (role === "ADMIN") {
      await expect(page.getByRole("tabpanel").locator("thead")).toHaveCSS(
        "background-color",
        "rgb(232, 238, 242)",
      )
    }
    await expect(search).toHaveCount(0)
    await expect(
      page.getByRole("searchbox", { name: "Search approved runs" }),
    ).toHaveCount(role === "ADMIN" ? 1 : 0)
    await tabs.getByRole("button", { name: "Payroll Requests" }).click()
    await expect(
      page
        .getByRole("tabpanel")
        .getByRole("heading", { name: "Payroll requests", exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole("tabpanel").locator("thead")).toHaveCSS(
      "background-color",
      "rgb(232, 238, 242)",
    )
    await expect(
      page.getByRole("combobox", { name: "Request status" }),
    ).toBeVisible()
    await expect(
      page.getByRole("searchbox", { name: "Search approved runs" }),
    ).toHaveCount(0)
    await payslipsTab.click()
    await expect(search).toHaveValue(slip.reference)
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
  await expect(sidebar).not.toContainText("Workforce Compliance")
  await expect(sidebar).toContainText("My Payroll")
  await expect(
    sidebar.getByRole("link", { name: "My Payroll", exact: true }),
  ).toHaveAttribute("aria-current", "page")
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

for (const role of ["SUPERADMIN", "ADMIN"] as const) {
  test(role + " sees the permitted sandbox actions", async ({ page }) => {
    await restoreSession(page, role)
    let attempt: { outcome: string } | null = null
    await page.route("**/api/payroll/settings/preferences", (route) =>
      route.fulfill({ json: { requireSimulationConfirmation: true } }),
    )
    const batch = {
      id: "sandbox-batch",
      period: "November 2026",
      frequency: "MONTHLY",
      runId: "sample-run",
      revision: 1,
      status: "BLOCKED",
      employeeCount: 1,
      blockedCount: 1,
      totalNet: "12300.00",
      proposedAmount: "0.00",
      createdAt: "2026-11-17T08:00:00Z",
    }
    await page.route("**/api/payroll/disbursements**", async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith("/disbursements")) {
        return route.fulfill({ json: pageOf([batch]) })
      }
      if (url.pathname.endsWith("/simulate")) {
        expect(route.request().postDataJSON()).toMatchObject({
          outcome: "FAILED",
        })
        attempt = { outcome: "FAILED" }
        return route.fulfill({ json: batch })
      }
      return route.fulfill({
        json: {
          ...batch,
          simulatorEnabled: true,
          history: [],
          items: [
            {
              id: "sample-item",
              employeeId: "employee-1",
              employeeNumberSnapshot: "EMP-001",
              employeeEmail: "morgan@example.test",
              employeeNameSnapshot: "Morgan Payroll",
              approvedNet: "12300.00",
              reason: "Test fixture",
              status: "BLOCKED",
              destination: { kind: "TEST_BANK", masked: "•••• 1234" },
              attempt,
            },
          ],
        },
      })
    })
    await page.route("**/api/payroll/runs?**", (route) =>
      route.fulfill({ json: pageOf([]) }),
    )
    await page.goto("/module/payroll/disbursements")
    await page
      .getByRole("button", { name: "View disbursement batch November 2026" })
      .click()
    await expect(
      page.getByRole("tablist", { name: "Disbursement detail sections" }),
    ).toBeVisible()
    await page.getByRole("tab", { name: "Employee payouts" }).click()
    await expect(page.getByText("Test bank •••• 1234")).toBeVisible()
    const actions = page.getByRole("button", {
      name: "Actions for Morgan Payroll",
    })
    if (role === "SUPERADMIN") {
      await expect(actions).toBeDisabled()
    } else {
      await actions.click()
      await page.getByRole("menuitem", { name: "Simulate failure" }).click()
      const confirmation = page.getByRole("dialog", {
        name: "Record sandbox simulation?",
      })
      await expect(confirmation).toBeVisible()
      expect(attempt).toBeNull()
      await confirmation
        .getByRole("button", { name: "Record simulation" })
        .click()
      await expect(page.getByText("Simulation recorded")).toBeVisible()
      await expect(actions).toBeEnabled()
      await actions.click()
      await expect(
        page.getByRole("menuitem", { name: "Simulation recorded" }),
      ).toBeVisible()
    }
  })
}

test("Admin reviews an approved run and an employee payslip", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const run = {
    id: "approved-run-one",
    status: "APPROVED",
    calculationCount: 3,
    createdAt: "2026-12-01T08:00:00Z",
    updatedAt: "2026-12-01T08:00:00Z",
    createdBy: { id: "admin", fullName: "Payroll Admin", role: "ADMIN" },
    period: {
      id: "period-one",
      configurationId: "config-one",
      startDate: "2026-12-01",
      endDate: "2026-12-31",
      cutoffLabel: "December 2026",
      status: "OPEN",
      frequency: "MONTHLY",
      firstCutoffDay: null,
      currency: "PHP",
    },
    latestCalculation: {
      id: "approved-calculation-one",
      revision: 3,
      status: "COMPLETE",
      calculatedAt: "2026-12-01T08:00:00Z",
      currency: "PHP",
      grossTotal: "10100.00",
      deductionsTotal: "100.00",
      netTotal: "10000.00",
      calculatedItemCount: 1,
      reviewItemCount: 0,
      blockedItemCount: 0,
      payslipEmployeeCount: 1,
      payslipGeneratedCount: 1,
      payslipPublishedCount: 0,
      payslipStatus: "GENERATED",
    },
    calculationHistory: [],
  }
  const item = {
    id: "approved-item-one",
    employeeId: "employee-one",
    employeeNumber: "EMP-001",
    employeeName: "Morgan Payroll",
    employmentType: "FULL_TIME",
    status: "CALCULATED",
    currency: "PHP",
    grossAmount: "10100.00",
    deductionsAmount: "100.00",
    netAmount: "10000.00",
    compensationSnapshot: [],
    attendanceSnapshot: {},
    warnings: [],
    blocks: [],
    calculation: {
      id: "approved-calculation-one",
      revision: 3,
      status: "COMPLETE",
      calculatedAt: "2026-12-01T08:00:00Z",
    },
    components: [],
    payslip: {
      id: "payslip-one",
      reference: "PS-TEST",
      generatedAt: "2026-12-01T08:00:00Z",
      generatedBy: "admin",
      publishedAt: null,
      publishedBy: null,
    },
    payslipStatus: "GENERATED",
  }
  await page.route("**/api/payroll/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/settings/preferences"))
      return route.fulfill({ json: { requirePublicationConfirmation: false } })
    if (url.pathname.endsWith("/publish-payslips"))
      return route.fulfill({ json: { changed: 1, total: 1 } })
    if (url.pathname.endsWith("/runs"))
      return route.fulfill({ json: pageOf([run]) })
    if (url.pathname.endsWith("/items"))
      return route.fulfill({
        json: { ...pageOf([item]), calculationId: "approved-calculation-one" },
      })
    if (url.pathname.endsWith("/preview"))
      return route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: "%PDF-1.4\n%%EOF",
      })
    if (url.pathname.endsWith("/approved-run-one"))
      return route.fulfill({ json: run })
    return route.fulfill({ json: pageOf([]) })
  })
  await page.goto("/module/payroll/payslips")
  const views = page.getByRole("group", { name: "Payroll history sections" })
  await views.getByRole("button", { name: "Approved Runs" }).click()
  await expect(page.getByText("Generated", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Generate payslips", exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole("button", {
      name: "View approved run details for December 2026",
    })
    .click()
  await expect(
    page.getByRole("heading", { name: "Payslip Details" }),
  ).toBeVisible()
  const details = page.getByRole("dialog")
  await expect(details.getByText("₱10,000.00", { exact: true })).toBeVisible()
  await expect(
    details.getByText("Payroll period", { exact: true }),
  ).toHaveCount(0)
  await details.getByRole("tab", { name: "Employees" }).click()
  await expect(
    details.getByText("Morgan Payroll", { exact: true }),
  ).toBeVisible()
  const tableDimensions = await details.locator("table").evaluate((table) => {
    const wrapper = table.parentElement
    return {
      tableScrollWidth: table.scrollWidth,
      wrapperClientWidth: wrapper?.clientWidth ?? 0,
    }
  })
  expect(tableDimensions.tableScrollWidth).toBeLessThanOrEqual(
    tableDimensions.wrapperClientWidth,
  )
  const publication = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/publish-payslips"),
  )
  await details
    .getByRole("button", { name: "Publish payslips", exact: true })
    .click()
  await publication
  await expect(
    page.getByRole("dialog", { name: "Publish payslips?" }),
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Review payslip for Morgan Payroll" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Payslip review" }),
  ).toBeVisible()
  await expect(
    page.getByTitle("Payslip preview for Morgan Payroll"),
  ).toBeVisible()
})

test("Disbursement batch paginates, searches, filters, and sorts employee payouts", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/payroll/settings/preferences", (route) =>
    route.fulfill({ json: { requireSimulationConfirmation: false } }),
  )
  const batch = {
    id: "paged-batch",
    period: "November 2026",
    frequency: "MONTHLY",
    runId: "sample-run",
    revision: 1,
    status: "BLOCKED",
    employeeCount: 11,
    blockedCount: 11,
    totalNet: "12300.00",
    proposedAmount: "0.00",
    createdAt: "2026-11-17T08:00:00Z",
  }
  const items = Array.from({ length: 11 }, (_, index) => ({
    id: `item-${index + 1}`,
    employeeId: `employee-${index + 1}`,
    employeeNameSnapshot: `Employee ${String(index + 1).padStart(2, "0")}`,
    employeeNumberSnapshot: `EMP-${String(index + 1).padStart(3, "0")}`,
    employeeEmail: `employee${index + 1}@example.test`,
    approvedNet: `${10000 + index}.00`,
    destination: null,
    attempt: null,
    reason: "No verified production payout destination",
    status: "BLOCKED",
  }))
  const detailRequests: URL[] = []
  await page.route("**/api/payroll/disbursements**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/disbursements"))
      return route.fulfill({ json: pageOf([batch]) })
    if (url.pathname.endsWith("/runs"))
      return route.fulfill({ json: pageOf([]) })
    detailRequests.push(url)
    const search = url.searchParams.get("search") ?? ""
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10")
    const filtered = items.filter((item) =>
      [
        item.employeeNameSnapshot,
        item.employeeNumberSnapshot,
        item.employeeEmail,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    return route.fulfill({
      json: {
        ...batch,
        simulatorEnabled: true,
        history: [],
        items: filtered.slice(
          (pageNumber - 1) * pageSize,
          pageNumber * pageSize,
        ),
        itemsPage: {
          page: pageNumber,
          pageSize,
          total: filtered.length,
          search,
          status: url.searchParams.get("status") ?? "",
          sort: url.searchParams.get("sort") ?? "NAME_ASC",
        },
      },
    })
  })
  await page.route("**/api/payroll/runs?**", (route) =>
    route.fulfill({ json: pageOf([]) }),
  )
  await page.goto("/module/payroll/disbursements")
  await page
    .getByRole("button", { name: "View disbursement batch November 2026" })
    .click()
  await page.getByRole("tab", { name: "Employee payouts" }).click()
  await expect(page.getByText("Employee 01", { exact: true })).toBeVisible()
  await expect(page.getByText("Employee 11", { exact: true })).toHaveCount(0)
  await expect(
    page.getByText("Showing 1–10 of 11 employees", { exact: true }),
  ).toBeVisible()
  const itemPages = page.getByRole("navigation", {
    name: "Employee payout pages",
  })
  await itemPages.getByRole("button", { name: "Next page" }).click()
  await expect(page.getByText("Employee 11", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Showing 11–11 of 11 employees", { exact: true }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Employees per page" }).click()
  await page.getByRole("option", { name: "20 per page", exact: true }).click()
  await expect(
    page.getByText("Showing 1–11 of 11 employees", { exact: true }),
  ).toBeVisible()
  expect(detailRequests.at(-1)?.searchParams.get("pageSize")).toBe("20")
  await page
    .getByRole("searchbox", { name: "Search employees in this batch" })
    .fill("EMP-011")
  await page.waitForTimeout(250)
  await expect(page.getByText("Employee 11", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Showing 1–1 of 1 employees", { exact: true }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Payout status" }).click()
  await page.getByRole("option", { name: "Blocked", exact: true }).click()
  await page.getByRole("combobox", { name: "Sort payouts" }).click()
  await page
    .getByRole("option", { name: "Net pay high–low", exact: true })
    .click()
  await expect
    .poll(() => detailRequests.at(-1)?.searchParams.get("sort"))
    .toBe("NET_DESC")
  expect(detailRequests.at(-1)?.searchParams.get("status")).toBe("BLOCKED")
})

test("Admin prepares a batch from the shared dialog", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/payroll/settings/preferences", (route) =>
    route.fulfill({ json: { requireSimulationConfirmation: false } }),
  )
  let prepareCalls = 0
  const approvedRun = {
    id: "approved-run",
    status: "APPROVED",
    period: { cutoffLabel: "November 2026", frequency: "MONTHLY" },
    latestCalculation: {
      revision: 3,
      calculatedItemCount: 2,
      netTotal: "25000.00",
    },
  }
  await page.route("**/api/payroll/disbursements**", async (route) => {
    if (route.request().method() === "POST") {
      prepareCalls += 1
      return route.fulfill({
        json: {
          id: "prepared-batch",
          period: "November 2026",
          frequency: "MONTHLY",
          runId: approvedRun.id,
          revision: 3,
          status: "DRAFT",
          employeeCount: 2,
          blockedCount: 2,
          totalNet: "25000.00",
          proposedAmount: "0.00",
          createdAt: "2026-11-17T08:00:00Z",
        },
      })
    }
    return route.fulfill({ json: pageOf([]) })
  })
  await page.route("**/api/payroll/runs?**", (route) =>
    route.fulfill({ json: pageOf([approvedRun]) }),
  )
  await page.goto("/module/payroll/disbursements")
  const disbursements = page.getByRole("main", { name: "Disbursements" })
  const headerAction = disbursements.locator("header").getByRole("button", {
    name: "Prepare batch",
    exact: true,
  })
  await expect(headerAction).toBeVisible()
  await expect(
    disbursements.getByRole("heading", {
      name: "Disbursement batches",
      exact: true,
    }),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(headerAction).toBeVisible()
  await expect
    .poll(() =>
      disbursements.evaluate((main) => main.scrollWidth - main.clientWidth),
    )
    .toBeLessThanOrEqual(1)
  await headerAction.click()
  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("heading", { name: "Prepare Disbursement Batch" }),
  ).toBeVisible()
  await dialog.getByRole("combobox", { name: "Approved payroll run" }).click()
  await page.getByRole("option", { name: "November 2026", exact: true }).click()
  await expect(dialog.getByText("₱25,000.00", { exact: true })).toBeVisible()
  await dialog
    .getByRole("button", { name: "Prepare batch", exact: true })
    .click()
  await expect.poll(() => prepareCalls).toBe(1)
  await expect(dialog).toBeHidden()
})

test("Disbursements distinguishes a server error from an empty list", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let shouldFail = true
  await page.route("**/api/payroll/disbursements?**", (route) =>
    shouldFail
      ? route.fulfill({ status: 500, json: { error: "Internal server error" } })
      : route.fulfill({ json: pageOf([]) }),
  )
  await page.goto("/module/payroll/disbursements")
  await expect(
    page.getByRole("searchbox", { name: "Search batches" }),
  ).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Batch status" }),
  ).toBeVisible()
  await expect(
    page.getByRole("alert").filter({ hasText: "Internal server error" }),
  ).toBeVisible()
  await expect(page.getByText("No batches found", { exact: true })).toHaveCount(
    0,
  )
  shouldFail = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByText("No batches found", { exact: true }),
  ).toBeVisible()
})

test("Disbursements searches after 200 ms and shows loading before empty results", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const searches: string[] = []
  let allowResult = () => {}
  const result = new Promise<void>((resolve) => {
    allowResult = resolve
  })
  await page.route("**/api/payroll/disbursements?**", async (route) => {
    const query =
      new URL(route.request().url()).searchParams.get("search") ?? ""
    searches.push(query)
    if (query) await result
    await route.fulfill({ json: pageOf([]) })
  })
  await page.goto("/module/payroll/disbursements")
  await expect(
    page.getByText("No batches found", { exact: true }),
  ).toBeVisible()
  const clockStart = new Date()
  await page.clock.install({ time: clockStart })
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1000))
  const search = page.getByRole("searchbox", { name: "Search batches" })
  await search.fill("nov")
  await page.clock.runFor(150)
  await search.fill("november")
  await page.clock.runFor(199)
  expect(searches.filter(Boolean)).toEqual([])
  await page.clock.runFor(1)
  await expect.poll(() => searches.filter(Boolean)).toEqual(["november"])
  await expect(
    page.getByRole("table", { name: "Disbursement batches" }),
  ).toHaveAttribute("aria-busy", "true")
  await expect(
    page.getByText("No matching batches", { exact: true }),
  ).toHaveCount(0)
  allowResult()
  await expect(
    page.getByText("No matching batches", { exact: true }),
  ).toBeVisible()
  await search.clear()
  await expect.poll(() => searches.at(-1)).toBe("")
})
