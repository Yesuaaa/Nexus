import { test, expect } from "@playwright/test"
import { accountFor } from "./regression-support"
import { defaultPreferences } from "../src/features/settings/api/settings-api"

test("department head manages capacity and reviews real allocation state", async ({
  page,
}) => {
  const account = {
    ...accountFor("STAFF"),
    headOf: { id: "design", name: "Design" },
  }
  let saved = false
  let allocated = false
  let multiple = false
  let overloaded = false
  let empty = false
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/me")
      return route.fulfill({ json: { user: account } })
    if (url.pathname === "/api/auth/settings")
      return route.fulfill({
        json: { preferences: defaultPreferences, sessions: [] },
      })
    if (url.pathname === "/api/workload/capacity") {
      expect(route.request().postDataJSON()).toMatchObject({
        employeeId: "maria",
        scheduledHours: 40,
        timeOffHours: 8,
      })
      saved = true
      return route.fulfill({ json: { saved: true } })
    }
    if (url.pathname === "/api/workload/assignment") {
      expect(route.request().postDataJSON()).toMatchObject({
        employeeId: "maria",
        projectId: "project-1",
        weeklyHours: 10,
      })
      allocated = true
      return route.fulfill({ json: { saved: true } })
    }
    if (url.pathname === "/api/workload")
      return route.fulfill({
        json: {
          department: { id: "design", name: "Design" },
          week: url.searchParams.get("week"),
          projects: [
            {
              id: "project-1",
              name: "Website Redesign",
              status: "IN_PROGRESS",
              requestId: "request-1",
              staff: allocated ? [{ employeeId: "maria" }] : [],
            },
          ],
          staff: empty
            ? []
            : [
                {
                  id: "maria",
                  fullName: "Maria Santos",
                  position: "UI/UX Designer",
                  status: "ACTIVE",
                  profileSpecialties: ["Figma", "Research"],
                  team: null,
                  capacity: saved
                    ? { scheduledHours: 40, timeOffHours: 8 }
                    : null,
                  assignments: allocated
                    ? [
                        {
                          id: "assignment-1",
                          projectId: "project-1",
                          employeeId: "maria",
                          weeklyHours: 10,
                          allocationStart: null,
                          allocationEnd: null,
                          project: {
                            id: "project-1",
                            name: "Website Redesign",
                            status: "IN_PROGRESS",
                          },
                        },
                        ...(multiple
                          ? [
                              {
                                id: "assignment-2",
                                projectId: "project-2",
                                employeeId: "maria",
                                weeklyHours: overloaded ? 40 : 2,
                                allocationStart: null,
                                allocationEnd: null,
                                project: {
                                  id: "project-2",
                                  name: "Brand Identity",
                                  status: "IN_PROGRESS",
                                },
                              },
                            ]
                          : []),
                      ]
                    : [],
                },
              ],
        },
      })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })
  await page.goto("/staff-workload")
  await expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Staff workload table", exact: true })
      .getByText("Needs setup", { exact: true }),
  ).toBeVisible()
  const overview = page.getByRole("region", { name: "Staff workload overview" })
  const checkCardHeights = async () => {
    for (const height of await overview
      .getByRole("article")
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().height),
      )) {
      expect(height).toBeGreaterThanOrEqual(108)
      expect(height).toBeLessThanOrEqual(110)
    }
  }
  await expect(overview.getByRole("article")).toHaveCount(4)
  await checkCardHeights()
  await expect(
    overview.getByRole("img", {
      name: "Staff by status: Active: 1; On leave: 0; Inactive: 0",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    overview.getByRole("img", {
      name: "Record capacity and assignment hours to view utilization.",
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Edit capacity for Maria Santos" })
    .click()
  await page.getByLabel("Scheduled hours", { exact: true }).fill("40")
  await page.getByLabel("Time off / holiday hours").fill("8")
  await expect(
    page.getByRole("region", { name: "Capacity calculation" }),
  ).toContainText("40 hrs − 8 hrs = 32 hrs")
  await page.getByLabel("Time off / holiday hours").fill("41")
  await expect(
    page.getByText("Time off cannot exceed scheduled hours.", { exact: true }),
  ).toBeVisible()
  await page.getByLabel("Time off / holiday hours").fill("8")
  await page.screenshot({
    path: "test-results/staff-workload-edit.png",
    fullPage: true,
  })
  await page.getByRole("button", { name: "Save capacity" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("0 / 32 hrs", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "View Maria Santos" }).click()
  await expect(page.getByText("No assignments this week.")).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1")
  await page.screenshot({
    path: "test-results/staff-workload-details.png",
    fullPage: true,
  })
  await page
    .getByRole("button", { name: "Close workload details", exact: true })
    .click()
  await page.getByRole("button", { name: "View Maria Santos" }).click()
  await page.getByRole("button", { name: "Edit capacity", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Edit weekly capacity" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await page
    .getByRole("button", { name: "More actions for Maria Santos" })
    .click()
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "More actions for Maria Santos" }),
  ).toBeFocused()
  await page
    .getByRole("button", { name: "More actions for Maria Santos" })
    .click()
  await page.getByRole("menuitem", { name: "Assign to project" }).click()
  await page.getByLabel("Staff", { exact: true }).selectOption("maria")
  await page.getByLabel("Project", { exact: true }).selectOption("project-1")
  await page.getByLabel("Hours per week").fill("10")
  await expect(
    page.getByText(/Projected utilization: 10 \/ 32 hrs/),
  ).toBeVisible()
  await page.getByRole("button", { name: "Confirm assignment" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("10 / 32 hrs", { exact: true })).toBeVisible()
  await expect(
    overview.getByRole("img", {
      name: "Weekly utilization: 10 hours assigned against 32 hours capacity; 1 of 1 active staff have complete hours",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    overview.getByRole("img", {
      name: "Active staff availability: Available: 1; Limited capacity: 0; Needs setup: 0",
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "More actions for Maria Santos" })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "Manage assignments", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Reassign", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Reassign / edit allocation" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await page
    .getByRole("button", { name: "More actions for Maria Santos" })
    .click()
  await page.getByRole("menuitem", { name: "Unassign", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Unassign staff?" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  multiple = true
  await page.getByRole("button", { name: "Refresh workload" }).click()
  await expect(page.getByText("12 / 32 hrs", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "More actions for Maria Santos" })
    .click()
  await page.getByRole("menuitem", { name: "Unassign", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Choose assignment to unassign" }),
  ).toBeVisible()
  await page.getByRole("button", { name: /Brand Identity/ }).click()
  await expect(
    page.getByRole("heading", { name: "Unassign staff?" }),
  ).toBeVisible()
  await expect(page.getByRole("dialog")).toContainText("Brand Identity")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await page.getByRole("button", { name: "View Maria Santos" }).click()
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1")
  await page.screenshot({
    path: "test-results/staff-workload-assignments.png",
    fullPage: true,
  })
  await page.getByRole("button", { name: "Close workload details" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  overloaded = true
  await page.getByRole("button", { name: "Refresh workload" }).click()
  await expect(page.getByText("50 / 32 hrs", { exact: true })).toBeVisible()
  await expect(overview.getByRole("img")).toHaveCount(4)
  await expect(
    overview.getByRole("img", {
      name: "Hours over capacity: Maria Santos: 18 hours; 18 total excess hours",
      exact: true,
    }),
  ).toBeVisible()
  await expect(overview.getByText("156%", { exact: true })).toBeVisible()
  await expect(overview.getByText("100%", { exact: true })).toBeVisible()
  await checkCardHeights()
  await page
    .getByRole("heading", { name: "Staff Workload", exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: "test-results/staff-workload-desktop.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole("heading", { name: "Staff Workload", exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      page.getByRole("main").evaluate((el) => el.getBoundingClientRect().left),
    )
    .toBeLessThan(25)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
  await page
    .getByRole("heading", { name: "Staff Workload", exact: true })
    .scrollIntoViewIfNeeded()
  await checkCardHeights()
  await page.screenshot({
    path: "test-results/staff-workload-mobile.png",
    fullPage: true,
  })
  empty = true
  await page.getByRole("button", { name: "Refresh workload" }).click()
  await expect(
    overview.getByRole("img", {
      name: "Staff by status: Active: 0; On leave: 0; Inactive: 0",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    overview.getByRole("img", {
      name: "Active staff availability: Available: 0; Limited capacity: 0; Needs setup: 0",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    overview.getByRole("img", {
      name: "Overload data unavailable: no complete hours recorded",
      exact: true,
    }),
  ).toBeVisible()
  await expect(overview).not.toContainText("NaN")
  await checkCardHeights()
})
