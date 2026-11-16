import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type { AdministrativeProject } from "../src/features/projects/api/administrative-projects-api"
import type { AdminProjectManagementWorkspaceDetails } from "../src/features/project-workspace/api/project-workspace-api"

configureRegressionTest()
test.skip(live, "Administrative inspection tests use isolated API fixtures")

const project: AdministrativeProject = {
  id: "project-1",
  kind: "ungrouped-project",
  rowId: "ungrouped-project:project-1",
  name: "Organization project",
  structure: "SEPARATE",
  status: "IN_PROGRESS",
  client: { id: "client", fullName: "Client" },
  updatedAt: "2026-11-14T00:00:00Z",
  department: { id: "design", name: "Design" },
  workspaceGroup: null,
  activityCount: 0,
  activity: [],
  canCreate: false,
  canManage: false,
  canRename: false,
  capabilities: {
    read: true,
    manage: false,
    approve: false,
    release: false,
    participate: false,
    downloadFiles: false,
  },
  workstreams: [
    {
      id: "project-1",
      name: "Organization project",
      description: "Project description",
      serviceName: "Design service",
      referenceNumber: "SR-1",
      requestId: "request-1",
      workflowState: null,
      status: "IN_PROGRESS",
      startDate: null,
      createdAt: "2026-11-14T00:00:00Z",
      updatedAt: "2026-11-14T00:00:00Z",
      templateKey: null,
      taskCount: 1,
      completedTaskCount: 0,
      canAssign: false,
      canUploadDeliverables: false,
      plan: {
        phases: [
          {
            id: "phase",
            title: "Delivery",
            tasks: [
              {
                id: "task",
                title: "Read-only task",
                role: "Designer",
                status: "NOT_STARTED",
                employeeId: "employee",
              },
            ],
          },
        ],
      },
      staff: [
        {
          id: "employee",
          fullName: "Assigned Designer",
          position: "Designer",
          status: "ACTIVE",
          profileSpecialties: [],
          approvedAt: "2026-11-14T00:00:00Z",
          isTeamLead: true,
        },
      ],
      milestones: [],
    },
  ],
}

test("administrative project list and details expose inspection without operational controls", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const writes: string[] = []
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      request.method() !== "GET"
    )
      writes.push(request.url())
  })
  await page.route("**/api/administrative-projects**", (route) => {
    const url = new URL(route.request().url())
    return route.fulfill({
      json: url.pathname.endsWith("/project-1")
        ? { project }
        : {
            projects: [project],
            departments: [{ id: "design", name: "Design" }],
            total: 1,
            page: 1,
            pageSize: 10,
          },
    })
  })
  await page.goto("/module/project-management")
  await expect(
    page.getByRole("table", { name: "Project workspaces" }),
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Organization project", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Organization project", exact: true }),
  ).toBeVisible()
  await page
    .locator("#app-sidebar")
    .getByRole("link", { name: "Work", exact: true })
    .click()
  await expect(page.getByText("Read-only task", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Assigned Designer", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /edit|approve|release|upload|cancel|assign/i,
    }),
  ).toHaveCount(0)
  await page.reload()
  await expect(page.getByText("Read-only task", { exact: true })).toBeVisible()
  expect(writes).toEqual([])
})

test("a denied project read clears the administrative content", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/administrative-projects/**", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Organization-wide project read access is required" },
    }),
  )
  await page.goto("/module/project-management?project=project-1")
  await expect(
    page
      .getByRole("alert")
      .getByText("Organization-wide project read access is required"),
  ).toBeVisible()
  await expect(page.getByText("Read-only task", { exact: true })).toHaveCount(0)
})

test("Superadmin project sections share navigation and remain read-only", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const writes: string[] = []
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      request.method() !== "GET"
    )
      writes.push(request.url())
  })
  const detailedProject: AdministrativeProject = {
    ...project,
    workstreams: [
      {
        ...project.workstreams[0]!,
        milestones: [
          {
            id: "milestone-1",
            title: "Project wireframes",
            description: "Initial design set",
            expectedFileType: "PDF",
            deliveryStatus: "IN_REVIEW",
            rejectionReason: null,
            reviewedAt: null,
            workflowFileId: null,
            updatedAt: "2026-11-14T00:00:00Z",
            completedAt: null,
            sentToClientAt: null,
            workflowFile: null,
          },
        ],
      },
    ],
  }
  const departmentDetails: AdminProjectManagementWorkspaceDetails = {
    identity: "ungrouped-project:project-1",
    kind: "ungrouped-project",
    id: "project-1",
    name: project.name,
    structure: null,
    department: {
      id: "design",
      name: "Design",
      head: {
        id: "head-1",
        fullName: "Department Head",
        email: "head@example.com",
        position: "Department Head",
      },
      memberCount: 2,
    },
    clients: [project.client],
    statuses: ["IN_PROGRESS"],
    projectCount: 1,
    unplannedProjectCount: 0,
    progress: { completed: 0, total: 1 },
    teamMembers: [
      { id: "employee", fullName: "Assigned Designer", position: "Designer" },
    ],
    projects: [
      {
        id: "project-1",
        name: project.name,
        description: "Project description",
        status: "IN_PROGRESS",
        client: project.client,
        department: { id: "design", name: "Design" },
        workspace: null,
        leads: [
          {
            id: "employee",
            fullName: "Assigned Designer",
            position: "Designer",
          },
        ],
        team: [
          {
            id: "employee",
            fullName: "Assigned Designer",
            position: "Designer",
            isTeamLead: true,
          },
        ],
        startDate: null,
        taskDueDates: [],
        tasks: { total: 1, completed: 0, incomplete: 1 },
        progress: { completed: 0, total: 1 },
      },
    ],
    activity: [
      {
        id: "activity-1",
        projectId: "project-1",
        projectName: project.name,
        type: "WORKSPACE_TASK_UPDATED",
        summary: "Project task updated.",
        createdAt: "2026-11-14T10:00:00Z",
        actor: { fullName: "Assigned Designer" },
      },
    ],
  }
  await page.route("**/api/administrative-projects**", (route) => {
    const url = new URL(route.request().url())
    return route.fulfill({
      json: url.pathname.endsWith("/project-1")
        ? { project: detailedProject }
        : {
            projects: [detailedProject],
            departments: [{ id: "design", name: "Design" }],
            total: 1,
            page: 1,
            pageSize: 10,
          },
    })
  })
  await page.route("**/api/project-workspace/admin/departments/**", (route) =>
    route.fulfill({ json: departmentDetails }),
  )

  await page.goto("/module/project-management?project=project-1&tab=work")
  const sidebar = page.locator("#app-sidebar")
  await expect(
    sidebar.getByRole("link", { name: "Work", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByText("Read-only task", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /edit|approve|release|upload|cancel|assign/i,
    }),
  ).toHaveCount(0)

  await sidebar.getByRole("link", { name: "Deliverables", exact: true }).click()
  await expect(page).toHaveURL(/tab=deliverables/)
  await expect(
    page.getByText("Project wireframes", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "View details for Project wireframes" })
    .click()
  await expect(
    page.getByText(/Submission versions and approval history are not included/),
  ).toBeVisible()
  await page.getByRole("button", { name: "Close deliverable details" }).click()

  await sidebar.getByRole("link", { name: "Notes", exact: true }).click()
  await expect(page.getByText(/Project notes aren't available/)).toBeVisible()
  await sidebar.getByRole("link", { name: "Requests", exact: true }).click()
  await expect(
    page.getByText(/Client project requests aren't available/),
  ).toBeVisible()
  await sidebar.getByRole("link", { name: "Team", exact: true }).click()
  await expect(
    page.getByText("Assigned Designer", { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Project team" })
      .getByText("Department Head", { exact: true })
      .first(),
  ).toBeVisible()
  await sidebar.getByRole("link", { name: "Activity", exact: true }).click()
  await expect(
    page.getByText("Project task updated.", { exact: true }),
  ).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/tab=team/)
  await page.goForward()
  await expect(page).toHaveURL(/tab=activity/)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(sidebar).toHaveAttribute("data-drawer-open", "true")
  await expect(
    sidebar.getByRole("link", { name: "Back to projects" }),
  ).toBeVisible()
  await sidebar.getByRole("link", { name: "Back to projects" }).click()
  await expect(page).toHaveURL("/module/project-management")
  expect(writes).toEqual([])
})

test("only backend-authorized workspace renaming is offered and failed writes retain input", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const managed = {
    ...project,
    capabilities: { ...project.capabilities, rename: true },
  }
  let attempts = 0
  await page.route("**/api/administrative-projects/**", async (route) => {
    if (route.request().method() === "PATCH") {
      attempts++
      expect(new URL(route.request().url()).pathname).toBe(
        "/api/administrative-projects/project-1/workspace-name",
      )
      const payload = route.request().postDataJSON() as { name: string }
      if (attempts === 1)
        return route.fulfill({
          status: 409,
          json: { error: "Archived projects cannot be renamed" },
        })
      managed.name = payload.name
      return route.fulfill({ json: { saved: true } })
    }
    return route.fulfill({ json: { project: managed } })
  })
  await page.goto("/module/project-management?project=project-1")
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("New workspace name")
  await page
    .getByRole("button", { name: "Rename workspace", exact: true })
    .click()
  await expect(
    page.getByRole("alert").getByText("Archived projects cannot be renamed"),
  ).toBeVisible()
  await expect(page.getByLabel("Workspace name", { exact: true })).toHaveValue(
    "New workspace name",
  )
  await page
    .getByRole("button", { name: "Rename workspace", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "New workspace name", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /approve|release|upload|cancel|assign/i }),
  ).toHaveCount(0)
  expect(attempts).toBe(2)
})
