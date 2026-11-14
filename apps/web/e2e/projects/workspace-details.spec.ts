import { expect, test } from "@playwright/test"
import type {
  ProjectWorkPlan,
  ProjectWorkspaceDetail,
} from "../../src/features/project-workspace/api/project-workspace-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const timestamp = "2026-11-10T08:00:00.000Z"
const workspaceId = "workspace-p15"
const projectId = "project-p15"

function workspace({
  status = "IN_PROGRESS",
  canManage = true,
  canAssign = true,
  includeActivity = false,
  teamLeadId = "employee-riley",
}: {
  status?: ProjectWorkspaceDetail["status"]
  canManage?: boolean
  canAssign?: boolean
  includeActivity?: boolean
  teamLeadId?: string
} = {}): ProjectWorkspaceDetail {
  const tasks = [
    {
      id: "task-p15",
      title: "Prepare launch",
      role: "Project team",
      status: "NOT_STARTED" as const,
      employeeId: null,
      dueDate: null,
    },
  ]
  return {
    id: workspaceId,
    name: "Website launch",
    structure: "SEPARATE",
    status,
    client: { id: "client-p15", fullName: "Casey Client" },
    updatedAt: timestamp,
    activityCount: includeActivity ? 2 : 0,
    canCreate: false,
    canManage,
    activity: includeActivity
      ? [
          {
            id: "event-task-p15",
            type: "WORKSPACE_TASK_UPDATED",
            summary: "Completed the brand audit",
            createdAt: "2026-11-13T10:00:00.000Z",
            actor: { fullName: "Riley Staff" },
            projectName: "Website launch",
          },
          {
            id: "event-staffing-p15",
            type: "STAFFING_APPROVED",
            summary: "Jordan joined the project team",
            createdAt: "2026-11-12T10:00:00.000Z",
            actor: { fullName: "Department Head" },
            projectName: "Website launch",
          },
        ]
      : [],
    workstreams: [
      {
        id: projectId,
        requestId: "request-p15",
        name: "Website launch",
        description: "Build the client website.",
        serviceName: "Website Development",
        referenceNumber: "SR-P15-001",
        workflowState: "ACTIVE_PROJECT",
        status,
        startDate: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        templateKey: "blank-custom",
        taskCount: tasks.length,
        completedTaskCount: 0,
        plan: {
          phases: [{ id: "phase-p15", title: "Planning", tasks }],
        },
        milestones: [],
        staff: [
          {
            id: "employee-riley",
            fullName: "Riley Staff",
            position: "Designer",
            status: "ACTIVE",
            profileSpecialties: ["Brand design"],
            approvedAt: timestamp,
            isTeamLead: teamLeadId === "employee-riley",
          },
          {
            id: "employee-jordan",
            fullName: "Jordan Staff",
            position: "Developer",
            status: "ACTIVE",
            profileSpecialties: ["Web development"],
            approvedAt: timestamp,
            isTeamLead: teamLeadId === "employee-jordan",
          },
        ],
        canUploadDeliverables: true,
        canAssign,
      },
    ],
  }
}

function withSavedPlan(
  current: ProjectWorkspaceDetail,
  plan: ProjectWorkPlan,
  updatedAt: string,
): ProjectWorkspaceDetail {
  return {
    ...current,
    updatedAt,
    workstreams: current.workstreams.map((stream) => ({
      ...stream,
      plan,
      updatedAt,
      taskCount: plan.phases.reduce(
        (count, phase) => count + phase.tasks.length,
        0,
      ),
      completedTaskCount: plan.phases.reduce(
        (count, phase) =>
          count + phase.tasks.filter((task) => task.status === "DONE").length,
        0,
      ),
    })),
  }
}

async function restoreDepartmentHead(
  page: Parameters<typeof restoreSession>[0],
) {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "department-p15", name: "Design" } },
  })
}

test("[P15-001] a failed detail request clears loading while showing its error", async ({
  page,
}) => {
  await restoreDepartmentHead(page)
  await page.route(
    "**/api/project-workspace/missing-workspace",
    async (route) =>
      route.fulfill({
        status: 404,
        json: { error: "Project workspace not found" },
      }),
  )

  await page.goto("/project-workspace/missing-workspace")
  const main = page.getByRole("main")
  await expect(main.getByRole("alert")).toHaveText(
    "Project workspace not found",
  )
  await expect(main.getByRole("status")).toHaveCount(0)
})

test("[P15-002] clients cannot access a workspace detail route or request its data", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  const workspaceReads: string[] = []
  await page.route("**/api/project-workspace/**", async (route) => {
    workspaceReads.push(route.request().url())
    return route.fallback()
  })

  await page.goto(`/project-workspace/${workspaceId}`)
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(workspaceReads).toEqual([])
})

test("[P15-003] the plan editor adds a phase and task through a saved plan", async ({
  page,
}) => {
  await restoreDepartmentHead(page)
  let current = workspace()
  const savedPayload: {
    plan: ProjectWorkPlan
    expectedUpdatedAt: string
  }[] = []

  await page.route(
    `**/api/project-workspace/${workspaceId}**`,
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (
        request.method() === "GET" &&
        path === `/api/project-workspace/${workspaceId}`
      )
        return route.fulfill({ json: current })
      if (
        request.method() === "PUT" &&
        path ===
          `/api/project-workspace/${workspaceId}/projects/${projectId}/plan`
      ) {
        savedPayload.push(
          request.postDataJSON() as {
            plan: ProjectWorkPlan
            expectedUpdatedAt: string
          },
        )
        current = withSavedPlan(
          current,
          savedPayload[0]!.plan,
          "2026-11-11T08:00:00.000Z",
        )
        return route.fulfill({ json: current })
      }
      return route.fallback()
    },
  )

  await page.goto(`/project-workspace/${workspaceId}`)
  await page.getByRole("button", { name: "Work", exact: true }).click()
  await page.getByRole("button", { name: "Edit project plan" }).click()
  await page.getByRole("button", { name: "+ Add phase" }).click()
  await page.getByLabel("Phase 2 name").fill("Quality review")
  const phaseEditor = page
    .locator("main section")
    .filter({ has: page.getByLabel("Phase 2 name") })
    .last()
  await phaseEditor.getByRole("button", { name: "+ Add task" }).click()
  await page.getByLabel("Task name").last().fill("Review the launch")
  await page.getByRole("button", { name: "Save plan" }).click()

  const addedPhase = page
    .locator("details")
    .filter({ hasText: "Quality review" })
  await expect(addedPhase.locator("summary")).toBeVisible()
  await addedPhase.locator("summary").click()
  await expect(
    addedPhase.getByRole("row").filter({ hasText: "Review the launch" }),
  ).toBeVisible()
  expect(savedPayload[0]?.expectedUpdatedAt).toBe(timestamp)
  expect(savedPayload[0]?.plan.phases[1]?.title).toBe("Quality review")
  expect(savedPayload[0]?.plan.phases[1]?.tasks[0]?.title).toBe(
    "Review the launch",
  )
})

test("[P15-004] a department head can assign a task to an approved project member", async ({
  page,
}) => {
  await restoreDepartmentHead(page)
  let current = workspace()
  const savedPlan: ProjectWorkPlan[] = []

  await page.route(
    `**/api/project-workspace/${workspaceId}**`,
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (
        request.method() === "GET" &&
        path === `/api/project-workspace/${workspaceId}`
      )
        return route.fulfill({ json: current })
      if (
        request.method() === "PUT" &&
        path ===
          `/api/project-workspace/${workspaceId}/projects/${projectId}/plan`
      ) {
        const body = request.postDataJSON() as {
          plan: ProjectWorkPlan
          expectedUpdatedAt: string
        }
        savedPlan.push(body.plan)
        current = withSavedPlan(current, body.plan, "2026-11-11T08:00:00.000Z")
        return route.fulfill({ json: current })
      }
      return route.fallback()
    },
  )

  await page.goto(`/project-workspace/${workspaceId}`)
  await page.getByRole("button", { name: "Work", exact: true }).click()
  await page
    .getByRole("button", { name: "More actions for Prepare launch" })
    .click()
  await page.getByRole("menuitem", { name: "Edit task", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Edit task" })
  await dialog.getByRole("combobox", { name: "Assigned staff" }).click()
  await page.getByRole("option", { name: "Jordan Staff", exact: true }).click()
  await dialog.getByLabel("Due date").fill("2026-12-10")
  await dialog.getByRole("button", { name: "Save changes" }).click()

  const row = page.getByRole("row").filter({ hasText: "Prepare launch" })
  await expect(row).toContainText("Jordan Staff")
  expect(savedPlan[0]?.phases[0]?.tasks[0]?.employeeId).toBe("employee-jordan")
  expect(savedPlan[0]?.phases[0]?.tasks[0]?.dueDate).toBe("2026-12-10")
})

test("[P15-005] workspace status actions hold and resume project work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreDepartmentHead(page)
  let current = workspace()
  const actions: string[] = []

  await page.route(
    `**/api/project-workspace/${workspaceId}**`,
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (
        request.method() === "GET" &&
        path === `/api/project-workspace/${workspaceId}`
      )
        return route.fulfill({ json: current })
      if (
        request.method() === "POST" &&
        path === `/api/project-workspace/${workspaceId}/status`
      ) {
        const body = request.postDataJSON() as {
          action: "ON_HOLD" | "RESUME"
        }
        actions.push(body.action)
        const status = body.action === "ON_HOLD" ? "ON_HOLD" : "IN_PROGRESS"
        current = {
          ...current,
          status,
          workstreams: current.workstreams.map((stream) => ({
            ...stream,
            status,
          })),
        }
        return route.fulfill({ json: current })
      }
      return route.fallback()
    },
  )

  await page.goto(`/project-workspace/${workspaceId}`)
  const main = page.getByRole("main")
  const header = main.locator("header")
  await header.getByRole("button", { name: "Manage project status" }).click()
  await page.getByRole("menuitem", { name: "Put on hold" }).click()
  await expect(header.getByText("on hold", { exact: true })).toBeVisible()
  await header.getByRole("button", { name: "Manage project status" }).click()
  await page.getByRole("menuitem", { name: "Resume project" }).click()
  await expect(header.getByText("in progress", { exact: true })).toBeVisible()
  expect(actions).toEqual(["ON_HOLD", "RESUME"])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("[P15-006] team lead replacement is reflected in project team details", async ({
  page,
}) => {
  await restoreDepartmentHead(page)
  let current = workspace()
  let assignedEmployeeId = ""

  await page.route(
    `**/api/project-workspace/${workspaceId}**`,
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (
        request.method() === "GET" &&
        path === `/api/project-workspace/${workspaceId}`
      )
        return route.fulfill({ json: current })
      if (
        request.method() === "PUT" &&
        path ===
          `/api/project-workspace/${workspaceId}/projects/${projectId}/team-lead`
      ) {
        assignedEmployeeId = (request.postDataJSON() as { employeeId: string })
          .employeeId
        current = {
          ...current,
          workstreams: current.workstreams.map((stream) => ({
            ...stream,
            staff: stream.staff?.map((person) => ({
              ...person,
              isTeamLead: person.id === assignedEmployeeId,
            })),
          })),
        }
        return route.fulfill({ json: current })
      }
      return route.fallback()
    },
  )
  await page.route("**/api/request-workflows/request-p15", async (route) =>
    route.fulfill({
      json: {
        state: "ACTIVE_PROJECT",
        permissions: { manage: true },
      },
    }),
  )

  await page.goto(`/project-workspace/${workspaceId}`)
  await page.getByRole("button", { name: "Team", exact: true }).click()
  await page.getByRole("button", { name: "View Jordan Staff" }).click()
  await page.getByRole("button", { name: "Assign as team lead" }).click()

  await expect(
    page.getByRole("row").filter({ hasText: "Jordan Staff" }),
  ).toContainText("Team lead")
  expect(assignedEmployeeId).toBe("employee-jordan")
})

test("[P15-007] activity search and type filters keep workspace events scoped", async ({
  page,
}) => {
  await restoreDepartmentHead(page)
  const current = workspace({ includeActivity: true })
  await page.route(`**/api/project-workspace/${workspaceId}`, async (route) =>
    route.fulfill({ json: current }),
  )

  await page.goto(`/project-workspace/${workspaceId}`)
  await page.getByRole("button", { name: "Activity", exact: true }).click()
  await page
    .getByRole("searchbox", { name: "Search activity" })
    .fill("brand audit")
  await expect(page.getByText("Completed the brand audit")).toBeVisible()
  await expect(page.getByText("Jordan joined the project team")).toHaveCount(0)

  await page.getByRole("searchbox", { name: "Search activity" }).fill("")
  await page.getByRole("combobox", { name: "Activity type" }).click()
  await page.getByRole("option", { name: "Staffing", exact: true }).click()
  await expect(page.getByText("Jordan joined the project team")).toBeVisible()
  await expect(page.getByText("Completed the brand audit")).toHaveCount(0)
})
