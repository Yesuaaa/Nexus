import { test, expect, type Page, type Response } from "@playwright/test"
import { readFileSync } from "node:fs"
import { moduleRegistry } from "../src/features/workspaces/model/module-registry"

type Manifest = {
  webOrigin: string
  apiOrigin: string
  controlOrigin: string
  closedOrigin: string
  secret: string
  operationId: string
  mainDay: string
  malformedDay: string
  password: string
  rootEmail: string
  nativeWorker: boolean
}
type Session = { token: string; refreshToken: string; userId: string }
type HistoryPage = {
  events: { eventId: string; sourceEventId: string }[]
  nextCursor: string | null
  complete: boolean
  sources: {
    status: string
    reasonCode: string | null
    omittedCount: number | null
  }[]
  grouping: { scope: string; eventCount: number; operationCount: number }
}
const manifest = JSON.parse(
  readFileSync(process.env.SYSTEM_LOGS_OFFLINE_MANIFEST!, "utf8"),
) as Manifest
const base = "/api/system-logs/management-history"
const apiPath = (path: string) =>
  `${test.info().project.name === "express-forwarded" ? manifest.apiOrigin : manifest.webOrigin}${path}`
let current: Session
const failures = new WeakMap<Page, string[]>()
async function control<T = { historiesUnchanged: boolean }>(
  path: string,
  body: unknown = {},
): Promise<T> {
  const response = await fetch(`${manifest.controlOrigin}${path}`, {
    method: "POST",
    headers: { "x-offline-control": manifest.secret },
    body: JSON.stringify(body),
  })
  expect(response.status).toBe(200)
  return response.json() as Promise<T>
}
async function install(page: Page, actor = "root", state = "active") {
  const session = await control<Session>("/session", { actor, state })
  await page.addInitScript((value) => {
    sessionStorage.setItem("nexus.auth.token", value.token)
    sessionStorage.setItem("nexus.auth.refreshToken", value.refreshToken)
  }, session)
  return session
}
async function safe(response: Response): Promise<HistoryPage> {
  expect(response.headers()["cache-control"]).toBe("no-store")
  const text = await response.text()
  for (const forbidden of [
    "private-history-sentinel",
    "private-attendance-sentinel",
    "private-project-sentinel",
    "private-service-sentinel",
    "private-service-entity",
    "Offline source fault",
    "PrismaClient",
    "passwordHash",
    '"changes":',
    '"stack":',
  ])
    expect(text).not.toContain(forbidden)
  return JSON.parse(text) as HistoryPage
}
const historyResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().includes(base) && !response.url().includes("/events/"),
  )
async function choose(page: Page, filter: string, option: string | RegExp) {
  if (!(await page.getByRole("combobox", { name: filter }).isVisible()))
    await page.getByRole("button", { name: /^Filter options/ }).click()
  await page.getByRole("combobox", { name: filter }).click()
  await page
    .getByRole("option", { name: option, exact: typeof option === "string" })
    .click()
}
async function apply(page: Page) {
  const pending = historyResponse(page)
  await page.getByRole("button", { name: "Apply filters", exact: true }).click()
  const response = await safe(await pending)
  await expect(page.getByRole("dialog")).not.toBeVisible()
  return response
}
async function refine(page: Page, label: string, value: string) {
  if (!(await page.getByLabel(label, { exact: true }).isVisible()))
    await page.getByRole("button", { name: /^Filter options/ }).click()
  await page.getByLabel(label, { exact: true }).fill(value)
}
async function open(page: Page) {
  await page.addInitScript((value) => {
    sessionStorage.setItem("nexus.auth.token", value.token)
    sessionStorage.setItem("nexus.auth.refreshToken", value.refreshToken)
  }, current)
  const pending = historyResponse(page)
  await page.goto("/system-logs")
  await expect(
    page.getByRole("heading", { name: "System Logs & Diagnostics" }),
  ).toBeVisible()
  return safe(await pending)
}
async function rows(page: Page, count: number) {
  await expect(
    page.getByRole("table").getByRole("button", { name: /^View event / }),
  ).toHaveCount(count)
}

test.beforeEach(async ({ page, context }, info) => {
  expect(manifest.nativeWorker).toBe(true)
  const errors: string[] = []
  failures.set(page, errors)
  page.on("pageerror", (error) => errors.push(error.message))
  // The rewrite project never intercepts same-origin API traffic. This matcher
  // only denies non-loopback outbound requests, which have no place in fixtures.
  await context.route(
    /^https?:\/\/(?!127\.0\.0\.1(?::\d+)?(?:\/|$))/,
    (route) => route.abort(),
  )
  if (info.project.name === "express-forwarded")
    await context.route("**/api/**", (route) => {
      const url = new URL(route.request().url())
      return route.continue({
        url: `${manifest.apiOrigin}${url.pathname}${url.search}`,
      })
    })
  await control("/sources", { unavailable: [] })
  current = await control<Session>("/session", { actor: "root" })
})
test.afterEach(async ({ page }) => {
  await control("/sources", { unavailable: [] })
  expect((await control("/stats")).historiesUnchanged).toBe(true)
  expect(failures.get(page)).toEqual([])
  await expect(page.locator("body")).not.toContainText(
    "private-history-sentinel",
  )
})

test("System Health uses real bounded readiness and explicitly unknown job observations", async ({
  page,
}) => {
  await install(page)
  await page.goto("/system-logs")
  const pending = page.waitForResponse((response) =>
    response.url().endsWith("/api/system-logs/health"),
  )
  await page.getByRole("tab", { name: "System Health", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  const text = await response.text()
  expect(text).not.toMatch(
    /private-|Prisma|SELECT|DATABASE_URL|stack|passwordHash|postgresql:/,
  )
  const snapshot = JSON.parse(text) as {
    database: { status: string; checkedAt: string }
    messageExpiry: { status: string }
    scope: string
  }
  expect(snapshot.scope).toBe("instance")
  expect(snapshot.database.status).toBe("Healthy")
  expect(snapshot.messageExpiry.status).toBe("Unknown")
  await expect(
    page.getByText("Instance-local observations only."),
  ).toBeVisible()
  const refreshed = page.waitForResponse((result) =>
    result.url().endsWith("/api/system-logs/health"),
  )
  await page
    .getByRole("button", { name: "Refresh health", exact: true })
    .click()
  expect(
    ((await (await refreshed).json()) as typeof snapshot).database.checkedAt,
  ).toBe(snapshot.database.checkedAt)
  await expect(
    page.getByText("Unknown — no execution observed", { exact: false }),
  ).toBeVisible()
})

test("Errors & Exceptions uses real offline API, sanitized correlation details and retained filters", async ({
  page,
}) => {
  await install(page)
  await page.goto("/system-logs")
  await page.getByRole("tab", { name: "Errors & Exceptions" }).click()
  await page.getByRole("combobox", { name: "Error module filter" }).click()
  await page.getByRole("option", { name: "People & HR", exact: true }).click()
  await page.getByRole("combobox", { name: "Error category filter" }).click()
  await page.getByRole("option", { name: "Internal", exact: true }).click()
  const pending = page.waitForResponse(
    (response) =>
      response.url().includes("/api/system-logs/errors?") &&
      response.url().includes("moduleId=people-hr"),
  )
  await page.getByRole("button", { name: "Apply error filters" }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("no-store")
  const text = await response.text()
  expect(text).not.toMatch(
    /private-error-sentinel|diagnosticCode|stack|passwordHash/,
  )
  await expect(page.getByText("1 error shown", { exact: false })).toBeVisible()
  await page
    .getByRole("table", { name: "Application error records" })
    .getByRole("button", { name: "Details", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Error details" }),
  ).toBeVisible()
  await expect(page.getByText("Correlation ID", { exact: true })).toBeVisible()
})

for (const [workspace, expected] of [
  ["administration", 31],
  ["people-hr", 32],
  ["service-operations", 1],
  ["project-management", 0],
  ["attendance-monitoring", 0],
] as const)
  test(`Shared navigation uses actual ${workspace} origin`, async ({
    page,
  }) => {
    await install(page)
    await page.goto(moduleRegistry[workspace].administrativePath)
    await expect(
      page.getByRole("link", { name: "System Logs (Unavailable)" }),
    ).toBeVisible()
    const urls: string[] = []
    page.on("request", (request) => {
      if (request.url().includes(base)) urls.push(request.url())
    })
    const pending = expected !== null ? historyResponse(page) : null
    await page.getByRole("link", { name: "System Logs (Unavailable)" }).click()
    await expect(page.getByLabel("Current audit module")).toContainText(
      moduleRegistry[workspace].title,
    )
    await expect(
      page.getByText("Unavailable for production release."),
    ).toBeVisible()
    if (pending && expected !== null) {
      expect((await safe(await pending)).events).toHaveLength(expected)
      expect(new URL(urls[0]).searchParams.get("moduleId")).toBe(workspace)
    } else {
      await expect(
        page.getByRole("table", { name: "Management audit events" }),
      ).toContainText("Not yet integrated")
      expect(urls).toHaveLength(0)
      const broader = historyResponse(page)
      await page
        .getByRole("button", { name: "Show All Modules", exact: true })
        .click()
      expect((await safe(await broader)).events).toHaveLength(50)
    }
  })

for (const [device, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["laptop", 1280, 800],
  ["desktop", 1600, 1000],
] as const)
  test(`${device}: real cursors, details, operation investigation and Back`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    const first = await open(page)
    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click()
      await expect(
        page
          .getByRole("complementary")
          .getByRole("link", { name: "Calendar", exact: true }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("complementary")
          .getByRole("link", { name: "Internal Messages", exact: true }),
      ).toBeVisible()
      await page
        .getByRole("link", { name: "System Logs (Unavailable)" })
        .click()
    }
    expect(first.grouping).toMatchObject({
      scope: "page",
      eventCount: 50,
      operationCount: 1,
    })
    expect(first.nextCursor).toMatch(/^[\w-]+\.[\w-]+$/)
    await rows(page, 50)
    const next = historyResponse(page)
    await page.getByRole("button", { name: "Next page", exact: true }).click()
    const secondResponse = await next
    expect(new URL(secondResponse.url()).searchParams.get("cursor")).toBe(
      first.nextCursor,
    )
    const second = await safe(secondResponse)
    expect(second.grouping).toMatchObject({
      scope: "page",
      eventCount: 14,
      operationCount: 1,
    })
    expect(
      new Set([...first.events, ...second.events].map((event) => event.eventId))
        .size,
    ).toBe(64)
    await rows(page, 14)
    const detail = page.waitForResponse((response) =>
      response.url().includes(`${base}/events/`),
    )
    await page
      .getByRole("table")
      .getByRole("button", { name: /^View event / })
      .first()
      .click()
    await safe(await detail)
    await expect(page.getByRole("dialog")).toContainText("deleted-auditor")
    const investigating = historyResponse(page)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Investigate operation" })
      .click()
    const investigationResponse = await investigating
    expect(new URL(investigationResponse.url()).pathname).toBe(
      `${base}/operations/${manifest.operationId}`,
    )
    expect((await safe(investigationResponse)).grouping.scope).toBe("page")
    const back = historyResponse(page)
    await page.getByRole("button", { name: "Back to filtered history" }).click()
    expect(new URL((await back).url()).searchParams.get("cursor")).toBe(
      first.nextCursor,
    )
    await rows(page, 14)
    await page.getByRole("button", { name: /^Filter options/ }).click()
    await expect(page.getByLabel("Operation ID", { exact: true })).toHaveValue(
      "",
    )
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    const previous = historyResponse(page)
    await page.getByRole("button", { name: "Previous page" }).click()
    await safe(await previous)
    await page
      .getByRole("button", {
        name: "View event shared from audit.account-management",
        exact: true,
      })
      .click()
    await expect(page.getByRole("dialog")).toContainText("STAFF → ADMIN")
    await expect(
      page.getByRole("dialog").getByText("Admin", { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole("dialog")).toContainText(
      "deleted-subject-shared",
    )
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", {
        name: "View event shared from audit.account-management",
        exact: true,
      }),
    ).toBeFocused()
    await expect(
      page.getByText("They are never globally complete.", { exact: false }),
    ).toBeVisible()
    await choose(
      page,
      "Module filter",
      "Workforce Compliance — Partial — attendance record changes",
    )
    await choose(page, "Source filter", "Attendance audit")
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await page
      .getByLabel("From date (UTC)", { exact: true })
      .fill(manifest.malformedDay)
    await page
      .getByLabel("To date (UTC)", { exact: true })
      .fill(manifest.malformedDay)
    const attendance = await apply(page)
    expect(attendance.events).toHaveLength(1)
    expect(attendance.grouping.operationCount).toBe(0)
    await expect(
      page.getByText("1 event without recorded operation", { exact: true }),
    ).toBeVisible()
    const attendanceDetails = page.waitForResponse((response) =>
      response.url().includes("/events/audit.attendance/"),
    )
    await page
      .getByRole("button", {
        name: "View event attendance-safe-event from audit.attendance",
        exact: true,
      })
      .click()
    await safe(await attendanceDetails)
    await expect(page.getByRole("dialog")).toContainText(
      "Historical role and shared operation ID were not recorded",
    )
    await expect(
      page.getByRole("dialog").getByText("Not recorded", { exact: true }),
    ).toHaveCount(2)
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Investigate operation" }),
    ).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(
      "private-attendance-sentinel",
    )
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await choose(
      page,
      "Module filter",
      "Project Management — Partial — milestone and staffing events",
    )
    await choose(
      page,
      "Source filter",
      "Workflow audit — selected request/project events",
    )
    const projectPage = await apply(page)
    expect(projectPage.events).toHaveLength(1)
    expect(projectPage.grouping.operationCount).toBe(0)
    const projectDetails = page.waitForResponse((response) =>
      response.url().includes("/events/audit.workflow/"),
    )
    await page
      .getByRole("button", {
        name: "View event project-safe-event from audit.workflow",
        exact: true,
      })
      .click()
    await safe(await projectDetails)
    await expect(page.getByRole("dialog")).toContainText(
      "not complete project auditing",
    )
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Investigate operation" }),
    ).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(
      "private-project-sentinel",
    )
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await choose(
      page,
      "Module filter",
      "Service Operations — Partial — client accounts and request events",
    )
    const servicePage = await apply(page)
    expect(servicePage.events.map((event) => event.sourceEventId)).toEqual([
      "service-safe-event",
    ])
    expect(servicePage.grouping.operationCount).toBe(0)
    const serviceDetails = page.waitForResponse((response) =>
      response.url().includes("/events/audit.workflow/service-safe-event"),
    )
    await page
      .getByRole("button", {
        name: "View event service-safe-event from audit.workflow",
        exact: true,
      })
      .click()
    await safe(await serviceDetails)
    await expect(page.getByRole("dialog")).toContainText(
      "historical service request ID",
    )
    await expect(page.getByRole("dialog")).toContainText(
      "Historical role and shared operation ID were not recorded",
    )
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Investigate operation" }),
    ).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(
      "private-service-sentinel",
    )
    await page.keyboard.press("Escape")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

test("all real filters compose and manual module overrides survive detail investigation", async ({
  page,
}) => {
  await open(page)
  await choose(page, "Module filter", /Administration — Supported/)
  await choose(page, "Source filter", "Account management")
  await choose(page, "Action filter", "Role changed")
  await choose(page, "Subject type filter", "Account")
  await refine(page, "Actor ID", "deleted-auditor")
  await page
    .getByLabel("Subject ID", { exact: true })
    .fill("deleted-subject-shared")
  await page
    .getByRole("button", { name: "Close investigation filters" })
    .click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  await page
    .getByLabel("Event search (optional)", { exact: true })
    .fill("account.role_changed")
  expect((await apply(page)).events).toHaveLength(1)
  await page
    .getByRole("button", {
      name: "View event shared from audit.account-management",
      exact: true,
    })
    .click()
  await expect(page.getByRole("dialog")).toContainText("STAFF → ADMIN")
  const pending = historyResponse(page)
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Investigate operation" })
    .click()
  expect((await safe(await pending)).events).toHaveLength(1)
  const back = historyResponse(page)
  await page.getByRole("button", { name: "Back to filtered history" }).click()
  await safe(await back)
  await page.getByRole("button", { name: /^Filter options/ }).click()
  await expect(page.getByLabel("Actor ID", { exact: true })).toHaveValue(
    "deleted-auditor",
  )
  await expect(
    page.getByRole("combobox", { name: "Module filter" }),
  ).toContainText("Administration")
  await page
    .getByRole("button", { name: "Close investigation filters" })
    .click()
})

for (const width of [390, 1600])
  test(`${width}px: incompatible workspace/event filters require explicit correction through the real API`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(
      (accountId) =>
        sessionStorage.setItem(`nexus.workspace.${accountId}`, "people-hr"),
      current.userId,
    )
    await open(page)
    await expect(page.getByLabel("Current audit module")).toContainText(
      "People & HR",
    )
    const urls: string[] = []
    const statuses: number[] = []
    page.on("request", (request) => {
      if (request.url().includes(base)) urls.push(request.url())
    })
    page.on("response", (response) => {
      if (response.url().includes(base)) statuses.push(response.status())
    })
    await page
      .getByLabel("From date (UTC)", { exact: true })
      .fill(manifest.mainDay)
    await page
      .getByLabel("To date (UTC)", { exact: true })
      .fill(manifest.mainDay)
    await page
      .getByLabel("Event search (optional)", { exact: true })
      .fill("service_request.quotation_sent")
    await choose(page, "Module filter", /Service Operations — Partial/)
    await choose(
      page,
      "Source filter",
      "Workflow audit — selected request/project events",
    )
    await choose(page, "Action filter", "Quotation sent")
    await refine(page, "Actor ID", "deleted-auditor")
    await page
      .getByLabel("Subject ID", { exact: true })
      .fill("retained-subject")
    await apply(page)

    // Changing the module in the existing panel must not send an invalid read.
    await choose(page, "Module filter", /Project Management — Partial/)
    const beforePanel = urls.length
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click()
    const conflict = page.getByRole("alert", {
      name: "Incompatible audit filters",
    })
    await expect(conflict).toContainText(
      "Filters conflict with Project Management",
    )
    await expect(conflict).toContainText(
      "Event search: service_request.quotation_sent",
    )
    await expect(conflict).not.toContainText("Source:") // Workflow source remains compatible.
    expect(urls.length).toBe(beforePanel)
    await conflict.getByRole("button", { name: "Keep current filters" }).click()
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await expect(page.getByLabel("Current audit module")).toContainText(
      "Service Operations",
    )

    // All Modules also checks pending selections without silently applying them.
    await choose(page, "Source filter", "Account management")
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    const beforeAll = urls.length
    await page.getByRole("button", { name: "All Modules", exact: true }).click()
    await expect(conflict).toContainText("Filters conflict with All Modules")
    await expect(conflict).toContainText("Source: audit.account-management")
    await expect(conflict).not.toContainText("Event search:")
    expect(urls.length).toBe(beforeAll)
    const all = historyResponse(page)
    await conflict
      .getByRole("button", { name: "Clear incompatible filters and apply" })
      .click()
    expect((await all).status()).toBe(200)
    await expect(page.getByLabel("Current audit module")).toContainText(
      "All Modules",
    )
    const allParams = new URL(urls.at(-1)!).searchParams
    expect(allParams.get("eventName")).toBe("service_request.quotation_sent")
    expect(allParams.get("source")).toBe("audit.workflow")
    expect(allParams.get("action")).toBe("QUOTATION_SENT")

    const beforeWorkspace = urls.length
    await page
      .getByRole("button", { name: "Workspace only", exact: true })
      .click()
    await expect(conflict).toContainText("Filters conflict with People & HR")
    await expect(conflict).toContainText("Source: audit.workflow")
    await expect(conflict).toContainText("Action: QUOTATION_SENT")
    await expect(conflict).toContainText("Nothing has been cleared")
    await expect(
      page.getByLabel("Event search (optional)", { exact: true }),
    ).toHaveValue("service_request.quotation_sent")
    await expect(page.getByLabel("Current audit module")).toContainText(
      "All Modules",
    )
    expect(urls.length).toBe(beforeWorkspace)
    await conflict.getByRole("button", { name: "Keep current filters" }).click()
    await expect(conflict).toHaveCount(0)
    expect(urls.length).toBe(beforeWorkspace)

    await page
      .getByRole("button", { name: "Workspace only", exact: true })
      .click()
    const corrected = historyResponse(page)
    await conflict
      .getByRole("button", { name: "Clear incompatible filters and apply" })
      .click()
    expect((await corrected).status()).toBe(200)
    await expect(conflict).toHaveCount(0)
    await expect(page.getByLabel("Current audit module")).toContainText(
      "People & HR",
    )
    const params = new URL(urls.at(-1)!).searchParams
    for (const field of ["eventName", "source", "action", "cursor"])
      expect(params.has(field)).toBe(false)
    expect(params.get("actorId")).toBe("deleted-auditor")
    expect(params.get("subjectId")).toBe("retained-subject")
    expect(params.get("moduleId")).toBe("people-hr")
    expect(params.get("from")).toBe(`${manifest.mainDay}T00:00:00.000Z`)
    expect(params.get("to")).toBe(`${manifest.mainDay}T23:59:59.999Z`)
    await expect(
      page.getByLabel("Event search (optional)", { exact: true }),
    ).toHaveValue("")
    expect(statuses.every((status) => status === 200)).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

test("empty, malformed scan windows and source outages preserve real metadata and retry replacement", async ({
  page,
}) => {
  await open(page)
  await refine(page, "Actor ID", "missing-auditor")
  expect((await apply(page)).events).toHaveLength(0)
  await expect(
    page.getByText("No audit events match this date range and filters."),
  ).toBeVisible()
  await page
    .getByLabel("From date (UTC)", { exact: true })
    .fill(manifest.malformedDay)
  await page
    .getByLabel("To date (UTC)", { exact: true })
    .fill(manifest.malformedDay)
  await refine(page, "Actor ID", "invalid-auditor")
  const invalid = await apply(page)
  expect(invalid.events).toHaveLength(0)
  expect(invalid.sources[0]).toMatchObject({
    reasonCode: "SCAN_CAP",
    omittedCount: 500,
  })
  await expect(page.getByText(/Scan limit reached/)).toBeVisible()
  const next = historyResponse(page)
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  expect((await safe(await next)).sources[0].omittedCount).toBe(2)
  await page
    .getByLabel("From date (UTC)", { exact: true })
    .fill(manifest.mainDay)
  await page.getByLabel("To date (UTC)", { exact: true }).fill(manifest.mainDay)
  await refine(page, "Actor ID", "deleted-auditor")
  await control("/sources", { unavailable: ["WorkforceManagementChange"] })
  const partial = await apply(page)
  expect(partial.complete).toBe(false)
  expect(partial.events).toHaveLength(32)
  expect(partial.nextCursor).toBeNull()
  await rows(page, 32)
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled()
  await control("/sources", { unavailable: [] })
  const retry = historyResponse(page)
  await page.getByRole("button", { name: "Retry this page" }).click()
  expect((await safe(await retry)).events).toHaveLength(50)
  await rows(page, 50)
  await control("/sources", {
    unavailable: [
      "AccountManagementChange",
      "WorkforceManagementChange",
      "AttendanceAudit",
      "WorkflowEvent",
    ],
  })
  const failed = await apply(page)
  expect(
    failed.sources.every((source) => source.status === "unavailable"),
  ).toBe(true)
  await expect(page.getByText("Incomplete history on this page.")).toBeVisible()
  await control("/sources", { unavailable: [] })
  const recovered = historyResponse(page)
  await page.getByRole("button", { name: "Retry this page" }).click()
  await safe(await recovered)
  await rows(page, 50)
})

for (const [actor, state, status] of [
  ["admin", "active", 403],
  ["staff", "active", 403],
  ["user", "active", 403],
  ["root", "revoked", 401],
  ["root", "inactive", 401],
  ["root", "retired", 401],
  ["root", "expired", 401],
  ["root", "demoted", 403],
] as const)
  test(`${actor}/${state}: real session and direct-route authorization`, async ({
    page,
  }) => {
    const session = await install(page, actor, state)
    await page.goto("/system-logs")
    await expect(page).not.toHaveURL(/\/system-logs$/)
    await expect(
      page.getByRole("heading", { name: "System Logs & Diagnostics" }),
    ).toHaveCount(0)
    for (const suffix of [
      "",
      `/events/audit.account-management/shared`,
      `/operations/${manifest.operationId}`,
    ]) {
      const response = await page.request.get(
        apiPath(`${base}${suffix}?unexpected=private`),
        { headers: { Authorization: `Bearer ${session.token}` } },
      )
      expect(response.status()).toBe(status)
      expect(response.headers()["cache-control"]).toBe("no-store")
    }
  })

test("signed cursors and closed default API remain authoritative through the real transport", async ({
  page,
}) => {
  const first = await open(page)
  const headers = { Authorization: `Bearer ${current.token}` }
  for (const query of [
    "unknown=value",
    "from=2020-01-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z",
    `cursor=${first.nextCursor}tampered`,
    "source=audit.account-management&source=audit.workforce-management",
  ]) {
    const response = await page.request.get(apiPath(`${base}?${query}`), {
      headers,
    })
    expect(response.status()).toBe(400)
    expect(response.headers()["cache-control"]).toBe("no-store")
  }
  expect((await page.request.get(apiPath(base))).status()).toBe(401)
  const head = await page.request.head(apiPath(base), { headers })
  expect(head.status()).toBe(200)
  expect(head.headers()["cache-control"]).toBe("no-store")
  expect(await head.text()).toBe("")
  const otherSession = await control<Session>("/session", { actor: "root" })
  expect(
    (
      await page.request.get(apiPath(`${base}?cursor=${first.nextCursor}`), {
        headers: { Authorization: `Bearer ${otherSession.token}` },
      })
    ).status(),
  ).toBe(400)
  const closed = await fetch(`${manifest.closedOrigin}${base}`, { headers })
  expect(closed.status).toBe(404)
  expect(closed.headers.get("cache-control")).toBe("no-store")
})

test("real internal sign-in stores issued sessions and enters Shared history", async ({
  page,
}) => {
  await page.goto("/internal/login")
  await page
    .getByLabel("Email address", { exact: true })
    .fill(manifest.rootEmail)
  await page.getByLabel("Password", { exact: true }).fill(manifest.password)
  const login = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/auth/login",
  )
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  expect((await login).status()).toBe(200)
  await expect(page).toHaveURL(/\/module$/)
  await page
    .getByRole("link", { name: "Open People & HR workspace", exact: true })
    .click()
  const pending = historyResponse(page)
  await page.getByRole("link", { name: "System Logs (Unavailable)" }).click()
  expect((await safe(await pending)).events).toHaveLength(32)
  expect(
    await page.evaluate(() => !!sessionStorage.getItem("nexus.auth.token")),
  ).toBe(true)
  expect(
    await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
  ).toBeNull()
})

test("detail source failure retries safely and an already-open session is revoked by the backend", async ({
  page,
}) => {
  await open(page)
  await control("/sources", { unavailable: ["AccountManagementChange"] })
  const detail = page.waitForResponse((response) =>
    response.url().includes(`${base}/events/`),
  )
  await page
    .getByRole("button", {
      name: "View event shared from audit.account-management",
      exact: true,
    })
    .click()
  expect((await detail).status()).toBe(503)
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Event details are unavailable",
  )
  await control("/sources", { unavailable: [] })
  await page.getByRole("button", { name: "Retry details" }).click()
  await expect(page.getByRole("dialog")).toContainText("STAFF → ADMIN")
  await page.keyboard.press("Escape")
  await control("/session", { actor: "root", state: "revoked" })
  const denied = historyResponse(page)
  await page.getByRole("button", { name: "Apply filters", exact: true }).click()
  expect((await denied).status()).toBe(401)
  await expect(page.getByRole("table").getByRole("alert")).toContainText(
    "Your current account cannot access System Logs",
  )
  await page.reload()
  await expect(page).toHaveURL(/\/(?:internal\/)?login$/)
  expect(
    await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
  ).toBeNull()
})
