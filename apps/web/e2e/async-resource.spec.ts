import { expect, test, type Page } from "@playwright/test"
import type { AttendanceOverview } from "../src/features/attendance/api/attendance-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Async resource regression uses isolated API failures")

function figureValue(page: Page, label: string) {
  return page
    .getByLabel("Attendance figures")
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd[1]")
    .locator("span")
    .first()
}

test("attendance request failures show an error and recover on retry", async ({
  page,
}) => {
  test.setTimeout(60_000)
  await restoreSession(page, "ADMIN")
  let attempts = 0
  const overview: AttendanceOverview = {
    asOf: "2026-11-14T00:00:00.000Z",
    scope: "PERSONAL",
    recordedDays: 0,
    employees: 1,
    workedHours: 0,
    requiredHours: 0,
    completeDays: 0,
    activeSessions: 0,
    excessDays: 0,
    pendingCorrections: 0,
    overnightReviews: 0,
    statusBreakdown: {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      HOURS_MET: 0,
      INCOMPLETE: 0,
      COMPLETE: 0,
      NOT_REQUIRED: 0,
    },
    checkIns: {
      employees: 1,
      total: 0,
      closed: 0,
      suspended: 0,
      working: 0,
      onBreak: 0,
      recentActivity: [],
    },
  }
  await page.route("**/api/attendance/me/overview?*", async (route) => {
    attempts += 1
    if (attempts < 3) {
      await route.fulfill({
        status: 503,
        json: { error: `Attendance unavailable (${attempts})` },
      })
    } else {
      await route.fulfill({ json: overview })
    }
  })

  await page.goto("/attendance/overview")
  await expect(
    page.getByText("Attendance unavailable (1)", { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
  // PG-007-F001-A010-T015 additive assertions: unavailable report content.
  for (const label of [
    "Attendance days",
    "Check-ins",
    "Check-outs",
    "Still clocked in",
  ])
    await expect(figureValue(page, label)).toHaveText("—")
  await expect(
    page.getByText("Check-in summaries unavailable.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Recent activity unavailable.", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(
    page.getByText("Attendance unavailable (2)", { exact: true }),
  ).toBeVisible()
  await expect(figureValue(page, "Attendance days")).toHaveText("—")
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Attendance Overview", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Attendance unavailable (1)", { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText("Attendance unavailable (2)", { exact: true }),
  ).toHaveCount(0)
  await expect(figureValue(page, "Attendance days")).toHaveText("0")
  await expect(
    page.getByText("Check-in summaries unavailable.", { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText("Recent activity unavailable.", { exact: true }),
  ).toHaveCount(0)
  expect(attempts).toBe(3)
})
