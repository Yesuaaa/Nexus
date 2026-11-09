import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "../regression-support"
import type { ProjectWorkspaceDetail } from "../../src/features/project-workspace/api/project-workspace-api"

configureRegressionTest()

const timestamp = "2026-01-01T00:00:00Z"
function fixture(name: string, id: string) {
  return {
    id,
    fullName: name,
    employeeId: `EMP-${id}`,
    email: `${id}@example.com`,
    contactNumber: "09123456789",
    position: "Designer",
    employmentType: "FULL_TIME",
    status: "SUBMITTED",
    isActive: true,
    startDate: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    department: null,
    departmentId: null,
    team: null,
    teamId: null,
    hasAccount: true,
    accountIsActive: true,
    title: name,
    referenceNumber: `SR-${id}`,
    service: { id: `service-${id}`, name },
    packageName: "Standard",
    package: null,
    expectedTimeline: "Six weeks",
    preferredSpecialistName: null,
    client: { fullName: name, email: `${id}@example.com`, contactNumber: null },
  }
}

function workspaceFixture(name: string, id: string): ProjectWorkspaceDetail {
  return {
    id,
    name,
    structure: "SEPARATE",
    status: "IN_PROGRESS",
    client: { id: "client", fullName: "Test Client" },
    updatedAt: timestamp,
    activityCount: 0,
    canCreate: false,
    canManage: false,
    activity: [],
    workstreams: [
      {
        id: `stream-${id}`,
        requestId: null,
        name: "Website",
        description: null,
        serviceName: "Website",
        referenceNumber: "SR-1",
        workflowState: "ACTIVE_PROJECT",
        status: "IN_PROGRESS",
        startDate: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        templateKey: null,
        taskCount: 2,
        completedTaskCount: 0,
        canAssign: false,
        canUploadDeliverables: false,
        staff: ["Alpha", "Beta"].map((person) => ({
          id: person,
          fullName: `${person} Staff`,
          position: "Designer",
          status: "ACTIVE",
          profileSpecialties: [],
          approvedAt: timestamp,
        })),
        plan: {
          phases: [
            {
              id: "phase",
              title: "Design",
              tasks: ["Alpha", "Beta"].map((task) => ({
                id: task,
                title: `${task} Task`,
                role: "Designer",
                status: "NOT_STARTED",
              })),
            },
          ],
        },
        milestones: ["Alpha", "Beta"].map((title) => ({
          id: title,
          title: `${title} Deliverable`,
          description: null,
          expectedFileType: null,
          deliveryStatus: "NOT_SUBMITTED",
          rejectionReason: null,
          reviewedAt: null,
          sentToClientAt: null,
          workflowFileId: null,
          updatedAt: timestamp,
          completedAt: null,
          workflowFile: null,
        })),
      },
    ],
  }
}

for (const width of [1440, 390]) {
  test(`workspace, team, task and deliverable tables use shared row transitions at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.skip(live, "Uses isolated workspaces")
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await restoreSession(page, "STAFF")
    const alpha = workspaceFixture("Alpha Project", "alpha")
    const beta = workspaceFixture("Beta Project", "beta")
    await page.route("**/api/project-workspace?**", (route) =>
      route.fulfill({ json: { workspaces: [alpha, beta], canCreate: false } }),
    )
    await page.route("**/api/project-workspace/alpha", (route) =>
      route.fulfill({ json: alpha }),
    )
    await page.goto("/dashboard")
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    const submenuToggle = page.getByRole("button", {
      name: "Toggle project workspace submenu",
    })
    await expect(submenuToggle).toHaveAttribute("aria-expanded", "true")
    await submenuToggle.click()
    await expect(submenuToggle).toHaveAttribute("aria-expanded", "false")
    await expect(page).toHaveURL(/\/dashboard$/)
    await page
      .getByRole("link", { name: "Project Workspace", exact: true })
      .click()
    await expect(page).toHaveURL(/\/project-workspace$/)
    await expect(
      page.getByRole("region", { name: "Project list" }).getByRole("table"),
    ).toBeVisible()
    if (width < 768)
      await expect(page.getByLabel("Primary navigation")).toHaveAttribute(
        "data-drawer-open",
        "false",
      )
    const rows = page.locator(
      '[data-animated-slot-row][aria-hidden="false"]:visible',
    )
    await expect(rows).toHaveCount(2)
    await page
      .getByRole("button", { name: "Filter by project status:" })
      .click()
    await page
      .getByRole("menuitemradio", { name: "Planned", exact: true })
      .click()
    await expect(rows).toHaveCount(0)
    await page
      .getByRole("button", { name: "Filter by project status:" })
      .click()
    await page
      .getByRole("menuitemradio", { name: "In progress", exact: true })
      .click()
    await expect(rows).toHaveCount(2)
    await page.getByRole("button", { name: "Archive", exact: true }).click()
    await expect(rows).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Filter by project status:" }),
    ).toContainText("All archived")
    await page
      .getByRole("button", { name: "Back to Projects", exact: true })
      .click()
    await expect(rows).toHaveCount(2)
    await page.getByRole("button", { name: "Sort projects:" }).click()
    await page
      .getByRole("menuitemradio", { name: "Most activity", exact: true })
      .click()
    await expect(rows).toHaveCount(2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const search = page.getByRole("searchbox")
    await search.fill("Beta")
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText("Beta Project")
    await search.fill("missing")
    await expect(rows).toHaveCount(0)
    await search.fill("")
    await expect(rows).toHaveCount(2)
    await page
      .getByRole("region", { name: "Project list" })
      .getByRole("link", { name: "Alpha Project", exact: true })
      .click()
    await page.getByRole("button", { name: "Work", exact: true }).click()
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText("Alpha Task")
    await page.getByRole("button", { name: "Team", exact: true }).click()
    await expect(rows).toHaveCount(2)
    const staffSearch = page.getByRole("searchbox", {
      name: "Search assigned staff",
    })
    await staffSearch.fill("Beta")
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText("Beta Staff")
    await staffSearch.fill("missing")
    await expect(rows).toHaveCount(0)
    await staffSearch.fill("")
    await expect(rows).toHaveCount(2)
    await page
      .getByRole("button", { name: "Deliverables", exact: true })
      .click()
    const deliverableSearch = page.getByRole("searchbox", {
      name: "Search deliverables",
    })
    await expect(rows).toHaveCount(2)
    await deliverableSearch.fill("Beta")
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText("Beta Deliverable")
    await deliverableSearch.fill("missing")
    await expect(rows).toHaveCount(0)
    await deliverableSearch.fill("")
    await expect(rows).toHaveCount(2)
    await rows.first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath("workspace-tables.png") })
  })
}

for (const width of [1440, 390]) {
  for (const directory of [
    {
      path: "/clients",
      endpoint: "/api/clients",
      key: "clients",
      role: "ADMIN",
      search: "Search clients",
    },
    {
      path: "/employees",
      endpoint: "/api/employees",
      key: "employees",
      role: "ADMIN",
      search: "Search employees",
    },
    {
      path: "/booked-services",
      endpoint: "/api/service-requests",
      key: "serviceRequests",
      role: "USER",
      search: "Search booked services",
    },
    {
      path: "/request-inbox",
      endpoint: "/api/request-inbox",
      key: "serviceRequests",
      role: "STAFF",
      search: "Search requests",
    },
    {
      path: "/service-requests",
      endpoint: "/api/client/service-requests",
      key: "requests",
      role: "USER",
      search: "Search service requests",
    },
  ] as const) {
    test(`${directory.path} previews and clears search before responses at ${width}px`, async ({
      page,
    }, testInfo) => {
      test.skip(live, "Uses isolated table fixtures")
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: "no-preference" })
      await restoreSession(page, directory.role, {
        account: { headOf: { id: "dept-1", name: "Engineering" } },
      })
      const records = [
        fixture("Alpha Table", "alpha"),
        fixture("Beta Table", "beta"),
      ]
      if (directory.key === "employees")
        records.forEach((item) => {
          item.status = "ACTIVE"
        })
      let hold = false
      let release = () => {}
      const barrier = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route(`**${directory.endpoint}?**`, async (route) => {
        const query =
          new URL(route.request().url()).searchParams
            .get("search")
            ?.toLowerCase() ?? ""
        if (hold) await barrier
        const source =
          query === "remote" ? [fixture("Remote Table", "remote")] : records
        const rows = source.filter((item) =>
          item.fullName.toLowerCase().includes(query),
        )
        await route.fulfill({
          json: {
            [directory.key]: rows,
            total: rows.length,
            page: 1,
            pageSize: 10,
            department: { id: "dept-1", name: "Engineering" },
            summary: {
              total: 2,
              pending: 2,
              inProgress: 0,
              completed: 0,
              cancelled: 0,
            },
          },
        })
      })
      await page.goto(directory.path)
      const rows = page.locator(
        '[data-animated-slot-row][aria-hidden="false"]:visible',
      )
      await expect(rows).toHaveCount(2)
      const search = page.getByRole("searchbox", {
        name: directory.search,
        exact: true,
      })
      hold = true
      try {
        await search.fill("Alpha")
        await expect(rows).toHaveCount(1)
        await expect(rows).toContainText("Alpha Table")
        await search.fill("")
        await expect(rows).toHaveCount(2)
        await search.fill("Bet")
        await search.pressSequentially("a")
        await expect(rows).toHaveCount(1)
        await expect(rows).toContainText("Beta Table")
        await search.fill("Remote")
        await expect(rows).toHaveCount(0)
        await expect(page.getByText(/^Searching all/)).toBeVisible()
        release()
        await expect(rows).toHaveCount(1)
        await expect(rows).toContainText("Remote Table")
        await expect(page.getByText(/^Searching all/)).toHaveCount(0)
        await rows.first().scrollIntoViewIfNeeded()
        await page.screenshot({
          path: testInfo.outputPath("settled-table.png"),
        })
      } finally {
        release()
      }
    })
  }
}
