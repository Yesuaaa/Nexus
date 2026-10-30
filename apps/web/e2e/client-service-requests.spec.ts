import { expect, test, type Page } from "@playwright/test"
import type { ServiceRequestSummary } from "../src/features/services/api/client-services-api"

const timestamp = "2026-10-30T04:00:00.000Z"
function request(index: number): ServiceRequestSummary {
  return {
    id: `request-${index}`,
    referenceNumber: `SR-20261030-${index}`,
    title: `Website redesign ${index}`,
    status: index % 2 ? "SUBMITTED" : "CLOSED",
    description: "A new accessible website",
    service: { id: "web", name: "Web Development" },
    package: null,
    packageName: "Growth package",
    preferredSpecialist: {
      id: "alex",
      fullName: "Alex Santos",
      position: "Developer",
    },
    preferredSpecialistName: "Alex Santos",
    projectGoals: "Reach more customers",
    projectRequirements: "Accessible website with a booking form",
    expectedTimeline: "Within six weeks",
    additionalDetails: "Follow our brand guidelines",
    pricingModel: "FIXED",
    quotedPrice: "25000",
    currency: "PHP",
    billingInterval: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
async function session(page: Page, role = "USER") {
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-client"),
  )
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "client-a",
          email: "client@example.com",
          fullName: "Client A",
          role,
          isActive: true,
          permissions: ["dashboard:read", "profile:read"],
          createdAt: timestamp,
        },
      },
    }),
  )
}

for (const width of [1440, 390]) {
  test(`client request history, filters, pagination and details at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await session(page)
    const records = Array.from({ length: 12 }, (_, i) => request(i + 1))
    const calls: string[] = []
    await page.route("**/api/client/service-requests?*", (route) => {
      const url = new URL(route.request().url())
      calls.push(url.search)
      let rows = records.filter(
        (row) =>
          !url.searchParams.get("status") ||
          row.status === url.searchParams.get("status"),
      )
      const search = url.searchParams.get("search") || ""
      rows = rows.filter((row) =>
        row.title.toLowerCase().includes(search.toLowerCase()),
      )
      if (url.searchParams.get("sortOrder") === "asc")
        rows = [...rows].reverse()
      const pageNumber = Number(url.searchParams.get("page"))
      return route.fulfill({
        json: {
          requests: rows.slice((pageNumber - 1) * 10, pageNumber * 10),
          total: rows.length,
          page: pageNumber,
          pageSize: 10,
          summary: {
            total: 12,
            pending: 6,
            inProgress: 0,
            completed: 6,
            cancelled: 0,
          },
        },
      })
    })
    await page.goto("/service-requests")
    await expect(
      page.getByRole("heading", { name: "Service Requests", exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Showing 1–10 of 12")).toBeVisible()
    await page.getByRole("button", { name: "Next page", exact: true }).click()
    await expect(page.getByText("Showing 11–12 of 12")).toBeVisible()
    await page
      .getByRole("combobox", { name: "Filter by request status" })
      .click()
    await page
      .getByRole("option", { name: "Pending review", exact: true })
      .click()
    await expect(page.getByText("Showing 1–6 of 6")).toBeVisible()
    await page
      .getByRole("searchbox", { name: "Search service requests" })
      .fill("redesign 11")
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible()
    await page
      .getByRole("button", { name: "View Website redesign 11", exact: true })
      .filter({ visible: true })
      .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Reach more customers")
    await expect(dialog).toContainText("Alex Santos")
    await expect(dialog).toContainText(
      "Department Manager makes the final assignment",
    )
    await expect(dialog).toContainText("25,000.00")
    await page.screenshot({
      path: testInfo.outputPath(`request-details-${width}.png`),
    })
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click()
    await page.getByRole("combobox", { name: "Sort service requests" }).click()
    await page
      .getByRole("option", { name: "Oldest first", exact: true })
      .click()
    await expect.poll(() => calls.at(-1)).toContain("sortOrder=asc")
    await expect(
      page
        .getByRole("button", { name: "View Website redesign 12", exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`request-history-${width}.png`),
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page
      .getByRole("searchbox", { name: "Search service requests" })
      .fill("unmatched")
    await expect(
      page.getByRole("heading", { name: "No matching requests" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "New Service Request", exact: true }),
    ).toHaveAttribute("href", "/services")
  })
}

test("request history retries errors and shows the first-request empty state", async ({
  page,
}) => {
  await session(page)
  let unavailable = true
  await page.route("**/api/client/service-requests?*", (route) => {
    return unavailable
      ? route.fulfill({
          status: 503,
          json: { error: "Requests temporarily unavailable" },
        })
      : route.fulfill({
          json: {
            requests: [],
            total: 0,
            page: 1,
            pageSize: 10,
            summary: {
              total: 0,
              pending: 0,
              inProgress: 0,
              completed: 0,
              cancelled: 0,
            },
          },
        })
  })
  await page.goto("/service-requests")
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Requests temporarily unavailable",
  )
  unavailable = false
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "No service requests yet" }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Browse services", exact: true }),
  ).toHaveAttribute("href", "/services")
})

test("history renders the manager lifecycle statuses", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await session(page)
  const statuses = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "AWAITING_CLIENT_INFO",
    "READY_FOR_QUOTATION",
    "CLOSED",
    "CANCELLED",
  ] as const
  await page.route("**/api/client/service-requests?*", (route) =>
    route.fulfill({
      json: {
        requests: statuses.map((status, index) => ({
          ...request(index + 1),
          status,
        })),
        total: statuses.length,
        page: 1,
        pageSize: 10,
        summary: {
          total: 6,
          pending: 1,
          inProgress: 3,
          completed: 1,
          cancelled: 1,
        },
      },
    }),
  )
  await page.goto("/dashboard")
  await page
    .getByRole("link", { name: "Service Requests", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Service Requests", exact: true }),
  ).toBeVisible()
  const table = page.getByRole("table")
  for (const label of [
    "Pending review",
    "Under review",
    "Awaiting your information",
    "Ready for quotation",
    "Closed",
    "Cancelled",
  ])
    await expect(table.getByText(label, { exact: true })).toBeVisible()
})

for (const role of ["ADMIN", "STAFF", "SUPERADMIN"]) {
  test(`${role} cannot open client service requests or fetch their data`, async ({
    page,
  }) => {
    await session(page, role)
    const calls: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/api/client/")) calls.push(request.url())
    })
    await page.goto("/service-requests")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("link", { name: "Service Requests", exact: true }),
    ).toHaveCount(0)
    expect(calls).toEqual([])
  })
}
