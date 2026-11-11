import { expect, test } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
  test(`Dashboard renders its accessible shell for ${role}`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    await page.goto("/dashboard")

    await expect(page.locator(`[data-role="${role}"]`)).toBeVisible()
    await expect(
      page.getByRole("main", { name: "Dashboard", exact: true }),
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
      page.getByRole("button", { name: "Open account menu" }),
    ).toBeVisible()
  })
}

test("Dashboard keeps its account loading state until lookup completes", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let releaseLookup: () => void = () => {}
  const lookupGate = new Promise<void>((resolve) => {
    releaseLookup = resolve
  })
  await page.route("**/api/auth/me", async (route) => {
    await lookupGate
    await route.fulfill({ json: { user: accountFor("ADMIN") } })
  })

  try {
    await page.goto("/dashboard")
    await expect(page.getByRole("status")).toHaveText("Loading your account…")
  } finally {
    releaseLookup()
  }

  await expect(
    page.getByRole("main", { name: "Dashboard", exact: true }),
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
    page.getByRole("main", { name: "Dashboard", exact: true }),
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
  await expect(
    page.getByRole("main", { name: "Dashboard", exact: true }),
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
})

test("Dashboard notification errors recover and keep the source link", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
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
  const trigger = page.getByRole("button", { name: /^Notifications/ })
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
