import { expect, test } from "@playwright/test"
import { accountFor, configureRegressionTest } from "../regression-support"
import type { ProjectWorkspaceDetail } from "../../src/features/project-workspace/api/project-workspace-api"

configureRegressionTest()

const workspace: ProjectWorkspaceDetail = {
  id: "workspace-1",
  name: "Website launch",
  structure: "SEPARATE",
  status: "IN_PROGRESS",
  client: { id: "client-1", fullName: "Mara Client" },
  updatedAt: "2026-11-09T00:00:00Z",
  activityCount: 0,
  canCreate: false,
  canManage: false,
  workstreams: [],
  activity: [],
}

test("staff project routes preserve the current mixed client and staff behavior", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  const projectReads: string[] = []
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: accountFor("STAFF") } })
    if (path === "/api/projects") {
      projectReads.push(path)
      return route.fulfill({ json: [] })
    }
    if (path === "/api/projects/project-1") {
      projectReads.push(path)
      return route.fulfill({
        json: {
          id: "project-1",
          name: "Staff project",
          description: null,
          status: "IN_PROGRESS",
          startDate: null,
          createdAt: "2026-11-09T00:00:00Z",
          workspaceManaged: true,
          canManage: false,
          request: null,
          milestones: [],
          deliverables: [],
        },
      })
    }
    return route.fulfill({
      json: { notifications: [], unreadCount: 0 },
    })
  })

  await page.goto("/projects")
  await expect(page).toHaveURL(/\/projects$/)
  await expect(
    page.getByRole("heading", { name: "My Projects", exact: true }),
  ).toBeVisible()

  await page.goto("/projects/project-1/deliverables/deliverable-1")
  await expect(page).toHaveURL(
    /\/projects\/project-1\/deliverables\/deliverable-1$/,
  )
  await expect(
    page.getByText("Shared deliverable not found", { exact: true }),
  ).toBeVisible()
  expect(projectReads).toEqual(["/api/projects", "/api/projects/project-1"])
})

for (const width of [1440, 390]) {
  test(`workspace archive and search keep active and ended projects separate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "test-session"),
    )
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === "/api/auth/me")
        return route.fulfill({ json: { user: accountFor("STAFF") } })
      if (path === "/api/project-workspace")
        return route.fulfill({
          json: {
            canCreate: false,
            workspaces: [
              workspace,
              {
                ...workspace,
                id: "archive-1",
                name: "Completed branding",
                status: "COMPLETED",
              },
              {
                ...workspace,
                id: "archive-2",
                name: "Cancelled campaign",
                status: "CANCELLED",
              },
            ],
          },
        })
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    })
    await page.goto("/project-workspace")
    const main = page.getByRole("main")
    const table = main.getByRole("table", { name: "Project workspaces" })
    await expect(
      table.getByRole("link", { name: workspace.name, exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Completed branding", { exact: true }),
    ).toHaveCount(0)
    await main
      .getByRole("searchbox", { name: "Search projects" })
      .fill("missing")
    await expect(
      table.getByText("No projects match these filters.", { exact: true }),
    ).toBeVisible()
    await main.getByRole("button", { name: /Archive/ }).click()
    await expect(
      main.getByRole("searchbox", { name: "Search projects" }),
    ).toHaveValue("")
    await expect(
      table.getByRole("link", { name: "Completed branding", exact: true }),
    ).toBeVisible()
    await expect(
      table.getByRole("link", { name: "Cancelled campaign", exact: true }),
    ).toBeVisible()
    await expect(table.getByText(workspace.name, { exact: true })).toHaveCount(
      0,
    )
    await main
      .getByRole("searchbox", { name: "Search projects" })
      .fill("branding")
    await expect(
      table.getByText("Cancelled campaign", { exact: true }),
    ).toHaveCount(0)
    await expect(
      table.getByRole("link", { name: "Completed branding", exact: true }),
    ).toHaveAttribute("href", "/project-workspace/archive-1")
    await expect(
      main.getByRole("button", { name: "New project", exact: true }),
    ).toHaveCount(0)
  })
  for (const kind of ["projects", "project-workspace"] as const) {
    test(`${kind} detail recovers from a failed load after reload at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      let reads = 0
      let unavailable = true
      await page.addInitScript(() =>
        sessionStorage.setItem("nexus.auth.token", "test-session"),
      )
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path === "/api/auth/me")
          return route.fulfill({ json: { user: accountFor("STAFF") } })
        if (path === `/api/${kind}/workspace-1`) {
          reads++
          if (unavailable)
            return route.fulfill({
              status: 503,
              json: { error: "Project temporarily unavailable" },
            })
          return route.fulfill({
            json:
              kind === "project-workspace"
                ? workspace
                : {
                    id: workspace.id,
                    name: workspace.name,
                    description: "Project description",
                    status: "IN_PROGRESS",
                    startDate: null,
                    createdAt: workspace.updatedAt,
                    workspaceManaged: false,
                    canManage: false,
                    request: null,
                    milestones: [],
                  },
          })
        }
        return route.fulfill({
          json: {
            notifications: [],
            unreadCount: 0,
            workspaces: [],
            canCreate: false,
          },
        })
      })
      await page.goto(`/${kind}/workspace-1`)
      const main = page.getByRole("main")
      await expect(main.getByRole("alert")).toHaveText(
        "Project temporarily unavailable",
      )
      await expect(
        main.getByRole("heading", { name: workspace.name, exact: true }),
      ).toHaveCount(0)
      const failedReads = reads
      unavailable = false
      await page.reload()
      await expect(
        main.getByRole("heading", { name: workspace.name, exact: true }),
      ).toBeVisible()
      await expect(main.getByRole("alert")).toHaveCount(0)
      expect(reads).toBeGreaterThan(failedReads)
      if (kind === "project-workspace") {
        const navigation = main.getByRole("navigation", {
          name: "Project sections",
        })
        for (const [section, content] of [
          ["Deliverables", "No deliverables yet"],
          ["Team", "No staff assigned yet"],
          ["Activity", "No activity yet"],
          ["Overview", "Project details"],
        ]) {
          const button = navigation.getByRole("button", {
            name: section,
            exact: true,
          })
          await button.click()
          await expect(
            main.getByRole("heading", { name: content, exact: true }),
          ).toBeVisible()
        }
        await expect(
          main.getByRole("button", { name: "Manage project status" }),
        ).toHaveCount(0)
      }
    })
  }
}
