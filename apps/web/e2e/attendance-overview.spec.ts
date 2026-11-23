import { expect, test, type Page } from "@playwright/test"
import type { AttendanceOverview } from "../src/features/attendance/api/attendance-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.use({ timezoneId: "Pacific/Auckland" })
test.skip(live, "PG-007 overview UI cases use deterministic API responses")

function overview(
  overrides: Partial<AttendanceOverview> = {},
): AttendanceOverview {
  const initial: AttendanceOverview = {
    asOf: "2026-11-13T12:34:00.000Z",
    scope: "PERSONAL",
    recordedDays: 0,
    employees: 0,
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
      employees: 0,
      total: 0,
      closed: 0,
      working: 0,
      onBreak: 0,
      suspended: 0,
      recentActivity: [],
    },
  }
  return { ...initial, ...overrides }
}

function figureValue(page: Page, label: string) {
  return page
    .getByLabel("Attendance figures")
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd[1]")
    .locator("span")
    .first()
}

function definitionValue(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd[1]")
}

async function installOverviewResponse(
  page: Page,
  response: AttendanceOverview,
) {
  await page.route("**/api/attendance/me/overview?*", (route) =>
    route.fulfill({ status: 200, json: response }),
  )
}

test("[PG-007-F001-A002-T004] initial load requests the default range while figures are busy", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await page.clock.install({ time: new Date("2026-11-23T04:30:00.000Z") })

  let markRequestSeen!: (url: URL) => void
  const requestSeen = new Promise<URL>((resolve) => {
    markRequestSeen = resolve
  })
  let releaseResponse!: () => void
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route("**/api/attendance/me/overview?*", async (route) => {
    markRequestSeen(new URL(route.request().url()))
    await responseGate
    await route.fulfill({
      status: 200,
      json: overview({
        recordedDays: 1,
        checkIns: {
          employees: 1,
          total: 1,
          closed: 1,
          working: 0,
          onBreak: 0,
          suspended: 0,
          recentActivity: [],
        },
      }),
    })
  })

  await page.goto("/attendance/overview")
  const requestUrl = await requestSeen
  expect(requestUrl.pathname).toBe("/api/attendance/me/overview")
  expect(requestUrl.searchParams.get("from")).toBe("2026-10-24")
  expect(requestUrl.searchParams.get("to")).toBe("2026-11-24")
  const figures = page.getByLabel("Attendance figures")
  await expect(figures).toHaveAttribute("aria-busy", "true")

  releaseResponse()
  await expect(figures).toHaveAttribute("aria-busy", "false")
  await expect(figureValue(page, "Attendance days")).toHaveText("1")
  await expect(
    page.getByRole("heading", { name: "Attendance Overview", exact: true }),
  ).toBeVisible()
})

test("[PG-007-F001-A003-T005] date changes send bounded ranges and ignore a superseded response", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.clock.install({ time: new Date("2026-11-23T04:30:00.000Z") })

  let markOldRequestSeen!: (url: URL) => void
  const oldRequestSeen = new Promise<URL>((resolve) => {
    markOldRequestSeen = resolve
  })
  let markLatestRequestSeen!: (url: URL) => void
  const latestRequestSeen = new Promise<URL>((resolve) => {
    markLatestRequestSeen = resolve
  })
  let releaseOldResponse!: () => void
  const oldResponseGate = new Promise<void>((resolve) => {
    releaseOldResponse = resolve
  })
  let markOldHandlerDone!: () => void
  const oldHandlerDone = new Promise<void>((resolve) => {
    markOldHandlerDone = resolve
  })
  let oldResponseFulfilled = false

  await page.route("**/api/attendance/me/overview?*", async (route) => {
    const url = new URL(route.request().url())
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    if (from === "2026-10-24" && to === "2026-11-24") {
      await route.fulfill({ json: overview({ recordedDays: 1 }) })
      return
    }
    if (from === "2026-11-01" && to === "2026-11-24") {
      markOldRequestSeen(url)
      await oldResponseGate
      try {
        await route.fulfill({ json: overview({ recordedDays: 2 }) })
        oldResponseFulfilled = true
      } catch {
        // The range change aborts the older browser fetch by design.
      } finally {
        markOldHandlerDone()
      }
      return
    }
    if (from === "2026-11-01" && to === "2026-11-20") {
      markLatestRequestSeen(url)
      await route.fulfill({ json: overview({ recordedDays: 3 }) })
      return
    }
    await route.fulfill({ status: 500, json: { error: "Unexpected range" } })
  })

  await page.goto("/attendance/overview")
  const figures = page.getByLabel("Attendance figures")
  await expect(figures).toHaveAttribute("aria-busy", "false")
  const fromInput = page.getByLabel("Attendance from date")
  const throughInput = page.getByLabel("Attendance through date")
  await expect(fromInput).toHaveAttribute("max", "2026-11-24")
  await expect(throughInput).toHaveAttribute("min", "2026-10-24")

  await fromInput.fill("2026-11-01")
  const oldUrl = await oldRequestSeen
  expect(oldUrl.searchParams.get("from")).toBe("2026-11-01")
  expect(oldUrl.searchParams.get("to")).toBe("2026-11-24")
  await throughInput.fill("2026-11-20")
  const latestUrl = await latestRequestSeen
  expect(latestUrl.searchParams.get("from")).toBe("2026-11-01")
  expect(latestUrl.searchParams.get("to")).toBe("2026-11-20")
  await expect(figures).toHaveAttribute("aria-busy", "false")
  await expect(figureValue(page, "Attendance days")).toHaveText("3")

  releaseOldResponse()
  await oldHandlerDone
  expect(oldResponseFulfilled).toBe(true)
  await expect(figureValue(page, "Attendance days")).toHaveText("3")
})

test("[PG-007-F001-A004-T008] pending refresh is disabled and issues one read", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let requestCount = 0
  let markRefreshSeen!: () => void
  const refreshSeen = new Promise<void>((resolve) => {
    markRefreshSeen = resolve
  })
  let releaseRefresh!: () => void
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  await page.route("**/api/attendance/me/overview?*", async (route) => {
    requestCount += 1
    if (requestCount === 1) {
      await route.fulfill({ json: overview({ recordedDays: 2 }) })
      return
    }
    markRefreshSeen()
    await refreshGate
    await route.fulfill({ json: overview({ recordedDays: 3 }) })
  })

  await page.goto("/attendance/overview")
  const figures = page.getByLabel("Attendance figures")
  await expect(figures).toHaveAttribute("aria-busy", "false")
  const refresh = page.getByRole("button", { name: "Refresh", exact: true })
  await refresh.click()
  await refreshSeen
  await expect(refresh).toBeDisabled()
  await expect(figures).toHaveAttribute("aria-busy", "true")
  expect(requestCount).toBe(2)

  await refresh.evaluate((button) => (button as HTMLButtonElement).click())
  expect(requestCount).toBe(2)
  releaseRefresh()
  await expect(figures).toHaveAttribute("aria-busy", "false")
  await expect(figureValue(page, "Attendance days")).toHaveText("3")
  expect(requestCount).toBe(2)
})

test("[PG-007-F001-A005-T009] summary figures map the source response values", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await installOverviewResponse(
    page,
    overview({
      recordedDays: 7,
      checkIns: {
        employees: 1,
        total: 4,
        closed: 2,
        working: 1,
        onBreak: 1,
        suspended: 0,
        recentActivity: [],
      },
    }),
  )

  await page.goto("/attendance/overview")
  await expect(page.getByLabel("Attendance figures")).toHaveAttribute(
    "aria-busy",
    "false",
  )
  await expect(figureValue(page, "Attendance days")).toHaveText("7")
  await expect(figureValue(page, "Check-ins")).toHaveText("4")
  await expect(figureValue(page, "Check-outs")).toHaveText("2")
  await expect(page.getByText("50% completed", { exact: true })).toBeVisible()
  await expect(figureValue(page, "Still clocked in")).toHaveText("2")
})

test("[PG-007-F001-A006-T011] supported status rows expose counts, shares, and bar labels", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await installOverviewResponse(
    page,
    overview({
      checkIns: {
        employees: 1,
        total: 4,
        closed: 2,
        working: 1,
        onBreak: 1,
        suspended: 0,
        recentActivity: [],
      },
    }),
  )

  await page.goto("/attendance/overview")
  const statusTable = page.getByRole("table").filter({
    has: page.getByRole("columnheader", { name: "Share", exact: true }),
  })
  await expect(statusTable.locator("tbody tr")).toHaveCount(3)
  const rows = statusTable.locator("tbody tr")
  const expected = [
    ["Clocked in", "1", "25%", "Clocked in: 1 sessions"],
    ["On unpaid break", "1", "25%", "On unpaid break: 1 sessions"],
    ["Clocked out", "2", "50%", "Clocked out: 2 sessions"],
  ]
  for (const [index, [label, count, share, barName]] of expected.entries()) {
    const row = rows.nth(index)
    await expect(row.getByRole("cell").nth(0)).toHaveText(label)
    await expect(row.getByRole("cell").nth(1)).toHaveText(count)
    await expect(row.getByRole("cell").nth(2)).toContainText(share)
    await expect(
      row.getByRole("img", { name: barName, exact: true }),
    ).toBeVisible()
  }
})

test("[PG-007-F001-A007-T012] personal summary displays the selected range, leave, and UTC refresh time", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.clock.install({ time: new Date("2026-11-13T04:30:00.000Z") })
  await installOverviewResponse(
    page,
    overview({
      recordedDays: 2,
      approvedLeaveDays: 1,
      checkIns: {
        employees: 1,
        total: 3,
        closed: 2,
        working: 1,
        onBreak: 0,
        suspended: 0,
        recentActivity: [],
      },
    }),
  )

  await page.goto("/attendance/overview")
  const fromResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/attendance/me/overview" &&
      url.searchParams.get("from") === "2026-11-13"
    )
  })
  await page.getByLabel("Attendance from date").fill("2026-11-13")
  await fromResponse
  await expect(page.getByLabel("Attendance figures")).toHaveAttribute(
    "aria-busy",
    "false",
  )

  await expect(definitionValue(page, "Reporting scope")).toHaveText("Personal")
  await expect(definitionValue(page, "Attendance workdays")).toHaveText(
    "2026-11-13 – 2026-11-14",
  )
  await expect(definitionValue(page, "Sessions per day")).toHaveText("1.5")
  await expect(definitionValue(page, "Approved leave days")).toHaveText("1")
  await expect(definitionValue(page, "Last refreshed (UTC)")).toHaveText(
    "Nov 13, 2026, 12:34 PM",
  )
})

test("[PG-007-F001-A008-T013] recent activity renders supported labels in payload order and UTC", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const events: AttendanceOverview["checkIns"]["recentActivity"] = [
    {
      id: "event-1",
      action: "CLOCK_IN",
      at: "2026-11-13T12:34:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-2",
      action: "CLOCK_OUT",
      at: "2026-11-13T12:33:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-3",
      action: "BREAK_START",
      at: "2026-11-13T12:32:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-4",
      action: "BREAK_END",
      at: "2026-11-13T12:31:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-5",
      action: "CLOCK_IN",
      at: "2026-11-13T12:30:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-6",
      action: "CLOCK_OUT",
      at: "2026-11-13T12:29:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-7",
      action: "BREAK_START",
      at: "2026-11-13T12:28:00.000Z",
      employeeName: "Avery Staff",
    },
    {
      id: "event-8",
      action: "BREAK_END",
      at: "2026-11-13T12:27:00.000Z",
      employeeName: "Avery Staff",
    },
  ]
  await installOverviewResponse(
    page,
    overview({
      recordedDays: 2,
      checkIns: {
        employees: 1,
        total: 8,
        closed: 4,
        working: 2,
        onBreak: 2,
        suspended: 0,
        recentActivity: events,
      },
    }),
  )

  await page.goto("/attendance/overview")
  const activityTable = page.getByRole("table").filter({
    has: page.getByRole("columnheader", {
      name: "Timestamp (UTC)",
      exact: true,
    }),
  })
  const rows = activityTable.locator("tbody tr")
  await expect(rows).toHaveCount(8)
  const labels = [
    "Clocked in",
    "Clocked out",
    "Started break",
    "Ended break",
    "Clocked in",
    "Clocked out",
    "Started break",
    "Ended break",
  ]
  const times = [
    "Nov 13, 2026, 12:34 PM",
    "Nov 13, 2026, 12:33 PM",
    "Nov 13, 2026, 12:32 PM",
    "Nov 13, 2026, 12:31 PM",
    "Nov 13, 2026, 12:30 PM",
    "Nov 13, 2026, 12:29 PM",
    "Nov 13, 2026, 12:28 PM",
    "Nov 13, 2026, 12:27 PM",
  ]
  for (const [index, event] of events.entries()) {
    const row = rows.nth(index)
    await expect(row.getByRole("cell").nth(0)).toHaveText(
      `${labels[index]} – ${event.employeeName}`,
    )
    await expect(row.getByRole("cell").nth(1)).toHaveText(times[index])
  }
})

test("[PG-007-F001-A009-T014] successful empty period shows zeros and empty messages", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await installOverviewResponse(page, overview())

  await page.goto("/attendance/overview")
  await expect(page.getByLabel("Attendance figures")).toHaveAttribute(
    "aria-busy",
    "false",
  )
  await expect(figureValue(page, "Attendance days")).toHaveText("0")
  await expect(figureValue(page, "Check-ins")).toHaveText("0")
  await expect(figureValue(page, "Check-outs")).toHaveText("0")
  await expect(figureValue(page, "Still clocked in")).toHaveText("0")
  await expect(
    page.getByText("No check-ins in this period.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("No check-in activity in this period.", { exact: true }),
  ).toBeVisible()
  await expect(definitionValue(page, "Sessions per day")).toHaveText("—")
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toHaveCount(0)
})
