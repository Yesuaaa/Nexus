import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import { Permissions } from "../src/features/auth/model/permissions"
import type {
  AttendanceHistory,
  AttendanceState,
  AttendanceWorkday,
} from "../src/features/attendance/api/attendance-api"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
  type MockApiOptions,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Attendance entry uses isolated regression account fixtures")

const attendanceState = {
  asOf: "2026-11-23T00:00:00.000Z",
  employeeId: "entry-test-employee",
  needsPolicy: true,
  workday: null,
}

const attendanceHistory = {
  asOf: "2026-11-23T00:00:00.000Z",
  employeeId: "entry-test-employee",
  total: 0,
  page: 1,
  pageSize: 20,
  workdays: [],
}

const pg006AsOf = "2026-11-23T12:00:00.000Z"
const pg006EmployeeId = "pg006-test-employee"

function pg006Workday(
  overrides: Partial<AttendanceWorkday> = {},
): AttendanceWorkday {
  return {
    id: "pg006-workday",
    employeeId: pg006EmployeeId,
    workDate: "2026-11-23",
    timeZone: "Asia/Manila",
    isWorkingDay: true,
    requiredMinutes: 480,
    workedMilliseconds: 0,
    workedHours: 0,
    remainingMinutes: 480,
    excessMinutes: 0,
    excessRequiresReview: false,
    progressPercent: 0,
    status: "NOT_STARTED",
    isComplete: false,
    activeSessionId: null,
    activeBreakId: null,
    sessions: [],
    policy: {
      id: "pg006-policy",
      name: "PG-006 test policy",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: false,
    },
    overnightRequiresReview: false,
    pendingCorrections: 0,
    ...overrides,
  }
}

function pg006State(overrides: Partial<AttendanceState> = {}): AttendanceState {
  return {
    asOf: pg006AsOf,
    employeeId: pg006EmployeeId,
    needsPolicy: false,
    workday: pg006Workday(),
    clockInBlockedReason: null,
    ...overrides,
  }
}

function pg006History(
  workdays: AttendanceWorkday[] = [],
  { page = 1, pageSize = 20, total = workdays.length } = {},
): AttendanceHistory {
  return {
    asOf: pg006AsOf,
    employeeId: pg006EmployeeId,
    total,
    page,
    pageSize,
    workdays,
  }
}

async function stubPg006Current(page: Page, state: AttendanceState) {
  await page.route("**/api/attendance/me/current", (route) =>
    route.fulfill({ json: state }),
  )
}

async function stubPg006History(page: Page, history: AttendanceHistory) {
  await page.route("**/api/attendance/me/history**", (route) =>
    route.fulfill({ json: history }),
  )
}

async function stubPersonalAttendanceReads(page: Page) {
  await page.route("**/api/attendance/me/current", (route) =>
    route.fulfill({ json: attendanceState }),
  )
  await page.route("**/api/attendance/me/history**", (route) =>
    route.fulfill({ json: attendanceHistory }),
  )
}

function trackAttendanceWrites(page: Page) {
  const writes: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (
      url.pathname.startsWith("/api/attendance/") &&
      !["GET", "HEAD"].includes(request.method())
    ) {
      writes.push(`${request.method()} ${url.pathname}`)
    }
  })
  return writes
}

test("[PG-003-F001-A001-T003] active STAFF enters personal check-ins", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPersonalAttendanceReads(page)
  const writes = trackAttendanceWrites(page)

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  expect(writes).toEqual([])
})

test("[PG-003-F001-A001-T004] active ADMIN without employees:read enters personal check-ins", async ({
  page,
}) => {
  const permissions = accountFor("ADMIN").permissions.filter(
    (permission) => permission !== Permissions.EMPLOYEES_READ,
  )
  await restoreSession(page, "ADMIN", { account: { permissions } })
  await stubPersonalAttendanceReads(page)
  const writes = trackAttendanceWrites(page)

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  expect(writes).toEqual([])
})

test("[PG-006-F001-A001-T002] eligible STAFF and ADMIN reach canonical Check-Ins from the legacy alias", async ({
  page,
  context,
}) => {
  for (const [index, role] of (["STAFF", "ADMIN"] as const).entries()) {
    const aliasPage = index === 0 ? page : await context.newPage()
    await restoreSession(aliasPage, role)
    await stubPersonalAttendanceReads(aliasPage)

    await aliasPage.goto("/attendance/my")

    await expect(aliasPage).toHaveURL(/\/attendance\/check-ins$/)
    await expect(
      aliasPage.getByRole("heading", { name: "Check-Ins", exact: true }),
    ).toBeVisible()
  }
})

test("[PG-006-F001-A002-T005] current attendance retry recovers and an ADMIN profile conflict remains actionable", async ({
  page,
  context,
}) => {
  await restoreSession(page, "STAFF")
  let currentRequests = 0
  await page.route("**/api/attendance/me/current", (route) => {
    currentRequests += 1
    return currentRequests === 1
      ? route.fulfill({
          status: 503,
          json: { error: "Attendance is temporarily unavailable." },
        })
      : route.fulfill({ json: attendanceState })
  })
  await stubPg006History(page, pg006History())

  await page.goto("/attendance/check-ins")

  const currentError = page
    .getByRole("alert")
    .filter({ hasText: "Attendance is temporarily unavailable" })
  await expect(currentError).toBeVisible()
  await currentError.getByRole("button", { name: "Retry" }).click()
  await expect(currentError).toHaveCount(0)
  await expect(
    page.getByText(/Your attendance policy has not been assigned/),
  ).toBeVisible()
  expect(currentRequests).toBe(2)

  const adminPage = await context.newPage()
  await restoreSession(adminPage, "ADMIN")
  await adminPage.route("**/api/attendance/me/current", (route) =>
    route.fulfill({
      status: 409,
      json: { error: "An employee profile is required for attendance." },
    }),
  )
  await stubPg006History(adminPage, pg006History())
  await adminPage.goto("/attendance/check-ins")
  const adminError = adminPage
    .getByRole("alert")
    .filter({ hasText: "An employee profile is required for attendance." })
  await expect(adminError).toBeVisible()
  await expect(adminError.getByRole("button", { name: "Retry" })).toBeVisible()
  await expect(adminPage.getByRole("button", { name: "Clock in" })).toHaveCount(
    0,
  )
  await adminPage.close()
})

test("[PG-006-F001-A007-T012] current policy, suspension, and leave states control the page actions", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  let currentState: AttendanceState = pg006State({
    needsPolicy: true,
    workday: null,
  })
  await page.route("**/api/attendance/me/current", (route) =>
    route.fulfill({ json: currentState }),
  )
  await stubPg006History(page, pg006History())

  await page.goto("/attendance/check-ins")
  await expect(
    page.getByText(/Your attendance policy has not been assigned/),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Clock in" })).toHaveCount(0)

  currentState = pg006State({
    clockInBlockedReason: "Approved leave covers this workday.",
  })
  await page.reload()
  await expect(
    page.getByText("Approved leave covers this workday.", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Clock in" })).toBeDisabled()

  currentState = pg006State({
    workday: pg006Workday({
      status: "INCOMPLETE",
      workedMilliseconds: 2 * 60 * 60 * 1000,
      workedHours: 2,
      remainingMinutes: 360,
      sessions: [
        {
          id: "pg006-suspended-session",
          startedAt: "2026-11-23T08:00:00.000Z",
          endedAt: null,
          suspendedAt: "2026-11-23T10:00:00.000Z",
          breaks: [],
        },
      ],
    }),
  })
  await page.reload()
  await expect(
    page.getByText(/Ask HR to reconcile the suspended shift/),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Clock in" })).toBeDisabled()

  currentState = pg006State({
    leaveConflict: true,
    workday: pg006Workday({
      status: "IN_PROGRESS",
      workedMilliseconds: 60 * 60 * 1000,
      workedHours: 1,
      remainingMinutes: 420,
      activeSessionId: "pg006-active-session",
      sessions: [
        {
          id: "pg006-active-session",
          startedAt: "2026-11-23T11:00:00.000Z",
          endedAt: null,
          breaks: [],
        },
      ],
    }),
  })
  await page.reload()
  await expect(
    page.getByText(/Recorded work crosses approved leave/),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Clock out" })).toBeEnabled()
})

test("[PG-006-F001-A008-T013] history date changes reset pagination and submit visible dates", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  const historyQueries: URL[] = []
  await stubPg006Current(page, pg006State({ needsPolicy: true, workday: null }))
  await page.route("**/api/attendance/me/history**", async (route) => {
    const url = new URL(route.request().url())
    historyQueries.push(url)
    const requestedPage = Number(url.searchParams.get("page"))
    await route.fulfill({
      json: pg006History([], {
        page: requestedPage,
        pageSize: 20,
        total: 41,
      }),
    })
  })

  await page.goto("/attendance/check-ins")
  const pagination = page.getByRole("navigation", { name: "Attendance pages" })
  const next = pagination.getByRole("button", { name: "Next page" })
  const pageTwoRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("page") === "2"
    )
  })
  await next.click()
  await pageTwoRequest
  await expect(
    pagination.getByRole("button", { name: "Page 2" }),
  ).toHaveAttribute("aria-current", "page")

  const from = page.getByLabel("Attendance from date")
  const through = page.getByLabel("Attendance through date")
  const fromRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("from") === "2026-11-01" &&
      url.searchParams.get("page") === "1"
    )
  })
  await from.fill("2026-11-01")
  const fromFetch = await fromRequest
  await expect(
    pagination.getByRole("button", { name: "Page 1" }),
  ).toHaveAttribute("aria-current", "page")
  expect(new URL(fromFetch.url()).searchParams.get("to")).toBe(
    await through.inputValue(),
  )
  expect(await from.getAttribute("max")).toBe(await through.inputValue())

  const throughRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("from") === "2026-11-01" &&
      url.searchParams.get("to") === "2026-11-10" &&
      url.searchParams.get("page") === "1"
    )
  })
  await through.fill("2026-11-10")
  const throughFetch = await throughRequest
  expect(new URL(throughFetch.url()).searchParams.get("from")).toBe(
    await from.inputValue(),
  )
  expect(await through.getAttribute("min")).toBe(await from.inputValue())
  expect(historyQueries.at(-1)?.searchParams.get("page")).toBe("1")
})

test("[PG-006-F001-A008-T014] history pagination fetches and displays the selected page", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPg006Current(page, pg006State({ needsPolicy: true, workday: null }))
  await page.route("**/api/attendance/me/history**", async (route) => {
    const url = new URL(route.request().url())
    const requestedPage = Number(url.searchParams.get("page"))
    const workday = pg006Workday({
      id: `pg006-page-${requestedPage}`,
      workDate: requestedPage === 1 ? "2026-11-23" : "2026-11-22",
    })
    await route.fulfill({
      json: pg006History([workday], {
        page: requestedPage,
        pageSize: 1,
        total: 2,
      }),
    })
  })

  await page.goto("/attendance/check-ins")
  const pagination = page.getByRole("navigation", { name: "Attendance pages" })
  await expect(
    page
      .getByRole("table", { name: "Attendance history" })
      .getByText("2026-11-23"),
  ).toBeVisible()
  const secondPage = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("page") === "2"
    )
  })
  await pagination.getByRole("button", { name: "Next page" }).click()
  await secondPage
  await expect(
    pagination.getByRole("button", { name: "Page 2" }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    page
      .getByRole("table", { name: "Attendance history" })
      .getByText("2026-11-22"),
  ).toBeVisible()
  await expect(
    pagination.getByRole("button", { name: "Next page" }),
  ).toBeDisabled()
})

test("[PG-006-F001-A008-T015] history loading, empty, retry, and retained-data states render", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPg006Current(page, pg006State({ needsPolicy: true, workday: null }))
  let releaseInitial: () => void = () => {}
  const initialResponse = new Promise<void>((resolve) => {
    releaseInitial = resolve
  })
  let historyRequests = 0
  let historyMode: "populated" | "failure" = "populated"
  const populatedHistory = pg006History([
    pg006Workday({ id: "pg006-retained-row", workDate: "2026-11-22" }),
  ])
  await page.route("**/api/attendance/me/history**", async (route) => {
    historyRequests += 1
    if (historyRequests === 1) {
      await initialResponse
      await route.fulfill({ json: pg006History() })
      return
    }
    if (historyMode === "failure") {
      await route.fulfill({
        status: 503,
        json: { error: "Attendance history is temporarily unavailable." },
      })
      return
    }
    await route.fulfill({ json: populatedHistory })
  })

  await page.goto("/attendance/check-ins")
  const table = page.getByRole("table", { name: "Attendance history" })
  await expect(table).toHaveAttribute("aria-busy", "true")
  releaseInitial()
  await expect(table).toHaveAttribute("aria-busy", "false")
  await expect(
    table.getByText(
      "No attendance records or approved leave in this date range.",
    ),
  ).toBeVisible()

  const from = page.getByLabel("Attendance from date")
  const populatedRequest = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("from") === "2026-11-01"
    )
  })
  await from.fill("2026-11-01")
  await populatedRequest
  await expect(table.getByText("2026-11-22")).toBeVisible()

  historyMode = "failure"
  const failureRequest = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("to") === "2026-11-10"
    )
  })
  await page.getByLabel("Attendance through date").fill("2026-11-10")
  await failureRequest
  const historyError = page
    .getByRole("alert")
    .filter({ hasText: "Attendance history is temporarily unavailable" })
  await expect(historyError).toBeVisible()
  await expect(
    historyError.getByRole("button", { name: "Retry" }),
  ).toBeVisible()
  await expect(table.getByText("2026-11-22")).toBeVisible()

  historyMode = "populated"
  const retryRequest = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/me/history" &&
      url.searchParams.get("to") === "2026-11-10"
    )
  })
  await historyError.getByRole("button", { name: "Retry" }).click()
  await retryRequest
  await expect(historyError).toHaveCount(0)
  await expect(table.getByText("2026-11-22")).toBeVisible()
})

test("[PG-006-F001-A009-T018] history details open and close with keyboard while restoring focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreSession(page, "STAFF")
  const detailSession = {
    id: "pg006-detail-session",
    startedAt: "2026-11-22T01:00:00.000Z",
    endedAt: "2026-11-22T09:00:00.000Z",
    breaks: [
      {
        id: "pg006-detail-break",
        startedAt: "2026-11-22T05:00:00.000Z",
        endedAt: "2026-11-22T05:30:00.000Z",
        isPaid: false,
      },
    ],
  }
  const detailDay = pg006Workday({
    id: "pg006-detail-day",
    workDate: "2026-11-22",
    workedMilliseconds: 7.5 * 60 * 60 * 1000,
    workedHours: 7.5,
    remainingMinutes: 30,
    progressPercent: 94,
    status: "INCOMPLETE",
    pendingCorrections: 1,
    schedule: {
      startsAt: "09:00",
      endsAt: "17:00",
      unpaidBreakMinutes: 30,
      lateArrivalMinutes: 0,
      earlyDepartureMinutes: 0,
    },
    sessions: [detailSession],
  })
  const writes = trackAttendanceWrites(page)
  await stubPg006Current(page, pg006State({ needsPolicy: true, workday: null }))
  await stubPg006History(page, pg006History([detailDay]))

  await page.goto("/attendance/check-ins")
  const trigger = page.locator(
    '[id="attendance-history-actions-pg006-detail-day"]',
  )
  await trigger.focus()
  await trigger.press("ArrowDown")
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  const viewDetails = page.getByRole("menuitem", { name: "View details" })
  await expect(viewDetails).toBeVisible()
  await viewDetails.press("Enter")
  await expect(
    page.getByText("Attendance details for 2026-11-22", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Workday summary" }),
  ).toBeVisible()
  await expect(page.getByText("Asia/Manila", { exact: true })).toBeVisible()
  await expect(page.getByText("1 pending", { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      "Unpaid break: Nov 22, 2026, 1:00 PM to Nov 22, 2026, 1:30 PM",
    ),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    page.getByText("Attendance details for 2026-11-22", { exact: true }),
  ).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(writes).toEqual([])
})

test("[PG-006-F001-A011-T023] clock confirmation cancels cleanly and recovers from a failed submit", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  let currentState = pg006State()
  await page.route("**/api/attendance/me/current", (route) =>
    route.fulfill({ json: currentState }),
  )
  await stubPg006History(page, pg006History())
  let releaseFirstFailure: () => void = () => {}
  const firstFailure = new Promise<void>((resolve) => {
    releaseFirstFailure = resolve
  })
  let requests = 0
  let accepted = 0
  await page.route("**/api/attendance/me/clock-in", async (route) => {
    requests += 1
    if (requests === 1) {
      await firstFailure
      await route.fulfill({
        status: 503,
        json: { error: "Clock-in is temporarily unavailable." },
      })
      return
    }
    accepted += 1
    currentState = pg006State({
      workday: pg006Workday({
        status: "IN_PROGRESS",
        workedMilliseconds: 0,
        activeSessionId: "pg006-confirmed-session",
        sessions: [
          {
            id: "pg006-confirmed-session",
            startedAt: pg006AsOf,
            endedAt: null,
            breaks: [],
          },
        ],
      }),
    })
    await route.fulfill({ status: 201, json: currentState })
  })
  const writes = trackAttendanceWrites(page)

  await page.goto("/attendance/check-ins")
  await page.getByRole("button", { name: "Clock in", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(writes).toEqual([])

  await page.getByRole("button", { name: "Clock in", exact: true }).click()
  const firstPost = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/attendance/me/clock-in",
  )
  const dialog = page.getByRole("dialog")
  const confirmButton = dialog.getByRole("button", {
    name: "Clock in",
    exact: true,
  })
  await confirmButton.click()
  await firstPost
  const pendingButton = dialog.getByRole("button", { name: "Saving…" })
  await expect(pendingButton).toBeDisabled()
  releaseFirstFailure()
  await expect(dialog.getByRole("alert")).toContainText(
    "temporarily unavailable",
  )

  const retryPost = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/attendance/me/clock-in",
  )
  await dialog.getByRole("button", { name: "Clock in", exact: true }).click()
  await retryPost
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()
  expect(requests).toBe(2)
  expect(accepted).toBe(1)
})

test("[PG-003-F001-A003-T006] signed-in ineligible profiles are redirected before attendance entry", async ({
  page,
  context,
}) => {
  const superadminPermissions = accountFor("SUPERADMIN").permissions.filter(
    (permission) => permission !== Permissions.EMPLOYEES_READ,
  )
  const profiles: {
    label: string
    role: Account["role"]
    options?: MockApiOptions
    destination: "/dashboard" | "/module"
  }[] = [
    {
      label: "active USER",
      role: "USER",
      destination: "/dashboard",
    },
    {
      label: "inactive STAFF",
      role: "STAFF",
      options: { account: { isActive: false } },
      destination: "/module",
    },
    {
      label: "SUPERADMIN without employees:read",
      role: "SUPERADMIN",
      options: { account: { permissions: superadminPermissions } },
      destination: "/module",
    },
  ]

  for (const [index, profile] of profiles.entries()) {
    const scenarioPage = index === 0 ? page : await context.newPage()
    await restoreSession(scenarioPage, profile.role, profile.options)
    await scenarioPage.goto("/attendance")

    await expect(
      scenarioPage,
      `${profile.label} must follow the portal route policy`,
    ).toHaveURL(new RegExp(`${profile.destination}$`))
    await expect(scenarioPage).not.toHaveURL(/\/attendance(?:\/|$)/)
  }
})

test("[PG-003-F001-A003-T007] an unauthenticated visitor is sent to login", async ({
  page,
}) => {
  const attendanceRequests: string[] = []
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.startsWith("/api/attendance/"))
      attendanceRequests.push(pathname)
  })

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/login$/)
  expect(attendanceRequests).toEqual([])
})

test("[PG-003-F001-A004-T008] the pending entry status is announced before redirect", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPersonalAttendanceReads(page)

  let observedStatus: { role: string | null; text: string } | null = null
  await page.exposeFunction(
    "__capturePg003EntryStatus",
    (role: string | null, text: string) => {
      observedStatus = { role, text }
    },
  )
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const status = document.querySelector('[role="status"]')
      if (!status?.textContent?.includes("Opening attendance…")) return

      const browserWindow = window as Window & {
        __capturePg003EntryStatus?: (
          role: string | null,
          text: string,
        ) => Promise<void>
      }
      void browserWindow.__capturePg003EntryStatus?.(
        status.getAttribute("role"),
        status.textContent.trim(),
      )
      observer.disconnect()
    })

    observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  await expect
    .poll(() => observedStatus)
    .toEqual({
      role: "status",
      text: "Opening attendance…",
    })
})

test("[PG-003-F001-A001-T009] replace redirect leaves no attendance entry in browser history", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPersonalAttendanceReads(page)
  await page.goto("/module")
  await expect(
    page.getByRole("main", { name: "Workspace selector", exact: true }),
  ).toBeVisible()

  await page.goto("/attendance")
  await expect(page).toHaveURL(/\/attendance\/check-ins$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/module$/)
})
