import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()
const fixture = {
  id: "workspace-1",
  rowId: "group:workspace-1",
  kind: "group",
  name: "Brand launch",
  structure: "SEPARATE",
  status: "IN_PROGRESS",
  client: { id: "client", fullName: "Demo Client" },
  updatedAt: "2026-11-20T00:00:00Z",
  activityCount: 1,
  canCreate: true,
  canManage: true,
  canRename: true,
  workstreams: [
    {
      id: "project-1",
      requestId: null,
      name: "Brand launch",
      description: "A real project scope",
      serviceName: "Design",
      referenceNumber: null,
      workflowState: null,
      status: "IN_PROGRESS",
      startDate: "2026-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-11-20T00:00:00Z",
      templateKey: null,
      taskCount: 3,
      completedTaskCount: 1,
      canUploadDeliverables: false,
      canAssign: false,
      plan: {
        phases: [
          {
            id: "phase-1",
            title: "Discovery",
            tasks: [
              {
                id: "task-1",
                title: "Research",
                role: "Designer",
                status: "DONE",
              },
              {
                id: "task-2",
                title: "Prepare assets",
                role: "Designer",
                status: "IN_PROGRESS",
                employeeId: "staff-1",
                dueDate: "2099-11-20",
              },
            ],
          },
          { id: "phase-2", title: "Unplanned", tasks: [] },
          {
            id: "phase-3",
            title: "Complete",
            tasks: [
              {
                id: "task-3",
                title: "Finished",
                role: "Designer",
                status: "DONE",
              },
            ],
          },
        ],
      },
      milestones: [
        { id: "m-1", title: "Design", deliveryStatus: "SENT_TO_CLIENT" },
        { id: "m-2", title: "Report", deliveryStatus: "NOT_SUBMITTED" },
      ],
      staff: [
        {
          id: "staff-1",
          fullName: "Alex Morgan",
          position: "Designer",
          status: "ACTIVE",
          profileSpecialties: [],
          approvedAt: "2026-01-01T00:00:00Z",
          isTeamLead: true,
        },
      ],
    },
  ],
  activity: [
    {
      id: "event-1",
      type: "TASK_UPDATED",
      summary: "Updated the project task.",
      createdAt: "2026-11-20T10:00:00Z",
      actor: { fullName: "Alex Morgan" },
      projectName: "Brand launch",
    },
  ],
  kanbanColumns: [],
  kanbanAssignments: [],
}

test("overview shows authorized project progress and navigates to work", async ({
  page,
}, testInfo) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await page.route("**/api/project-workspace/**", (route) =>
    route.fulfill({ json: fixture }),
  )
  await page.goto("/project-workspace/group%3Aworkspace-1")
  const summary = page.getByRole("region", { name: "Project summary" })
  await expect(summary).toContainText("67%")
  await expect(summary).toContainText("2 of 3 tasks complete")
  await expect(summary).toContainText("1 / 3")
  await expect(summary).toContainText("1 / 2")
  await expect(
    page.getByRole("region", { name: "Phase progress" }),
  ).toContainText("No tasks")
  await expect(
    page.getByRole("region", { name: "Upcoming tasks" }),
  ).toContainText("Prepare assets")
  await expect(
    page.getByRole("region", { name: "Project details" }),
  ).toContainText("A real project scope")
  await expect(
    page.getByRole("region", { name: "Recent activity" }),
  ).toContainText("Updated the project task.")
  await page.screenshot({
    path: testInfo.outputPath("overview-desktop.png"),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath("overview-mobile.png"),
    fullPage: true,
  })
  await page.getByRole("link", { name: "View work" }).first().click()
  await expect(
    page.getByRole("link", { name: "Work", exact: true }),
  ).toHaveAttribute("aria-current", "page")
})

test("empty optional sections remain honest", async ({ page }) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await page.route("**/api/project-workspace/**", (route) =>
    route.fulfill({ json: { ...fixture, workstreams: [], activity: [] } }),
  )
  await page.goto("/project-workspace/group%3Aworkspace-1")
  await expect(
    page.getByText("No project phases have been planned yet."),
  ).toBeVisible()
  await expect(
    page.getByText("No upcoming incomplete tasks with due dates."),
  ).toBeVisible()
  await expect(page.getByText("No staff assigned yet.")).toBeVisible()
  await expect(page.getByText("No project activity yet.")).toBeVisible()
})

test("denied workspace data stays hidden and a failed request can retry", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let denied = true
  await page.route("**/api/project-workspace/**", (route) =>
    route.fulfill(
      denied
        ? { status: 403, json: { error: "Workspace access denied" } }
        : { json: fixture },
    ),
  )
  await page.goto("/project-workspace/group%3Aworkspace-1")
  await expect(page.getByText("Workspace access denied")).toBeVisible()
  await expect(page.getByText("A real project scope")).toHaveCount(0)
  denied = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("A real project scope")).toBeVisible()
})
