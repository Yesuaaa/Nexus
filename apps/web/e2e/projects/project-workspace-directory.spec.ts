import { expect, test } from "@playwright/test"
import type { ProjectWorkspaceSummary } from "../../src/features/project-workspace/api/project-workspace-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const timestamp = "2026-11-10T08:00:00.000Z"

function workspace(
  id: string,
  name: string,
  status: ProjectWorkspaceSummary["status"],
  activityCount: number,
): ProjectWorkspaceSummary {
  return {
    id,
    name,
    structure: "SEPARATE",
    status,
    client: { id: "client-1", fullName: "Casey Client" },
    updatedAt: timestamp,
    activityCount,
    canCreate: false,
    canManage: false,
    workstreams: [
      {
        id: `project-${id}`,
        requestId: `request-${id}`,
        name,
        description: null,
        serviceName: "Website Design",
        referenceNumber: `SR-${id}`,
        workflowState: "ACTIVE_PROJECT",
        status,
        startDate: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        templateKey: null,
        taskCount: 0,
        completedTaskCount: 0,
        canUploadDeliverables: false,
        canAssign: false,
      },
    ],
  }
}

test("[P14-001] workspace directory sends the selected activity sort and renders its order", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")

  const recentProject = workspace(
    "workspace-recent",
    "Recent project",
    "PLANNED",
    1,
  )
  const activeProject = workspace(
    "workspace-active",
    "Most active project",
    "IN_PROGRESS",
    5,
  )
  const requestedSorts: string[] = []

  await page.route("**/api/project-workspace?**", async (route) => {
    const request = route.request()
    if (request.method() !== "GET") return route.fallback()

    const sort = new URL(request.url()).searchParams.get("sort") ?? ""
    requestedSorts.push(sort)
    await route.fulfill({
      json: {
        canCreate: false,
        workspaces:
          sort === "most-active"
            ? [activeProject, recentProject]
            : [recentProject, activeProject],
      },
    })
  })

  await page.goto("/project-workspace")
  const table = page.getByRole("table", { name: "Project workspaces" })
  await expect(table.getByRole("link").first()).toHaveText("Recent project")
  await expect(
    table.getByRole("link", { name: "Recent project", exact: true }),
  ).toHaveAttribute("href", "/project-workspace/workspace-recent")

  await page.getByRole("combobox", { name: "Sort projects" }).click()
  await page.getByRole("option", { name: "Most activity", exact: true }).click()

  await expect.poll(() => requestedSorts).toContain("most-active")
  await expect(table.getByRole("link").first()).toHaveText(
    "Most active project",
  )
})

test("[NEX-006] department heads are redirected away from the unmounted workspace wizard", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "department-1", name: "Design" } },
  })

  const workspaceRequests: { method: string; path: string }[] = []
  await page.route("**/api/project-workspace**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    workspaceRequests.push({ method: request.method(), path })

    if (path === "/api/project-workspace" && request.method() === "GET")
      return route.fulfill({ json: { canCreate: true, workspaces: [] } })

    return route.fulfill({ status: 404, json: { error: "Unexpected request" } })
  })

  await page.goto("/project-workspace/new")
  await expect(page).toHaveURL(/\/project-workspace$/)
  await expect(
    page.getByRole("heading", { name: "Project Workspace", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Create workspace", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("dialog", { name: "Start project from approved booking" }),
  ).toHaveCount(0)
  expect(
    workspaceRequests.some(
      ({ method, path }) =>
        method === "POST" ||
        path.endsWith("/approved-bookings") ||
        path.endsWith("/templates"),
    ),
  ).toBe(false)
})

test("[P14-002] clients cannot open the internal workspace creation route", async ({
  page,
}) => {
  await restoreSession(page, "USER")

  const workspaceRequests: string[] = []
  await page.route("**/api/project-workspace**", async (route) => {
    workspaceRequests.push(route.request().url())
    await route.fulfill({ json: { canCreate: false, workspaces: [] } })
  })

  await page.goto("/project-workspace/new")
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(workspaceRequests).toEqual([])
})

test("[P14-003] workspace directory retries a failed list request", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")

  const recoveredProject = workspace(
    "workspace-recovered",
    "Recovered project",
    "IN_PROGRESS",
    0,
  )
  let reads = 0

  await page.route("**/api/project-workspace?**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    reads += 1
    if (reads === 1) {
      return route.fulfill({
        status: 503,
        json: { error: "Workspace service temporarily unavailable." },
      })
    }
    return route.fulfill({
      json: { canCreate: false, workspaces: [recoveredProject] },
    })
  })

  await page.goto("/project-workspace")
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Workspace service temporarily unavailable." })
  await expect(alert).toContainText(
    "Workspace service temporarily unavailable.",
  )
  await alert.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page
      .getByRole("table", { name: "Project workspaces" })
      .getByRole("link", { name: "Recovered project", exact: true }),
  ).toBeVisible()
  expect(reads).toBe(2)
})
