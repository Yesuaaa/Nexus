import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import type { AttendanceAdjustment } from "../src/features/attendance/api/attendance-api"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

const overtimeRoute = "/attendance/requests/overtime"
const start = "2026-11-14T18:00:00.000Z"
const end = "2026-11-14T19:00:00.000Z"

type ListPayload = {
  adjustments: AttendanceAdjustment[]
  capabilities: { requestCorrection: boolean }
  total: number
  page: number
  pageSize: number
}
type Reply = { status?: number; body: ListPayload | { error: string } }
type ListHandler = (url: URL, requestCount: number) => Reply | Promise<Reply>

function overtime(
  id: string,
  options: {
    status?: AttendanceAdjustment["status"]
    reason?: string
    employeeName?: string
    requestedById?: string
    overtimeMinutes?: number
    capabilities?: Partial<AttendanceAdjustment["capabilities"]>
    reviewNote?: string | null
    verificationNote?: string | null
  } = {},
): AttendanceAdjustment {
  const reviewNote = options.reviewNote ?? null
  return {
    id,
    type: "OVERTIME",
    overtimeMinutes: options.overtimeMinutes ?? 120,
    verifiedById: options.verificationNote ? "head-account" : null,
    verificationNote: options.verificationNote ?? null,
    employeeId: `employee-${id}`,
    sessionId: `session-${id}`,
    reason: options.reason ?? `${id} recorded overtime reason`,
    status: options.status ?? "PENDING",
    proposedStartedAt: start,
    proposedEndedAt: end,
    createdAt: start,
    reviewNote,
    requestedById: options.requestedById ?? "requester-account",
    employee: {
      id: `employee-${id}`,
      fullName: options.employeeName ?? "Design Employee",
      employeeId: `EXP-${id.toUpperCase()}`,
      departmentId: "department-design",
    },
    reviewedBy: reviewNote
      ? { id: "reviewer-account", fullName: "HR Reviewer" }
      : null,
    capabilities: {
      approve: false,
      verify: false,
      reject: false,
      ...options.capabilities,
    },
  }
}

function payload(
  rows: AttendanceAdjustment[],
  options: { page?: number; total?: number } = {},
): ListPayload {
  return {
    adjustments: rows,
    capabilities: { requestCorrection: false },
    total: options.total ?? rows.length,
    page: options.page ?? 1,
    pageSize: 10,
  }
}

async function stubOvertimeList(
  page: Page,
  role: Account["role"],
  handler: ListHandler,
  account?: Partial<Account>,
) {
  await restoreSession(page, role, account ? { account } : undefined)
  const requests: URL[] = []
  await page.route("**/api/attendance/adjustments?**", async (route) => {
    const url = new URL(route.request().url())
    const reply = await handler(url, requests.push(url))
    await route.fulfill({ status: reply.status ?? 200, json: reply.body })
  })
  return requests
}

function listResponse(page: Page, matches: (url: URL) => boolean = () => true) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/adjustments" &&
      matches(url)
    )
  })
}

function gate() {
  let startGate!: () => void
  let releaseGate!: () => void
  const started = new Promise<void>((resolve) => {
    startGate = resolve
  })
  const pending = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  return {
    started,
    pending,
    start: () => startGate(),
    release: () => releaseGate(),
  }
}

function actionTrigger(page: Page, id: string) {
  return page.locator(`[id="attendance-adjustment-actions-${id}"]`)
}

test("[PG-012-F001-A001-T002] navigate to and directly open the Overtime route", async ({
  page,
}) => {
  const row = overtime("navigation-row")
  const requests = await stubOvertimeList(page, "STAFF", () => ({
    body: payload([row]),
  }))
  await page.route("**/api/attendance/adjustments/overview?**", (route) =>
    route.fulfill({ json: { groups: [] } }),
  )
  await page.route("**/api/leave/overview?**", (route) =>
    route.fulfill({ json: { groups: [] } }),
  )

  await page.goto("/attendance/requests/overview")
  await expect(
    page.getByRole("heading", { name: "Requests & Approvals Overview" }),
  ).toBeVisible()
  const navigationLink = page.getByRole("link", {
    name: "Overtime",
    exact: true,
  })
  await expect(navigationLink).toHaveAttribute("href", overtimeRoute)
  const navigated = listResponse(page)
  await navigationLink.click()
  expect((await navigated).status()).toBe(200)
  await expect(page.getByRole("heading", { name: "Overtime" })).toBeVisible()
  expect(requests.at(-1)?.searchParams.get("type")).toBe("OVERTIME")

  const direct = listResponse(page)
  await page.goto(overtimeRoute)
  expect((await direct).status()).toBe(200)
  await expect(page.getByRole("heading", { name: "Overtime" })).toBeVisible()
  expect(requests.at(-1)?.searchParams.get("type")).toBe("OVERTIME")
})

test("[PG-012-F001-A002-T001] typed Overtime loading, error, and retry recover", async ({
  page,
}) => {
  const pendingGate = gate()
  const row = overtime("retry-row", { reason: "Recovered overtime entry" })
  const requests = await stubOvertimeList(
    page,
    "STAFF",
    async (_url, count) => {
      if (count === 1) {
        pendingGate.start()
        await pendingGate.pending
      }
      if (count === 2)
        return { status: 503, body: { error: "Overtime queue unavailable." } }
      return { body: payload([row]) }
    },
  )
  try {
    const initial = listResponse(page)
    await page.goto(overtimeRoute)
    await pendingGate.started
    const table = page.getByRole("table", { name: "Attendance requests" })
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(page.getByRole("status")).toContainText(
      "Loading attendance requests",
    )
    pendingGate.release()
    expect((await initial).status()).toBe(200)
    await expect(page.getByText(row.reason, { exact: true })).toBeVisible()

    const failure = listResponse(page)
    await page.reload()
    expect((await failure).status()).toBe(503)
    await expect(
      page.getByRole("alert").filter({
        hasText: "Overtime queue unavailable.",
      }),
    ).toContainText("Overtime queue unavailable.")
    const retry = listResponse(page)
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    expect((await retry).status()).toBe(200)
    await expect(page.getByText(row.reason, { exact: true })).toBeVisible()
    expect(
      requests.every((url) => url.searchParams.get("type") === "OVERTIME"),
    ).toBe(true)
  } finally {
    pendingGate.release()
  }
})

test("[PG-012-F001-A003-T001] scope changes reset the Overtime list page", async ({
  page,
}) => {
  const row = overtime("scope-row")
  const requests = await stubOvertimeList(
    page,
    "STAFF",
    (url) => ({
      body: payload([row], {
        page: Number(url.searchParams.get("page") ?? "1"),
        total: 21,
      }),
    }),
    { headOf: { id: "department-design", name: "Design" } },
  )
  const initial = listResponse(page)
  await page.goto(overtimeRoute)
  expect((await initial).status()).toBe(200)

  const secondPage = listResponse(
    page,
    (url) => url.searchParams.get("page") === "2",
  )
  await page.getByRole("button", { name: "Next page" }).click()
  expect((await secondPage).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("page")).toBe("2")
  expect(requests.at(-1)?.searchParams.get("scope")).toBe("team")

  const personal = listResponse(
    page,
    (url) =>
      url.searchParams.get("scope") === "mine" &&
      url.searchParams.get("page") === "1",
  )
  await page.getByRole("button", { name: "My requests", exact: true }).click()
  expect((await personal).status()).toBe(200)

  const team = listResponse(
    page,
    (url) =>
      url.searchParams.get("scope") === "team" &&
      url.searchParams.get("page") === "1",
  )
  await page
    .getByRole("button", { name: "Department requests", exact: true })
    .click()
  expect((await team).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("type")).toBe("OVERTIME")
})

test("[PG-012-F001-A004-T001] Overtime search debounces and resets pagination", async ({
  page,
}) => {
  await page.clock.install()
  const row = overtime("search-row", { reason: "Needle recorded overtime" })
  const requests = await stubOvertimeList(page, "STAFF", (url) => ({
    body: payload([row], {
      page: Number(url.searchParams.get("page") ?? "1"),
      total: 11,
    }),
  }))
  const initial = listResponse(page)
  await page.goto(overtimeRoute)
  expect((await initial).status()).toBe(200)
  const search = page.getByRole("searchbox", {
    name: "Search attendance requests",
  })
  await expect(search).toHaveAttribute("maxlength", "100")

  const secondPage = listResponse(
    page,
    (url) => url.searchParams.get("page") === "2",
  )
  await page.getByRole("button", { name: "Next page" }).click()
  expect((await secondPage).status()).toBe(200)
  const settledCount = requests.length
  const searchRequest = listResponse(
    page,
    (url) =>
      url.searchParams.get("search") === "Needle" &&
      url.searchParams.get("page") === "1",
  )
  await search.fill("Needle")
  await page.clock.runFor(199)
  expect(requests).toHaveLength(settledCount)
  await page.clock.runFor(1)
  expect((await searchRequest).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("type")).toBe("OVERTIME")
})

test("[PG-012-F001-A006-T001] Overtime pagination disables while loading and filter resets page", async ({
  page,
}) => {
  const pendingGate = gate()
  const rows = Array.from({ length: 11 }, (_, index) =>
    overtime(`page-${index + 1}`, { reason: `Overtime page ${index + 1}` }),
  )
  const requests = await stubOvertimeList(page, "STAFF", async (url) => {
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    if (pageNumber === 2) {
      pendingGate.start()
      await pendingGate.pending
    }
    const filtered = url.searchParams.get("status")
      ? rows.filter((row) => row.status === url.searchParams.get("status"))
      : rows
    const offset = (pageNumber - 1) * 10
    return {
      body: payload(filtered.slice(offset, offset + 10), {
        page: pageNumber,
        total: url.searchParams.get("status") ? 1 : rows.length,
      }),
    }
  })
  try {
    const initial = listResponse(page)
    await page.goto(overtimeRoute)
    expect((await initial).status()).toBe(200)
    await page.getByRole("button", { name: "Next page" }).click()
    await pendingGate.started
    const table = page.getByRole("table", { name: "Attendance requests" })
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()
    pendingGate.release()
    await expect(table).toHaveAttribute("aria-busy", "false")

    const filtered = listResponse(
      page,
      (url) =>
        url.searchParams.get("status") === "APPROVED" &&
        url.searchParams.get("page") === "1",
    )
    await page.getByRole("combobox", { name: "Request status filter" }).click()
    await page.getByRole("option", { name: "Approved", exact: true }).click()
    expect((await filtered).status()).toBe(200)
    expect(requests.at(-1)?.searchParams.get("page")).toBe("1")
    expect(requests.at(-1)?.searchParams.get("type")).toBe("OVERTIME")
  } finally {
    pendingGate.release()
  }
})

test.describe("PG-012 device-timezone rendering", () => {
  test.use({ timezoneId: "America/Los_Angeles" })

  test("[PG-012-F001-A007-T001] row projection uses the controlled device timezone", async ({
    page,
  }) => {
    const row = overtime("timezone-row", {
      reason: "Timezone-controlled overtime row",
      overtimeMinutes: 90,
      employeeName: "Overtime Employee",
    })
    await stubOvertimeList(page, "STAFF", () => ({
      body: payload([row]),
    }))
    await page.goto(overtimeRoute)
    const table = page.getByRole("table", { name: "Attendance requests" })
    const dataRow = table.getByRole("row").filter({ hasText: row.reason })
    await expect(dataRow).toContainText("Overtime Employee")
    await expect(dataRow).toContainText("90 minutes requested")
    await expect(dataRow).toContainText("Overtime")
    await expect(dataRow).toContainText("Pending")
    await expect(dataRow).toContainText("Nov 14, 2026, 10:00 AM")
    await expect(dataRow).toContainText("Nov 14, 2026, 11:00 AM")
  })
})

test("[PG-012-F001-A009-T002] verify capabilities and reproduce the shared keyboard menu on Overtime", async ({
  page,
  browser,
}) => {
  // PG-012-F001-A009-T001 additive assertions: use real page mode with
  // role-specific backend capability projections before keyboard checks.
  async function assertCapabilities(
    role: Account["role"],
    row: AttendanceAdjustment,
    account?: Partial<Account>,
    openAction?: string,
  ) {
    const context = await browser.newContext()
    try {
      const actorPage = await context.newPage()
      await stubOvertimeList(
        actorPage,
        role,
        () => ({
          body: payload([row]),
        }),
        account,
      )
      await actorPage.goto(overtimeRoute)
      const trigger = actionTrigger(actorPage, row.id)
      await trigger.click()
      const items = actorPage.getByRole("menuitem")
      if (openAction) {
        await expect(items).toContainText(["View details", openAction])
        if (role === "STAFF" && account?.headOf)
          await expect(
            actorPage.getByRole("menuitem", {
              name: "Reject request",
              exact: true,
            }),
          ).toBeVisible()
        await items.getByText(openAction, { exact: true }).click()
        await expect(actorPage.getByRole("dialog")).toBeVisible()
        await actorPage.getByRole("button", { name: "Cancel" }).click()
      } else {
        await expect(items).toHaveCount(1)
        await expect(
          actorPage.getByRole("menuitem", {
            name: "View details",
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          actorPage.getByRole("menuitem", { name: /approve|verify|reject/i }),
        ).toHaveCount(0)
      }
    } finally {
      await context.close()
    }
  }

  await assertCapabilities(
    "STAFF",
    overtime("head-pending", {
      capabilities: { verify: true, reject: true },
    }),
    { headOf: { id: "department-design", name: "Design" } },
    "Verify overtime",
  )
  await assertCapabilities(
    "STAFF",
    overtime("owner-pending", {
      requestedById: "overtime-owner",
      capabilities: { verify: true, reject: true },
    }),
    { id: "overtime-owner" },
  )
  await assertCapabilities(
    "ADMIN",
    overtime("hr-verified", {
      status: "VERIFIED",
      verificationNote: "Department verification is recorded",
      capabilities: { approve: true, reject: true },
    }),
    undefined,
    "Approve request",
  )
  await assertCapabilities(
    "SUPERADMIN",
    overtime("denied-superadmin", {
      capabilities: { approve: false, verify: false, reject: false },
    }),
  )

  const headRow = overtime("keyboard-overtime", {
    capabilities: { verify: true, reject: true },
  })
  await stubOvertimeList(page, "STAFF", () => ({ body: payload([headRow]) }), {
    headOf: { id: "department-design", name: "Design" },
  })
  await page.goto(overtimeRoute)
  const trigger = actionTrigger(page, headRow.id)
  const keyboardResults: string[] = []
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await trigger.focus()
    await trigger.press("ArrowDown")
    const expanded = await trigger.getAttribute("aria-expanded")
    const view = page.getByRole("menuitem", {
      name: "View details",
      exact: true,
    })
    const visible = await view.isVisible().catch(() => false)
    const focused =
      visible &&
      (await view
        .evaluate((element) => element === document.activeElement)
        .catch(() => false))
    if (expanded !== "true" || !visible || !focused)
      keyboardResults.push(
        `${width}px: expanded=${expanded}, visible=${visible}, focused=${focused}`,
      )
    await page.keyboard.press("Escape")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await trigger.click()
    await expect(view).toBeVisible()
    await page.keyboard.press("Escape")
  }
  expect(
    keyboardResults,
    "PG-004-D-001 reproduction on the typed Overtime route; pointer operation is checked at each viewport",
  ).toEqual([])
})

test("[PG-012-F001-A014-T001] review note boundaries and valid decision submission", async ({
  page,
}) => {
  const row = overtime("review-validation", {
    capabilities: { verify: true, reject: true },
  })
  await stubOvertimeList(page, "STAFF", () => ({ body: payload([row]) }), {
    headOf: { id: "department-design", name: "Design" },
  })
  let posts = 0
  let body: unknown
  await page.route("**/api/attendance/adjustments/*/review", async (route) => {
    posts += 1
    body = route.request().postDataJSON()
    await route.fulfill({
      json: { adjustment: { ...row, status: "VERIFIED" } },
    })
  })
  await page.goto(overtimeRoute)
  await actionTrigger(page, row.id).click()
  await page.getByRole("menuitem", { name: "Verify overtime" }).click()
  const panel = page.getByRole("dialog", { name: "Verify overtime" })
  const note = panel.getByRole("textbox", { name: "Review note" })
  const confirm = panel.getByRole("button", { name: "Confirm decision" })
  await expect(note).toHaveAttribute("required", "")
  await expect(note).toHaveAttribute("minlength", "5")
  await expect(note).toHaveAttribute("maxlength", "2000")
  await confirm.click()
  expect(posts).toBe(0)
  await note.fill("1234")
  await confirm.click()
  expect(posts).toBe(0)
  await note.fill("x".repeat(2001))
  await expect(note).toHaveValue("x".repeat(2000))

  const validResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/attendance/adjustments/${row.id}/review`,
  )
  await note.fill("Verified recorded overtime")
  await confirm.click()
  expect((await validResponse).status()).toBe(200)
  expect(body).toEqual({
    decision: "APPROVED",
    note: "Verified recorded overtime",
  })
  await expect(panel).toHaveCount(0)
  expect(posts).toBe(1)
})

test("[PG-012-F001-A014-T002] cancel and pending state prevent duplicate review submission", async ({
  page,
}) => {
  const row = overtime("review-pending", {
    capabilities: { verify: true, reject: true },
  })
  await stubOvertimeList(page, "STAFF", () => ({ body: payload([row]) }), {
    headOf: { id: "department-design", name: "Design" },
  })
  const pendingGate = gate()
  let posts = 0
  await page.route("**/api/attendance/adjustments/*/review", async (route) => {
    posts += 1
    pendingGate.start()
    await pendingGate.pending
    await route.fulfill({
      json: { adjustment: { ...row, status: "REJECTED" } },
    })
  })
  try {
    await page.goto(overtimeRoute)
    await actionTrigger(page, row.id).click()
    await page.getByRole("menuitem", { name: "Reject request" }).click()
    let panel = page.getByRole("dialog", { name: "Reject overtime" })
    await panel.getByRole("button", { name: "Cancel" }).click()
    await expect(panel).toHaveCount(0)
    expect(posts).toBe(0)

    await actionTrigger(page, row.id).click()
    await page.getByRole("menuitem", { name: "Reject request" }).click()
    panel = page.getByRole("dialog", { name: "Reject overtime" })
    await panel
      .getByRole("textbox", { name: "Review note" })
      .fill("Reject after reviewing the recorded period")
    const confirm = panel.getByRole("button", { name: "Confirm decision" })
    await confirm.click()
    await pendingGate.started
    await expect(panel.locator('button[type="submit"]')).toBeDisabled()
    await expect(panel.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await expect(
      panel.getByRole("button", { name: "Close request details" }),
    ).toBeDisabled()
    expect(posts).toBe(1)
    pendingGate.release()
    await expect(panel).toHaveCount(0)
    expect(posts).toBe(1)
  } finally {
    pendingGate.release()
  }
})

test("[PG-012-F001-A014-T003] failed review remains usable for an explicit retry", async ({
  page,
}) => {
  const row = overtime("review-retry", {
    capabilities: { verify: true, reject: true },
  })
  await stubOvertimeList(page, "STAFF", () => ({ body: payload([row]) }), {
    headOf: { id: "department-design", name: "Design" },
  })
  let attempts = 0
  await page.route("**/api/attendance/adjustments/*/review", async (route) => {
    attempts += 1
    if (attempts === 1)
      return route.fulfill({
        status: 500,
        json: { error: "Review service temporarily unavailable." },
      })
    return route.fulfill({
      json: { adjustment: { ...row, status: "VERIFIED" } },
    })
  })
  await page.goto(overtimeRoute)
  await actionTrigger(page, row.id).click()
  await page.getByRole("menuitem", { name: "Verify overtime" }).click()
  const panel = page.getByRole("dialog", { name: "Verify overtime" })
  const note = panel.getByRole("textbox", { name: "Review note" })
  const confirm = panel.getByRole("button", { name: "Confirm decision" })
  await note.fill("Retry this source-defined review")
  const failed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        `/adjustments/${row.id}/review`,
      ),
  )
  await confirm.click()
  expect((await failed).status()).toBe(500)
  await expect(panel.getByRole("alert")).toContainText(
    "Review service temporarily unavailable.",
  )
  await expect(note).toHaveValue("Retry this source-defined review")
  await expect(confirm).toBeEnabled()

  const retried = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        `/adjustments/${row.id}/review`,
      ),
  )
  await confirm.click()
  expect((await retried).status()).toBe(200)
  await expect(panel).toHaveCount(0)
  expect(attempts).toBe(2)
})

test("[PG-012-F001-A015-T002] revoked Head details clear after review re-read is denied", async ({
  page,
}) => {
  const row = overtime("revoked-head", {
    reason: "Secret overtime details after Head transfer",
    capabilities: { verify: true, reject: true },
  })
  let listCalls = 0
  let detailCalls = 0
  await stubOvertimeList(
    page,
    "STAFF",
    () => ({ body: payload(++listCalls === 1 ? [row] : []) }),
    { headOf: { id: "department-design", name: "Design" } },
  )
  await page.route("**/api/attendance/adjustments/*/review", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Review access was revoked." },
    }),
  )
  await page.route("**/api/attendance/adjustments/*", async (route) => {
    detailCalls += 1
    await route.fulfill({
      status: 404,
      json: { error: "Attendance request not found" },
    })
  })
  await page.goto(overtimeRoute)
  await actionTrigger(page, row.id).click()
  await page.getByRole("menuitem", { name: "Verify overtime" }).click()
  const panel = page.getByRole("dialog", { name: "Verify overtime" })
  await expect(panel.getByText(row.reason, { exact: true })).toBeVisible()
  await panel
    .getByRole("textbox", { name: "Review note" })
    .fill("Head authority was removed")
  const denied = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        `/adjustments/${row.id}/review`,
      ),
  )
  await panel.getByRole("button", { name: "Confirm decision" }).click()
  expect((await denied).status()).toBe(403)
  await expect(panel).toHaveCount(0)
  await expect(page.getByText(row.reason, { exact: true })).toHaveCount(0)
  await expect.poll(() => detailCalls).toBe(1)
  await expect.poll(() => listCalls).toBeGreaterThan(1)
})

test("[PG-012-F001-A023-T001] Overtime table remains responsive and labeled", async ({
  page,
}) => {
  const row = overtime("responsive-row", {
    reason:
      "A deliberately long reason to verify responsive overtime layout " +
      "without losing content or its accessible control names.",
    employeeName: "A long employee display name for responsive verification",
  })
  await stubOvertimeList(page, "STAFF", () => ({ body: payload([row]) }))
  await page.goto(overtimeRoute)
  for (const width of [390, 820, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const table = page.getByRole("table", { name: "Attendance requests" })
    await expect(table).toBeVisible()
    await expect(
      page.getByRole("searchbox", { name: "Search attendance requests" }),
    ).toBeVisible()
    await expect(
      page.getByRole("combobox", { name: "Request status filter" }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: `More actions for ${row.employee.fullName}'s request`,
      }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `${width}px must not introduce horizontal overflow`,
    ).toBe(true)
  }
})

test("[PG-012-F001-A023-T002] Overtime details and review panels support keyboard close and focus return", async ({
  page,
}) => {
  const row = overtime("panel-keyboard", {
    capabilities: { verify: true, reject: true },
  })
  await stubOvertimeList(page, "STAFF", () => ({ body: payload([row]) }), {
    headOf: { id: "department-design", name: "Design" },
  })
  await page.goto(overtimeRoute)
  const trigger = actionTrigger(page, row.id)
  await trigger.click()
  await page.getByRole("menuitem", { name: "View details" }).click()
  const details = page.getByRole("dialog", { name: "Overtime request" })
  await expect(details).toHaveAttribute("aria-describedby", /.+/)
  await expect(details.getByText(row.reason, { exact: true })).toBeVisible()
  await expect(details.getByRole("textbox")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(details).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.getByRole("menuitem", { name: "Verify overtime" }).click()
  const review = page.getByRole("dialog", { name: "Verify overtime" })
  await expect(
    review.getByRole("textbox", { name: "Review note" }),
  ).toBeVisible()
  await expect(
    review.getByRole("button", { name: "Confirm decision" }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(review).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
