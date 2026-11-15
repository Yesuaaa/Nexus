import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type { AdministrativeRequest } from "../src/features/request-inbox/api/administrative-requests-api"

configureRegressionTest()
test.skip(live, "Administrative request coverage uses isolated API fixtures")

const request: AdministrativeRequest = {
  id: "request-1",
  referenceNumber: "SR-1",
  title: "Organization request",
  status: "UNDER_REVIEW",
  acceptedDepartmentId: "design",
  acceptedBy: { id: "head", fullName: "Accepting head" },
  acceptedDepartment: {
    id: "design",
    name: "Design",
    head: { id: "head", fullName: "Accepting head" },
  },
  packageName: "Standard",
  expectedTimeline: "Two weeks",
  preferredSpecialistName: "Preferred person",
  createdAt: "2026-11-14T00:00:00Z",
  updatedAt: "2026-11-14T00:00:00Z",
  service: {
    id: "service",
    name: "Design service",
    departments: [{ id: "design", name: "Design" }],
  },
  client: {
    fullName: "Client",
    email: "client@example.test",
    contactNumber: null,
  },
  workflow: { state: "CONSULTATION", updatedAt: "2026-11-14T00:00:00Z" },
  project: {
    id: "project",
    name: "Related project",
    status: "PLANNED",
    staff: [
      {
        employee: {
          id: "employee",
          fullName: "Assigned Designer",
          position: "Designer",
        },
        isTeamLead: true,
      },
    ],
  },
  capabilities: {
    read: true,
    accept: false,
    reject: false,
    staff: false,
    approveQuotation: false,
    verifyPayment: false,
    mutateWorkflow: false,
    participate: false,
    downloadFiles: false,
  },
}

for (const width of [390, 1440]) {
  test(`Superadmin inspects requests in the shared drawer at ${width}px without operational actions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await restoreSession(page, "SUPERADMIN")
    const prohibited: string[] = []
    page.on("request", (req) => {
      const path = new URL(req.url()).pathname
      if (
        path.startsWith("/api/") &&
        (req.method() !== "GET" ||
          /^\/api\/(?:request-inbox(?:\/|$)|request-workflows\/(?!notifications$)|request-conversations\/)/.test(
            path,
          ))
      )
        prohibited.push(path)
    })
    await page.route("**/api/administrative-requests**", (route) => {
      const url = new URL(route.request().url())
      return route.fulfill({
        json: url.pathname.endsWith("/request-1")
          ? { serviceRequest: request }
          : {
              serviceRequests: [request],
              departments: [{ id: "design", name: "Design" }],
              total: 1,
              page: 1,
              pageSize: 10,
            },
      })
    })
    await page.goto("/services")
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const menu = page.getByRole("navigation", { name: "Main menu" })
    await expect(
      menu.getByRole("link", { name: "Service Requests", exact: true }),
    ).toHaveCount(0)
    await expect(
      menu.getByRole("button", { name: "Service", exact: true }),
    ).toHaveAttribute("aria-expanded", "true")
    await page.getByRole("link", { name: "Requests", exact: true }).click()
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    await expect(
      menu.getByRole("link", { name: "Requests", exact: true }),
    ).toHaveAttribute("aria-current", "page")
    if (width < 768)
      await page
        .getByRole("complementary", { name: "Primary navigation" })
        .getByRole("button", { name: "Close navigation menu" })
        .click()
    await expect(
      page.getByRole("table", { name: "Organization service requests" }),
    ).toBeVisible()
    await page
      .getByLabel("Search service requests", { exact: true })
      .fill("Design")
    await expect
      .poll(() =>
        page
          .getByLabel("Search service requests", { exact: true })
          .inputValue(),
      )
      .toBe("Design")
    await page
      .getByRole("button", { name: "Inspect request request-1", exact: true })
      .click()
    await expect(page).toHaveURL(/\?request=request-1$/)
    const drawer = page.getByRole("dialog", {
      name: "Organization request",
      exact: true,
    })
    await expect(drawer).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Organization request", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Assigned Designer (Designer) · Team lead", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByText("CONSULTATION", { exact: true })).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath("request-drawer.png"),
    })
    await expect(
      page.getByRole("button", {
        name: /accept|reject|decline|delete|chat|approve|verify|staff/i,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: /open request workspace|download/i }),
    ).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(drawer).toHaveCount(0)
    await expect(page).toHaveURL(/\/module\/service-operations$/)
    await expect(
      page.getByLabel("Search service requests", { exact: true }),
    ).toHaveValue("Design")
    const inspect = page.getByRole("button", {
      name: "Inspect request request-1",
      exact: true,
    })
    await expect(inspect).toBeFocused()
    await inspect.click()
    await expect(drawer).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole("heading", { name: "Organization request", exact: true }),
    ).toBeVisible()
    await drawer.getByRole("button", { name: "Close request details" }).click()
    await expect(drawer).toHaveCount(0)
    expect(prohibited).toEqual([])
  })
}

test("backend rejection clears request details despite a cached administrative capability", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/administrative-requests?**", (route) =>
    route.fulfill({
      json: {
        serviceRequests: [],
        departments: [],
        total: 0,
        page: 1,
        pageSize: 10,
      },
    }),
  )
  await page.route("**/api/administrative-requests/**", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: "Organization-wide service request read access is required",
      },
    }),
  )
  await page.goto("/module/service-operations?request=request-1")
  await expect(
    page
      .getByRole("alert")
      .getByText("Organization-wide service request read access is required"),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Organization request", exact: true }),
  ).toHaveCount(0)
})

test("shared filters, sorting and pagination send administrative request scopes on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreSession(page, "SUPERADMIN")
  const queries: URLSearchParams[] = []
  await page.route("**/api/administrative-requests?**", (route) => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    const filtered = !!(
      query.get("search") ||
      query.get("status") ||
      query.get("departmentId")
    )
    const pageNumber = Number(query.get("page"))
    const rows = filtered ? 1 : pageNumber === 1 ? 10 : 1
    return route.fulfill({
      json: {
        serviceRequests: Array.from({ length: rows }, (_, index) => ({
          ...request,
          id: `request-${(pageNumber - 1) * 10 + index + 1}`,
        })),
        departments: [{ id: "design", name: "Design" }],
        total: filtered ? 1 : 11,
        page: pageNumber,
        pageSize: 10,
      },
    })
  })
  await page.goto("/module/service-operations")
  await page.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(
    page.getByRole("button", {
      name: "Inspect request request-11",
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole("combobox", {
      name: "Responsible or routed department",
      exact: true,
    })
    .click()
  await page.getByRole("option", { name: "Design", exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get("departmentId")).toBe("design")
  await expect.poll(() => queries.at(-1)?.get("page")).toBe("1")
  await page
    .getByRole("combobox", { name: "Request status", exact: true })
    .click()
  await page.getByRole("option", { name: "Under Review", exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get("status")).toBe("UNDER_REVIEW")
  await page
    .getByRole("button", { name: "Sort by service", exact: true })
    .click()
  await expect.poll(() => queries.at(-1)?.get("sortBy")).toBe("service")
  await page
    .getByLabel("Search service requests", { exact: true })
    .fill("Design")
  await expect.poll(() => queries.at(-1)?.get("search")).toBe("Design")
  await expect(
    page.getByRole("button", {
      name: "Inspect request request-1",
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: /chat|delete/i })).toHaveCount(
    0,
  )
})
