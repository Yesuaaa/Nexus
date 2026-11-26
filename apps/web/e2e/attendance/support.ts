import { test, expect, type Locator, type Page } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { defaultPreferences } from "../../src/features/settings/api/settings-api"
import type { AttendancePolicy } from "../../src/features/attendance/api/attendance-api"

type Fixture = {
  secret: string
  transferDestinationId: string
  pagingEmployeeId: string
  actors: Record<
    string,
    { token: string; refreshToken: string; employeeId: string; userId: string }
  >
}
type PolicyOverviewFixture = AttendancePolicy & {
  archivedAt: string | null
  createdAt: string
  _count: { assignments: number }
}
export type PolicyOverviewSummary = {
  totalPolicies: number
  activePolicies: number
  archivedPolicies: number
  assignmentPeriods: number
}
type PolicyOverviewPage = {
  page: number
  pageSize: number
  total: number
  summary: PolicyOverviewSummary
  policies: PolicyOverviewFixture[]
}
export let fixture: Fixture
let server: ChildProcess
export const api = "http://127.0.0.1:5391"
export async function routeAttendanceApi(
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

export async function signIn(page: Page, actor: string) {
  await page.addInitScript((session) => {
    sessionStorage.setItem("nexus.auth.token", session.token)
    sessionStorage.setItem("nexus.auth.refreshToken", session.refreshToken)
  }, fixture.actors[actor])
}
export async function setSession(page: Page, actor: string) {
  await page.evaluate((session) => {
    sessionStorage.clear()
    sessionStorage.setItem("nexus.auth.token", session.token)
    sessionStorage.setItem("nexus.auth.refreshToken", session.refreshToken)
  }, fixture.actors[actor])
}
export async function createApprovedCorrection(
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
export async function approveCorrection(id: string) {
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
export async function clock(value: string) {
  const response = await fetch(`${api}/__attendance_clock`, {
    method: "POST",
    headers: { "x-attendance-fixture": fixture.secret },
    body: value,
  })
  expect(response.status).toBe(204)
}
export async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: label, exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

export function policyOverviewFixture(
  id: string,
  name: string,
  overrides: Partial<PolicyOverviewFixture> = {},
): PolicyOverviewFixture {
  return {
    id,
    name,
    timeZone: "Asia/Manila",
    scheduleMode: "FLEXIBLE",
    archivedAt: null,
    unpaidBreaksEnabled: true,
    overnightRequiresReview: false,
    createdAt: "2026-11-20T00:00:00.000Z",
    days: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isWorkingDay: true,
      requiredMinutes: 480,
      scheduledStartMinute: null,
      scheduledEndMinute: null,
      scheduledUnpaidBreakMinutes: null,
    })),
    _count: { assignments: 0 },
    ...overrides,
  }
}

function policyOverviewSummary(
  policies: readonly PolicyOverviewFixture[],
): PolicyOverviewSummary {
  const activePolicies = policies.filter(({ archivedAt }) => !archivedAt).length
  return {
    totalPolicies: policies.length,
    activePolicies,
    archivedPolicies: policies.length - activePolicies,
    assignmentPeriods: policies.reduce(
      (sum, policy) => sum + policy._count.assignments,
      0,
    ),
  }
}

export function policyOverviewPage(
  policies: PolicyOverviewFixture[],
  options: Partial<
    Pick<PolicyOverviewPage, "page" | "pageSize" | "total" | "summary">
  > = {},
): PolicyOverviewPage {
  return {
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 200,
    total: options.total ?? policies.length,
    summary: options.summary ?? policyOverviewSummary(policies),
    policies,
  }
}

export function policyOverviewSection(page: Page, heading: string) {
  return page
    .getByRole("heading", { name: heading, exact: true })
    .locator("xpath=ancestor::section[1]")
}

export function policyFigureValue(page: Page, label: string) {
  return page
    .getByLabel("Policy figures")
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd[1]")
}

export async function focusLinkByTab(page: Page, link: Locator) {
  const focusableCount = await page
    .locator("a[href], button:not([disabled])")
    .count()
  for (let index = 0; index <= focusableCount; index += 1) {
    await page.keyboard.press("Tab")
    if (await link.evaluate((element) => element === document.activeElement))
      return
  }
  throw new Error("Keyboard Tab navigation did not reach the expected link")
}

export async function openMockedPolicyOverview(
  page: Page,
  response: PolicyOverviewPage,
) {
  await signIn(page, "admin")
  await page.route("**/api/attendance/policies**", (route) =>
    route.fulfill({ json: response }),
  )
  await page.goto("/attendance/policies/overview")
  await expect(page.getByLabel("Policy figures")).toHaveAttribute(
    "aria-busy",
    "false",
  )
}

export async function assertNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true)
}

export function requestGate() {
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

export const overtimePage = "/attendance/requests/overtime"
export const overtimeAdjustments = "/attendance/adjustments"

export function overtimeFixtureCall(
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

export async function seedOvertimeReview(
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

export function overtimeRowMenu(page: Page, id: string) {
  return page.locator(`[id="attendance-adjustment-actions-${id}"]`)
}

export function overtimeResponse(page: Page, method: string, path: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === `/api${path}`,
  )
}

export async function leaveFixtureCall(
  actor: string,
  suffix: string,
  body?: unknown,
) {
  return fetch(`${api}/api${suffix}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${fixture.actors[actor].token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function seedLeaveReview(date: string, verify = true) {
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
const overviewSources = {
  adjustments: "/attendance/adjustments/overview",
  leave: "/leave/overview",
} as const
export type OverviewSource = keyof typeof overviewSources
export type OverviewScope = "team" | "mine"

export function overviewQuery(source: OverviewSource, scope: OverviewScope) {
  return `${overviewSources[source]}?scope=${scope}`
}

export function overviewResponse(
  page: Page,
  source: OverviewSource,
  scope: OverviewScope,
) {
  return page.waitForResponse((response) =>
    response.url().endsWith(`/api${overviewQuery(source, scope)}`),
  )
}

/** Hooks shared by every attendance test; call once, before any tests. */
export function registerAttendanceHooks() {
  test.beforeAll(async () => {
    test.setTimeout(90000)
    const root = path.resolve(import.meta.dirname, "../../../..")
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
}
