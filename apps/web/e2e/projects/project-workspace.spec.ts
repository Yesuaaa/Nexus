import { expect, test, type Locator, type Page } from "@playwright/test"
import type { ProjectManagementDepartmentDetail } from "../../src/features/departments/api/departments-api"
import type { ProjectWorkspace } from "../../src/features/projects/api/projects-api"
import type {
  AdminProjectManagementWorkspaceDetails,
  WorkspaceDirectoryRow,
} from "../../src/features/project-workspace/api/project-workspace-api"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

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
    departmentNames: ["Design"],
    updatedAt: "2026-11-09T00:00:00Z",
    progress: null,
    canManage: true,
  } as const
  const group: WorkspaceDirectoryRow = {
    ...shared,
    departmentNames: ["Design"],
    statuses: ["PLANNED"],
    projectCount: 3,
    progress: { completed: 3, total: 8 },
    rowId: "group:shared-id",
    kind: "group",
    name: "Grouped workspace",
    canRename: true,
  }
  const project: WorkspaceDirectoryRow = {
    ...shared,
    departmentNames: ["Design"],
    statuses: ["PLANNED"],
    rowId: "ungrouped-project:shared-id",
    kind: "ungrouped-project",
    name: "Standalone project",
    canRename: false,
  }
  const writes: string[] = []
  const detailRequests: string[] = []
  let cancelled = false
  page.on("request", (request) => {
    const path = decodeURIComponent(new URL(request.url()).pathname)
    if (
      request.method() === "GET" &&
      path.startsWith("/api/project-workspace/") &&
      !path.endsWith("/directory")
    )
      detailRequests.push(path)
  })
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
  const directoryTable = page.getByRole("table", { name: "Project workspaces" })
  await expect(
    directoryTable.getByRole("columnheader", { name: "Progress", exact: true }),
  ).toBeVisible()
  const groupedProgressCell = directoryTable
    .getByRole("row", { name: /Grouped workspace/ })
    .getByRole("cell")
    .nth(2)
  await expect(groupedProgressCell.getByRole("progressbar")).toHaveCount(0)
  await expect(groupedProgressCell).toContainText("38%")
  await expect(groupedProgressCell).not.toContainText(/3 projects|tasks/i)
  const unplannedProgressCell = directoryTable
    .getByRole("row", { name: /Standalone project/ })
    .getByRole("cell")
    .nth(2)
  await expect(unplannedProgressCell).toContainText("Unplanned")
  await expect(unplannedProgressCell.getByRole("progressbar")).toHaveCount(0)
  await expect(unplannedProgressCell).not.toContainText(/1 project|tasks|%/i)
  for (const target of [group, project]) {
    await page.getByRole("link", { name: target.name, exact: true }).click()
    await expect(page).toHaveURL(
      `/project-workspace/${encodeURIComponent(target.rowId)}`,
    )
    await expect(
      page.getByRole("heading", { name: target.name, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("tablist", { name: "Project sections" }),
    ).toBeVisible()
    const tablist = page.getByRole("tablist", { name: "Project sections" })
    const overviewTab = tablist.getByRole("tab", { name: "Overview" })
    await overviewTab.focus()
    await page.keyboard.press("ArrowRight")
    await expect(tablist.getByRole("tab", { name: "Work" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await page.keyboard.press("ArrowLeft")
    await expect(overviewTab).toHaveAttribute("aria-selected", "true")
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    expect(
      detailRequests.filter((path) => path.endsWith(`/${target.rowId}`)),
    ).toHaveLength(1)
    await page.goBack()
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
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

test("Superadmin Project Management is department-first and opens read-only scoped workspaces", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const departments = [
    {
      id: "dept-1",
      name: "Engineering",
      color: "blue",
      code: "ENG",
      description: "Engineering department",
      headId: "head-1",
      head: {
        id: "head-1",
        email: "head@example.com",
        fullName: "Chris John Albert Bagacina",
        role: "STAFF",
      },
      memberCount: 5,
      teamCount: 1,
      serviceCount: 2,
      projectCount: 7,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "dept-2",
      name: "Graphic Design and Creative Services",
      color: "blue",
      code: "MKT",
      description: null,
      headId: null,
      head: null,
      memberCount: 1,
      teamCount: 0,
      serviceCount: 0,
      projectCount: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]
  await page.route("**/api/departments/project-management-directory", (route) =>
    route.fulfill({ json: { departments } }),
  )
  const headMembership: ProjectManagementDepartmentDetail["members"][number] = {
    id: "head-member",
    userId: "head-1",
    fullName: "Chris John Albert Bagacina",
    position: "Department Head",
    user: {
      id: "head-1",
      fullName: "Chris John Albert Bagacina",
      role: "STAFF",
    },
  }
  const head: NonNullable<ProjectManagementDepartmentDetail["head"]> = {
    id: "head-1",
    fullName: "Chris John Albert Bagacina",
    role: "STAFF",
    position: "Department Head",
  }
  const member = (
    id: string,
    userId: string | null,
    fullName: string,
    position: string,
  ): ProjectManagementDepartmentDetail["members"][number] => ({
    id,
    userId,
    fullName,
    position,
    user: userId ? { id: userId, fullName, role: "STAFF" } : null,
  })
  let departmentDetails: ProjectManagementDepartmentDetail = {
    ...departments[0],
    color: "blue",
    head,
    members: [
      headMembership,
      member("member-1", "member-user-1", "Alex Member", "Designer"),
      member(
        "member-2",
        "member-user-2",
        "Chris John Albert Bagacina",
        "Copywriter",
      ),
      member("member-3", "member-user-3", "Bea Member", "Analyst"),
      member("member-4", null, "Unlinked Member", "Specialist"),
    ],
  }
  await page.route(
    "**/api/departments/project-management-directory/dept-1",
    (route) => route.fulfill({ json: { department: departmentDetails } }),
  )

  const workspaceRow: WorkspaceDirectoryRow = {
    rowId: "group:shared-company-workspace",
    id: "shared-company-workspace",
    kind: "group",
    name: "Shared design and marketing workspace",
    clientName: "Acme Client",
    departmentNames: ["Engineering"],
    statuses: ["IN_PROGRESS"],
    projectCount: 1,
    updatedAt: "2026-11-09T00:00:00Z",
    progress: { completed: 1, total: 2 },
    canManage: false,
    canRename: false,
  }
  const directoryQueries: URLSearchParams[] = []
  await page.route("**/api/project-workspace/directory**", async (route) => {
    const url = new URL(route.request().url())
    directoryQueries.push(url.searchParams)
    await route.fulfill({
      json: {
        rows: [workspaceRow],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
        hasWorkspaces: true,
      },
    })
  })

  await page.goto("/project-management?layout=grid&page=4")
  await expect(page).toHaveURL(/\/project-management$/)
  const table = page.getByRole("table", {
    name: "Project Management departments",
  })
  await expect(
    page.getByRole("heading", { name: "Project Management" }),
  ).toBeVisible()
  await expect(table).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Grid", exact: true }),
  ).toHaveCount(0)
  const departmentColumns = [
    "Department",
    "Department Head",
    "Members",
    "No. of Projects",
    "Actions",
  ]
  for (const [index, column] of departmentColumns.entries()) {
    await expect(table.getByRole("columnheader").nth(index)).toContainText(
      column,
    )
  }
  const departmentRow = table.getByRole("row", { name: /Engineering/ })
  await expect(departmentRow).toContainText("Chris John Albert Bagacina")
  await expect(departmentRow.getByRole("cell").nth(1)).toContainText("5")
  await expect(departmentRow.getByRole("cell").nth(2)).toContainText("7")
  await page
    .getByRole("searchbox", { name: "Search departments" })
    .fill("Engineering")
  const filteredRow = table.getByRole("row", { name: /Engineering/ })
  await expect(filteredRow).toBeVisible()
  await expect(
    table.getByRole("row", { name: /Graphic Design and Creative Services/ }),
  ).toHaveCount(0)

  async function openDepartmentDetails() {
    await filteredRow
      .getByRole("button", { name: "Actions for Engineering" })
      .click()
    await page
      .getByRole("menuitem", { name: "View Department Details" })
      .click()
    const detailsPanel = page.getByRole("dialog")
    await expect(detailsPanel).toBeVisible()
    return detailsPanel
  }

  async function closeDepartmentDetails(detailsPanel: Locator) {
    await detailsPanel
      .getByRole("button", { name: "Close department details" })
      .click()
    await expect(detailsPanel).toHaveCount(0)
  }

  await filteredRow
    .getByRole("button", { name: "Actions for Engineering" })
    .click()
  const actions = page.getByRole("menu")
  await expect(actions.getByRole("menuitem")).toHaveCount(2)
  await expect(
    actions.getByRole("menuitem", { name: "View Workspaces" }),
  ).toBeVisible()
  await expect(
    actions.getByRole("menuitem", { name: "View Department Details" }),
  ).toBeVisible()
  await expect(
    actions.getByRole("menuitem", { name: /Edit|Delete|Add|Remove/ }),
  ).toHaveCount(0)
  await actions
    .getByRole("menuitem", { name: "View Department Details" })
    .click()
  await expect(page).toHaveURL(/\/project-management\?search=Engineering$/)
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Engineering" }),
  ).toBeVisible()
  await expect(panel.getByText("You're viewing", { exact: true })).toHaveCount(
    0,
  )
  await expect(
    panel.getByText("Read-only department details.", { exact: true }),
  ).toHaveCount(0)
  await expect(panel.getByText("ENG", { exact: true })).toBeVisible()
  await expect(panel).toContainText("Engineering department")
  await expect(panel).toContainText("Chris John Albert Bagacina")
  await expect(panel).toContainText("Alex Member")
  await expect(panel).toContainText("Designer")
  const headSection = panel.getByRole("region", { name: "Department Head" })
  const otherMembers = panel.getByRole("region", { name: "Other Members" })
  await expect(
    headSection.getByText("Chris John Albert Bagacina", { exact: true }),
  ).toHaveCount(1)
  await expect(
    headSection.locator(":scope > div.rounded-lg.border"),
  ).toHaveCount(1)
  await expect(
    otherMembers.getByText("4 members", { exact: true }),
  ).toBeVisible()
  await expect(
    otherMembers.getByText("Alex Member", { exact: true }),
  ).toBeVisible()
  await expect(
    otherMembers.getByText("Chris John Albert Bagacina", { exact: true }),
  ).toHaveCount(1)
  await expect(
    otherMembers.getByText("Unlinked Member", { exact: true }),
  ).toBeVisible()
  const departmentSummary = panel.getByRole("region", {
    name: "Department summary",
  })
  expect(
    await departmentSummary.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(2)
  await expect(departmentSummary).toContainText("Members")
  await expect(departmentSummary).toContainText("5")
  await expect(departmentSummary).toContainText("Department membership")
  await expect(departmentSummary).toContainText("Projects")
  await expect(departmentSummary).toContainText("7")
  await expect(departmentSummary).toContainText("All project statuses")
  await expect(panel.getByText("5", { exact: true })).toBeVisible()
  await expect(panel.getByText("7", { exact: true })).toBeVisible()
  await expect(
    panel.getByRole("button", { name: /Edit|Delete|Assign|Remove/ }),
  ).toHaveCount(0)
  await closeDepartmentDetails(panel)

  departmentDetails = {
    ...departmentDetails,
    headId: null,
    head: null,
    memberCount: 1,
    members: [member("unlinked-only", null, "Unlinked Member", "Specialist")],
  }
  const unassignedHeadPanel = await openDepartmentDetails()
  await expect(unassignedHeadPanel).toContainText("Unassigned")
  await expect(
    unassignedHeadPanel
      .getByRole("region", { name: "Other Members" })
      .getByText("1 member", { exact: true }),
  ).toBeVisible()
  await expect(unassignedHeadPanel).toContainText("Unlinked Member")
  await closeDepartmentDetails(unassignedHeadPanel)

  departmentDetails = {
    ...departmentDetails,
    headId: "head-1",
    head,
    memberCount: 2,
    members: [
      member("head-absent-1", "member-user-1", "Alex Member", "Designer"),
      member("head-absent-2", "member-user-3", "Bea Member", "Analyst"),
    ],
  }
  const headNotInMembersPanel = await openDepartmentDetails()
  await expect(
    headNotInMembersPanel
      .getByRole("region", { name: "Other Members" })
      .getByText("2 members", { exact: true }),
  ).toBeVisible()
  await closeDepartmentDetails(headNotInMembersPanel)

  departmentDetails = {
    ...departmentDetails,
    headId: "head-1",
    head,
    memberCount: 1,
    members: [headMembership],
  }
  const headOnlyPanel = await openDepartmentDetails()
  const headOnlyMembers = headOnlyPanel.getByRole("region", {
    name: "Other Members",
  })
  await expect(
    headOnlyMembers.getByText("0 members", { exact: true }),
  ).toBeVisible()
  await expect(headOnlyMembers.getByText("No other members")).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileDepartmentSummary = headOnlyPanel.getByRole("region", {
    name: "Department summary",
  })
  expect(
    await mobileDepartmentSummary.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(1)
  expect(
    await headOnlyPanel.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await closeDepartmentDetails(headOnlyPanel)

  departmentDetails = {
    ...departmentDetails,
    headId: null,
    head: null,
    memberCount: 0,
    projectCount: 0,
    members: [],
  }
  const emptyDepartmentPanel = await openDepartmentDetails()
  const emptyDepartmentSummary = emptyDepartmentPanel.getByRole("region", {
    name: "Department summary",
  })
  await expect(
    emptyDepartmentSummary.getByText("0", { exact: true }),
  ).toHaveCount(2)
  const emptyDepartmentMembers = emptyDepartmentPanel.getByRole("region", {
    name: "Other Members",
  })
  await expect(
    emptyDepartmentMembers.getByText("0 members", { exact: true }),
  ).toBeVisible()
  await expect(
    emptyDepartmentMembers.getByText("No department members"),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(emptyDepartmentPanel).toHaveCount(0)

  await filteredRow
    .getByRole("button", { name: "Actions for Engineering" })
    .click()
  await page.getByRole("menuitem", { name: "View Workspaces" }).click()
  await expect(page).toHaveURL(
    /\/project-management\/departments\/dept-1\/projects$/,
  )
  const projectManagementSidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  })
  await expect(
    projectManagementSidebar.getByRole("button", {
      name: "Project Workspace",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true")
  await expect(
    projectManagementSidebar.getByRole("link", {
      name: "Project Workspace Management",
    }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    page.getByRole("heading", {
      name: "Project Workspaces",
      exact: true,
    }),
  ).toBeVisible()
  const departmentHeader = page
    .getByRole("main", { name: "Department project workspaces" })
    .locator("header")
  const departmentEyebrow = departmentHeader.locator("p").first()
  await expect(departmentEyebrow).toHaveText("Engineering Department")
  await expect(departmentEyebrow).toHaveCSS("text-transform", "uppercase")
  await expect(
    departmentHeader.getByText(
      "Browse and monitor projects managed by this department.",
      { exact: true },
    ),
  ).toBeVisible()
  await expect(
    departmentHeader.getByRole("group", {
      name: "Department project summary",
    }),
  ).toBeVisible()
  const metadataRow = departmentHeader.getByRole("group", {
    name: "Department project summary",
  })
  await expect(metadataRow).toHaveCSS("display", "flex")
  await expect(metadataRow).toHaveCSS("flex-wrap", "wrap")
  await expect(metadataRow.locator("svg")).toHaveCount(3)
  await expect(metadataRow).toContainText("7 total projects")
  await expect(metadataRow).toContainText("5 members")
  await expect(metadataRow).toContainText("Head: Chris John Albert Bagacina")
  await expect(departmentHeader).not.toContainText("—")
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  const workspaces = page.getByRole("table", {
    name: "Department project workspaces",
  })
  await expect(
    workspaces.getByRole("columnheader", { name: "Department" }),
  ).toHaveCount(0)
  await expect(
    workspaces.getByRole("columnheader", { name: "Actions" }),
  ).toBeVisible()
  const scopedWorkspace = workspaces.getByRole("row", {
    name: /Shared design and marketing workspace/,
  })
  await expect(scopedWorkspace.getByRole("link")).toHaveCount(0)
  await expect(
    scopedWorkspace.getByRole("button", {
      name: "More actions for Shared design and marketing workspace",
    }),
  ).toBeVisible()
  const progressCell = scopedWorkspace.getByRole("cell").nth(2)
  await expect(progressCell.getByRole("progressbar")).toHaveCount(1)
  await expect(progressCell).not.toContainText(/%|\d+ tasks/i)
  await expect
    .poll(() =>
      directoryQueries.some((query) => query.get("departmentId") === "dept-1"),
    )
    .toBe(true)
  await expect(
    page.getByRole("link", { name: "Management", exact: true }),
  ).toHaveAttribute("href", "/project-management")

  await page.goBack()
  await expect(page).toHaveURL(/\/project-management\?search=Engineering$/)
  await expect(
    page.getByRole("searchbox", { name: "Search departments" }),
  ).toHaveValue("Engineering")
  await page.goForward()
  await expect(page).toHaveURL(
    /\/project-management\/departments\/dept-1\/projects$/,
  )

  await page.goto("/project-management/departments/dept-2/projects")
  const longNameHeader = page
    .getByRole("main", { name: "Department project workspaces" })
    .locator("header")
  const longNameEyebrow = longNameHeader.locator("p").first()
  await expect(longNameEyebrow).toHaveText(
    "Graphic Design and Creative Services Department",
  )
  await expect(longNameEyebrow).toHaveCSS("text-transform", "uppercase")
  await expect(
    longNameHeader.getByRole("heading", {
      name: "Project Workspaces",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    longNameHeader.getByText(
      "Browse and monitor projects managed by this department.",
      { exact: true },
    ),
  ).toBeVisible()
  const unassignedMetadata = longNameHeader.getByRole("group", {
    name: "Department project summary",
  })
  await expect(unassignedMetadata).toContainText("1 total project")
  await expect(unassignedMetadata).toContainText("1 member")
  await expect(unassignedMetadata).toContainText("Head: Unassigned")
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("Superadmin workspace details stay read-only and reset to the summary view", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/departments/project-management-directory", (route) =>
    route.fulfill({
      json: {
        departments: [
          {
            id: "details-department",
            name: "Design",
            color: "blue",
            code: "DES",
            description: null,
            headId: "head-id",
            head: {
              id: "head-id",
              email: "head@example.com",
              fullName: "Department Head",
              role: "STAFF",
            },
            memberCount: 4,
            teamCount: 1,
            serviceCount: 1,
            projectCount: 2,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    }),
  )
  const projectTitle = "Project One With a Much Longer Name for Header Wrapping"
  const sharedDetails: Omit<
    AdminProjectManagementWorkspaceDetails,
    | "identity"
    | "kind"
    | "id"
    | "name"
    | "structure"
    | "projects"
    | "progress"
    | "unplannedProjectCount"
  > = {
    department: {
      id: "details-department",
      name: "Design",
      head: {
        id: "head-id",
        fullName: "Department Head",
        email: "head@example.com",
        position: "Department Head",
      },
      memberCount: 4,
    },
    clients: [{ id: "client-id", fullName: "Client One" }],
    statuses: ["IN_PROGRESS"],
    projectCount: 1,
    teamMembers: [
      { id: "employee-id", fullName: "Project Assignee", position: "Designer" },
    ],
    activity: Array.from({ length: 6 }, (_, index) => ({
      id: `activity-${index + 1}`,
      projectId: "project-id",
      projectName: projectTitle,
      type: "WORKSPACE_TASK_UPDATED",
      summary: `Updated project activity ${index + 1}.`,
      createdAt: `2026-02-${String(6 - index).padStart(2, "0")}T00:00:00Z`,
      actor: { fullName: "Department Head" },
    })),
  }
  const groupDetails: AdminProjectManagementWorkspaceDetails = {
    ...sharedDetails,
    identity: "group:group-id",
    kind: "group",
    id: "group-id",
    name: "Persisted workspace name",
    structure: "SEPARATE",
    progress: { completed: 1, total: 2 },
    unplannedProjectCount: 0,
    projects: [
      {
        id: "project-id",
        name: projectTitle,
        description: "Project description",
        status: "IN_PROGRESS",
        client: { id: "client-id", fullName: "Client One" },
        department: { id: "details-department", name: "Design" },
        workspace: { id: "group-id", name: "Persisted workspace name" },
        leads: [
          {
            id: "employee-id",
            fullName: "Project Assignee",
            position: "Designer",
          },
        ],
        team: [
          {
            id: "employee-id",
            fullName: "Project Assignee",
            position: "Designer",
            isTeamLead: true,
          },
        ],
        startDate: "2026-01-15T00:00:00Z",
        taskDueDates: ["2026-02-10"],
        tasks: { total: 2, completed: 1, incomplete: 1 },
        progress: { completed: 1, total: 2 },
      },
    ],
  }
  const ungroupedDetails: AdminProjectManagementWorkspaceDetails = {
    ...sharedDetails,
    identity: "ungrouped-project:project-two",
    kind: "ungrouped-project",
    id: "project-two",
    name: "Ungrouped Project",
    structure: null,
    statuses: ["PLANNED"],
    projectCount: 1,
    progress: null,
    unplannedProjectCount: 1,
    projects: [
      {
        ...groupDetails.projects[0]!,
        id: "project-two",
        name: "Ungrouped Project",
        status: "PLANNED",
        workspace: null,
        leads: [],
        team: [],
        progress: null,
        tasks: { total: 0, completed: 0, incomplete: 0 },
        taskDueDates: [],
      },
    ],
    activity: [],
    teamMembers: [],
  }
  const rows: WorkspaceDirectoryRow[] = [
    {
      rowId: groupDetails.identity,
      id: groupDetails.id,
      kind: groupDetails.kind,
      name: groupDetails.name,
      clientName: "Client One",
      departmentNames: ["Design"],
      statuses: groupDetails.statuses,
      projectCount: groupDetails.projectCount,
      updatedAt: "2026-01-15T00:00:00Z",
      progress: groupDetails.progress,
      canManage: false,
      canRename: false,
    },
    {
      rowId: ungroupedDetails.identity,
      id: ungroupedDetails.id,
      kind: ungroupedDetails.kind,
      name: ungroupedDetails.name,
      clientName: "Client One",
      departmentNames: ["Design"],
      statuses: ungroupedDetails.statuses,
      projectCount: ungroupedDetails.projectCount,
      updatedAt: "2026-01-15T00:00:00Z",
      progress: null,
      canManage: false,
      canRename: false,
    },
  ]
  await page.route("**/api/project-workspace/directory**", (route) =>
    route.fulfill({
      json: {
        rows,
        page: 1,
        pageSize: 10,
        total: rows.length,
        totalPages: 1,
        hasWorkspaces: true,
      },
    }),
  )
  const requestedDetails: string[] = []
  await page.route(
    "**/api/project-workspace/admin/departments/details-department/workspaces/**",
    async (route) => {
      requestedDetails.push(new URL(route.request().url()).pathname)
      const identity = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-1) ?? "",
      )
      await route.fulfill({
        json:
          identity === groupDetails.identity ? groupDetails : ungroupedDetails,
      })
    },
  )
  const writes: string[] = []
  page.on("request", (request) => {
    if (
      request.url().includes("/api/project-workspace/admin/") &&
      request.method() !== "GET"
    )
      writes.push(`${request.method()} ${request.url()}`)
  })

  await page.goto("/project-management/departments/details-department/projects")
  const table = page.getByRole("table", {
    name: "Department project workspaces",
  })
  await expect(
    table.getByRole("columnheader", { name: "Actions" }),
  ).toBeVisible()
  const groupRow = table.getByRole("row", {
    name: /Persisted workspace name/,
  })
  await groupRow
    .getByRole("button", { name: "More actions for Persisted workspace name" })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "View details" }),
  ).toBeVisible()
  await expect(page.getByRole("menuitem")).toHaveCount(1)
  await page.getByRole("menuitem", { name: "View details" }).click()

  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("heading", { name: "Persisted workspace name" }),
  ).toBeVisible()
  await expect(
    panel.getByText("Workspace details", { exact: true }),
  ).toHaveCount(0)
  await expect(panel).toContainText("Department Head")
  await expect(panel).toContainText("Project Assignee")
  await expect(panel).toContainText("1 of 2 tasks complete")
  await panel.getByRole("button", { name: projectTitle }).click()
  await expect(panel.getByRole("heading", { name: projectTitle })).toBeVisible()
  await expect(panel.getByText("Project details", { exact: true })).toHaveCount(
    0,
  )
  await expect(panel.getByText("In progress", { exact: true })).toBeVisible()
  await expect(panel).toContainText("Project description")
  await expect(panel).toContainText("Project lead")
  await expect(panel).toContainText("1 completed · 1 incomplete · 2 total")
  await expect(panel.getByText("In progress", { exact: true })).toHaveCount(1)
  await expect(panel.getByText("Status", { exact: true })).toHaveCount(0)
  await expect(
    panel.getByRole("heading", { name: "Project details" }),
  ).toHaveCount(0)
  await expect(panel).not.toContainText("Read-only project details.")
  await expect(
    panel.getByText("Persisted workspace name", { exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole("heading", { name: "Project team" }),
  ).toBeVisible()
  await expect(panel.getByText("Start date", { exact: true })).toBeVisible()
  await expect(panel.getByText("Task due dates", { exact: true })).toBeVisible()
  const activity = panel.getByRole("list", { name: "Project activity" })
  const activityItems = await activity.getByRole("listitem").allTextContents()
  expect(activityItems).toHaveLength(6)
  expect(activityItems.at(0)).toContain("Updated project activity 1.")
  expect(activityItems.at(-1)).toContain("Updated project activity 6.")
  await expect(
    panel.getByRole("button", {
      name: /Edit|Assign|Cancel|Archive|Delete|Save/,
    }),
  ).toHaveCount(0)
  await expect(panel.getByRole("button", { name: "Done" })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel).toBeVisible()
  const projectHeading = panel.getByRole("heading", { name: projectTitle })
  expect(
    await projectHeading.evaluate(
      (element) => getComputedStyle(element).whiteSpace,
    ),
  ).toBe("normal")
  expect(
    await projectHeading.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBeGreaterThan(22)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await panel.getByRole("button", { name: "Back to workspace summary" }).click()
  await expect(
    panel.getByRole("heading", { name: "Persisted workspace name" }),
  ).toBeVisible()
  await panel.getByRole("button", { name: projectTitle }).click()
  await panel
    .getByRole("button", { name: "Close project workspace details" })
    .click()
  await expect(panel).toHaveCount(0)

  const ungroupedRow = table.getByRole("row", { name: /Ungrouped Project/ })
  await ungroupedRow
    .getByRole("button", { name: "More actions for Ungrouped Project" })
    .click()
  await page.getByRole("menuitem", { name: "View details" }).click()
  const ungroupedPanel = page.getByRole("dialog")
  await expect(
    ungroupedPanel.getByRole("heading", { name: "Ungrouped Project" }),
  ).toBeVisible()
  await expect(ungroupedPanel).toContainText("Unplanned")
  await ungroupedPanel
    .getByRole("button", { name: "Ungrouped Project" })
    .click()
  await expect(ungroupedPanel.getByText("No staff assigned yet")).toBeVisible()
  expect(requestedDetails).toContain(
    "/api/project-workspace/admin/departments/details-department/workspaces/group%3Agroup-id",
  )
  expect(requestedDetails).toContain(
    "/api/project-workspace/admin/departments/details-department/workspaces/ungrouped-project%3Aproject-two",
  )
  expect(writes).toEqual([])
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
  const unplannedSummary = page.getByTitle(
    "Projects without work plans aren't counted in overall completion.",
  )
  await expect(unplannedSummary.getByText("Unplanned projects")).toBeVisible()
  await expect(unplannedSummary.getByText("2", { exact: true })).toBeVisible()
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
  const pageErrors: string[] = []
  const effectEventErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /useEffectEvent|Effect Event/i.test(message.text())
    )
      effectEventErrors.push(message.text())
  })
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
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Grid", exact: true }),
  ).toHaveCount(0)

  await expect(
    page.getByRole("link", { name: "Project on page 1" }),
  ).toHaveAttribute("href", "/project-workspace/ungrouped-project%3Aproject-1")
  expect(pageErrors).toEqual([])
  expect(effectEventErrors).toEqual([])
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
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => requests.at(-1)?.get("page")).toBe("2")
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

test("ordinary Staff workspace list retries after a failed request", async ({
  page,
}) => {
  const pageErrors: string[] = []
  const effectEventErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /useEffectEvent|Effect Event/i.test(message.text())
    )
      effectEventErrors.push(message.text())
  })
  await restoreSession(page, "STAFF")
  let failRequests = true
  await page.route("**/api/project-workspace**", (route) => {
    if (failRequests)
      return route.fulfill({
        status: 503,
        json: { error: "Staff workspaces unavailable" },
      })
    return route.fulfill({ json: { workspaces: [], canCreate: false } })
  })
  await page.goto("/project-workspace")
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Staff workspaces unavailable",
  )
  failRequests = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("heading", { name: "No assigned projects yet" }),
  ).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(effectEventErrors).toEqual([])
})

test("ordinary Staff rows retain typed identity and directory state", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  const group = {
    id: "collision-id",
    rowId: "group:collision-id",
    kind: "group" as const,
    name: "Brand campaign workspace",
    structure: "SEPARATE" as const,
    status: "IN_PROGRESS" as const,
    client: { id: "client", fullName: "Client" },
    updatedAt: "2026-11-09T00:00:00Z",
    activityCount: 0,
    canCreate: false,
    canManage: false,
    canRename: false,
    workstreams: [],
  }
  const project = {
    ...group,
    rowId: "ungrouped-project:collision-id",
    kind: "ungrouped-project" as const,
    name: "Brand campaign project",
  }
  const detailRequests: string[] = []
  await page.route("**/api/project-workspace**", (route) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname)
    if (path === "/api/project-workspace")
      return route.fulfill({
        json: {
          workspaces: [group, project],
          canCreate: false,
          projectCounts: {
            total: 2,
            byStatus: {
              PLANNED: 1,
              IN_PROGRESS: 1,
              ON_HOLD: 0,
              COMPLETED: 0,
              CANCELLED: 0,
            },
          },
        },
      })
    const identity = path.slice("/api/project-workspace/".length)
    detailRequests.push(identity)
    const target = identity === group.rowId ? group : project
    return route.fulfill({
      json: {
        ...target,
        activity: [],
      },
    })
  })

  await page.goto(
    "/project-workspace?search=Brand+campaign&status=IN_PROGRESS&sort=most-active",
  )
  await expect(
    page.getByRole("searchbox", { name: "Search projects" }),
  ).toHaveValue("Brand campaign")
  await expect(
    page.getByRole("img", {
      name: /Project status distribution: Planned: 1; In progress: 1/,
    }),
  ).toBeVisible()

  await page.getByRole("link", { name: group.name, exact: true }).click()
  await expect(page).toHaveURL(
    /\/project-workspace\/group%3Acollision-id\?.*search=Brand\+campaign.*status=IN_PROGRESS.*sort=most-active/,
  )
  await expect(page.getByRole("heading", { name: group.name })).toBeVisible()
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Project Workspace" })
    .click()
  await expect(
    page.getByRole("link", { name: project.name, exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: project.name, exact: true }).click()
  await expect(page).toHaveURL(
    /\/project-workspace\/ungrouped-project%3Acollision-id\?.*search=Brand\+campaign.*status=IN_PROGRESS.*sort=most-active/,
  )
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible()
  expect(detailRequests).toEqual([
    "group:collision-id",
    "ungrouped-project:collision-id",
  ])
})

test("directory state survives typed detail and breadcrumb return navigation", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const row: WorkspaceDirectoryRow = {
    rowId: "group:shared-id",
    id: "shared-id",
    kind: "group",
    name: "Completed workspace",
    clientName: "Client Name",
    statuses: ["COMPLETED"],
    projectCount: 1,
    departmentNames: ["Design"],
    updatedAt: "2026-11-09T00:00:00Z",
    progress: { completed: 2, total: 2 },
    canManage: false,
    canRename: false,
  }
  const directoryRequests: URLSearchParams[] = []
  const detailRequests: string[] = []
  await page.route("**/api/project-workspace/**", (route) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname)
    if (path.endsWith("/directory")) {
      directoryRequests.push(url.searchParams)
      const currentPage = Number(url.searchParams.get("page"))
      return route.fulfill({
        json: {
          rows: [row],
          page: currentPage,
          pageSize: 10,
          total: 11,
          totalPages: 2,
          hasWorkspaces: true,
        },
      })
    }
    if (path.endsWith("/group:shared-id")) {
      detailRequests.push(path)
      return route.fulfill({
        json: {
          ...row,
          status: "COMPLETED",
          structure: "SEPARATE",
          client: { id: "client", fullName: "Client Name" },
          activityCount: 0,
          canCreate: true,
          workstreams: [],
          activity: [],
        },
      })
    }
    return route.fallback()
  })

  await page.goto(
    "/project-workspace?search=client-name&status=COMPLETED&sort=client&view=archive&layout=grid&page=2&ignored=value",
  )
  await expect(
    page.getByRole("searchbox", { name: "Search workspaces" }),
  ).toHaveValue("client-name")
  await expect(
    page.getByRole("link", { name: row.name, exact: true }).first(),
  ).toBeVisible()
  await expect
    .poll(() => new URL(page.url()).searchParams.get("ignored"))
    .toBeNull()
  await expect
    .poll(() => new URL(page.url()).searchParams.get("layout"))
    .toBeNull()
  const initialQuery = directoryRequests.at(-1)
  expect(initialQuery?.get("search")).toBe("client-name")
  expect(initialQuery?.get("status")).toBe("COMPLETED")
  expect(initialQuery?.get("sort")).toBe("client")
  expect(initialQuery?.get("view")).toBe("archive")
  expect(initialQuery?.get("page")).toBe("2")
  expect(initialQuery?.get("layout")).toBeNull()

  await page.getByRole("link", { name: row.name, exact: true }).first().click()
  await expect(page).toHaveURL(/\/project-workspace\/group%3Ashared-id\?/)
  await expect(
    page.getByRole("heading", { name: row.name, exact: true }),
  ).toBeVisible()
  expect(detailRequests).toHaveLength(1)
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Project Workspace" })
    .click()
  await expect(page).toHaveURL(/\/project-workspace\?/)
  const returned = new URL(page.url()).searchParams
  expect(returned.get("search")).toBe("client-name")
  expect(returned.get("status")).toBe("COMPLETED")
  expect(returned.get("sort")).toBe("client")
  expect(returned.get("view")).toBe("archive")
  expect(returned.get("layout")).toBeNull()
  expect(returned.get("page")).toBe("2")
  await page.goBack()
  await expect(page).toHaveURL(
    /\/project-workspace\/group%3Ashared-id\?search=client-name&status=COMPLETED&sort=client&view=archive&page=2$/,
  )
  await expect(
    page.getByRole("heading", { name: row.name, exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(
    /\/project-workspace\?search=client-name&status=COMPLETED&sort=client&view=archive&page=2$/,
  )

  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("workspace setup transitions a virtual project into a persisted group", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const common: Omit<
    WorkspaceDirectoryRow,
    "rowId" | "kind" | "name" | "canRename"
  > = {
    id: "project-1",
    clientName: "Client Name",
    statuses: ["PLANNED"],
    projectCount: 1,
    departmentNames: ["Design"],
    updatedAt: "2026-11-09T00:00:00Z",
    progress: null,
    canManage: true,
  }
  const virtualProject: WorkspaceDirectoryRow = {
    ...common,
    rowId: "ungrouped-project:project-1",
    kind: "ungrouped-project",
    name: "Campaign project",
    canRename: false,
  }
  const persistedGroup: WorkspaceDirectoryRow = {
    ...common,
    id: "group-1",
    rowId: "group:group-1",
    kind: "group",
    name: "Campaign project",
    canRename: true,
  }
  const directoryRequests: URLSearchParams[] = []
  const detailRequests: string[] = []
  let created = false
  let createCount = 0
  await page.route("**/api/project-workspace**", (route) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname)
    if (path.endsWith("/directory")) {
      directoryRequests.push(url.searchParams)
      const row = created ? persistedGroup : virtualProject
      return route.fulfill({
        json: {
          rows: [row],
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
          hasWorkspaces: true,
        },
      })
    }
    if (path.endsWith("/approved-bookings"))
      return route.fulfill({
        json: [
          {
            projectId: "project-1",
            requestId: "request-1",
            name: "Campaign project",
            serviceName: "Campaign design",
            referenceNumber: "REQ-1",
            workflowState: "APPROVED",
            conversationId: null,
            client: { id: "client-1", fullName: "Client Name" },
          },
        ],
      })
    if (path.endsWith("/templates"))
      return route.fulfill({
        json: [
          {
            key: "starter",
            name: "Starter plan",
            type: "Basic",
            description: "A simple first plan.",
            recommendedFor: [],
            phases: [
              { title: "Plan", tasks: [{ title: "Scope", role: "Lead" }] },
            ],
          },
        ],
      })
    if (
      path === "/api/project-workspace" &&
      route.request().method() === "POST"
    ) {
      created = true
      createCount += 1
      return route.fulfill({
        status: 201,
        json: { workspaces: [{ id: "group-1", name: "Campaign project" }] },
      })
    }
    if (path.endsWith("/group:group-1")) {
      detailRequests.push(path)
      return route.fulfill({
        json: {
          id: "group:group-1",
          name: "Campaign project",
          status: "PLANNED",
          structure: "SEPARATE",
          client: { id: "client-1", fullName: "Client Name" },
          updatedAt: "2026-11-09T00:00:00Z",
          activityCount: 0,
          canCreate: true,
          canManage: true,
          canRename: true,
          workstreams: [],
          activity: [],
        },
      })
    }
    return route.fallback()
  })

  await page.goto("/project-workspace?search=Campaign&sort=name")
  await expect(
    page.getByRole("link", { name: "Campaign project", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Set up workspace" }).click()
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: /Starter plan/ }).click()
  await page.getByRole("button", { name: "Review" }).click()
  await page.getByRole("button", { name: "Create workspace" }).click()

  await expect(page).toHaveURL(
    /\/project-workspace\/group%3Agroup-1\?search=Campaign&sort=name/,
  )
  await expect(
    page.getByRole("heading", { name: "Campaign project", exact: true }),
  ).toBeVisible()
  expect(createCount).toBe(1)
  expect(detailRequests).toEqual(["/api/project-workspace/group:group-1"])
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Project Workspace" })
    .click()
  await expect(page).toHaveURL(/\/project-workspace\?search=Campaign&sort=name/)
  await expect(
    page.getByRole("link", { name: "Campaign project", exact: true }),
  ).toBeVisible()
  expect(directoryRequests.at(-1)?.get("search")).toBe("Campaign")
  expect(directoryRequests.at(-1)?.get("sort")).toBe("name")
  await expect(
    page.getByRole("button", { name: "More actions for Campaign project" }),
  ).toBeVisible()
  expect(persistedGroup.kind).toBe("group")
  expect(virtualProject.kind).toBe("ungrouped-project")
})

test("supported overview KPIs drill into the matching Management status filter", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  const directoryRequests: URLSearchParams[] = []
  await page.route("**/api/project-workspace/**", (route) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname)
    if (path.endsWith("/overview"))
      return route.fulfill({
        json: {
          totals: {
            totalProjects: 4,
            inProgress: 1,
            completed: 1,
            onHold: 1,
            planned: 1,
            cancelled: 0,
            workspaceGroups: 2,
            projectsWithTasks: 2,
            projectsWithoutTasks: 2,
            totalTasks: 2,
            completedTasks: 1,
            outstandingTasks: 1,
            upcomingTasks: 0,
            overdueTasks: 0,
          },
          statusDistribution: [
            { status: "PLANNED", count: 1 },
            { status: "IN_PROGRESS", count: 1 },
            { status: "ON_HOLD", count: 1 },
            { status: "COMPLETED", count: 1 },
            { status: "CANCELLED", count: 0 },
          ],
          clientDistribution: [],
          workspaceProgress: [],
          upcomingDeadlines: [],
          overdueTaskList: [],
        },
      })
    if (path.endsWith("/directory")) {
      directoryRequests.push(url.searchParams)
      return route.fulfill({
        json: {
          rows: [],
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
          hasWorkspaces: true,
        },
      })
    }
    return route.fallback()
  })

  await page.goto("/project-workspace/overview")
  await expect(
    page.getByRole("heading", { name: "Project Overview" }),
  ).toBeVisible()
  const statusChart = page
    .getByRole("region", { name: "Project status distribution" })
    .getByRole("img", { name: /Project status distribution:/ })
  await expect(statusChart).toBeVisible()
  expect(
    await statusChart.evaluate((element) => (element as HTMLElement).tabIndex),
  ).toBe(-1)

  await page.getByRole("link", { name: /Total projects/i }).click()
  await expect(page).toHaveURL("/project-workspace?view=all")
  await expect.poll(() => directoryRequests.length).toBeGreaterThan(0)
  expect(directoryRequests.at(-1)?.get("view")).toBe("all")
  await page.goBack()

  await page.getByRole("link", { name: /completed/i }).click()
  await expect(page).toHaveURL("/project-workspace?status=COMPLETED&view=all")
  await expect
    .poll(() => directoryRequests.at(-1)?.get("status"))
    .toBe("COMPLETED")
  expect(directoryRequests.at(-1)?.get("view")).toBe("all")
  await page.goBack()

  await page.getByRole("link", { name: /in progress/i }).click()
  await expect(page).toHaveURL(/\/project-workspace\?status=IN_PROGRESS/)
  await expect
    .poll(() => directoryRequests.at(-1)?.get("status"))
    .toBe("IN_PROGRESS")
  expect(directoryRequests.at(-1)?.get("view")).toBe("active")

  await page.goBack()
  await page.getByRole("link", { name: /on hold/i }).click()
  await expect(page).toHaveURL(/\/project-workspace\?status=ON_HOLD/)
  await expect
    .poll(() => directoryRequests.at(-1)?.get("status"))
    .toBe("ON_HOLD")
})

test("Superadmin Overview refreshes after a project cancellation in another tab", async ({
  page,
  context,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let projectCancelled = false
  let overviewRequests = 0
  await page.route("**/api/project-management/overview", (route) => {
    overviewRequests += 1
    const hasProject = !projectCancelled
    return route.fulfill({
      json: {
        totals: {
          totalProjects: hasProject ? 1 : 0,
          planned: 0,
          inProgress: hasProject ? 1 : 0,
          onHold: 0,
          completed: 0,
          cancelled: 0,
          workspaceGroups: 0,
          departmentsWithProjects: hasProject ? 1 : 0,
          projectsWithoutDepartment: 0,
          projectsWithTasks: 0,
          projectsWithoutTasks: hasProject ? 1 : 0,
          totalTasks: 0,
          completedTasks: 0,
          activeProjects: hasProject ? 1 : 0,
          activeProjectsWithoutLead: hasProject ? 1 : 0,
          activeProjectsWithoutTeam: hasProject ? 1 : 0,
          activeAssignments: 0,
        },
        statusDistribution: hasProject
          ? [{ status: "IN_PROGRESS", count: 1 }]
          : [],
        departments: [],
        topStaffAssignments: [],
        recentlyUpdatedProjects: hasProject
          ? [
              {
                id: "project-one",
                identity: "ungrouped-project:project-one",
                name: "Cross-tab project",
                status: "IN_PROGRESS",
                updatedAt: "2026-11-14T00:00:00Z",
                departmentId: "design",
                departmentName: "Design",
              },
            ]
          : [],
      },
    })
  })

  await page.goto("/project-management/overview")
  await expect(
    page.getByRole("heading", { name: "Project Overview" }),
  ).toBeVisible()
  await expect(
    page.getByText("Cross-tab project", { exact: true }),
  ).toBeVisible()
  const overviewRequestsBeforeCancel = overviewRequests

  const departmentHeadPage = await context.newPage()
  await restoreSession(departmentHeadPage, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let directoryRequests = 0
  let cancellationRequests = 0
  await departmentHeadPage.route("**/api/project-workspace/**", (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname)
    if (pathname.endsWith("/directory")) {
      directoryRequests += 1
      const rows: WorkspaceDirectoryRow[] = projectCancelled
        ? []
        : [
            {
              rowId: "ungrouped-project:project-one",
              id: "project-one",
              kind: "ungrouped-project",
              name: "Cross-tab project",
              clientName: "Client One",
              statuses: ["IN_PROGRESS"],
              projectCount: 1,
              departmentNames: ["Design"],
              updatedAt: "2026-11-14T00:00:00Z",
              progress: null,
              canManage: true,
              canRename: false,
            },
          ]
      return route.fulfill({
        json: {
          rows,
          page: 1,
          pageSize: 10,
          total: rows.length,
          totalPages: rows.length ? 1 : 0,
          hasWorkspaces: true,
        },
      })
    }
    if (pathname.endsWith("/cancel")) {
      cancellationRequests += 1
      projectCancelled = true
      return route.fulfill({ json: { saved: true } })
    }
    return route.fallback()
  })

  await departmentHeadPage.goto("/project-workspace")
  await departmentHeadPage
    .getByRole("button", { name: "More actions for Cross-tab project" })
    .click()
  const directoryRequestsBeforeCancel = directoryRequests
  await departmentHeadPage
    .getByRole("menuitem", { name: "Cancel project" })
    .click()
  const overviewRefresh = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/project-management/overview",
  )
  await departmentHeadPage
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel project" })
    .click()
  await overviewRefresh

  await expect(
    departmentHeadPage.getByText("No active workspaces"),
  ).toBeVisible()
  await expect(
    page.getByText("No projects have been updated yet."),
  ).toBeVisible()
  expect(cancellationRequests).toBe(1)
  expect(directoryRequests).toBe(directoryRequestsBeforeCancel + 1)
  expect(overviewRequests).toBe(overviewRequestsBeforeCancel + 1)
  await departmentHeadPage.close()
})

test("workspace detail errors stop loading and can be retried", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let attempts = 0
  let retryAllowed = false
  await page.route("**/api/project-workspace/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    if (path.endsWith("/group:retry-id")) {
      attempts += 1
      if (!retryAllowed)
        return route.fulfill({
          status: 503,
          json: { error: "Workspace unavailable" },
        })
      return route.fulfill({
        json: {
          id: "group:retry-id",
          rowId: "group:retry-id",
          kind: "group",
          name: "Recovered workspace",
          status: "IN_PROGRESS",
          structure: "SEPARATE",
          client: { id: "client", fullName: "Client" },
          updatedAt: "2026-11-09T00:00:00Z",
          activityCount: 0,
          canCreate: true,
          canManage: true,
          canRename: true,
          workstreams: [],
          activity: [],
        },
      })
    }
    return route.fallback()
  })

  await page.goto("/project-workspace/group%3Aretry-id")
  await expect(
    page.locator('[role="alert"]').filter({ hasText: "Workspace unavailable" }),
  ).toBeVisible()
  await expect(page.getByRole("status")).toHaveCount(0)
  const attemptsBeforeRetry = attempts
  retryAllowed = true
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("heading", { name: "Recovered workspace", exact: true }),
  ).toBeVisible()
  expect(attempts).toBe(attemptsBeforeRetry + 1)
})

test("workspace directory errors recover on retry", async ({ page }) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let attempts = 0
  let retryAllowed = false
  await page.route("**/api/project-workspace/directory**", (route) => {
    attempts += 1
    if (!retryAllowed)
      return route.fulfill({
        status: 503,
        json: { error: "Directory unavailable" },
      })
    return route.fulfill({
      json: {
        rows: [
          {
            rowId: "ungrouped-project:retry-project",
            id: "retry-project",
            kind: "ungrouped-project",
            name: "Recovered project",
            clientName: "Client",
            statuses: ["IN_PROGRESS"],
            projectCount: 1,
            departmentNames: ["Design"],
            updatedAt: "2026-11-14T00:00:00Z",
            progress: null,
            canManage: true,
            canRename: false,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
        hasWorkspaces: true,
      },
    })
  })

  await page.goto("/project-workspace?view=all")
  await expect(
    page.locator('[role="alert"]').filter({ hasText: "Directory unavailable" }),
  ).toBeVisible()
  const initialAttempts = attempts
  retryAllowed = true
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("link", { name: "Recovered project", exact: true }),
  ).toBeVisible()
  expect(attempts).toBeGreaterThan(initialAttempts)
})

test("workspace detail refreshes across tabs after staffing and team-lead changes", async ({
  page,
  context,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  let assignedIds = ["employee-1"]
  let teamLeadId: string | null = null
  let failStaffing = false
  const staff = [
    {
      id: "employee-1",
      fullName: "Dani Worker",
      position: "Designer",
      status: "ACTIVE",
      profileSpecialties: ["Design"],
      approvedAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "employee-2",
      fullName: "Alex Designer",
      position: "Designer",
      status: "ACTIVE",
      profileSpecialties: ["Branding"],
      approvedAt: "2026-11-02T00:00:00Z",
    },
  ]
  function workspace() {
    return {
      id: "group:cross-tab-refresh",
      rowId: "group:cross-tab-refresh",
      kind: "group",
      name: "Cross-tab workspace",
      structure: "MULTI_WORKSTREAM",
      status: "IN_PROGRESS",
      client: { id: "client-1", fullName: "Mara Client" },
      updatedAt: "2026-11-14T00:00:00Z",
      activityCount: 0,
      canCreate: true,
      canManage: true,
      canRename: true,
      workstreams: [
        {
          id: "project-1",
          requestId: "request-1",
          name: "Design project",
          description: null,
          serviceName: "Website Design",
          referenceNumber: "REQ-1",
          workflowState: "ACTIVE_PROJECT",
          status: "IN_PROGRESS",
          startDate: null,
          createdAt: "2026-11-01T00:00:00Z",
          updatedAt: "2026-11-14T00:00:00Z",
          templateKey: null,
          taskCount: 0,
          completedTaskCount: 0,
          plan: null,
          milestones: [],
          canUploadDeliverables: false,
          staff: staff
            .filter(({ id }) => assignedIds.includes(id))
            .map((person) => ({
              ...person,
              isTeamLead: person.id === teamLeadId,
            })),
          canAssign: true,
        },
      ],
      activity: [],
    }
  }
  function workflow() {
    return {
      request: {
        id: "request-1",
        referenceNumber: "REQ-1",
        title: "Design project",
        serviceName: "Website Design",
        packageName: null,
        pricingModel: null,
        goals: "",
        requirements: "",
        expectedTimeline: "",
        client: { id: "client-1", fullName: "Mara Client" },
        department: { id: "design", name: "Design" },
      },
      state: "ACTIVE_PROJECT",
      previousState: null,
      version: 1,
      nextAction: "",
      consultationRequired: false,
      quotationApprovalRequired: false,
      permissions: {
        manage: true,
        isClient: false,
        approveQuotation: false,
        verifyPayment: false,
      },
      requirements: [],
      files: [],
      consultations: [],
      quotations: [],
      approval: {
        quotationId: "quote-1",
        amount: "0",
        currency: "PHP",
        approvedById: "head",
        approvedAt: "2026-11-01T00:00:00Z",
      },
      agreement: null,
      payment: null,
      project: {
        id: "project-1",
        name: "Design project",
        status: "IN_PROGRESS",
      },
      events: [],
      internal: {
        staff: staff.map((person) => ({
          ...person,
          skills: person.profileSpecialties,
          activeProjectCount: 0,
          assigned: assignedIds.includes(person.id),
        })),
        approvers: [],
        quotationApproverId: null,
        paymentVerifierId: null,
        events: [],
      },
    }
  }
  async function mockPage(target: Page, requestCounts: { detail: number }) {
    await target.route("**/api/project-workspace/**", (route) => {
      const request = route.request()
      const path = decodeURIComponent(new URL(request.url()).pathname)
      if (
        request.method() === "GET" &&
        path.endsWith("/group:cross-tab-refresh")
      ) {
        requestCounts.detail += 1
        return route.fulfill({ json: workspace() })
      }
      if (path.endsWith("/projects/project-1/team-lead")) {
        teamLeadId = "employee-2"
        return route.fulfill({ json: workspace() })
      }
      return route.fallback()
    })
    await target.route("**/api/request-workflows/request-1**", (route) => {
      const request = route.request()
      if (request.method() === "POST") {
        if (failStaffing)
          return route.fulfill({
            status: 503,
            json: { error: "Staffing unavailable" },
          })
        assignedIds = ["employee-1", "employee-2"]
        return route.fulfill({ json: workflow() })
      }
      return route.fulfill({ json: workflow() })
    })
  }

  const firstCounts = { detail: 0 }
  const secondCounts = { detail: 0 }
  await mockPage(page, firstCounts)
  await page.goto("/project-workspace/group%3Across-tab-refresh")
  await expect(
    page.getByRole("heading", { name: "Cross-tab workspace" }),
  ).toBeVisible()

  const secondPage = await context.newPage()
  await restoreSession(secondPage, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await mockPage(secondPage, secondCounts)
  await secondPage.goto("/project-workspace/group%3Across-tab-refresh")
  await expect(
    secondPage.getByRole("heading", { name: "Cross-tab workspace" }),
  ).toBeVisible()
  const firstBeforeStaffing = firstCounts.detail
  const secondBeforeStaffing = secondCounts.detail

  await page.getByRole("tab", { name: "Team" }).click()
  await page.getByRole("button", { name: "Assign staff" }).click()
  const staffing = page.getByRole("dialog", { name: "Manage project staff" })
  await staffing.getByRole("checkbox", { name: "Alex Designer" }).check()
  await staffing.getByRole("button", { name: "Save staffing" }).click()
  await expect(staffing).toHaveCount(0)
  await expect.poll(() => firstCounts.detail).toBe(firstBeforeStaffing + 1)
  await expect.poll(() => secondCounts.detail).toBe(secondBeforeStaffing + 1)
  await secondPage.getByRole("tab", { name: "Team" }).click()
  await expect(secondPage.getByText("Alex Designer")).toBeVisible()

  const firstBeforeTeamLead = firstCounts.detail
  const secondBeforeTeamLead = secondCounts.detail
  await page.getByRole("button", { name: "View Alex Designer" }).click()
  await page.getByRole("button", { name: "Assign as team lead" }).click()
  await expect.poll(() => secondCounts.detail).toBe(secondBeforeTeamLead + 1)
  await expect.poll(() => firstCounts.detail).toBe(firstBeforeTeamLead)
  await expect(secondPage.getByText("Team lead", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Close team member details" }).click()

  const secondBeforeFailedStaffing = secondCounts.detail
  failStaffing = true
  await page.getByRole("button", { name: "Assign staff" }).click()
  const failedStaffing = page.getByRole("dialog", {
    name: "Manage project staff",
  })
  await failedStaffing
    .getByRole("checkbox", { name: "Alex Designer" })
    .uncheck()
  await failedStaffing.getByRole("button", { name: "Save staffing" }).click()
  await expect(failedStaffing).toContainText("Staffing unavailable")
  expect(secondCounts.detail).toBe(secondBeforeFailedStaffing)
  await secondPage.close()
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

test("client project workspace shows milestones and conversation handoff on mobile", async ({
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
