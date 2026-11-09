import { test, expect } from "@playwright/test"
import { accountFor } from "../regression-support"
import { defaultPreferences } from "../../src/features/settings/api/settings-api"

test("department head manages capacity and reviews real allocation state", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-06T08:00:00Z"))
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
        endDate: "2026-11-09",
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
              request: {
                referenceNumber: "SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01",
                service: { name: "Website Design and Development" },
              },
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
  await expect(
    page.getByRole("button", { name: "Refresh workload" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Workload actions" }),
  ).toHaveCount(0)
  const weekButton = page.getByRole("button", { name: /^Change workload week/ })
  await expect(weekButton).toHaveAccessibleName(
    "Change workload week, starting November 2, 2026",
  )
  await expect(weekButton).toHaveText("")
  await weekButton.click()
  const calendar = page.getByRole("dialog", {
    name: "Choose a date",
    exact: true,
  })
  const chooseWeek = async (day: string) => {
    await weekButton.click()
    await calendar.getByRole("button", { name: day, exact: true }).click()
    await expect(calendar).toHaveCount(0)
  }
  await expect(
    calendar.getByRole("grid", { name: "November 2026" }),
  ).toBeVisible()
  await calendar
    .getByRole("button", { name: "Next month", exact: true })
    .click()
  await expect(
    calendar.getByRole("grid", { name: "December 2026" }),
  ).toBeVisible()
  await calendar
    .getByRole("button", { name: "Previous month", exact: true })
    .click()
  await page.screenshot({
    path: "test-results/staff-workload-calendar-desktop.png",
    fullPage: true,
  })
  await calendar
    .getByRole("button", { name: "Wednesday, November 4, 2026", exact: true })
    .focus()
  await page.keyboard.press("ArrowRight")
  await expect(
    calendar.getByRole("button", {
      name: "Thursday, November 5, 2026",
      exact: true,
    }),
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(calendar).toHaveCount(0)
  await expect(weekButton).toHaveAccessibleName(
    "Change workload week, starting November 2, 2026",
  )
  await expect(weekButton).toBeFocused()
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
  await page.getByRole("button", { name: "Save capacity" }).click()
  expect(saved).toBe(false)
  const timeOff = page.getByLabel("Time off / holiday hours")
  await expect(timeOff).toBeFocused()
  await expect(timeOff).toHaveAccessibleDescription(
    /Enter a value of 40 or less\./,
  )
  await expect(timeOff).toHaveCSS("border-color", "rgb(214, 69, 87)")
  await expect(
    page
      .locator("[data-field-error]")
      .filter({ hasText: "Enter a value of 40 or less." }),
  ).toBeVisible()
  await page.getByLabel("Time off / holiday hours").fill("8")
  await expect(timeOff).not.toHaveAttribute("aria-invalid", "true")
  await expect(timeOff).toHaveAttribute("aria-describedby", "capacity-help")
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
    .getByRole("button", { name: "Assign staff 1", exact: true })
    .click()
  const staffingDialog = page.getByRole("dialog", {
    name: "Staffing attention",
    exact: true,
  })
  await expect(staffingDialog).toContainText("Website Design and Development")
  await expect(staffingDialog).toContainText(
    "SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01",
  )
  await staffingDialog
    .getByRole("button", { name: "Assign staff", exact: true })
    .click()
  const assignmentDialog = page.getByRole("dialog", {
    name: "Assign staff",
    exact: true,
  })
  await expect(
    assignmentDialog.getByRole("combobox", { name: "Project", exact: true }),
  ).toContainText("Website Design and Development")
  await expect(
    assignmentDialog.getByRole("combobox", { name: "Project", exact: true }),
  ).toContainText("SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01")
  await assignmentDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
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
  await page.getByRole("combobox", { name: "Staff", exact: true }).click()
  await page.getByRole("option", { name: /Maria Santos/ }).click()
  await page.getByRole("combobox", { name: "Project", exact: true }).click()
  const projectOption = page.getByRole("option", {
    name: /Website Design and Development/,
  })
  await expect(projectOption).toContainText(
    "SR-8F2ED60A-7A2B-4FD3-9D2C-39AEB23C6D01",
  )
  await projectOption.click()
  await page.getByLabel("Hours per week").fill("10")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Open calendar", exact: true })
    .click()
  await expect(
    calendar.getByRole("button", {
      name: "Sunday, November 1, 2026",
      exact: true,
    }),
  ).toBeDisabled()
  await calendar
    .getByRole("button", { name: "Monday, November 9, 2026", exact: true })
    .click()
  await expect(calendar).toHaveCount(0)
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-11-09",
  )
  await expect(
    page.getByText(/Projected utilization: 10 \/ 32 hrs/),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/staff-workload-assignment-desktop.png",
    fullPage: true,
  })
  const viewport = page.viewportSize()!
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(async () => (await assignmentDialog.boundingBox())?.width)
    .toBeLessThanOrEqual(362)
  const dialogBounds = await assignmentDialog.boundingBox()
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(14)
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(376)
  expect(
    await assignmentDialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: "test-results/staff-workload-assignment-mobile.png",
    fullPage: true,
  })
  await page.setViewportSize(viewport)
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
  await chooseWeek("Monday, November 9, 2026")
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
  await chooseWeek("Wednesday, November 18, 2026")
  await expect(weekButton).toHaveAccessibleName(
    "Change workload week, starting November 16, 2026",
  )
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
  await weekButton.click()
  await expect(calendar).toBeVisible()
  const calendarBounds = await calendar.boundingBox()
  expect(calendarBounds!.x).toBeGreaterThanOrEqual(8)
  expect(calendarBounds!.x + calendarBounds!.width).toBeLessThanOrEqual(382)
  await page.screenshot({
    path: "test-results/staff-workload-calendar-mobile.png",
    fullPage: true,
  })
  await page.keyboard.press("Escape")
  await expect(calendar).toHaveCount(0)
  await expect(weekButton).toBeFocused()
  empty = true
  await chooseWeek("Monday, November 23, 2026")
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

test("department head can reassign or remove allocations for former staff", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-06T08:00:00Z"))
  const account = {
    ...accountFor("STAFF"),
    headOf: { id: "design", name: "Design" },
  }
  let removed = false
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
    if (url.pathname === "/api/workload/assignment/stale-allocation") {
      expect(route.request().method()).toBe("DELETE")
      removed = true
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
              request: null,
              staff: removed
                ? []
                : [
                    {
                      id: "stale-allocation",
                      employeeId: "former-staff",
                      employeeName: "Former Staff",
                      weeklyHours: 8,
                      allocationStart: "2026-11-02T00:00:00.000Z",
                      allocationEnd: "2026-11-09T00:00:00.000Z",
                      eligible: false,
                    },
                  ],
            },
          ],
          staff: [
            {
              id: "maria",
              fullName: "Maria Santos",
              position: "UI/UX Designer",
              status: "ACTIVE",
              profileSpecialties: [],
              team: null,
              capacity: { scheduledHours: 40, timeOffHours: 0 },
              assignments: [],
            },
          ],
        },
      })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/staff-workload")
  await page
    .getByRole("button", { name: "Assign staff 1", exact: true })
    .click()
  const attention = page.getByRole("dialog", {
    name: "Staffing attention",
    exact: true,
  })
  await expect(attention).toContainText("Former Staff")
  await expect(attention).toContainText("8 hrs/week")
  await attention.getByRole("button", { name: "Reassign", exact: true }).click()
  const reassign = page.getByRole("dialog", {
    name: "Reassign / edit allocation",
    exact: true,
  })
  await expect(reassign.getByLabel("Hours per week")).toHaveValue("8")
  await expect(reassign.getByLabel("End date")).toHaveValue("2026-11-09")
  await reassign.getByRole("combobox", { name: "Staff", exact: true }).click()
  await expect(page.getByRole("option", { name: /Maria Santos/ })).toBeVisible()
  await expect(page.getByRole("option", { name: /Former Staff/ })).toHaveCount(
    0,
  )
  await page.keyboard.press("Escape")
  await reassign.getByRole("button", { name: "Cancel", exact: true }).click()

  await page
    .getByRole("button", { name: "Assign staff 1", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Staffing attention", exact: true })
    .getByRole("button", { name: "Remove", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Unassign staff?", exact: true }),
  ).toBeVisible()
  const workloadRefresh = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/workload" &&
      response.request().method() === "GET",
  )
  await page
    .getByRole("button", { name: "Unassign staff", exact: true })
    .click()
  expect(removed).toBe(true)
  const refreshedWorkload = await workloadRefresh
  const refreshedBody = await refreshedWorkload.json()
  expect(refreshedBody.projects[0].staff).toEqual([])
  await page
    .getByRole("button", { name: "Assign staff 1", exact: true })
    .click()
  const cleanedUp = page.getByRole("dialog", {
    name: "Staffing attention",
    exact: true,
  })
  await expect(cleanedUp).not.toContainText("Former Staff")
  await expect(
    cleanedUp.getByRole("button", { name: "Assign staff", exact: true }),
  ).toBeVisible()
})
