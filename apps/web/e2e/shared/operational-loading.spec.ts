import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

const department = { id: "dept-1", name: "Engineering" }
const timestamp = "2026-11-09T00:00:00Z"
const scenarios = [
  {
    path: "/staff-workload",
    endpoint: "/api/workload",
    table: "Staff workload table",
    label: "staff workload",
    content: "Maria Santos",
    response: {
      department,
      week: "2026-11-09",
      projects: [],
      staff: [
        {
          id: "maria",
          fullName: "Maria Santos",
          position: "Designer",
          status: "ACTIVE",
          profileSpecialties: ["Figma"],
          team: null,
          capacity: { scheduledHours: 40, timeOffHours: 0 },
          assignments: [],
        },
      ],
    },
  },
  {
    path: "/request-inbox",
    endpoint: "/api/request-inbox",
    table: "Department requests",
    label: "requests",
    content: "Website request",
    response: {
      department,
      page: 1,
      pageSize: 10,
      total: 1,
      serviceRequests: [
        {
          id: "request-1",
          title: "Website request",
          referenceNumber: "SR-001",
          status: "SUBMITTED",
          createdAt: timestamp,
          updatedAt: timestamp,
          service: { id: "service-1", name: "Website request" },
          client: {
            fullName: "Test Client",
            email: "client@example.com",
            contactNumber: null,
          },
        },
      ],
    },
  },
  {
    path: "/project-workspace",
    endpoint: "/api/project-workspace",
    table: "Project workspaces",
    label: "projects",
    content: "Website Project",
    response: {
      canCreate: false,
      workspaces: [
        {
          id: "workspace-1",
          name: "Website Project",
          structure: "SEPARATE",
          status: "IN_PROGRESS",
          updatedAt: timestamp,
          activityCount: 0,
          client: { id: "client-1", fullName: "Test Client" },
          workstreams: [],
        },
      ],
    },
  },
] as const

for (const width of [1440, 390]) {
  for (const scenario of scenarios) {
    test(`${scenario.path} shows skeleton rows until data arrives at ${width}px`, async ({
      page,
    }, testInfo) => {
      test.skip(live, "Uses held API responses")
      await page.setViewportSize({ width, height: 900 })
      let referenceColors:
        { title: string; description: string; column: string } | undefined
      if (scenario.path === "/request-inbox") {
        const reference = await page.context().newPage()
        try {
          await restoreSession(reference, "ADMIN")
          await reference.goto("/clients")
          const title = reference.getByRole("heading", {
            name: "Client Management",
            exact: true,
          })
          await expect(title).toBeVisible()
          referenceColors = {
            title: await title.evaluate(
              (element) => getComputedStyle(element).color,
            ),
            description: await reference
              .locator("main header p")
              .evaluate((element) => getComputedStyle(element).color),
            column: await reference
              .getByRole("columnheader", { includeHidden: true })
              .first()
              .evaluate((element) => getComputedStyle(element).color),
          }
        } finally {
          await reference.close()
        }
      }
      await restoreSession(page, "STAFF", { account: { headOf: department } })
      let release = () => {}
      const barrier = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route(`**${scenario.endpoint}?**`, async (route) => {
        await barrier
        await route.fulfill({ json: scenario.response })
      })
      try {
        await page.goto(scenario.path)
        const table =
          scenario.path === "/staff-workload"
            ? page
                .getByRole("region", { name: scenario.table })
                .getByRole("table")
            : page.getByRole("table", { name: scenario.table })
        await expect(table).toHaveAttribute("aria-busy", "true")
        await expect(table.getByRole("status")).toHaveText(
          `Loading ${scenario.label}…`,
        )
        await expect(table.locator(".animate-pulse")).toHaveCount(60)
        if (referenceColors) {
          await expect(
            page.getByRole("heading", { name: "Request Inbox", exact: true }),
          ).toHaveCSS("color", referenceColors.title)
          await expect(page.locator("main header p")).toHaveCSS(
            "color",
            referenceColors.description,
          )
          for (const header of await table.getByRole("columnheader").all()) {
            await expect(header).toHaveCSS("color", referenceColors.column)
          }
          for (const button of await table
            .getByRole("columnheader")
            .getByRole("button")
            .all()) {
            await expect(button).toHaveCSS("color", referenceColors.column)
            await expect(button).toHaveCSS("color", "rgb(7, 15, 31)")
          }
        }
        if (scenario.path === "/project-workspace") {
          await expect(
            page.getByRole("region", { name: "Project summary" }),
          ).toHaveAttribute("aria-busy", "true")
        }
        await page.screenshot({ path: testInfo.outputPath("loading.png") })
        release()
        await expect(table).toHaveAttribute("aria-busy", "false")
        await expect(table.locator(".animate-pulse")).toHaveCount(0)
        await expect(
          table.getByRole("cell").filter({ hasText: scenario.content }).first(),
        ).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath("loaded.png") })
      } finally {
        release()
      }
    })
  }
}
