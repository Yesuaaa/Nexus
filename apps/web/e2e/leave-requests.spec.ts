import { expect, test, type Page, type Route } from "@playwright/test"
import type {
  LeavePage,
  LeavePreview,
  LeaveRequest,
} from "../src/features/leave/api/leave-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Leave UI cases use deterministic mocked API responses.")

const timestamp = "2026-11-20T00:00:00.000Z"

type LeaveOverrides = Omit<
  Partial<LeaveRequest>,
  "employee" | "days" | "decisions" | "capabilities"
> & {
  employee?: Partial<LeaveRequest["employee"]>
  days?: LeaveRequest["days"]
  decisions?: LeaveRequest["decisions"]
  capabilities?: Partial<LeaveRequest["capabilities"]>
}

function leaveRequest(overrides: LeaveOverrides = {}): LeaveRequest {
  const base: LeaveRequest = {
    id: "leave-1",
    employeeId: "employee-1",
    requestedById: "staff-1",
    routeDepartmentId: "department-1",
    type: "ANNUAL",
    reason: "A source-backed leave request reason",
    startDate: "2026-12-08T00:00:00.000Z",
    endDate: "2026-12-08T00:00:00.000Z",
    status: "SUBMITTED",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    verifiedAt: null,
    employee: {
      id: "employee-1",
      employeeId: "EXP-001",
      fullName: "Mira Employee",
      departmentId: "department-1",
      department: {
        id: "department-1",
        name: "Engineering",
        headId: "head-1",
      },
    },
    days: [
      {
        id: "day-1",
        workDate: "2026-12-08T00:00:00.000Z",
        timeZone: "Asia/Manila",
        policyName: "Weekdays",
        baseRequiredMinutes: 480,
        leaveMinutes: 480,
      },
    ],
    decisions: [
      {
        id: "decision-1",
        action: "SUBMITTED",
        note: null,
        version: 1,
        createdAt: timestamp,
        actor: { id: "staff-1", fullName: "Mira Employee" },
      },
    ],
    capabilities: {
      cancel: false,
      verify: false,
      approve: false,
      reject: false,
      reverse: false,
      fallback: false,
      requiresReverification: false,
    },
  }
  return {
    ...base,
    ...overrides,
    employee: { ...base.employee, ...overrides.employee },
    days: overrides.days ?? base.days,
    decisions: overrides.decisions ?? base.decisions,
    capabilities: { ...base.capabilities, ...overrides.capabilities },
  }
}

function leavePage(
  requests: LeaveRequest[],
  page = 1,
  pageSize = 20,
  total = requests.length,
): LeavePage {
  return {
    requests,
    capabilities: { submit: true },
    total,
    page,
    pageSize,
  }
}

function preview(days = 4, totalMinutes = 960): LeavePreview {
  return {
    days: Array.from({ length: days }, (_, index) => ({
      workDate: `2026-11-${String(20 + index).padStart(2, "0")}`,
      timeZone: "Asia/Manila",
      policyName: "Weekdays",
      baseRequiredMinutes: 480,
      leaveMinutes: index < 2 ? 480 : 0,
    })),
    totalMinutes,
  }
}

async function routeLeaveApi(
  page: Page,
  handler: (route: Route) => Promise<void>,
) {
  await page.route("**/api/leave/**", handler)
}

async function unknownLeaveRequest(route: Route) {
  await route.fulfill({
    status: 404,
    json: { error: "Unknown Leave test request" },
  })
}

test("[PG-011-F001-A002-T001] manager scope toggle sends the selected list query", async ({
  page,
}) => {
  const calls: URL[] = []
  const respond = async (route: Route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      calls.push(url)
      const scope = url.searchParams.get("scope")
      const name =
        scope === "mine" ? "Personal Employee" : "Department Employee"
      await route.fulfill({
        json: leavePage([
          leaveRequest({
            id: `leave-${scope}`,
            employee: { fullName: name },
          }),
        ]),
      })
      return
    }
    await unknownLeaveRequest(route)
  }

  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "department-1", name: "Engineering" } },
  })
  await routeLeaveApi(page, respond)
  await page.goto("/attendance/requests/leave")

  const scope = page.getByRole("group", { name: "Leave request view" })
  const departmentButton = scope.getByRole("button", {
    name: "Department requests",
  })
  const mineButton = scope.getByRole("button", { name: "My requests" })
  await expect(departmentButton).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("Department Employee", { exact: true }),
  ).toBeVisible()
  expect(calls[0]?.searchParams.get("scope")).toBe("team")
  expect(calls[0]?.searchParams.get("page")).toBe("1")

  const mineResponse = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("scope") === "mine",
  )
  await mineButton.click()
  await mineResponse
  await expect(mineButton).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("Personal Employee", { exact: true }),
  ).toBeVisible()
  expect(calls.at(-1)?.searchParams.get("page")).toBe("1")

  const teamResponse = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("scope") === "team",
  )
  await departmentButton.click()
  await teamResponse
  expect(calls.at(-1)?.searchParams.get("scope")).toBe("team")

  const adminPage = await page.context().newPage()
  try {
    const adminCalls: URL[] = []
    await restoreSession(adminPage, "ADMIN")
    await routeLeaveApi(adminPage, async (route) => {
      const url = new URL(route.request().url())
      if (
        url.pathname === "/api/leave/requests" &&
        route.request().method() === "GET"
      ) {
        adminCalls.push(url)
        await route.fulfill({ json: leavePage([]) })
        return
      }
      await unknownLeaveRequest(route)
    })
    await adminPage.goto("/attendance/requests/leave")
    await expect(
      adminPage
        .getByRole("group", { name: "Leave request view" })
        .getByRole("button", {
          name: "Organization requests",
        }),
    ).toHaveAttribute("aria-pressed", "true")
    expect(adminCalls[0]?.searchParams.get("scope")).toBe("team")
  } finally {
    await adminPage.close()
  }
})

test("[PG-011-F001-A003-T001] list loading, empty, error and retry states recover", async ({
  page,
}) => {
  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve))
  let calls = 0
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      calls += 1
      if (calls === 1) {
        await firstGate
        await route.fulfill({ json: leavePage([]) })
      } else if (calls === 2) {
        await route.fulfill({
          status: 503,
          json: { error: "Temporary outage" },
        })
      } else {
        await route.fulfill({ json: leavePage([leaveRequest()]) })
      }
      return
    }
    await unknownLeaveRequest(route)
  })

  await page.goto("/attendance/requests/leave")
  const table = page.getByRole("table", { name: "Leave requests" })
  await expect(table).toHaveAttribute("aria-busy", "true")
  releaseFirst()
  await expect(
    page.getByText("No leave requests match this view."),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByRole("alert")).toBeVisible()
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("Mira Employee")).toBeVisible()
  expect(calls).toBe(3)
})

test("[PG-011-F001-A004-T001] search debounces, caps input and resets pagination", async ({
  page,
}) => {
  const calls: URL[] = []
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      calls.push(url)
      const pageNumber = Number(url.searchParams.get("page") ?? "1")
      await route.fulfill({
        json: leavePage(
          [leaveRequest({ id: `leave-page-${pageNumber}` })],
          pageNumber,
          10,
          25,
        ),
      })
      return
    }
    await unknownLeaveRequest(route)
  })

  await page.goto("/attendance/requests/leave")
  const next = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("page") === "2",
  )
  await page.getByRole("button", { name: "Page 2" }).click()
  await next
  const search = page.getByRole("searchbox", { name: "Search leave requests" })
  await expect(search).toHaveAttribute("maxlength", "100")
  const before = calls.length
  await search.fill("Mira")
  await page.waitForTimeout(100)
  expect(calls).toHaveLength(before)
  await expect.poll(() => calls.length, { timeout: 1500 }).toBe(before + 1)
  expect(calls.at(-1)?.searchParams.get("search")).toBe("Mira")
  expect(calls.at(-1)?.searchParams.get("page")).toBe("1")

  await search.fill("")
  await search.pressSequentially("x".repeat(120))
  await expect(search).toHaveValue("x".repeat(100))
  await expect.poll(() => calls.length, { timeout: 1500 }).toBe(before + 2)
  expect(calls.at(-1)?.searchParams.get("search")).toHaveLength(100)
  expect(calls.at(-1)?.searchParams.get("page")).toBe("1")
})

test("[PG-011-F001-A005-T001] type, status and paired date filters compose", async ({
  page,
}) => {
  const calls: URL[] = []
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      calls.push(url)
      const pageNumber = Number(url.searchParams.get("page") ?? "1")
      await route.fulfill({ json: leavePage([], pageNumber, 10, 15) })
      return
    }
    await unknownLeaveRequest(route)
  })

  await page.goto("/attendance/requests/leave")
  await page.getByRole("button", { name: "Page 2" }).click()
  const typeResponse = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("type") === "SICK",
  )
  await page.getByRole("combobox", { name: "Leave type filter" }).click()
  await page.getByRole("option", { name: "Sick", exact: true }).click()
  await typeResponse
  expect(calls.at(-1)?.searchParams.get("page")).toBe("1")

  const statusResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).searchParams.get("status") === "APPROVED",
  )
  await page.getByRole("combobox", { name: "Leave status filter" }).click()
  await page.getByRole("option", { name: "Approved", exact: true }).click()
  await statusResponse
  expect(calls.at(-1)?.searchParams.get("type")).toBe("SICK")
  expect(calls.at(-1)?.searchParams.get("status")).toBe("APPROVED")
  expect(calls.at(-1)?.searchParams.get("page")).toBe("1")

  const fromResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/leave/requests",
  )
  await page.getByLabel("Leave filter start date").fill("2026-12-10")
  await fromResponse
  expect(calls.at(-1)?.searchParams.has("from")).toBe(false)
  expect(calls.at(-1)?.searchParams.has("to")).toBe(false)
  const toResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).searchParams.get("to") === "2026-12-12",
  )
  await page.getByLabel("Leave filter end date").fill("2026-12-12")
  await toResponse
  expect(calls.at(-1)?.searchParams.get("from")).toBe("2026-12-10")
  expect(calls.at(-1)?.searchParams.get("to")).toBe("2026-12-12")
  expect(calls.at(-1)?.searchParams.get("type")).toBe("SICK")
  expect(calls.at(-1)?.searchParams.get("status")).toBe("APPROVED")
})

test("[PG-011-F001-A008-T001] leave rows show source values at desktop and narrow widths", async ({
  page,
}) => {
  const row = leaveRequest({
    id: "leave-responsive-values",
    type: "SICK",
    startDate: "2026-12-31T00:00:00.000Z",
    endDate: "2027-01-01T00:00:00.000Z",
    status: "VERIFIED",
    employee: {
      id: "employee-no-department",
      employeeId: "EXP-UTC-01",
      fullName: "Mira No Department",
      departmentId: null,
      department: null,
    },
    days: [
      {
        id: "day-utc-1",
        workDate: "2026-12-31T00:00:00.000Z",
        timeZone: "Asia/Manila",
        policyName: "Weekdays",
        baseRequiredMinutes: 480,
        leaveMinutes: 480,
      },
      {
        id: "day-utc-2",
        workDate: "2027-01-01T00:00:00.000Z",
        timeZone: "Asia/Manila",
        policyName: "Weekdays",
        baseRequiredMinutes: 480,
        leaveMinutes: 240,
      },
    ],
    capabilities: { requiresReverification: true },
  })
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      await route.fulfill({ json: leavePage([row]) })
      return
    }
    await unknownLeaveRequest(route)
  })

  await page.goto("/attendance/requests/leave")
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const table = page.getByRole("table", { name: "Leave requests" })
    const dataRow = table
      .getByRole("row")
      .filter({ hasText: "Mira No Department" })
    await expect(dataRow).toBeVisible()
    await expect(dataRow).toContainText("Sick")
    await expect(dataRow).toContainText("Dec 31, 2026")
    await expect(dataRow).toContainText("Jan 1, 2027")
    await expect(dataRow).toContainText("12")
    await expect(dataRow).toContainText("No department")
    await expect(dataRow).toContainText("Awaiting Head verification")
  }
})

test("[PG-011-F001-A009-T002] capability menus and keyboard behavior remain observable at supported widths", async ({
  page,
}) => {
  const rows = [
    leaveRequest({
      id: "leave-menu-head",
      employee: { ...leaveRequest().employee, fullName: "Menu Head" },
      capabilities: { verify: true, reject: true },
    }),
    leaveRequest({
      id: "leave-menu-hr",
      employee: { ...leaveRequest().employee, fullName: "Menu HR" },
      status: "VERIFIED",
      capabilities: { approve: true, reject: true },
    }),
    leaveRequest({
      id: "leave-menu-owner",
      employee: { ...leaveRequest().employee, fullName: "Menu Owner" },
      capabilities: { cancel: true },
    }),
    leaveRequest({
      id: "leave-menu-approved",
      employee: { ...leaveRequest().employee, fullName: "Menu Approved" },
      status: "APPROVED",
      capabilities: { reverse: true },
    }),
    leaveRequest({
      id: "leave-menu-read-only",
      employee: { ...leaveRequest().employee, fullName: "Menu Read Only" },
    }),
  ]
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      await route.fulfill({ json: leavePage(rows) })
      return
    }
    await unknownLeaveRequest(route)
  })
  await page.goto("/attendance/requests/leave")

  // PG-011-F001-A009-T001: menu items must match API capabilities per row.
  const expectedItems = [
    ["Menu Head", ["View details", "Verify request", "Reject request"]],
    ["Menu HR", ["View details", "Approve request", "Reject request"]],
    ["Menu Owner", ["View details", "Cancel request"]],
    ["Menu Approved", ["View details", "Reverse approval"]],
    ["Menu Read Only", ["View details"]],
  ] as const
  for (const [name, labels] of expectedItems) {
    const trigger = page.getByRole("button", {
      name: `More actions for ${name}'s leave request`,
    })
    await trigger.click()
    const menu = page.getByRole("menu", {
      name: `Leave request actions for ${name}`,
    })
    await expect(menu.getByRole("menuitem")).toHaveText([...labels])
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
  }

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const trigger = page.locator('[id="leave-actions-leave-menu-head"]')
    await trigger.focus()
    await trigger.press("ArrowDown")
    await expect.soft(trigger).toHaveAttribute("aria-expanded", "true")
    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click()
    const menu = page.getByRole("menu", {
      name: "Leave request actions for Menu Head",
    })
    const viewItem = menu.getByRole("menuitem", { name: "View details" })
    await expect
      .soft(
        viewItem,
        `Keyboard-opened menu should expose View details at ${width}px`,
      )
      .toBeVisible()
    if (!(await viewItem.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape")
      await expect(trigger).toHaveAttribute("aria-expanded", "false")
      await trigger.click()
    }
    await expect(viewItem).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()

    await trigger.click()
    const view = menu.getByRole("menuitem", { name: "View details" })
    await expect(view).toBeVisible()
    await view.focus()
    await page.keyboard.press("Enter")
    await expect(
      page.getByRole("dialog", { name: "Leave request" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Close leave request" }).click()
  }
})

test("[PG-011-F001-A011-T001] request form initializes and cancels without writing", async ({
  page,
}) => {
  let submitCalls = 0
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    const request = route.request()
    if (url.pathname === "/api/leave/requests" && request.method() === "GET") {
      await route.fulfill({ json: leavePage([]) })
      return
    }
    if (url.pathname === "/api/leave/requests" && request.method() === "POST") {
      submitCalls += 1
      await route.fulfill({ status: 201, json: { request: leaveRequest() } })
      return
    }
    await unknownLeaveRequest(route)
  })
  await page.goto("/attendance/requests/leave")
  await page.getByRole("button", { name: "Request leave" }).click()
  const dialog = page.getByRole("dialog", { name: "Request leave" })
  await expect(
    dialog.getByRole("combobox", { name: "Leave type" }),
  ).toContainText("Annual leave")
  await expect(dialog.getByLabel("Leave start date")).toHaveValue("")
  await expect(dialog.getByLabel("Leave end date")).toHaveValue("")
  await expect(
    dialog.getByPlaceholder(
      "Explain the leave request for authorized reviewers.",
    ),
  ).toHaveValue("")
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitCalls).toBe(0)
})

test("[PG-011-F001-A011-T002] required fields, reason limits and pending submission lock hold", async ({
  page,
}) => {
  let releaseSubmit!: () => void
  const submitGate = new Promise<void>((resolve) => (releaseSubmit = resolve))
  let postCount = 0
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    const request = route.request()
    if (url.pathname === "/api/leave/requests" && request.method() === "GET") {
      await route.fulfill({ json: leavePage([]) })
      return
    }
    if (url.pathname === "/api/leave/preview" && request.method() === "POST") {
      await route.fulfill({ json: preview(1, 480) })
      return
    }
    if (url.pathname === "/api/leave/requests" && request.method() === "POST") {
      postCount += 1
      await submitGate
      await route.fulfill({
        status: 503,
        json: { error: "Temporary submit failure" },
      })
      return
    }
    await unknownLeaveRequest(route)
  })
  await page.goto("/attendance/requests/leave")
  await page.getByRole("button", { name: "Request leave" }).click()
  const dialog = page.getByRole("dialog", { name: "Request leave" })
  const start = dialog.getByLabel("Leave start date")
  const end = dialog.getByLabel("Leave end date")
  const reason = dialog.getByPlaceholder(
    "Explain the leave request for authorized reviewers.",
  )
  const submit = dialog.getByRole("button", {
    name: /Submit request|Submitting/,
  })
  await expect(start).toHaveAttribute("required", "")
  await expect(end).toHaveAttribute("required", "")
  await expect(reason).toHaveAttribute("minlength", "5")
  await expect(reason).toHaveAttribute("maxlength", "2000")
  await expect(submit).toBeDisabled()
  await start.fill("2026-12-08")
  await end.fill("2026-12-08")
  await expect(submit).toBeEnabled()
  await reason.fill("four")
  await submit.click()
  expect(postCount).toBe(0)
  await reason.fill("x".repeat(2000))
  await reason.pressSequentially("x")
  await expect(reason).toHaveValue("x".repeat(2000))
  await reason.fill("Valid request reason")
  await submit.click()
  await expect(submit).toHaveText(/Submitting/)
  await expect(start).toBeDisabled()
  await expect(end).toBeDisabled()
  await expect(reason).toBeDisabled()
  expect(postCount).toBe(1)
  releaseSubmit()
  await expect(dialog.getByRole("alert")).toBeVisible()
  await expect(start).toHaveValue("2026-12-08")
  await expect(end).toHaveValue("2026-12-08")
  await expect(reason).toHaveValue("Valid request reason")
  await expect(start).toBeEnabled()
})

test("[PG-011-F001-A012-T002] preview displays coverage, blocks submit on failure and recovers", async ({
  page,
}) => {
  let previews = 0
  let submits = 0
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    const request = route.request()
    if (url.pathname === "/api/leave/requests" && request.method() === "GET") {
      await route.fulfill({ json: leavePage([]) })
      return
    }
    if (url.pathname === "/api/leave/preview" && request.method() === "POST") {
      previews += 1
      if (previews === 2)
        await route.fulfill({
          status: 409,
          json: { error: "No policy coverage for this range" },
        })
      else await route.fulfill({ json: preview() })
      return
    }
    if (url.pathname === "/api/leave/requests" && request.method() === "POST") {
      submits += 1
      await route.fulfill({ status: 201, json: { request: leaveRequest() } })
      return
    }
    await unknownLeaveRequest(route)
  })
  await page.goto("/attendance/requests/leave")
  await page.getByRole("button", { name: "Request leave" }).click()
  const dialog = page.getByRole("dialog", { name: "Request leave" })
  const start = dialog.getByLabel("Leave start date")
  const end = dialog.getByLabel("Leave end date")
  const submit = dialog.getByRole("button", { name: "Submit request" })
  await start.fill("2026-11-20")
  await end.fill("2026-11-23")
  const status = dialog.getByRole("status")
  // PG-011-F001-A012-T001: render server-calculated days and covered hours.
  await expect(status).toContainText("2 working day(s), 16 hours covered.")
  await expect(submit).toBeEnabled()

  await end.fill("2026-11-24")
  await expect(status).toContainText("No policy coverage for this range")
  await expect(submit).toBeDisabled()
  expect(submits).toBe(0)

  await end.fill("2026-11-25")
  await expect(status).toContainText("2 working day(s), 16 hours covered.")
  await expect(submit).toBeEnabled()
  expect(submits).toBe(0)
})

test("[PG-011-F001-A015-T001] cancellation confirms before writing and preserves its note", async ({
  page,
}) => {
  let current = leaveRequest({ capabilities: { cancel: true } })
  let writes = 0
  let posted:
    { actionId: string; expectedVersion: number; note: string } | undefined
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    const request = route.request()
    if (url.pathname === "/api/leave/requests" && request.method() === "GET") {
      await route.fulfill({ json: leavePage([current]) })
      return
    }
    if (url.pathname.endsWith("/cancel") && request.method() === "POST") {
      writes += 1
      posted = request.postDataJSON() as {
        actionId: string
        expectedVersion: number
        note: string
      }
      current = leaveRequest({
        ...current,
        status: "CANCELLED",
        version: 2,
        capabilities: { cancel: false },
        decisions: [
          ...current.decisions,
          {
            id: "decision-cancelled",
            action: "CANCELLED",
            note: posted.note,
            version: 2,
            createdAt: timestamp,
            actor: { id: "staff-1", fullName: "Mira Employee" },
          },
        ],
      })
      await route.fulfill({ json: { request: current } })
      return
    }
    await unknownLeaveRequest(route)
  })
  await page.goto("/attendance/requests/leave")
  await page.locator('[id="leave-actions-leave-1"]').click()
  await page.getByRole("menuitem", { name: "Cancel request" }).click()
  const panel = page.getByRole("dialog", { name: "Cancel request" })
  const note = panel.getByLabel("Decision note")
  await note.fill("Dates are no longer needed")
  await panel.getByRole("button", { name: "Cancel request" }).click()
  const confirmation = page
    .getByRole("dialog")
    .filter({ hasText: "This cancels the entire leave request." })
  await expect(confirmation).toBeVisible()
  expect(writes).toBe(0)
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
  await expect(confirmation).toHaveCount(0)
  expect(writes).toBe(0)

  await panel.getByRole("button", { name: "Cancel request" }).click()
  const confirmAgain = page
    .getByRole("dialog")
    .filter({ hasText: "This cancels the entire leave request." })
  const response = page.waitForResponse(
    (item) =>
      new URL(item.url()).pathname === "/api/leave/requests/leave-1/cancel",
  )
  await confirmAgain.getByRole("button", { name: "Cancel request" }).click()
  const result = await response
  expect(result.status()).toBe(200)
  expect(posted).toMatchObject({
    expectedVersion: 1,
    note: "Dates are no longer needed",
  })
  expect(posted?.actionId).toMatch(/^[0-9a-f-]{36}$/i)
  await expect(
    page.getByRole("dialog", { name: "Cancel request" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Mira Employee" }),
  ).toContainText("Cancelled")
  expect(writes).toBe(1)
})

test("[PG-011-F001-A024-T001] responsive table and detail controls retain names and focus", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await routeLeaveApi(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/leave/requests" &&
      route.request().method() === "GET"
    ) {
      await route.fulfill({ json: leavePage([leaveRequest()]) })
      return
    }
    await unknownLeaveRequest(route)
  })
  await page.goto("/attendance/requests/leave")

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const table = page.getByRole("table", { name: "Leave requests" })
    const overflows = await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    )
    expect(overflows).toBe(false)
    const trigger = page.getByRole("button", {
      name: "More actions for Mira Employee's leave request",
    })
    await trigger.click()
    await page.getByRole("menuitem", { name: "View details" }).click()
    const detail = page.getByRole("dialog", { name: "Leave request" })
    await expect(
      detail.getByRole("heading", { name: "Request summary" }),
    ).toBeVisible()
    await expect(
      detail.getByText("A source-backed leave request reason", { exact: true }),
    ).toBeVisible()
    await detail.getByRole("button", { name: "Close leave request" }).click()
    await expect(trigger).toBeFocused()
  }
})
