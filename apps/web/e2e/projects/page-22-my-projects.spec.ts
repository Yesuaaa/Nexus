import { expect, test, type Page, type TestInfo } from "@playwright/test"
import type {
  ClientProjectSummary,
  ProjectWorkspace,
} from "../../src/features/projects/api/projects-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const timestamp = "2026-11-10T08:00:00.000Z"

function summary(
  overrides: Partial<ClientProjectSummary> = {},
): ClientProjectSummary {
  return {
    id: "project-22-1",
    name: "Website Launch",
    description: "A distinctive brief phrase",
    status: "IN_PROGRESS",
    startDate: timestamp,
    updatedAt: timestamp,
    request: {
      id: "request-22-1",
      referenceNumber: "SR-2026-221",
      service: { name: "Website Development" },
    },
    completedTasks: 1,
    taskCount: 2,
    deliverableCount: 1,
    ...overrides,
  }
}

async function clientList(page: Page, projects: ClientProjectSummary[]) {
  await restoreSession(page, "USER")
  const requests: { authorization: string | undefined; url: string }[] = []
  await page.route("**/api/projects", async (route) => {
    requests.push({
      authorization: route.request().headers().authorization,
      url: route.request().url(),
    })
    await route.fulfill({ json: projects })
  })
  return requests
}

async function selectOption(page: Page, name: string, option: string) {
  await page.getByRole("combobox", { name }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

test("[P22-WEB-001] client list values link to the matching project details", async ({
  page,
}) => {
  const requests = await clientList(page, [summary()])
  const mutations: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith("/api/projects") && request.method() !== "GET")
      mutations.push(`${request.method()} ${url.pathname}`)
  })
  const details: ProjectWorkspace = {
    id: "project-22-1",
    name: "Website Launch",
    description: "A distinctive brief phrase",
    status: "IN_PROGRESS",
    startDate: timestamp,
    createdAt: timestamp,
    workspaceManaged: false,
    canManage: false,
    request: {
      id: "request-22-1",
      referenceNumber: "SR-2026-221",
      service: { name: "Website Development" },
    },
    milestones: [],
    progress: { completed: 1, total: 2 },
    deliverables: [],
    changeRequests: [],
  }
  await page.route("**/api/projects/project-22-1", (route) =>
    route.fulfill({ json: details }),
  )

  await page.goto("/projects")
  const main = page.getByRole("main", { name: "My projects" })
  const table = main.getByRole("table", { name: "My projects" })
  await expect(
    table.getByRole("link", { name: "Website Launch", exact: true }),
  ).toHaveAttribute("href", "/projects/project-22-1")
  await expect(table).toContainText("SR-2026-221")
  await expect(table).toContainText("Website Development")
  await expect(table).toContainText("1 deliverable")
  await expect(table).toContainText("In progress")
  await expect(
    table.getByRole("progressbar", { name: "Website Launch progress" }),
  ).toHaveAttribute("aria-valuenow", "50")
  expect(requests).toHaveLength(1)
  expect(requests[0]?.url).toMatch(/\/api\/projects$/)
  expect(requests[0]?.authorization).toBe("Bearer test-session")

  await table.getByRole("link", { name: "Website Launch", exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/project-22-1$/)
  await expect(
    page.getByRole("heading", { name: "Website Launch", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("A distinctive brief phrase")).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(
    page
      .getByRole("main", { name: "My projects" })
      .getByRole("link", { name: "Website Launch", exact: true }),
  ).toBeVisible()
  expect(mutations).toEqual([])
})

test("[P22-WEB-002] search, status filters, and update sorting follow the client list contract", async ({
  page,
}) => {
  const projects = [
    summary(),
    summary({
      id: "project-22-2",
      name: "Brand Refresh",
      description: "A distinctive brief phrase",
      status: "ON_HOLD",
      updatedAt: "2026-11-09T08:00:00.000Z",
      request: {
        id: "request-22-2",
        referenceNumber: "SR-2026-222",
        service: { name: "SEO Audit" },
      },
    }),
    summary({
      id: "project-22-3",
      name: "Campaign Design",
      status: "COMPLETED",
      updatedAt: "2026-11-08T08:00:00.000Z",
      request: null,
    }),
    summary({
      id: "project-22-4",
      name: "Closed Campaign",
      status: "CANCELLED",
      updatedAt: "2026-11-07T08:00:00.000Z",
      request: null,
    }),
    summary({
      id: "project-22-5",
      name: "Planned Concept",
      status: "PLANNED",
      updatedAt: "2026-11-06T08:00:00.000Z",
      request: null,
    }),
  ]
  await clientList(page, projects)
  await page.goto("/projects")
  const main = page.getByRole("main", { name: "My projects" })
  const search = main.getByRole("searchbox", { name: "Search projects" })

  await search.fill("  wEbSiTe  ")
  await expect(
    main.getByRole("link", { name: "Website Launch", exact: true }),
  ).toBeVisible()
  await expect(
    main.getByRole("link", { name: "Brand Refresh", exact: true }),
  ).toHaveCount(0)

  await search.fill("seo")
  await expect(
    main.getByRole("link", { name: "Brand Refresh", exact: true }),
  ).toBeVisible()
  await search.fill("SR-2026-222")
  await expect(
    main.getByRole("link", { name: "Brand Refresh", exact: true }),
  ).toBeVisible()
  await search.fill("distinctive brief phrase")
  await expect(
    main.getByText("No projects match", { exact: true }),
  ).toBeVisible()

  await search.clear()
  await selectOption(page, "Filter projects by status", "Active")
  const activeTable = main.getByRole("table", { name: "My projects" })
  await expect(activeTable).toContainText("Website Launch")
  await expect(activeTable).toContainText("Brand Refresh")
  await expect(activeTable).not.toContainText("Campaign Design")
  await expect(activeTable).not.toContainText("Closed Campaign")

  await selectOption(page, "Filter projects by status", "Completed")
  await expect(
    main.getByRole("link", { name: "Campaign Design", exact: true }),
  ).toBeVisible()
  await selectOption(page, "Filter projects by status", "Cancelled")
  await expect(
    main.getByRole("link", { name: "Closed Campaign", exact: true }),
  ).toBeVisible()

  await selectOption(page, "Filter projects by status", "All Statuses")
  await selectOption(page, "Sort projects", "Least recently updated")
  const rows = main
    .getByRole("table", { name: "My projects" })
    .locator("tbody tr")
  await expect(rows.first()).toContainText("Planned Concept")
  await selectOption(page, "Sort projects", "Most recently updated")
  await expect(rows.first()).toContainText("Website Launch")
})

test("[P22-WEB-003] returning to an earlier list view starts at its first page", async ({
  page,
}) => {
  const projects = Array.from({ length: 11 }, (_, index) =>
    summary({
      id: `project-22-page-${index + 1}`,
      name: index === 0 ? "Website launch" : `Project ${index + 1}`,
      status: index === 10 ? "COMPLETED" : "IN_PROGRESS",
      updatedAt: timestamp,
      request: null,
    }),
  )
  await clientList(page, projects)
  await page.goto("/projects")
  const main = page.getByRole("main", { name: "My projects" })
  const pagination = main.getByRole("navigation", {
    name: "My Projects pages",
  })
  await expect(main.getByRole("status")).toContainText("Showing 1–10 of 11")
  await expect(
    pagination.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled()
  await expect(
    pagination.getByRole("button", { name: "Next page" }),
  ).toBeEnabled()

  await pagination.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(main.getByRole("status")).toContainText("Showing 11–11 of 11")
  await expect(
    pagination.getByRole("button", { name: "Previous page" }),
  ).toBeEnabled()
  await expect(
    pagination.getByRole("button", { name: "Next page" }),
  ).toBeDisabled()
  await expect(
    main.getByRole("link", { name: "Project 11", exact: true }),
  ).toBeVisible()

  await selectOption(page, "Filter projects by status", "Completed")
  await main.getByRole("searchbox", { name: "Search projects" }).fill("missing")
  await expect(
    main.getByText("No projects match", { exact: true }),
  ).toBeVisible()
  await main.getByRole("searchbox", { name: "Search projects" }).clear()
  await selectOption(page, "Filter projects by status", "All Statuses")

  await expect(
    main.getByRole("link", { name: "Website launch", exact: true }),
  ).toBeVisible()
})

test("[P22-WEB-004] staff route access surfaces the client-only project list API denial", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "department-22", name: "Design" } },
  })
  const requests: string[] = []
  await page.route("**/api/projects", async (route) => {
    requests.push(route.request().url())
    await route.fulfill({
      status: 403,
      json: { error: "Client project access required" },
    })
  })

  await page.goto("/projects")
  await expect(page).toHaveURL(/\/projects$/)
  await expect(
    page.getByRole("main", { name: "My projects" }).getByRole("alert"),
  ).toContainText("Client project access required")
  expect(requests).toHaveLength(1)
})

for (const role of ["ADMIN", "SUPERADMIN"] as const) {
  test(`[P22-WEB-005] ${role} is redirected away from My Projects`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    await page.goto("/projects")
    await expect(page).toHaveURL(/\/module$/)
    await expect(
      page.getByRole("heading", { name: "My Projects", exact: true }),
    ).toHaveCount(0)
  })
}

test("[P22-WEB-006] unauthenticated My Projects access redirects to login", async ({
  page,
}) => {
  await page.goto("/projects")
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
})

test("[P22-WEB-007] project list supports keyboard search and responsive layouts", async ({
  page,
}, testInfo: TestInfo) => {
  await clientList(page, [
    summary({
      name: "A Long Website Launch Name That Must Wrap Safely on Mobile",
    }),
  ])
  await page.goto("/projects")
  const main = page.getByRole("main", { name: "My projects" })
  const search = main.getByRole("searchbox", { name: "Search projects" })

  await search.focus()
  await search.pressSequentially("website")
  await expect(main).toContainText(
    "A Long Website Launch Name That Must Wrap Safely on Mobile",
  )
  await search.press("Escape")

  const mobileLayouts: {
    width: number
    mobileListVisible: boolean
    desktopTableVisible: boolean
  }[] = []
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(search).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    expect(
      dimensions.document,
      `document overflow at ${width}px`,
    ).toBeLessThanOrEqual(dimensions.viewport)
    expect(dimensions.body, `body overflow at ${width}px`).toBeLessThanOrEqual(
      dimensions.viewport,
    )
    const mobileListVisible = await main
      .getByRole("list", { name: "My projects" })
      .isVisible()
    const desktopTableVisible = await main
      .getByRole("table", { name: "My projects" })
      .isVisible()
    if (width <= 900)
      mobileLayouts.push({ width, mobileListVisible, desktopTableVisible })
    await page.screenshot({
      path: testInfo.outputPath(`page22-my-projects-${width}.png`),
      fullPage: true,
    })
  }
  expect(mobileLayouts).toEqual([
    { width: 768, mobileListVisible: true, desktopTableVisible: false },
    { width: 390, mobileListVisible: true, desktopTableVisible: false },
  ])
})
