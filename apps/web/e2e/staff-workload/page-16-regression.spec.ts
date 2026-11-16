import { expect, test } from "@playwright/test"
import { accountFor } from "../regression-support"
import { defaultPreferences } from "../../src/features/settings/api/settings-api"

const account = {
  ...accountFor("STAFF"),
  headOf: { id: "design", name: "Design" },
}

function workloadData(week: string, saved = false) {
  return {
    department: { id: "design", name: "Design" },
    week,
    projects: [],
    staff: [
      {
        id: "maria",
        fullName: "Maria Santos",
        position: "Designer",
        status: "ACTIVE",
        profileSpecialties: ["Figma"],
        team: null,
        capacity: saved ? { scheduledHours: 36, timeOffHours: 4 } : null,
        assignments: [],
        planning: {
          requirement: {
            totalHours: null,
            knownHours: 0,
            days: [],
          },
          confirmedAvailableSlots: null,
          commitments: [],
          overlaps: [],
        },
      },
    ],
  }
}

function workloadDirectoryData(week: string) {
  const staff = Array.from({ length: 12 }, (_, index) => {
    const id = `staff-${String(index + 1).padStart(2, "0")}`
    const overloaded = index === 11
    return {
      id,
      fullName: overloaded ? "Zara Specialist" : `Test Staff ${index + 1}`,
      position: overloaded ? "Research Strategist" : "Designer",
      status: "ACTIVE",
      profileSpecialties: overloaded ? ["Needlework"] : ["Figma"],
      team:
        index < 6
          ? { id: "design", name: "Design Team" }
          : { id: "research", name: "Research Team" },
      capacity: { scheduledHours: 40, timeOffHours: 0 },
      assignments: overloaded
        ? [
            {
              id: "assignment-12",
              projectId: "project-12",
              employeeId: id,
              weeklyHours: 42,
              allocationStart: week,
              allocationEnd: null,
              project: {
                id: "project-12",
                name: "Research Portal",
                status: "IN_PROGRESS",
              },
            },
          ]
        : [],
      planning: {
        requirement: { totalHours: null, knownHours: 0, days: [] },
        confirmedAvailableSlots: null,
        commitments: [],
        overlaps: [],
      },
    }
  })
  return {
    department: { id: "design", name: "Design" },
    week,
    projects: [],
    staff,
  }
}

test("[P16-WEB-001] workload read failure exposes retry and recovers", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-06T08:00:00Z"))
  let workloadReads = 0
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
    if (url.pathname === "/api/workload") {
      workloadReads += 1
      if (workloadReads === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Workload temporarily unavailable." },
        })
      return route.fulfill({
        json: workloadData(url.searchParams.get("week") ?? ""),
      })
    }
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/staff-workload")
  const table = page.getByRole("region", { name: "Staff workload table" })
  await expect(table.getByRole("alert")).toContainText(
    "Workload temporarily unavailable.",
  )
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(table.getByText("Maria Santos", { exact: true })).toBeVisible()
  expect(workloadReads).toBe(2)
})

test("[P16-WEB-002] rejected capacity write keeps values for retry", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-06T08:00:00Z"))
  let capacityWrites = 0
  let capacitySaved = false
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
      expect(route.request().method()).toBe("PUT")
      expect(route.request().postDataJSON()).toMatchObject({
        employeeId: "maria",
        scheduledHours: 36,
        timeOffHours: 4,
      })
      capacityWrites += 1
      if (capacityWrites === 1)
        return route.fulfill({
          status: 409,
          json: { error: "Capacity update conflicted. Retry the save." },
        })
      capacitySaved = true
      return route.fulfill({ json: { saved: true } })
    }
    if (url.pathname === "/api/workload")
      return route.fulfill({
        json: workloadData(url.searchParams.get("week") ?? "", capacitySaved),
      })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/staff-workload")
  const table = page.getByRole("region", { name: "Staff workload table" })
  await expect(table.getByText("Maria Santos", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "More actions for Maria Santos" })
    .click()
  await page
    .getByRole("menuitem", { name: "Edit capacity", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Edit weekly capacity" })
  const scheduled = dialog.getByLabel("Scheduled hours", { exact: true })
  const timeOff = dialog.getByLabel("Time off / holiday hours", {
    exact: true,
  })
  await scheduled.fill("36")
  await timeOff.fill("4")
  await page.getByRole("button", { name: "Save capacity", exact: true }).click()

  await expect(dialog.getByRole("alert")).toContainText(
    "Capacity update conflicted. Retry the save.",
  )
  await expect(scheduled).toHaveValue("36")
  await expect(timeOff).toHaveValue("4")
  await page.getByRole("button", { name: "Save capacity", exact: true }).click()

  await expect(dialog).toHaveCount(0)
  await expect(table).toContainText("0 / 32 hrs")
  expect(capacityWrites).toBe(2)
})

test("[P16-WEB-003] clearing search resets pagination to page one", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-06T08:00:00Z"))
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
    if (url.pathname === "/api/workload")
      return route.fulfill({
        json: workloadDirectoryData(url.searchParams.get("week") ?? ""),
      })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/staff-workload")
  const table = page.getByRole("region", { name: "Staff workload table" })
  const directory = page.getByRole("region", {
    name: "Staff workload directory",
  })
  const pagination = directory.getByRole("navigation", {
    name: "Staff workload pages",
  })
  const nextPage = pagination.getByRole("button", { name: "Next page" })
  await expect(table.getByText("Test Staff 1", { exact: true })).toBeVisible()
  await expect(directory.getByRole("status")).toHaveText(/Showing 1.*10 of 12/)
  await expect(nextPage).toBeEnabled()
  await nextPage.click()
  await expect(
    table.getByText("Zara Specialist", { exact: true }).first(),
  ).toBeVisible()
  await expect(directory.getByRole("status")).toHaveText(/Showing 11.*12 of 12/)

  const search = directory.getByRole("searchbox", { name: "Search staff" })
  for (const query of ["Zara", "Strategist", "Needlework"]) {
    await search.fill(query)
    await expect(
      table.getByText("Zara Specialist", { exact: true }).first(),
    ).toBeVisible()
    await expect(directory.getByRole("status")).toHaveText(/Showing 1.*1 of 1/)
  }
  await search.fill("")
  await expect(search).toHaveValue("")
  await expect(directory.getByRole("status")).toHaveText(/Showing 1.*10 of 12/)
  await expect(nextPage).toBeEnabled()
  await nextPage.click()

  await expect(
    table.getByText("Zara Specialist", { exact: true }).first(),
  ).toBeVisible()
})

test("[P16-WEB-004] team and availability filters select matching staff", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-06T08:00:00Z"))
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
    if (url.pathname === "/api/workload")
      return route.fulfill({
        json: workloadDirectoryData(url.searchParams.get("week") ?? ""),
      })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/staff-workload")
  const table = page.getByRole("region", { name: "Staff workload table" })
  const directory = page.getByRole("region", {
    name: "Staff workload directory",
  })
  await directory.getByRole("combobox", { name: "Filter by team" }).click()
  await page.getByRole("option", { name: "Research Team", exact: true }).click()
  await expect(
    table.getByText("Test Staff 7", { exact: true }).first(),
  ).toBeVisible()
  await expect(directory.getByRole("status")).toHaveText(/Showing 1.*6 of 6/)
  await expect(table.getByText("Test Staff 1", { exact: true })).toHaveCount(0)

  await directory
    .getByRole("combobox", { name: "Filter by availability" })
    .click()
  await page.getByRole("option", { name: "Overloaded", exact: true }).click()
  await expect(
    table.getByText("Zara Specialist", { exact: true }).first(),
  ).toBeVisible()
  await expect(table).toContainText("Overloaded")
  await expect(directory.getByRole("status")).toHaveText(/Showing 1.*1 of 1/)
  await expect(table.getByText("Test Staff 7", { exact: true })).toHaveCount(0)
})
