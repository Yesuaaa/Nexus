import { test, expect, type Browser, type Page } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { defaultPreferences } from "../src/features/settings/api/settings-api"
import type {
  AttendanceAuditEvent,
  AttendanceHistory,
  AttendanceState,
  AttendanceWorkday,
} from "../src/features/attendance/api/attendance-api"

test.describe.configure({ mode: "serial" })
type Fixture = {
  secret: string
  transferDestinationId: string
  pagingEmployeeId: string
  actors: Record<
    string,
    { token: string; refreshToken: string; employeeId: string; userId: string }
  >
}
let fixture: Fixture
let server: ChildProcess
const api = "http://127.0.0.1:5391"
test.beforeAll(async () => {
  test.setTimeout(90000)
  const root = path.resolve(import.meta.dirname, "../../..")
  server = spawn(
    process.execPath,
    [
      path.join(root, "apps/api/scripts/run-tests.mjs"),
      "--fixture",
      "tests/support/attendance-browser-server.ts",
    ],
    {
      cwd: path.join(root, "apps/api"),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  fixture = await new Promise<Fixture>((resolve, reject) => {
    let output = "",
      errors = ""
    const timeout = setTimeout(
      () =>
        reject(new Error(`Attendance fixture startup timed out: ${errors}`)),
      60000,
    )
    server.stderr?.on("data", (chunk) => {
      errors += String(chunk)
    })
    server.stdout?.on("data", (chunk) => {
      output += String(chunk)
      const match = output.match(/ATTENDANCE_READY:(\{[^\r\n]+\})/)
      if (match) {
        clearTimeout(timeout)
        resolve(JSON.parse(match[1]) as Fixture)
      }
    })
    server.once("error", reject)
    server.once("exit", (code) => {
      clearTimeout(timeout)
      reject(new Error(`Attendance fixture exited ${code}: ${errors}`))
    })
  })
})
async function routeAttendanceApi(
  page: Page,
  { realNotifications = false } = {},
) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    if (
      [
        "/api/request-conversations",
        "/api/internal-conversations",
        "/api/project-conversations",
        "/api/auth/settings",
      ].includes(url.pathname)
    ) {
      if (url.pathname === "/api/auth/settings")
        return route.fulfill({
          json: { preferences: defaultPreferences, sessions: [] },
        })
      return route.fulfill({
        json: { conversations: [], nextCursor: null, unreadCount: 0 },
      })
    }
    if (
      !realNotifications &&
      url.pathname === "/api/request-workflows/notifications"
    )
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    const response = await route.fetch({
      url: `${api}${url.pathname}${url.search}`,
    })
    await route.fulfill({ response })
  })
}
test.beforeEach(async ({ page }) => routeAttendanceApi(page))
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" })
})
test.afterAll(() => {
  server?.kill()
})

test.beforeEach(async ({ context }) => {
  // Forward same-origin requests to this test's real offline API rather than
  // whichever backend target was baked into the shared Next production build.
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    await route.continue({ url: `${api}${url.pathname}${url.search}` })
  })
})

async function signIn(page: Page, actor: string) {
  await page.addInitScript((session) => {
    sessionStorage.setItem("nexus.auth.token", session.token)
    sessionStorage.setItem("nexus.auth.refreshToken", session.refreshToken)
  }, fixture.actors[actor])
}
async function setSession(page: Page, actor: string) {
  await page.evaluate((session) => {
    sessionStorage.clear()
    sessionStorage.setItem("nexus.auth.token", session.token)
    sessionStorage.setItem("nexus.auth.refreshToken", session.refreshToken)
  }, fixture.actors[actor])
}
async function createApprovedCorrection(
  startedAt: string,
  endedAt: string,
  reason: string,
  actor = "staff",
) {
  const createdResponse = await fetch(`${api}/api/attendance/adjustments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors[actor].token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "CORRECTION",
      requestKey: randomUUID(),
      startedAt,
      endedAt,
      reason,
    }),
  })
  expect(createdResponse.status).toBe(201)
  const created = (await createdResponse.json()) as {
    adjustment: { id: string }
  }
  await approveCorrection(created.adjustment.id)
}
async function approveCorrection(id: string) {
  const reviewedResponse = await fetch(
    `${api}/api/attendance/adjustments/${id}/review`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${fixture.actors.head.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        decision: "APPROVED",
        note: "Verified by the isolated browser fixture",
      }),
    },
  )
  expect(reviewedResponse.status).toBe(200)
  const final = await fetch(`${api}/api/attendance/adjustments/${id}/review`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors.admin.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      decision: "APPROVED",
      note: "Approved by the isolated HR fixture",
    }),
  })
  expect(final.status).toBe(200)
  expect((await final.json()).adjustment.status).toBe("APPROVED")
}
async function clock(value: string) {
  const response = await fetch(`${api}/__attendance_clock`, {
    method: "POST",
    headers: { "x-attendance-fixture": fixture.secret },
    body: value,
  })
  expect(response.status).toBe(204)
}
async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: label, exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

async function assertNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true)
}

test("real employee clocks overnight and never receives Employee Management", async ({
  page,
}) => {
  await signIn(page, "staff")
  await page.goto("/module")
  await page
    .getByRole("link", {
      name: "Open Workforce Compliance workspace",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  await expect(
    page.getByRole("heading", { name: "Check-Ins", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Employees", exact: true }),
  ).toHaveCount(0)
  await confirm(page, "Clock in")
  await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()
  await clock("2026-11-14T04:00:00+08:00")
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByLabel("Elapsed work")).toHaveText(/08:00:0/)
  // PG-006-F001-A003-T007 adds visible workday/progress assertions to this
  // existing persistence-backed clocking flow.
  await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()
  const daily = page.getByRole("region", { name: "Daily required hours" })
  await expect(
    daily.getByRole("progressbar", {
      name: "Daily required-hours progress",
    }),
  ).toHaveAttribute("aria-valuenow", "100")
  await expect(daily).toContainText("8.00")
  await expect(daily).toContainText("8 hours")
  await expect(daily.getByText("Daily requirement complete")).toBeVisible()
  await expect(daily.getByText("Browser flexible policy")).toBeVisible()
  await confirm(page, "Clock out")
  await expect(
    page
      .getByRole("table", { name: "Attendance history" })
      .last()
      .getByText("Complete", { exact: true }),
  ).toBeVisible()
  const historyResponse = await fetch(
    `${api}/api/attendance/me/history?from=2026-11-13&to=2026-11-14`,
    { headers: { Authorization: `Bearer ${fixture.actors.staff.token}` } },
  )
  const recorded = (await historyResponse.json()) as {
    workdays: { workDate: string; workedHours: number }[]
  }
  expect(
    recorded.workdays.map((day) => [day.workDate, day.workedHours]),
  ).toEqual([["2026-11-13", 8]])
  await expect(
    page.getByText("Overnight", { exact: true }).first(),
  ).toBeVisible()

  // PG-006-F001-A009-T017 adds deterministic assertions for optional row
  // fields while retaining the real persistence assertions above.
  const summaryPage = await page.context().newPage()
  await signIn(summaryPage, "staff")
  const summaryState: AttendanceState = {
    asOf: "2026-11-14T04:00:00.000Z",
    employeeId: fixture.actors.staff.employeeId,
    needsPolicy: true,
    workday: null,
  }
  const summarySession = {
    id: "pg006-summary-session",
    startedAt: "2026-11-13T12:00:00.000Z",
    endedAt: "2026-11-13T20:00:00.000Z",
    breaks: [],
  }
  const summaryWorkday: AttendanceWorkday = {
    id: "pg006-summary-workday",
    employeeId: fixture.actors.staff.employeeId,
    workDate: "2026-11-13",
    timeZone: "Asia/Manila",
    isWorkingDay: true,
    requiredMinutes: 480,
    workedMilliseconds: 8 * 60 * 60 * 1000,
    workedHours: 8,
    remainingMinutes: 0,
    excessMinutes: 0,
    excessRequiresReview: false,
    progressPercent: 100,
    status: "COMPLETE",
    isComplete: true,
    activeSessionId: null,
    activeBreakId: null,
    sessions: [summarySession],
    policy: {
      id: "pg006-summary-policy",
      name: "PG-006 scheduled policy",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: false,
    },
    schedule: {
      startsAt: "09:00",
      endsAt: "17:00",
      unpaidBreakMinutes: 30,
      lateArrivalMinutes: 15,
      earlyDepartureMinutes: 20,
    },
    overnightRequiresReview: false,
    pendingCorrections: 1,
  }
  const summaryHistory: AttendanceHistory = {
    asOf: summaryState.asOf,
    employeeId: fixture.actors.staff.employeeId,
    total: 1,
    page: 1,
    pageSize: 20,
    workdays: [summaryWorkday],
  }
  await summaryPage.route("**/api/attendance/me/current", (route) =>
    route.fulfill({ json: summaryState }),
  )
  await summaryPage.route("**/api/attendance/me/history**", (route) =>
    route.fulfill({ json: summaryHistory }),
  )
  await summaryPage.goto("/attendance/check-ins?pg006-summary=1")
  const summaryRow = summaryPage
    .getByRole("table", { name: "Attendance history" })
    .getByRole("row")
    .filter({ hasText: "2026-11-13" })
  await expect(summaryRow).toContainText("Nov 13, 2026, 8:00 PM")
  await expect(summaryRow).toContainText("Nov 14, 2026, 4:00 AM")
  await expect(summaryRow).toContainText("08:00:00 / 8h")
  await expect(summaryRow).toContainText("Complete")
  await expect(summaryRow).toContainText("Overnight")
  await expect(summaryRow).toContainText("Correction pending")
  await expect(summaryRow).toContainText("Late arrival")
  await expect(summaryRow).toContainText("Early departure")
  await summaryPage.close()

  await page.goto("/employees")
  await expect(page).toHaveURL(/\/module$/)
})

test("[PG-006-F001-A004-T009] the page continues the prior overnight workday and persists the added session", async ({
  page,
}) => {
  await clock("2026-12-07T20:00:00+08:00")
  const overnightActor = fixture.actors["pg006-overnight"]
  const overnightHeaders = {
    authorization: `Bearer ${overnightActor.token}`,
    "content-type": "application/json",
  }
  const started = await fetch(`${api}/api/attendance/me/clock-in`, {
    method: "POST",
    headers: overnightHeaders,
    body: "{}",
  })
  expect(started.status, await started.clone().text()).toBe(201)
  const startState = (await started.json()) as {
    workday: { id: string; activeSessionId: string }
  }
  const workdayId = startState.workday.id
  const firstSessionId = startState.workday.activeSessionId

  await clock("2026-12-08T04:00:00+08:00")
  const firstClockOut = await fetch(`${api}/api/attendance/me/clock-out`, {
    method: "POST",
    headers: overnightHeaders,
    body: JSON.stringify({ sessionId: firstSessionId }),
  })
  expect(firstClockOut.status, await firstClockOut.clone().text()).toBe(200)
  await clock("2026-12-08T04:30:00+08:00")

  await signIn(page, "pg006-overnight")
  await page.goto("/attendance/check-ins")
  const continueButton = page.getByRole("button", {
    name: "Continue 2026-12-07",
    exact: true,
  })
  await expect(continueButton).toBeVisible()
  await continueButton.click()
  const dialog = page.getByRole("dialog")
  const continuationRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/attendance/me/clock-in",
  )
  await dialog
    .getByRole("button", { name: "Continue overnight workday", exact: true })
    .click()
  const posted = await continuationRequest
  expect(
    JSON.parse(posted.postData() ?? "{}") as { workdayId?: string },
  ).toEqual({ workdayId })
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()

  await clock("2026-12-08T05:30:00+08:00")
  await confirm(page, "Clock out")
  const historyResponse = await fetch(
    `${api}/api/attendance/me/history?from=2026-12-07&to=2026-12-08`,
    { headers: { authorization: `Bearer ${overnightActor.token}` } },
  )
  expect(historyResponse.status).toBe(200)
  const history = (await historyResponse.json()) as {
    workdays: {
      id: string
      workDate: string
      requiredMinutes: number
      workedHours: number
      sessions: { id: string }[]
    }[]
  }
  expect(history.workdays).toEqual([
    expect.objectContaining({
      id: workdayId,
      workDate: "2026-12-07",
      requiredMinutes: 480,
      workedHours: 9,
      sessions: [
        expect.objectContaining({ id: firstSessionId }),
        expect.objectContaining({ id: expect.any(String) }),
      ],
    }),
  ])
})

test("unpaid break timer freezes and correction request uses the real API", async ({
  page,
}) => {
  await signIn(page, "staff")
  await clock("2026-11-14T09:00:00+08:00")
  await page.goto("/attendance/check-ins")
  await confirm(page, "Clock in")
  await clock("2026-11-14T10:00:00+08:00")
  await confirm(page, "Start break")
  await expect(page.getByText("On unpaid break", { exact: true })).toBeVisible()
  const elapsed = await page.getByLabel("Elapsed work").textContent()
  await clock("2026-11-14T11:00:00+08:00")
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByLabel("Elapsed work")).toHaveText(elapsed!)
  await expect(
    page.getByRole("button", { name: "Clock out", exact: true }),
  ).toBeEnabled()
  await confirm(page, "End break")
  await clock("2026-11-14T18:00:00+08:00")
  await confirm(page, "Start break")
  await clock("2026-11-14T19:00:00+08:00")
  await confirm(page, "Clock out")
  await expect(page.getByText("Clocked out", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "End break", exact: true }),
  ).toHaveCount(0)
  const response = await fetch(
    `${api}/api/attendance/me/history?from=2026-11-14&to=2026-11-14`,
    { headers: { Authorization: `Bearer ${fixture.actors.staff.token}` } },
  )
  const data = (await response.json()) as {
    workdays: { workedHours: number }[]
  }
  expect(data.workdays[0].workedHours).toBe(8)
  await page
    .getByRole("button", { name: "Request missing attendance", exact: true })
    .click()
  await page
    .getByLabel("Actual clock-in", { exact: true })
    .fill("2026-11-12T09:00")
  await page
    .getByLabel("Actual clock-out", { exact: true })
    .fill("2026-11-12T10:00")
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Missed clock-in while working on a service request")
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await signIn(page, "head")
  await page.goto("/attendance/adjustments")
  await expect(page.getByText("Pending", { exact: true })).toBeVisible()
})

test("[PG-004-F001-A006-T008] mixed queue submits and reloads a persisted correction", async ({
  page,
}) => {
  const reason = `PG-004 direct correction ${randomUUID()}`
  await clock("2026-11-17T12:00:00+08:00")
  await signIn(page, "staff")
  await page.goto("/attendance/adjustments")
  await page
    .getByRole("button", { name: "Request correction", exact: true })
    .click()
  const dialog = page.getByRole("dialog", {
    name: "Request missing attendance",
  })
  await dialog
    .getByLabel("Actual clock-in", { exact: true })
    .fill("2026-11-16T09:00")
  await dialog
    .getByLabel("Actual clock-out", { exact: true })
    .fill("2026-11-16T10:00")
  await dialog.getByLabel("Reason", { exact: true }).fill(reason)

  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/attendance/adjustments",
  )
  const refreshed = page
    .waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/attendance/adjustments" &&
        url.searchParams.get("scope") === "mine"
      )
    })
    .catch(() => undefined)
  await dialog
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  const createdResponse = await submitted
  const createdBody = await createdResponse.text()
  expect(createdResponse.status(), createdBody).toBe(201)
  const { adjustment: created } = JSON.parse(createdBody) as {
    adjustment: {
      id: string
      type: string
      status: string
      requestedById: string
      reason: string
    }
  }
  expect(created).toMatchObject({
    type: "CORRECTION",
    status: "PENDING",
    requestedById: fixture.actors.staff.userId,
    reason,
  })
  expect((await refreshed)?.status()).toBe(200)
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByText("Correction requested", { exact: true }),
  ).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: reason })
  await expect(row.getByText("Correction", { exact: true })).toBeVisible()
  await expect(row.getByText("Pending", { exact: true })).toBeVisible()

  const persisted = await overtimeFixtureCall(
    "staff",
    `${overtimeAdjustments}/${created.id}`,
  )
  expect(persisted.status, await persisted.clone().text()).toBe(200)
  expect(await persisted.json()).toMatchObject({
    adjustment: {
      id: created.id,
      type: "CORRECTION",
      status: "PENDING",
      requestedById: fixture.actors.staff.userId,
      reason,
    },
  })
})

test("[PG-004-F001-A009-T014] mixed queue finalizes and rejects corrections", async ({
  page,
}) => {
  await clock("2026-11-20T12:00:00+08:00")
  const approvedReason = `PG-004 HR approval ${randomUUID()}`
  const rejectedReason = `PG-004 HR rejection ${randomUUID()}`
  const approvedTimes = {
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T03:00:00.000Z",
  }
  const rejectedTimes = {
    startedAt: "2026-11-19T02:00:00.000Z",
    endedAt: "2026-11-19T03:00:00.000Z",
  }

  async function submitCorrection(reason: string, times: typeof approvedTimes) {
    const response = await overtimeFixtureCall(
      "staff",
      overtimeAdjustments,
      "POST",
      {
        type: "CORRECTION",
        requestKey: randomUUID(),
        ...times,
        reason,
      },
    )
    expect(response.status, await response.clone().text()).toBe(201)
    return ((await response.json()) as { adjustment: { id: string } })
      .adjustment.id
  }

  const approvedId = await submitCorrection(approvedReason, approvedTimes)
  const rejectedId = await submitCorrection(rejectedReason, rejectedTimes)
  const verification = await overtimeFixtureCall(
    "head",
    `${overtimeAdjustments}/${approvedId}/review`,
    "POST",
    {
      decision: "APPROVED",
      note: "Department Head verified this correction",
    },
  )
  expect(verification.status, await verification.clone().text()).toBe(200)
  expect(await verification.json()).toMatchObject({
    adjustment: { id: approvedId, status: "VERIFIED" },
  })
  const rejectedVerification = await overtimeFixtureCall(
    "head",
    `${overtimeAdjustments}/${rejectedId}/review`,
    "POST",
    {
      decision: "APPROVED",
      note: "Department Head verified the second correction",
    },
  )
  expect(
    rejectedVerification.status,
    await rejectedVerification.clone().text(),
  ).toBe(200)
  expect(await rejectedVerification.json()).toMatchObject({
    adjustment: { id: rejectedId, status: "VERIFIED" },
  })

  const rejectionHistoryBefore = await overtimeFixtureCall(
    "staff",
    "/attendance/me/history?from=2026-11-19&to=2026-11-19",
  )
  expect(rejectionHistoryBefore.status).toBe(200)
  const before = (await rejectionHistoryBefore.json()) as {
    workdays: { sessions: { startedAt: string; endedAt: string | null }[] }[]
  }

  await signIn(page, "admin")
  await page.goto("/attendance/adjustments")
  await expect(
    page.getByRole("row").filter({ hasText: approvedReason }),
  ).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: rejectedReason }),
  ).toBeVisible()

  const approvedMenu = overtimeRowMenu(page, approvedId)
  await approvedMenu.click()
  await page
    .getByRole("menuitem", { name: "Approve request", exact: true })
    .click()
  const approvalPanel = page.getByRole("dialog", {
    name: "Approve attendance correction",
  })
  await approvalPanel
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("HR approved the verified correction")
  const approvedResponse = overtimeResponse(
    page,
    "POST",
    `${overtimeAdjustments}/${approvedId}/review`,
  )
  await approvalPanel
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click()
  const approvalResult = await approvedResponse
  expect(approvalResult.status()).toBe(200)
  expect(await approvalResult.json()).toMatchObject({
    adjustment: { id: approvedId, status: "APPROVED" },
  })
  await expect(approvalPanel).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: approvedReason }),
  ).toContainText("Approved")

  const rejectedMenu = overtimeRowMenu(page, rejectedId)
  await rejectedMenu.click()
  await page
    .getByRole("menuitem", { name: "Reject request", exact: true })
    .click()
  const rejectionPanel = page.getByRole("dialog", {
    name: "Reject attendance correction",
  })
  await rejectionPanel
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("HR rejected the unsupported correction")
  const rejectedResponse = overtimeResponse(
    page,
    "POST",
    `${overtimeAdjustments}/${rejectedId}/review`,
  )
  await rejectionPanel
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click()
  const rejectionResult = await rejectedResponse
  expect(rejectionResult.status()).toBe(200)
  expect(await rejectionResult.json()).toMatchObject({
    adjustment: { id: rejectedId, status: "REJECTED" },
  })
  await expect(rejectionPanel).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: rejectedReason }),
  ).toContainText("Rejected")

  const [approvedDetail, rejectedDetail, approvedHistory, rejectedHistory] =
    await Promise.all([
      overtimeFixtureCall("staff", `${overtimeAdjustments}/${approvedId}`),
      overtimeFixtureCall("staff", `${overtimeAdjustments}/${rejectedId}`),
      overtimeFixtureCall(
        "staff",
        "/attendance/me/history?from=2026-11-18&to=2026-11-18",
      ),
      overtimeFixtureCall(
        "staff",
        "/attendance/me/history?from=2026-11-19&to=2026-11-19",
      ),
    ])
  for (const response of [
    approvedDetail,
    rejectedDetail,
    approvedHistory,
    rejectedHistory,
  ])
    expect(response.status, await response.clone().text()).toBe(200)
  expect(await approvedDetail.json()).toMatchObject({
    adjustment: { id: approvedId, status: "APPROVED" },
  })
  expect(await rejectedDetail.json()).toMatchObject({
    adjustment: { id: rejectedId, status: "REJECTED" },
  })
  const approved = (await approvedHistory.json()) as {
    workdays: { sessions: { startedAt: string; endedAt: string | null }[] }[]
  }
  const rejected = (await rejectedHistory.json()) as {
    workdays: { sessions: { startedAt: string; endedAt: string | null }[] }[]
  }
  expect(approved.workdays.flatMap(({ sessions }) => sessions)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        startedAt: approvedTimes.startedAt,
        endedAt: approvedTimes.endedAt,
      }),
    ]),
  )
  expect(rejected.workdays.flatMap(({ sessions }) => sessions)).toEqual(
    before.workdays.flatMap(({ sessions }) => sessions),
  )
})

test("department head reviews scoped requests and HR policy settings work", async ({
  page,
}) => {
  const requestReason = "Standalone head review fixture request"
  const requestResponse = await fetch(`${api}/api/attendance/adjustments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors.staff.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "CORRECTION",
      requestKey: randomUUID(),
      startedAt: "2026-11-10T02:00:00.000Z",
      endedAt: "2026-11-10T03:00:00.000Z",
      reason: requestReason,
    }),
  })
  expect(requestResponse.status).toBe(201)

  await signIn(page, "head")
  await page.goto("/attendance/adjustments")
  await expect(
    page.getByRole("heading", { name: "Requests & Approvals", exact: true }),
  ).toBeVisible()
  const requestRow = page.getByRole("row").filter({ hasText: requestReason })
  await requestRow
    .getByRole("button", { name: /More actions for .* request/ })
    .click()
  await page
    .getByRole("menuitem", { name: "Verify correction", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("Verified the service work with the department")
  await page
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click()
  await expect(page.getByText("Verified", { exact: true })).toBeVisible()
  await page.goto("/attendance/time-logs/records")
  await page
    .getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    })
    .click()
  await expect(
    page.getByRole("table", { name: "Attendance history" }),
  ).toBeVisible()
  await page
    .getByRole("main", { name: "Attendance workspace" })
    .getByRole("button", { name: "Employees", exact: true })
    .click()
  await page
    .getByRole("combobox", { name: "Attendance department", exact: true })
    .click()
  await page
    .getByRole("option", { name: "Attendance browser department", exact: true })
    .click()
  await expect(page.getByRole("table", { name: "Employees" })).toBeVisible()
})

test("time logs employee table preserves filters and opens individual or all logs", async ({
  page,
}) => {
  await signIn(page, "admin")
  await page.goto("/attendance/time-logs/records")
  const workspace = page.getByRole("main", { name: "Attendance workspace" })
  const table = page.getByRole("table", { name: "Employees", exact: true })
  await expect(table).toHaveAttribute("aria-busy", "false")
  await expect(
    page.getByRole("table", { name: "Attendance history" }),
  ).toHaveCount(0)
  const search = page.getByRole("searchbox", {
    name: "Search attendance employees",
  })
  await search.fill("No matching employee")
  await expect(table.getByText("No employees match your search.")).toBeVisible()
  await search.fill("BROWSER-staff")
  await expect(
    table.getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    }),
  ).toBeVisible()
  const individual = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/attendance/records" &&
      url.searchParams.get("employeeId") === fixture.actors.staff.employeeId &&
      response.status() === 200
    )
  })
  await table
    .getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    })
    .click()
  await individual
  await expect(
    page.getByRole("heading", {
      name: "Time Logs for Attendance staff",
      exact: true,
    }),
  ).toBeVisible()
  await expect(table).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await workspace
    .getByRole("button", { name: "Employees", exact: true })
    .click()
  await expect(search).toHaveValue("BROWSER-staff")
  const all = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/attendance/records" &&
      url.searchParams.get("employeeId") === "" &&
      response.status() === 200
    )
  })
  await page.getByRole("button", { name: "All logs", exact: true }).click()
  await all
  await expect(
    page.getByRole("heading", { name: "Time Log Records", exact: true }),
  ).toBeVisible()
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await assertNoPageOverflow(page)
    await workspace
      .getByRole("button", { name: "Employees", exact: true })
      .click()
    await expect(table).toBeVisible()
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath(`time-log-employees-${width}.png`),
      fullPage: true,
    })
    const individualReload = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/attendance/records" &&
        url.searchParams.get("employeeId") ===
          fixture.actors.staff.employeeId &&
        response.status() === 200
      )
    })
    await page
      .getByRole("button", {
        name: "View logs for Attendance staff",
        exact: true,
      })
      .click()
    await individualReload
    await expect(
      page.getByRole("table", { name: "Attendance history" }),
    ).toBeVisible()
    await assertNoPageOverflow(page)
  }
})

test("attendance employee search keeps a single pending state until results settle", async ({
  page,
}) => {
  await signIn(page, "admin")
  let releaseSearch!: () => void
  let notifySearchStarted!: () => void
  const searchStarted = new Promise<void>((resolve) => {
    notifySearchStarted = resolve
  })
  const pendingSearch = new Promise<void>((resolve) => {
    releaseSearch = resolve
  })
  await page.route("**/api/attendance/employees?**", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("search") ===
      "No matching employee"
    ) {
      notifySearchStarted()
      await pendingSearch
    }
    await route.fallback()
  })
  try {
    await page.goto("/attendance/time-logs/records")
    const table = page.getByRole("table", { name: "Employees", exact: true })
    await expect(
      table.getByRole("button", { name: "View logs for Attendance staff" }),
    ).toBeVisible()
    const search = page.getByRole("searchbox", {
      name: "Search attendance employees",
    })
    await search.fill("No matching employee")
    await searchStarted
    await expect(table).toHaveAttribute("aria-busy", "true")
    const searchSkeletons = table.getByRole("rowgroup").nth(1).getByRole("row")
    await expect(searchSkeletons).toHaveCount(10)
    for (const skeleton of await searchSkeletons.all())
      await expect(skeleton.getByRole("cell")).toHaveCount(4)
    await expect(table.getByRole("status")).toContainText("Loading employees…")
    await expect(
      table.getByRole("button", { name: "View logs for Attendance staff" }),
    ).toHaveCount(0)
    await expect(
      table.getByText("No employees match your search.", { exact: true }),
    ).toHaveCount(0)
    releaseSearch()
    await expect(table).toHaveAttribute("aria-busy", "false")
    await expect(
      table.getByText("No employees match your search.", { exact: true }),
    ).toBeVisible()
    await expect(table.getByRole("status")).toHaveCount(0)
  } finally {
    releaseSearch()
  }
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`real attendance layout at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await signIn(page, "staff")
    await page.goto("/attendance/check-ins")
    await expect(page.getByLabel("Elapsed work")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click()
      await expect(
        page
          .locator("#app-sidebar")
          .getByRole("link", { name: "Check-Ins", exact: true }),
      ).toBeVisible()
      await page
        .locator("#app-sidebar")
        .getByRole("button", { name: "Close navigation menu", exact: true })
        .click()
    } else {
      const collapse = page.getByRole("button", {
        name: "Collapse sidebar",
        exact: true,
      })
      if (await collapse.isVisible()) await collapse.click()
      await page
        .getByRole("button", { name: "Attendance", exact: true })
        .click()
      await expect(
        page.getByRole("menuitem", { name: "Check-Ins", exact: true }),
      ).toBeVisible()
      await page.keyboard.press("Escape")
    }
    await page.screenshot({
      path: test.info().outputPath(`attendance-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

test("Admin policy creation and assignment are live; clients remain denied", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
  await signIn(page, "admin")
  await page.goto("/attendance/policies/management")
  await page.getByRole("button", { name: "Create policy", exact: true }).click()
  await page
    .getByLabel("Policy name", { exact: true })
    .fill("Browser new policy")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const createdPolicyRow = page
    .getByRole("row")
    .filter({ hasText: "Browser new policy" })
  await expect(createdPolicyRow).toBeVisible()
  // PG-008-F001-A006-T001 adds row-projection checks to the existing
  // browser/API/PGlite create-and-assign workflow; C001 remains deferred.
  await expect(
    createdPolicyRow.getByText("Flexible", { exact: true }),
  ).toBeVisible()
  await expect(
    createdPolicyRow.getByRole("cell", { name: "Asia/Manila", exact: true }),
  ).toBeVisible()
  await expect(
    createdPolicyRow.getByRole("cell", { name: "0 hrs/week", exact: true }),
  ).toBeVisible()
  await expect(
    createdPolicyRow.getByRole("cell", { name: "0 assignments", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Assign policy to employee", exact: true })
    .click()
  await page
    .getByRole("checkbox", { name: "Select Attendance staff", exact: true })
    .check()
  await page
    .getByRole("combobox", { name: "Attendance policy", exact: true })
    .click()
  await page.getByRole("option", { name: /Browser new policy/ }).click()
  await page
    .getByRole("button", { name: "Effective from", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
    .click()
  await page.getByRole("button", { name: "Assign policy", exact: true }).click()
  await page
    .getByRole("button", { name: "Confirm assignment", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(
    createdPolicyRow.getByRole("cell", { name: "1 assignments", exact: true }),
  ).toBeVisible()
  const clientPage = await page.context().newPage()
  await signIn(clientPage, "client")
  await routeAttendanceApi(clientPage)
  await clientPage.goto("/attendance/check-ins")
  await expect(clientPage).toHaveURL(/\/dashboard$/)
  await clientPage.close()
})

test("Admin can create and inspect a fixed overnight schedule", async ({
  page,
}) => {
  await clock("2026-11-13T20:00:00+08:00")
  await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"))
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, "admin")
  await page.goto("/attendance/policies/management")
  await page.getByRole("button", { name: "Create policy", exact: true }).click()
  const editor = page.getByRole("dialog")
  await editor
    .getByLabel("Policy name", { exact: true })
    .fill("Browser fixed shift")
  await editor.getByRole("combobox", { name: "Schedule type" }).click()
  await page
    .getByRole("option", { name: "Fixed schedule", exact: true })
    .click()
  await editor.getByRole("checkbox", { name: "Monday", exact: true }).check()
  await expect(editor.getByLabel("Monday required hours")).toHaveCount(0)
  await editor.getByLabel("Monday start time").fill("22:00")
  await editor.getByLabel("Monday end time").fill("06:00")
  const unpaidBreaks = editor.getByRole("checkbox", {
    name: /Allow employees to record unpaid breaks/,
  })
  const breakMinutes = editor.getByLabel(
    "Monday scheduled unpaid break minutes",
  )
  await expect(unpaidBreaks.or(breakMinutes).first()).toHaveAccessibleName(
    /Allow employees to record unpaid breaks/,
  )
  await unpaidBreaks.uncheck()
  await expect(breakMinutes).toHaveCount(0)
  await unpaidBreaks.check()
  await breakMinutes.fill("30")
  await editor
    .getByRole("button", { name: "Create policy", exact: true })
    .click()
  await expect(editor).toHaveCount(0)
  const row = page.getByRole("row").filter({ hasText: "Browser fixed shift" })
  await expect(row.getByText("Fixed schedule", { exact: true })).toBeVisible()
  await expect(row.getByText(/7\.5 hrs\/week/)).toBeVisible()
  await row
    .getByRole("button", { name: "More actions for Browser fixed shift" })
    .click()
  await page.getByRole("menuitem", { name: "View policy details" }).click()
  const details = page.getByRole("dialog")
  await expect(details.getByText("22:00–06:00 (next day)")).toBeVisible()
  await expect(
    details.getByText("7.5 required hours · 30 min unpaid break"),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true)
  await details.getByRole("button", { name: "Done", exact: true }).click()
  await page
    .getByRole("button", {
      name: "More actions for Browser flexible policy",
      exact: true,
    })
    .click()
  await page.getByRole("menuitem", { name: "View policy details" }).click()
  await details.getByRole("tab", { name: "Assigned people" }).click()
  const head = details
    .getByRole("listitem")
    .filter({ hasText: "Attendance head" })
  await page.setViewportSize({ width: 1000, height: 844 })
  await expect(
    head.getByRole("button", { name: "Replace policy", exact: true }),
  ).toBeVisible()
  await expect(
    head.getByRole("button", { name: "End assignment", exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await head
    .getByRole("button", { name: "End assignment", exact: true })
    .click()
  const end = head.getByRole("alertdialog", {
    name: "End Attendance head’s assignment?",
  })
  await expect(
    end.getByText(/Coverage ends at the start of tomorrow in Asia\/Manila/),
  ).toBeVisible()
  const cancelEnd = end.getByRole("button", { name: "Cancel", exact: true })
  await expect(cancelEnd).toBeFocused()
  await cancelEnd.press("Escape")
  const endAssignment = head.getByRole("button", {
    name: "End assignment",
    exact: true,
  })
  await expect(end).toHaveCount(0)
  await expect(endAssignment).toBeFocused()
  const endRoute = "**/api/attendance/assignments/*/unassign"
  await page.route(endRoute, (route) =>
    route.fulfill({
      status: 409,
      json: { error: "Recorded attendance prevents ending this assignment." },
    }),
  )
  await endAssignment.click()
  const endRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/unassign"),
  )
  await end.getByRole("button", { name: "End assignment", exact: true }).click()
  expect((await endRequest).postDataJSON()).toEqual({
    expectedStatus: "CURRENT",
  })
  await expect(end.getByRole("alert")).toHaveText(
    "Recorded attendance prevents ending this assignment.",
  )
  await cancelEnd.click()
  await expect(end).toHaveCount(0)
  await page.unroute(endRoute)
  await head
    .getByRole("button", { name: "Replace policy", exact: true })
    .click()
  const replacement = page.getByRole("dialog", {
    name: "Replace attendance policy",
    exact: true,
  })
  await expect(
    replacement.getByText(
      /replace Browser flexible policy for Attendance head/,
    ),
  ).toBeVisible()
  await expect(
    replacement.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0)
  await replacement.getByRole("button", { name: "Back", exact: true }).click()
  await expect(
    details.getByRole("tab", { name: "Assigned people", selected: true }),
  ).toBeVisible()
  await head
    .getByRole("button", { name: "Replace policy", exact: true })
    .click()
  await replacement.getByRole("combobox", { name: "Attendance policy" }).click()
  await expect(
    page.getByRole("option", { name: /Browser flexible policy/ }),
  ).toHaveCount(0)
  await page.getByRole("option", { name: /Browser fixed shift/ }).click()
  await replacement.getByRole("button", { name: "Effective from" }).click()
  await page
    .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
    .click()
  await replacement
    .getByRole("button", { name: "Replace policy", exact: true })
    .click()
  const confirmation = page.getByRole("dialog", {
    name: "Replace attendance policy?",
    exact: true,
  })
  await expect(
    confirmation.getByText(/2026-11-16 at midnight in Asia\/Manila/),
  ).toBeVisible()
  await confirmation
    .getByRole("button", { name: "Confirm replacement" })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await row
    .getByRole("button", { name: "More actions for Browser fixed shift" })
    .click()
  await page.getByRole("menuitem", { name: "View policy details" }).click()
  await details.getByRole("tab", { name: "Assigned people" }).click()
  await expect(head.getByText("Scheduled", { exact: true })).toBeVisible()
  await head
    .getByRole("button", { name: "Cancel scheduled assignment", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Cancel scheduled assignment?" })
    .getByRole("button", { name: "Cancel scheduled assignment", exact: true })
    .click()
  await expect(
    details.getByText("No people assigned to this policy yet."),
  ).toBeVisible()
  await details.getByRole("button", { name: "Done", exact: true }).click()
  const directory = await fetch(`${api}/api/attendance/policies`, {
    headers: { authorization: `Bearer ${fixture.actors.admin.token}` },
  })
  const { policies } = (await directory.json()) as {
    policies: { id: string; name: string }[]
  }
  const policy = policies.find(({ name }) => name === "Browser fixed shift")
  expect(policy).toBeDefined()
  const path = `${api}/api/attendance/policies/${policy!.id}`
  const headers = { authorization: `Bearer ${fixture.actors.admin.token}` }
  expect((await fetch(`${path}/archive`, { method: "POST", headers })).ok).toBe(
    true,
  )
  expect((await fetch(path, { method: "DELETE", headers })).ok).toBe(true)
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`real HR policy context in workload at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
    const response = await fetch(`${api}/api/workload/capacity`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${fixture.actors.head.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employeeId: fixture.actors.staff.employeeId,
        week: "2026-11-09",
        scheduledHours: 40,
        timeOffHours: 8,
      }),
    })
    expect(response.status).toBe(200)
    await signIn(page, "head")
    await page.goto("/staff-workload")
    await expect(page.getByText("0 / 32 hrs", { exact: true })).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for Attendance staff",
        exact: true,
      })
      .click()
    await page
      .getByRole("menuitem", { name: "View workload", exact: true })
      .click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByText("56 hrs/week", { exact: true })).toBeVisible()
    await expect(drawer.getByText("32 hrs", { exact: true })).toBeVisible()
    await expect(drawer.getByText("Unknown", { exact: true })).toBeVisible()
    await expect(
      drawer
        .getByLabel("Daily policy requirements", { exact: true })
        .locator("dt"),
    ).toHaveCount(7)
    await expect(drawer).toContainText(
      "Clock-in status and attendance hours do not establish task availability or productivity.",
    )
    await expect(drawer).toContainText(
      "No known timed commitments from supported sources. Free time is unconfirmed.",
    )
    await expect
      .poll(async () => {
        const bounds = await drawer.boundingBox()
        return bounds ? bounds.x + bounds.width : Infinity
      })
      .toBeLessThanOrEqual(viewport.width + 1)
    expect((await drawer.boundingBox())!.x).toBeGreaterThanOrEqual(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`workload-hr-context-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

test("loaded attendance screens follow the Department Management design", async ({
  page,
}) => {
  const approvedReason = "Approved design fixture request"
  await createApprovedCorrection(
    "2026-11-11T02:00:00.000Z",
    "2026-11-11T03:00:00.000Z",
    approvedReason,
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signIn(page, "admin")
  await page.goto("/departments")
  await expect(
    page
      .getByRole("table")
      .getByText("Attendance browser department", { exact: true }),
  ).toBeVisible()
  const reference = await page.locator("main h1").evaluate((heading) => ({
    size: getComputedStyle(heading).fontSize,
    weight: getComputedStyle(heading).fontWeight,
  }))
  await page.screenshot({
    path: test.info().outputPath("reference-departments.png"),
    fullPage: true,
  })
  await page.goto("/employees")
  await expect(
    page.getByRole("table").getByText("Attendance staff", { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath("reference-employees.png"),
    fullPage: true,
  })
  for (const tab of ["overview", "my", "records", "adjustments", "settings"]) {
    await page.goto("/attendance/" + tab)
    if (tab === "overview")
      await expect(
        page.getByRole("heading", {
          name: "Personal attendance",
          exact: true,
        }),
      ).toBeVisible()
    if (tab === "my")
      await expect(page.getByLabel("Elapsed work")).toBeVisible()
    if (tab === "records")
      await expect(
        page.getByRole("table", { name: "Employees" }),
      ).toHaveAttribute("aria-busy", "false")
    if (tab === "adjustments")
      await expect(
        page
          .getByRole("table", { name: "Attendance requests" })
          .getByRole("row")
          .filter({ hasText: approvedReason })
          .getByText("Approved", { exact: true }),
      ).toBeVisible()
    if (tab === "settings")
      await expect(
        page.getByRole("row").filter({ hasText: "Browser flexible policy" }),
      ).toBeVisible()
    expect(
      await page.locator("main h1").evaluate((heading) => ({
        size: getComputedStyle(heading).fontSize,
        weight: getComputedStyle(heading).fontWeight,
      })),
    ).toEqual(reference)
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath("attendance-" + tab + ".png"),
      fullPage: true,
    })
  }
})

test("[PG-007-F001-A001-T002] overview route admits STAFF and ADMIN and redirects denied roles", async ({
  page,
}) => {
  await page.goto("/login")
  const cases = [
    { actor: "staff", pathname: "/attendance/overview", allowed: true },
    { actor: "admin", pathname: "/attendance/overview", allowed: true },
    { actor: "client", pathname: "/dashboard", allowed: false },
    { actor: "superadmin", pathname: "/module", allowed: false },
  ]
  for (const scenario of cases) {
    await setSession(page, scenario.actor)
    await page.goto("/attendance/overview")
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(scenario.pathname)
    const heading = page.getByRole("heading", {
      name: "Attendance Overview",
      exact: true,
    })
    if (scenario.allowed) await expect(heading).toBeVisible()
    else await expect(heading).toHaveCount(0)
  }
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`attendance overview summary layout at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page, "admin")
    await page.goto("/attendance/overview")
    const overview = page.locator('[aria-label="Attendance figures"]')
    await expect(overview).toHaveAttribute("aria-busy", "false")
    await expect(
      page.getByRole("heading", {
        name: "Check-in status",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "Recent check-in activity",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("combobox", {
        name: "Attendance department",
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("heading", {
        name: "Personal attendance",
        exact: true,
      }),
    ).toBeVisible()
    const main = page.getByRole("main", { name: "Attendance workspace" })
    await expect(main.getByText("Check-ins", { exact: true })).toBeVisible()
    await expect(main.getByText("Check-outs", { exact: true })).toBeVisible()
    await expect(
      main.getByRole("link", { name: "Open Check-Ins", exact: true }),
    ).toHaveAttribute("href", "/attendance/check-ins")
    await expect(
      main.getByText(
        /time logs|overtime|corrections|requests|polic|required hours|excess/i,
      ),
    ).toHaveCount(0)
    const refreshed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/attendance/me/overview" &&
        response.request().method() === "GET",
    )
    await main.getByRole("button", { name: "Refresh", exact: true }).click()
    // PG-007-F001-A004-T007 additive assertions; preserve the layout checks.
    const refreshResponse = await refreshed
    expect(refreshResponse.status()).toBe(200)
    const refreshUrl = new URL(refreshResponse.url())
    expect(refreshUrl.searchParams.get("from")).toBe(
      await main.getByLabel("Attendance from date").inputValue(),
    )
    expect(refreshUrl.searchParams.get("to")).toBe(
      await main.getByLabel("Attendance through date").inputValue(),
    )
    await expect(overview).toHaveAttribute("aria-busy", "false")
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath(`attendance-overview-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

test("[PG-007-F001-A013-T020] PGlite attendance renders through the real personal overview path", async ({
  page,
}) => {
  test.setTimeout(90000)
  const actor = fixture.actors["pg007-overview"]
  const headers = { authorization: `Bearer ${actor.token}` }
  const historyPath = "/api/attendance/me/history?from=2026-11-20&to=2026-11-20"
  async function readFixtureHistory() {
    const response = await fetch(`${api}${historyPath}`, { headers })
    expect(response.status, await response.clone().text()).toBe(200)
    return (await response.json()) as AttendanceHistory
  }

  try {
    const empty = await readFixtureHistory()
    expect(empty.workdays).toHaveLength(0)

    await clock("2026-11-20T09:00:00+08:00")
    const started = await fetch(`${api}/api/attendance/me/clock-in`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    })
    expect(started.status, await started.clone().text()).toBe(201)
    const state = (await started.json()) as AttendanceState
    const sessionId = state.workday?.activeSessionId
    expect(sessionId).toBeTruthy()
    if (!sessionId) throw new Error("Clock-in did not create an active session")

    await clock("2026-11-20T10:00:00+08:00")
    const closed = await fetch(`${api}/api/attendance/me/clock-out`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
    expect(closed.status, await closed.clone().text()).toBe(200)

    const beforeOverview = await readFixtureHistory()
    expect(beforeOverview.workdays).toHaveLength(1)
    const beforeDay = beforeOverview.workdays[0]
    if (!beforeDay) throw new Error("Expected the isolated workday")
    expect(beforeDay.workDate.slice(0, 10)).toBe("2026-11-20")
    expect(beforeDay.sessions).toHaveLength(1)
    const beforeSession = beforeDay.sessions[0]
    if (!beforeSession) throw new Error("Expected the isolated work session")
    expect(beforeSession.endedAt).toBeTruthy()
    const beforeDayIds = beforeOverview.workdays.map((day) => day.id)
    const beforeSessionIds = beforeOverview.workdays.flatMap((day) =>
      day.sessions.map((session) => session.id),
    )

    await page.clock.install({ time: new Date("2026-11-23T04:30:00.000Z") })
    await signIn(page, "pg007-overview")
    const overviewResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/attendance/me/overview" &&
        response.request().method() === "GET"
      )
    })
    await page.goto("/attendance/overview")
    const response = await overviewResponse
    expect(response.status()).toBe(200)
    const overviewUrl = new URL(response.url())
    expect(overviewUrl.searchParams.get("from")).toBe("2026-10-24")
    expect(overviewUrl.searchParams.get("to")).toBe("2026-11-24")

    const figures = page.getByLabel("Attendance figures")
    await expect(figures).toHaveAttribute("aria-busy", "false")
    const figureValue = (label: string) =>
      figures
        .getByText(label, { exact: true })
        .locator("xpath=following-sibling::dd[1]")
        .locator("span")
        .first()
    await expect(figureValue("Attendance days")).toHaveText("1")
    await expect(figureValue("Check-ins")).toHaveText("1")
    await expect(figureValue("Check-outs")).toHaveText("1")
    await expect(
      page.getByText("100% completed", { exact: true }),
    ).toBeVisible()
    await expect(figureValue("Still clocked in")).toHaveText("0")
    await expect(
      page
        .getByText("Sessions per day", { exact: true })
        .locator("xpath=following-sibling::dd[1]"),
    ).toHaveText("1.0")
    const statusTable = page.getByRole("table").filter({
      has: page.getByRole("columnheader", {
        name: "Share",
        exact: true,
      }),
    })
    await expect(
      statusTable.getByRole("img", {
        name: "Clocked out: 1 sessions",
        exact: true,
      }),
    ).toBeVisible()
    const activityTable = page.getByRole("table").filter({
      has: page.getByRole("columnheader", {
        name: "Timestamp (UTC)",
        exact: true,
      }),
    })
    const activityRows = activityTable.locator("tbody tr")
    await expect(activityRows).toHaveCount(2)
    await expect(activityRows.nth(0)).toContainText(
      "Clocked out – Attendance PG-007 overview",
    )
    await expect(activityRows.nth(0)).toContainText("Nov 20, 2026, 2:00 AM")
    await expect(activityRows.nth(1)).toContainText(
      "Clocked in – Attendance PG-007 overview",
    )
    await expect(activityRows.nth(1)).toContainText("Nov 20, 2026, 1:00 AM")

    const afterOverview = await readFixtureHistory()
    expect(afterOverview.workdays.map((day) => day.id)).toEqual(beforeDayIds)
    expect(
      afterOverview.workdays.flatMap((day) =>
        day.sessions.map((session) => session.id),
      ),
    ).toEqual(beforeSessionIds)
  } finally {
    await clock("2026-11-13T20:00:00+08:00")
  }
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(
    "attendance management layout and policy panels at " +
      viewport.width +
      "px",
    async ({ page }) => {
      const date =
        viewport.width === 390
          ? "2026-11-12T02:00:00.000Z"
          : viewport.width === 820
            ? "2026-11-12T04:00:00.000Z"
            : "2026-11-12T06:00:00.000Z"
      const endDate = new Date(Date.parse(date) + 60 * 60 * 1000).toISOString()
      const approvedReason = `Approved ${viewport.width}px fixture request`
      await createApprovedCorrection(date, endDate, approvedReason)
      await page.setViewportSize(viewport)
      await signIn(page, "admin")
      for (const tab of ["records", "adjustments", "settings"]) {
        await page.goto("/attendance/" + tab)
        await expect(page.getByRole("table")).toBeVisible()
        if (tab === "records")
          await expect(
            page
              .getByRole("table")
              .getByRole("cell")
              .filter({ hasText: "Attendance staff" })
              .first(),
          ).toBeVisible()
        if (tab === "adjustments")
          await expect(
            page
              .getByRole("table", { name: "Attendance requests" })
              .getByRole("row")
              .filter({ hasText: approvedReason })
              .getByText("Approved", { exact: true }),
          ).toBeVisible()
        if (tab === "settings")
          await expect(
            page
              .getByRole("row")
              .filter({ hasText: "Browser flexible policy" }),
          ).toBeVisible()
        await assertNoPageOverflow(page)
        await page.screenshot({
          path: test.info().outputPath(tab + "-" + viewport.width + ".png"),
          fullPage: true,
        })
      }
      const policyRow = page
        .getByRole("row")
        .filter({ hasText: "Browser flexible policy" })
      await policyRow
        .getByRole("button", {
          name: "More actions for Browser flexible policy",
          exact: true,
        })
        .click()
      await page
        .getByRole("menuitem", { name: "View policy details", exact: true })
        .click()
      const detailsPanel = page.getByRole("dialog")
      await expect(
        detailsPanel.getByRole("heading", {
          name: "Browser flexible policy",
          exact: true,
        }),
      ).toBeVisible()
      await detailsPanel
        .getByRole("tab", { name: "Assigned people", exact: true })
        .click()
      await expect(
        detailsPanel.getByText("Attendance staff", { exact: true }),
      ).toBeVisible()
      await expect(
        detailsPanel.getByText("BROWSER-staff", { exact: false }),
      ).toBeVisible()
      await assertNoPageOverflow(page)
      await detailsPanel.screenshot({
        path: test.info().outputPath(`policy-people-${viewport.width}.png`),
      })
      const peopleWidth = await detailsPanel
        .getByRole("tabpanel")
        .evaluate((element) => ({
          content: element.scrollWidth,
          available: element.clientWidth,
        }))
      expect(peopleWidth.content).toBeLessThanOrEqual(peopleWidth.available + 1)
      await detailsPanel
        .getByRole("tab", { name: "Overview", exact: true })
        .click()
      await expect(
        detailsPanel.getByRole("heading", {
          name: "Policy rules",
          exact: true,
        }),
      ).toBeVisible()
      await detailsPanel
        .getByRole("button", { name: "Done", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page
        .getByRole("button", { name: "Create policy", exact: true })
        .click()
      const dialog = page.getByRole("dialog")
      await expect(
        dialog.getByRole("heading", {
          name: "Create attendance policy",
          exact: true,
        }),
      ).toBeVisible()
      await expect
        .poll(async () => {
          const bounds = await dialog.boundingBox()
          return bounds ? bounds.x + bounds.width : Infinity
        })
        .toBeLessThanOrEqual(viewport.width + 1)
      await dialog
        .getByRole("button", { name: "Create policy", exact: true })
        .click()
      await expect(
        page.getByLabel("Policy name", { exact: true }),
      ).toHaveAttribute("aria-invalid", "true")
      await dialog
        .getByLabel("Policy name", { exact: true })
        .fill("Draft policy")
      await page.screenshot({
        path: test.info().outputPath("policy-panel-" + viewport.width + ".png"),
        fullPage: true,
      })
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page
        .getByRole("row")
        .filter({ hasText: "Browser flexible policy" })
        .getByRole("button", {
          name: "More actions for Browser flexible policy",
          exact: true,
        })
        .click()
      await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
      await expect(
        page.getByRole("heading", {
          name: "Edit attendance policy",
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByLabel("Policy name", { exact: true })).toHaveValue(
        "Browser flexible policy",
      )
      await expect(
        page.getByLabel("Attendance timezone", { exact: true }),
      ).toHaveValue("Asia/Manila")
      // PG-008-F001-A013-T001: assigned-policy timezone remains read-only.
      await expect(
        page.getByLabel("Attendance timezone", { exact: true }),
      ).toHaveAttribute("readonly", "")
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page
        .getByRole("button", { name: "Assign policy to employee", exact: true })
        .click()
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Assign policy", exact: true }),
      ).toBeDisabled()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
    },
  )
}

test("policy editing updates the existing row and archive/restore/delete reuse the directory actions", async ({
  page,
}) => {
  await signIn(page, "admin")
  await page.goto("/attendance/policies/management")
  await page.getByRole("button", { name: "Create policy", exact: true }).click()
  await page.getByLabel("Policy name", { exact: true }).fill("Lifecycle policy")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const original = page.getByRole("row").filter({ hasText: "Lifecycle policy" })
  const originalId = await original
    .getByRole("button", {
      name: "More actions for Lifecycle policy",
      exact: true,
    })
    .getAttribute("id")
  await original
    .getByRole("button", {
      name: "More actions for Lifecycle policy",
      exact: true,
    })
    .click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  await expect(page.getByLabel("Policy name", { exact: true })).toHaveValue(
    "Lifecycle policy",
  )
  await page
    .getByLabel("Policy name", { exact: true })
    .fill("Updated lifecycle policy")
  await page.getByRole("checkbox", { name: "Monday", exact: true }).check()
  await page.getByLabel("Monday required hours", { exact: true }).fill("6")
  await page.getByRole("button", { name: "Save policy", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const updated = page
    .getByRole("row")
    .filter({ hasText: "Updated lifecycle policy" })
  await expect(updated).toContainText("6 hrs/week")
  await expect(
    updated.getByRole("button", {
      name: "More actions for Updated lifecycle policy",
      exact: true,
    }),
  ).toHaveAttribute("id", originalId!)
  await expect(
    page.getByRole("button", {
      name: "More actions for Lifecycle policy",
      exact: true,
    }),
  ).toHaveCount(0)
  async function action(label: string) {
    await page
      .getByRole("button", {
        name: "More actions for Updated lifecycle policy",
        exact: true,
      })
      .click()
    await page.getByRole("menuitem", { name: label, exact: true }).click()
  }
  async function status(label: string) {
    await page
      .getByRole("group", { name: "Policy view", exact: true })
      .getByRole("button", { name: label, exact: true })
      .click()
  }
  await action("Archive")
  await page
    .getByRole("button", { name: "Archive policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(updated).toHaveCount(0)
  await status("Archived policies")
  await expect(updated).toBeVisible()
  await action("Restore")
  await page
    .getByRole("button", { name: "Restore policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(updated).toHaveCount(0)
  await status("Active policies")
  await expect(updated).toBeVisible()
  await action("Archive")
  await page
    .getByRole("button", { name: "Archive policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await status("Archived policies")
  await action("Delete permanently")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(updated).toHaveCount(0)
})

for (const width of [390, 820, 1440]) {
  test(
    "grouped attendance pages use live scoped data at " + width + "px",
    async ({ page }) => {
      test.setTimeout(90000)
      await page.setViewportSize({ width, height: 1000 })
      await signIn(page, "admin")
      const pages = [
        ["overview", "Attendance Overview", "/api/attendance/me/overview"],
        ["my", "Check-Ins", "/api/attendance/me/current"],
        [
          "time-logs/overview",
          "Time Logs Overview",
          "/api/attendance/overview",
        ],
        ["records", "Time Log Records", "/api/attendance/employees"],
        ["audit", "Attendance Audit Trail", "/api/attendance/audit"],
        [
          "requests/overview",
          "Requests & Approvals Overview",
          "/api/attendance/adjustments/overview",
        ],
        ["requests/overtime", "Overtime", "/api/attendance/adjustments"],
        [
          "requests/corrections",
          "Attendance Corrections",
          "/api/attendance/adjustments",
        ],
        ["policies/overview", "Policies Overview", "/api/attendance/policies"],
        ["settings", "Policy Management", "/api/attendance/policies"],
      ]
      for (const [path, title, endpoint] of pages) {
        let myWorkDate: string | null = null
        let myWorkdayId: string | null = null
        if (path === "my") {
          myWorkDate =
            width === 390
              ? "2026-11-20"
              : width === 820
                ? "2026-11-21"
                : "2026-11-22"
          const adminHeaders = {
            authorization: `Bearer ${fixture.actors.admin.token}`,
            "content-type": "application/json",
          }
          await clock(`${myWorkDate}T09:00:00+08:00`)
          const started = await fetch(`${api}/api/attendance/me/clock-in`, {
            method: "POST",
            headers: adminHeaders,
            body: "{}",
          })
          expect(started.status, await started.clone().text()).toBe(201)
          const startState = (await started.json()) as {
            workday: { id: string; activeSessionId: string | null }
          }
          myWorkdayId = startState.workday.id
          expect(startState.workday.activeSessionId).toBeTruthy()
          await clock(`${myWorkDate}T10:00:00+08:00`)
          const ended = await fetch(`${api}/api/attendance/me/clock-out`, {
            method: "POST",
            headers: adminHeaders,
            body: JSON.stringify({
              sessionId: startState.workday.activeSessionId,
            }),
          })
          expect(ended.status, await ended.clone().text()).toBe(200)
        }
        const read = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === endpoint &&
            response.request().method() === "GET",
        )
        await page.goto("/attendance/" + path)
        expect((await read).status()).toBe(200)
        await expect(
          page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Retry", exact: true }),
        ).toHaveCount(0)
        if (path === "time-logs/overview") {
          const main = page.getByRole("main", { name: "Attendance workspace" })
          for (const title of ["Recorded session status", "Coverage"])
            await expect(
              main.getByRole("heading", { name: title, exact: true }),
            ).toBeVisible()
          await expect(
            main.getByRole("link", { name: "View records", exact: true }),
          ).toHaveAttribute("href", "/attendance/time-logs/records")
          await expect(
            main.getByRole("link", { name: "Open audit trail", exact: true }),
          ).toHaveCount(0)
        }
        if (
          [
            "overview",
            "time-logs/overview",
            "requests/overview",
            "policies/overview",
          ].includes(path)
        ) {
          const kpis = page
            .getByRole("main", { name: "Attendance workspace" })
            .locator("dl[aria-busy]")
          await expect(kpis).toHaveCount(1)
          await expect(kpis).toHaveAttribute("aria-busy", "false")
          const cards = kpis.getByRole("term")
          await expect(cards).toHaveCount(4)
          const columns = await kpis.evaluate(
            (element) =>
              getComputedStyle(element).gridTemplateColumns.split(" ").length,
          )
          expect(columns).toBe(4)
        }
        await assertNoPageOverflow(page)
        if (path === "my") {
          // PG-006-F001-A011-T024 adds Check-Ins control and dialog usability
          // assertions to the existing 390/820/1440 px attendance matrix.
          await expect(page.getByLabel("Attendance from date")).toBeVisible()
          await expect(page.getByLabel("Attendance through date")).toBeVisible()
          if (!myWorkDate) throw new Error("Check-Ins workday date was not set")
          const workDate = myWorkDate
          await page.getByLabel("Attendance from date").fill(workDate)
          await page.getByLabel("Attendance through date").fill(workDate)
          const history = page
            .getByRole("table", {
              name: "Attendance history",
            })
            .last()
          const dayRow = history.getByRole("row").filter({ hasText: workDate })
          await expect(dayRow).toBeVisible()
          if (!myWorkdayId) throw new Error("Check-Ins workday was not seeded")
          const rowActions = page
            .locator(`[id="attendance-history-actions-${myWorkdayId}"]`)
            .last()
          await rowActions.click()
          await expect(rowActions).toHaveAttribute("aria-expanded", "true")
          const viewDetails = page.getByRole("menuitem", {
            name: "View details",
            exact: true,
          })
          await expect(viewDetails).toBeVisible()
          await viewDetails.click()
          const detailTitle = page.getByText(
            `Attendance details for ${workDate}`,
            { exact: true },
          )
          await expect(detailTitle).toBeVisible()
          await page.getByRole("button", { name: "Done", exact: true }).click()
          await expect(detailTitle).toHaveCount(0)
          const clockIn = page.getByRole("button", {
            name: "Clock in",
            exact: true,
          })
          await expect(clockIn).toBeEnabled()
          await clockIn.click()
          const clockDialog = page.getByRole("dialog", { name: "Clock in" })
          await expect(clockDialog).toBeVisible()
          await clockDialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click()
          await expect(clockDialog).toHaveCount(0)
          const missingAttendance = page.getByRole("button", {
            name: "Request missing attendance",
            exact: true,
          })
          await expect(missingAttendance).toBeVisible()
          await missingAttendance.click()
          const correctionDialog = page.getByRole("dialog")
          await expect(
            correctionDialog.getByLabel("Actual clock-in", { exact: true }),
          ).toBeVisible()
          await expect(
            correctionDialog.getByLabel("Actual clock-out", { exact: true }),
          ).toBeVisible()
          await correctionDialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click()
          await expect(correctionDialog).toHaveCount(0)
          await assertNoPageOverflow(page)
        }
        if (path === "requests/overtime" || path === "requests/corrections") {
          await expect(
            page.getByRole("table", { name: "Attendance requests" }),
          ).toHaveAttribute("aria-busy", "false")
          const filtered = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === endpoint &&
              new URL(response.url()).searchParams.get("status") === "APPROVED",
          )
          await page
            .getByRole("combobox", { name: "Request status filter" })
            .click()
          await page
            .getByRole("option", { name: "Approved", exact: true })
            .click()
          const response = await filtered
          const body = (await response.json()) as {
            adjustments: { type: string; status: string }[]
          }
          expect(
            body.adjustments.every(
              (row) =>
                row.status === "APPROVED" &&
                row.type ===
                  (path.endsWith("overtime") ? "OVERTIME" : "CORRECTION"),
            ),
          ).toBe(true)
        }
        if (path === "audit") {
          await page
            .getByRole("button", { name: /View audit event/ })
            .first()
            .click()
          await expect(
            page.getByRole("heading", {
              name: "Audit event details",
              exact: true,
            }),
          ).toBeVisible()
          await expect(
            page.getByRole("heading", { name: "Change details", exact: true }),
          ).toBeVisible()
          await page.getByRole("button", { name: "Done", exact: true }).click()
          await expect(
            page.getByRole("heading", {
              name: "Audit event details",
              exact: true,
            }),
          ).toHaveCount(0)
        }
        await page.screenshot({
          path: test
            .info()
            .outputPath(path.replaceAll("/", "-") + "-" + width + ".png"),
          fullPage: true,
        })
      }
      if (width < 768)
        await page.getByRole("button", { name: "Open navigation menu" }).click()
      const menu = page.getByRole("navigation", {
        name: "Main menu",
        exact: true,
      })
      for (const name of [
        "Attendance",
        "Time Logs",
        "Requests & Approvals",
        "Policies",
      ])
        await expect(
          menu.getByRole("button", { name, exact: true }),
        ).toBeVisible()
      if (width >= 768) {
        const expand = page.getByRole("button", {
          name: "Expand sidebar",
          exact: true,
        })
        if (await expand.isVisible()) await expand.click()
      }
      await menu.getByRole("button", { name: "Time Logs", exact: true }).click()
      await expect(
        menu.getByRole("link", { name: "Time Logs Overview", exact: true }),
      ).toBeVisible()
      await menu
        .getByRole("link", { name: "Time Logs Overview", exact: true })
        .click()
      await expect(page).toHaveURL(/attendance\/time-logs\/overview$/)
      if (width < 768)
        await expect(page.locator("#app-sidebar")).toHaveAttribute(
          "data-drawer-open",
          "false",
        )
      else {
        await page
          .getByRole("button", { name: "Collapse sidebar", exact: true })
          .click()
        await page
          .getByRole("button", { name: "Policies", exact: true })
          .click()
        await expect(
          page.getByRole("menuitem", { name: "Assignments", exact: true }),
        ).toHaveCount(0)
      }
    },
  )
}

test("grouped attendance routes enforce staff and department-head boundaries", async ({
  page,
}) => {
  await signIn(page, "staff")
  for (const path of [
    "time-logs/overview",
    "records",
    "audit",
    "policies/overview",
    "settings",
  ]) {
    await page.goto("/attendance/" + path)
    await expect(page).toHaveURL(/\/module$/)
  }
  for (const [path, title] of [
    ["requests/overview", "Requests & Approvals Overview"],
    ["requests/overtime", "Overtime"],
    ["requests/corrections", "Attendance Corrections"],
  ]) {
    await page.goto("/attendance/" + path)
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("group", { name: /Request.*view/ }),
    ).toHaveCount(0)
  }
  const headPage = await page.context().newPage()
  await signIn(headPage, "head")
  await routeAttendanceApi(headPage)
  await headPage.goto("/attendance/time-logs/overview")
  await expect(
    headPage.getByRole("heading", { name: "Time Logs Overview", exact: true }),
  ).toBeVisible()
  await headPage.goto("/attendance/policies/assignments")
  await expect(headPage).toHaveURL(/\/module$/)
  await headPage.close()
})

test("time log overview preserves available figures during partial failures and retries", async ({
  page,
}) => {
  await signIn(page, "admin")
  for (const failed of ["departments", "overview"]) {
    const pattern = `**/api/attendance/${failed}*`
    await page.route(pattern, (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Summary temporarily unavailable." },
      }),
    )
    const available = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/attendance/${failed === "departments" ? "overview" : "departments"}`,
    )
    await page.goto("/attendance/time-logs/overview")
    const response = await available
    expect(response.status()).toBe(200)
    const main = page.getByRole("main", { name: "Attendance workspace" })
    const figures = main.getByLabel("Time log figures")
    await expect(figures).toHaveAttribute("aria-busy", "false")
    await expect(
      main.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible()
    if (failed === "departments") {
      const data = await response.json()
      await expect(
        figures
          .locator(":scope > div")
          .filter({ has: page.getByText("Check-ins", { exact: true }) })
          .getByRole("definition"),
      ).toHaveText(String(data.checkIns.total))
    } else {
      await expect(
        figures.getByRole("definition").filter({ hasText: "—" }),
      ).toHaveCount(4)
      await expect(
        main.getByRole("combobox", { name: "Time logs department" }),
      ).toBeEnabled()
    }
    await page.unroute(pattern)
    await main.getByRole("button", { name: "Retry", exact: true }).click()
    await expect(
      main.getByRole("button", { name: "Retry", exact: true }),
    ).toHaveCount(0)
    await expect(figures).toHaveAttribute("aria-busy", "false")
    await expect(
      figures.getByRole("definition").filter({ hasText: "—" }),
    ).toHaveCount(0)
    await assertNoPageOverflow(page)
  }
})

test("attendance audit search stays in sync with pagination and keeps rows during refresh", async ({
  page,
}) => {
  await signIn(page, "admin")
  const queries: string[] = []
  let releaseInitial!: () => void
  let notifyInitialRequest!: () => void
  let initialRequestPending = true
  const initialRequested = new Promise<void>((resolve) => {
    notifyInitialRequest = resolve
  })
  const pendingInitialResponse = new Promise<void>((resolve) => {
    releaseInitial = resolve
  })
  let releaseSearch!: () => void
  let notifySearchStarted!: () => void
  let failRetry = true
  const searchStarted = new Promise<void>((resolve) => {
    notifySearchStarted = resolve
  })
  const pendingSearch = new Promise<void>((resolve) => {
    releaseSearch = resolve
  })
  await page.route("**/api/attendance/audit?**", async (route) => {
    const url = new URL(route.request().url())
    queries.push(url.search)
    if (initialRequestPending) {
      initialRequestPending = false
      notifyInitialRequest()
      await pendingInitialResponse
    }
    const search = url.searchParams.get("search") ?? ""
    if (search === "payroll") {
      notifySearchStarted()
      await pendingSearch
    }
    if (search === "retry" && failRetry) {
      failRetry = false
      return route.fulfill({
        status: 503,
        json: { error: "Audit temporarily unavailable." },
      })
    }
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const events =
      search === "no-match"
        ? []
        : search
          ? [auditEvent(search === "latest" ? "latest-match" : "payroll-match")]
          : Array.from({ length: 10 }, (_, index) =>
              auditEvent(`event-${(pageNumber - 1) * 10 + index + 1}`),
            )
    return route.fulfill({
      json: {
        asOf: "2026-11-15T00:00:00.000Z",
        total: search === "no-match" ? 0 : search ? 1 : 21,
        page: pageNumber,
        pageSize: 10,
        events,
        actionCounts:
          search === "no-match"
            ? []
            : [{ action: "UPDATE", count: search ? 1 : 21 }],
      },
    })
  })
  const navigation = page.goto("/attendance/audit")
  await initialRequested
  const table = page.getByRole("table", { name: "Attendance audit events" })
  try {
    // PG-005-F001-A006-T008: the initial request shows five skeleton rows.
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(table.getByRole("status")).toContainText(
      "Loading audit events",
    )
    await expect(table.getByRole("row")).toHaveCount(6)
  } finally {
    releaseInitial()
  }
  await navigation
  await expect(table.getByText("event-1", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(table.getByText("event-11", { exact: true })).toBeVisible()

  const search = page.getByRole("searchbox", { name: "Search audit events" })
  await search.fill("payroll")
  await searchStarted
  await expect(table).toHaveAttribute("aria-busy", "true")
  await expect(table.getByText("event-11", { exact: true })).toBeVisible()
  expect(queries.at(-1)).toContain("page=1")
  expect(queries.at(-1)).toContain("search=payroll")
  await search.fill("latest")
  await expect(table.getByText("latest-match", { exact: true })).toBeVisible()
  releaseSearch()
  await expect(table.getByText("latest-match", { exact: true })).toBeVisible()
  await expect(table.getByText("payroll-match", { exact: true })).toHaveCount(0)

  await search.fill("")
  await expect(table.getByText("event-1", { exact: true })).toBeVisible()
  expect(queries.at(-1)).toContain("page=1")
  expect(queries.at(-1)).not.toContain("search=")

  await search.fill("no-match")
  await expect(table.getByRole("status")).toContainText("No results for")
  await expect(table.getByRole("status")).toContainText("no-match")

  await search.fill("retry")
  await expect(table.getByRole("alert")).toContainText(
    "Audit temporarily unavailable.",
  )
  await table.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(table.getByText("payroll-match", { exact: true })).toBeVisible()
})

function auditEvent(
  id: string,
  overrides: Partial<AttendanceAuditEvent> = {},
): AttendanceAuditEvent {
  return {
    id,
    entityType: "AttendanceWorkday",
    action: "UPDATE",
    reason: "",
    createdAt: "2026-11-13T08:00:00.000Z",
    actorId: "actor-1",
    actor: { fullName: "Audit Actor" },
    employee: { fullName: id },
    before: null,
    after: null,
    ...overrides,
  }
}

function auditPayload(
  events: AttendanceAuditEvent[],
  page: number,
  total: number,
) {
  return {
    asOf: "2026-11-15T00:00:00.000Z",
    total,
    page,
    pageSize: 10,
    events,
    actionCounts: [],
  }
}

test("[PG-005-F001-A002-T003] department filter resets pagination and reaches audit API", async ({
  page,
}) => {
  await signIn(page, "admin")
  const auditQueries: URL[] = []
  await page.route("**/api/attendance/departments", (route) =>
    route.fulfill({
      json: {
        departments: [
          { id: "dept-engineering", name: "Engineering" },
          { id: "dept-finance", name: "Finance" },
        ],
      },
    }),
  )
  await page.route("**/api/attendance/audit?**", async (route) => {
    const url = new URL(route.request().url())
    auditQueries.push(url)
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const departmentId = url.searchParams.get("departmentId")
    if (departmentId === "dept-finance")
      return route.fulfill({
        json: auditPayload(
          [
            auditEvent("finance-event", {
              employee: { fullName: "Finance Employee" },
            }),
          ],
          pageNumber,
          1,
        ),
      })
    const events = Array.from({ length: 10 }, (_, index) =>
      auditEvent("audit-event-" + ((pageNumber - 1) * 10 + index + 1)),
    )
    return route.fulfill({ json: auditPayload(events, pageNumber, 20) })
  })

  await page.goto("/attendance/audit")
  const table = page.getByRole("table", { name: "Attendance audit events" })
  await expect(table.getByText("audit-event-1", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(table.getByText("audit-event-11", { exact: true })).toBeVisible()

  await page.getByRole("combobox", { name: "Audit department" }).click()
  await page.getByRole("option", { name: "Finance", exact: true }).click()
  await expect(
    table.getByText("Finance Employee", { exact: true }),
  ).toBeVisible()
  await expect
    .poll(() => {
      const latest = auditQueries.at(-1)
      return latest
        ? [
            latest.searchParams.get("page"),
            latest.searchParams.get("departmentId"),
          ].join(":")
        : ""
    })
    .toBe("1:dept-finance")
})

test("[PG-005-F001-A004-T005] date controls submit the UTC range and reset pagination", async ({
  page,
}) => {
  await signIn(page, "admin")
  const auditQueries: URL[] = []
  await page.route("**/api/attendance/departments", (route) =>
    route.fulfill({ json: { departments: [] } }),
  )
  await page.route("**/api/attendance/audit?**", async (route) => {
    const url = new URL(route.request().url())
    auditQueries.push(url)
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    return route.fulfill({
      json: auditPayload(
        [auditEvent("audit-page-" + pageNumber)],
        pageNumber,
        20,
      ),
    })
  })

  await page.goto("/attendance/audit")
  const table = page.getByRole("table", { name: "Attendance audit events" })
  await expect(table.getByText("audit-page-1", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(table.getByText("audit-page-2", { exact: true })).toBeVisible()

  const from = page.getByLabel("Attendance from date")
  const through = page.getByLabel("Attendance through date")
  await from.fill("2026-11-12")
  await through.fill("2026-11-13")
  await expect(through).toHaveAttribute("min", "2026-11-12")
  await expect(from).toHaveAttribute("max", "2026-11-13")
  await expect
    .poll(() => {
      const latest = auditQueries.at(-1)
      return latest
        ? [
            latest.searchParams.get("from"),
            latest.searchParams.get("to"),
            latest.searchParams.get("page"),
          ].join(":")
        : ""
    })
    .toBe("2026-11-12:2026-11-13:1")
  await expect(table.getByText("audit-page-1", { exact: true })).toBeVisible()
  await expect(
    page.getByText(/Dates filter the event timestamp in UTC/),
  ).toBeVisible()
})

test("[PG-005-F001-A002-T009] department choices recover through their retry control", async ({
  page,
}) => {
  await signIn(page, "admin")
  let departmentRequests = 0
  await page.route("**/api/attendance/departments", async (route) => {
    departmentRequests += 1
    if (departmentRequests === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Department choices unavailable." },
      })
    return route.fulfill({
      json: { departments: [{ id: "dept-operations", name: "Operations" }] },
    })
  })
  await page.route("**/api/attendance/audit?**", (route) =>
    route.fulfill({ json: auditPayload([], 1, 0) }),
  )

  await page.goto("/attendance/audit")
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Department choices unavailable." })
  await expect(alert).toContainText("Department choices unavailable.")
  await alert.getByRole("button", { name: "Retry", exact: true }).click()
  await expect.poll(() => departmentRequests).toBe(2)
  const department = page.getByRole("combobox", {
    name: "Audit department",
  })
  await department.click()
  await expect(
    page.getByRole("option", { name: "Operations", exact: true }),
  ).toBeVisible()
})

test.describe("PG-005 audit row summaries in explicit UTC", () => {
  test.use({ timezoneId: "Pacific/Auckland" })

  test("[PG-005-F001-A007-T011] row labels include UTC time and identity fallbacks", async ({
    page,
  }) => {
    await signIn(page, "admin")
    await page.route("**/api/attendance/departments", (route) =>
      route.fulfill({ json: { departments: [] } }),
    )
    await page.route("**/api/attendance/audit?**", (route) =>
      route.fulfill({
        json: auditPayload(
          [
            auditEvent("named-event", {
              createdAt: "2026-11-13T23:30:00.000Z",
              actor: { fullName: "Audit Actor" },
              employee: { fullName: "Audit Employee" },
            }),
            auditEvent("missing-identity", {
              actorId: "missing-actor",
              actor: { fullName: "  " },
              employee: null,
            }),
            auditEvent("policy-event", {
              entityType: "AttendancePolicy",
              action: "INSERT",
              actorId: null,
              actor: null,
              employee: null,
            }),
            auditEvent("unknown-event", {
              entityType: "UnknownRecordType",
              action: "CUSTOM_ACTION",
              actorId: null,
              actor: null,
              employee: null,
            }),
          ],
          1,
          4,
        ),
      }),
    )

    await page.goto("/attendance/audit")
    const table = page.getByRole("table", {
      name: "Attendance audit events",
    })
    await expect(
      table.getByText("Nov 13, 2026, 11:30 PM", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Nov 14, 2026, 12:30 PM", { exact: true }),
    ).toHaveCount(0)
    await expect(table.getByText("Audit Actor", { exact: true })).toBeVisible()
    await expect(
      table.getByText("Audit Employee", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Name unavailable", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("No actor recorded", { exact: true }),
    ).toHaveCount(2)
    await expect(
      table.getByText("Not applicable (policy change)", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Employee unavailable", { exact: true }),
    ).toHaveCount(2)
    await expect(
      table.getByText("Created an attendance policy", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Custom action an unknown record type", {
        exact: true,
      }),
    ).toBeVisible()
  })
})

test("[PG-005-F001-A008-T012] detail panel renders allowlisted snapshots read-only", async ({
  page,
}) => {
  await signIn(page, "admin")
  await page.route("**/api/attendance/departments", (route) =>
    route.fulfill({ json: { departments: [] } }),
  )
  await page.route("**/api/attendance/audit?**", (route) =>
    route.fulfill({
      json: auditPayload(
        [
          auditEvent("event-details", {
            entityType: "AttendanceAdjustment",
            action: "UPDATE",
            reason: "Approved overtime",
            before: {
              status: "PENDING",
              reviewNote: "Old review note",
              proposedStartedAt: "2026-11-13T22:00:00.000Z",
            },
            after: {
              type: "OVERTIME",
              status: "APPROVED",
              overtimeMinutes: 45,
              startedAt: "2026-11-13T23:30:00.000Z",
              reviewNote: "Approved note",
              isWorkingDay: true,
              privateMetadata: "PRIVATE-UNLISTED-SNAPSHOT",
              createdAt: null,
            },
          }),
          auditEvent("array-snapshot", {
            entityType: "AttendanceWorkday",
            before: null,
            after: ["unsupported", "snapshot"],
          }),
        ],
        1,
        2,
      ),
    }),
  )

  await page.goto("/attendance/audit")
  await page
    .getByRole("button", { name: "View audit event event-details" })
    .click()
  const details = page.getByRole("dialog", { name: "Audit event details" })
  await expect(details).toBeVisible()
  await expect(
    details.getByText("Approved overtime", { exact: true }),
  ).toBeVisible()
  await expect(details.getByText("Overtime", { exact: true })).toBeVisible()
  await expect(details.getByText("Approved", { exact: true })).toBeVisible()
  await expect(details.getByText("45 minutes", { exact: true })).toBeVisible()
  await expect(
    details.getByText("Nov 13, 2026, 11:30 PM", { exact: true }),
  ).toBeVisible()
  await expect(
    details.getByRole("heading", { name: "Previous values", exact: true }),
  ).toBeVisible()
  await expect(
    details.getByText("Old review note", { exact: true }),
  ).toBeVisible()
  await expect(details).not.toContainText("PRIVATE-UNLISTED-SNAPSHOT")
  await expect(details).not.toContainText("isWorkingDay")
  await expect(
    details.getByRole("button", {
      name: /^(Edit|Save|Delete|Approve|Reject)$/i,
    }),
  ).toHaveCount(0)

  await details.getByRole("button", { name: "Done", exact: true }).click()
  await expect(details).toHaveCount(0)
  await page
    .getByRole("button", { name: "View audit event array-snapshot" })
    .click()
  const emptyDetails = page.getByRole("dialog", {
    name: "Audit event details",
  })
  await expect(
    emptyDetails.getByText("No additional event details were recorded."),
  ).toBeVisible()
  await expect(
    emptyDetails.getByRole("heading", { name: "Previous values" }),
  ).toHaveCount(0)
})

test("[PG-005-F001-A009-T013] keyboard opens and dismisses event details at 390px", async ({
  page,
}) => {
  await signIn(page, "admin")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/api/attendance/departments", (route) =>
    route.fulfill({ json: { departments: [] } }),
  )
  await page.route("**/api/attendance/audit?**", (route) =>
    route.fulfill({
      json: auditPayload([auditEvent("keyboard-event")], 1, 1),
    }),
  )

  await page.goto("/attendance/audit")
  const trigger = page.getByRole("button", {
    name: "View audit event keyboard-event",
  })
  await expect(trigger).toBeVisible()
  await trigger.focus()
  await trigger.press("Enter")
  const details = page.getByRole("dialog", { name: "Audit event details" })
  await expect(details).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(details).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await assertNoPageOverflow(page)
})

for (const width of [1280, 390])
  test(`attendance policy skeletons match the responsive grid and retain rows during refresh at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, "admin")
    const initial = requestGate()
    const refreshed = requestGate()
    let holdingRefresh = false
    const initialQuery: { url: URL | null } = { url: null }
    await page.route("**/api/attendance/policies**", async (route) => {
      if (route.request().method() === "GET") {
        if (!holdingRefresh) initialQuery.url = new URL(route.request().url())
        const gate = holdingRefresh ? refreshed : initial
        gate.start()
        await gate.pending
      }
      await route.fallback()
    })

    await page.goto("/attendance/settings")
    const table = page.getByRole("table", { name: "Attendance policies" })
    await initial.started
    // PG-008-F001-A002-T001: the first request explicitly loads page 1, size
    // 10, active policies, and omits the empty search value.
    expect({
      page: initialQuery.url?.searchParams.get("page"),
      size: initialQuery.url?.searchParams.get("size"),
      status: initialQuery.url?.searchParams.get("status"),
      search: initialQuery.url?.searchParams.get("search"),
    }).toEqual({ page: "1", size: "10", status: "active", search: null })
    await expect(table).toHaveAttribute("aria-busy", "true")
    const skeletonRows = table.getByRole("rowgroup").nth(1).getByRole("row")
    await expect(skeletonRows).toHaveCount(5)
    for (const row of await skeletonRows.all())
      await expect(row.getByRole("cell")).toHaveCount(5)
    await expect(table.getByRole("status")).toContainText(
      "Loading attendance policies",
    )
    await expect(
      page.getByRole("status", { name: "Loading attendance", exact: true }),
    ).toHaveCount(0)
    initial.release()

    const existingRow = table
      .getByRole("row")
      .filter({ hasText: "Browser flexible policy" })
    await expect(existingRow).toBeVisible()
    await page
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByLabel("Policy name", { exact: true })
      .fill(`Skeleton refresh ${width}`)
    holdingRefresh = true
    await dialog
      .getByRole("button", { name: "Create policy", exact: true })
      .click()

    await refreshed.started
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(existingRow).toBeVisible()
    await expect(
      table
        .getByRole("status")
        .filter({ hasText: "Loading attendance policies" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("status", { name: "Loading attendance", exact: true }),
    ).toHaveCount(0)
    refreshed.release()
    await expect(
      table.getByRole("row").filter({ hasText: `Skeleton refresh ${width}` }),
    ).toBeVisible()

    const createdRow = table
      .getByRole("row")
      .filter({ hasText: `Skeleton refresh ${width}` })
    const search = page.getByRole("searchbox", {
      name: "Search attendance policies",
      exact: true,
    })
    await search.fill(`Skeleton refresh ${width}`)
    await expect(createdRow).toBeVisible()
    await expect(existingRow).toHaveCount(0)
    await page.clock.install()
    await search.fill("missing policy for skeleton test")
    await expect(table.getByRole("status")).toContainText(
      "Loading attendance policies",
    )
    const searchSkeletonRows = table
      .getByRole("rowgroup")
      .nth(1)
      .getByRole("row")
    await expect(searchSkeletonRows).toHaveCount(5)
    await page.clock.runFor(199)
    await page.clock.runFor(1)
    await expect(table.getByRole("status")).toContainText("No results for")
    await search.fill("")
    await page.clock.runFor(200)
    await expect(existingRow).toBeVisible()

    const policyView = page.getByRole("group", {
      name: "Policy view",
      exact: true,
    })
    await policyView
      .getByRole("button", { name: "Archived policies", exact: true })
      .click()
    await expect(createdRow).toHaveCount(0)
    await policyView
      .getByRole("button", { name: "Active policies", exact: true })
      .click()
    await expect(createdRow).toBeVisible()
  })

function requestGate() {
  let start!: () => void
  let release!: () => void
  const started = new Promise<void>((resolve) => {
    start = resolve
  })
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  return { started, pending, start, release: () => release() }
}

test("WC-06-F02 reports and exports a suspended session until reconciliation", async ({
  page,
}) => {
  test.setTimeout(90_000)
  const date = "2026-09-18"
  const nextDate = "2026-09-19"
  const startedAt = "2026-09-18T15:00:00.000Z"
  const suspendedAt = "2026-09-18T16:00:00.000Z"
  await clock("2026-09-19T03:00:00+08:00")
  await signIn(page, "admin")

  async function read<T>(resource: string, from: string, filters = "") {
    const response = await overtimeFixtureCall(
      "admin",
      `/attendance/${resource}?from=${from}&to=${from}${filters}`,
    )
    expect(response.status).toBe(200)
    return (await response.json()) as T
  }

  type Overview =
    import("../src/features/attendance/api/attendance-api").AttendanceOverview
  type Workday =
    import("../src/features/attendance/api/attendance-api").AttendanceWorkday
  type Records = { workdays: Workday[] }
  type StatusCounts = {
    total: number
    working: number
    onBreak: number
    suspended: number
    closed: number
  }
  const recordResponse = await read<Records>("records", date)
  const suspended = recordResponse.workdays.find(
    (day) => day.employee?.fullName === "WC06 Suspended",
  )!
  expect(suspended).toMatchObject({
    workDate: date,
    timeZone: "Asia/Manila",
    workedHours: 1,
    sessions: [{ startedAt, suspendedAt, endedAt: null }],
  })
  const overnight = recordResponse.workdays.find(
    (day) => day.employee?.fullName === "WC06 Overnight",
  )
  expect(overnight).toMatchObject({
    workDate: date,
    timeZone: "Asia/Manila",
    workedHours: 6,
    sessions: [
      {
        startedAt: "2026-09-18T12:00:00.000Z",
        endedAt: "2026-09-18T18:00:00.000Z",
      },
    ],
  })
  const employeeFilter = `&employeeId=${suspended.employeeId}`
  const departments = await overtimeFixtureCall(
    "admin",
    "/attendance/departments",
  )
  expect(departments.status).toBe(200)
  const { departments: choices } = (await departments.json()) as {
    departments: { id: string; name: string }[]
  }
  const departmentId = choices.find(({ name }) => name === "WC06 reporting")!.id
  const departmentFilter = `&departmentId=${departmentId}`
  const auditDate = new Date().toISOString().slice(0, 10)
  const audit = () =>
    read<{ total: number; events: { id: string; reason: string }[] }>(
      "audit",
      auditDate,
      employeeFilter,
    )
  const beforeAudit = await audit()

  async function selectDate(from: string) {
    await page.getByLabel("Attendance from date", { exact: true }).fill(from)
    await page.getByLabel("Attendance through date", { exact: true }).fill(from)
  }

  async function expectDistribution(counts: StatusCounts, filter = "") {
    const result = await read<Overview>("overview", date, filter)
    expect.soft(result.checkIns).toMatchObject(counts)
    const status = page.getByRole("region", { name: "Recorded session status" })
    for (const [label, count] of [
      ["Clocked in", counts.working],
      ["On unpaid break", counts.onBreak],
      ["Suspended", counts.suspended],
      ["Clocked out", counts.closed],
    ] as const) {
      const cells = status
        .getByRole("row")
        .filter({ has: page.getByRole("cell", { name: label, exact: true }) })
        .getByRole("cell")
      await expect.soft(cells.nth(1), label).toHaveText(String(count))
      await expect
        .soft(cells.nth(2), `${label} share`)
        .toHaveText(`${Math.round((count / counts.total) * 100)}%`)
    }
    const stillClockedIn = page
      .getByLabel("Time log figures")
      .locator("div")
      .filter({ has: page.getByText("Still clocked in", { exact: true }) })
      .getByRole("definition")
    await expect(stillClockedIn).toContainText(
      String(counts.working + counts.onBreak),
    )
  }

  async function exportRows() {
    const ready = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export", exact: true }).click()
    const download = await ready
    expect(download.suggestedFilename()).toBe(
      `attendance-${date}-${date}-page-1.csv`,
    )
    const chunks: Buffer[] = []
    for await (const chunk of await download.createReadStream())
      chunks.push(Buffer.from(chunk))
    // These fixture fields contain no embedded quotes or line breaks.
    const [headers, ...rows] = Buffer.concat(chunks)
      .toString("utf8")
      .split("\r\n")
      .map((line) => line.slice(1, -1).split('","'))
    expect
      .soft(headers.slice(-2))
      .toEqual(["Suspension timestamps", "Session statuses"])
    return rows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]])),
    )
  }

  await page.goto("/attendance/time-logs/overview")
  await selectDate(date)
  await expectDistribution({
    total: 4,
    working: 1,
    onBreak: 1,
    suspended: 1,
    closed: 1,
  })
  await page.getByRole("combobox", { name: "Time logs department" }).click()
  await page
    .getByRole("option", { name: "WC06 reporting", exact: true })
    .click()
  const onlySuspended = {
    total: 1,
    working: 0,
    onBreak: 0,
    suspended: 1,
    closed: 0,
  }
  await expectDistribution(onlySuspended, departmentFilter)
  expect((await read<Records>("records", nextDate)).workdays).toEqual([])
  await selectDate(nextDate)
  await expect(page.getByText("No check-ins in this period.")).toBeVisible()

  await page.getByRole("link", { name: "View records" }).click()
  await page.getByRole("button", { name: "All logs", exact: true }).click()
  await selectDate(date)
  const history = page.getByRole("table", { name: "Attendance history" })
  await expect(
    history.getByText("Shift suspended", { exact: true }),
  ).toBeVisible()
  const overnightRow = history.getByRole("row").filter({
    has: page.getByText("WC06 Overnight", { exact: true }),
  })
  await expect(overnightRow.getByText(`Work date ${date}`)).toBeVisible()
  await expect(
    overnightRow.getByText("Sep 19, 2026", { exact: false }),
  ).toBeVisible()
  const mixed = await exportRows()
  expect(mixed).toHaveLength(4)
  const suspendedCsv = {
    Workday: date,
    Employee: "WC06 Suspended",
    Timezone: "Asia/Manila",
    "Clock in timestamps": startedAt,
    "Clock out timestamps": "",
    "Suspension timestamps": suspendedAt,
    "Session statuses": "Suspended",
    "Worked hours": "1",
  }
  expect.soft(mixed).toContainEqual(expect.objectContaining(suspendedCsv))
  for (const [employee, status, clockOut] of [
    ["WC06 Working", "Open", ""],
    ["WC06 Break", "On unpaid break", ""],
    ["WC06 Overnight", "Closed", "2026-09-18T18:00:00.000Z"],
  ]) {
    expect.soft(mixed).toContainEqual(
      expect.objectContaining({
        Employee: employee,
        "Clock out timestamps": clockOut,
        "Suspension timestamps": "",
        "Session statuses": status,
      }),
    )
  }

  await page.getByRole("combobox", { name: "Attendance department" }).click()
  await page
    .getByRole("option", { name: "WC06 reporting", exact: true })
    .click()
  await expect(
    history.getByText("WC06 Suspended", { exact: true }),
  ).toBeVisible()
  await expect(history.getByText("WC06 Working", { exact: true })).toHaveCount(
    0,
  )
  await page.getByRole("button", { name: "Employees", exact: true }).click()
  await page
    .getByRole("button", { name: "View logs for WC06 Suspended", exact: true })
    .click()
  await expect(
    history.getByText("Shift suspended", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("WC06 reporting", { exact: true })).toBeVisible()
  const scopedCsv = await exportRows()
  expect(scopedCsv).toHaveLength(1)
  expect.soft(scopedCsv[0]).toMatchObject(suspendedCsv)
  expect(await read<Records>("records", date)).toEqual(recordResponse)
  expect(await audit()).toEqual(beforeAudit)

  const note = "Confirmed the suspended shift end for the reporting fixture"
  const reconciled = await overtimeFixtureCall(
    "admin",
    `/attendance/employees/${suspended.employeeId}/sessions/${suspended.sessions[0].id}/reconcile`,
    "POST",
    { endedAt: suspendedAt, note },
  )
  expect(reconciled.status).toBe(200)
  const after = await read<Records>(
    "records",
    date,
    employeeFilter + departmentFilter,
  )
  expect(after.workdays).toMatchObject([
    {
      workDate: date,
      workedHours: 1,
      sessions: [{ startedAt, suspendedAt, endedAt: suspendedAt }],
    },
  ])
  const afterAudit = await audit()
  expect(afterAudit.total).toBe(beforeAudit.total + 1)
  expect(afterAudit.events[0]).toMatchObject({ reason: note })
  expect(afterAudit.events.slice(1)).toEqual(beforeAudit.events)

  await page.reload()
  await page
    .getByRole("searchbox", { name: "Search attendance employees" })
    .fill("BROWSER-WC06-Suspended")
  await page
    .getByRole("button", { name: "View logs for WC06 Suspended", exact: true })
    .click()
  await selectDate(date)
  await expect(
    history.getByText("WC06 Suspended", { exact: true }),
  ).toBeVisible()
  await expect(
    history.getByText("Shift suspended", { exact: true }),
  ).toHaveCount(0)
  expect.soft(await exportRows()).toMatchObject([
    {
      ...suspendedCsv,
      "Clock out timestamps": suspendedAt,
      "Session statuses": "Closed",
    },
  ])

  await page.goto("/attendance/time-logs/overview")
  await selectDate(date)
  await page.getByRole("combobox", { name: "Time logs department" }).click()
  await page
    .getByRole("option", { name: "WC06 reporting", exact: true })
    .click()
  await expectDistribution(
    { ...onlySuspended, suspended: 0, closed: 1 },
    departmentFilter,
  )
  await clock("2026-11-13T20:00:00+08:00")
})

test("a reactivated employee can clock in after a manager reconciles a suspended shift", async ({
  page,
}) => {
  const start = Math.floor(Date.now() / 60000) * 60000 - 120 * 60000
  const actor = fixture.actors.recovery
  const punch = async (action: string, token: string, body: object) =>
    fetch(`${api}/api/attendance/me/${action}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  await clock(new Date(start).toISOString())
  const opened = await punch("clock-in", actor.token, {})
  expect(opened.status).toBe(201)
  const { workday } = (await opened.json()) as {
    workday: { activeSessionId: string; workDate: string }
  }
  const sessionId = workday.activeSessionId
  await clock(new Date(start + 30 * 60000).toISOString())
  expect((await punch("breaks/start", actor.token, { sessionId })).status).toBe(
    200,
  )
  const setActive = (isActive: boolean) =>
    fetch(`${api}/api/users/${actor.userId}/status`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${fixture.actors.superadmin.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ isActive }),
    })
  expect((await setActive(false)).status).toBe(200)
  expect((await punch("clock-out", actor.token, { sessionId })).status).toBe(
    401,
  )
  expect((await setActive(true)).status).toBe(200)
  const login = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "recovery@attendance-browser.test",
      password: "AttendanceFixture-42!",
    }),
  })
  expect(login.status).toBe(200)
  const renewed = (await login.json()) as {
    token: string
    refreshToken: string
  }
  Object.assign(actor, renewed)
  await clock(new Date().toISOString())
  await signIn(page, "recovery")
  await page.goto("/attendance/check-ins")
  await expect(
    page.getByText("Shift suspended", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText("Clocked out", { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeDisabled()

  const path = `/api/attendance/employees/${actor.employeeId}/sessions/${sessionId}/reconcile`
  const endedAt = new Date(start + 45 * 60000).toISOString()
  const note = "Confirmed the end of the suspended shift with the employee"
  const reconcileAs = (token: string) =>
    fetch(`${api}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ endedAt, note }),
    })
  expect((await reconcileAs(renewed.token)).status).toBe(403)
  expect((await reconcileAs(fixture.actors.head.token)).status).toBe(403)

  async function openDetails(role: string) {
    const reviewer = await page.context().newPage()
    await routeAttendanceApi(reviewer)
    await signIn(reviewer, role)
    await reviewer.goto("/attendance/time-logs/records")
    await reviewer
      .getByRole("button", { name: "View logs for Attendance recovery" })
      .click()
    await reviewer
      .getByRole("button", { name: `Actions for ${workday.workDate}` })
      .click()
    await reviewer.getByRole("menuitem", { name: "View details" }).click()
    await expect(
      reviewer
        .getByRole("dialog")
        .getByText("Shift suspended", { exact: true }),
    ).toBeVisible()
    return reviewer
  }
  const head = await openDetails("head")
  await expect(
    head.getByRole("button", { name: "Reconcile shift" }),
  ).toHaveCount(0)
  await head.unrouteAll({ behavior: "wait" })
  await head.close()
  const owner = await openDetails("superadmin")
  await expect(
    owner.getByRole("button", { name: "Reconcile shift" }),
  ).toBeVisible()
  await owner.unrouteAll({ behavior: "wait" })
  await owner.close()

  const manager = await openDetails("admin")
  await manager.getByRole("button", { name: "Reconcile shift" }).click()
  const dialog = manager.getByRole("dialog", {
    name: "Reconcile suspended shift",
  })
  const end = dialog.getByLabel("Confirmed clock-out")
  await expect(end).toHaveValue("")
  const local = (instant: number) =>
    manager.evaluate((value) => {
      const date = new Date(value)
      return new Date(value - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    }, instant)
  const submit = dialog.getByRole("button", { name: "Reconcile shift" })
  await expect(submit).toBeDisabled()
  await end.fill(await local(start))
  await dialog.getByLabel("Reason").fill("    ")
  await expect(submit).toBeDisabled()
  await dialog.getByLabel("Reason").fill(note)
  const failed = manager.waitForResponse(
    (response) => new URL(response.url()).pathname === path,
  )
  await submit.click()
  expect((await failed).status()).toBe(409)
  await expect(
    dialog.getByText("Clock-out must follow the session and its breaks"),
  ).toBeVisible()
  await expect(dialog.getByLabel("Reason")).toHaveValue(note)
  await end.fill(await local(Date.parse(endedAt)))
  const gate = requestGate()
  let submissions = 0
  await manager.route(
    (url) => url.pathname === path,
    async (route) => {
      submissions++
      gate.start()
      await gate.pending
      await route.fallback()
    },
  )
  const saved = manager.waitForResponse(
    (response) => new URL(response.url()).pathname === path,
  )
  try {
    await submit.click()
    await gate.started
    await expect(
      dialog.getByRole("button", { name: "Reconciling…" }),
    ).toBeDisabled()
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled()
  } finally {
    gate.release()
  }
  expect((await saved).status()).toBe(200)
  expect(submissions).toBe(1)
  await expect(dialog).toHaveCount(0)
  const table = manager.getByRole("table", { name: "Attendance history" })
  await expect(
    table.getByRole("button", { name: `Actions for ${workday.workDate}` }),
  ).toBeVisible()
  await expect(table.getByText("Shift suspended", { exact: true })).toHaveCount(
    0,
  )
  expect((await reconcileAs(fixture.actors.admin.token)).status).toBe(409)

  const persisted = await fetch(
    `${api}/api/attendance/me/history?from=${workday.workDate}&to=${workday.workDate}`,
    {
      headers: { authorization: `Bearer ${renewed.token}` },
    },
  )
  expect(persisted.status).toBe(200)
  const { workdays } = await persisted.json()
  expect(workdays[0].sessions[0]).toMatchObject({
    id: sessionId,
    endedAt,
    breaks: [{ endedAt }],
  })
  await manager.unrouteAll({ behavior: "wait" })
  await manager.close()
  await page.bringToFront()
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeEnabled({ timeout: 10000 })
  await confirm(page, "Clock in")
  await expect(
    page.getByRole("button", { name: "Clock out", exact: true }),
  ).toBeEnabled()
})

test.describe("WC-I3-F02 reconciliation timestamps", () => {
  test.use({ timezoneId: "America/Los_Angeles" })

  for (const { actor, offset, endedAt, workedMinutes } of [
    {
      actor: "reconcile-pdt",
      offset: "UTC-07:00",
      endedAt: "2026-11-01T08:30:00.000Z",
      workedMinutes: 20,
    },
    {
      actor: "reconcile-pst",
      offset: "UTC-08:00",
      endedAt: "2026-11-01T09:30:00.000Z",
      workedMinutes: 80,
    },
  ]) {
    test(`submits only the selected ${offset} occurrence`, async ({ page }) => {
      const { employeeId } = fixture.actors[actor]
      await clock("2026-11-01T08:10:00Z")
      const opened = await overtimeFixtureCall(
        actor,
        "/attendance/me/clock-in",
        "POST",
        {},
      )
      expect(opened.status).toBe(201)
      const { workday } = await opened.json()
      expect(
        (
          await overtimeFixtureCall(
            "admin",
            `/employees/${employeeId}/account/status`,
            "PATCH",
            { isActive: false },
          )
        ).status,
      ).toBe(204)
      await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"))
      await signIn(page, "admin")
      await page.goto("/attendance/time-logs/records")
      await page
        .getByRole("button", { name: `View logs for Attendance ${actor}` })
        .click()
      await page.getByRole("button", { name: "Actions for 2026-11-01" }).click()
      await page.getByRole("menuitem", { name: "View details" }).click()
      await page.getByRole("button", { name: "Reconcile shift" }).click()
      const dialog = page.getByRole("dialog", {
        name: "Reconcile suspended shift",
      })
      const end = dialog.getByLabel("Confirmed clock-out", { exact: true })
      const note = "Confirmed the selected occurrence of local time"
      await dialog.getByLabel("Reason").fill(note)
      const submit = dialog.getByRole("button", { name: "Reconcile shift" })
      await end.fill("2026-03-08T02:30")
      await expect(dialog.getByRole("alert")).toHaveText(
        /not a valid local time/,
      )
      await expect(submit).toBeDisabled()
      await end.fill("2026-11-01T01:30")
      await expect(dialog.getByRole("alert")).toHaveText(/Choose a UTC offset/)
      await expect(submit).toBeDisabled()
      const occurrence = dialog.getByRole("combobox", {
        name: "Confirmed clock-out occurrence",
      })
      await occurrence.click()
      await page.getByRole("option", { name: offset, exact: true }).click()
      await expect(occurrence).toHaveText(offset)

      const reconcile = `/attendance/employees/${employeeId}/sessions/${workday.activeSessionId}/reconcile`
      const postReconciliation = async () => {
        const response = page.waitForResponse(
          (result) => new URL(result.url()).pathname === `/api${reconcile}`,
        )
        await submit.click()
        const result = await response
        expect(result.request().postDataJSON()).toEqual({ endedAt, note })
        return result
      }
      expect((await postReconciliation()).status()).toBe(400)
      await expect(dialog.getByRole("alert")).toHaveText(
        "Clock-out cannot be in the future",
      )
      await expect(occurrence).toHaveText(offset)
      await expect(end).toHaveValue("2026-11-01T01:30")
      await expect(dialog.getByLabel("Reason")).toHaveValue(note)
      await clock("2026-11-01T10:00:00Z")
      expect((await postReconciliation()).status()).toBe(200)
      await expect(dialog).toHaveCount(0)
      const history = await overtimeFixtureCall(
        "admin",
        `/attendance/employees/${employeeId}/history?from=2026-11-01&to=2026-11-01`,
      )
      expect(history.status).toBe(200)
      expect((await history.json()).workdays).toMatchObject([
        { workedMinutes, sessions: [{ endedAt }] },
      ])
    })
  }
})

test.describe("device-zone correction timestamps", () => {
  test.use({ timezoneId: "America/Los_Angeles" })
  const actor = "correction-dst"

  test.beforeEach(async ({ page }) => {
    await clock("2026-11-13T20:00:00+08:00")
    await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"))
    await signIn(page, actor)
  })

  async function readAttendance(path: string): Promise<unknown> {
    const response = await fetch(`${api}/api/attendance${path}`, {
      headers: { authorization: `Bearer ${fixture.actors[actor].token}` },
    })
    expect(response.status).toBe(200)
    return response.json()
  }

  async function missingSession(page: Page, start: string, end: string) {
    await page
      .getByRole("button", { name: "Request correction", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Request missing attendance",
    })
    await expect(
      dialog.getByText(/device timezone \(America\/Los_Angeles\)/),
    ).toBeVisible()
    await dialog.getByLabel("Actual clock-in", { exact: true }).fill(start)
    await dialog.getByLabel("Actual clock-out", { exact: true }).fill(end)
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("Record the actual local working times")
    return dialog
  }

  async function submitAndApprove(
    page: Page,
    timestamps: {
      startedAt: string
      endedAt: string
      sessionId?: string
    },
  ) {
    const response = page.waitForResponse(
      (item) =>
        item.request().method() === "POST" &&
        new URL(item.url()).pathname === "/api/attendance/adjustments",
    )
    await page
      .getByRole("button", { name: "Submit request", exact: true })
      .click()
    const posted = await response
    expect(posted.status(), await posted.text()).toBe(201)
    expect(posted.request().postDataJSON()).toMatchObject(timestamps)
    const { adjustment } = (await posted.json()) as {
      adjustment: { id: string }
    }
    expect(adjustment).toMatchObject({
      proposedStartedAt: timestamps.startedAt,
      proposedEndedAt: timestamps.endedAt,
      sessionId: timestamps.sessionId ?? null,
    })
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await approveCorrection(adjustment.id)
  }

  test("spring gaps in either field leave requests and attendance unchanged", async ({
    page,
  }) => {
    const historyPath = "/me/history?from=2026-03-08&to=2026-03-09"
    const listPath = "/adjustments?scope=mine&type=CORRECTION"
    const before = await readAttendance(historyPath)
    const beforeRequests = await readAttendance(listPath)
    let posts = 0
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/attendance/adjustments"
      )
        posts++
    })
    await page.goto("/attendance/requests/corrections")
    const dialog = await missingSession(
      page,
      "2026-03-08T02:30",
      "2026-03-08T04:00",
    )
    const clockIn = dialog.getByLabel("Actual clock-in", { exact: true })
    const clockOut = dialog.getByLabel("Actual clock-out", { exact: true })
    const submit = dialog.getByRole("button", {
      name: "Submit request",
      exact: true,
    })
    await submit.click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Actual clock-in is not a valid local time in America/Los_Angeles. Choose another time.",
    )
    await expect(clockIn).toHaveValue("2026-03-08T02:30")
    await expect(clockIn).toHaveAttribute("aria-invalid", "true")
    await clockIn.fill("2026-03-08T01:30")
    await clockOut.fill("2026-03-08T02:30")
    await submit.click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Actual clock-out is not a valid local time in America/Los_Angeles. Choose another time.",
    )
    await expect(clockOut).toHaveValue("2026-03-08T02:30")
    await expect(dialog.getByRole("combobox")).toHaveCount(0)
    expect(posts).toBe(0)
    expect(await readAttendance(listPath)).toEqual(beforeRequests)
    expect(await readAttendance(historyPath)).toEqual(before)
  })

  test("fall offsets determine ordering and the approved 30-minute interval", async ({
    page,
  }) => {
    const historyPath = "/me/history?from=2026-11-01&to=2026-11-01"
    const listPath = "/adjustments?scope=mine&type=CORRECTION"
    const before = await readAttendance(historyPath)
    const beforeRequests = await readAttendance(listPath)
    await page.goto("/attendance/requests/corrections")
    const dialog = await missingSession(
      page,
      "2026-11-01T01:45",
      "2026-11-01T01:15",
    )
    const clockOut = dialog.getByLabel("Actual clock-out", { exact: true })
    await clockOut.press("Alt+ArrowDown")
    await page
      .getByRole("button", { name: "Apply date & time", exact: true })
      .click()
    await expect(clockOut).toHaveValue("2026-11-01T01:15")
    const submit = dialog.getByRole("button", {
      name: "Submit request",
      exact: true,
    })
    await submit.click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Choose a UTC offset for actual clock-in.",
    )
    const startOffset = dialog.getByRole("combobox", {
      name: "Actual clock-in occurrence",
    })
    const endOffset = dialog.getByRole("combobox", {
      name: "Actual clock-out occurrence",
    })
    await startOffset.click()
    await page.getByRole("option", { name: "UTC-08:00", exact: true }).click()
    await endOffset.click()
    await page.getByRole("option", { name: "UTC-07:00", exact: true }).click()
    await submit.click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Actual clock-out must be after actual clock-in.",
    )
    expect(await readAttendance(listPath)).toEqual(beforeRequests)
    expect(await readAttendance(historyPath)).toEqual(before)
    await startOffset.click()
    await page.getByRole("option", { name: "UTC-07:00", exact: true }).click()
    await endOffset.click()
    await page.getByRole("option", { name: "UTC-08:00", exact: true }).click()
    const timestamps = {
      startedAt: "2026-11-01T08:45:00.000Z",
      endedAt: "2026-11-01T09:15:00.000Z",
    }
    await submitAndApprove(page, timestamps)
    expect(await readAttendance(historyPath)).toMatchObject({
      total: 1,
      workdays: [
        {
          workDate: "2026-11-01",
          timeZone: "Asia/Manila",
          workedMinutes: 30,
          requiredMinutes: 480,
          sessions: [timestamps],
        },
      ],
    })
  })

  test("existing-session prefills retain the recorded repeated offset and seconds", async ({
    page,
  }) => {
    const startedAt = "2026-11-01T09:25:12.345Z"
    const endedAt = "2026-11-01T09:40:12.345Z"
    await createApprovedCorrection(
      startedAt,
      endedAt,
      "Seed recorded second-occurrence timestamps",
      actor,
    )
    const historyPath = "/me/history?from=2026-11-01&to=2026-11-01"
    const before = await readAttendance(historyPath)
    const { workdays } = before as {
      workdays: { sessions: { id: string; startedAt: string }[] }[]
    }
    const session = workdays[0].sessions.find(
      (item) => item.startedAt === startedAt,
    )
    expect(session).toBeDefined()
    await page.goto("/attendance/check-ins")
    await page
      .getByRole("table", { name: "Attendance history" })
      .last()
      .getByRole("button", { name: "Actions for 2026-11-01", exact: true })
      .click()
    await page
      .getByRole("menuitem", { name: "View details", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Request correction", exact: true })
      .last()
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Request attendance correction",
    })
    await expect(
      dialog.getByLabel("Actual clock-in", { exact: true }),
    ).toHaveValue("2026-11-01T01:25")
    await expect(
      dialog.getByLabel("Actual clock-out", { exact: true }),
    ).toHaveValue("2026-11-01T01:40")
    await expect(
      dialog.getByRole("combobox", { name: "Actual clock-in occurrence" }),
    ).toHaveText("UTC-08:00")
    await expect(
      dialog.getByRole("combobox", { name: "Actual clock-out occurrence" }),
    ).toHaveText("UTC-08:00")
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("Confirm the existing timestamps at their original offset")
    await submitAndApprove(page, { startedAt, endedAt, sessionId: session!.id })
    expect(await readAttendance(historyPath)).toEqual(before)
  })

  test("ordinary overnight entries follow the policy workday", async ({
    page,
  }) => {
    await page.goto("/attendance/requests/corrections")
    const deviceOvernight = {
      startedAt: "2026-11-06T07:30:00.000Z",
      endedAt: "2026-11-06T09:15:00.000Z",
    }
    const policyOvernight = {
      startedAt: "2026-11-05T15:30:00.000Z",
      endedAt: "2026-11-05T17:15:00.000Z",
    }
    for (const [start, end, timestamps] of [
      ["2026-11-05T23:30", "2026-11-06T01:15", deviceOvernight],
      ["2026-11-05T07:30", "2026-11-05T09:15", policyOvernight],
    ] as const) {
      const dialog = await missingSession(page, start, end)
      await expect(dialog.getByRole("combobox")).toHaveCount(0)
      await submitAndApprove(page, timestamps)
    }
    expect(
      await readAttendance("/me/history?from=2026-11-05&to=2026-11-06"),
    ).toMatchObject({
      total: 2,
      workdays: [
        {
          workDate: "2026-11-06",
          timeZone: "Asia/Manila",
          workedMinutes: 105,
          hasOvernightSessions: false,
          sessions: [deviceOvernight],
        },
        {
          workDate: "2026-11-05",
          timeZone: "Asia/Manila",
          workedMinutes: 105,
          hasOvernightSessions: true,
          sessions: [policyOvernight],
        },
      ],
    })
  })
})

test("replacement Head opens and marks a real pending correction notice", async ({
  page,
}) => {
  const reason = "Record the shift before the browser Head handoff"
  function request(actor: string, path: string, method = "GET", body?: object) {
    return fetch(`${api}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${fixture.actors[actor].token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }
  const submitted = await request("staff", "/attendance/adjustments", "POST", {
    requestKey: randomUUID(),
    startedAt: "2026-10-29T02:15:00.000Z",
    endedAt: "2026-10-29T02:45:00.000Z",
    reason,
  })
  expect(submitted.status, await submitted.clone().text()).toBe(201)
  const { adjustment } = (await submitted.json()) as {
    adjustment: { id: string }
  }
  const path = `/attendance/adjustments/${adjustment.id}`
  const formerDetail = await request("head", path)
  expect(formerDetail.status).toBe(200)
  const {
    adjustment: {
      employee: { departmentId },
    },
  } = (await formerDetail.json()) as {
    adjustment: { employee: { departmentId: string } }
  }
  const link = `/attendance/requests/corrections?request=${adjustment.id}`
  async function pendingNotice(actor: string) {
    const response = await request(actor, "/request-workflows/notifications")
    expect(response.status).toBe(200)
    const { notifications } = (await response.json()) as {
      notifications: {
        id: string
        entityId: string
        type: string
        readAt: string | null
      }[]
    }
    return notifications.find(
      (item) =>
        item.entityId === adjustment.id &&
        item.type === "ATTENDANCE_CORRECTION_PENDING",
    )
  }
  async function setHead(actor: string) {
    const response = await request(
      "admin",
      `/departments/${departmentId}`,
      "PUT",
      {
        headId: fixture.actors[actor].userId,
      },
    )
    expect(response.status, await response.text()).toBe(200)
  }
  expect(await pendingNotice("head")).toBeDefined()
  await setHead("correction-dst")
  try {
    expect((await request("head", path)).status).toBe(404)
    expect(await pendingNotice("head")).toBeUndefined()
    expect(await pendingNotice("correction-dst")).toMatchObject({
      readAt: null,
    })
    await page.unroute("**/api/**")
    await routeAttendanceApi(page, { realNotifications: true })
    await signIn(page, "correction-dst")
    await page.goto("/attendance/check-ins")
    await page
      .getByRole("button", { name: /^Notifications, \d+ unread$/ })
      .click()
    await page
      .getByRole("menuitem", {
        name: /attendance correction awaiting department verification/,
      })
      .and(page.locator(`[href="${link}"]`))
      .click()
    await expect(page).toHaveURL((url) => url.pathname + url.search === link)
    const detail = page.getByRole("dialog", { name: "Attendance correction" })
    await expect(detail.getByText(reason, { exact: true })).toBeVisible()
    await expect
      .poll(async () => (await pendingNotice("correction-dst"))?.readAt)
      .toEqual(expect.any(String))
  } finally {
    await setHead("head")
  }
})

test("replacement Head opens and marks a real pending overtime notice", async ({
  page,
}) => {
  function request(actor: string, path: string, method = "GET", body?: object) {
    return fetch(`${api}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${fixture.actors[actor].token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }
  const requester = "overtime-staff"
  const replacement = "correction-dst"
  await clock("2026-10-30T08:00:00+08:00")
  const opened = await request(requester, "/attendance/me/clock-in", "POST", {})
  expect(opened.status, await opened.clone().text()).toBe(201)
  const { workday } = (await opened.json()) as {
    workday: { activeSessionId: string }
  }
  await clock("2026-10-30T18:00:00+08:00")
  const closed = await request(requester, "/attendance/me/clock-out", "POST", {
    sessionId: workday.activeSessionId,
  })
  expect(closed.status, await closed.text()).toBe(200)
  const list = await request(
    requester,
    "/attendance/adjustments?scope=mine&type=OVERTIME&status=PENDING",
  )
  expect(list.status).toBe(200)
  const { adjustments } = (await list.json()) as {
    adjustments: {
      id: string
      employee: { departmentId: string }
      overtimeMinutes: number
    }[]
  }
  expect(adjustments).toHaveLength(1)
  const [
    {
      id,
      employee: { departmentId },
      overtimeMinutes,
    },
  ] = adjustments
  expect(overtimeMinutes).toBe(120)
  const link = `/attendance/requests/overtime?request=${id}`
  async function pendingNotice(actor: string) {
    const response = await request(actor, "/request-workflows/notifications")
    expect(response.status).toBe(200)
    const { notifications } = (await response.json()) as {
      notifications: {
        id: string
        entityId: string
        type: string
        readAt: string | null
      }[]
    }
    return notifications.find(
      (item) =>
        item.entityId === id && item.type === "ATTENDANCE_OVERTIME_PENDING",
    )
  }
  async function setHead(actor: string) {
    const response = await request(
      "admin",
      `/departments/${departmentId}`,
      "PUT",
      {
        headId: fixture.actors[actor].userId,
      },
    )
    expect(response.status, await response.text()).toBe(200)
  }
  const former = await pendingNotice("head")
  if (!former)
    throw new Error("Expected a pending notice for the original Head")
  await setHead(replacement)
  try {
    expect(
      (await request("head", `/attendance/adjustments/${id}`)).status,
    ).toBe(404)
    expect(await pendingNotice("head")).toBeUndefined()
    expect(
      (
        await request(
          "head",
          `/request-workflows/notifications/${former.id}/read`,
          "PATCH",
        )
      ).status,
    ).toBe(404)
    expect(await pendingNotice(replacement)).toMatchObject({ readAt: null })
    await page.unroute("**/api/**")
    await routeAttendanceApi(page, { realNotifications: true })
    await signIn(page, replacement)
    await page.goto("/attendance/check-ins")
    await page
      .getByRole("button", { name: /^Notifications, \d+ unread$/ })
      .click()
    await page
      .getByRole("menuitem", {
        name: /120 overtime minutes awaiting department verification/,
      })
      .and(page.locator(`[href="${link}"]`))
      .click()
    await expect(page).toHaveURL((url) => url.pathname + url.search === link)
    const detail = page.getByRole("dialog", { name: "Overtime request" })
    await expect(detail.getByText("120 minutes", { exact: true })).toBeVisible()
    await expect
      .poll(async () => (await pendingNotice(replacement))?.readAt)
      .toEqual(expect.any(String))
  } finally {
    await setHead("head")
  }
})

const overtimePage = "/attendance/requests/overtime"
const overtimeAdjustments = "/attendance/adjustments"

function overtimeFixtureCall(
  actor: string,
  path: string,
  method = "GET",
  body?: object,
) {
  return fetch(`${api}/api${path}`, {
    method,
    headers: {
      authorization: `Bearer ${fixture.actors[actor].token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

async function seedOvertimeReview(
  date: string,
  verify = true,
  employee = "overtime-staff",
) {
  await clock(`${date}T08:00:00+08:00`)
  const opened = await overtimeFixtureCall(
    employee,
    "/attendance/me/clock-in",
    "POST",
    {},
  )
  expect(opened.status, await opened.clone().text()).toBe(201)
  const { workday } = (await opened.json()) as {
    workday: { activeSessionId: string }
  }
  await clock(`${date}T18:00:00+08:00`)
  const closed = await overtimeFixtureCall(
    employee,
    "/attendance/me/clock-out",
    "POST",
    {
      sessionId: workday.activeSessionId,
    },
  )
  expect(closed.status, await closed.text()).toBe(200)
  const list = await overtimeFixtureCall(
    employee,
    `${overtimeAdjustments}?scope=mine&type=OVERTIME&status=PENDING`,
  )
  expect(list.status).toBe(200)
  const { adjustments } = (await list.json()) as {
    adjustments: {
      id: string
      sessionId: string
      overtimeMinutes: number
      employee: { departmentId: string }
      reason: string
    }[]
  }
  const request = adjustments.find(
    ({ sessionId }) => sessionId === workday.activeSessionId,
  )
  if (!request) throw new Error("Expected overtime for the fixture shift")
  expect(request.overtimeMinutes).toBe(120)
  if (verify) {
    const result = await overtimeFixtureCall(
      "head",
      `${overtimeAdjustments}/${request.id}/review`,
      "POST",
      {
        decision: "APPROVED",
        note: "Head verified the overtime fixture shift",
      },
    )
    expect(result.status, await result.clone().text()).toBe(200)
    expect(await result.json()).toMatchObject({
      adjustment: { status: "VERIFIED" },
    })
  }
  return request
}

test("WC-07-F01 shows HR and the transfer's reset effects in the audit viewers", async ({
  page,
  browser,
}) => {
  const requester = "wc07-requester"
  const overtime = await seedOvertimeReview("2026-11-13", false, requester)
  const response = await overtimeFixtureCall(
    requester,
    overtimeAdjustments,
    "POST",
    {
      requestKey: randomUUID(),
      startedAt: "2026-11-12T08:00:00+08:00",
      endedAt: "2026-11-12T10:00:00+08:00",
      reason: "Attendance correction before transfer",
    },
  )
  expect(response.status, await response.clone().text()).toBe(201)
  const { adjustment: correction } = (await response.json()) as {
    adjustment: { id: string }
  }
  for (const { id } of [correction, overtime]) {
    const verified = await overtimeFixtureCall(
      "wc07-origin-head",
      `${overtimeAdjustments}/${id}/review`,
      "POST",
      {
        decision: "APPROVED",
        note: "Verified before the transfer",
      },
    )
    expect(verified.status, await verified.clone().text()).toBe(200)
    expect(await verified.json()).toMatchObject({
      adjustment: { status: "VERIFIED" },
    })
  }
  const transfer = await overtimeFixtureCall(
    "admin",
    `/employees/${fixture.actors[requester].employeeId}`,
    "PUT",
    {
      departmentId: fixture.transferDestinationId,
    },
  )
  expect(transfer.status, await transfer.clone().text()).toBe(200)
  const correlationId = transfer.headers.get("x-correlation-id")
  if (!correlationId) throw new Error("Expected the transfer correlation ID")

  await signIn(page, "wc07-destination-head")
  await page.goto("/attendance/audit")
  await page
    .getByRole("searchbox", { name: "Search audit events" })
    .fill("Attendance admin")
  const audit = page.getByRole("table", { name: "Attendance audit events" })
  for (const label of ["attendance correction", "overtime request"]) {
    const reset = audit
      .getByRole("row")
      .filter({ hasText: `Updated an ${label}` })
    await expect(
      reset.getByText("Attendance admin", { exact: true }),
    ).toBeVisible()
  }

  const oversight = await browser.newContext()
  try {
    const logs = await oversight.newPage()
    await routeAttendanceApi(logs)
    await signIn(logs, "superadmin")
    await logs.goto("/module/attendance-monitoring/logs")
    await logs
      .getByRole("searchbox", { name: "Search logs" })
      .fill(correlationId)
    await logs
      .getByRole("button", {
        name: /View log: Changed department placement for Attendance wc07-requester/,
      })
      .click()
    const detail = logs.getByRole("dialog")
    await expect(
      detail.getByText("Employee department placement", { exact: true }),
    ).toBeVisible()
    await expect(
      detail.getByText("Attendance correction", { exact: true }),
    ).toBeVisible()
    await expect(
      detail.getByText("Overtime request", { exact: true }),
    ).toBeVisible()
    await expect(detail.getByText(correlationId, { exact: true })).toBeVisible()
  } finally {
    await oversight.close()
  }
})

test("WC-07-F02 keeps Workforce Logs search pages stable through a real employee rename", async ({
  page,
}) => {
  await signIn(page, "superadmin")
  await page.goto("/module/attendance-monitoring/logs")
  const search = "Workforce Paging Needle"
  const matches = (pageNumber: number, term = search) =>
    page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/workforce-compliance-logs" &&
        url.searchParams.get("search") === term &&
        url.searchParams.get("page") === String(pageNumber) &&
        response.ok()
      )
    })
  const firstResponse = matches(1)
  await page.getByRole("searchbox", { name: "Search logs" }).fill(search)
  const first = (await (await firstResponse).json()) as {
    snapshot: string
    asOf: string
  }
  expect(first.snapshot).toBeTruthy()
  await expect(page.getByText("Showing 1–25 of 27 logs")).toBeVisible()
  const rename = await overtimeFixtureCall(
    "admin",
    `/employees/${fixture.pagingEmployeeId}`,
    "PUT",
    { fullName: "Workforce Paging Renamed" },
  )
  expect(rename.status, await rename.clone().text()).toBe(200)

  const next = matches(2)
  const nextButton = page.getByRole("button", {
    name: "Next page",
    exact: true,
  })
  await nextButton.click()
  const second = await next
  const params = new URL(second.url()).searchParams
  expect(params.get("snapshot")).toBe(first.snapshot)
  expect(params.get("asOf")).toBe(first.asOf)
  const { events } = (await second.json()) as { events: { id: string }[] }
  expect(events.map(({ id }) => id)).toEqual([
    "attendance:browser-wc07-page-25",
    "attendance:browser-wc07-page-26",
  ])
  await expect(page.getByText("Showing 26–27 of 27 logs")).toBeVisible()

  await page.getByRole("button", { name: "Previous page", exact: true }).click()
  await expect(
    page.getByText(
      "Started an attendance session for Workforce Paging Renamed.",
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.getByText("Showing 1–25 of 27 logs")).toBeVisible()

  await page.route(
    "**/api/workforce-compliance-logs?**",
    (route) =>
      route.fulfill({
        status: 409,
        json: {
          error:
            "This log window is no longer available. Refresh logs to start again.",
        },
      }),
    { times: 1 },
  )
  await nextButton.click()
  await expect(
    page.getByText(/This log window is no longer available/),
  ).toBeVisible()
  const retry = matches(1)
  await page.getByRole("button", { name: "Try again" }).click()
  expect(new URL((await retry).url()).searchParams.has("snapshot")).toBe(false)
  await expect(page.getByText("Showing 1–25 of 26 logs")).toBeVisible()
  await expect(
    page.getByText(
      "Started an attendance session for Workforce Paging Renamed.",
      { exact: true },
    ),
  ).toHaveCount(0)

  const refreshed = matches(1)
  await page.getByRole("button", { name: "Refresh logs" }).click()
  expect(new URL((await refreshed).url()).searchParams.has("asOf")).toBe(false)
  await expect(page.getByText("Showing 1–25 of 26 logs")).toBeVisible()

  const changedSearch = "Workforce Paging Renamed"
  const changed = matches(1, changedSearch)
  await page.getByRole("searchbox", { name: "Search logs" }).fill(changedSearch)
  expect(new URL((await changed).url()).searchParams.has("snapshot")).toBe(
    false,
  )
  await expect(page.getByText("Showing 1–1 of 1 logs")).toBeVisible()
})

test("WC-07-F03 shows suspension and reconciliation details from the real backend", async ({
  page,
}) => {
  const actor = "wc07-reconcile"
  const { employeeId } = fixture.actors[actor]
  await clock("2026-11-13T08:00:00+08:00")
  const opened = await overtimeFixtureCall(
    actor,
    "/attendance/me/clock-in",
    "POST",
    {},
  )
  expect(opened.status, await opened.clone().text()).toBe(201)
  const { workday } = (await opened.json()) as {
    workday: { activeSessionId: string }
  }
  const disabled = await overtimeFixtureCall(
    "admin",
    `/employees/${employeeId}/account/status`,
    "PATCH",
    { isActive: false },
  )
  expect(disabled.status, await disabled.clone().text()).toBe(204)
  const endedAt = "2026-11-13T18:00:00+08:00"
  const note = "Private reconciliation browser reason"
  await clock(endedAt)
  const reconciled = await overtimeFixtureCall(
    "admin",
    `/attendance/employees/${employeeId}/sessions/${workday.activeSessionId}/reconcile`,
    "POST",
    { endedAt, note },
  )
  expect(reconciled.status, await reconciled.clone().text()).toBe(200)

  await signIn(page, "superadmin")
  await page.goto("/module/attendance-monitoring/logs")
  const search = page.getByRole("searchbox", { name: "Search logs" })
  async function openLog(response: Response, message: string) {
    const trace = response.headers.get("x-correlation-id")
    if (!trace) throw new Error("Expected the operation correlation ID")
    await search.fill(trace)
    await page
      .getByRole("button", {
        name: `View log: ${message} for Attendance wc07-reconcile.`,
      })
      .click()
    const detail = page.getByRole("dialog")
    await expect(detail.getByText(trace, { exact: true })).toBeVisible()
    await expect(
      detail.getByText("Attendance admin", { exact: true }).first(),
    ).toBeVisible()
    return detail
  }
  const suspension = await openLog(
    disabled,
    "Suspended an open attendance session",
  )
  await expect(
    suspension.getByText("Suspension time", { exact: true }),
  ).toBeVisible()
  await suspension.getByRole("button", { name: "Close log details" }).click()
  const reconciliation = await openLog(
    reconciled,
    "Reconciled a suspended attendance session",
  )
  await expect(
    reconciliation.getByText("End time", { exact: true }),
  ).toBeVisible()
  await expect(
    reconciliation
      .getByText("2026-11-13T10:00:00+00:00", { exact: true })
      .first(),
  ).toBeVisible()
  await expect(
    reconciliation.getByText("Overtime request", { exact: true }),
  ).toBeVisible()
  await expect(
    reconciliation.getByText("Overtime minutes", { exact: true }),
  ).toBeVisible()
  await expect(reconciliation.getByText(note, { exact: true })).toHaveCount(0)
})

test("WC-07-F04 finds the same real Workforce Logs pages by area name and code", async ({
  page,
}) => {
  await signIn(page, "superadmin")
  await page.goto("/module/attendance-monitoring/logs")
  await page.getByLabel("Filter by area").click()
  await page.getByRole("option", { name: "Time Logs", exact: true }).click()
  const search = page.getByRole("searchbox", { name: "Search logs" })
  const next = page.getByRole("button", { name: "Next page", exact: true })

  function waitForPage(term: string, pageNumber: number) {
    return page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/workforce-compliance-logs" &&
        url.searchParams.get("source") === "time-logs" &&
        url.searchParams.get("search") === term &&
        url.searchParams.get("page") === String(pageNumber) &&
        response.ok()
      )
    })
  }
  type LogPage = {
    total: number
    snapshot: string
    asOf: string
    events: { id: string }[]
  }
  async function searchPages(term: string) {
    const firstResponse = waitForPage(term, 1)
    await search.fill(term)
    const first = (await (await firstResponse).json()) as LogPage
    expect(first.total).toBeGreaterThan(25)
    await expect(
      page.getByText(`Showing 1–25 of ${first.total} logs`),
    ).toBeVisible()

    const secondResponse = waitForPage(term, 2)
    await next.click()
    const response = await secondResponse
    const params = new URL(response.url()).searchParams
    expect(params.get("snapshot")).toBe(first.snapshot)
    expect(params.get("asOf")).toBe(first.asOf)
    const second = (await response.json()) as LogPage
    expect(second.total).toBe(first.total)
    await expect(
      page.getByText(
        `Showing 26–${Math.min(50, first.total)} of ${first.total} logs`,
      ),
    ).toBeVisible()
    return {
      total: first.total,
      ids: [...first.events, ...second.events].map(({ id }) => id),
    }
  }

  const byName = await searchPages("Time Logs")
  expect(await searchPages("time-logs")).toEqual(byName)
})

function overtimeRowMenu(page: Page, id: string) {
  return page.locator(`[id="attendance-adjustment-actions-${id}"]`)
}

function overtimeResponse(page: Page, method: string, path: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === `/api${path}`,
  )
}

async function recordWinningOvertimeDecision(
  browser: Browser,
  origin: string,
  id: string,
  decision: "Approve" | "Reject",
  note: string,
) {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await routeAttendanceApi(page)
    await signIn(page, "superadmin")
    await page.goto(origin + overtimePage)
    await overtimeRowMenu(page, id).click()
    await page.getByRole("menuitem", { name: `${decision} request` }).click()
    const panel = page.getByRole("dialog", { name: `${decision} overtime` })
    await panel.getByRole("textbox", { name: "Review note" }).fill(note)
    const saved = overtimeResponse(
      page,
      "POST",
      `${overtimeAdjustments}/${id}/review`,
    )
    await panel.getByRole("button", { name: "Confirm decision" }).click()
    const response = await saved
    expect(response.status(), await response.text()).toBe(200)
    expect(await response.json()).toMatchObject({
      adjustment: {
        status: decision === "Approve" ? "APPROVED" : "REJECTED",
        reviewedById: fixture.actors.superadmin.userId,
        reviewNote: note,
      },
    })
  } finally {
    await context.close()
  }
}

test("overtime conflict recovers a stale HR approval after Superadmin rejection", async ({
  page,
  browser,
}) => {
  const { id } = await seedOvertimeReview("2026-10-31")
  const path = `${overtimeAdjustments}/${id}`
  await signIn(page, "admin")
  await page.goto(overtimePage)
  const menu = overtimeRowMenu(page, id)
  await menu.click()
  await page.getByRole("menuitem", { name: "Approve request" }).click()
  const panel = page.getByRole("dialog", { name: "Approve overtime" })
  await expect(
    panel.getByText("Verified — awaiting HR", { exact: true }),
  ).toBeVisible()
  const note = panel.getByRole("textbox", { name: "Review note" })
  const confirm = panel.getByRole("button", { name: "Confirm decision" })
  await note.fill("  abc")
  const reads: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (
      request.method() === "GET" &&
      [`/api${path}`, `/api${overtimeAdjustments}`].includes(url.pathname)
    )
      reads.push(url.pathname)
  })
  const invalid = overtimeResponse(page, "POST", `${path}/review`)
  await confirm.click()
  expect((await invalid).status()).toBe(400)
  await expect(panel.getByRole("alert")).toHaveText(
    "Provide a valid name or reason",
  )
  await expect(note).toHaveValue("  abc")
  await expect(confirm).toBeEnabled()
  expect(reads).toEqual([])
  await note.fill("HR approval prepared before the competing rejection")

  const rejection = "Superadmin rejection from a separate browser session"
  await recordWinningOvertimeDecision(
    browser,
    new URL(page.url()).origin,
    id,
    "Reject",
    rejection,
  )
  const conflict = overtimeResponse(page, "POST", `${path}/review`)
  await confirm.click()
  expect((await conflict).status()).toBe(409)
  const detail = page.getByRole("dialog", { name: "Overtime request" })
  await expect(detail.getByRole("alert")).toHaveText(
    "This request has already been reviewed",
    { timeout: 5000 },
  )
  await expect(detail.getByText("Rejected", { exact: true })).toBeVisible()
  await expect(detail.getByText(rejection, { exact: true })).toBeVisible()
  await expect(
    detail.getByRole("button", { name: "Confirm decision" }),
  ).toHaveCount(0)
  await expect
    .poll(() => reads)
    .toEqual(
      expect.arrayContaining([`/api${path}`, `/api${overtimeAdjustments}`]),
    )
  await detail.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("row").filter({ has: menu })).toContainText(
    "Rejected",
  )
  await menu.click()
  await expect(
    page.getByRole("menuitem", { name: /Approve request|Reject request/ }),
  ).toHaveCount(0)
  await page.getByRole("menuitem", { name: "View details" }).click()
  await expect(detail.getByText(rejection, { exact: true })).toBeVisible()
})

test("[PG-004-F001-A010-T015] mixed queue reconciles a concurrent overtime decision", async ({
  page,
  browser,
}) => {
  const { id } = await seedOvertimeReview("2026-11-21", true, "correction-dst")
  const path = `${overtimeAdjustments}/${id}`
  const winningNote = `Superadmin rejected mixed-route overtime ${randomUUID()}`
  await signIn(page, "admin")
  await page.goto(overtimeAdjustments)
  const menu = overtimeRowMenu(page, id)
  await expect(menu).toBeVisible()
  await menu.click()
  await page
    .getByRole("menuitem", { name: "Approve request", exact: true })
    .click()
  const review = page.getByRole("dialog", { name: "Approve overtime" })
  await review
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("HR approval prepared before the competing decision")

  await recordWinningOvertimeDecision(
    browser,
    new URL(page.url()).origin,
    id,
    "Reject",
    winningNote,
  )
  const stale = overtimeResponse(page, "POST", `${path}/review`)
  await review
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click()
  const conflict = await stale
  expect(conflict.status()).toBe(409)

  const details = page.getByRole("dialog", { name: "Overtime request" })
  await expect(details.getByRole("alert")).toHaveText(
    "This request has already been reviewed",
  )
  await expect(details.getByText("Rejected", { exact: true })).toBeVisible()
  await expect(details.getByText(winningNote, { exact: true })).toBeVisible()
  await expect(
    details.getByRole("textbox", { name: "Review note", exact: true }),
  ).toHaveCount(0)
  await expect(
    details.getByRole("button", { name: "Confirm decision", exact: true }),
  ).toHaveCount(0)
  await details.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.getByRole("row").filter({ has: menu })).toContainText(
    "Rejected",
  )
  await menu.click()
  await expect(
    page.getByRole("menuitem", { name: "Approve request", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("menuitem", { name: "Reject request", exact: true }),
  ).toHaveCount(0)

  const persisted = await overtimeFixtureCall("admin", path)
  expect(persisted.status, await persisted.clone().text()).toBe(200)
  expect(await persisted.json()).toMatchObject({
    adjustment: {
      id,
      status: "REJECTED",
      reviewNote: winningNote,
      reviewedById: fixture.actors.superadmin.userId,
    },
  })
})

test("overtime conflict shows the winning approval after a stale rejection leaves the filtered queue", async ({
  page,
  browser,
}) => {
  const { id } = await seedOvertimeReview("2026-11-01")
  const path = `${overtimeAdjustments}/${id}`
  await signIn(page, "admin")
  await page.goto(overtimePage)
  await page.getByRole("combobox", { name: "Request status filter" }).click()
  await page.getByRole("option", { name: "Verified", exact: true }).click()
  const menu = overtimeRowMenu(page, id)
  await menu.click()
  await page.getByRole("menuitem", { name: "Reject request" }).click()
  const panel = page.getByRole("dialog", { name: "Reject overtime" })
  await panel
    .getByRole("textbox", { name: "Review note" })
    .fill("HR rejection prepared before the competing approval")
  const approval = "Superadmin approval from a separate browser session"
  await recordWinningOvertimeDecision(
    browser,
    new URL(page.url()).origin,
    id,
    "Approve",
    approval,
  )
  const conflict = overtimeResponse(page, "POST", `${path}/review`)
  await panel.getByRole("button", { name: "Confirm decision" }).click()
  expect((await conflict).status()).toBe(409)
  const detail = page.getByRole("dialog", { name: "Overtime request" })
  await expect(detail.getByRole("alert")).toHaveText(
    "This request has already been reviewed",
  )
  await expect(detail.getByText("Approved", { exact: true })).toBeVisible()
  await expect(detail.getByText(approval, { exact: true })).toBeVisible()
  await expect(
    detail.getByRole("textbox", { name: "Review note" }),
  ).toHaveCount(0)
  await detail.getByRole("button", { name: "Done" }).click()
  await expect(
    page.getByRole("combobox", { name: "Request status filter" }),
  ).toHaveText("Verified")
  await expect(
    page.getByRole("table", { name: "Attendance requests" }),
  ).toHaveAttribute("aria-busy", "false")
  await expect(menu).toHaveCount(0)
})

test("overtime conflict clears private details after the Head loses review access", async ({
  page,
}) => {
  const { id, employee, reason } = await seedOvertimeReview("2026-11-02", false)
  const path = `${overtimeAdjustments}/${id}`
  await signIn(page, "head")
  await page.goto(overtimePage)
  const menu = overtimeRowMenu(page, id)
  await menu.click()
  await page.getByRole("menuitem", { name: "Verify overtime" }).click()
  const panel = page.getByRole("dialog", { name: "Verify overtime" })
  await expect(panel.getByText(reason, { exact: true })).toBeVisible()
  await panel
    .getByRole("textbox", { name: "Review note" })
    .fill("Verification prepared before leadership changed")
  const department = `/departments/${employee.departmentId}`
  const replacement = await overtimeFixtureCall("admin", department, "PUT", {
    headId: fixture.actors["correction-dst"].userId,
  })
  expect(replacement.status, await replacement.text()).toBe(200)
  const recovery = requestGate()
  try {
    await page.route(
      `**/api${path}`,
      async (route) => {
        recovery.start()
        await recovery.pending
        await route.fallback()
      },
      { times: 1 },
    )
    const conflict = overtimeResponse(page, "POST", `${path}/review`)
    const detail = overtimeResponse(page, "GET", path)
    const list = overtimeResponse(page, "GET", overtimeAdjustments)
    await panel.getByRole("button", { name: "Confirm decision" }).click()
    const denied = await conflict
    expect(denied.status()).toBe(403)
    const { error } = (await denied.json()) as { error: string }
    await recovery.started
    await expect(
      page.getByRole("alert").filter({ hasText: error }),
    ).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(menu).toHaveCount(0)
    recovery.release()
    const [detailResult, listResult] = await Promise.all([detail, list])
    expect(detailResult.status()).toBe(404)
    expect(listResult.status()).toBe(403)
    await expect(page.getByText(error, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText(reason, { exact: true })).toHaveCount(0)
    await expect(menu).toHaveCount(0)
    const saved = await overtimeFixtureCall("correction-dst", path)
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({
      adjustment: { status: "PENDING", verifiedById: null, reviewedById: null },
    })
  } finally {
    recovery.release()
    const restored = await overtimeFixtureCall("admin", department, "PUT", {
      headId: fixture.actors.head.userId,
    })
    expect(restored.status, await restored.text()).toBe(200)
  }

  await page.goto(overtimeAdjustments)
  const mixedMenu = overtimeRowMenu(page, id)
  await expect(mixedMenu).toBeVisible()
  await mixedMenu.click()
  await page
    .getByRole("menuitem", { name: "Verify overtime", exact: true })
    .click()
  const mixedPanel = page.getByRole("dialog", { name: "Verify overtime" })
  await expect(mixedPanel.getByText(reason, { exact: true })).toBeVisible()
  await mixedPanel
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("Mixed queue verification prepared before leadership changed")

  const mixedReplacement = await overtimeFixtureCall(
    "admin",
    department,
    "PUT",
    { headId: fixture.actors["correction-dst"].userId },
  )
  expect(mixedReplacement.status, await mixedReplacement.text()).toBe(200)
  const mixedRecovery = requestGate()
  try {
    await page.route(
      `**/api${path}`,
      async (route) => {
        mixedRecovery.start()
        await mixedRecovery.pending
        await route.fallback()
      },
      { times: 1 },
    )
    const mixedConflict = overtimeResponse(page, "POST", `${path}/review`)
    const mixedDetail = overtimeResponse(page, "GET", path)
    const mixedList = overtimeResponse(page, "GET", overtimeAdjustments)
    await mixedPanel
      .getByRole("button", { name: "Confirm decision", exact: true })
      .click()
    const denied = await mixedConflict
    expect(denied.status()).toBe(403)
    const { error } = (await denied.json()) as { error: string }
    await mixedRecovery.started
    await expect(
      page.getByRole("alert").filter({ hasText: error }),
    ).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(mixedMenu).toHaveCount(0)
    mixedRecovery.release()
    const [detailResult, listResult] = await Promise.all([
      mixedDetail,
      mixedList,
    ])
    expect(detailResult.status()).toBe(404)
    expect(listResult.status()).toBe(403)
    await expect(page.getByText(error, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText(reason, { exact: true })).toHaveCount(0)
    await expect(mixedMenu).toHaveCount(0)
    const unchanged = await overtimeFixtureCall("correction-dst", path)
    expect(unchanged.status).toBe(200)
    expect(await unchanged.json()).toMatchObject({
      adjustment: {
        status: "PENDING",
        verifiedById: null,
        reviewedById: null,
      },
    })
  } finally {
    mixedRecovery.release()
    const restored = await overtimeFixtureCall("admin", department, "PUT", {
      headId: fixture.actors.head.userId,
    })
    expect(restored.status, await restored.text()).toBe(200)
  }
})

test("typed attendance deep links enforce request type and backend scope", async ({
  page,
  browser,
}) => {
  const overtime = await seedOvertimeReview("2026-11-03", false)
  const correctionReason = "Private reason for the typed correction link"
  const submitted = await overtimeFixtureCall(
    "staff",
    overtimeAdjustments,
    "POST",
    {
      type: "CORRECTION",
      requestKey: randomUUID(),
      startedAt: "2026-10-28T09:00:00+08:00",
      endedAt: "2026-10-28T09:30:00+08:00",
      reason: correctionReason,
    },
  )
  expect(submitted.status, await submitted.clone().text()).toBe(201)
  const { adjustment: correction } = (await submitted.json()) as {
    adjustment: { id: string; createdAt: string }
  }
  const correctionsPage = "/attendance/requests/corrections"
  const requests = [
    {
      id: overtime.id,
      route: overtimePage,
      wrongRoute: correctionsPage,
      title: "Overtime request",
      reason: overtime.reason,
    },
    {
      id: correction.id,
      route: correctionsPage,
      wrongRoute: overtimePage,
      title: "Attendance correction",
      reason: correctionReason,
    },
  ]
  const unavailable = "Attendance request not found"
  const auditDate = correction.createdAt.slice(0, 10)

  async function snapshot() {
    const details = await Promise.all(
      requests.map(async ({ id }) => {
        const response = await overtimeFixtureCall(
          "head",
          `${overtimeAdjustments}/${id}`,
        )
        expect(response.status).toBe(200)
        return response.json()
      }),
    )
    const audit = await overtimeFixtureCall(
      "head",
      `/attendance/audit?from=${auditDate}&to=${auditDate}&search=AttendanceAdjustment`,
    )
    expect(audit.status, await audit.clone().text()).toBe(200)
    return { details, audit: await audit.json() }
  }
  const before = await snapshot()
  const writes: string[] = []
  function trackAttendanceWrites(target: Page) {
    target.on("request", (request) => {
      const pathname = new URL(request.url()).pathname
      if (
        pathname.startsWith("/api/attendance/") &&
        !["GET", "HEAD"].includes(request.method())
      ) {
        writes.push(`${request.method()} ${pathname}`)
      }
    })
  }
  trackAttendanceWrites(page)
  await signIn(page, "head")
  await page.goto(overtimePage)
  const origin = new URL(page.url()).origin

  async function follow(
    target: Page,
    route: string,
    id: string,
    status: number,
  ) {
    const url = `${origin}${route}?request=${id}`
    const response = overtimeResponse(
      target,
      "GET",
      `${overtimeAdjustments}/${id}`,
    )
    await target.goto(url)
    expect((await response).status()).toBe(status)
    await expect(target).toHaveURL(url)
  }

  for (const { id, route, wrongRoute, title, reason } of requests) {
    await test.step(`${title} opens only on its matching route`, async () => {
      await follow(page, route, id, 200)
      const panel = page.getByRole("dialog", { name: title })
      await expect(panel.getByText(reason, { exact: true })).toBeVisible()

      await follow(page, wrongRoute, id, 200)
      const error = page
        .getByRole("alert")
        .getByText(unavailable, { exact: true })
      async function expectUnavailable() {
        await expect(error.or(panel)).toBeVisible()
        expect
          .soft(await error.isVisible(), `${title} under ${wrongRoute}`)
          .toBe(true)
        expect.soft(await panel.count()).toBe(0)
        expect.soft(await overtimeRowMenu(page, id).count()).toBe(0)
        expect
          .soft(await page.getByText(reason, { exact: true }).count())
          .toBe(0)
      }
      await expectUnavailable()
      const reloaded = overtimeResponse(
        page,
        "GET",
        `${overtimeAdjustments}/${id}`,
      )
      await page.reload()
      expect((await reloaded).status()).toBe(200)
      await expectUnavailable()
      await expect(page).toHaveURL(`${origin}${wrongRoute}?request=${id}`)
    })
  }

  for (const { id, route } of requests) {
    await page.goto(route)
    await expect(overtimeRowMenu(page, id)).toBeVisible()
    const other = requests.find((request) => request.id !== id)
    if (other) await expect(overtimeRowMenu(page, other.id)).toHaveCount(0)
  }
  await follow(page, overtimePage, randomUUID(), 404)
  await expect(
    page.getByRole("alert").getByText(unavailable, { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  const context = await browser.newContext()
  try {
    const outsider = await context.newPage()
    trackAttendanceWrites(outsider)
    await routeAttendanceApi(outsider)
    await signIn(outsider, "correction-dst")
    for (const { id, route, wrongRoute, reason } of requests) {
      for (const path of [route, wrongRoute]) {
        await follow(outsider, path, id, 404)
        await expect(
          outsider.getByRole("alert").getByText(unavailable, { exact: true }),
        ).toBeVisible()
        await expect(outsider.getByRole("dialog")).toHaveCount(0)
        await expect(outsider.getByText(reason, { exact: true })).toHaveCount(0)
      }
    }
  } finally {
    await context.close()
  }
  expect(writes).toEqual([])
  expect(await snapshot()).toEqual(before)
})

test("Superadmin opens organization leave by direct URL and notification", async ({
  page,
}) => {
  await page.unroute("**/api/**")
  await routeAttendanceApi(page, { realNotifications: true })
  await clock("2026-11-13T20:00:00+08:00")
  const reason = "Private reason for the leave navigation fixture"
  const response = await fetch(`${api}/api/leave/requests`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors.staff.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason,
      startDate: "2026-11-18",
      endDate: "2026-11-18",
    }),
  })
  expect(response.status).toBe(201)
  const { request } = (await response.json()) as { request: { id: string } }
  const link = `/attendance/requests/leave?request=${request.id}`

  await signIn(page, "superadmin")
  await page.goto(link)
  const detail = page.getByRole("dialog", { name: "Leave request" })
  await expect(detail.getByText(reason, { exact: true })).toBeVisible()

  await page.goto("/attendance/requests/leave")
  await page
    .getByRole("button", { name: /^Notifications, \d+ unread$/ })
    .click()
  const notice = page
    .getByRole("menuitem", {
      name: /A leave request is awaiting review/,
    })
    .and(page.locator(`[href="${link}"]`))
  await notice.click()
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("request") === request.id,
  )
  await expect(detail.getByText(reason, { exact: true })).toBeVisible()
})

async function leaveFixtureCall(actor: string, suffix: string, body?: unknown) {
  return fetch(`${api}/api${suffix}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${fixture.actors[actor].token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test("WC-I3-F01 Employee Directory transfer routes both Leave review stages to the receiving Head", async ({
  page,
  context,
}) => {
  const subject = "leave-transfer"
  const formerHead = "wc07-origin-head"
  const receivingHead = "wc07-destination-head"
  const employeePath = `/employees/${fixture.actors[subject].employeeId}`
  const inboxPath = "/request-workflows/notifications"
  const portal = "/attendance/requests/leave"
  const inbox = async (actor: string) => {
    const response = await leaveFixtureCall(actor, inboxPath)
    expect(response.status).toBe(200)
    return (await response.json()) as {
      unreadCount: number
      notifications: { id: string; entityId: string; readAt: string | null }[]
    }
  }
  const prepared = await overtimeFixtureCall("admin", employeePath, "PUT", {
    employeeId: "EXP-LEAVE-TRANSFER",
    contactNumber: "09123456789",
    position: "QA Specialist",
    startDate: "2026-01-01",
    email: "leave-transfer@attendance-browser.test",
  })
  expect(prepared.status, await prepared.clone().text()).toBe(200)
  await clock("2026-11-22T00:00:00Z")
  async function submit(date: string, reason: string) {
    const response = await leaveFixtureCall(subject, "/leave/requests", {
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason,
      startDate: date,
      endDate: date,
    })
    expect(response.status, await response.clone().text()).toBe(201)
    const { request } = (await response.json()) as { request: { id: string } }
    return request.id
  }
  const pending = await submit("2026-12-03", "Submitted transfer fixture")
  const verified = await submit("2026-12-04", "Verified transfer fixture")
  const verifiedPath = `/leave/requests/${verified}`
  const decision = {
    actionId: randomUUID(),
    expectedVersion: 1,
    note: "Verified by the original Department Head",
  }
  expect(
    (await leaveFixtureCall(formerHead, `${verifiedPath}/verify`, decision))
      .status,
  ).toBe(200)
  const oldNotice = (await inbox(formerHead)).notifications.find(
    ({ entityId }) => entityId === pending,
  )
  expect(oldNotice).toBeDefined()
  const unreadBefore = (await inbox(receivingHead)).unreadCount

  await signIn(page, "admin")
  await page.goto("/employees")
  await page.getByRole("searchbox", { name: "Search employees" }).fill(subject)
  await page
    .getByRole("button", { name: "More actions for Attendance leave-transfer" })
    .click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  const form = page.getByRole("dialog", { name: "Edit Employee" })
  await form.getByRole("combobox", { name: "Department", exact: true }).click()
  await page.getByRole("option", { name: "WC07 transfer destination" }).click()
  await form.getByRole("combobox", { name: "Team", exact: true }).click()
  await page.getByRole("option", { name: "No Team", exact: true }).click()
  const placement = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api${employeePath}` &&
      response.request().method() === "PUT",
  )
  await form.getByRole("button", { name: "Save Employee" }).click()
  const moved = await placement
  expect(moved.status(), await moved.text()).toBe(200)
  await expect(form).toHaveCount(0)
  const newInbox = await inbox(receivingHead)
  expect(newInbox.unreadCount).toBe(unreadBefore + 2)
  expect(newInbox.notifications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ entityId: pending, readAt: null }),
      expect.objectContaining({ entityId: verified, readAt: null }),
    ]),
  )
  expect((await leaveFixtureCall(formerHead, verifiedPath)).status).toBe(404)
  expect(
    (await leaveFixtureCall(formerHead, `${verifiedPath}/verify`, decision))
      .status,
  ).toBe(404)
  expect(
    (
      await overtimeFixtureCall(
        formerHead,
        `${inboxPath}/${oldNotice!.id}/read`,
        "PATCH",
      )
    ).status,
  ).toBe(404)

  const reviewer = await context.newPage()
  await routeAttendanceApi(reviewer, { realNotifications: true })
  await signIn(reviewer, receivingHead)
  await reviewer.goto(new URL(portal, page.url()).href)
  const bell = reviewer.getByRole("button", {
    name: /^Notifications, \d+ unread$/,
  })
  for (const [id, reason] of [
    [pending, "Submitted transfer fixture"],
    [verified, "Verified transfer fixture"],
  ]) {
    const link = `${portal}?request=${id}`
    await bell.click()
    await reviewer
      .getByRole("menuitem")
      .and(reviewer.locator(`[href="${link}"]`))
      .click()
    await expect(reviewer).toHaveURL(
      (url) => url.pathname + url.search === link,
    )
    const detail = reviewer.getByRole("dialog", { name: "Leave request" })
    await expect(detail.getByText(reason, { exact: true })).toBeVisible()
    await expect
      .poll(
        async () =>
          (await inbox(receivingHead)).notifications.find(
            ({ entityId }) => entityId === id,
          )?.readAt,
      )
      .toEqual(expect.any(String))
    await detail.getByRole("button", { name: "Close", exact: true }).click()
  }
  expect((await inbox(receivingHead)).unreadCount).toBe(unreadBefore)
  await reviewer.locator(`[id="leave-actions-${verified}"]`).click()
  await reviewer.getByRole("menuitem", { name: "Verify request" }).click()
  const review = reviewer.getByRole("dialog", { name: "Verify request" })
  await review
    .getByLabel("Decision note")
    .fill("Verified by the receiving Department Head")
  const reviewResponse = reviewer.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api${verifiedPath}/verify`,
  )
  await review.getByRole("button", { name: "Verify request" }).click()
  const result = await reviewResponse
  expect(result.status()).toBe(200)
  expect(await result.json()).toMatchObject({
    request: {
      status: "VERIFIED",
      version: 3,
      routeDepartmentId: fixture.transferDestinationId,
      capabilities: { requiresReverification: false },
    },
  })
})

async function seedLeaveReview(date: string, verify = true) {
  const result = await leaveFixtureCall("staff", "/leave/requests", {
    requestKey: randomUUID(),
    type: "ANNUAL",
    reason: `Private leave fixture for ${date}`,
    startDate: date,
    endDate: date,
  })
  expect(result.status).toBe(201)
  const { request } = (await result.json()) as { request: { id: string } }
  const path = `/leave/requests/${request.id}`
  if (!verify) return path
  const verified = await leaveFixtureCall("head", `${path}/verify`, {
    actionId: randomUUID(),
    expectedVersion: 1,
    note: "Verified by the Department Head",
  })
  expect(verified.status).toBe(200)
  return path
}

test("stale HR approval refreshes leave after Superadmin rejection", async ({
  page,
  browser,
}) => {
  const path = await seedLeaveReview("2026-12-15")
  const portal = "/attendance/requests/leave"
  const rowMenu = page.locator(`[id="leave-actions-${path.split("/").at(-1)}"]`)
  await signIn(page, "admin")
  await page.goto(portal)
  await rowMenu.click()
  await page.getByRole("menuitem", { name: "Approve request" }).click()
  const approval = page.getByRole("dialog", { name: "Approve request" })
  const note = approval.getByLabel("Decision note")
  const approve = approval.getByRole("button", { name: "Approve request" })
  await note.fill("  abc")
  await approve.click()
  await expect(
    approval.getByText("Provide a valid decision note"),
  ).toBeVisible()
  await expect(note).toHaveValue("  abc")
  await expect(note).toBeEditable()
  await note.fill("HR approval prepared earlier")

  await page.route(
    `**/api${path}/approve`,
    (route) =>
      route.fulfill({
        status: 409,
        json: { error: "Action ID has already been used" },
      }),
    { times: 1 },
  )
  await approve.click()
  await expect(
    approval.getByText("Action ID has already been used"),
  ).toBeVisible()
  await expect(note).toHaveValue("HR approval prepared earlier")
  await expect(note).toBeEditable()

  const winner = await browser.newContext()
  try {
    const supervisor = await winner.newPage()
    await routeAttendanceApi(supervisor)
    await signIn(supervisor, "superadmin")
    await supervisor.goto(`${new URL(page.url()).origin}${portal}`)
    await supervisor
      .locator(`[id="leave-actions-${path.split("/").at(-1)}"]`)
      .click()
    await supervisor.getByRole("menuitem", { name: "Reject request" }).click()
    const rejection = supervisor.getByRole("dialog", { name: "Reject request" })
    await rejection
      .getByLabel("Decision note")
      .fill("Superadmin rejected this request")
    const committed = supervisor.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api${path}/reject`,
    )
    await rejection.getByRole("button", { name: "Reject request" }).click()
    expect((await committed).status()).toBe(200)
  } finally {
    await winner.close()
  }

  const conflict = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api${path}/approve`,
  )
  await approve.click()
  expect((await conflict).status()).toBe(409)
  await expect(
    page.getByText("Leave request changed; refresh and try again", {
      exact: true,
    }),
  ).toBeVisible()
  const detail = page.getByRole("dialog", { name: "Leave request" })
  await expect(detail.getByText("Rejected", { exact: true })).toBeVisible()
  await expect(
    detail.getByText("Superadmin rejected this request"),
  ).toBeVisible()
  await expect(
    detail.getByRole("button", { name: "Approve request" }),
  ).toHaveCount(0)
  await detail.getByRole("button", { name: "Close leave request" }).click()
  await expect(page.getByRole("row").filter({ has: rowMenu })).toContainText(
    "Rejected",
  )
  await rowMenu.click()
  await expect(
    page.getByRole("menuitem", { name: "Approve request" }),
  ).toHaveCount(0)
  await page.getByRole("menuitem", { name: "View details" }).click()
  await expect(detail.getByText("Rejected", { exact: true })).toBeVisible()

  const saved = await leaveFixtureCall("admin", path)
  const { request } = (await saved.json()) as {
    request: { decisions: { action: string }[] }
  }
  expect(request.decisions.map(({ action }) => action)).toEqual([
    "SUBMITTED",
    "VERIFIED",
    "REJECTED",
  ])
  const inbox = await leaveFixtureCall(
    "staff",
    "/request-workflows/notifications",
  )
  const { notifications } = (await inbox.json()) as {
    notifications: { leaveRequestId: string; type: string }[]
  }
  expect(
    notifications
      .filter(({ leaveRequestId }) => path.endsWith(`/${leaveRequestId}`))
      .map(({ type }) => type)
      .sort(),
  ).toEqual(["LEAVE_REJECTED", "LEAVE_VERIFIED"])
})

const requestsOverviewPage = "/attendance/requests/overview"
const overviewSources = {
  adjustments: "/attendance/adjustments/overview",
  leave: "/leave/overview",
} as const
type OverviewSource = keyof typeof overviewSources
type OverviewScope = "team" | "mine"

function overviewQuery(source: OverviewSource, scope: OverviewScope) {
  return `${overviewSources[source]}?scope=${scope}`
}

function overviewResponse(
  page: Page,
  source: OverviewSource,
  scope: OverviewScope,
) {
  return page.waitForResponse((response) =>
    response.url().endsWith(`/api${overviewQuery(source, scope)}`),
  )
}

async function holdOverview(
  page: Page,
  source: OverviewSource,
  scope: OverviewScope,
  omitAuthorization = false,
) {
  const gate = requestGate()
  let finish!: () => void
  const finished = new Promise<void>((resolve) => (finish = resolve))
  const path = `/api${overviewQuery(source, scope)}`
  await page.route(
    `**${path}`,
    async (route) => {
      try {
        const response = await route.fetch({
          url: `${api}${path}`,
          ...(omitAuthorization ? { headers: { authorization: "" } } : {}),
        })
        expect(response.status()).toBe(omitAuthorization ? 401 : 200)
        gate.start()
        await gate.pending
        await route.fulfill({ response })
      } finally {
        finish()
      }
    },
    { times: 1 },
  )
  return { ...gate, finished }
}

function overviewSections(page: Page) {
  return {
    figures: page.getByLabel("Request figures"),
    status: page.getByRole("region", { name: "Request status", exact: true }),
    attention: page.getByRole("region", { name: "Needs attention" }),
    leave: page.getByRole("region", { name: "Leave", exact: true }),
    corrections: page.getByRole("region", { name: "Corrections", exact: true }),
    overtime: page.getByRole("region", { name: "Overtime", exact: true }),
    scope: page.getByRole("group", { name: "Request summary view" }),
  }
}

async function overviewTotals(actor: string, scope: OverviewScope) {
  const [adjustments, leave] = await Promise.all(
    (["adjustments", "leave"] as const).map(async (source) => {
      const response = await leaveFixtureCall(
        actor,
        overviewQuery(source, scope),
      )
      expect(response.status).toBe(200)
      const { groups } = (await response.json()) as {
        groups: { count: number; status: string; type: string }[]
      }
      return groups
    }),
  )
  const count = (groups: typeof adjustments) =>
    groups.reduce((sum, group) => sum + group.count, 0)
  const groups = [...adjustments, ...leave]
  return {
    total: count(groups),
    leave: count(leave),
    corrections: count(
      adjustments.filter((group) => group.type === "CORRECTION"),
    ),
    overtime: count(adjustments.filter((group) => group.type === "OVERTIME")),
    pending: count(
      groups.filter(({ status }) => ["PENDING", "SUBMITTED"].includes(status)),
    ),
    awaiting: count(
      groups.filter(({ status }) =>
        ["PENDING", "SUBMITTED", "VERIFIED"].includes(status),
      ),
    ),
  }
}

async function expectOverviewTotals(
  page: Page,
  totals: Awaited<ReturnType<typeof overviewTotals>>,
) {
  const ui = overviewSections(page)
  await expect(
    ui.status.getByText(`${totals.total} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.attention.getByText(`${totals.awaiting} awaiting`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.leave.getByText(`${totals.leave} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.corrections.getByText(`${totals.corrections} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.overtime.getByText(`${totals.overtime} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.figures.getByRole("definition").first().locator("span").first(),
  ).toHaveText(String(totals.pending))
  if (totals.total > 0) {
    const pending = ui.status.getByRole("row").filter({
      has: page.getByRole("cell", { name: "Pending", exact: true }),
    })
    await expect(pending.getByRole("cell").nth(1)).toHaveText(
      String(totals.pending),
    )
    await expect(pending.getByRole("cell").nth(2)).toHaveText(
      `${Math.round((totals.pending / totals.total) * 100)}%`,
    )
  }
}

async function expectCombinedUnavailable(page: Page, pending = false) {
  const ui = overviewSections(page)
  await expect(ui.figures).toHaveAttribute("aria-busy", String(pending))
  await expect(ui.figures.getByRole("definition")).toHaveText(
    pending ? ["", "", "", ""] : ["—", "—", "—", "—"],
  )
  await expect(ui.status.getByRole("table")).toHaveCount(0)
  await expect(ui.status.getByText(/\d+ total/)).toHaveCount(0)
  await expect(ui.attention.getByText(/\d+ awaiting/)).toHaveCount(0)
  await expect(ui.attention.getByRole("definition")).toHaveCount(0)
  if (!pending) {
    await expect(
      ui.status.getByText("Request summaries unavailable."),
    ).toBeVisible()
    await expect(
      ui.attention.getByText("Request summaries unavailable."),
    ).toBeVisible()
  }
}

test.describe("WC-06-F01 Requests Overview", () => {
  let adjustmentPath: string
  let leavePath: string
  let departmentPath: string

  test.beforeAll(async () => {
    await clock("2026-11-13T20:00:00+08:00")
    leavePath = await seedLeaveReview("2026-12-21")
    const headLeave = await leaveFixtureCall("head", "/leave/requests", {
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason: "Personal leave for overview scope comparison",
      startDate: "2026-12-22",
      endDate: "2026-12-22",
    })
    expect(headLeave.status).toBe(201)
    const adjustment = await leaveFixtureCall("staff", overtimeAdjustments, {
      type: "CORRECTION",
      requestKey: randomUUID(),
      startedAt: "2026-10-20T09:00:00+08:00",
      endedAt: "2026-10-20T10:00:00+08:00",
      reason: "Missing time for overview scope comparison",
    })
    expect(adjustment.status).toBe(201)
    const {
      adjustment: { id },
    } = (await adjustment.json()) as { adjustment: { id: string } }
    adjustmentPath = `${overtimeAdjustments}/${id}`
    const detail = await leaveFixtureCall("head", leavePath)
    expect(detail.status).toBe(200)
    const {
      request: { employee },
    } = (await detail.json()) as {
      request: { employee: { departmentId: string } }
    }
    departmentPath = `/departments/${employee.departmentId}`
  })

  test("waits for both scopes and ignores an older response without writing", async ({
    page,
  }) => {
    const snapshot = () =>
      Promise.all(
        [adjustmentPath, leavePath, "/request-workflows/notifications"].map(
          async (path) => {
            const response = await leaveFixtureCall("staff", path)
            expect(response.status).toBe(200)
            return response.json()
          },
        ),
      )
    const before = await snapshot()
    const writes: string[] = []
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname
      if (
        /^\/api\/(attendance|leave|request-workflows)\//.test(pathname) &&
        request.method() !== "GET"
      )
        writes.push(`${request.method()} ${pathname}`)
    })
    const team = await overviewTotals("head", "team")
    const mine = await overviewTotals("head", "mine")
    expect(team.leave).toBeGreaterThan(mine.leave)
    await signIn(page, "head")
    await page.goto(requestsOverviewPage)
    await expectOverviewTotals(page, team)

    const ui = overviewSections(page)
    const myLeave = await holdOverview(page, "leave", "mine")
    try {
      const adjustments = overviewResponse(page, "adjustments", "mine")
      await ui.scope.getByRole("button", { name: "My requests" }).click()
      expect((await adjustments).status()).toBe(200)
      await myLeave.started
      await expect(
        ui.corrections.getByText(`${mine.corrections} total`),
      ).toBeVisible()
      await expectCombinedUnavailable(page, true)
      await expect(ui.leave.getByText(/\d+ total/)).toHaveCount(0)
    } finally {
      myLeave.release()
    }
    await expectOverviewTotals(page, mine)

    const teamAdjustments = await holdOverview(page, "adjustments", "team")
    const teamLeave = await holdOverview(page, "leave", "team")
    try {
      await ui.scope
        .getByRole("button", { name: "Department requests" })
        .click()
      await Promise.all([teamAdjustments.started, teamLeave.started])
      await expectCombinedUnavailable(page, true)
      await expect(ui.corrections.getByText(/\d+ total/)).toHaveCount(0)
      await expect(ui.leave.getByText(/\d+ total/)).toHaveCount(0)
      teamAdjustments.release()
      await expect(
        ui.corrections.getByText(`${team.corrections} total`),
      ).toBeVisible()
      await expectCombinedUnavailable(page, true)
      await ui.scope.getByRole("button", { name: "My requests" }).click()
      await expectOverviewTotals(page, mine)
    } finally {
      teamAdjustments.release()
      teamLeave.release()
    }
    await teamLeave.finished
    await expectOverviewTotals(page, mine)
    expect(writes).toEqual([])
    expect(await snapshot()).toEqual(before)
  })

  test("clears prior department totals when the Head receives real 403 responses", async ({
    page,
  }) => {
    await signIn(page, "head")
    await page.goto(requestsOverviewPage)
    await expectOverviewTotals(page, await overviewTotals("head", "team"))
    const ui = overviewSections(page)
    const mine = await holdOverview(page, "leave", "mine")
    try {
      await ui.scope.getByRole("button", { name: "My requests" }).click()
      await mine.started
      const revoked = await overtimeFixtureCall(
        "admin",
        departmentPath,
        "PUT",
        { headId: null },
      )
      expect(revoked.status).toBe(200)
      const responses = [
        overviewResponse(page, "adjustments", "team"),
        overviewResponse(page, "leave", "team"),
      ]
      await ui.scope
        .getByRole("button", { name: "Department requests" })
        .click()
      const results = await Promise.all(responses)
      expect(results.map((result) => result.status())).toEqual([403, 403])
      const { error } = (await results[0].json()) as { error: string }
      await expect(
        page.getByRole("alert").filter({ hasText: error }),
      ).toBeVisible()
      await expectCombinedUnavailable(page)
      for (const section of [ui.leave, ui.corrections, ui.overtime])
        await expect(section.getByText(/\d+ total/)).toHaveCount(0)
      mine.release()
      await mine.finished
      await expectCombinedUnavailable(page)
    } finally {
      mine.release()
      const restored = await overtimeFixtureCall(
        "admin",
        departmentPath,
        "PUT",
        { headId: fixture.actors.head.userId },
      )
      expect(restored.status).toBe(200)
    }
  })

  test("hides successful sibling counts after a real 401 response", async ({
    page,
  }) => {
    await signIn(page, "head")
    await page.goto(requestsOverviewPage)
    await expectOverviewTotals(page, await overviewTotals("head", "team"))
    const ui = overviewSections(page)
    const leaveDenied = await holdOverview(page, "leave", "mine", true)
    try {
      const adjustment = overviewResponse(page, "adjustments", "mine")
      await ui.scope.getByRole("button", { name: "My requests" }).click()
      expect((await adjustment).status()).toBe(200)
      await expect(ui.corrections.getByText(/\d+ total/)).toBeVisible()
      await leaveDenied.started
      const denied = overviewResponse(page, "leave", "mine")
      leaveDenied.release()
      expect((await denied).status()).toBe(401)
      await expect(
        page.getByRole("alert").filter({ hasText: "Authentication required" }),
      ).toBeVisible()
      await expectCombinedUnavailable(page)
      for (const section of [ui.leave, ui.corrections, ui.overtime])
        await expect(section.getByText(/\d+ total/)).toHaveCount(0)
    } finally {
      leaveDenied.release()
    }
  })

  for (const failed of [
    ["leave"],
    ["adjustments"],
    ["adjustments", "leave"],
  ] as const) {
    test(`preserves current data and retries a 503 from ${failed.join(" and ")}`, async ({
      page,
    }) => {
      const team = await overviewTotals("head", "team")
      await signIn(page, "head")
      const unavailable = new Set<OverviewSource>(failed)
      for (const source of failed) {
        await page.route(
          `**/api${overviewQuery(source, "team")}`,
          (route) =>
            route.fulfill({
              status: 503,
              json: { error: `${source} temporarily unavailable` },
            }),
          { times: 1 },
        )
      }
      const responses = [
        overviewResponse(page, "adjustments", "team"),
        overviewResponse(page, "leave", "team"),
      ]
      await page.goto(requestsOverviewPage)
      expect(
        (await Promise.all(responses)).map((response) => response.status()),
      ).toEqual([
        unavailable.has("adjustments") ? 503 : 200,
        unavailable.has("leave") ? 503 : 200,
      ])
      const ui = overviewSections(page)
      const sections = [
        {
          source: "adjustments",
          section: ui.corrections,
          count: team.corrections,
          error: "Request summaries unavailable.",
        },
        {
          source: "leave",
          section: ui.leave,
          count: team.leave,
          error: "Leave request summaries unavailable.",
        },
      ] as const
      for (const { source, section, count, error } of sections) {
        if (unavailable.has(source)) {
          await expect(section.getByText(error, { exact: true })).toBeVisible()
          await expect(section.getByText(/\d+ total/)).toHaveCount(0)
        } else {
          await expect(
            section.getByText(`${count} total`, { exact: true }),
          ).toBeVisible()
        }
      }
      await expectCombinedUnavailable(page)
      const retries = await Promise.all(
        failed.map((source) => holdOverview(page, source, "team")),
      )
      try {
        await page.getByRole("button", { name: "Retry", exact: true }).click()
        await Promise.all(retries.map((retry) => retry.started))
        await expectCombinedUnavailable(page, true)
        for (const { source, section, count } of sections) {
          if (!unavailable.has(source))
            await expect(
              section.getByText(`${count} total`, { exact: true }),
            ).toBeVisible()
        }
      } finally {
        for (const retry of retries) retry.release()
      }
      await expectOverviewTotals(page, team)
    })
  }

  for (const { actor, initial, toggle } of [
    { actor: "staff", initial: "mine", toggle: false },
    { actor: "admin", initial: "team", toggle: true },
    { actor: "superadmin", initial: "team", toggle: false },
  ] as const) {
    test(`shows the authorized ${actor} overview scope`, async ({ page }) => {
      await signIn(page, actor)
      await page.goto(requestsOverviewPage)
      await expectOverviewTotals(page, await overviewTotals(actor, initial))
      const ui = overviewSections(page)
      await expect(ui.scope).toHaveCount(toggle ? 1 : 0)
      if (toggle) {
        await expect(
          ui.scope.getByRole("button", { name: "Organization requests" }),
        ).toHaveAttribute("aria-pressed", "true")
        await ui.scope.getByRole("button", { name: "My requests" }).click()
        await expectOverviewTotals(page, await overviewTotals(actor, "mine"))
      }
    })
  }
})

test("WC-06-F03 accounts for terminal Leave and groups matching review stages", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000)
  const requester = "wc06-requester"
  const head = "wc06-head"
  await clock("2026-11-13T20:00:00+08:00")
  const requestPaths: string[] = []
  async function submitLeave(day: number, type: "ANNUAL" | "SICK" = "ANNUAL") {
    const date = `2026-12-${day}`
    const result = await leaveFixtureCall(requester, "/leave/requests", {
      requestKey: randomUUID(),
      type,
      reason: `Overview fixture for ${date}`,
      startDate: date,
      endDate: date,
    })
    expect(result.status).toBe(201)
    const { request } = (await result.json()) as { request: { id: string } }
    const path = `/leave/requests/${request.id}`
    requestPaths.push(path)
    return path
  }

  async function decide(
    actor: string,
    path: string,
    action: string,
    version = 1,
  ) {
    const result = await leaveFixtureCall(actor, `${path}/${action}`, {
      actionId: randomUUID(),
      expectedVersion: version,
      note: `Synthetic ${action} decision`,
    })
    expect(result.status, await result.clone().text()).toBe(200)
  }

  await submitLeave(10)
  await submitLeave(11, "SICK")
  await decide("superadmin", await submitLeave(12), "approve")
  await decide(requester, await submitLeave(13), "cancel")
  const correction = await leaveFixtureCall(requester, overtimeAdjustments, {
    type: "CORRECTION",
    requestKey: randomUUID(),
    reason: "Synthetic missing time",
    startedAt: "2026-10-20T09:00:00+08:00",
    endedAt: "2026-10-20T10:00:00+08:00",
  })
  expect(correction.status).toBe(201)
  const { adjustment } = (await correction.json()) as {
    adjustment: { id: string }
  }
  const correctionPath = `${overtimeAdjustments}/${adjustment.id}`
  requestPaths.push(correctionPath)
  const verification = await leaveFixtureCall(
    head,
    `${correctionPath}/review`,
    {
      decision: "APPROVED",
      note: "Synthetic correction verification",
    },
  )
  expect(verification.status).toBe(200)
  expect(await verification.json()).toMatchObject({
    adjustment: { status: "VERIFIED" },
  })

  const writes: string[] = []
  function trackWrites(target: Page) {
    target.on("request", (request) => {
      const pathname = new URL(request.url()).pathname
      if (
        /^\/api\/(attendance|leave|request-workflows)\//.test(pathname) &&
        request.method() !== "GET"
      )
        writes.push(`${request.method()} ${pathname}`)
    })
  }
  trackWrites(page)
  await signIn(page, head)
  await page.goto(requestsOverviewPage)
  const ui = overviewSections(page)

  async function tableRows(section: typeof ui.status) {
    const rows = section
      .getByRole("row")
      .filter({ has: page.getByRole("cell") })
    return Promise.all(
      (await rows.all()).map(async (row) =>
        (await row.getByRole("cell").allTextContents()).map((cell) =>
          cell.trim(),
        ),
      ),
    )
  }

  async function attentionRows() {
    const labels = await ui.attention.getByRole("term").allTextContents()
    const values = await ui.attention.getByRole("definition").allTextContents()
    return labels
      .map((label, index) => `${label} ${values[index].trim()}`)
      .sort()
  }

  const five = await overviewTotals(head, "team")
  expect(five).toMatchObject({
    total: 5,
    corrections: 1,
    leave: 4,
    pending: 2,
    awaiting: 3,
  })
  await expectOverviewTotals(page, five)
  const initialRows = await tableRows(ui.status)
  expect
    .soft(initialRows.reduce((sum, [, count]) => sum + Number(count), 0))
    .toBe(5)
  expect.soft(initialRows).toContainEqual(["Cancelled", "1", "20%"])
  expect.soft(await tableRows(ui.leave)).toEqual([
    ["Submitted", "2"],
    ["Approved", "1"],
    ["Cancelled", "1"],
  ])
  expect
    .soft(await attentionRows())
    .toEqual(["Correction 1 awaiting HR", "Leave 2 pending"])
  expect(test.info().errors).toHaveLength(0)

  await decide(head, await submitLeave(14, "SICK"), "verify")
  await decide(head, await submitLeave(15), "reject")
  const reversed = await submitLeave(16)
  await decide("superadmin", reversed, "approve")
  await decide("admin", reversed, "reverse", 2)
  const overtime = await seedOvertimeReview("2026-11-12", false, requester)
  requestPaths.push(`${overtimeAdjustments}/${overtime.id}`)

  async function snapshot() {
    const auditDate = new Date().toISOString().slice(0, 10)
    const auditPath = `/attendance/audit?from=${auditDate}&to=${auditDate}&departmentId=${overtime.employee.departmentId}`
    const reads = [
      ...[...requestPaths, auditPath].map((path) =>
        leaveFixtureCall("superadmin", path),
      ),
      ...[requester, head, "admin", "superadmin"].map((actor) =>
        leaveFixtureCall(actor, "/request-workflows/notifications"),
      ),
    ]
    return Promise.all(
      (await Promise.all(reads)).map(async (response) => {
        expect(response.status).toBe(200)
        return response.json()
      }),
    )
  }
  const before = await snapshot()
  const full = await overviewTotals(head, "team")
  expect(full).toMatchObject({
    total: 9,
    overtime: 1,
    corrections: 1,
    leave: 7,
    pending: 3,
    awaiting: 5,
  })
  await page.reload()
  await expectOverviewTotals(page, full)
  const expectedRows = [
    ["Pending", "3", "33%"],
    ["Verified", "2", "22%"],
    ["Approved", "1", "11%"],
    ["Rejected", "1", "11%"],
    ["Cancelled", "1", "11%"],
    ["Reversed", "1", "11%"],
  ]
  expect(await tableRows(ui.status)).toEqual(expectedRows)
  expect(await tableRows(ui.leave)).toEqual([
    ["Submitted", "2"],
    ["Verified", "1"],
    ["Approved", "1"],
    ["Rejected", "1"],
    ["Cancelled", "1"],
    ["Reversed", "1"],
  ])
  expect(await attentionRows()).toEqual([
    "Correction 1 awaiting HR",
    "Leave 1 awaiting HR",
    "Leave 2 pending",
    "Overtime 1 pending",
  ])

  const mine = ui.scope.getByRole("button", { name: "My requests" })
  const team = ui.scope.getByRole("button", { name: "Department requests" })
  async function expectEmpty() {
    await expect(ui.status.getByText("0 total", { exact: true })).toBeVisible()
    await expect(
      ui.status.getByText("No requests in this scope."),
    ).toBeVisible()
    await expect(ui.status.getByRole("table")).toHaveCount(0)
    await expect(
      ui.attention.getByText("0 awaiting", { exact: true }),
    ).toBeVisible()
  }
  await mine.click()
  await expectEmpty()
  const older = await holdOverview(page, "leave", "team")
  try {
    await team.click()
    await older.started
    await expectCombinedUnavailable(page, true)
    await mine.click()
    await expectEmpty()
  } finally {
    older.release()
  }
  await older.finished
  await expectEmpty()

  const leaveTeamPath = `/api${overviewQuery("leave", "team")}`
  await page.route(
    `**${leaveTeamPath}`,
    (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Synthetic retryable failure" },
      }),
    { times: 1 },
  )
  await team.click()
  await expectCombinedUnavailable(page)
  await expect(ui.overtime.getByText("1 total", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expectOverviewTotals(page, full)
  expect(await tableRows(ui.status)).toEqual(expectedRows)

  await page.route(
    `**${leaveTeamPath}`,
    async (route) => {
      const denied = await leaveFixtureCall(
        requester,
        overviewQuery("leave", "team"),
      )
      expect(denied.status).toBe(403)
      await route.fulfill({ status: denied.status, json: await denied.json() })
    },
    { times: 1 },
  )
  await page.reload()
  await expectCombinedUnavailable(page)
  await expect(ui.leave.getByText(/\d+ total/)).toHaveCount(0)
  await expect(ui.corrections.getByText(/\d+ total/)).toHaveCount(0)

  const origin = new URL(page.url()).origin
  for (const [actor, scope] of [
    [requester, "mine"],
    ["admin", "team"],
    ["superadmin", "team"],
  ] as const) {
    const context = await browser.newContext()
    try {
      const reviewer = await context.newPage()
      await routeAttendanceApi(reviewer)
      trackWrites(reviewer)
      await signIn(reviewer, actor)
      await reviewer.goto(origin + requestsOverviewPage)
      await expectOverviewTotals(reviewer, await overviewTotals(actor, scope))
      const status = overviewSections(reviewer).status
      for (const terminal of ["Cancelled", "Reversed"]) {
        const row = status.getByRole("row").filter({
          has: reviewer.getByRole("cell", { name: terminal, exact: true }),
        })
        await expect(row.getByRole("cell").nth(1)).toHaveText(/^[1-9]\d*$/)
      }
      await reviewer.unrouteAll({ behavior: "wait" })
    } finally {
      await context.close()
    }
  }
  expect(writes).toEqual([])
  expect(await snapshot()).toEqual(before)
  await clock("2026-11-13T20:00:00+08:00")
})

test("stale leave refresh clears details when Head access is revoked", async ({
  page,
}) => {
  const path = await seedLeaveReview("2026-12-16", false)
  const authorized = await leaveFixtureCall("head", path)
  expect(authorized.status).toBe(200)
  const { request } = (await authorized.json()) as {
    request: { employee: { departmentId: string }; reason: string }
  }
  await signIn(page, "head")
  await page.goto("/attendance/requests/leave")
  const rowMenu = page.locator(`[id="leave-actions-${path.split("/").at(-1)}"]`)
  await rowMenu.click()
  await page.getByRole("menuitem", { name: "Verify request" }).click()
  const panel = page.getByRole("dialog", { name: "Verify request" })
  await expect(panel.getByText(request.reason)).toBeVisible()
  await panel.getByLabel("Decision note").fill("Verification prepared earlier")

  const rejected = await leaveFixtureCall("superadmin", `${path}/reject`, {
    actionId: randomUUID(),
    expectedVersion: 1,
    note: "Superadmin rejected before verification",
  })
  expect(rejected.status).toBe(200)
  await page.route(
    `**/api${path}`,
    async (route) => {
      const response = await fetch(
        `${api}/api/departments/${request.employee.departmentId}`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${fixture.actors.admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ headId: null }),
        },
      )
      expect(response.status).toBe(200)
      await route.fallback()
    },
    { times: 1 },
  )
  const detail = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === `/api${path}`,
  )
  await panel.getByRole("button", { name: "Verify request" }).click()
  expect((await detail).status()).toBe(404)
  await expect(
    page.getByText("Leave request changed; refresh and try again", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText(request.reason)).toHaveCount(0)
  await expect(rowMenu).toHaveCount(0)
})
