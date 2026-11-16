import { expect, test } from "@playwright/test"
import { accountFor, configureRegressionTest } from "./regression-support"
import type { ProjectWorkspaceDetail } from "../src/features/project-workspace/api/project-workspace-api"
import type {
  ProjectChangeRequest,
  ProjectWorkspace,
} from "../src/features/projects/api/projects-api"

configureRegressionTest()

const workspace: ProjectWorkspaceDetail = {
  id: "workspace-1",
  rowId: "group:workspace-1",
  kind: "group",
  name: "Website launch",
  structure: "SEPARATE",
  status: "IN_PROGRESS",
  client: { id: "client-1", fullName: "Mara Client" },
  updatedAt: "2026-11-09T00:00:00Z",
  activityCount: 0,
  canCreate: false,
  canManage: false,
  canRename: false,
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
  test(`client project requests allow repeat submissions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "test-session"),
    )

    const requests: ProjectChangeRequest[] = [
      {
        id: "request-existing",
        kind: "CHANGE",
        details: "Please revise the first request detail.",
        status: "PENDING",
        responseNote: null,
        createdAt: "2026-11-10T09:00:00.000Z",
        reviewedAt: null,
        requestedBy: { fullName: "Mara Client" },
      },
    ]
    const submitted: { kind: string; details: string }[] = []
    let releaseFirstSubmission!: () => void
    let firstSubmissionReceived!: () => void
    const firstSubmissionGate = new Promise<void>((resolve) => {
      releaseFirstSubmission = resolve
    })
    const firstSubmissionStarted = new Promise<void>((resolve) => {
      firstSubmissionReceived = resolve
    })

    function project(): ProjectWorkspace {
      return {
        id: "client-project-requests-1",
        name: "Client project requests",
        description: "Project description",
        status: "IN_PROGRESS",
        startDate: "2026-11-01T00:00:00.000Z",
        createdAt: "2026-11-01T00:00:00.000Z",
        workspaceManaged: false,
        canManage: false,
        request: {
          id: "booking-1",
          referenceNumber: "REQ-001",
          service: { name: "Design" },
        },
        milestones: [],
        deliverables: [],
        changeRequests: [...requests],
        canReviewChanges: false,
      }
    }

    await page.route("**/api/**", async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === "/api/auth/me")
        return route.fulfill({ json: { user: accountFor("USER") } })
      const projectPath = "/api/projects/client-project-requests-1"
      if (path === projectPath && request.method() === "GET")
        return route.fulfill({ json: project() })
      if (path.startsWith(`${projectPath}/`) && request.method() === "POST") {
        const kind = path.endsWith("cancellation-requests")
          ? "CANCELLATION"
          : "CHANGE"
        const body = request.postDataJSON() as { details: string }
        submitted.push({ kind, details: body.details })
        if (submitted.length === 1) {
          firstSubmissionReceived()
          await firstSubmissionGate
        }
        requests.unshift({
          id: `request-${submitted.length}`,
          kind,
          details: body.details,
          status: "PENDING",
          responseNote: null,
          createdAt: `2026-11-${String(10 + submitted.length).padStart(2, "0")}T09:00:00.000Z`,
          reviewedAt: null,
          requestedBy: { fullName: "Mara Client" },
        })
        return route.fulfill({ json: project() })
      }
      return route.fulfill({
        json: { notifications: [], unreadCount: 0 },
      })
    })

    await page.goto("/projects/client-project-requests-1")
    const requestSection = page
      .getByRole("heading", { name: "Project requests", exact: true })
      .locator("xpath=../..")
    await expect(
      requestSection.getByRole("button", { name: "New request", exact: true }),
    ).toBeEnabled()
    const firstCard = requestSection.getByRole("listitem").first()
    await expect(
      firstCard.getByRole("heading", { name: "Change request" }),
    ).toBeVisible()
    await expect(
      firstCard.getByText("Under review", { exact: true }),
    ).toBeVisible()
    await expect(firstCard.locator("time")).toHaveAttribute(
      "datetime",
      "2026-11-10T09:00:00.000Z",
    )

    await requestSection.getByRole("button", { name: "New request" }).click()
    const firstDialog = page.getByRole("dialog")
    await firstDialog
      .getByRole("textbox")
      .fill("Please revise the second request detail.")
    const firstForm = firstDialog.locator("form")
    await firstForm.evaluate((form) => {
      const event = new Event("submit", { bubbles: true, cancelable: true })
      form.dispatchEvent(event)
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      )
    })
    await firstSubmissionStarted
    await expect.poll(() => submitted.length).toBe(1)
    releaseFirstSubmission()
    await expect(
      requestSection.getByText("Please revise the second request detail.", {
        exact: true,
      }),
    ).toBeVisible()
    expect(submitted).toEqual([
      {
        kind: "CHANGE",
        details: "Please revise the second request detail.",
      },
    ])

    await requestSection.getByRole("button", { name: "New request" }).click()
    const secondDialog = page.getByRole("dialog")
    await secondDialog
      .getByRole("textbox")
      .fill("Please revise the third request detail.")
    await secondDialog
      .getByRole("button", { name: "Send change request" })
      .click()
    await expect(
      requestSection.getByText("Please revise the third request detail.", {
        exact: true,
      }),
    ).toBeVisible()

    await requestSection.getByRole("button", { name: "New request" }).click()
    const cancellationDialog = page.getByRole("dialog")
    await cancellationDialog
      .getByRole("combobox", { name: "Project request type" })
      .click()
    await page.getByRole("option", { name: "Request cancellation" }).click()
    await cancellationDialog
      .getByRole("textbox")
      .fill("Please cancel this project for the stated reason.")
    await cancellationDialog
      .getByRole("button", { name: "Send cancellation request" })
      .click()
    await expect(
      requestSection.getByText(
        "Please cancel this project for the stated reason.",
        {
          exact: true,
        },
      ),
    ).toBeVisible()

    expect(submitted).toEqual([
      {
        kind: "CHANGE",
        details: "Please revise the second request detail.",
      },
      {
        kind: "CHANGE",
        details: "Please revise the third request detail.",
      },
      {
        kind: "CANCELLATION",
        details: "Please cancel this project for the stated reason.",
      },
    ])
    await expect(requestSection.getByRole("listitem")).toHaveCount(4)
    await expect(requestSection.getByRole("listitem").first()).toContainText(
      "Please cancel this project for the stated reason.",
    )
  })

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
                rowId: "group:archive-1",
                name: "Completed branding",
                status: "COMPLETED",
              },
              {
                ...workspace,
                id: "archive-2",
                rowId: "group:archive-2",
                name: "Cancelled campaign",
                status: "CANCELLED",
              },
            ],
            projectCounts: {
              total: 3,
              byStatus: {
                PLANNED: 0,
                IN_PROGRESS: 1,
                ON_HOLD: 0,
                COMPLETED: 1,
                CANCELLED: 1,
              },
            },
            resultsTruncated: false,
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
      main.getByRole("heading", { name: "No projects match those filters" }),
    ).toBeVisible()
    await main.getByRole("button", { name: /Archive/ }).click()
    await expect(
      main.getByRole("searchbox", { name: "Search projects" }),
    ).toHaveValue("missing")
    await main.getByRole("searchbox", { name: "Search projects" }).clear()
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
    ).toHaveAttribute(
      "href",
      "/project-workspace/group%3Aarchive-1?search=branding&view=archive",
    )
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
      await expect(main.getByRole("alert")).toContainText(
        "Project temporarily unavailable",
      )
      if (kind === "project-workspace")
        await expect(
          main.getByRole("alert").getByRole("button", { name: "Try again" }),
        ).toBeVisible()
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
        const tabs = main.getByRole("tablist", {
          name: "Project sections",
        })
        for (const [section, content] of [
          ["Deliverables", "No deliverables yet"],
          ["Team", "No staff assigned yet"],
          ["Activity", "No activity yet"],
          ["Overview", "Project details"],
        ]) {
          const tab = tabs.getByRole("tab", {
            name: section,
            exact: true,
          })
          await tab.click()
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
