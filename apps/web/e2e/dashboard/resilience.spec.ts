import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const action = {
  id: "action",
  requestId: "req",
  reference: "REQ-100",
  service: "Web service",
  title: "Current obligation",
  reason: "Please review.",
}
const actionPage = (
  actions: (typeof action)[] = [action],
  total = actions.length,
  page = 1,
) => ({ actions, total, page, pageSize: 10 })

test("malformed successful payloads stay within their own section", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  await page.route("**/api/projects", (route) =>
    route.fulfill({ json: { projects: [] } }),
  )
  await page.route("**/api/client/service-requests?*", (route) =>
    route.fulfill({ json: { requests: {} } }),
  )
  await page.route("**/api/request-workflows/outstanding-actions?*", (route) =>
    route.fulfill({ json: { actions: {}, total: 1, page: 1, pageSize: 10 } }),
  )
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({ json: { notifications: {}, unreadCount: 1 } }),
  )
  await page.route("**/api/projects/calendar", (route) =>
    route.fulfill({ json: { events: {} } }),
  )
  await page.goto("/dashboard")
  const main = page.getByRole("main", { name: "Client dashboard" })
  await expect(main).toBeVisible()
  await expect(main.getByRole("alert")).toHaveCount(5)
})

test("a removed final action page returns to the last available page", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let removed = false
  await page.route(
    "**/api/request-workflows/outstanding-actions?*",
    (route) => {
      const requested = Number(
        new URL(route.request().url()).searchParams.get("page"),
      )
      const actions =
        requested === 1
          ? [action]
          : removed
            ? []
            : [{ ...action, id: "last", title: "Last obligation" }]
      return route.fulfill({
        json: actionPage(actions, removed ? 1 : 11, requested),
      })
    },
  )
  await page.goto("/dashboard")
  const panel = page.getByRole("region", { name: "Needs Your Input" })
  await panel.getByRole("button", { name: "Review Now" }).click()
  await panel.getByRole("button", { name: "Show all actions" }).click()
  await panel.getByRole("button", { name: "Next page" }).click()
  await expect(panel.getByText("Last obligation")).toBeVisible()
  removed = true
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(panel.getByText("Current obligation")).toBeVisible()
  await expect(panel.getByText("1 action", { exact: true })).toBeVisible()
  await expect(panel.getByText("Last obligation")).toHaveCount(0)
})

test("older action responses and preview navigation cannot replace a newer result", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let release = () => {}
  let first = true
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let reached = () => {}
  const pending = new Promise<void>((resolve) => {
    reached = resolve
  })
  await page.route(
    "**/api/request-workflows/outstanding-actions?*",
    async (route) => {
      if (first) {
        first = false
        reached()
        await gate
        await route
          .fulfill({
            json: actionPage([{ ...action, title: "Stale obligation" }]),
          })
          .catch(() => {})
        return
      }
      await route.fulfill({ json: actionPage() })
    },
  )
  try {
    await page.goto("/dashboard")
    await pending
    await page.evaluate(() => window.dispatchEvent(new Event("online")))
    await page.getByRole("button", { name: "Review Now" }).click()
    await expect(page.getByText("Current obligation")).toBeVisible()
    release()
    await expect(page.getByText("Stale obligation")).toHaveCount(0)
    await page.goto("/dashboard?preview=loaded")
    await expect(page.getByText("Preview · Sample data")).toBeVisible()
    await expect(page.getByText("Current obligation")).toHaveCount(0)
    await page.goto("/dashboard")
    await page.getByRole("button", { name: "Review Now" }).click()
    await expect(page.getByText("Current obligation")).toBeVisible()
    await expect(page.getByText("Preview · Sample data")).toHaveCount(0)
  } finally {
    release()
  }
})

for (const failure of [
  400,
  403,
  404,
  409,
  422,
  429,
  500,
  502,
  503,
  "malformed JSON",
  "empty body",
  "connection lost",
] as const) {
  test(`action read recovers from ${failure} without losing projects`, async ({
    page,
  }) => {
    await restoreSession(page, "USER")
    let recovered = false
    let calls = 0
    await page.route("**/api/projects", (route) =>
      route.fulfill({
        json: [
          {
            id: "p",
            name: "Available project",
            status: "IN_PROGRESS",
            completedTasks: 0,
            taskCount: 2,
          },
        ],
      }),
    )
    await page.route(
      "**/api/request-workflows/outstanding-actions?*",
      (route) => {
        calls++
        if (recovered) return route.fulfill({ json: actionPage() })
        if (failure === "connection lost")
          return route.abort("internetdisconnected")
        if (failure === "malformed JSON")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "{",
          })
        if (failure === "empty body") return route.fulfill({ status: 204 })
        return route.fulfill({
          status: failure,
          json: { error: "Simulated API failure" },
        })
      },
    )
    await page.goto("/dashboard")
    const panel = page.getByRole("region", { name: "Needs Your Input" })
    await expect(
      page.getByText("Available project", { exact: true }),
    ).toBeVisible()
    await expect(panel.getByRole("alert")).toBeVisible()
    const settledCalls = calls
    await expect(panel.getByRole("button", { name: "Try again" })).toBeEnabled()
    expect(calls).toBe(settledCalls)
    recovered = true
    await panel.getByRole("button", { name: "Try again" }).click()
    await panel.getByRole("button", { name: "Review Now" }).click()
    await expect(panel.getByText("Current obligation")).toBeVisible()
    await expect(
      page.getByText("Available project", { exact: true }),
    ).toBeVisible()
  })
}

test("a 401 from the action endpoint exits the dashboard", async ({ page }) => {
  await restoreSession(page, "USER")
  await page.route("**/api/request-workflows/outstanding-actions?*", (route) =>
    route.fulfill({ status: 401, json: { error: "Session revoked" } }),
  )
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(
    page.getByRole("main", { name: "Client dashboard" }),
  ).toHaveCount(0)
})

test("missing optional metadata, calendar boundaries, and later access denial are safe", async ({
  page,
}) => {
  await restoreSession(page, "USER", { account: { fullName: null } })
  const now = new Date("2032-02-29T16:00:00Z")
  await page.clock.install({ time: now })
  let denied = false
  await page.route("**/api/projects", (route) =>
    denied
      ? route.fulfill({ status: 403, json: { error: "Unavailable" } })
      : route.fulfill({
          json: [
            {
              id: "empty",
              name: "No progress metadata",
              status: "IN_PROGRESS",
            },
            {
              id: "unknown",
              name: "Unsupported project status",
              status: "UNRECOGNIZED",
              taskCount: 1,
              completedTasks: 0,
            },
          ],
        }),
  )
  await page.route("**/api/client/service-requests?*", (route) =>
    route.fulfill({
      json: {
        requests: [
          {
            id: "legacy",
            title: null,
            service: null,
            status: "UNRECOGNIZED",
            createdAt: "invalid",
          },
          {
            id: "closed",
            title: "Closed booking",
            referenceNumber: null,
            status: "CLOSED",
            createdAt: "2032-02-29T16:01:00Z",
          },
        ],
      },
    }),
  )
  await page.route("**/api/projects/calendar", (route) =>
    route.fulfill({
      json: [
        {
          type: "consultation",
          title: "Invalid timestamp",
          startsAt: "invalid",
        },
        {
          type: "consultation",
          title: "Starts now",
          startsAt: now.toISOString(),
        },
        {
          type: "consultation",
          title: "Already past",
          startsAt: "2032-02-29T15:59:00Z",
        },
        {
          type: "consultation",
          title: "Previous meeting",
          startsAt: "2032-02-29T16:00:10Z",
          completed: true,
        },
        {
          type: "consultation",
          title: "Awaiting confirmation",
          startsAt: "2032-02-29T16:00:30Z",
          pending: true,
        },
        {
          type: "consultation",
          title: "Next in Manila",
          startsAt: "2032-02-29T16:01:00Z",
        },
        {
          type: "meeting",
          title: "Same start time",
          startsAt: "2032-02-29T16:01:00Z",
        },
      ],
    }),
  )
  await page.goto("/dashboard")
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  await expect(
    dashboard.getByRole("heading", { name: "Welcome back!", exact: true }),
  ).toBeVisible()
  await expect(
    dashboard.getByRole("progressbar", {
      name: "No progress metadata progress",
    }),
  ).toHaveCount(0)
  await expect(dashboard.getByText("Unsupported project status")).toHaveCount(0)
  await expect(
    dashboard.getByText("Status unavailable", { exact: true }),
  ).toBeVisible()
  await expect(dashboard.getByText("Closed booking")).toBeVisible()
  await expect(dashboard.getByText("Next in Manila")).toBeVisible()
  await expect(dashboard.getByText("Starts now")).toHaveCount(0)
  await expect(dashboard.getByText("Same start time")).toHaveCount(0)
  await expect(dashboard.getByText(/12:01\s*AM PHT/i)).toBeVisible()
  denied = true
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(
    dashboard
      .getByRole("region", { name: "Active Projects" })
      .getByRole("alert"),
  ).toBeVisible()
  await expect(
    dashboard.getByText("No progress metadata", { exact: true }),
  ).toHaveCount(0)
  await expect(dashboard.getByText("Closed booking")).toBeVisible()
})

test("duplicates and incomplete inbox rows do not affect outstanding actions", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  const item = {
    id: "update",
    requestId: "req",
    type: "QUOTATION_SENT",
    summary: "Review was requested",
    createdAt: "2026-01-01T00:00:00Z",
  }
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({
      json: {
        unreadCount: 1,
        notifications: [
          item,
          item,
          null,
          { ...item, id: "invalid", createdAt: "not a date" },
          {
            ...item,
            id: "unlinked",
            requestId: null,
            summary: "Unlinked inbox update",
          },
        ],
      },
    }),
  )
  await page.route("**/api/request-workflows/outstanding-actions?*", (route) =>
    route.fulfill({ json: actionPage([], 0) }),
  )
  const dashboard = page.getByRole("main", { name: "Client dashboard" })
  await page.goto("/dashboard")
  await expect(
    dashboard
      .getByRole("region", { name: "From Your Team" })
      .getByText("Review was requested", { exact: true }),
  ).toHaveCount(0)
  await expect(
    dashboard.getByText("No pending actions", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Notifications, 1 unread" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click()
  await expect(
    page.getByRole("menuitem", { name: /Review was requested/ }),
  ).toHaveCount(1)
  await expect(
    page.getByRole("menuitem", { name: /Unlinked inbox update/ }),
  ).toHaveCount(1)
})

test("an expired access token refreshes once and reloads the action read", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let refreshes = 0
  await page.route("**/api/auth/refresh", (route) => {
    refreshes++
    return route.fulfill({
      json: {
        token: "renewed-session",
        refreshToken: "renewed-refresh",
        expiresIn: 900,
      },
    })
  })
  await page.route("**/api/request-workflows/outstanding-actions?*", (route) =>
    route.request().headers().authorization === "Bearer renewed-session"
      ? route.fulfill({ json: actionPage() })
      : route.fulfill({
          status: 401,
          json: { error: "Expired token", code: "ACCESS_TOKEN_EXPIRED" },
        }),
  )
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Review Now" }).click()
  await expect(page.getByText("Current obligation")).toBeVisible()
  expect(refreshes).toBe(1)
})
