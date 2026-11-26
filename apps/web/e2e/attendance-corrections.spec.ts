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

const start = "2026-11-14T08:00:00.000Z"
const end = "2026-11-14T09:00:00.000Z"

function adjustment(
  id: string,
  options: {
    status?: AttendanceAdjustment["status"]
    reason?: string
    employeeName?: string
    sessionId?: string | null
    reviewNote?: string | null
    verificationNote?: string | null
    capabilities?: Partial<AttendanceAdjustment["capabilities"]>
  } = {},
): AttendanceAdjustment {
  const reviewNote = options.reviewNote ?? null
  return {
    id,
    type: "CORRECTION",
    overtimeMinutes: 0,
    verifiedById: options.verificationNote ? "head" : null,
    verificationNote: options.verificationNote ?? null,
    employeeId: `employee-${id}`,
    sessionId: options.sessionId ?? null,
    reason: options.reason ?? `${id} correction reason`,
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
  options: { requestCorrection?: boolean; total?: number; page?: number } = {},
): ListPayload {
  return {
    adjustments,
    capabilities: { requestCorrection: options.requestCorrection ?? false },
    total: options.total ?? adjustments.length,
    page: options.page ?? 1,
    pageSize: 10,
  }
}

async function stubList(
  page: Page,
  role: Account["role"],
  handler: (url: URL, count: number) => ListPayload | Promise<ListPayload>,
  account?: Partial<Account>,
) {
  await restoreSession(page, role, { account })
  const requests: URL[] = []
  await page.route("**/api/attendance/adjustments?**", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const body = await handler(url, requests.length)
    await route.fulfill({ json: body })
  })
  return requests
}

function waitForListResponse(page: Page, count?: number) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/attendance/adjustments" &&
      (count === undefined || url.searchParams.get("page") === String(count))
    )
  })
}

test("[PG-010-F001-A001-T002] Corrections route enforces the frontend access matrix", async ({
  page,
}) => {
  const scenarios: {
    role: Account["role"]
    allowed: boolean
    account?: Partial<Account>
  }[] = [
    { role: "STAFF", allowed: true },
    { role: "ADMIN", allowed: true },
    { role: "SUPERADMIN", allowed: true },
    { role: "SUPERADMIN", allowed: false, account: { permissions: [] } },
    { role: "USER", allowed: false },
    { role: "STAFF", allowed: false, account: { isActive: false } },
    { role: "ADMIN", allowed: false, account: { isActive: false } },
    {
      role: "SUPERADMIN",
      allowed: false,
      account: { isActive: false },
    },
  ]

  for (const scenario of scenarios) {
    const target = await page.context().newPage()
    try {
      const requests = await stubList(
        target,
        scenario.role,
        () => listPayload([]),
        "account" in scenario ? scenario.account : undefined,
      )
      if (scenario.allowed) {
        const response = waitForListResponse(target)
        await target.goto("/attendance/requests/corrections")
        expect((await response).status()).toBe(200)
        await expect(
          target.getByRole("heading", {
            name: "Attendance Corrections",
            exact: true,
          }),
        ).toBeVisible()
        expect(requests).toHaveLength(1)
      } else {
        await target.goto("/attendance/requests/corrections")
        await expect(target).toHaveURL(
          scenario.role === "USER" ? /\/dashboard(?:\/|$)/ : /\/module(?:\/|$)/,
        )
        expect(requests).toHaveLength(0)
        await expect(
          target.getByRole("heading", {
            name: "Attendance Corrections",
            exact: true,
          }),
        ).toHaveCount(0)
      }
    } finally {
      await target.close()
    }
  }
})

test("[PG-010-F001-A002-T004] Corrections starts with a fixed correction-only query", async ({
  page,
}) => {
  const requests = await stubList(
    page,
    "STAFF",
    () => listPayload([adjustment("typed-route")]),
    { headOf: { id: "department", name: "Design" } },
  )
  const response = waitForListResponse(page)
  await page.goto("/attendance/requests/corrections")
  expect((await response).status()).toBe(200)
  expect(requests[0]?.searchParams.get("type")).toBe("CORRECTION")
  expect(requests[0]?.searchParams.get("scope")).toBe("team")
  expect(requests[0]?.searchParams.get("page")).toBe("1")
  expect(requests[0]?.searchParams.get("search")).toBe("")
  expect(requests[0]?.searchParams.get("status")).toBe("")
  await expect(
    page.getByRole("heading", {
      name: "Attendance Corrections",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Request type filter" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("combobox", { name: "Request status filter" }),
  ).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: "typed-route correction reason" }),
  ).toBeVisible()
})

test("[PG-010-F001-A005-T008] correction status filtering preserves route type and resets page", async ({
  page,
}) => {
  const pending = adjustment("status-pending", { status: "PENDING" })
  const verified = adjustment("status-verified", { status: "VERIFIED" })
  const requests = await stubList(page, "STAFF", (url) => {
    const status = url.searchParams.get("status")
    const rows = [pending, verified].filter(
      (item) => !status || item.status === status,
    )
    return listPayload(rows, {
      total: status ? rows.length : 11,
      page: Number(url.searchParams.get("page")),
    })
  })
  const initial = waitForListResponse(page)
  await page.goto("/attendance/requests/corrections")
  expect((await initial).status()).toBe(200)
  expect(requests[0]?.searchParams.get("type")).toBe("CORRECTION")
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  const reset = waitForListResponse(page, 1)
  await page.getByRole("combobox", { name: "Request status filter" }).click()
  await page.getByRole("option", { name: "Verified", exact: true }).click()
  expect((await reset).status()).toBe(200)
  expect(requests.at(-1)?.searchParams.get("type")).toBe("CORRECTION")
  expect(requests.at(-1)?.searchParams.get("status")).toBe("VERIFIED")
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1")
  await expect(page.getByText(verified.reason, { exact: true })).toBeVisible()
  await expect(page.getByText(pending.reason, { exact: true })).toHaveCount(0)
})

test("[PG-010-F001-A012-T014] correction request form is capability-gated and cancels without a write", async ({
  page,
}) => {
  let writes = 0
  await stubList(page, "STAFF", () =>
    listPayload([], { requestCorrection: true }),
  )
  await page.route("**/api/attendance/adjustments", async (route) => {
    if (route.request().method() === "POST") writes += 1
    await route.fulfill({
      status: 201,
      json: { adjustment: adjustment("unused") },
    })
  })
  await page.goto("/attendance/requests/corrections")
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
    dialog.getByLabel("Actual clock-in", { exact: true }),
  ).toHaveValue("")
  await expect(
    dialog.getByLabel("Actual clock-out", { exact: true }),
  ).toHaveValue("")
  await expect(dialog.getByLabel("Reason", { exact: true })).toHaveValue("")
  await expect(
    dialog.getByRole("combobox", { name: "Request type" }),
  ).toHaveCount(0)
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toBe(0)

  const denied = await page.context().newPage()
  try {
    await stubList(denied, "STAFF", () =>
      listPayload([], { requestCorrection: false }),
    )
    await denied.goto("/attendance/requests/corrections")
    await expect(
      denied.getByRole("button", {
        name: "Request correction",
        exact: true,
      }),
    ).toHaveCount(0)
  } finally {
    await denied.close()
  }
})

test("[PG-010-F001-A021-T034] stale correction review remains open and reports the API conflict", async ({
  page,
}) => {
  const reason = "Correction requires review after an attendance update"
  const record = adjustment("stale-review", {
    reason,
    capabilities: { verify: true, reject: true },
  })
  await stubList(page, "STAFF", () => listPayload([record]), {
    headOf: { id: "department", name: "Design" },
  })
  let writes = 0
  await page.route("**/api/attendance/adjustments/*/review", async (route) => {
    writes += 1
    await route.fulfill({
      status: 409,
      json: {
        error: "Attendance changed after submission; request a new correction",
      },
    })
  })
  await page.goto("/attendance/requests/corrections")
  await page
    .getByRole("button", {
      name: "More actions for stale-review Employee's request",
    })
    .click()
  await page.getByRole("menuitem", { name: "Verify correction" }).click()
  const panel = page.getByRole("dialog", {
    name: "Verify attendance correction",
  })
  await expect(panel).toBeVisible()
  await panel
    .getByRole("textbox", { name: "Review note" })
    .fill("Verified against the current attendance record")
  const response = page.waitForResponse(
    (item) =>
      item.request().method() === "POST" &&
      new URL(item.url()).pathname.endsWith("/review"),
  )
  await panel.getByRole("button", { name: "Confirm decision" }).click()
  expect((await response).status()).toBe(409)
  await expect(panel).toBeVisible()
  await expect(panel.getByRole("alert")).toHaveText(
    "Attendance changed after submission; request a new correction",
  )
  await expect(panel.getByRole("textbox", { name: "Review note" })).toHaveValue(
    "Verified against the current attendance record",
  )
  await expect(
    page.getByText("Attendance request reviewed", { exact: true }),
  ).toHaveCount(0)
  expect(writes).toBe(1)
})

test("[PG-010-F001-A023-T035] correction row action and details respond to keyboard across viewports", async ({
  page,
}) => {
  const record = adjustment("keyboard-route", {
    reason: "Keyboard correction details",
    capabilities: { verify: true, reject: true },
  })
  await stubList(page, "STAFF", () => listPayload([record]), {
    headOf: { id: "department", name: "Design" },
  })

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const response = waitForListResponse(page)
    await page.goto("/attendance/requests/corrections")
    expect((await response).status()).toBe(200)
    const trigger = page.locator(
      "#attendance-adjustment-actions-keyboard-route",
    )
    await trigger.focus()
    await page.keyboard.press("ArrowDown")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    const view = page.getByRole("menuitem", {
      name: "View details",
      exact: true,
    })
    await expect
      .soft(view, `ArrowDown should expose View details at ${width}px`)
      .toBeVisible()

    if (!(await view.isVisible().catch(() => false))) {
      await page.reload()
      await expect(page.getByText(record.reason, { exact: true })).toBeVisible()
    }
    await trigger.click()
    await expect(view).toBeVisible()
    await view.click()
    const panel = page.getByRole("dialog", { name: "Attendance correction" })
    await expect(panel.getByText(record.reason, { exact: true })).toBeVisible()
    await expect(panel.getByRole("textbox")).toHaveCount(0)
    await panel.getByRole("button", { name: "Done", exact: true }).click()
    await expect(trigger).toBeFocused()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  }
})
