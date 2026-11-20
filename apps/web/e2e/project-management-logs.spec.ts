import { test, expect } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Uses isolated project-log fixtures")

for (const width of [1440, 390]) {
  test(`Project Management logs are usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await restoreSession(page, "SUPERADMIN")
    await page.route(
      "**/api/departments/project-management-directory",
      (route) => route.fulfill({ json: { departments: [] } }),
    )
    const message = "Changed task status · Prepare artwork"
    let deny = false
    await page.route("**/api/project-management-logs?**", (route) => {
      const query = new URL(route.request().url()).searchParams
      const events =
        query.get("outcome") === "FAILURE"
          ? []
          : [
              {
                id: "log-1",
                actorId: "head",
                actorRole: "STAFF",
                event: "TASK_STATUS_CHANGED",
                action: null,
                source: "planning",
                outcome: "SUCCESS",
                actor: {
                  name: "Design Head",
                  id: "head",
                  role: "STAFF",
                  attribution: "RECORDED",
                },
                target: {
                  id: "task-1",
                  label: "Prepare artwork",
                  type: "Task",
                },
                message,
                changes: [
                  { field: "Status", before: "In progress", after: "Done" },
                ],
                endpoint:
                  "PATCH /api/project-workspace/:id/projects/:projectId/tasks/:taskId",
                subjectId: "task-1",
                projectId: "project-1",
                projectName: "Brand refresh",
                workspaceId: "workspace-1",
                requestId: null,
                correlationId: "project-trace",
                status: null,
                failureCode: null,
                failureReason: null,
                createdAt: new Date().toISOString(),
              },
            ]
      return route.fulfill(
        deny
          ? { status: 403, json: { error: "Project log access denied" } }
          : { json: { events, total: events.length, page: 1, pageSize: 25 } },
      )
    })
    await page.goto("/module")
    const menu = page.locator('#app-sidebar nav[aria-label="Main menu"]')
    await expect(menu.locator('a[href$="/logs"]')).toHaveCount(0)
    await expect(page.locator("#sidebar-system-tool")).toHaveCount(0)
    await page.goto("/project-management")
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const logs = menu
      .getByRole("group", { name: "System Tool", exact: true })
      .getByRole("link", { name: "Project Logs", exact: true })
    await expect(menu.locator('a[href$="/logs"]')).toHaveCount(1)
    await expect(logs).toHaveAttribute(
      "href",
      "/module/project-management/logs",
    )
    await logs.click()
    await expect(page).toHaveURL(/\/module\/project-management\/logs$/)
    await expect(
      page.getByRole("heading", {
        name: "Project Logs",
        exact: true,
      }),
    ).toBeVisible()
    await expect(menu.locator('a[href$="/logs"]')).toHaveCount(1)
    await expect(menu.getByText("System Tool", { exact: true })).toHaveCount(1)
    const openDetails = page.getByRole("button", {
      name: `View log: ${message}`,
    })
    await openDetails.click()
    await expect(
      page.getByRole("heading", { name: "Log details" }),
    ).toBeVisible()
    await expect(page.getByText("Brand refresh", { exact: true })).toBeVisible()
    await expect(page.getByText("In progress → Done")).toBeVisible()
    await expect(page.getByText("project-trace")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.getByRole("button", { name: "Close log details" }).click()
    await page.getByLabel("Filter by outcome").click()
    await page.getByRole("option", { name: "Failed", exact: true }).click()
    await expect(
      page.getByText("No logs match your search and filters."),
    ).toBeVisible()
    await page.getByLabel("Filter by outcome").click()
    await page.getByRole("option", { name: "All outcomes" }).click()
    await expect(openDetails).toBeVisible()
    deny = true
    await page.getByLabel("Search logs").fill("project-trace")
    await expect(
      page.getByRole("alert").filter({ hasText: "Project log access denied" }),
    ).toBeVisible()
    await expect(openDetails).toHaveCount(0)
  })
}
