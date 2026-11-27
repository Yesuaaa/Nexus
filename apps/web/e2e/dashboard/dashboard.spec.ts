import { expect, test } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

type NotificationResponse = {
  notifications: {
    id: string
    requestId: string
    summary: string
    type: string
    entityId: string | null
    createdAt: string
    readAt: string | null
  }[]
  unreadCount: number
}

type NotificationFetchRecord = {
  signalPresent: boolean
  aborted: boolean
  abortEvents: number
  deferredResponse: boolean
  lateResponseReleased: boolean
  responseBodyParsed: boolean
}

type NotificationFetchControl = {
  requests: NotificationFetchRecord[]
  deferNextNotificationResponse: boolean
  releaseLateNotificationResponse?: (payload: NotificationResponse) => void
}

type WindowWithNotificationFetchControl = Window & {
  __pg020NotificationFetchControl?: NotificationFetchControl
}

for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
  test(
    role === "USER"
      ? "Dashboard renders its accessible shell for USER"
      : `Dashboard access for ${role} redirects to the workspace selector`,
    async ({ page }) => {
      await restoreSession(page, role)
      await page.route("**/api/request-conversations", (route) =>
        route.fulfill({
          json: { conversations: [], nextCursor: null, unreadCount: 2 },
        }),
      )
      await page.route("**/api/project-conversations?view=active", (route) =>
        route.fulfill({
          json: { conversations: [], nextCursor: null, unreadCount: 3 },
        }),
      )
      await page.goto("/dashboard")

      if (role !== "USER") {
        await expect(page).toHaveURL(/\/module$/)
        await expect(
          page.getByRole("main", { name: "Workspace selector", exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("heading", { name: "Module", exact: true }),
        ).toBeVisible()
        return
      }

      await expect(page.locator(`[data-role="${role}"]`)).toBeVisible()
      await expect(
        page.getByRole("main", { name: "Client dashboard", exact: true }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("navigation", { name: "Main menu" })
          .getByRole("link", { name: "Dashboard", exact: true }),
      ).toHaveAttribute("aria-current", "page")
      await expect(
        page.getByRole("button", { name: /^Notifications/ }),
      ).toBeVisible()
      await expect(page.getByRole("link", { name: /^Messages/ })).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Account menu" }),
      ).toBeVisible()
      // PG-020-F001-A002-T001 and A005-T002: additive shell assertions.
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText(
          "Access your services, requests, projects, and calendar from the navigation menu.",
          { exact: true },
        ),
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Messages, 5 unread", exact: true }),
      ).toHaveAttribute("href", "/messages")
      // PG-020-F001-A005-T001: preserve control assertion and inspect USER entries.
      await page
        .getByRole("button", { name: "Account menu", exact: true })
        .click()
      for (const [name, href] of [
        ["Profile", "/profile"],
        ["Billing Logs", "/billing-logs"],
        ["Settings", "/settings"],
      ]) {
        await expect(
          page.getByRole("menuitem", { name, exact: true }),
        ).toHaveAttribute("href", href)
      }
      await expect(
        page.getByRole("menuitem", { name: "Log out", exact: true }),
      ).toBeVisible()
      await page.getByRole("menuitem", { name: "Log out", exact: true }).click()
      await expect(page).toHaveURL(/\/login$/)
      expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBeNull()
    },
  )
}

test("Dashboard keeps its account loading state until lookup completes", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let releaseLookup: () => void = () => {}
  const lookupGate = new Promise<void>((resolve) => {
    releaseLookup = resolve
  })
  await page.route("**/api/auth/me", async (route) => {
    await lookupGate
    await route.fulfill({ json: { user: accountFor("USER") } })
  })

  try {
    await page.goto("/dashboard")
    await expect(page.getByRole("status")).toHaveText("Loading your account…")
  } finally {
    releaseLookup()
  }

  await expect(
    page.getByRole("main", { name: "Client dashboard", exact: true }),
  ).toBeVisible()
})

test("Dashboard reports an account lookup failure without showing the portal", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  )

  await page.goto("/dashboard")

  await expect(page.locator('main[role="alert"]')).toContainText(
    "Please refresh to try again.",
  )
  await expect(
    page.getByRole("main", { name: "Client dashboard", exact: true }),
  ).toHaveCount(0)
})

test("Dashboard navigation works from the mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await restoreSession(page, "USER")
  await page.goto("/dashboard")

  const sidebar = page.getByLabel("Primary navigation")
  await expect(sidebar).toBeHidden()
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(sidebar).toHaveAttribute("data-drawer-open", "true")

  const dashboardLink = page
    .getByRole("navigation", { name: "Main menu" })
    .getByRole("link", { name: "Dashboard", exact: true })
  await expect(dashboardLink).toHaveAttribute("aria-current", "page")
  await dashboardLink.click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(sidebar).toHaveAttribute("data-drawer-open", "false")
  // PG-020-F001-A004-T001: retain link-close checks, then verify Escape.
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(sidebar).toHaveAttribute("data-drawer-open", "true")
  await page.keyboard.press("Escape")
  await expect(sidebar).toHaveAttribute("data-drawer-open", "false")
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await page
    .getByRole("button", { name: "Close navigation menu", exact: true })
    .first()
    .click({ position: { x: 380, y: 400 } })
  await expect(sidebar).toHaveAttribute("data-drawer-open", "false")
  await expect(
    page.getByRole("main", { name: "Client dashboard", exact: true }),
  ).toBeVisible()
})

test("Dashboard notifications show loading before an empty result", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let releaseNotifications: () => void = () => {}
  const notificationGate = new Promise<void>((resolve) => {
    releaseNotifications = resolve
  })
  await page.route("**/api/request-workflows/notifications", async (route) => {
    await notificationGate
    await route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  try {
    await page.goto("/dashboard")
    await page.getByRole("button", { name: /^Notifications/ }).click()
    await expect(
      page.getByText("Loading notifications…", { exact: true }),
    ).toBeVisible()
  } finally {
    releaseNotifications()
  }

  await expect(
    page.getByText("You're all caught up.", { exact: true }),
  ).toBeVisible()
  // PG-020-F001-A006-T001: empty feed has no actionable bulk mutation.
  await expect(
    page.getByRole("menuitem", { name: "Mark all as read", exact: true }),
  ).toHaveAttribute("data-disabled", "")
})

test("Dashboard notification errors recover and keep the source link", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let unavailable = true
  await page.route("**/api/request-workflows/notifications", (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({
          json: {
            notifications: [
              {
                id: "notification-1",
                requestId: "request-1",
                summary: "Project is active",
                type: "PROJECT_ACTIVATED",
                entityId: "project-1",
                createdAt: "2026-11-11T00:00:00.000Z",
                readAt: "2026-11-11T00:00:00.000Z",
              },
            ],
            unreadCount: 0,
          },
        }),
  )

  await page.goto("/dashboard")
  const trigger = page.locator('button[aria-label^="Notifications"]')
  await trigger.click()
  await expect(
    page.getByText("Couldn't load notifications.", { exact: true }),
  ).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(trigger).toBeVisible()
  unavailable = false
  await trigger.click()
  await expect(
    page.getByRole("menuitem", { name: /Project is active/ }),
  ).toHaveAttribute("href", "/projects/project-1")
})

test("[PG-020-F001-A006-T002] notification badge retains full accessible count", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let unreadCount = 0
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({ json: { notifications: [], unreadCount } }),
  )
  await page.goto("/dashboard")
  const trigger = page.locator('button[aria-label^="Notifications"]')
  await trigger.click()
  await expect(
    page.getByText("You're all caught up.", { exact: true }),
  ).toBeVisible()
  await expect(trigger.locator("span")).toHaveCount(0)
  for (const count of [1, 105]) {
    await page.keyboard.press("Escape")
    unreadCount = count
    await trigger.click()
    await page.keyboard.press("Escape")
    await expect(trigger).toHaveAccessibleName(`Notifications, ${count} unread`)
    await expect(trigger.locator("span")).toHaveText(
      count > 99 ? "99+" : String(count),
    )
  }
})

test("[PG-020-F001-A008-T002] request notification encodes its destination", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  const requestId = "request/with?reserved&characters=#"
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({
      json: {
        notifications: [
          {
            id: "encoded-notice",
            requestId,
            summary: "Public request update",
            type: "REQUEST_ACCEPTED",
            entityId: null,
            createdAt: "2026-11-11T00:00:00.000Z",
            readAt: "2026-11-11T00:00:00.000Z",
          },
        ],
        unreadCount: 0,
      },
    }),
  )
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await expect(
    page.getByRole("menuitem", { name: /Public request update/ }),
  ).toHaveAttribute(
    "href",
    `/messages?request=${encodeURIComponent(requestId)}`,
  )
})

test("[PG-020-F001-A010-T002] bulk read retries failures and disables pending work", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let unreadCount = 2
  let fail = true
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({ json: { notifications: [], unreadCount } }),
  )
  await page.route(
    "**/api/request-workflows/notifications/read-all",
    async (route) => {
      if (fail)
        return route.fulfill({ status: 503, json: { error: "Unavailable" } })
      await gate
      unreadCount = 0
      await route.fulfill({ json: { ok: true } })
    },
  )
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /^Notifications/ }).click()
  const action = page.getByRole("menuitem", {
    name: "Mark all as read",
    exact: true,
  })
  await action.click()
  await expect(
    page.getByText("Couldn't mark all notifications as read. Try again.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(action).not.toHaveAttribute("data-disabled")
  fail = false
  await action.click()
  try {
    await expect(
      page.getByRole("menuitem", { name: /Marking as read/ }),
    ).toHaveAttribute("data-disabled", "")
  } finally {
    release()
  }
  await expect(
    page.getByText("All notifications marked as read", { exact: true }),
  ).toBeVisible()
  await expect(action).toHaveAttribute("data-disabled", "")
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible()
})

test("[PG-020-F001-A009-T002] unread selection sends scoped PATCH and keeps failure retryable", async ({
  page,
}) => {
  await restoreSession(page, "USER")
  let read = false
  let fail = true
  const writes: string[] = []
  await page.route("**/api/request-conversations/request-1", (route) =>
    route.fulfill({
      status: 404,
      json: { error: "Synthetic destination outside this test" },
    }),
  )
  await page.route("**/api/request-workflows/notifications", (route) =>
    route.fulfill({
      json: {
        notifications: [
          {
            id: "notice-1",
            requestId: "request-1",
            summary: "Unread request update",
            type: "REQUEST_ACCEPTED",
            entityId: null,
            createdAt: "2026-11-11T00:00:00Z",
            readAt: read ? "2026-11-11T00:01:00Z" : null,
          },
        ],
        unreadCount: read ? 0 : 1,
      },
    }),
  )
  await page.route(
    "**/api/request-workflows/notifications/notice-1/read",
    (route) => {
      writes.push(route.request().method())
      if (fail)
        return route.fulfill({ status: 503, json: { error: "Unavailable" } })
      read = true
      return route.fulfill({ json: { ok: true } })
    },
  )
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await page.getByRole("menuitem", { name: /Unread request update/ }).click()
  await expect(page).toHaveURL(/\/messages\?request=request-1$/)
  await expect.poll(() => writes.length).toBe(1)
  await page.goto("/dashboard")
  await expect(
    page.getByRole("button", { name: "Notifications, 1 unread", exact: true }),
  ).toBeVisible()
  fail = false
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await page.getByRole("menuitem", { name: /Unread request update/ }).click()
  await expect.poll(() => read).toBe(true)
  expect(writes).toEqual(["PATCH", "PATCH"])
})

test("[PG-020-F001-A011-T002] periodic refresh guards pending work and stops on unmount", async ({
  page,
}) => {
  await page.clock.install()
  const clientA = accountFor("USER", {
    id: "client-a",
    email: "client-a@example.test",
    fullName: "Client A",
  })
  const clientB = accountFor("USER", {
    id: "client-b",
    email: "client-b@example.test",
    fullName: "Client B",
  })
  let activeAccount = clientA
  let accessToken = "test-session"
  await restoreSession(page, "USER", {
    account: clientA,
    accessToken: () => accessToken,
  })

  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON() as { email?: string }
    expect(body.email).toBe(clientB.email)
    activeAccount = clientB
    accessToken = "client-b-session"
    await route.fulfill({
      json: {
        token: accessToken,
        refreshToken: "client-b-refresh",
        user: clientB,
        expiresIn: 900,
      },
    })
  })
  await page.route("**/api/auth/me", async (route) => {
    expect(route.request().headers().authorization).toBe(
      `Bearer ${accessToken}`,
    )
    await route.fulfill({ json: { user: activeAccount } })
  })

  const clientALateResponse: NotificationResponse = {
    notifications: [
      {
        id: "client-a-late-notice",
        requestId: "request-a",
        summary: "Client A stale notification sentinel",
        type: "PROJECT_ACTIVATED",
        entityId: "project-a",
        createdAt: "2026-11-26T00:00:00.000Z",
        readAt: null,
      },
    ],
    unreadCount: 9,
  }
  const clientBResponse: NotificationResponse = {
    notifications: [
      {
        id: "client-b-current-notice",
        requestId: "request-b",
        summary: "Client B current notification",
        type: "PROJECT_ACTIVATED",
        entityId: "project-b",
        createdAt: "2026-11-26T00:01:00.000Z",
        readAt: null,
      },
    ],
    unreadCount: 2,
  }
  let reads = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/request-workflows/notifications", async (route) => {
    reads++
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers().authorization).toBe(
      `Bearer ${accessToken}`,
    )
    if (reads === 2) {
      await gate
      try {
        await route.fulfill({ json: clientALateResponse })
      } catch {
        // The browser has already cancelled this intercepted request.
      }
      return
    }
    await route.fulfill({
      json:
        activeAccount.id === clientB.id
          ? clientBResponse
          : { notifications: [], unreadCount: 0 },
    })
  })

  await page.addInitScript(() => {
    const control: NotificationFetchControl = {
      requests: [],
      deferNextNotificationResponse: false,
    }
    ;(
      window as WindowWithNotificationFetchControl
    ).__pg020NotificationFetchControl = control
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const requestUrl = input instanceof Request ? input.url : String(input)
      if (
        new URL(requestUrl, window.location.href).pathname !==
        "/api/request-workflows/notifications"
      ) {
        return nativeFetch(input, init)
      }

      const signal =
        init?.signal ?? (input instanceof Request ? input.signal : null)
      const record: NotificationFetchRecord = {
        signalPresent: signal !== null,
        aborted: signal?.aborted ?? false,
        abortEvents: 0,
        deferredResponse: false,
        lateResponseReleased: false,
        responseBodyParsed: false,
      }
      control.requests.push(record)
      signal?.addEventListener(
        "abort",
        () => {
          record.aborted = true
          record.abortEvents++
        },
        { once: true },
      )

      const networkRequest = nativeFetch(input, init)
      if (!control.deferNextNotificationResponse) return networkRequest

      control.deferNextNotificationResponse = false
      record.deferredResponse = true
      void networkRequest.catch(() => {})
      return new Promise<Response>((resolve) => {
        control.releaseLateNotificationResponse = (payload) => {
          record.lateResponseReleased = true
          const response = new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
          const readJson = response.json.bind(response)
          Object.defineProperty(response, "json", {
            value: async () => {
              record.responseBodyParsed = true
              return readJson()
            },
          })
          resolve(response)
        }
      })
    }
  })

  try {
    await page.goto("/dashboard")
    await expect.poll(() => reads).toBe(1)
    await page.evaluate(() => {
      const control = (window as WindowWithNotificationFetchControl)
        .__pg020NotificationFetchControl
      if (!control)
        throw new Error("Notification fetch observer was not installed")
      control.deferNextNotificationResponse = true
    })
    await page.clock.fastForward(30_000)
    await expect.poll(() => reads).toBe(2)
    const pendingRequest = await page.evaluate(() => {
      const control = (window as WindowWithNotificationFetchControl)
        .__pg020NotificationFetchControl
      return control?.requests[1] ?? null
    })
    expect(pendingRequest).toMatchObject({
      signalPresent: true,
      aborted: false,
      abortEvents: 0,
      deferredResponse: true,
      lateResponseReleased: false,
    })
    await page.clock.fastForward(90_000)
    expect(reads).toBe(2)

    const abortedRequest = page.waitForEvent(
      "requestfailed",
      (request) =>
        new URL(request.url()).pathname ===
          "/api/request-workflows/notifications" && request.method() === "GET",
    )
    await page.getByRole("button", { name: "Account menu" }).click()
    await page.getByRole("menuitem", { name: "Log out", exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()

    const failedRequest = await abortedRequest
    expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED")
    const abortedObservation = await page.evaluate(() => {
      const control = (window as WindowWithNotificationFetchControl)
        .__pg020NotificationFetchControl
      return control?.requests[1] ?? null
    })
    expect(abortedObservation).toMatchObject({
      signalPresent: true,
      aborted: true,
      abortEvents: 1,
      deferredResponse: true,
      lateResponseReleased: false,
      responseBodyParsed: false,
    })

    release()
    await page.clock.fastForward(60_000)
    expect(reads).toBe(2)

    await page.getByLabel("Email address", { exact: true }).fill(clientB.email)
    await page
      .getByLabel("Password", { exact: true })
      .fill("SyntheticPassword123!")
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("button", {
        name: "Notifications, 2 unread",
        exact: true,
      }),
    ).toBeVisible()

    await page.getByRole("button", { name: /^Notifications/ }).click()
    await expect(
      page.getByRole("menuitem", { name: /Client B current notification/ }),
    ).toBeVisible()
    await page.evaluate((payload) => {
      const control = (window as WindowWithNotificationFetchControl)
        .__pg020NotificationFetchControl
      if (!control?.releaseLateNotificationResponse) {
        throw new Error("The held Client A response was not registered")
      }
      control.releaseLateNotificationResponse(payload)
    }, clientALateResponse)
    await page.evaluate(
      () => new Promise<void>((resolve) => queueMicrotask(resolve)),
    )

    const releasedObservation = await page.evaluate(() => {
      const control = (window as WindowWithNotificationFetchControl)
        .__pg020NotificationFetchControl
      return control?.requests[1] ?? null
    })
    expect(releasedObservation).toMatchObject({
      aborted: true,
      lateResponseReleased: true,
      responseBodyParsed: false,
    })
    await expect(
      page.getByRole("menuitem", { name: /Client B current notification/ }),
    ).toBeVisible()
    await expect(
      page.getByText("Client A stale notification sentinel", { exact: true }),
    ).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", {
        name: "Notifications, 2 unread",
        exact: true,
      }),
    ).toBeVisible()
  } finally {
    release()
    await page.unrouteAll({ behavior: "ignoreErrors" })
  }
})
