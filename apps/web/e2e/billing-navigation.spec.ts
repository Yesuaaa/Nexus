import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()
test.setTimeout(120_000)
const routes = [
  ["overview", "Overview"],
  ["management/invoices", "Invoices"],
  ["management/payments", "Payments"],
  ["expenses", "Expenses"],
  ["reports/revenue", "Revenue"],
  ["reports/collections", "Collections"],
  ["reports/receivables", "Receivables"],
  ["reports/expense-summary", "Expense Summary"],
  ["settings/billing-configuration", "Billing Configuration"],
  ["settings/payment-methods", "Payment Methods"],
  ["settings/invoice-numbering", "Invoice Numbering"],
] as const

for (const role of ["ADMIN", "SUPERADMIN"] as const) {
  test(`${role} can open Billing and navigate each page`, async ({ page }) => {
    await restoreSession(page, role)
    await page.route("**/api/billing/invoices**", async (route) =>
      route.fulfill({ json: { rows: [], page: 1, pageSize: 10, total: 0 } }),
    )
    await page.goto("/module")
    await expect(
      page.getByRole("link", { name: "Open Billing & Finance workspace" }),
    ).toBeVisible()
    await page
      .getByRole("link", { name: "Open Billing & Finance workspace" })
      .focus()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/billing-finance\/overview$/)
    const sidebar = page.getByRole("complementary", {
      name: "Primary navigation",
    })
    for (const [path, title] of routes) {
      await page.goto(`/billing-finance/${path}`)
      await expect(
        page.getByRole("heading", { name: title, exact: true }).first(),
      ).toBeVisible()
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb" }),
      ).toContainText(title)
      await expect(
        sidebar.getByRole("link", {
          name: path.startsWith("management/")
            ? "Management"
            : path === "expenses" || path === "reports/expense-summary"
              ? "Expenses"
              : title,
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page")
      await page.reload()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
    }
    for (const [parent, child] of [
      ["management", "invoices"],
      ["reports", "revenue"],
      ["settings", "billing-configuration"],
    ]) {
      await page.goto(`/billing-finance/${parent}`)
      await expect(page).toHaveURL(new RegExp(`${parent}/${child}$`))
    }
  })
}
for (const role of ["STAFF", "USER"] as const) {
  test(`${role} cannot open Billing`, async ({ page }) => {
    await restoreSession(page, role)
    await page.goto("/billing-finance/overview")
    await expect(page).not.toHaveURL(/billing-finance/)
  })
}

test("invoice list loads, searches, paginates and reports errors", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/billing/invoices**", async (route) => {
    const url = new URL(route.request().url())
    const search = url.searchParams.get("search")
    const pageNumber = Number(url.searchParams.get("page") || 1)
    if (search === "error")
      return route.fulfill({
        status: 500,
        json: { error: "Unable to load invoices" },
      })
    const rows =
      search === "none"
        ? []
        : [
            {
              id: "inv1",
              invoiceNumber: pageNumber === 2 ? "INV-002" : "INV-001",
              client: {
                fullName: "Example Client",
                email: "client@example.test",
              },
              request: { title: "Design" },
              dueDate: "2099-01-01T00:00:00Z",
              total: "100.00",
              outstanding: "75.00",
              displayStatus: "PARTIALLY_PAID",
            },
          ]
    return route.fulfill({
      json: {
        rows,
        total: search === "none" ? 0 : 11,
        page: pageNumber,
        pageSize: 10,
      },
    })
  })
  await page.goto("/billing-finance/management/invoices")
  await expect(page.getByText("INV-001")).toBeVisible()
  await expect(page.getByText("₱75.00")).toBeVisible()
  await page.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(page.getByText("INV-002")).toBeVisible()
  const search = page.getByRole("searchbox", { name: "Search invoices" })
  await search.fill("none")
  await expect(page.getByText("No invoices found")).toBeVisible()
  await search.fill("error")
  await expect(
    page.getByRole("table", { name: "Invoices" }).getByRole("alert"),
  ).toContainText("Unable to load invoices")
})

test("Billing disclosures use route-aware expansion and active states", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/billing/invoices**", (route) =>
    route.fulfill({ json: { rows: [], page: 1, pageSize: 10, total: 0 } }),
  )
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  for (const [path, group, child] of [
    ["overview", "Billing & Finance", "Overview"],
    ["management/invoices", "Billing & Finance", "Management"],
    ["expenses", "Reports", "Expenses"],
    ["reports/revenue", "Reports", "Revenue"],
    ["reports/collections", "Reports", "Collections"],
    ["reports/receivables", "Reports", "Receivables"],
    ["reports/expense-summary", "Reports", "Expenses"],
    ["settings/billing-configuration", "Settings", "Billing Configuration"],
    ["settings/payment-methods", "Settings", "Payment Methods"],
    ["settings/invoice-numbering", "Settings", "Invoice Numbering"],
  ]) {
    await page.goto(`/billing-finance/${path}`)
    await expect(
      sidebar.getByRole("button", { name: group, exact: true }),
    ).toHaveAttribute("aria-expanded", "true")
    await expect(
      sidebar.getByRole("link", { name: child, exact: true }),
    ).toHaveAttribute("aria-current", "page")
    await page.reload()
    await expect(
      sidebar.getByRole("button", { name: group, exact: true }),
    ).toHaveAttribute("aria-expanded", "true")
  }
  await sidebar.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(
    sidebar.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveAttribute("aria-expanded", "false")
  await expect(
    sidebar.getByRole("link", { name: "Calendar", exact: true }),
  ).toBeVisible()
  await expect(
    sidebar.getByRole("link", { name: "Internal Messages", exact: true }),
  ).toBeVisible()
})

test("Admin records an invoice payment from the detail panel", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let saved = false
  await page.route("**/api/billing/invoices**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        amount: string
        paidAt: string
        idempotencyKey: string
      }
      expect(body.amount).toBe("25.00")
      expect(body.paidAt).toBe("2026-11-24")
      expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
      saved = true
      return route.fulfill({ status: 201, json: { created: true } })
    }
    return route.fulfill({
      json: {
        rows: [
          {
            id: "invoice-1",
            invoiceNumber: "INV-001",
            client: { fullName: "Example", email: "client@example.test" },
            request: { title: "Design" },
            description: "Design work",
            projectId: null,
            status: "ISSUED",
            version: 1,
            issueDate: "2026-11-01T00:00:00Z",
            dueDate: "2099-01-01T00:00:00Z",
            total: "100.00",
            collected: "0.00",
            outstanding: "100.00",
            displayStatus: "ISSUED",
            payments: [],
            workflowPayment: null,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    })
  })
  await page.goto("/billing-finance/management/invoices")
  await page.getByRole("button", { name: "View invoice" }).click()
  await page.getByRole("button", { name: "Record payment" }).click()
  await page.getByLabel("Amount (PHP)").fill("25.00")
  await page.getByLabel("Payment date").fill("2026-11-24")
  await page.getByRole("button", { name: "Save payment" }).click()
  await expect.poll(() => saved).toBe(true)
  await expect(page.getByRole("dialog", { name: "INV-001" })).toHaveCount(0)
})

test("Admin creates an invoice draft for a service request", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let saved = false
  await page.route("**/api/billing/requests**", (route) =>
    route.fulfill({
      json: {
        rows: [
          {
            id: "request-1",
            title: "Design",
            referenceNumber: "REQ-1",
            client: {
              fullName: "Example Client",
              email: "client@example.test",
            },
            project: null,
            workflow: null,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    }),
  )
  await page.route("**/api/billing/invoices**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        requestId: string
        total: string
        description: string
      }
      expect(body.requestId).toBe("request-1")
      expect(body.total).toBe("120.50")
      expect(body.description).toBe("Design work")
      saved = true
      return route.fulfill({
        status: 201,
        json: { invoice: { id: "invoice-1" } },
      })
    }
    return route.fulfill({
      json: { rows: [], page: 1, pageSize: 10, total: 0 },
    })
  })
  await page.goto("/billing-finance/management/invoices")
  await page.getByRole("button", { name: "Create invoice" }).click()
  await page.getByRole("combobox", { name: "Service request" }).click()
  await page.getByRole("option", { name: "Example Client · REQ-1" }).click()
  await page.getByLabel("Description").fill("Design work")
  await page.getByLabel("Total (PHP)").fill("120.50")
  await page.getByLabel("Issue date").fill("2026-11-24")
  await page.getByLabel("Due date").fill("2026-12-24")
  await page.getByRole("button", { name: "Save draft" }).click()
  await expect.poll(() => saved).toBe(true)
})

test("payments page shows distinct sources and payment details", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/billing/payments**", (route) =>
    route.fulfill({
      json: {
        rows: [
          {
            id: "pay1",
            source: "COMMENCEMENT",
            clientName: "Example Client",
            amount: "30.00",
            invoiceNumber: null,
            allocation: "UNALLOCATED",
            paidAt: "2026-11-01T00:00:00.000Z",
            reference: "REF-1",
            status: "VERIFIED",
            sandbox: false,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    }),
  )
  await page.goto("/billing-finance/management/payments")
  await expect(page.getByText("Example Client")).toBeVisible()
  await expect(page.getByText("Unallocated")).toBeVisible()
  await page.getByRole("button", { name: "View payment" }).click()
  await expect(
    page.getByRole("dialog", { name: "Payment details" }),
  ).toContainText("REF-1")
})

test("Admin records an expense", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  let saved = false
  await page.route("**/api/billing/expenses**", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        amount: string
        category: string
      }
      expect(body.amount).toBe("25.50")
      expect(body.category).toBe("Software")
      saved = true
      return route.fulfill({
        status: 201,
        json: { expense: { id: "expense-1" } },
      })
    }
    return route.fulfill({
      json: { rows: [], total: 0, page: 1, pageSize: 10 },
    })
  })
  await page.goto("/billing-finance/expenses")
  await page.getByRole("button", { name: "Record expense" }).click()
  const panel = page.getByRole("dialog", { name: "Record expense" })
  await panel.getByLabel("Description").fill("Cloud service")
  await panel.getByLabel("Category", { exact: true }).fill("Software")
  await panel.getByLabel("Amount (PHP)").fill("25.50")
  await panel.getByLabel("Expense date").fill("2026-11-24")
  await panel.getByRole("button", { name: "Save expense" }).click()
  await expect.poll(() => saved).toBe(true)
})

test("Admin can persist billing configuration", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  let saved = false
  await page.route("**/api/billing/settings", (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as {
        defaultDueDays: number
        invoicePrefix: string
      }
      expect(body.defaultDueDays).toBe(14)
      expect(body.invoicePrefix).toBe("INV")
      saved = true
      return route.fulfill({ json: { configuration: { ...body, version: 1 } } })
    }
    return route.fulfill({
      json: {
        configuration: {
          defaultTerms: "Net 30",
          defaultDueDays: 30,
          invoicePrefix: "INV",
          version: 0,
        },
        methods: [],
      },
    })
  })
  await page.goto("/billing-finance/settings/billing-configuration")
  await page.getByLabel("Default due period (days)").fill("14")
  await page.getByRole("button", { name: "Save settings" }).click()
  await expect.poll(() => saved).toBe(true)
})

test("finance overview and reports display server totals", async ({ page }) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/billing/overview", (route) =>
    route.fulfill({
      json: {
        totals: {
          invoiced: "100.00",
          collected: "25.00",
          outstanding: "75.00",
          overdue: "0.00",
          current: "75.00",
          unallocated: "0.00",
          expenses: "0.00",
          netCollections: "25.00",
          monthlyExpenses: "0.00",
        },
        aging: ["0.00", "0.00", "0.00", "0.00"],
        performance: [
          { month: "2026-11", collections: "25.00", expenses: "4.00" },
        ],
        activity: [
          {
            id: "p1",
            reference: "PAY-1",
            description: "Acme",
            type: "Payment",
            amount: "25.00",
            status: "Received",
            date: "2026-11-24T00:00:00Z",
          },
          {
            id: "e1",
            reference: "EXP-1",
            description: "Hosting",
            type: "Expense",
            amount: "4.00",
            status: "Recorded",
            date: "2026-11-23T00:00:00Z",
          },
        ],
        recentPayments: [],
        outstandingInvoices: [],
        unallocated: [],
      },
    }),
  )
  await page.route("**/api/billing/reports/revenue**", (route) =>
    route.fulfill({
      json: {
        metrics: [
          {
            label: "Total Billed",
            value: "100.00",
            description: "Issued in period",
            money: true,
          },
        ],
        chartTitle: "Billed vs Collected",
        breakdownTitle: "Revenue by Client",
        series: ["Billed", "Collected"],
        aging: [],
        columns: ["Issue Date", "Billed"],
        rows: [{ id: "i1", cells: ["2026-11-01", "100.00"] }],
        chart: [{ label: "2026-11", first: "100.00", second: "0.00" }],
        breakdown: [{ label: "Client", value: "100.00" }],
      },
    }),
  )
  await page.goto("/billing-finance/overview")
  await expect(page.getByText("₱100.00")).toBeVisible()
  await expect(page.getByRole("img", { name: /Collections/ })).toBeVisible()
  await page.getByRole("searchbox", { name: "Search activity" }).fill("Hosting")
  await expect(page.getByText("EXP-1")).toBeVisible()
  await expect(page.getByText("PAY-1")).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole("heading", { name: "Outstanding Receivables" }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  await page.goto("/billing-finance/reports/revenue")
  await expect(
    page.getByRole("table", { name: "Revenue report" }),
  ).toContainText("2026-11-01")
  await expect(
    page.getByRole("region", { name: "Revenue summary" }),
  ).toContainText("₱100.00")
})

test("Superadmin settings are read-only", async ({ page }) => {
  await restoreSession(page, "SUPERADMIN")
  await page.goto("/billing-finance/settings/billing-configuration")
  await expect(page.getByLabel("Default due period (days)")).toHaveAttribute(
    "readonly",
    "",
  )
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(
    0,
  )
})

test("Admin can change a draft service request", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  let saved = false
  await page.route("**/api/billing/requests**", (route) =>
    route.fulfill({
      json: {
        rows: [
          {
            id: "request-2",
            title: "New request",
            referenceNumber: "REQ-2",
            client: { fullName: "Other Client", email: "other@example.test" },
            project: null,
            workflow: null,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    }),
  )
  await page.route("**/api/billing/invoices**", (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as {
        requestId: string
        version: number
      }
      expect(body.requestId).toBe("request-2")
      expect(body.version).toBe(0)
      saved = true
      return route.fulfill({ json: { invoice: { id: "invoice-1" } } })
    }
    return route.fulfill({
      json: {
        rows: [
          {
            id: "invoice-1",
            requestId: "request-1",
            quotationId: null,
            invoiceNumber: "INV-001",
            client: { fullName: "Example", email: "client@example.test" },
            request: {
              title: "Old request",
              referenceNumber: "REQ-1",
              project: null,
            },
            description: "Design work",
            projectId: null,
            status: "DRAFT",
            version: 0,
            issueDate: "2026-11-01T00:00:00Z",
            dueDate: "2026-12-01T00:00:00Z",
            total: "100.00",
            collected: "0.00",
            outstanding: "100.00",
            displayStatus: "DRAFT",
            payments: [],
            workflowPayment: null,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    })
  })
  await page.goto("/billing-finance/management/invoices")
  await page.getByRole("button", { name: "View invoice" }).click()
  await page.getByRole("button", { name: "Edit draft" }).click()
  await page.getByRole("combobox", { name: "Service request" }).click()
  await page.getByRole("option", { name: "Other Client · REQ-2" }).click()
  await page.getByRole("button", { name: "Save draft" }).click()
  await expect.poll(() => saved).toBe(true)
})

test("finance overview shows an error and retries without fake totals", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let fail = true
  await page.route("**/api/billing/overview", async (route) => {
    if (fail)
      return route.fulfill({
        status: 500,
        json: { error: "Overview unavailable" },
      })
    return route.fulfill({
      json: {
        totals: {
          invoiced: "0.00",
          collected: "0.00",
          outstanding: "0.00",
          overdue: "0.00",
          current: "0.00",
          unallocated: "0.00",
          expenses: "0.00",
          netCollections: "0.00",
          monthlyExpenses: "0.00",
        },
        aging: ["0.00", "0.00", "0.00", "0.00"],
        performance: [],
        activity: [],
        outstandingInvoices: [],
      },
    })
  })
  await page.goto("/billing-finance/overview")
  await expect(page.getByText("Overview unavailable")).toBeVisible()
  await expect(page.getByText("₱0.00")).toHaveCount(0)
  fail = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("heading", { name: "Outstanding Receivables" }),
  ).toBeVisible()
})

test("finance overview keeps monetary hierarchy and fits small screens", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/billing/overview", (route) =>
    route.fulfill({
      json: {
        totals: {
          invoiced: "1234567890.00",
          collected: "50000.00",
          outstanding: "987654321.00",
          overdue: "20000.00",
          current: "987634321.00",
          unallocated: "5000.00",
          expenses: "13900.00",
          netCollections: "36100.00",
          monthlyExpenses: "13900.00",
        },
        aging: ["987634321.00", "15000.00", "5000.00", "0.00"],
        performance: [
          { month: "2026-10", collections: "45000.00", expenses: "8200.00" },
          { month: "2026-11", collections: "50000.00", expenses: "13900.00" },
        ],
        activity: [
          {
            id: "p1",
            reference: "PAY-1",
            description: "Acme",
            type: "Payment",
            amount: "50000.00",
            status: "Received",
            date: "2026-11-24T00:00:00Z",
          },
        ],
        outstandingInvoices: [
          {
            id: "i1",
            invoiceNumber: "INV-1",
            clientName: "Acme",
            total: "75000.00",
            outstanding: "60000.00",
            dueDate: "2026-11-20T00:00:00Z",
            status: "OVERDUE",
          },
        ],
      },
    }),
  )
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto("/billing-finance/overview")
  const hero = page.getByRole("region", { name: "Outstanding Receivables" })
  const kpis = page.getByRole("region", { name: "Billing performance" })
  await expect(hero.getByText("₱987,654,321.00", { exact: true })).toBeVisible()
  await expect(hero.getByText("₱987,654,321.00", { exact: true })).toHaveCSS(
    "font-size",
    "30px",
  )
  await expect(kpis.getByText("₱1,234,567,890.00")).toHaveCSS(
    "font-size",
    "24px",
  )
  await expect(page.getByText("₱8,200.00")).toBeVisible()
  await expect(page.getByText("OVERDUE", { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("finance-desktop.png"),
    fullPage: true,
  })
  for (const width of [1024, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
    await expect
      .poll(() =>
        kpis
          .locator("article")
          .evaluateAll((cards) =>
            cards.every((card) => card.scrollWidth <= card.clientWidth),
          ),
      )
      .toBe(true)
  }
  await page.screenshot({
    path: testInfo.outputPath("finance-mobile.png"),
    fullPage: true,
  })
})

test("collapsed Reports group opens Expenses", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/billing-finance/overview")
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await sidebar.getByRole("button", { name: "Collapse sidebar" }).click()
  const expenses = sidebar.getByRole("button", {
    name: "Reports",
    exact: true,
  })
  await expect(expenses).toBeVisible()
  await expect(expenses.locator("svg")).toBeVisible()
  await expenses.click()
  await page.getByRole("menuitem", { name: "Expenses", exact: true }).click()
  await expect(page).toHaveURL(/billing-finance\/expenses$/)
  await expect(
    sidebar
      .getByRole("button", { name: "Settings", exact: true })
      .locator("svg.lucide-settings"),
  ).toBeVisible()
})

test("financial dashboards share date controls and searchable details", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "SUPERADMIN")
  const seen: string[] = []
  await page.route("**/api/billing/reports/*/dashboard**", (route) => {
    const url = new URL(route.request().url())
    seen.push(url.searchParams.get("from") || "")
    const kind = url.pathname.split("/").at(-2)
    const label =
      kind === "collections"
        ? "Collections Over Time"
        : kind === "receivables"
          ? "Receivable Aging"
          : kind === "expense-summary"
            ? "Expenses Over Time"
            : "Billed vs Collected"
    return route.fulfill({
      json: {
        metrics: [
          {
            label: "Selected total",
            value: "45.00",
            description: "Selected period",
            money: true,
          },
        ],
        chartTitle: label,
        breakdownTitle: "Source breakdown",
        series: ["First", "Second"],
        aging:
          kind === "receivables"
            ? [{ label: "0–30 days", value: "45.00" }]
            : [],
        columns: ["Reference", "Amount"],
        rows: [{ id: "r1", cells: ["REPORT-123", "45.00"] }],
        chart: [{ label: "2026-11", first: "45.00", second: "0.00" }],
        breakdown: [{ label: "Category A", value: "45.00" }],
      },
    })
  })
  for (const [path, title] of [
    ["revenue", "Revenue"],
    ["collections", "Collections"],
    ["receivables", "Receivables"],
    ["expense-summary", "Expense Summary"],
  ]) {
    await page.goto(`/billing-finance/reports/${path}`)
    await expect(
      page.getByRole("region", { name: `${title} summary` }),
    ).toContainText("₱45.00")
    await expect(
      page.getByRole("table", { name: `${title} report` }),
    ).toContainText("REPORT-123")
    await expect(page.getByText("Category A")).toBeVisible()
    if (path === "revenue")
      await page.screenshot({
        path: testInfo.outputPath("revenue-desktop.png"),
        fullPage: true,
      })
    await page
      .getByRole("searchbox", { name: "Search report records" })
      .fill("missing")
    await expect(page.getByText("No report records")).toBeVisible()
    await page
      .getByRole("searchbox", { name: "Search report records" })
      .fill("")
    await page.getByRole("combobox", { name: "Reporting period" }).click()
    await page.getByRole("option", { name: "Custom Range" }).click()
    await page.getByLabel("From").fill("2026-11-01")
    await page.getByLabel("To", { exact: true }).fill("2026-11-30")
    await expect.poll(() => seen.includes("2026-11-01")).toBe(true)
    await expect(
      page.getByRole("table", { name: `${title} report` }),
    ).toContainText("REPORT-123")
    await page.setViewportSize({ width: 390, height: 844 })
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
    await page.setViewportSize({ width: 1280, height: 850 })
  }
})

test("report dashboard distinguishes errors from empty results", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let fail = true
  await page.route("**/api/billing/reports/revenue/dashboard**", (route) =>
    fail
      ? route.fulfill({ status: 500, json: { error: "Report unavailable" } })
      : route.fulfill({
          json: {
            metrics: [
              {
                label: "Total Billed",
                value: "0.00",
                description: "Issued in period",
                money: true,
              },
            ],
            chartTitle: "Billed vs Collected",
            breakdownTitle: "Revenue by Client",
            series: ["Billed", "Collected"],
            aging: [],
            columns: [],
            rows: [],
            chart: [],
            breakdown: [],
          },
        }),
  )
  await page.goto("/billing-finance/reports/revenue")
  await expect(page.getByText("Report unavailable")).toBeVisible()
  await expect(page.getByText("₱0.00")).toHaveCount(0)
  fail = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("₱0.00")).toBeVisible()
  await expect(page.getByText("No activity in this period")).toBeVisible()
  await expect(page.getByText("No report records")).toBeVisible()
})
