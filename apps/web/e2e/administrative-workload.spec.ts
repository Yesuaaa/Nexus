import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type { WorkloadStaff } from "../src/features/workload/model/workload"

configureRegressionTest()
test.skip(live, "Administrative workload coverage uses isolated API fixtures")

const member: WorkloadStaff = {
  id: "maria",
  fullName: "Maria Santos",
  position: "Designer",
  status: "ACTIVE",
  profileSpecialties: ["Design"],
  team: null,
  department: { id: "design", name: "Design" },
  capacity: { scheduledHours: 40, timeOffHours: 8 },
  assignments: [
    {
      id: "allocation",
      employeeId: "maria",
      projectId: "project",
      weeklyHours: 36,
      allocationStart: null,
      allocationEnd: null,
      project: {
        id: "project",
        name: "Held design project",
        status: "ON_HOLD",
      },
    },
  ],
  planning: {
    requirement: { totalHours: 30, knownHours: 30, days: [] },
    confirmedAvailableSlots: null,
    commitments: [],
    overlaps: [],
  },
}
const staff: WorkloadStaff[] = [
  member,
  {
    ...member,
    id: "engineering",
    fullName: "Engineering employee",
    department: { id: "engineering", name: "Engineering" },
    capacity: null,
    assignments: [],
  },
]

for (const width of [1440, 390])
  test(`Superadmin oversees workload through Service Operations at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await restoreSession(page, "SUPERADMIN")
    const prohibited: string[] = []
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname
      if (
        path.startsWith("/api/") &&
        (request.method() !== "GET" || /^\/api\/workload(?:\/|$)/.test(path))
      )
        prohibited.push(path)
    })
    await page.route("**/api/administrative-workload?**", (route) =>
      route.fulfill({
        json: {
          department: null,
          departments: [
            { id: "design", name: "Design" },
            { id: "engineering", name: "Engineering" },
          ],
          staff,
          projects: [],
          week: new URL(route.request().url()).searchParams.get("week"),
          capabilities: {
            read: true,
            manageCapacity: false,
            assign: false,
            reassign: false,
            unassign: false,
            updateAvailability: false,
          },
        },
      }),
    )
    await page.goto("/services")
    if (width === 390)
      await page
        .getByRole("button", { name: "Open navigation menu", exact: true })
        .click()
    await page
      .getByRole("link", { name: "Staff Workload", exact: true })
      .click()
    await expect(page).toHaveURL(/\/module\/service-operations\/workload$/)
    await expect(
      page.getByText("across all departments (read only)", { exact: false }),
    ).toBeVisible()
    const table = page.getByRole("region", {
      name: "Staff workload table",
      exact: true,
    })
    await expect(table.getByText("36 / 32 hrs", { exact: true })).toBeVisible()
    await expect(table.getByText("113%", { exact: true })).toBeVisible()
    await expect(table.getByText("Overloaded", { exact: true })).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for Maria Santos",
        exact: true,
      })
      .click()
    await expect(page.getByRole("menuitem")).toHaveCount(1)
    await page
      .getByRole("menuitem", { name: "View workload", exact: true })
      .click()
    const drawer = page.getByRole("dialog")
    await expect(
      drawer.getByText("Held design project", { exact: true }),
    ).toBeVisible()
    await expect(drawer.getByText("36 hrs/week", { exact: true })).toBeVisible()
    await expect(drawer.getByText("Unknown", { exact: true })).toBeVisible()
    await expect(
      drawer.getByRole("button", { name: /edit|assign|capacity/i }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Close workload details", exact: true })
      .click()
    await expect(drawer).toHaveCount(0)
    await page
      .getByRole("combobox", { name: "Filter by department", exact: true })
      .click()
    await page.getByRole("option", { name: "Engineering", exact: true }).click()
    await expect(table.getByText("Maria Santos", { exact: true })).toHaveCount(
      0,
    )
    await expect(
      table.getByText("Engineering employee", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("combobox", { name: "Filter by employee", exact: true })
      .click()
    await page
      .getByRole("option", { name: "Engineering employee", exact: true })
      .click()
    await page
      .getByRole("combobox", { name: "Filter by availability", exact: true })
      .click()
    await page.getByRole("option", { name: "Needs setup", exact: true }).click()
    await expect(table.getByText("Needs setup", { exact: true })).toBeVisible()
    await page
      .getByRole("searchbox", { name: "Search staff", exact: true })
      .fill("missing")
    await expect(
      table.getByText("No staff match these filters.", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: /assign staff|save capacity|confirm assignment/i,
      }),
    ).toHaveCount(0)
    await page.reload()
    await expect(table.getByText("Maria Santos", { exact: true })).toBeVisible()
    expect(prohibited).toEqual([])
  })

test("backend denial exposes no workload data despite cached administrative permissions", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.route("**/api/administrative-workload?**", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Organization-wide workload read access is required" },
    }),
  )
  await page.goto("/module/service-operations/workload")
  await expect(
    page
      .getByRole("alert")
      .getByText("Organization-wide workload read access is required"),
  ).toBeVisible()
  await expect(page.getByText("Maria Santos", { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /assign staff|save capacity/i }),
  ).toHaveCount(0)
})

for (const role of ["ADMIN", "STAFF", "USER"] as const)
  test(`${role} cannot enter organization workload oversight`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    let reads = 0
    await page.route("**/api/administrative-workload?**", (route) => {
      reads++
      return route.fulfill({ status: 403, json: { error: "Forbidden" } })
    })
    await page.goto("/module/service-operations/workload")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    expect(reads).toBe(0)
  })
