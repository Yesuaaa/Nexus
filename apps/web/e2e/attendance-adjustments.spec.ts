import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import type { AttendanceAdjustment } from "../src/features/attendance/api/attendance-api"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

type ListPayload = {
  adjustments: AttendanceAdjustment[]
  capabilities: { requestCorrection: boolean }
  total: number
  page: number
  pageSize: number
}
type StubReply = {
  status?: number
  body: ListPayload | { error: string }
}
type ListHandler = (
  url: URL,
  requestCount: number,
) => StubReply | Promise<StubReply>

const start = "2026-11-14T08:00:00.000Z"
const end = "2026-11-14T09:00:00.000Z"

function adjustment(
  id: string,
  options: {
    type?: AttendanceAdjustment["type"]
    status?: AttendanceAdjustment["status"]
    reason?: string
    employeeName?: string
    overtimeMinutes?: number
    sessionId?: string | null
    reviewNote?: string | null
    verificationNote?: string | null
    capabilities?: Partial<AttendanceAdjustment["capabilities"]>
  } = {},
): AttendanceAdjustment {
  const reviewNote = options.reviewNote ?? null
  return {
    id,
    type: options.type ?? "CORRECTION",
    overtimeMinutes: options.overtimeMinutes ?? 0,
    verifiedById: options.verificationNote ? "head" : null,
    verificationNote: options.verificationNote ?? null,
    employeeId: `employee-${id}`,
    sessionId: options.sessionId ?? null,
    reason: options.reason ?? `${id} request reason`,
    status: options.status ?? "PENDING",
    proposedStartedAt: start,
    proposedEndedAt: end,
    createdAt: start,
    reviewNote,
    requestedById: "requester",
    employee: {
      id: `employee-${id}`,
      fullName: options.employeeName ?? `${id} Employee`,
      employeeId: `EMP-${id}`,
      departmentId: "department",
    },
    reviewedBy: reviewNote ? { id: "reviewer", fullName: "HR Reviewer" } : null,
    capabilities: {
      approve: false,
      verify: false,
      reject: false,
      ...options.capabilities,
    },
  }
}

function listPayload(
  adjustments: AttendanceAdjustment[],
  options: {
    total?: number
    page?: number
    pageSize?: number
    requestCorrection?: boolean
  } = {},
): ListPayload {
  return {
    adjustments,
    capabilities: { requestCorrection: options.requestCorrection ?? false },
    total: options.total ?? adjustments.length,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 10,
  }
}

async function stubAdjustmentList(
  page: Page,
  role: Account["role"],
  handler: ListHandler,
  account?: Partial<Account>,
) {
  await restoreSession(page, role, { account })
  const requests: URL[] = []
  await page.route("**/api/attendance/adjustments?**", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const reply = await handler(url, requests.length)
    await route.fulfill({ status: reply.status ?? 200, json: reply.body })
  })
  return requests
}

function waitForListResponse(
  page: Page,
  predicate: (url: URL) => boolean = () => true,
) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/adjustments" &&
      predicate(url)
    )
  })
}

function responseForQuery(url: URL, rows: AttendanceAdjustment[]): StubReply {
  const pageNumber = Number(url.searchParams.get("page") ?? "1")
  return {
    body: listPayload(rows, {
      page: pageNumber,
      total: 11,
      requestCorrection: false,
    }),
  }
}

function requestGate() {
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

test("[PG-004-F001-A002-T002] default route renders mixed scoped requests", async ({
  page,
}) => {
  const correction = adjustment("mixed-correction", {
    reason: "Correct clock-out from the mixed queue",
    status: "PENDING",
  })
  const overtime = adjustment("mixed-overtime", {
    type: "OVERTIME",
    overtimeMinutes: 120,
    reason: "Recorded overtime from the mixed queue",
    status: "VERIFIED",
  })
  const requests = await stubAdjustmentList(
    page,
    "STAFF",
    () => ({ body: listPayload([correction, overtime], { total: 2 }) }),
    { headOf: { id: "department", name: "Design" } },
  )
  const initial = waitForListResponse(page)
  await page.goto("/attendance/adjustments")
  expect((await initial).status()).toBe(200)

  expect(requests).toHaveLength(1)
  expect(requests[0]?.searchParams.get("scope")).toBe("team")
  expect(requests[0]?.searchParams.get("page")).toBe("1")
  expect(requests[0]?.searchParams.get("search")).toBe("")
  expect(requests[0]?.searchParams.get("type")).toBe("")
  expect(requests[0]?.searchParams.get("status")).toBe("")
  await expect(
    page.getByRole("heading", { name: "Requests & Approvals", exact: true }),
  ).toBeVisible()
  const table = page.getByRole("table", { name: "Attendance requests" })
  await expect(table).toHaveAttribute("aria-busy", "false")
  const correctionRow = page
    .getByRole("row")
    .filter({ hasText: correction.reason })
  const overtimeRow = page.getByRole("row").filter({ hasText: overtime.reason })
  await expect(
    correctionRow.getByText("Correction", { exact: true }),
  ).toBeVisible()
  await expect(
    correctionRow.getByText("Pending", { exact: true }),
  ).toBeVisible()
  await expect(overtimeRow.getByText("Overtime", { exact: true })).toBeVisible()
  await expect(overtimeRow.getByText("Verified", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Request type filter" }),
  ).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Request status filter" }),
  ).toBeVisible()
})

test("[PG-004-F001-A003-T003] mine and team scope follows the account", async ({
  page,
}) => {
  const scenarios = [
    { role: "STAFF", name: "Head", head: true, manager: true, self: true },
    { role: "ADMIN", name: "Admin", head: false, manager: true, self: true },
    { role: "STAFF", name: "Staff", head: false, manager: false, self: true },
    {
      role: "SUPERADMIN",
      name: "Superadmin",
      head: false,
      manager: true,
      self: false,
    },
  ] as const

  for (const scenario of scenarios) {
    const target = await page.context().newPage()
    try {
      const requests = await stubAdjustmentList(
        target,
        scenario.role,
        (url) => responseForQuery(url, [adjustment(`scope-${scenario.name}`)]),
        scenario.head
          ? { headOf: { id: "department", name: "Design" } }
          : undefined,
      )
      const initial = waitForListResponse(target)
      await target.goto("/attendance/adjustments")
      expect((await initial).status()).toBe(200)
      expect(requests[0]?.searchParams.get("scope")).toBe(
        scenario.manager ? "team" : "mine",
      )

      const group = target.getByRole("group", { name: "Request view" })
      if (scenario.manager && scenario.self) {
        const teamLabel =
          scenario.name === "Head"
            ? "Department requests"
            : "Organization requests"
        await expect(group).toBeVisible()
        await expect(
          group.getByRole("button", { name: teamLabel, exact: true }),
        ).toHaveAttribute("aria-pressed", "true")

        const secondPage = waitForListResponse(
          target,
          (url) => url.searchParams.get("page") === "2",
        )
        await target.getByRole("button", { name: "Next page" }).click()
        expect((await secondPage).status()).toBe(200)

        const mine = waitForListResponse(
          target,
          (url) =>
            url.searchParams.get("scope") === "mine" &&
            url.searchParams.get("page") === "1",
        )
        await group.getByRole("button", { name: "My requests" }).click()
        expect((await mine).status()).toBe(200)

        const team = waitForListResponse(
          target,
          (url) =>
            url.searchParams.get("scope") === "team" &&
            url.searchParams.get("page") === "1",
        )
        await group
          .getByRole("button", { name: teamLabel, exact: true })
          .click()
        expect((await team).status()).toBe(200)
      } else {
        await expect(group).toHaveCount(0)
        expect(requests[0]?.searchParams.get("scope")).toBe(
          scenario.self ? "mine" : "team",
        )
      }
    } finally {
      await target.close()
    }
  }
})

test("[PG-004-F001-A004-T004] search and filters update the default list query", async ({
  page,
}) => {
  await page.clock.install()
  const correction = adjustment("filter-correction", {
    reason: "Needle correction request",
    status: "PENDING",
  })
  const overtime = adjustment("filter-overtime", {
    type: "OVERTIME",
    overtimeMinutes: 60,
    reason: "Needle overtime request",
    status: "VERIFIED",
  })
  const allRows = [correction, overtime]
  const requests = await stubAdjustmentList(
    page,
    "STAFF",
    (url) => {
      const type = url.searchParams.get("type")
      const status = url.searchParams.get("status")
      const rows = allRows.filter(
        (item) =>
          (!type || item.type === type) && (!status || item.status === status),
      )
      return {
        body: listPayload(rows, {
          total: 11,
          page: Number(url.searchParams.get("page")),
        }),
      }
    },
    { headOf: { id: "department", name: "Design" } },
  )
  const initial = waitForListResponse(page)
  await page.goto("/attendance/adjustments")
  expect((await initial).status()).toBe(200)
  const search = page.getByRole("searchbox", {
    name: "Search attendance requests",
  })
  await expect(search).toHaveAttribute("maxlength", "100")

  async function visitSecondPage() {
    const response = waitForListResponse(
      page,
      (url) => url.searchParams.get("page") === "2",
    )
    await page.getByRole("button", { name: "Next page" }).click()
    expect((await response).status()).toBe(200)
  }

  await visitSecondPage()
  const settledCount = requests.length
  const searchResponse = waitForListResponse(
    page,
    (url) =>
      url.searchParams.get("search") === "Needle" &&
      url.searchParams.get("page") === "1",
  )
  await search.fill("Needle")
  await page.clock.runFor(199)
  expect(requests).toHaveLength(settledCount)
  await page.clock.runFor(1)
  expect((await searchResponse).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1")

  await visitSecondPage()
  const typeResponse = waitForListResponse(
    page,
    (url) =>
      url.searchParams.get("type") === "OVERTIME" &&
      url.searchParams.get("page") === "1",
  )
  await page.getByRole("combobox", { name: "Request type filter" }).click()
  await page.getByRole("option", { name: "Overtime", exact: true }).click()
  expect((await typeResponse).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("search")).toBe("Needle")

  await visitSecondPage()
  const statusResponse = waitForListResponse(
    page,
    (url) =>
      url.searchParams.get("type") === "OVERTIME" &&
      url.searchParams.get("status") === "VERIFIED" &&
      url.searchParams.get("page") === "1",
  )
  await page.getByRole("combobox", { name: "Request status filter" }).click()
  await page.getByRole("option", { name: "Verified", exact: true }).click()
  expect((await statusResponse).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("search")).toBe("Needle")
})

test("[PG-004-F001-A005-T005] pagination follows response metadata and disables during refresh", async ({
  page,
}) => {
  const rows = Array.from({ length: 11 }, (_, index) =>
    adjustment(`page-${index + 1}`, {
      reason: `Pagination request ${index + 1}`,
    }),
  )
  const gate = requestGate()
  const requests = await stubAdjustmentList(page, "STAFF", async (url) => {
    const pageNumber = Number(url.searchParams.get("page"))
    if (pageNumber === 2) {
      gate.start()
      await gate.pending
    }
    const offset = (pageNumber - 1) * 10
    return {
      body: listPayload(rows.slice(offset, offset + 10), {
        page: pageNumber,
        total: rows.length,
      }),
    }
  })
  try {
    const initial = waitForListResponse(page)
    await page.goto("/attendance/adjustments")
    expect((await initial).status()).toBe(200)
    await expect(page.getByText(/Showing 1.*10 of 11/)).toBeVisible()

    await page.getByRole("button", { name: "Next page" }).click()
    await gate.started
    const table = page.getByRole("table", { name: "Attendance requests" })
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()
    gate.release()
    await expect(table).toHaveAttribute("aria-busy", "false")
    await expect(
      page.getByText("Pagination request 11", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/Showing 11.*11 of 11/)).toBeVisible()
    expect(requests.at(-1)?.searchParams.get("page")).toBe("2")

    const firstPage = waitForListResponse(
      page,
      (url) => url.searchParams.get("page") === "1",
    )
    await page.getByRole("button", { name: "Previous page" }).click()
    expect((await firstPage).status()).toBe(200)
    await expect(
      page.getByText("Pagination request 1", { exact: true }),
    ).toBeVisible()
  } finally {
    gate.release()
  }
})

test("[PG-004-F001-A005-T006] loading, empty, error and retry states recover", async ({
  page,
}) => {
  const gate = requestGate()
  const recovered = adjustment("retry-recovered", {
    reason: "Recovered queue item",
  })
  const requests = await stubAdjustmentList(
    page,
    "STAFF",
    async (_url, count) => {
      if (count === 1) {
        gate.start()
        await gate.pending
        return { body: listPayload([]) }
      }
      if (count === 2)
        return {
          status: 503,
          body: { error: "Queue temporarily unavailable." },
        }
      return { body: listPayload([recovered]) }
    },
  )
  try {
    const first = waitForListResponse(page)
    await page.goto("/attendance/adjustments")
    await gate.started
    const table = page.getByRole("table", { name: "Attendance requests" })
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(page.getByRole("status")).toContainText(
      "Loading attendance requests",
    )
    gate.release()
    expect((await first).status()).toBe(200)
    await expect(
      page.getByText(
        "No requests. Submit an attendance correction or an overtime request to get started.",
      ),
    ).toBeVisible()

    const failed = waitForListResponse(page)
    await page.reload()
    expect((await failed).status()).toBe(503)
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Queue temporarily unavailable." }),
    ).toContainText("Queue temporarily unavailable.")
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible()

    const retried = waitForListResponse(page)
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    expect((await retried).status()).toBe(200)
    await expect(
      page.getByText(recovered.reason, { exact: true }),
    ).toBeVisible()
    expect(requests).toHaveLength(3)
  } finally {
    gate.release()
  }
})

test("[PG-004-F001-A006-T007] correction action is capability-gated and validates before writing", async ({
  page,
}) => {
  let writes = 0
  await stubAdjustmentList(page, "STAFF", () => ({
    body: listPayload([], { requestCorrection: true }),
  }))
  await page.route("**/api/attendance/adjustments", async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    writes += 1
    await route.fulfill({
      status: 409,
      json: { error: "A matching request already exists." },
    })
  })
  await page.goto("/attendance/adjustments")
  const action = page.getByRole("button", {
    name: "Request correction",
    exact: true,
  })
  await expect(action).toBeVisible()
  await action.click()
  const dialog = page.getByRole("dialog", {
    name: "Request missing attendance",
  })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("combobox", { name: "Request type" }),
  ).toHaveCount(0)
  const startInput = dialog.getByLabel("Actual clock-in", { exact: true })
  const endInput = dialog.getByLabel("Actual clock-out", { exact: true })
  await startInput.fill("2026-11-10T10:00")
  await endInput.fill("2026-11-10T09:00")
  await dialog.getByLabel("Reason", { exact: true }).fill("Reverse interval")
  await dialog.getByRole("button", { name: "Submit request" }).click()
  await expect(dialog.getByRole("alert")).toHaveText(
    "Actual clock-out must be after actual clock-in.",
  )
  expect(writes).toBe(0)

  await startInput.fill("2026-11-10T09:00")
  await endInput.fill("2026-11-10T10:00")
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/attendance/adjustments",
  )
  await dialog.getByRole("button", { name: "Submit request" }).click()
  expect((await rejected).status()).toBe(409)
  await expect(dialog.getByRole("alert")).toHaveText(
    "A matching request already exists.",
  )
  expect(writes).toBe(1)
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)

  for (const scenario of [
    { role: "STAFF", capability: false },
    { role: "SUPERADMIN", capability: true },
  ] as const) {
    const target = await page.context().newPage()
    try {
      await stubAdjustmentList(target, scenario.role, () => ({
        body: listPayload([], { requestCorrection: scenario.capability }),
      }))
      await target.goto("/attendance/adjustments")
      await expect(
        target.getByRole("button", {
          name: "Request correction",
          exact: true,
        }),
      ).toHaveCount(0)
    } finally {
      await target.close()
    }
  }
})

test("[PG-004-F001-A007-T011] row details are read-only and restore keyboard focus", async ({
  page,
}) => {
  const correction = adjustment("detail-correction", {
    status: "VERIFIED",
    reason: "Verified correction details",
    reviewNote: "Final HR review pending",
    verificationNote: "Department Head verified the times",
  })
  const overtime = adjustment("detail-overtime", {
    type: "OVERTIME",
    overtimeMinutes: 120,
    status: "PENDING",
    reason: "Overtime detail reason",
  })
  let detailReads = 0
  await stubAdjustmentList(page, "STAFF", () => ({
    body: listPayload([correction, overtime]),
  }))
  await page.route("**/api/attendance/adjustments/*", async (route) => {
    detailReads += 1
    await route.fulfill({
      status: 404,
      json: { error: "Unexpected detail read" },
    })
  })
  const initial = waitForListResponse(page)
  await page.goto("/attendance/adjustments")
  expect((await initial).status()).toBe(200)

  const correctionMenu = page.locator(
    `[id="attendance-adjustment-actions-${correction.id}"]`,
  )
  await correctionMenu.click()
  await page
    .getByRole("menuitem", { name: "View details", exact: true })
    .click()
  const correctionPanel = page.getByRole("dialog", {
    name: "Attendance correction",
  })
  await expect(correctionPanel.getByText(/Verified.*awaiting HR/)).toBeVisible()
  await expect(
    correctionPanel.getByText(correction.reason, { exact: true }),
  ).toBeVisible()
  await expect(
    correctionPanel.getByText(correction.reviewNote!, { exact: true }),
  ).toBeVisible()
  await expect(
    correctionPanel.getByText(correction.verificationNote!, { exact: true }),
  ).toBeVisible()
  await expect(correctionPanel.getByRole("textbox")).toHaveCount(0)
  await expect(
    correctionPanel.getByRole("button", { name: "Confirm decision" }),
  ).toHaveCount(0)
  expect(detailReads).toBe(0)
  await correctionPanel.getByRole("button", { name: "Done" }).click()
  await expect(correctionMenu).toBeFocused()

  const overtimeMenu = page.locator(
    `[id="attendance-adjustment-actions-${overtime.id}"]`,
  )
  await overtimeMenu.click()
  await page
    .getByRole("menuitem", { name: "View details", exact: true })
    .click()
  const overtimePanel = page.getByRole("dialog", { name: "Overtime request" })
  await expect(
    overtimePanel.getByText("120 minutes", { exact: true }),
  ).toBeVisible()
  await expect(
    overtimePanel.getByText(overtime.reason, { exact: true }),
  ).toBeVisible()
  await expect(overtimePanel.getByRole("textbox")).toHaveCount(0)
  expect(detailReads).toBe(0)
  await overtimePanel.getByRole("button", { name: "Done" }).click()
  await expect(overtimeMenu).toBeFocused()

  await test.step("[PG-004-F001-A011-T017] responsive and keyboard behavior", async () => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true)
    }

    await overtimeMenu.focus()
    await expect(overtimeMenu).toBeFocused()
    await overtimeMenu.press("ArrowDown")
    await expect(overtimeMenu).toHaveAttribute("aria-expanded", "true")
    const viewDetails = page.getByRole("menuitem", {
      name: "View details",
      exact: true,
    })
    await expect(viewDetails).toBeVisible()
    await expect(viewDetails).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(overtimeMenu).toBeFocused()

    await overtimeMenu.press("ArrowDown")
    await page.keyboard.press("Enter")
    await expect(overtimePanel).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(overtimePanel).toHaveCount(0)
    await expect(overtimeMenu).toBeFocused()
  })
})
