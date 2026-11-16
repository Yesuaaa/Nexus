import { test, expect } from "@playwright/test"
import {
  restoreSession,
  configureRegressionTest,
  live,
} from "./regression-support"
configureRegressionTest()
test.skip(
  live,
  "System Logs UI uses isolated frontend fixtures; production API remains disabled",
)
const operation = "5168086b-2d02-4e99-9c14-93cef129aabc"
const event = {
  schemaVersion: 1,
  eventId: "audit.account-management:one",
  source: "audit.account-management",
  sourceEventId: "one",
  occurredAt: "2026-11-16T01:00:00.000Z",
  category: "audit",
  area: "module",
  moduleId: "administration",
  sourceAction: "ROLE_CHANGED",
  eventName: "account.role_changed",
  severity: "info",
  outcome: "succeeded",
  actor: {
    kind: "account",
    accountId: "historical-actor",
    roleAtTime: "ADMIN",
    roleEvidence: "recorded",
  },
  subject: { type: "account", id: "deleted-account" },
  correlation: { operationId: operation },
  details: {
    kind: "management",
    changedFields: ["role"],
    transitions: { role: { before: "STAFF", after: "ADMIN" } },
    sessionsRevoked: null,
  },
  privateField: "private-sentinel",
}
const envelope = (events = [event], nextCursor: string | null = null) => ({
  schemaVersion: 1,
  events,
  nextCursor,
  complete: true,
  snapshotBoundary: "2026-11-16T02:00:00.000Z",
  sources: [
    {
      source: event.source,
      status: "available",
      reasonCode: null,
      omittedCount: 0,
    },
  ],
  grouping: {
    scope: "page",
    eventCount: events.length,
    operationCount: events.length ? 1 : 0,
  },
})
for (const [device, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["laptop", 1280, 800],
  ["desktop", 1600, 1000],
] as const) {
  test(`${device}: audit filtering, details, operation investigation and cursor replacement`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await restoreSession(page, "SUPERADMIN")
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.workspace.actor", "people-hr"),
    )
    const paths: string[] = []
    await page.route("**/api/system-logs/**", async (route) => {
      expect(route.request().headers().authorization).toBe(
        "Bearer test-session",
      )
      const url = new URL(route.request().url())
      paths.push(url.pathname + url.search)
      if (url.pathname.includes("/events/"))
        return route.fulfill({
          json: {
            schemaVersion: 1,
            event,
            status: "available",
            reasonCode: null,
          },
        })
      const next = {
        ...event,
        eventId: "audit.account-management:two",
        sourceEventId: "two",
        subject: { type: "account", id: "second-account" },
      }
      return route.fulfill({
        json: url.searchParams.has("cursor")
          ? envelope([next])
          : envelope([event], "signed-fixture-cursor"),
      })
    })
    await page.goto("/system-logs")
    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click()
      await expect(
        page.getByRole("complementary").getByText("Shared", { exact: true }),
      ).toBeVisible()
      await page
        .getByRole("link", { name: "System Logs (Unavailable)" })
        .click()
    }
    if (width >= 1280)
      await expect(
        page.getByRole("link", { name: "System Logs (Unavailable)" }),
      ).toHaveAttribute("href", "/system-logs")
    await expect(
      page.getByRole("heading", { name: "System Logs & Diagnostics" }),
    ).toBeVisible()
    await expect(
      page.getByText("1 operation on this page", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Unavailable for production release."),
    ).toBeVisible()
    await expect(page.getByLabel("Current audit module")).toContainText(
      "People & HR",
    )
    await expect(
      page.getByRole("combobox", { name: "Module filter" }),
    ).toHaveCount(0)
    await expect(
      page.getByText("Advanced Filters", { exact: true }),
    ).toHaveCount(0)
    const release = page.locator("details").filter({
      has: page.getByText("Unavailable for production release.", {
        exact: true,
      }),
    })
    await expect(release).not.toHaveAttribute("open")
    await release.locator("summary").focus()
    await page.keyboard.press("Enter")
    await expect(release).toHaveAttribute("open", "")
    await expect(release.locator("p")).toContainText("durable access evidence")
    await page.keyboard.press("Enter")
    await expect(release).not.toHaveAttribute("open")
    await page.getByRole("button", { name: /^Filter options/ }).click()
    await page.getByRole("combobox", { name: "Module filter" }).click()
    await page
      .getByRole("option", {
        name: "Service Operations — Partial — client accounts and request events",
        exact: true,
      })
      .click()
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(
      page.getByRole("table", { name: "Management audit events" }),
    ).toContainText("deleted-account")
    await page.getByRole("button", { name: "Next page", exact: true }).click()
    await expect(page.getByRole("table")).toContainText("second-account")
    await expect(page.getByRole("table")).not.toContainText("deleted-account")
    await page.getByRole("button", { name: "Previous page" }).click()
    await expect(page.getByRole("table")).toContainText("deleted-account")
    await page.getByRole("button", { name: /^Filter options/ }).click()
    await page.getByLabel("Actor ID", { exact: true }).fill("historical-actor")
    await page.getByRole("button", { name: "Apply filters" }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Filter options/ }),
    ).toContainText("1 applied")
    await expect
      .poll(() => paths.some((p) => p.includes("actorId=historical-actor")))
      .toBe(true)
    await expect
      .poll(() =>
        paths.some(
          (p) =>
            p.includes("actorId=historical-actor") &&
            p.includes("moduleId=service-operations"),
        ),
      )
      .toBe(true)
    await page
      .getByRole("button", {
        name: "View event one from audit.account-management",
      })
      .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await page.screenshot({
      path: `test-results/system-logs-details-${device}.png`,
    })
    await expect(
      dialog.getByText("Role at time", { exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByText("STAFF → ADMIN", { exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByText("historical-actor", { exact: true }),
    ).toBeVisible()
    await expect(page.locator("body")).not.toContainText("private-sentinel")
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await expect(
      page.getByRole("button", {
        name: "View event one from audit.account-management",
      }),
    ).toBeFocused()
    await page
      .getByRole("button", {
        name: "View event one from audit.account-management",
      })
      .click()
    await dialog.getByRole("button", { name: "Investigate operation" }).click()
    await expect
      .poll(() => paths.some((p) => p.includes(`/operations/${operation}`)))
      .toBe(true)
    expect(
      [...paths].reverse().find((p) => p.includes(`/operations/${operation}`)),
    ).toContain("moduleId=service-operations")
    expect(
      [...paths].reverse().find((p) => p.includes(`/operations/${operation}`)),
    ).toContain("actorId=historical-actor")
    await page.getByRole("button", { name: "Back to filtered history" }).click()
    await page.getByRole("button", { name: /^Filter options/ }).click()
    await expect(page.getByLabel("Actor ID", { exact: true })).toHaveValue(
      "historical-actor",
    )
    await expect(
      page.getByRole("combobox", { name: "Module filter" }),
    ).toContainText("Service Operations")
    await expect(page.getByLabel("Operation ID", { exact: true })).toHaveValue(
      "",
    )
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await expect(
      page.getByRole("button", { name: "Back to filtered history" }),
    ).toHaveCount(0)
    await expect(page.getByRole("table")).toContainText("deleted-account")
    await page
      .getByLabel("Event search (optional)", { exact: true })
      .fill("account.role_changed")
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click()
    await expect
      .poll(() => paths.at(-1))
      .toContain("eventName=account.role_changed")
    await page.getByRole("button", { name: "All Modules", exact: true }).click()
    await expect(page.getByLabel("Current audit module")).toContainText(
      "All Modules",
    )
    await expect
      .poll(() => {
        const params = new URLSearchParams(paths.at(-1)?.split("?")[1])
        return [
          params.get("moduleId"),
          params.get("actorId"),
          params.get("eventName"),
        ]
      })
      .toEqual([null, "historical-actor", "account.role_changed"])
    await page
      .getByRole("button", { name: "Workspace only", exact: true })
      .click()
    await expect(page.getByLabel("Current audit module")).toContainText(
      "People & HR",
    )
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click()
    await expect
      .poll(() => {
        const params = new URLSearchParams(paths.at(-1)?.split("?")[1])
        return [
          params.get("moduleId"),
          params.get("actorId"),
          params.get("eventName"),
        ]
      })
      .toEqual(["people-hr", null, null])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `test-results/system-logs-${device}.png`,
      fullPage: true,
    })
  })
}

for (const [workspace, title, readable] of [
  ["administration", "Administration", true],
  ["people-hr", "People & HR", true],
  ["service-operations", "Service Operations", true],
  ["project-management", "Project Management", true],
  ["attendance-monitoring", "Workforce Compliance", true],
] as const) {
  test(`Shared System Logs retains ${workspace} origin and coverage`, async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN")
    await page.addInitScript(
      (id) => sessionStorage.setItem("nexus.workspace.actor", id),
      workspace,
    )
    const queries: string[] = []
    await page.route("**/api/system-logs/**", async (route) => {
      queries.push(route.request().url())
      return route.fulfill({ json: envelope() })
    })
    await page.goto("/settings")
    const sidebar = page.getByRole("complementary", {
      name: "Primary navigation",
    })
    await expect(
      sidebar.getByRole("link", { name: "System Logs (Unavailable)" }),
    ).toBeVisible()
    const order = await sidebar.locator("nav").innerText()
    expect(order.indexOf("Shared")).toBeLessThan(
      order.indexOf("System Logs (Unavailable)"),
    )
    expect(order.indexOf("Calendar")).toBeLessThan(
      order.indexOf("System Logs (Unavailable)"),
    )
    expect(order.indexOf("System Logs (Unavailable)")).toBeLessThan(
      order.indexOf("Internal Messages"),
    )
    await sidebar
      .getByRole("link", { name: "System Logs (Unavailable)" })
      .click()
    await expect(page).toHaveURL(/\/system-logs$/)
    await expect(page.getByLabel("Current audit module")).toContainText(title)
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("nexus.workspace.actor"),
      ),
    ).toBe(workspace)
    if (readable)
      await expect
        .poll(() =>
          queries.some(
            (q) => new URL(q).searchParams.get("moduleId") === workspace,
          ),
        )
        .toBe(true)
    else {
      await expect(page.getByRole("table")).toContainText(
        "No integrated history source",
      )
      expect(queries).toHaveLength(0)
    }
    await page.getByRole("button", { name: /^Filter options/ }).click()
    await page.getByRole("combobox", { name: "Module filter" }).click()
    await expect(
      page.getByRole("option", {
        name: /Billing & Finance.*Not yet integrated/,
      }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await page
      .getByRole("button", { name: "Close investigation filters" })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await page
      .getByRole("button", {
        name: readable ? "All Modules" : "Show All Modules",
        exact: true,
      })
      .click()
    await expect
      .poll(() => queries.some((q) => !new URL(q).searchParams.has("moduleId")))
      .toBe(true)
    await expect(
      page.getByRole("note", { name: "Module history coverage" }),
    ).toContainText("not complete application-wide")
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("nexus.workspace.actor"),
      ),
    ).toBe(workspace)
  })
}
test("partial, unavailable, scan cap, malformed and failed pages keep privacy and retry semantics", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let state = "partial",
    requests = 0
  await page.route("**/api/system-logs/**", async (route) => {
    requests++
    if (state === "disabled")
      return route.fulfill({
        status: 404,
        json: { error: "Not found", stack: "private-sentinel" },
      })
    if (state === "error")
      return route.fulfill({ status: 500, json: { error: "private-sentinel" } })
    if (state === "malformed")
      return route.fulfill({
        json: {
          ...envelope(),
          events: [
            {
              ...event,
              details: {
                ...event.details,
                transitions: {
                  email: { before: "private-sentinel", after: "secret" },
                },
              },
            },
          ],
        },
      })
    if (state === "empty") return route.fulfill({ json: envelope([]) })
    if (state === "scan")
      return route.fulfill({
        json: {
          ...envelope([], "scan-cursor"),
          complete: false,
          sources: [
            {
              source: event.source,
              status: "available",
              reasonCode: "SCAN_CAP",
              omittedCount: 500,
            },
          ],
        },
      })
    return route.fulfill({
      status: 503,
      json: {
        ...envelope(),
        nextCursor: null,
        complete: false,
        sources: [
          {
            source: event.source,
            status: "unavailable",
            reasonCode: "SOURCE_UNAVAILABLE",
            omittedCount: null,
          },
        ],
      },
    })
  })
  await page.goto("/system-logs")
  const alerts = page.locator('[role="alert"]:not(#__next-route-announcer__)')
  await expect(alerts).toContainText("Incomplete history")
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeDisabled()
  state = "scan"
  await page.getByRole("button", { name: "Retry this page" }).click()
  await expect(page.getByText(/Scan limit reached/)).toBeVisible()
  await expect(page.getByRole("table")).not.toContainText("deleted-account")
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeEnabled()
  state = "empty"
  await page.getByRole("button", { name: "Retry this page" }).click()
  await expect(page.getByRole("table")).toContainText("No audit events match")
  state = "malformed"
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(alerts).toContainText("could not be verified")
  state = "error"
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(alerts).toContainText("could not be loaded")
  state = "disabled"
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(alerts).toContainText("Production access remains disabled")
  await expect(page.locator("body")).not.toContainText("private-sentinel")
  const before = requests
  await page.getByLabel("From date (UTC)").fill("2026-01-01")
  await page.getByLabel("To date (UTC)").fill("2026-03-01")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Choose an ordered UTC date range" }),
  ).toBeVisible()
  expect(requests).toBe(before)
})
for (const role of ["ADMIN", "STAFF", "USER"] as const)
  test(`${role} cannot open or request System Logs`, async ({ page }) => {
    await restoreSession(page, role)
    let reads = 0
    await page.route("**/api/system-logs/**", (route) => {
      reads++
      return route.fulfill({
        status: 403,
        json: { error: "Insufficient permissions" },
      })
    })
    await page.goto("/system-logs")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    expect(reads).toBe(0)
    await expect(
      page.getByRole("link", { name: "System Logs (Unavailable)" }),
    ).toHaveCount(0)
  })

test("accessible loading, details retry and denied API responses", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let detailsFailed = true,
    denied = false
  await page.route("**/api/system-logs/**", async (route) => {
    if (route.request().url().includes("/events/"))
      return route.fulfill(
        detailsFailed
          ? { status: 503, json: { error: "private-sentinel" } }
          : {
              json: {
                schemaVersion: 1,
                event,
                status: "available",
                reasonCode: null,
              },
            },
      )
    if (denied)
      return route.fulfill({ status: 403, json: { error: "private-sentinel" } })
    await pending
    return route.fulfill({ json: envelope() })
  })
  await page.goto("/system-logs")
  await expect(
    page.getByRole("status").filter({ hasText: "Loading management history" }),
  ).toBeVisible()
  await expect(page.getByRole("table")).toHaveAttribute("aria-busy", "true")
  release()
  await page
    .getByRole("button", {
      name: "View event one from audit.account-management",
    })
    .click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("alert")).toContainText(
    "Event details are unavailable",
  )
  detailsFailed = false
  await dialog.getByRole("button", { name: "Retry details" }).click()
  await expect(dialog.getByText("STAFF → ADMIN", { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  denied = true
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "Your current account" }),
  ).toBeVisible()
  await expect(page.getByRole("table")).not.toContainText("deleted-account")
  await expect(page.locator("body")).not.toContainText("private-sentinel")
})
