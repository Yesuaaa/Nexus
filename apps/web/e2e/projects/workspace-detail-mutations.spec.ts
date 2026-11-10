import { expect, test } from "@playwright/test"
import type {
  ProjectWorkspaceDetail,
  ProjectWorkPlan,
} from "../../src/features/project-workspace/api/project-workspace-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("[NEX-008] plan and task edits reflect saved reads and preserve data after a failed write", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "dept-1", name: "Engineering" } },
  })

  let workspace: ProjectWorkspaceDetail = {
    id: "workspace-nex008",
    name: "Website launch",
    structure: "SEPARATE",
    status: "IN_PROGRESS",
    client: { id: "client-1", fullName: "Casey Client" },
    updatedAt: "2026-11-10T08:00:00.000Z",
    activityCount: 0,
    canCreate: false,
    canManage: true,
    activity: [],
    workstreams: [
      {
        id: "project-nex008",
        requestId: "request-nex008",
        name: "Website launch",
        description: "Build the client website.",
        serviceName: "Website Development",
        referenceNumber: "SR-WEB-008",
        workflowState: "ACTIVE_PROJECT",
        status: "IN_PROGRESS",
        startDate: "2026-11-10T08:00:00.000Z",
        createdAt: "2026-11-10T08:00:00.000Z",
        updatedAt: "2026-11-10T08:00:00.000Z",
        templateKey: null,
        taskCount: 1,
        completedTaskCount: 0,
        plan: {
          phases: [
            {
              id: "phase-nex008",
              title: "Planning",
              tasks: [
                {
                  id: "task-nex008",
                  title: "Prepare launch",
                  role: "Project team",
                  status: "NOT_STARTED",
                  employeeId: null,
                  dueDate: null,
                },
              ],
            },
          ],
        },
        milestones: [],
        canUploadDeliverables: false,
        canAssign: false,
      },
    ],
  }
  let failNextWrite = true
  const writes: ProjectWorkPlan[] = []

  await page.route("**/api/project-workspace**", async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (
      pathname === `/api/project-workspace/${workspace.id}` &&
      request.method() === "GET"
    )
      return route.fulfill({ json: workspace })

    if (
      pathname ===
        `/api/project-workspace/${workspace.id}/projects/project-nex008/plan` &&
      request.method() === "PUT"
    ) {
      const input = request.postDataJSON() as { plan: ProjectWorkPlan }
      writes.push(input.plan)
      if (failNextWrite) {
        failNextWrite = false
        return route.fulfill({
          status: 503,
          json: { error: "Plan save temporarily unavailable." },
        })
      }
      const updatedAt = `2026-11-10T08:00:0${writes.length}.000Z`
      workspace = {
        ...workspace,
        updatedAt,
        workstreams: workspace.workstreams.map((stream) =>
          stream.id === "project-nex008"
            ? { ...stream, plan: input.plan, updatedAt }
            : stream,
        ),
      }
      return route.fulfill({ json: workspace })
    }

    return route.fallback()
  })

  await page.goto(`/project-workspace/${workspace.id}`)
  await page.getByRole("button", { name: "Work", exact: true }).click()
  await page.getByRole("button", { name: "Edit project plan" }).click()
  await page.getByLabel("Phase 1 name").fill("Discovery and design")
  await page.getByRole("button", { name: "Save plan" }).click()
  await expect(
    page.getByText("Plan save temporarily unavailable.", { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel("Phase 1 name")).toHaveValue(
    "Discovery and design",
  )
  await page.getByRole("button", { name: "Discard changes" }).click()
  await expect(page.getByText("Planning", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Discovery and design", { exact: true }),
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Edit project plan" }).click()
  await page.getByLabel("Phase 1 name").fill("Discovery and design")
  await page.getByRole("button", { name: "Save plan" }).click()
  await expect(
    page.getByText("Discovery and design", { exact: true }),
  ).toBeVisible()
  expect(writes).toHaveLength(2)

  await page.getByRole("button", { name: "Edit Prepare launch" }).click()
  const taskDialog = page.getByRole("dialog", { name: "Edit task" })
  const taskName = taskDialog.getByLabel("Task name")
  await taskName.fill("")
  await taskDialog.getByRole("button", { name: "Save changes" }).click()
  expect(
    await taskName.evaluate(
      (element) => (element as HTMLInputElement).validity.valueMissing,
    ),
  ).toBe(true)
  expect(writes).toHaveLength(2)
  await taskName.fill("Prepare launch")
  await taskDialog.getByRole("combobox", { name: "Task status" }).click()
  await page.getByRole("option", { name: "Complete", exact: true }).click()
  await taskDialog.getByRole("button", { name: "Save changes" }).click()
  const taskRow = page.getByRole("row").filter({ hasText: "Prepare launch" })
  await expect(taskRow).toContainText("Complete")
  expect(writes).toHaveLength(3)
  expect(writes[2]?.phases[0]?.tasks[0]?.status).toBe("DONE")

  await page.reload()
  await page.getByRole("button", { name: "Work", exact: true }).click()
  await expect(
    page.getByText("Discovery and design", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: "Prepare launch" }),
  ).toContainText("Complete")
})
