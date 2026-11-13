import { expect, test, type Page } from "@playwright/test"
import type { ProjectWorkspace } from "../src/features/projects/api/projects-api"
import type { WorkspaceDirectoryRow } from "../src/features/project-workspace/api/project-workspace-api"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test("directory links and cancel distinguish a group and project with the same ID", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const shared = {
    id: "shared-id",
    clientName: "Client",
    statuses: ["PLANNED"],
    projectCount: 1,
    updatedAt: "2026-11-09T00:00:00Z",
    progress: null,
    canManage: true,
  } as const
  const group: WorkspaceDirectoryRow = {
    ...shared,
    statuses: ["PLANNED"],
    rowId: "group:shared-id",
    kind: "group",
    name: "Grouped workspace",
    canRename: true,
  }
  const project: WorkspaceDirectoryRow = {
    ...shared,
    statuses: ["PLANNED"],
    rowId: "ungrouped-project:shared-id",
    kind: "ungrouped-project",
    name: "Standalone project",
    canRename: false,
  }
  const writes: string[] = []
  let cancelled = false
  await page.route("**/api/project-workspace/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    if (path.endsWith("/directory")) {
      const rows = cancelled ? [group] : [group, project]
      return route.fulfill({
        json: {
          rows,
          page: 1,
          pageSize: 10,
          total: rows.length,
          totalPages: 1,
          hasWorkspaces: true,
        },
      })
    }
    if (path.endsWith("/cancel")) {
      writes.push(path)
      cancelled = true
      return route.fulfill({ json: { saved: true } })
    }
    const target = [group, project].find(({ rowId }) =>
      path.endsWith(`/${rowId}`),
    )
    if (!target) return route.fallback()
    return route.fulfill({
      json: {
        ...target,
        status: "PLANNED",
        structure: "SEPARATE",
        client: { id: "client", fullName: "Client" },
        workstreams: [],
        activity: [],
      },
    })
  })
  await page.goto("/project-workspace")
  for (const target of [group, project]) {
    await page.getByRole("link", { name: target.name, exact: true }).click()
    await expect(page).toHaveURL(
      `/project-workspace/${encodeURIComponent(target.rowId)}`,
    )
    await expect(
      page.getByRole("heading", { name: target.name, exact: true }),
    ).toBeVisible()
    await page.goBack()
  }
  await page
    .getByRole("button", { name: "More actions for Standalone project" })
    .click()
  await page.getByRole("menuitem", { name: "Cancel project" }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel project" })
    .click()
  await expect(
    page.getByRole("link", { name: group.name, exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: project.name, exact: true }),
  ).toHaveCount(0)
  expect(writes).toEqual([
    "/api/project-workspace/ungrouped-project:shared-id/cancel",
  ])
})

test("department heads can navigate between workspace Overview and Management", async ({
  page,
}) => {
  const detailRequests: string[] = []
  page.on("request", (request) => {
    const { pathname } = new URL(request.url())
    if (
      pathname.startsWith("/api/project-workspace/") &&
      pathname !== "/api/project-workspace/directory" &&
      pathname !== "/api/project-workspace/overview"
    )
      detailRequests.push(pathname)
  })
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await page.route("**/api/project-workspace/overview", (route) =>
    route.fulfill({
      json: {
        totals: {
          totalProjects: 0,
          inProgress: 0,
          completed: 0,
          onHold: 0,
          planned: 0,
          cancelled: 0,
          workspaceGroups: 0,
          projectsWithTasks: 0,
          projectsWithoutTasks: 0,
          totalTasks: 0,
          completedTasks: 0,
          outstandingTasks: 0,
          upcomingTasks: 0,
          overdueTasks: 0,
        },
        statusDistribution: [
          { status: "PLANNED", count: 0 },
          { status: "IN_PROGRESS", count: 0 },
          { status: "ON_HOLD", count: 0 },
          { status: "COMPLETED", count: 0 },
          { status: "CANCELLED", count: 0 },
        ],
        clientDistribution: [],
        workspaceProgress: [],
        upcomingDeadlines: [],
        overdueTaskList: [],
      },
    }),
  )
  await page.goto("/project-workspace/overview")
  await expect(
    page.getByRole("heading", { name: "Project Overview" }),
  ).toBeVisible()
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await expect(
    sidebar.getByRole("link", { name: "Project Workspace overview" }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    sidebar.getByRole("link", { name: "Project Messages" }),
  ).toBeVisible()
  await sidebar
    .getByRole("link", { name: "Project Workspace Management" })
    .click()
  await expect(page).toHaveURL(/\/project-workspace$/)
  await expect(
    sidebar.getByRole("link", { name: "Project Workspace Management" }),
  ).toHaveAttribute("aria-current", "page")
  await sidebar.getByRole("button", { name: "Collapse sidebar" }).click()
  await sidebar
    .getByRole("button", { name: "Project Workspace", exact: true })
    .click()
  await page
    .getByRole("menuitem", { name: "Project Workspace overview" })
    .click()
  await expect(page).toHaveURL(/\/project-workspace\/overview$/)
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByText("Overview", { exact: true }),
  ).toBeVisible()
  expect(detailRequests).toEqual([])
})

test("department heads see department project analytics and can open Management", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const requestPaths: string[] = []
  let preferencesLoaded = false
  await page.route("**/api/auth/settings", (route) => {
    preferencesLoaded = true
    return route.fulfill({
      json: {
        preferences: {
          timeZone: "UTC",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "12h",
          workflowNotifications: true,
        },
        sessions: [],
      },
    })
  })
  let releaseOverview: () => void = () => {}
  const overviewResponseGate = new Promise<void>((resolve) => {
    releaseOverview = resolve
  })
  const overviewRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/project-workspace/overview",
  )
  await page.route("**/api/project-workspace/overview", async (route) => {
    expect(preferencesLoaded).toBe(true)
    requestPaths.push(new URL(route.request().url()).pathname)
    await overviewResponseGate
    return route.fulfill({
      json: {
        totals: {
          totalProjects: 6,
          inProgress: 2,
          completed: 1,
          onHold: 1,
          planned: 1,
          cancelled: 1,
          workspaceGroups: 2,
          projectsWithTasks: 4,
          projectsWithoutTasks: 2,
          totalTasks: 10,
          completedTasks: 6,
          outstandingTasks: 4,
          upcomingTasks: 1,
          overdueTasks: 1,
        },
        statusDistribution: [
          { status: "PLANNED", count: 1 },
          { status: "IN_PROGRESS", count: 2 },
          { status: "ON_HOLD", count: 1 },
          { status: "COMPLETED", count: 1 },
          { status: "CANCELLED", count: 1 },
        ],
        clientDistribution: [
          { id: "client-1", name: "Acme", projectCount: 4 },
          { id: "client-2", name: "Northwind", projectCount: 2 },
        ],
        workspaceProgress: [
          {
            identity: "group:group-1",
            kind: "group",
            name: "Website workspace",
            projectCount: 2,
            completedTasks: 4,
            totalTasks: 8,
          },
          {
            identity: "ungrouped-project:project-1",
            kind: "ungrouped-project",
            name: "Brand refresh",
            projectCount: 1,
            completedTasks: 0,
            totalTasks: 0,
          },
        ],
        upcomingDeadlines: [
          {
            id: "task-upcoming",
            title: "Approve wireframes",
            projectId: "project-1",
            projectName: "Brand refresh",
            dueDate: "2026-11-20",
            status: "IN_PROGRESS",
          },
        ],
        overdueTaskList: [
          {
            id: "task-overdue",
            title: "Review content",
            projectId: "project-2",
            projectName: "Website workspace",
            dueDate: "2026-11-12",
            status: "NOT_STARTED",
          },
        ],
      },
    })
  })
  await page.goto("/project-workspace/overview")
  await expect(
    page.getByRole("heading", { name: "Project Overview", exact: true }),
  ).toBeVisible()
  await overviewRequest
  await expect(
    page.getByRole("region", { name: "Project overview", exact: true }),
  ).toHaveAttribute("aria-busy", "true")
  releaseOverview()
  await expect(
    page.getByRole("heading", { name: "Project status distribution" }),
  ).toBeVisible()
  await expect(
    page.getByText("6 / 10 tasks · 60%", { exact: true }),
  ).toBeVisible()
  const completionChart = page.getByRole("group", {
    name: "Workspace completion by workspace",
  })
  await expect(completionChart.getByText("0%", { exact: true })).toBeVisible()
  await expect(completionChart.getByText("50%", { exact: true })).toBeVisible()
  await expect(completionChart.getByText("100%", { exact: true })).toBeVisible()
  await expect(
    completionChart.getByRole("progressbar", {
      name: "Website workspace task progress",
    }),
  ).toHaveAttribute("aria-valuenow", "4")
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible()
  await expect(page.getByText("Northwind", { exact: true })).toBeVisible()
  const unplannedSummary = page.getByRole("region", {
    name: "Projects without work plans",
  })
  await expect(unplannedSummary).toContainText("2 unplanned")
  await expect(unplannedSummary).toContainText(
    "Unplanned projects are excluded from task-weighted completion.",
  )
  await expect(
    page.getByText("Approve wireframes", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Review content", { exact: true })).toBeVisible()
  const requestsBeforeRefresh = requestPaths.length
  const refreshedOverview = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/project-workspace/overview",
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event("project-workspace-list-changed")),
  )
  await refreshedOverview
  expect(requestPaths).toHaveLength(requestsBeforeRefresh + 1)
  await page.getByRole("link", { name: "Manage projects" }).click()
  await expect(page).toHaveURL(/\/project-workspace$/)
  expect(requestPaths.length).toBeGreaterThan(0)
  expect(new Set(requestPaths)).toEqual(
    new Set(["/api/project-workspace/overview"]),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/project-workspace/overview")
  await expect(
    page.getByRole("heading", { name: "Project status distribution" }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto("/project-workspace/overview")
  await expect(
    page.getByRole("heading", { name: "Project status distribution" }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("workspace overview recovers from errors and shows empty department data", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let fail = true
  await page.route("**/api/project-workspace/overview", (route) =>
    fail
      ? route.fulfill({ status: 503, json: { error: "Overview unavailable" } })
      : route.fulfill({
          json: {
            totals: {
              totalProjects: 0,
              inProgress: 0,
              completed: 0,
              onHold: 0,
              planned: 0,
              cancelled: 0,
              workspaceGroups: 0,
              projectsWithTasks: 0,
              projectsWithoutTasks: 0,
              totalTasks: 0,
              completedTasks: 0,
              outstandingTasks: 0,
              upcomingTasks: 0,
              overdueTasks: 0,
            },
            statusDistribution: [
              { status: "PLANNED", count: 0 },
              { status: "IN_PROGRESS", count: 0 },
              { status: "ON_HOLD", count: 0 },
              { status: "COMPLETED", count: 0 },
              { status: "CANCELLED", count: 0 },
            ],
            clientDistribution: [],
            workspaceProgress: [],
            upcomingDeadlines: [],
            overdueTaskList: [],
          },
        }),
  )
  await page.goto("/project-workspace/overview")
  await expect(
    page.getByRole("main", { name: "Project overview" }).getByRole("alert"),
  ).toContainText("Overview unavailable")
  fail = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByText("No projects yet.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("No client projects yet.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("No task deadlines in the next 14 days.", { exact: true }),
  ).toBeVisible()
})

test("department workspace directory paginates, resets filters, and recovers from errors", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let failed = true
  const requests: URLSearchParams[] = []
  await page.route("**/api/project-workspace/directory?*", (route) => {
    const params = new URL(route.request().url()).searchParams
    requests.push(params)
    if (failed)
      return route.fulfill({
        status: 503,
        json: { error: "Directory unavailable" },
      })
    const currentPage = Number(params.get("page"))
    const empty =
      Boolean(params.get("search")) || params.get("view") === "archive"
    return route.fulfill({
      json: {
        page: currentPage,
        pageSize: 10,
        total: empty ? 0 : 11,
        totalPages: empty ? 0 : 2,
        hasWorkspaces: true,
        rows: empty
          ? []
          : [
              {
                rowId: `ungrouped-project:project-${currentPage}`,
                id: `project-${currentPage}`,
                kind: "ungrouped-project",
                name: `Project on page ${currentPage}`,
                clientName: "Client",
                statuses: ["PLANNED"],
                projectCount: 1,
                updatedAt: "2026-11-09T00:00:00Z",
                progress: null,
                canManage: true,
                canRename: false,
              },
            ],
      },
    })
  })
  await page.goto("/project-workspace")
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Directory unavailable",
  )
  failed = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("link", { name: "Project on page 1" }),
  ).toHaveAttribute("href", "/project-workspace/ungrouped-project%3Aproject-1")
  await page
    .getByRole("button", { name: "More actions for Project on page 1" })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "Edit project" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("menuitem", { name: "Cancel project" }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await page
    .getByRole("navigation", { name: "Workspace pages" })
    .getByRole("button", { name: /page 2/i })
    .click()
  await expect(
    page.getByRole("link", { name: "Project on page 2" }),
  ).toBeVisible()
  await page
    .getByRole("searchbox", { name: "Search workspaces" })
    .fill("missing")
  await expect(
    page.getByText("No workspaces match these filters"),
  ).toBeVisible()
  expect(requests.at(-1)?.get("page")).toBe("1")
  await page.getByRole("searchbox", { name: "Search workspaces" }).clear()
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(page.getByText("Archive is empty")).toBeVisible()
})

test("ordinary Staff keep their Project Workspace link and cannot open Overview", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await page.goto("/project-workspace")
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await expect(
    sidebar.getByRole("link", { name: "Project Workspace", exact: true }),
  ).toBeVisible()
  await expect(
    sidebar.getByRole("link", { name: "Project Workspace overview" }),
  ).toHaveCount(0)
  await expect(
    sidebar.getByRole("link", { name: "Project Messages" }),
  ).toBeVisible()
  await page.goto("/project-workspace/overview")
  await expect(page).toHaveURL(/\/module$/)
})

async function mockProject(page: Page, contributor: boolean) {
  const project: ProjectWorkspace = {
    id: "project-1",
    name: "Business website",
    description: "An accessible five-page website",
    status: "IN_PROGRESS",
    startDate: "2026-10-30T10:00:00Z",
    createdAt: "2026-10-30T09:30:00Z",
    workspaceManaged: false,
    canManage: contributor,
    request: {
      id: "request-1",
      referenceNumber: "SR-2026-100",
      service: { name: "Website Development" },
    },
    milestones: [
      {
        id: "milestone-1",
        title: "Design approval",
        completedAt: null,
        deliveryStatus: "NOT_SUBMITTED",
        sentToClientAt: null,
      },
    ],
    deliverables: contributor
      ? []
      : [
          {
            id: "shared-deliverable",
            title: "Shared website build",
            description: null,
            expectedFileType: "Plain text",
            sentToClientAt: "2026-10-30T11:00:00Z",
            workflowFile: {
              id: "shared-file",
              name: "website.txt",
              mimeType: "text/plain",
              size: 12,
              createdAt: "2026-10-30T11:00:00Z",
            },
            clientReviews: [],
          },
        ],
  }
  const writes: unknown[] = []
  const state = { failUpdate: false }
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "project-session"),
  )
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    expect(route.request().headers().authorization).toBe(
      "Bearer project-session",
    )
    if (path === "/api/auth/me")
      return route.fulfill({
        json: { user: accountFor(contributor ? "STAFF" : "USER") },
      })
    if (path === "/api/request-workflows/notifications")
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    if (path === "/api/projects/project-1")
      return route.fulfill({ json: project })
    if (path === "/api/projects/project-1/milestones/milestone-1") {
      expect(route.request().method()).toBe("PATCH")
      const input = route.request().postDataJSON() as { completed: boolean }
      writes.push(input)
      if (state.failUpdate)
        return route.fulfill({
          status: 503,
          json: { error: "Milestone temporarily unavailable" },
        })
      project.milestones[0]!.completedAt = input.completed
        ? "2026-10-30T11:00:00Z"
        : null
      return route.fulfill({ json: project })
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } })
  })
  return { writes, state }
}

test("client project workspace shows shared deliverables and project chat handoff on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { writes } = await mockProject(page, false)
  await page.goto("/projects/project-1")
  await expect(
    page.getByRole("heading", { name: "Business website", exact: true }),
  ).toBeVisible()
  await page.goto("/projects/project-1?tab=deliverables")
  await page.screenshot({
    path: "test-results/project-deliverables-mobile.png",
    fullPage: true,
  })
  await expect(page.getByText("Design approval", { exact: true })).toHaveCount(
    0,
  )
  await expect(
    page.getByText("Shared website build", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "View Shared website build", exact: true }),
  ).toHaveAttribute(
    "href",
    "/projects/project-1/deliverables/shared-deliverable",
  )
  await expect(
    page.getByRole("link", { name: "Open project chat", exact: true }),
  ).toHaveAttribute("href", "/messages?project=project-1")
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(
    0,
  )
  expect(writes).toHaveLength(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

for (const width of [1440, 390]) {
  test(`failed milestone updates preserve progress and can be retried at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const { writes, state } = await mockProject(page, true)
    state.failUpdate = true
    await page.goto("/projects/project-1")
    await page
      .getByRole("button", { name: "Mark complete", exact: true })
      .click()
    await expect(
      page.getByText("Couldn't update milestone", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("0/1 completed", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Mark complete", exact: true }),
    ).toBeEnabled()
    state.failUpdate = false
    await page
      .getByRole("button", { name: "Mark complete", exact: true })
      .click()
    await expect(page.getByText("1/1 completed", { exact: true })).toBeVisible()
    expect(writes).toEqual([{ completed: true }, { completed: true }])
  })
}

test("assigned staff can complete and reopen a project milestone", async ({
  page,
}) => {
  const { writes } = await mockProject(page, true)
  await page.goto("/projects/project-1")
  await page.getByRole("button", { name: "Mark complete" }).click()
  await expect(page.getByText("1/1 completed", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Reopen", exact: true }).click()
  await expect(page.getByText("0/1 completed", { exact: true })).toBeVisible()
  expect(writes).toEqual([{ completed: true }, { completed: false }])
  await expect(
    page.getByRole("link", { name: "View service conversation" }),
  ).toHaveCount(0)
})
